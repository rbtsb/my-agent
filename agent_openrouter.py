"""
BEMS Agent — the main chat. One LangGraph that combines:
- RAG (Milvus + TEI) for knowledge-base questions
- Live budget data: balance, transactions, budgets, assets (budget-management-system API)
- query_crm_database: SELECTs run immediately; INSERT/UPDATE/DELETE wait for a yes/no confirm
- open_entry_form: a prefilled, validated bottom sheet to record an expense, income, budget or asset
  All human-in-the-loop steps use interrupt_protocol.py, so the web UI (or any future client) renders
  them from one shared JSON schema instead of the agent knowing anything about HTML.

Run:
    pip install -r requirements.txt
    docker compose up -d
    python agent_openrouter.py "what's my balance?"          # one-shot
    python agent_openrouter.py                                # interactive terminal
    python web_app.py                                          # web UI, see static/index.html
"""

import datetime
import io
import json
import re
import operator
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from decimal import Decimal, InvalidOperation
from typing import Annotated, List, Optional, TypedDict

import psycopg2
from dotenv import load_dotenv
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from openai import OpenAI, RateLimitError

from interrupt_protocol import choice_field, confirm_interrupt, first_value, form_field, form_interrupt, is_cancelled, is_confirmed

load_dotenv(Path(__file__).parent / ".env")

# Windows terminals default to cp1252, which can't encode characters like '°' — force UTF-8.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

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
DEFAULT_CURRENCY = os.environ.get("DEFAULT_CURRENCY", "MYR")

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
        "content": f"Today's date is {today}. You are BEMS Agent. You help the user query the CRM database, track their personal budget (balance, income/expense entries, "
        "category budgets), and answer questions about the company using the knowledge-base "
        "excerpts provided in context. Answer directly, the way a colleague who already knows "
        "this would.\n\n"
        "For budget tools: get_balance/list_transactions/list_budgets/list_assets run immediately. "
        "To RECORD anything financial — an expense, an income, a budget (spending limit) or an asset "
        "the user now owns — call open_entry_form. It opens an editable form sheet prefilled with "
        "whatever you extracted; the user completes and submits it, so call it immediately even when "
        "the amount or other details are missing, and never ask for them in text first. Pick "
        "entry_type: ASSET for a durable thing bought or owned (phone, laptop, car, bike, jewelry, "
        "furniture) — the form also offers to record the purchase price as an expense; EXPENSE for "
        "consumption (food, rent, bills, taxi, subscriptions); INCOME for money received; BUDGET for a "
        "spending limit. Only prefill values the user actually stated or clearly implied (resolve "
        "'today'/'yesterday' to ISO dates) — never invent an amount. "
        "Always convert an informal currency name the user says (e.g. 'RM', 'ringgit') to its "
        "3-letter ISO-4217 code (MYR) before calling any budget tool that takes a currency. "
        "list_transactions, list_budgets and list_assets already return a Markdown table, pre-formatted and ready "
        "to display — repeat that table back to the user EXACTLY as given (same pipes, same rows), "
        "with at most one short sentence before it. Never convert it to JSON, prose, or a bulleted "
        "list, and never re-summarize the numbers into a paragraph instead of showing the table.\n\n"
        "For any tool that mentions an automatic confirm/cancel UI: call it directly as soon as the "
        "user's request is clear. Never ask for confirmation in plain text yourself, and never treat "
        "a typed 'yes' as approval — the only real approval is the user clicking Confirm in that UI, "
        "which happens after you call the tool, not before.",
    }

