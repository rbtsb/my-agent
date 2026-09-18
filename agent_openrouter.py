"""
Unified agent — the main chat. Combines everything built across this project into one LangGraph:
- RAG (Milvus + TEI) for knowledge-base questions
- Simple tools: list_tasks, get_weather, query_crm_database (reads run immediately)
- Structured, cancellable human-in-the-loop for anything consequential:
    * schedule_task — appointment (asks a DATE) or reminder (asks DAY(S) OF WEEK), with slot
      filling (skips the question if the user already said it) and full cancel support
    * delete_task — plain yes/no confirm
    * query_crm_database writes (INSERT/UPDATE/DELETE) — plain yes/no confirm
  All of these use interrupt_protocol.py, so the web UI (or any future client) renders them from
  one shared JSON schema instead of the agent knowing anything about HTML.

Run:
    pip install -r requirements.txt
    docker compose up -d
    python agent_openrouter.py "what are my tasks?"          # one-shot
    python agent_openrouter.py                                # interactive terminal
    python web_app.py                                          # web UI, see static/index.html
"""

import io
import json
import operator
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Annotated, List, Optional, TypedDict

import psycopg2
from dotenv import load_dotenv
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from openai import OpenAI, RateLimitError

from interrupt_protocol import choice_interrupt, confirm_interrupt, date_interrupt, field_values, is_cancelled, is_confirmed

load_dotenv(Path(__file__).parent / ".env")

# Windows terminals default to cp1252, which can't encode characters like '°' — force UTF-8.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

STATE_FILE = Path(__file__).parent / "tasks.json"
KNOWLEDGE_BASE_FILE = Path(__file__).parent / "knowledge_base.md"  # kept only for reference/embedding script

# Overridable via env vars: "localhost" is correct when running on the host, but wrong from
# inside docker-compose, where services reach each other by service name (see docker-compose.yml).
MILVUS_URI = os.environ.get("MILVUS_URI", "http://localhost:19530")
MILVUS_COLLECTION = "knowledge_base"
TEI_URL = os.environ.get("TEI_URL", "http://localhost:8080/embed")
RAG_TOP_K = 3

# budget-management-system (separate Spring Boot service). BUDGET_PERSON_ID is fixed rather than
# taken from the LLM: this app is single-user/local (see THREAD_ID below), and personId must never
# be something the model's tool-call arguments control, or a prompt-injected message could redirect
# a transaction onto a different person's account.
BUDGET_API_BASE_URL = os.environ.get("BUDGET_API_BASE_URL", "http://localhost:8090")
BUDGET_API_KEY = os.environ.get("BUDGET_API_KEY", "")
BUDGET_PERSON_ID = int(os.environ.get("BUDGET_PERSON_ID", "0"))

MODEL = "nvidia/nemotron-3-super-120b-a12b:free"  # pick any tool-calling model from https://openrouter.ai/models

