const pptxgen = require("pptxgenjs");

const NAVY = "1E2761";
const ICE = "CADCFC";
const WHITE = "FFFFFF";
const INK = "1B1F3B";
const MUTED = "5B6180";
const CARD = "F4F6FC";
const ACCENT = "6B7CC7";

function newDeck() { const p = new pptxgen(); p.layout = "LAYOUT_WIDE"; return p; }
function darkSlide(p) { const s = p.addSlide(); s.background = { color: NAVY }; return s; }
function lightSlide(p) { const s = p.addSlide(); s.background = { color: WHITE }; return s; }
function kicker(s, text, color) {
  s.addText(text.toUpperCase(), { x: 0.6, y: 0.4, w: 9, h: 0.35, fontFace: "Calibri", fontSize: 12, bold: true, color: color || "6B7CC7", charSpacing: 2, isTextBox: true, margin: 0 });
}
function title(s, text, color, size) {
  s.addText(text, { x: 0.6, y: 0.72, w: 12.2, h: 0.8, fontFace: "Cambria", fontSize: size || 27, bold: true, color: color || INK, isTextBox: true, margin: 0 });
}
function pageNum(s, n, dark) {
  s.addText(String(n), { x: 12.7, y: 7.05, w: 0.5, h: 0.3, fontFace: "Calibri", fontSize: 10, color: dark ? "8B95C9" : "A6ADC6", align: "right", isTextBox: true, margin: 0 });
}

const deck = newDeck();

function box(s, x, y, w, h, opts = {}) {
  s.addShape(deck.ShapeType.roundRect, { x, y, w, h, rectRadius: opts.r ?? 0.07, fill: { color: opts.fill ?? CARD }, line: opts.line ?? { type: "none" } });
  if (opts.title) s.addText(opts.title, { x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.35, fontFace: "Calibri", fontSize: opts.titleSize ?? 12.5, bold: true, color: opts.titleColor ?? NAVY, isTextBox: true, margin: 0, align: opts.align ?? "left" });
  if (opts.sub) s.addText(opts.sub, { x: x + 0.15, y: y + (opts.subY ?? 0.42), w: w - 0.3, h: h - (opts.subY ?? 0.42) - 0.08, fontFace: "Calibri", fontSize: opts.subSize ?? 10, color: opts.subColor ?? MUTED, isTextBox: true, margin: 0, align: opts.align ?? "left", lineSpacing: opts.subLine ?? 13 });
}
function arrow(s, x1, y1, x2, y2, color) {
  const x = Math.min(x1, x2), y = Math.min(y1, y2);
  const w = Math.max(Math.abs(x2 - x1), 0.01), h = Math.max(Math.abs(y2 - y1), 0.01);
  s.addShape(deck.ShapeType.line, { x, y, w, h, flipH: x1 > x2, flipV: y1 > y2, line: { color: color ?? ACCENT, width: 1.75, endArrowType: "triangle" } });
}

// ---------- Slide 1: Title ----------
{
  const s = darkSlide(deck);
  s.addText("PERSONAL AGENTIC AI PROJECT", { x: 0.9, y: 2.35, w: 11.5, h: 0.4, fontFace: "Calibri", fontSize: 14, bold: true, color: "8B95C9", charSpacing: 3, isTextBox: true, margin: 0 });
  s.addText("Technical Scope & Architecture", { x: 0.9, y: 2.8, w: 11.5, h: 1.1, fontFace: "Cambria", fontSize: 40, bold: true, color: WHITE, isTextBox: true, margin: 0 });
  s.addText("A self-built reference stack for agentic AI — tool use, RAG, human-in-the-loop, all self-hosted end to end.", {
    x: 0.9, y: 3.9, w: 10.8, h: 0.6, fontFace: "Calibri", fontSize: 15, color: ICE, isTextBox: true, margin: 0,
  });
  s.addShape(deck.ShapeType.rect, { x: 0.9, y: 4.55, w: 1.6, h: 0.05, fill: { color: ACCENT } });
  pageNum(s, 1, true);
}