TOOLS = [
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
            "name": "open_entry_form",
            "description": (
                "Open a prefilled data-entry bottom sheet to record an EXPENSE, INCOME, BUDGET or ASSET. "
                "The user reviews/edits every field and submits — nothing is saved before that. Put only "
                "values the user stated into prefill; leave unknown ones out."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "entry_type": {"type": "string", "enum": ["EXPENSE", "INCOME", "BUDGET", "ASSET"]},
                    "prefill": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "ASSET only: what the item is, e.g. 'iPhone 16'"},
                            "amount": {"type": "number", "description": "Positive. Price / value / limit."},
                            "currency": {"type": "string", "description": "3-letter ISO-4217 code, e.g. MYR"},
                            "category": {"type": "string", "description": "e.g. electronics, groceries, salary"},
                            "date": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                            "period": {"type": "string", "enum": ["WEEKLY", "MONTHLY", "YEARLY"]},
                            "description": {"type": "string"},
                        },
                    },
                },
                "required": ["entry_type"],
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
            "name": "list_budgets",
            "description": "List every budget (spending limit) the user has set, across all categories.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_assets",
            "description": "List the assets (owned items such as a phone, laptop or car) the user has recorded.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


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
    pending_sql: Optional[str]
    pending_entry: Optional[dict]  # {form_id, entry_type, prefill} while an entry sheet is open


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

    if name == "query_crm_database":
        sql = args["sql"].strip()
        if _is_write_sql(sql):
            update = {"messages": [assistant_message, _tool_msg(call.id, "Awaiting confirmation.")], "pending_sql": sql}
            return Command(update=update, goto="ask_db_confirm")
        result = _run_sql(sql)
        return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")

    if name == "get_balance":
        result = _budget_result(_get_balance)
        return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")

    if name == "list_transactions":
        result = _budget_text_result(lambda: _format_transactions_table(_list_transactions(args.get("limit", 10))))
        return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")

    if name == "list_budgets":
        result = _budget_text_result(lambda: _format_budgets_table(_list_budgets()))
        return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")

    if name == "list_assets":
        result = _budget_text_result(lambda: _format_assets_table(_list_assets()))
        return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")

    if name == "open_entry_form":
        entry_type = str(args.get("entry_type", "")).upper()
        if entry_type not in ENTRY_TYPES:
            result = f"Invalid entry_type {entry_type!r}; use one of {', '.join(ENTRY_TYPES)}."
            return Command(update={"messages": [assistant_message, _tool_msg(call.id, result)]}, goto="agent")
        update = {
            "messages": [assistant_message, _tool_msg(call.id, "Entry form opened for the user.")],
            "pending_entry": new_pending_entry(entry_type, args.get("prefill")),
        }
        return Command(update=update, goto="entry_form")

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


def _list_transactions(limit: int = 10) -> dict:
    return _budget_request("GET", f"/api/v1/persons/{BUDGET_PERSON_ID}/transactions?size={int(limit)}")


def _list_budgets() -> list:
    return _budget_request("GET", f"/api/v1/persons/{BUDGET_PERSON_ID}/budgets")


def ask_db_confirm(state: AgentState):
    payload = confirm_interrupt(str(uuid.uuid4()), f"Execute this SQL against crm_db?\n\n{state['pending_sql']}")
    response = interrupt(payload)

    if is_confirmed(response):
        summary = _run_sql(state["pending_sql"])
    else:
        summary = "Query cancelled."
    return {"messages": [{"role": "assistant", "content": summary}], "pending_sql": None}


# ---- manual data entry (expense / income / budget / asset) via one prefilled bottom sheet ----
#
# The model only proposes values (open_entry_form prefill); it never writes anything. Every value is
# re-validated here after the user submits the sheet, and the write uses an idempotency key derived
# from form_id, which lives in checkpointed state — so a double submit or a node replay can't
# double-post.

ENTRY_TYPES = ("EXPENSE", "INCOME", "BUDGET", "ASSET")
MAX_FORM_ATTEMPTS = 3  # bounded re-ask loop when a submit fails validation
_CURRENCY_RE = re.compile(r"^[A-Z]{3}$")
_MAX_AMOUNT = Decimal("1000000000")

CURRENCY_OPTIONS = [(c, c) for c in dict.fromkeys([DEFAULT_CURRENCY, "MYR", "EUR", "USD"])]
CATEGORY_OPTIONS = {
    "EXPENSE": ["groceries", "food", "transport", "rent", "bills", "shopping", "health", "entertainment"],
    "INCOME": ["salary", "bonus", "refund", "gift", "investment"],
    "BUDGET": ["groceries", "food", "transport", "shopping", "entertainment", "bills"],
    "ASSET": ["electronics", "vehicle", "property", "jewelry", "furniture", "other"],
}
PERIOD_OPTIONS = [("WEEKLY", "Weekly"), ("MONTHLY", "Monthly"), ("YEARLY", "Yearly")]
ENTRY_TITLES = {"EXPENSE": "Add expense", "INCOME": "Add income", "BUDGET": "Set budget", "ASSET": "Add asset"}
_PREFILL_KEYS = ("name", "amount", "currency", "category", "date", "period", "description")