# Fallback API key: OpenRouter's free tier caps requests per account per day. If a second key
# (e.g. from a different account/email) is set, a 429 on the primary key retries once on the
# fallback before giving up — this does NOT get around per-model rate limits, only the
# separate daily account-wide cap.
_clients = [OpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY"])]
if os.environ.get("OPENROUTER_API_KEY_2"):
    _clients.append(OpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY_2"]))


def _chat_completion(**kwargs):
    last_error = None
    for c in _clients:
        try:
            response = c.chat.completions.create(**kwargs)
        except RateLimitError as exc:
            last_error = exc
            continue  # try the next key, if any
        if not response.choices:
            # OpenRouter sometimes returns HTTP 200 with an error body instead of raising —
            # e.g. the upstream provider itself is overloaded. Treat it the same as a 429.
            last_error = RuntimeError(f"Provider returned no choices: {response}")
            continue
        return response
    raise last_error

_milvus_client = None


def _milvus():
    # Imported lazily, not at module load: pymilvus pulls in pandas, whose native DLL can be
    # blocked by an environment's Application Control policy independently of whether Milvus is
    # even reachable. That must not crash every tool call — only ones that actually need RAG,
    # which already degrade gracefully (see retrieved_context_message's caller in run()).
    global _milvus_client
    if _milvus_client is None:
        from pymilvus import MilvusClient

        _milvus_client = MilvusClient(uri=MILVUS_URI)
    return _milvus_client


def embed_query(text: str) -> list:
    # Calls the always-on TEI service instead of loading a model in-process.
    body = json.dumps({"inputs": [text]}).encode("utf-8")
    req = urllib.request.Request(TEI_URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)[0]


def retrieved_context_message(query: str):
    client_ = _milvus()
    query_vector = embed_query(query)
    results = client_.search(collection_name=MILVUS_COLLECTION, data=[query_vector], limit=RAG_TOP_K, output_fields=["text"])[0]
    excerpts = "\n\n---\n\n".join(hit["entity"]["text"] for hit in results) if results else "(no matching knowledge-base excerpts found)"
    return {"role": "system", "content": "Relevant knowledge base excerpts:\n\n" + excerpts}


def base_system_message():
    import datetime

    today = datetime.date.today().isoformat()
    return {
        "role": "system",
        "content": f"Today's date is {today}. You help the user manage tasks, check weather, "
        "query the CRM database, track their personal budget (balance, income/expense entries, "
        "category budgets), and answer questions about the company using the knowledge-base "
        "excerpts provided in context. Answer directly, the way a colleague who already knows "
        "this would.\n\n"
        "For budget tools: get_balance/list_transactions/list_budgets/create_or_update_budget run "
        "immediately, no confirmation needed. create_transaction (recording income or an expense) "
        "always shows an automatic confirm/cancel UI before posting, so call it directly as soon as "
        "the amount and type (INCOME/EXPENSE) are clear — never ask for confirmation in text first. "
        "Always convert an informal currency name the user says (e.g. 'RM', 'ringgit') to its "
        "3-letter ISO-4217 code (MYR) before calling any budget tool that takes a currency. "
        "list_transactions and list_budgets already return a Markdown table, pre-formatted and ready "
        "to display — repeat that table back to the user EXACTLY as given (same pipes, same rows), "
        "with at most one short sentence before it. Never convert it to JSON, prose, or a bulleted "
        "list, and never re-summarize the numbers into a paragraph instead of showing the table.\n\n"
        "For schedule_task: as soon as you know the title and kind, call the tool immediately — "
        "even with date/days missing. A UI automatically asks the user for whatever's missing "
        "after you call it, so never ask for the date or days yourself in plain text first, and "
        "never wait to have every field before calling. If the user only says 'schedule an "
        "appointment' with no title yet, that's the one thing worth asking about in plain text, "
        "since it's not something the interrupt UI collects. If the user gave a relative date "
        "('tomorrow', 'next Friday'), resolve it yourself using today's date above and pass the "
        "resulting ISO date instead of leaving it unset.\n\n"
        "For any tool that mentions an automatic confirm/cancel UI: call it directly as soon as the "
        "user's request is clear. Never ask for confirmation in plain text yourself, and never treat "
        "a typed 'yes' as approval — the only real approval is the user clicking Confirm in that UI, "
        "which happens after you call the tool, not before.",
    }

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "List all current tasks.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a city name.",
            "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_crm_database",
            "description": (
                "Run a SQL query against the LOCAL DEV crm_db PostgreSQL database. SELECT queries "
                "run immediately. For INSERT/UPDATE/DELETE, call this tool directly as soon as the "
                "user's intent is clear — a confirm/cancel UI is shown automatically before anything "
                "is written."
            ),
            "parameters": {"type": "object", "properties": {"sql": {"type": "string"}}, "required": ["sql"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_task",
            "description": (
                "Schedule a new task. kind='appointment' for a one-off task tied to a specific day "
                "(e.g. 'call the dentist tomorrow') — needs a DATE. kind='reminder' for something "
                "recurring on certain weekdays (e.g. 'remind me to drink water') — needs DAY(S) OF "
                "WEEK."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "kind": {"type": "string", "enum": ["appointment", "reminder"]},
                    "date": {"type": "string", "description": "ISO date (YYYY-MM-DD) if already known"},
                    "days": {"type": "array", "items": {"type": "string"}, "description": "weekdays if already known"},
                },
                "required": ["title", "kind"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_balance",
            "description": (
                "Get the user's current budget account balance / moojudi — how much money they have. "
                "Call this for things like 'how much is my balance', 'what's my moojudi', 'how much "
                "money do I have left'."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_transaction",
            "description": (
                "Record an income or expense in the user's budget account and update their balance. "
                "type='INCOME' for money received (salary, refund, transfer in), type='EXPENSE' for "
                "money spent (purchase, bill, transfer out) — always send a positive amount, the type "
                "carries the sign. Resolve any informal currency name (e.g. 'RM') to its 3-letter "
                "ISO-4217 code (e.g. MYR) before calling. Call this directly as soon as the amount and "
                "type are clear — a confirm/cancel UI is shown automatically before anything is posted."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["INCOME", "EXPENSE"]},
                    "amount": {"type": "number", "description": "Always positive."},
                    "currency": {"type": "string", "description": "3-letter ISO-4217 code, e.g. MYR"},
                    "category": {"type": "string", "description": "e.g. salary, groceries, rent"},
                    "description": {"type": "string"},
                },
                "required": ["type", "amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_transactions",
            "description": "List the user's recent income/expense entries, most recent first.",
            "parameters": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "description": "Max entries to return, default 10."}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_or_update_budget",
            "description": (
                "Set a spending limit (budget) for a category, e.g. 'set a budget of 500 for groceries "
                "every month'. Calling it again for the same category/period replaces the previous "
                "limit rather than creating a duplicate. Runs immediately, no confirmation needed."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string"},
                    "limit_amount": {"type": "number"},
                    "currency": {"type": "string", "description": "3-letter ISO-4217 code, e.g. MYR"},
                    "period": {"type": "string", "enum": ["WEEKLY", "MONTHLY", "YEARLY"]},
                },
                "required": ["category", "limit_amount", "period"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_budgets",
            "description": "List every budget (spending limit) the user has set, across all categories.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": (
                "Delete a task by its id. Call this directly as soon as the user names which task "
                "— a confirm/cancel UI is shown automatically before anything is deleted."
            ),
            "parameters": {"type": "object", "properties": {"task_id": {"type": "integer"}}, "required": ["task_id"]},
        },
    },
]


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"tasks": [], "next_id": 1}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _format_task(t):
    if t.get("kind") == "appointment":
        return f"[{t['id']}] {t['title']} — {t.get('date', '?')}"
    if t.get("kind") == "reminder":
        return f"[{t['id']}] {t['title']} — every {', '.join(t.get('days') or [])}"
    return f"[{t['id']}] {t['title']}"


def _run_sql(sql: str) -> str:
    try:
        conn = psycopg2.connect(
            host=os.environ.get("CRM_DB_HOST", "localhost"),
            port=os.environ.get("CRM_DB_PORT", "5432"),
            dbname=os.environ.get("CRM_DB_NAME", "crm_db"),
            user=os.environ.get("CRM_DB_USER", "postgres"),
            password=os.environ.get("CRM_DB_PASSWORD", ""),
        )
        try:
            with conn:
                with conn.cursor() as cur:
                    cur.execute(sql)
                    if cur.description:
                        columns = [c.name for c in cur.description]
                        rows = cur.fetchmany(50)
                        return json.dumps({"columns": columns, "rows": rows}, default=str)
                    return f"OK — {cur.rowcount} row(s) affected."
        finally:
            conn.close()
    except Exception as exc:
        return f"Database error: {exc}"


def _is_write_sql(sql: str) -> bool:
    first_word = sql.rstrip(";").strip().split(None, 1)[0].upper() if sql.strip() else ""
    return first_word in ("INSERT", "UPDATE", "DELETE")


class AgentState(TypedDict):
    messages: Annotated[List[dict], operator.add]
    title: Optional[str]
    kind: Optional[str]
    date: Optional[str]
    days: Optional[List[str]]
    delete_id: Optional[int]
    pending_sql: Optional[str]
    pending_transaction: Optional[dict]


def _tool_msg(call_id, content):
    return {"role": "tool", "tool_call_id": call_id, "content": content}


def agent_node(state: AgentState):
    response = _chat_completion(model=MODEL, tools=TOOLS, messages=[base_system_message()] + state["messages"])
    msg = response.choices[0].message
    assistant_message = msg.model_dump(exclude_none=True)

    if not msg.tool_calls:
        return {"messages": [assistant_message]}

    # Only the first tool call per turn is handled — free tool-calling models rarely batch more
    # than one at a time in practice; a batch would need per-call queuing like web_app.py's
    # confirm flow used to do before this rewrite.
    call = msg.tool_calls[0]
    name = call.function.name
    args = json.loads(call.function.arguments or "{}")

    if name == "list_tasks":
        st = load_state()
        result = "\n".join(_format_task(t) for t in st["tasks"]) if st["tasks"] else "No tasks."
        return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")

    if name == "get_weather":
        result = _get_weather(args["city"])
        return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")

    if name == "query_crm_database":
        sql = args["sql"].strip()
        if _is_write_sql(sql):
            update = {"messages": [assistant_message, _tool_msg(call.id, "Awaiting confirmation.")], "pending_sql": sql}
            return Command(update=update, goto="ask_db_confirm")
        result = _run_sql(sql)
        return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")

    if name == "schedule_task":
        update = {
            "messages": [assistant_message, _tool_msg(call.id, "Collecting the remaining details.")],
            "title": args["title"], "kind": args["kind"], "date": args.get("date"), "days": args.get("days"),
        }
        goto = "ask_date" if args["kind"] == "appointment" else "ask_days"
        return Command(update=update, goto=goto)

    if name == "delete_task":
        update = {"messages": [assistant_message, _tool_msg(call.id, "Awaiting confirmation.")], "delete_id": args["task_id"]}
        return Command(update=update, goto="ask_delete_confirm")

    if name == "get_balance":
        result = _budget_result(_get_balance)
        return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")

    if name == "list_transactions":
        result = _budget_text_result(lambda: _format_transactions_table(_list_transactions(args.get("limit", 10))))
        return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")

    if name == "list_budgets":
        result = _budget_text_result(lambda: _format_budgets_table(_list_budgets()))
        return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")

    if name == "create_or_update_budget":
        result = _budget_result(lambda: _create_or_update_budget(
            args["category"], args["limit_amount"], args.get("currency"), args.get("period", "MONTHLY")))
        return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")

    if name == "create_transaction":
        update = {"messages": [assistant_message, _tool_msg(call.id, "Awaiting confirmation.")], "pending_transaction": args}
        return Command(update=update, goto="ask_transaction_confirm")

    return Command(update={"messages": [assistant_message, _tool_msg(call.id, f"Unknown tool: {name}")]}, goto="agent")


def _budget_result(call) -> str:
    """Runs a read-only budget-API call and renders its result (or failure) as tool output text."""
    try:
        return json.dumps(call())
    except Exception as exc:
        return f"Budget API error: {exc}"


def _budget_text_result(call) -> str:
    """Like _budget_result, but for calls that already return a display-ready string (a formatted
    table) instead of raw JSON — the model is told to relay these verbatim, not reformat them."""
    try:
        return call()
    except Exception as exc:
        return f"Budget API error: {exc}"


def _format_transactions_table(page: dict) -> str:
    """Renders a transactions page as a Markdown table, built here rather than left to the model:
    a free/weak model reformatting raw JSON is unreliable (sometimes it just echoes the JSON back),
    so the tool result IS the final display text, verbatim."""
    rows = page.get("content", [])
    if not rows:
        return "No transactions yet."
    lines = ["| Date | Type | Category | Amount | Balance after |", "|---|---|---|---:|---:|"]
    for t in rows:
        occurred = str(t.get("occurredAt", ""))[:16].replace("T", " ")
        sign = "+" if t.get("type") == "INCOME" else "-"
        amount = f"{sign}{t.get('amount')} {t.get('currency', '')}".strip()
        balance = f"{t.get('balanceAfter')} {t.get('currency', '')}".strip()
        category = t.get("category") or "-"
        lines.append(f"| {occurred} | {t.get('type', '')} | {category} | {amount} | {balance} |")
    return "\n".join(lines)


def _format_budgets_table(budgets: list) -> str:
    if not budgets:
        return "No budgets set yet."
    lines = ["| Category | Limit | Period | Start date |", "|---|---:|---|---|"]
    for b in budgets:
        limit = f"{b.get('limitAmount')} {b.get('currency', '')}".strip()
        lines.append(f"| {b.get('category', '')} | {limit} | {b.get('period', '')} | {b.get('startDate', '')} |")
    return "\n".join(lines)


def _get_weather(city: str) -> str:
    geo_url = "https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode({"name": city, "count": 1})
    with urllib.request.urlopen(geo_url, timeout=10) as resp:
        geo = json.load(resp)
    if not geo.get("results"):
        return f"Could not find location: {city}"
    lat, lon = geo["results"][0]["latitude"], geo["results"][0]["longitude"]
    weather_url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(
        {"latitude": lat, "longitude": lon, "current": "temperature_2m,wind_speed_10m"}
    )
    with urllib.request.urlopen(weather_url, timeout=10) as resp:
        current = json.load(resp)["current"]
    return f"{city}: {current['temperature_2m']}°C, wind {current['wind_speed_10m']} km/h"


def _budget_request(method: str, path: str, body: dict = None):
    url = BUDGET_API_BASE_URL.rstrip("/") + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Content-Type": "application/json", "X-API-Key": BUDGET_API_KEY},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"budget API {exc.code}: {detail}") from exc


def _get_balance() -> dict:
    return _budget_request("GET", f"/api/v1/persons/{BUDGET_PERSON_ID}/balance")


def _create_transaction(type_: str, amount, currency: str = None, category: str = None,
                         description: str = None, idempotency_key: str = None) -> dict:
    body = {"personId": BUDGET_PERSON_ID, "type": type_, "amount": amount}
    if currency:
        body["currency"] = currency
    if category:
        body["category"] = category
    if description:
        body["description"] = description
    if idempotency_key:
        body["idempotencyKey"] = idempotency_key
    return _budget_request("POST", "/api/v1/transactions", body)


def _list_transactions(limit: int = 10) -> dict:
    return _budget_request("GET", f"/api/v1/persons/{BUDGET_PERSON_ID}/transactions?size={int(limit)}")


def _create_or_update_budget(category: str, limit_amount, currency: str = None, period: str = "MONTHLY") -> dict:
    body = {
        "personId": BUDGET_PERSON_ID, "category": category, "limitAmount": limit_amount,
        "currency": currency or "MYR", "period": period,
    }
    return _budget_request("POST", "/api/v1/budgets", body)


def _list_budgets() -> list:
    return _budget_request("GET", f"/api/v1/persons/{BUDGET_PERSON_ID}/budgets")


def _cancelled_schedule_update(state: AgentState):
    return {
        "messages": [{"role": "assistant", "content": f'Cancelled — "{state["title"]}" was not scheduled.'}],
        "title": None, "kind": None, "date": None, "days": None,
    }


def ask_date(state: AgentState):
    if state.get("date"):  # slot filling
        return Command(goto="finalize_schedule")
    payload = date_interrupt(str(uuid.uuid4()), f'What date is "{state["title"]}"?', "date", "Date")
    response = interrupt(payload)
    if is_cancelled(response):
        return Command(update=_cancelled_schedule_update(state), goto=END)
    values = field_values(response, "date")
    if not values:
        return Command(update=_cancelled_schedule_update(state), goto=END)
    return Command(update={"date": values[0]}, goto="finalize_schedule")


def ask_days(state: AgentState):
    if state.get("days"):  # slot filling
        return Command(goto="finalize_schedule")
    payload = choice_interrupt(
        str(uuid.uuid4()), f'Which day(s) is "{state["title"]}" for?', "days", "Day(s)",
        options=[(d, d) for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]], multiple=True,
    )
    response = interrupt(payload)
    if is_cancelled(response):
        return Command(update=_cancelled_schedule_update(state), goto=END)
    days = field_values(response, "days")
    if not days:
        return Command(update=_cancelled_schedule_update(state), goto=END)
    return Command(update={"days": days}, goto="finalize_schedule")


def finalize_schedule(state: AgentState):
    st = load_state()
    task = {"id": st["next_id"], "title": state["title"], "kind": state["kind"], "date": state.get("date"), "days": state.get("days")}
    st["tasks"].append(task)
    st["next_id"] += 1
    save_state(st)

    if state["kind"] == "appointment":
        summary = f'Scheduled "{state["title"]}" (#{task["id"]}) for {state["date"]}.'
    else:
        summary = f'Set a recurring reminder for "{state["title"]}" (#{task["id"]}) on {", ".join(state["days"])}.'

    return {"messages": [{"role": "assistant", "content": summary}], "title": None, "kind": None, "date": None, "days": None}


def ask_delete_confirm(state: AgentState):
    st = load_state()
    match = next((t for t in st["tasks"] if t["id"] == state["delete_id"]), None)
    if not match:
        return {"messages": [{"role": "assistant", "content": f"No task with id {state['delete_id']}."}], "delete_id": None}

    payload = confirm_interrupt(str(uuid.uuid4()), f'Delete task #{match["id"]} "{match["title"]}"?')
    response = interrupt(payload)

    if is_confirmed(response):
        st["tasks"] = [t for t in st["tasks"] if t["id"] != state["delete_id"]]
        save_state(st)
        summary = f'Deleted task #{match["id"]} ("{match["title"]}").'
    else:
        summary = "Cancelled — nothing was deleted."
    return {"messages": [{"role": "assistant", "content": summary}], "delete_id": None}


def ask_db_confirm(state: AgentState):
    payload = confirm_interrupt(str(uuid.uuid4()), f"Execute this SQL against crm_db?\n\n{state['pending_sql']}")
    response = interrupt(payload)

    if is_confirmed(response):
        summary = _run_sql(state["pending_sql"])
    else:
        summary = "Query cancelled."
    return {"messages": [{"role": "assistant", "content": summary}], "pending_sql": None}


def ask_transaction_confirm(state: AgentState):
    args = state["pending_transaction"]
    kind = "income" if args["type"] == "INCOME" else "expense"
    category = f" ({args['category']})" if args.get("category") else ""
    currency = args.get("currency") or ""
    title = f"Record {kind} of {args['amount']} {currency}{category}?".replace("  ", " ")
    payload = confirm_interrupt(str(uuid.uuid4()), title)
    response = interrupt(payload)

    if is_confirmed(response):
        try:
            # A fresh key per confirmed call: retrying the SAME confirmed action would need its own
            # dedup, but this app never automatically retries, so uniqueness here is enough to stop a
            # duplicate double-click from posting twice without stopping two genuinely separate entries.
            result = _create_transaction(
                args["type"], args["amount"], args.get("currency"), args.get("category"),
                args.get("description"), idempotency_key=f"chat-{uuid.uuid4()}",
            )
            summary = f"Recorded. New balance: {result['balanceAfter']} {result['currency']}."
        except Exception as exc:
            summary = f"Budget API error: {exc}"
    else:
        summary = "Cancelled — nothing was recorded."
    return {"messages": [{"role": "assistant", "content": summary}], "pending_transaction": None}


def route_after_agent(state: AgentState):
    return END  # Command(goto=...) handles every case that isn't a finished plain-text answer


graph_builder = StateGraph(AgentState)
graph_builder.add_node("agent", agent_node)
graph_builder.add_node("ask_date", ask_date)
graph_builder.add_node("ask_days", ask_days)
graph_builder.add_node("finalize_schedule", finalize_schedule)
graph_builder.add_node("ask_delete_confirm", ask_delete_confirm)
graph_builder.add_node("ask_db_confirm", ask_db_confirm)
graph_builder.add_node("ask_transaction_confirm", ask_transaction_confirm)

graph_builder.add_edge(START, "agent")
graph_builder.add_conditional_edges("agent", route_after_agent, {END: END})
graph_builder.add_edge("finalize_schedule", END)
graph_builder.add_edge("ask_delete_confirm", END)
graph_builder.add_edge("ask_db_confirm", END)
graph_builder.add_edge("ask_transaction_confirm", END)

graph = graph_builder.compile(checkpointer=MemorySaver())

MAX_FILE_CHARS = 30000  # keeps an uploaded file from blowing out the model's context window


def _ocr_pdf(file_path: Path) -> str:
    from pdf2image import convert_from_path
    from pytesseract import image_to_string

    pages = convert_from_path(str(file_path), dpi=200)
    return "\n\n".join(image_to_string(page) for page in pages)


def extract_text(file_path: Path) -> str:
    """Best-effort text extraction by extension. Raises on a type with no reader below."""
    suffix = file_path.suffix.lower()

    if suffix in (".txt", ".md", ".csv", ".json"):
        return file_path.read_text(encoding="utf-8", errors="replace")

    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(file_path))
        text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
        if text.strip():
            return text
        return _ocr_pdf(file_path)  # no text layer — likely a scanned document

    if suffix == ".docx":
        import docx

        doc = docx.Document(str(file_path))
        return "\n".join(p.text for p in doc.paragraphs)

    if suffix == ".xlsx":
        import openpyxl

        wb = openpyxl.load_workbook(str(file_path), data_only=True)
        parts = []
        for sheet in wb.worksheets:
            parts.append(f"# Sheet: {sheet.title}")
            for row in sheet.iter_rows(values_only=True):
                if any(cell is not None for cell in row):
                    parts.append("\t".join("" if c is None else str(c) for c in row))
        return "\n".join(parts)

    if suffix == ".pptx":
        from pptx import Presentation

        prs = Presentation(str(file_path))
        parts = []
        for i, slide in enumerate(prs.slides, start=1):
            parts.append(f"# Slide {i}")
            for shape in slide.shapes:
                if shape.has_text_frame and shape.text_frame.text.strip():
                    parts.append(shape.text_frame.text)
        return "\n".join(parts)

    if suffix in (".jpg", ".jpeg", ".png"):
        from PIL import Image
        from pytesseract import image_to_string

        return image_to_string(Image.open(file_path))

    raise ValueError(f"Unsupported file type: {suffix}")