// ---------- Slide 2: What this project is ----------
{
  const s = lightSlide(deck);
  kicker(s, "Overview");
  title(s, "From Zero to a Working Agentic Stack");
  s.addText(
    "Built from scratch as a hands-on way to learn the core mechanics behind agentic AI — the same " +
    "building blocks used in production systems, at a scale one person can fully understand and operate.",
    { x: 0.6, y: 1.75, w: 11.8, h: 0.8, fontFace: "Calibri", fontSize: 14, color: MUTED, isTextBox: true, margin: 0, lineSpacing: 20 }
  );

  const items = [
    ["Tool-calling agent", "An LLM (via OpenRouter) that decides when to call real tools — task management, live weather, a Postgres database — not just chat."],
    ["Retrieval-Augmented Generation", "A self-hosted embedding service (TEI) and vector database (Milvus) answer questions from a private knowledge base, without any external API seeing the data."],
    ["Human-in-the-loop", "Destructive actions (deleting a task, writing to a database) pause for explicit approval — first via a terminal prompt, later via a real confirm/cancel UI."],
    ["Structured interrupts", "A device-agnostic protocol lets the agent ask multi-choice questions that render as an actual form (web today, any client later) instead of plain text."],
  ];
  let y = 2.75;
  items.forEach((it) => {
    s.addShape(deck.ShapeType.roundRect, { x: 0.6, y, w: 0.35, h: 0.35, rectRadius: 0.35, fill: { color: NAVY }, line: { type: "none" } });
    s.addText("✓", { x: 0.6, y, w: 0.35, h: 0.35, fontFace: "Calibri", fontSize: 14, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
    s.addText(it[0], { x: 1.15, y: y - 0.05, w: 3.6, h: 0.5, fontFace: "Calibri", fontSize: 13.5, bold: true, color: INK, isTextBox: true, margin: 0 });
    s.addText(it[1], { x: 4.9, y: y - 0.08, w: 7.6, h: 0.75, fontFace: "Calibri", fontSize: 11.5, color: MUTED, isTextBox: true, margin: 0, lineSpacing: 15 });
    y += 0.95;
  });
  pageNum(s, 2, false);
}

// ---------- Slide 3: Architecture diagram ----------
{
  const s = lightSlide(deck);
  kicker(s, "Architecture");
  title(s, "Current System, End to End");

  const BOUND_X = 2.7, BOUND_W = 10.2, MID = BOUND_X + BOUND_W / 2;

  box(s, 0.4, 1.75, 1.9, 0.9, { fill: NAVY, title: "User", titleColor: WHITE, titleSize: 13, sub: "Web chat UI (Flask)", subColor: ICE, align: "center", subY: 0.42 });

  s.addShape(deck.ShapeType.roundRect, { x: BOUND_X, y: 1.1, w: BOUND_W, h: 5.7, rectRadius: 0.08, fill: { color: "FAFBFF" }, line: { color: NAVY, width: 1.5, dashType: "dash" } });
  s.addText("SELF-HOSTED — docker-compose.yml", { x: BOUND_X + 0.25, y: 1.2, w: 6, h: 0.3, fontFace: "Calibri", fontSize: 10, bold: true, color: NAVY, charSpacing: 1, isTextBox: true, margin: 0 });

  const routerW = 2.6, routerX = MID - routerW / 2, routerY = 1.65, routerH = 0.7;
  box(s, routerX, routerY, routerW, routerH, { fill: "2D3A8C", title: "Agent (OpenRouter LLM)", titleColor: WHITE, titleSize: 11.5, sub: "tool-calling loop", subColor: ICE, align: "center", subY: 0.35 });

  const branchW = 3.0, gap = 0.6;
  const leftX = MID - gap / 2 - branchW, rightX = MID + gap / 2;
  const row1Y = 2.85, row1H = 0.95;
  const row2Y = 4.1, row2H = 0.85;
  const leftMidX = leftX + branchW / 2, rightMidX = rightX + branchW / 2;

  box(s, leftX, row1Y, branchW, row1H, { fill: CARD, title: "Tools", sub: "tasks.json, weather API,\nPostgres CRM", subY: 0.38 });
  box(s, rightX, row1Y, branchW, row1H, { fill: CARD, title: "Embedding (TEI)", sub: "self-hosted, multilingual\n(intfloat/e5-small)", subY: 0.38 });

  box(s, leftX, row2Y, branchW, row2H, { fill: CARD, title: "Postgres (crm-postgres)", sub: "local dev DB, read + gated write", subY: 0.36 });
  box(s, rightX, row2Y, branchW, row2H, { fill: CARD, title: "Milvus + Attu", sub: "vector search over knowledge_base.md", subY: 0.36 });

  const gateW = 4.2, gateX = MID - gateW / 2, gateY = 5.35, gateH = 0.85;
  box(s, gateX, gateY, gateW, gateH, { fill: NAVY, title: "Approval Gate", titleColor: WHITE, titleSize: 12, sub: "destructive actions pause for confirm/cancel", subColor: ICE, align: "center", subY: 0.35 });

  box(s, 0.4, 5.65, 1.9, 0.85, { fill: NAVY, title: "Answer", titleColor: WHITE, titleSize: 13, sub: "text or interrupt form", subColor: ICE, align: "center", subY: 0.4 });

  arrow(s, 2.3, 2.2, BOUND_X, 2.2, NAVY);
  arrow(s, MID, routerY + routerH, leftMidX, row1Y, ACCENT);
  arrow(s, MID, routerY + routerH, rightMidX, row1Y, ACCENT);
  arrow(s, leftMidX, row1Y + row1H, leftMidX, row2Y, ACCENT);
  arrow(s, rightMidX, row1Y + row1H, rightMidX, row2Y, ACCENT);
  arrow(s, leftMidX, row2Y + row2H, gateX + 0.7, gateY, ACCENT);
  arrow(s, rightMidX, row2Y + row2H, gateX + gateW - 0.7, gateY, ACCENT);
  arrow(s, gateX, gateY + gateH * 0.6, 2.3, 6.05, WHITE);

  pageNum(s, 3, false);
}

// ---------- Slide 4: Tech stack table ----------
{
  const s = lightSlide(deck);
  kicker(s, "Stack");
  title(s, "What's Actually Running");

  const rows = [
    ["LLM", "OpenRouter (free-tier models, e.g. minimax-m3)", "Tool-calling, conversation"],
    ["Embeddings", "Text Embeddings Inference (Rust, self-hosted)", "Query + document vectors, on-prem"],
    ["Vector DB", "Milvus + Attu", "Similarity search for RAG"],
    ["Relational DB", "PostgreSQL (crm-postgres container)", "Task state, CRM data access"],
    ["Orchestration", "LangGraph", "Stateful graph, checkpointed interrupts"],
    ["Web layer", "Flask + vanilla HTML/JS", "Chat UI, structured interrupt rendering"],
    ["Infra", "Docker Compose", "One-command local deployment"],
  ];
  const startY = 1.85, rowH = 0.62;
  const colX = [0.6, 2.9, 8.3], colW = [2.2, 5.2, 4.4];
  ["Layer", "Technology", "Role"].forEach((h, i) => {
    s.addText(h, { x: colX[i], y: startY - 0.4, w: colW[i], h: 0.35, fontFace: "Calibri", fontSize: 11, bold: true, color: NAVY, isTextBox: true, margin: 0 });
  });
  s.addShape(deck.ShapeType.line, { x: 0.6, y: startY - 0.05, w: 12.1, h: 0, line: { color: "D8DCEE", width: 1 } });
  rows.forEach((r, i) => {
    const y = startY + i * rowH;
    if (i % 2 === 1) s.addShape(deck.ShapeType.rect, { x: 0.6, y, w: 12.1, h: rowH, fill: { color: CARD }, line: { type: "none" } });
    s.addText(r[0], { x: colX[0], y: y + 0.08, w: colW[0], h: 0.45, fontFace: "Calibri", fontSize: 12.5, bold: true, color: INK, isTextBox: true, margin: 0.05, valign: "middle" });
    s.addText(r[1], { x: colX[1], y: y + 0.08, w: colW[1], h: 0.45, fontFace: "Calibri", fontSize: 12, color: INK, isTextBox: true, margin: 0.05, valign: "middle" });
    s.addText(r[2], { x: colX[2], y: y + 0.08, w: colW[2], h: 0.45, fontFace: "Calibri", fontSize: 11.5, color: MUTED, isTextBox: true, margin: 0.05, valign: "middle" });
  });
  pageNum(s, 4, false);
}

// ---------- Slide 5: Structured interrupt protocol ----------
{
  const s = darkSlide(deck);
  kicker(s, "Human-in-the-Loop", "8B95C9");
  title(s, "One Protocol, Any Client", WHITE);
  s.addText(
    "When the agent needs a structured answer, it sends a JSON field schema — never HTML. Each client " +
    "renders that schema its own way; a new device type needs a new renderer, not a new agent.",
    { x: 0.6, y: 1.65, w: 11.8, h: 0.7, fontFace: "Calibri", fontSize: 13.5, color: ICE, isTextBox: true, margin: 0, lineSpacing: 19 }
  );

  const stages = [
    ["1", "Agent emits interrupt", "A JSON payload: title, field name, type (\"choice\"), options, single/multi-select, and whether free text is allowed."],
    ["2", "Client renders a form", "The web UI turns this into a bottom-sheet with chips and a text fallback — matching the product's own review-and-send pattern."],
    ["3", "Graph resumes exactly where it paused", "LangGraph's checkpointer means the answer resumes the same execution — no re-running earlier steps, no lost context."],
  ];
  let x = 0.6;
  stages.forEach((st) => {
    s.addShape(deck.ShapeType.roundRect, { x, y: 2.65, w: 3.9, h: 0.7, rectRadius: 0.35, fill: { color: "2D3A8C" }, line: { type: "none" } });
    s.addText(st[0], { x, y: 2.65, w: 3.9, h: 0.7, fontFace: "Cambria", fontSize: 16, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
    s.addText(st[1], { x, y: 3.5, w: 3.9, h: 0.5, fontFace: "Calibri", fontSize: 13, bold: true, color: WHITE, isTextBox: true, margin: 0 });
    s.addText(st[2], { x, y: 3.98, w: 3.9, h: 2.1, fontFace: "Calibri", fontSize: 11.5, color: ICE, isTextBox: true, margin: 0, lineSpacing: 16 });
    x += 4.15;
  });
  pageNum(s, 5, true);
}

// ---------- Slide 6: Roadmap ----------
{
  const s = lightSlide(deck);
  kicker(s, "Roadmap");
  title(s, "Built vs. Next");

  const cols = [
    ["Built", [
      "Tool-calling agent with a real approval gate",
      "RAG on a self-hosted embedding + vector DB stack",
      "Full docker-compose deployment (one command)",
      "Web chat UI with confirm/cancel flow",
      "LangGraph rewrite with structured interrupts",
    ]],
    ["Next", [
      "Swap the free LLM tier for a more reliable model",
      "Persist LangGraph checkpoints (SQLite/Postgres, not memory)",
      "A second interrupt protocol renderer (mobile) to prove device-agnosticism",
      "Multi-agent supervisor pattern for specialised sub-agents",
      "Real audit logging of every tool call and approval",
    ]],
  ];
  cols.forEach((c, i) => {
    const x = 0.6 + i * 6.2;
    s.addShape(deck.ShapeType.roundRect, { x, y: 1.85, w: 5.85, h: 4.6, rectRadius: 0.08, fill: { color: i === 0 ? CARD : "FFF4E5" }, line: { type: "none" } });
    s.addText(c[0], { x: x + 0.35, y: 2.1, w: 5.2, h: 0.45, fontFace: "Calibri", fontSize: 16, bold: true, color: NAVY, isTextBox: true, margin: 0 });
    const bullets = c[1].map((t, idx) => ({ text: t, options: { bullet: { code: "2022" }, breakLine: idx < c[1].length - 1, color: MUTED, fontSize: 12.5 } }));
    s.addText(bullets, { x: x + 0.35, y: 2.65, w: 5.2, h: 3.6, fontFace: "Calibri", isTextBox: true, margin: 0, paraSpaceAfter: 10, valign: "top" });
  });
  pageNum(s, 6, false);
}

// ---------- Slide 7: Closing ----------
{
  const s = darkSlide(deck);
  s.addText("Bottom Line", { x: 0.9, y: 2.7, w: 8, h: 0.4, fontFace: "Calibri", fontSize: 13, bold: true, color: "8B95C9", charSpacing: 2, isTextBox: true, margin: 0 });
  s.addText("A Small Stack That Already Covers\nEvery Core Agentic Pattern", {
    x: 0.9, y: 3.15, w: 11.2, h: 1.7, fontFace: "Cambria", fontSize: 30, bold: true, color: WHITE, isTextBox: true, margin: 0, lineSpacing: 38,
  });
  s.addText("Tool use, RAG, approval gates, structured interrupts — self-hosted, reproducible, and built to extend.", {
    x: 0.9, y: 4.75, w: 10.5, h: 0.6, fontFace: "Calibri", fontSize: 14, italic: true, color: ICE, isTextBox: true, margin: 0,
  });
  s.addShape(deck.ShapeType.rect, { x: 0.9, y: 5.45, w: 1.6, h: 0.05, fill: { color: ACCENT } });
  pageNum(s, 7, true);
}

deck.writeFile({ fileName: "MyAgent_Technical_Scope.pptx" }).then(() => console.log("done"));