def new_pending_entry(entry_type: str, prefill) -> dict:
    """Whitelists and coerces LLM-proposed prefill: anything unknown or malformed is dropped rather
    than trusted — the user sees the empty field and fills it in instead."""
    clean = {}
    for key, value in (prefill if isinstance(prefill, dict) else {}).items():
        if key not in _PREFILL_KEYS or value in (None, ""):
            continue
        clean[key] = str(value).strip()[:255]
    if clean.get("currency"):
        clean["currency"] = clean["currency"].upper()
    return {"form_id": str(uuid.uuid4()), "entry_type": entry_type, "prefill": clean}


def _entry_fields(entry_type: str, values: dict, errors: dict) -> list:
    today = datetime.date.today().isoformat()

    def field(builder, name, *args, **kwargs):
        f = builder(name, *args, **kwargs)
        if errors.get(name):
            f["error"] = errors[name]
        return f

    def category(label):
        options = [(c, c.capitalize()) for c in CATEGORY_OPTIONS[entry_type]]
        current = values.get("category")
        known = current in CATEGORY_OPTIONS[entry_type]
        f = field(choice_field, "category", label, options, default=current if known else None, allow_custom=True)
        if current and not known:
            f["custom_default"] = current  # a model/user-supplied category not in the preset chips
        return f

    currency = field(choice_field, "currency", "Currency", CURRENCY_OPTIONS,
                     default=values.get("currency") or DEFAULT_CURRENCY, required=True, allow_custom=True)
    if values.get("currency") and values["currency"] not in dict(CURRENCY_OPTIONS):
        currency["default"], currency["custom_default"] = [], values["currency"]

    if entry_type == "ASSET":
        return [
            field(form_field, "name", "text", "Item", values.get("name"), required=True, placeholder="e.g. iPhone 16"),
            category("Asset category"),
            field(form_field, "amount", "number", "Purchase price", values.get("amount"), required=True, min="0.01", step="0.01"),
            currency,
            field(form_field, "date", "date", "Purchase date", values.get("date") or today, required=True),
            field(form_field, "description", "text", "Note", values.get("description"), placeholder="optional"),
            field(choice_field, "record_expense", "Also record the price as an expense?",
                  [("yes", "Yes"), ("no", "No")], default=values.get("record_expense") or "yes", required=True),
        ]
    if entry_type == "BUDGET":
        return [
            category("Category"),
            field(form_field, "amount", "number", "Limit", values.get("amount"), required=True, min="0.01", step="0.01"),
            currency,
            field(choice_field, "period", "Period", PERIOD_OPTIONS, default=values.get("period") or "MONTHLY", required=True),
            field(form_field, "date", "date", "Start date", values.get("date") or today, required=True),
        ]
    return [  # EXPENSE / INCOME
        field(form_field, "amount", "number", "Amount", values.get("amount"), required=True, min="0.01", step="0.01"),
        currency,
        category("Category"),
        field(form_field, "date", "date", "Date", values.get("date") or today, required=True),
        field(form_field, "description", "text", "Description", values.get("description"), placeholder="optional"),
    ]