def ingest_file(thread_id: str, filename: str, text: str):
    """Injects an uploaded file's content directly into this thread's conversation state, so
    every subsequent turn (RAG context, tool calls, everything) already has it in view — no
    separate 'file mode', it's just more history the model can reference."""
    truncated = text[:MAX_FILE_CHARS]
    note = f" (truncated to the first {MAX_FILE_CHARS} characters)" if len(text) > MAX_FILE_CHARS else ""
    content = f"The user uploaded a file named '{filename}'{note}. Its content:\n\n{truncated}"

    config = {"configurable": {"thread_id": thread_id}}
    graph.update_state(config, {"messages": [{"role": "system", "content": content}]})


def run(thread_id: str, user_message: str = None, resume_value: dict = None):
    """Returns {"type": "text", "message": ...} or {"type": "interrupt", "payload": ...}."""
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 25}

    try:
        if resume_value is not None:
            result = graph.invoke(Command(resume=resume_value), config)
        else:
            messages = [{"role": "user", "content": user_message}]
            try:
                messages.insert(0, retrieved_context_message(user_message))
            except Exception:
                pass  # Milvus/TEI not reachable — degrade to answering without RAG rather than crash
            result = graph.invoke({"messages": messages}, config)
    except (RateLimitError, RuntimeError) as exc:
        # Both API keys exhausted/erroring — surface this as a normal chat message, not a 500.
        return {"type": "text", "message": f"The model provider is unavailable right now ({exc}). Try again shortly."}

    if "__interrupt__" in result:
        return {"type": "interrupt", "payload": result["__interrupt__"][0].value}
    return {"type": "text", "message": result["messages"][-1]["content"]}