def _validate_entry(entry_type: str, response: dict):
    """Returns (clean values, raw values echoed back, {field: error}). Server-side source of truth —
    the client's required/min attributes are only a convenience."""
    raw = {name: first_value(response, name) for name in
           ("name", "amount", "currency", "category", "date", "period", "description", "record_expense")}
    errors, clean = {}, {}

    try:
        amount = Decimal(raw["amount"].replace(",", "."))
        if not (Decimal("0.01") <= amount <= _MAX_AMOUNT):
            raise InvalidOperation
        clean["amount"] = amount.quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        errors["amount"] = "Enter a positive amount, e.g. 1299.00"

    currency = raw["currency"].upper()
    if _CURRENCY_RE.match(currency):
        clean["currency"] = currency
    else:
        errors["currency"] = "Use a 3-letter currency code, e.g. MYR"

    try:
        clean["date"] = datetime.date.fromisoformat(raw["date"])
        if entry_type != "BUDGET" and clean["date"] > datetime.date.today():
            errors["date"] = "Date can't be in the future"
    except ValueError:
        errors["date"] = "Pick a date"

    clean["category"] = raw["category"][:64] or None
    clean["description"] = raw["description"][:255] or None

    if entry_type == "ASSET":
        clean["name"] = raw["name"][:128]
        if not clean["name"]:
            errors["name"] = "What did you buy?"
        clean["record_expense"] = raw["record_expense"] != "no"
    if entry_type == "BUDGET":
        if not clean["category"]:
            errors["category"] = "A budget needs a category"
        clean["period"] = raw["period"] if raw["period"] in dict(PERIOD_OPTIONS) else None
        if not clean["period"]:
            errors["period"] = "Pick a period"

    raw["currency"] = currency
    return clean, raw, errors


def _occurred_at(day: datetime.date) -> str:
    # budget API takes a LocalDateTime: "now" for today, noon for a past day (no time was asked).
    if day == datetime.date.today():
        return datetime.datetime.now().replace(microsecond=0).isoformat()
    return datetime.datetime.combine(day, datetime.time(12, 0)).isoformat()


def _list_assets() -> list:
    return _budget_request("GET", f"/api/v1/persons/{BUDGET_PERSON_ID}/assets")


def _create_asset(clean: dict, key: str) -> dict:
    body = {
        "personId": BUDGET_PERSON_ID, "name": clean["name"], "purchaseValue": str(clean["amount"]),
        "currency": clean["currency"], "purchaseDate": clean["date"].isoformat(), "idempotencyKey": key,
    }
    if clean.get("category"):
        body["category"] = clean["category"]
    if clean.get("description"):
        body["note"] = clean["description"]
    return _budget_request("POST", "/api/v1/assets", body)


def _format_assets_table(assets: list) -> str:
    """Display-ready table, relayed verbatim by the model (same approach as _format_transactions_table)."""
    if not assets:
        return "No assets recorded yet."
    lines = ["| # | Item | Category | Value | Purchased | Note |", "|---|---|---|---:|---|---|"]
    totals = {}
    for a in assets:
        value = Decimal(str(a["purchaseValue"])).quantize(Decimal("0.01"))
        totals[a["currency"]] = totals.get(a["currency"], Decimal("0")) + value
        lines.append(f"| {a['id']} | {a['name']} | {a.get('category') or '-'} | {value} {a['currency']} "
                     f"| {a['purchaseDate']} | {a.get('note') or '-'} |")
    for currency, total in totals.items():
        lines.append(f"| | **Total** | | **{total} {currency}** | | |")
    return "\n".join(lines)


def _post_transaction(type_: str, clean: dict, key: str, description: str = None) -> dict:
    body = {
        "personId": BUDGET_PERSON_ID, "type": type_, "amount": str(clean["amount"]), "currency": clean["currency"],
        "occurredAt": _occurred_at(clean["date"]), "idempotencyKey": key,
    }
    if clean.get("category"):
        body["category"] = clean["category"]
    if description or clean.get("description"):
        body["description"] = (description or clean["description"])[:255]
    return _budget_request("POST", "/api/v1/transactions", body)


def _commit_entry(entry_type: str, clean: dict, form_id: str) -> str:
    key = f"entry-{form_id}"
    if entry_type in ("EXPENSE", "INCOME"):
        result = _post_transaction(entry_type, clean, key)
        kind = entry_type.lower()
        return f"Recorded {kind} of {clean['amount']} {clean['currency']}. New balance: {result['balanceAfter']} {result['currency']}."

    if entry_type == "BUDGET":
        _budget_request("POST", "/api/v1/budgets", {
            "personId": BUDGET_PERSON_ID, "category": clean["category"], "limitAmount": str(clean["amount"]),
            "currency": clean["currency"], "period": clean["period"], "startDate": clean["date"].isoformat(),
        })
        return f"Budget set: {clean['amount']} {clean['currency']} {clean['period'].lower()} for {clean['category']}."

    asset = _create_asset(clean, f"asset-{form_id}")
    summary = f"Added asset #{asset['id']} \"{asset['name']}\" ({clean['amount']} {asset['currency']})."
    if clean["record_expense"]:
        try:
            result = _post_transaction("EXPENSE", clean, key, description=f"Purchase: {clean['name']}")
            summary += f" Recorded the purchase as an expense — new balance: {result['balanceAfter']} {result['currency']}."
        except Exception as exc:
            # Asset is saved; only the expense failed. Say so explicitly — no silent partial write.
            summary += f" The expense could NOT be recorded ({exc}); add it manually if needed."
    return summary


def entry_form(state: AgentState):
    pending = state["pending_entry"]
    entry_type, form_id = pending["entry_type"], pending["form_id"]
    values, errors = dict(pending.get("prefill") or {}), {}
    done = {"pending_entry": None}

    for attempt in range(MAX_FORM_ATTEMPTS):
        subtitle = "Please fix the highlighted fields." if errors else "Review, adjust anything, then save."
        payload = form_interrupt(
            f"{form_id}:{attempt}", ENTRY_TITLES[entry_type], _entry_fields(entry_type, values, errors),
            subtitle=subtitle, submit_label="Save",
        )
        response = interrupt(payload)
        if is_cancelled(response):
            return {**done, "messages": [{"role": "assistant", "content": "Cancelled — nothing was saved."}]}

        clean, values, errors = _validate_entry(entry_type, response)
        if not errors:
            try:
                summary = _commit_entry(entry_type, clean, form_id)
            except Exception as exc:
                summary = f"Save failed — nothing was saved: {exc}"
            return {**done, "messages": [{"role": "assistant", "content": summary}]}

    return {**done, "messages": [{"role": "assistant", "content": "Too many invalid attempts — nothing was saved."}]}


def route_after_agent(state: AgentState):
    return END  # Command(goto=...) handles every case that isn't a finished plain-text answer


def route_start(state: AgentState):
    # A manually opened sheet (web "+" button) skips the model entirely — deterministic, no tokens.
    return "entry_form" if state.get("pending_entry") else "agent"


graph_builder = StateGraph(AgentState)
graph_builder.add_node("agent", agent_node)
graph_builder.add_node("ask_db_confirm", ask_db_confirm)
graph_builder.add_node("entry_form", entry_form)

graph_builder.add_conditional_edges(START, route_start, {"agent": "agent", "entry_form": "entry_form"})
graph_builder.add_conditional_edges("agent", route_after_agent, {END: END})
graph_builder.add_edge("ask_db_confirm", END)
graph_builder.add_edge("entry_form", END)

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


def run(thread_id: str, user_message: str = None, resume_value: dict = None, open_form: str = None):
    """Returns {"type": "text", "message": ...} or {"type": "interrupt", "payload": ...}.
    open_form=<entry type> opens an empty entry sheet directly, without a model call."""
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 25}

    try:
        if resume_value is not None:
            result = graph.invoke(Command(resume=resume_value), config)
        elif open_form is not None:
            entry_type = open_form.upper()
            if entry_type not in ENTRY_TYPES:
                return {"type": "error", "message": f"Unknown entry type: {open_form}"}
            note = {"role": "user", "content": f"(Opened the {entry_type.lower()} entry form manually.)"}
            result = graph.invoke({"messages": [note], "pending_entry": new_pending_entry(entry_type, {})}, config)
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
    if len(payload["fields"]) > 1 or field["type"] in ("text", "number"):
        values = {}
        for f in payload["fields"]:
            default = (f.get("default") or [""])[0]
            hint = f" [{default}]" if default else ""
            if f["type"] == "choice":
                hint += " (" + ", ".join(o["value"] for o in f["options"]) + ")"
            if f.get("error"):
                print(f"  ! {f['error']}")
            val = input(f"{f['label']}{hint} (blank = keep, '-' = cancel): ").strip()
            if val == "-":
                return {"cancelled": True}
            values[f["name"]] = [val or default] if (val or default) else []
        return {"values": values}
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