# ---- terminal usage (unchanged shape from before this rewrite) ----

def _terminal_resolve(payload):
    """Renders one interrupt in plain text and returns the protocol response for it."""
    print(f"\n{payload['title']}")
    field = payload["fields"][0]
    if field["type"] == "confirm":
        ans = input(f"{field['yes_label']}/{field['no_label']}? (y/n): ").strip().lower()
        return {"values": {field["name"]: ["yes" if ans == "y" else "no"]}}
    if field["type"] == "date":
        val = input(f"{field['label']} (YYYY-MM-DD, blank to cancel): ").strip()
        return {"cancelled": True} if not val else {"values": {field["name"]: [val]}}
    if field["type"] == "choice":
        print("Options:", ", ".join(o["label"] for o in field["options"]))
        val = input(f"{field['label']} (comma-separated, blank to cancel): ").strip()
        return {"cancelled": True} if not val else {"values": {field["name"]: [v.strip() for v in val.split(",")]}}
    return {"cancelled": True}


def _drive_to_text(thread_id, result):
    while result["type"] == "interrupt":
        response = _terminal_resolve(result["payload"])
        result = run(thread_id, resume_value=response)
    print(result["message"])


def run_agent(user_message: str):
    _drive_to_text("cli-oneshot", run("cli-oneshot", user_message=user_message))


def run_interactive():
    print("Interactive agent — type 'exit' to quit.")
    while True:
        try:
            user_message = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if user_message.lower() in ("exit", "quit"):
            break
        if not user_message:
            continue
        _drive_to_text("cli-interactive", run("cli-interactive", user_message=user_message))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        run_interactive()
    else:
        run_agent(" ".join(sys.argv[1:]))
