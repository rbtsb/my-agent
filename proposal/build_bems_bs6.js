const pptxgen = require("pptxgenjs");

const NAVY = "1E2761";
const ICE = "CADCFC";
const WHITE = "FFFFFF";
const INK = "1B1F3B";
const MUTED = "5B6180";
const CARD = "F4F6FC";
const ACCENT = "6B7CC7";
const DANGER_BG = "FCEAEA";
const DANGER_BORDER = "C0392B";

function newDeck() { const p = new pptxgen(); p.layout = "LAYOUT_WIDE"; return p; }
function darkSlide(p) { const s = p.addSlide(); s.background = { color: NAVY }; return s; }
function lightSlide(p) { const s = p.addSlide(); s.background = { color: WHITE }; return s; }
function kicker(s, text, color) {
  s.addText(text.toUpperCase(), { x: 0.6, y: 0.4, w: 10, h: 0.35, fontFace: "Calibri", fontSize: 12, bold: true, color: color || "6B7CC7", charSpacing: 2, isTextBox: true, margin: 0 });
}
function title(s, text, color, size) {
  s.addText(text, { x: 0.6, y: 0.72, w: 12.2, h: 0.8, fontFace: "Cambria", fontSize: size || 25, bold: true, color: color || INK, isTextBox: true, margin: 0 });
}
function pageNum(s, n, dark) {
  s.addText(String(n), { x: 12.7, y: 7.05, w: 0.5, h: 0.3, fontFace: "Calibri", fontSize: 10, color: dark ? "8B95C9" : "A6ADC6", align: "right", isTextBox: true, margin: 0 });
}

const deck = newDeck();

function box(s, x, y, w, h, opts = {}) {
  s.addShape(deck.ShapeType.roundRect, { x, y, w, h, rectRadius: opts.r ?? 0.07, fill: { color: opts.fill ?? CARD }, line: opts.line ?? { type: "none" } });
  if (opts.title) s.addText(opts.title, { x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.35, fontFace: "Calibri", fontSize: opts.titleSize ?? 12, bold: true, color: opts.titleColor ?? NAVY, isTextBox: true, margin: 0, align: opts.align ?? "left" });
  if (opts.sub) s.addText(opts.sub, { x: x + 0.15, y: y + (opts.subY ?? 0.4), w: w - 0.3, h: h - (opts.subY ?? 0.4) - 0.08, fontFace: "Calibri", fontSize: opts.subSize ?? 10, color: opts.subColor ?? MUTED, isTextBox: true, margin: 0, align: opts.align ?? "left", lineSpacing: opts.subLine ?? 13 });
}
function arrow(s, x1, y1, x2, y2, color) {
  const x = Math.min(x1, x2), y = Math.min(y1, y2);
  const w = Math.max(Math.abs(x2 - x1), 0.01), h = Math.max(Math.abs(y2 - y1), 0.01);
  s.addShape(deck.ShapeType.line, { x, y, w, h, flipH: x1 > x2, flipV: y1 > y2, line: { color: color ?? ACCENT, width: 1.75, endArrowType: "triangle" } });
}
function table(s, rows, colX, colW, startY, opts = {}) {
  const rowH = opts.rowH ?? 0.6;
  rows[0].forEach((h, i) => {
    s.addText(h, { x: colX[i], y: startY - 0.38, w: colW[i], h: 0.32, fontFace: "Calibri", fontSize: 11, bold: true, color: NAVY, isTextBox: true, margin: 0 });
  });
  s.addShape(deck.ShapeType.line, { x: colX[0], y: startY - 0.04, w: colX[colX.length - 1] + colW[colW.length - 1] - colX[0], h: 0, line: { color: "D8DCEE", width: 1 } });
  rows.slice(1).forEach((r, i) => {
    const y = startY + i * rowH;
    if (i % 2 === 1) s.addShape(deck.ShapeType.rect, { x: colX[0], y, w: colX[colX.length - 1] + colW[colW.length - 1] - colX[0], h: rowH, fill: { color: CARD }, line: { type: "none" } });
    r.forEach((cell, ci) => {
      s.addText(cell, { x: colX[ci] + 0.05, y: y + 0.06, w: colW[ci] - 0.1, h: rowH - 0.12, fontFace: "Calibri", fontSize: opts.fontSize ?? 10.5, color: ci === 0 ? INK : MUTED, bold: ci === 0 && opts.boldFirst, isTextBox: true, margin: 0, valign: "top", lineSpacing: opts.lineSpacing ?? 13 });
    });
  });
}

// ---------- Slide 1: Title ----------
{
  const s = darkSlide(deck);
  s.addText("BEMS — BS-6", { x: 0.9, y: 2.2, w: 11.5, h: 0.4, fontFace: "Calibri", fontSize: 14, bold: true, color: "8B95C9", charSpacing: 3, isTextBox: true, margin: 0 });
  s.addText("AI & Intelligent Automation", { x: 0.9, y: 2.65, w: 11.5, h: 1.0, fontFace: "Cambria", fontSize: 38, bold: true, color: WHITE, isTextBox: true, margin: 0 });
  s.addText("Development Plan — Architecture, Data Sources and Intent Routing", { x: 0.9, y: 3.55, w: 11, h: 0.5, fontFace: "Calibri", fontSize: 16, color: ICE, isTextBox: true, margin: 0 });
  s.addText("Corrects and replaces the earlier draft, which assumed a lakehouse / Trino / direct-SQL architecture incompatible with this tender.", {
    x: 0.9, y: 4.15, w: 10.6, h: 0.6, fontFace: "Calibri", fontSize: 12.5, italic: true, color: "9FA8D9", isTextBox: true, margin: 0,
  });
  s.addShape(deck.ShapeType.rect, { x: 0.9, y: 4.85, w: 1.6, h: 0.05, fill: { color: ACCENT } });
  pageNum(s, 1, true);
}

// ---------- Slide 2: Why the earlier draft doesn't apply + Scope ----------
{
  const s = lightSlide(deck);
  kicker(s, "Context");
  title(s, "Why the Earlier Draft Doesn't Apply");
  box(s, 0.6, 1.7, 12.1, 1.85, {
    fill: DANGER_BG, line: { color: DANGER_BORDER, width: 1 },
    title: "A generic \"text-to-SQL\" tool is a compliance violation before it is a security risk",
    titleColor: "7B241C", titleSize: 13,
    sub: "Clause 40.2.6.1c prohibits direct database access and point-to-point bypass of the middleware layer without MCMC's written approval. Clause 40.8 requires all data and all AI processing to stay on MCMC's own infrastructure. The architecture already mandates that every client — including this assistant — talks to Tier-3 services only through the API gateway.",
    subSize: 11.5, subColor: "7B241C", subY: 0.55, subLine: 15,
  });

  s.addText("SCOPE — VERSION 1", { x: 0.6, y: 3.7, w: 10, h: 0.3, fontFace: "Calibri", fontSize: 11, bold: true, color: NAVY, charSpacing: 2, isTextBox: true, margin: 0 });
  const rows = [
    ["Data sources", "BEMS APIs (BS-1, BS-2, BS-3, BS-5) for figures; a self-hosted vector index over documents the user uploads on demand"],
    ["Capabilities", "Conversational Q&A, forecasting, anomaly detection, compliance advice"],
    ["Control", "Every API call carries the requesting user's own identity token — no broader service account"],
    ["Sovereignty", "On-premises LLM and embedding model only — no external or public AI service (clause 40.8)"],
    ["Out of scope", "The assistant taking any write action — every workflow action still goes through BS-4 approval"],
  ];
  let y = 3.95;
  rows.forEach((r) => {
    s.addText(r[0], { x: 0.6, y, w: 2.3, h: 0.5, fontFace: "Calibri", fontSize: 12, bold: true, color: NAVY, isTextBox: true, margin: 0 });
    s.addText(r[1], { x: 3.0, y, w: 9.7, h: 0.5, fontFace: "Calibri", fontSize: 11.5, color: MUTED, isTextBox: true, margin: 0, lineSpacing: 14 });
    y += 0.58;
  });
  pageNum(s, 2, false);
}

// ---------- Slide 3: Governing principle ----------
{
  const s = lightSlide(deck);
  kicker(s, "Governing Principle");
  title(s, "Facts and Knowledge Are Never Blended");
  s.addText("This distinction is what keeps a \"confidently wrong number\" from ever reaching a Commissioner.", {
    x: 0.6, y: 1.65, w: 11.8, h: 0.5, fontFace: "Calibri", fontSize: 13, color: MUTED, isTextBox: true, margin: 0,
  });

  const cols = [
    ["Fact", "A call to a BS-1..BS-5 API, under the user's own identity", "“Remaining IT budget for Q3 is RM 42,000”", NAVY],
    ["Knowledge", "Retrieval over indexed policy/SOP documents", "“Unspent training allocations lapse at year-end unless carried forward”", "2D3A8C"],
    ["Narrative", "Model synthesis over the two above", "“This needs a carry-forward request before December”", "42509E"],
  ];
  let x = 0.6;
  cols.forEach((c) => {
    box(s, x, 2.35, 3.9, 2.7, { fill: c[3], title: c[0], titleColor: WHITE, titleSize: 15, sub: c[1] + "\n\n" + c[2], subColor: ICE, subY: 0.55, subLine: 16 });
    x += 4.15;
  });

  box(s, 0.6, 5.35, 12.1, 1.35, {
    fill: "FFF4E5", line: { color: "EF9F27", width: 1 },
    title: "Rule",
    titleColor: "854F0B", titleSize: 12,
    sub: "Retrieval never answers a question that needs an exact, current figure — that always goes through a BS-1..BS-5 API call. Every answer labels which parts are fact, which are knowledge, and which are narrative.",
    subColor: "854F0B", subSize: 11, subY: 0.4, subLine: 14,
  });
  pageNum(s, 3, false);
}

// ---------- Slide 4: Why API, never direct query + confidentiality ----------
{
  const s = lightSlide(deck);
  kicker(s, "Compliance");
  title(s, "Why an API Call, Never a Direct Query");
  s.addText("This is a compliance requirement before it is an engineering preference.", {
    x: 0.6, y: 1.6, w: 11.8, h: 0.4, fontFace: "Calibri", fontSize: 12.5, color: MUTED, isTextBox: true, margin: 0,
  });

  const rows = [
    ["Requirement", "What it forces"],
    ["Clause 40.2.6.1a / 1.1", "A dedicated Middleware Layer is the central integration layer; the assistant is a client of BEMS the same way the React front end is one"],
    ["Clause 40.2.6.1c", "Direct database-to-database integration and point-to-point bypass are not allowed without written MCMC approval"],
    ["Slide 20 architecture", "“Front end and back end communicate only through the API gateway — no direct database access from any client.” No exception for the assistant"],
    ["Clause 40.2.8.2c", "Segregation of duties and access control are evaluated per call by the Policy Engine — only for requests through the gateway"],
  ];
  table(s, rows, [0.6, 3.7], [3.0, 9.0], 2.25, { rowH: 0.62, fontSize: 10.5 });

  box(s, 0.6, 4.95, 12.1, 1.75, {
    fill: DANGER_BG, line: { color: DANGER_BORDER, width: 1 },
    title: "Does this eliminate the confidential-disclosure risk?  —  Yes.",
    titleColor: "7B241C", titleSize: 13,
    sub: "By routing through BS-3/BS-5 under the asking user's own identity, the same segregation-of-duties and cost-centre-scope checks that already stop a human from viewing another unit's budget in the BEMS UI apply automatically to the assistant. It cannot retrieve a figure the calling user isn't authorised to see — because it calls the exact same authorised endpoint, not a side channel into the database.",
    subColor: "7B241C", subSize: 11, subY: 0.5, subLine: 14.5,
  });
  pageNum(s, 4, false);
}

// ---------- Slide 5: Plan 1 vs Plan 2 ----------
{
  const s = lightSlide(deck);
  kicker(s, "Delivery Plan");
  title(s, "Plan 1 (Default) and Plan 2 (Conditional)");
  s.addText("Two candidate ways to turn a question into a query — a phased plan, not a single upfront choice.", {
    x: 0.6, y: 1.6, w: 11.8, h: 0.4, fontFace: "Calibri", fontSize: 12.5, color: MUTED, isTextBox: true, margin: 0,
  });

  const cols = [
    ["Plan 1 — Default", "Tool-calling over BS-1..BS-5 APIs", [
      "Every endpoint documented in full on Swagger/OpenAPI",
      "LLM chosen for tool-calling accuracy selects the right endpoint itself",
      "No extra database-level mechanism needed",
      "Built and priced now — does not wait on client approval",
    ], NAVY],
    ["Plan 2 — Conditional", "Select AI + self-hosted LLM", [
      "Oracle Select AI translates question directly to SQL",
      "Bypasses per-endpoint tool-calling for deterministic questions",
      "Only pursued with the client's explicit approval",
      "Requires Oracle VPD or proxy-authentication first — otherwise reopens the confidentiality risk",
    ], "2D3A8C"],
  ];
  let x = 0.6;
  cols.forEach((c) => {
    box(s, x, 2.2, 5.85, 4.45, { fill: CARD, title: c[0], titleSize: 15, titleColor: c[3] });
    s.addText(c[1], { x: x + 0.3, y: 2.75, w: 5.25, h: 0.4, fontFace: "Calibri", fontSize: 12.5, italic: true, color: ACCENT, isTextBox: true, margin: 0 });
    const bullets = c[2].map((t, idx) => ({ text: t, options: { bullet: { code: "2022" }, breakLine: idx < c[2].length - 1, color: MUTED, fontSize: 11.5 } }));
    s.addText(bullets, { x: x + 0.3, y: 3.25, w: 5.25, h: 3.2, fontFace: "Calibri", isTextBox: true, margin: 0, paraSpaceAfter: 10, valign: "top" });
    x += 6.2;
  });
  pageNum(s, 5, false);
}

// ---------- Slide 6: Architecture diagram ----------
{
  const s = lightSlide(deck);
  kicker(s, "Architecture");
  title(s, "BS-6 Inside the BEMS Tier Structure", null, 22);

  const BOUND_X = 2.55, BOUND_W = 10.35, MID = BOUND_X + BOUND_W / 2;
  const branchW = 3.1, gap = 0.55;
  const leftX = MID - gap / 2 - branchW, rightX = MID + gap / 2;
  const leftMidX = leftX + branchW / 2, rightMidX = rightX + branchW / 2;

  // On-prem boundary wraps everything from the classifier down to the storage row.
  const boundTop = 2.35, boundBottom = 6.55;
  s.addShape(deck.ShapeType.roundRect, { x: BOUND_X, y: boundTop, w: BOUND_W, h: boundBottom - boundTop, rectRadius: 0.08, fill: { color: "FAFBFF" }, line: { color: NAVY, width: 1.5, dashType: "dash" } });
  s.addText("MCMC INFRASTRUCTURE — ON-PREMISES (CLAUSE 40.8)", { x: BOUND_X + 0.22, y: boundTop + 0.08, w: 8, h: 0.26, fontFace: "Calibri", fontSize: 9.5, bold: true, color: NAVY, charSpacing: 1, isTextBox: true, margin: 0 });

  // Row 0 — user (outside the boundary, clear of the title above)
  const userY = 1.6, userH = 0.55;
  box(s, 0.35, userY, 1.85, userH, { fill: NAVY, title: "User", titleColor: WHITE, titleSize: 12, sub: "BEMS UI", subColor: ICE, align: "center", subY: 0.3 });

  // Row 1 — the missing step: an explicit classifier decides Oracle vs Milvus BEFORE either path runs
  const clsY = 2.75, clsW = 3.4, clsX = MID - clsW / 2, clsH = 0.62;
  box(s, clsX, clsY, clsW, clsH, { fill: "2D3A8C", title: "BS-6 Intent Classifier", titleColor: WHITE, titleSize: 11.5, sub: "on-prem LLM — deterministic, retrieval, or both", subColor: ICE, align: "center", subY: 0.3 });

  // Column headers
  const colLabelY = clsY + clsH + 0.14;
  s.addText("DETERMINISTIC → ORACLE", { x: leftX, y: colLabelY, w: branchW, h: 0.24, fontFace: "Calibri", fontSize: 9.5, bold: true, color: "0F6E56", align: "center", isTextBox: true, margin: 0 });
  s.addText("RETRIEVAL (RAG) → MILVUS", { x: rightX, y: colLabelY, w: branchW, h: 0.24, fontFace: "Calibri", fontSize: 9.5, bold: true, color: "3C3489", align: "center", isTextBox: true, margin: 0 });

  // Row 2
  const row2Y = colLabelY + 0.3, rowH = 0.62;
  box(s, leftX, row2Y, branchW, rowH, { fill: CARD, title: "Tier-2 API Gateway", titleSize: 11, sub: "calls Oracle as the requesting user", subY: 0.32, subSize: 9 });
  box(s, rightX, row2Y, branchW, rowH, { fill: CARD, title: "TEI embedding server", titleSize: 11, sub: "Rust, self-hosted — embeds the question", subY: 0.32, subSize: 9 });

  // Row 3
  const row3Y = row2Y + rowH + 0.14;
  box(s, leftX, row3Y, branchW, rowH, { fill: CARD, title: "BS-1..BS-5 (Tier 3)", titleSize: 11, sub: "Policy Engine: RBAC + LOA per call", subY: 0.32, subSize: 9 });
  box(s, rightX, row3Y, branchW, rowH, { fill: CARD, title: "Milvus", titleSize: 11, sub: "vector similarity search over indexed docs", subY: 0.32, subSize: 9 });

  // Row 4 — storage
  const row4Y = row3Y + rowH + 0.14;
  box(s, leftX, row4Y, branchW, rowH, { fill: "E1F5EE", line: { color: "0F6E56", width: 0.6 }, title: "Single Oracle DB", titleSize: 11, titleColor: "085041", sub: "no database-per-service (40.3.4.7.1)", subY: 0.32, subSize: 9, subColor: "0F6E56" });
  box(s, rightX, row4Y, branchW, rowH, { fill: "E1F5EE", line: { color: "0F6E56", width: 0.6 }, title: "MinIO", titleSize: 11, titleColor: "085041", sub: "object storage backing Milvus", subY: 0.32, subSize: 9, subColor: "0F6E56" });

  // Row 5 — converged answer (outside the boundary, back to the user)
  const ansY = boundBottom + 0.2, ansW = 3.8, ansX = MID - ansW / 2, ansH = 0.58;
  box(s, ansX, ansY, ansW, ansH, { fill: NAVY, title: "Labelled answer", titleColor: WHITE, titleSize: 11.5, sub: "fact / knowledge / narrative, source cited", subColor: ICE, align: "center", subY: 0.28, subSize: 9.5 });

  // Arrows
  arrow(s, 1.28, userY + userH, clsX, clsY + clsH / 2, NAVY);

  arrow(s, MID, clsY + clsH, leftMidX, row2Y, ACCENT);
  arrow(s, MID, clsY + clsH, rightMidX, row2Y, ACCENT);
  arrow(s, leftMidX, row2Y + rowH, leftMidX, row3Y, ACCENT);
  arrow(s, rightMidX, row2Y + rowH, rightMidX, row3Y, ACCENT);
  arrow(s, leftMidX, row3Y + rowH, leftMidX, row4Y, ACCENT);
  arrow(s, rightMidX, row3Y + rowH, rightMidX, row4Y, ACCENT);
  arrow(s, leftMidX, row4Y + rowH, ansX + 0.75, ansY, ACCENT);
  arrow(s, rightMidX, row4Y + rowH, ansX + ansW - 0.75, ansY, ACCENT);

  pageNum(s, 6, false);
}

// ---------- Slide 7: Intent detection ----------
{
  const s = lightSlide(deck);
  kicker(s, "Routing Logic");
  title(s, "Intent Detection: Deterministic, Retrieval, or Both");
  s.addText("Every question is classified before anything is called.", {
    x: 0.6, y: 1.6, w: 11.8, h: 0.4, fontFace: "Calibri", fontSize: 12.5, color: MUTED, isTextBox: true, margin: 0,
  });

  const rows = [
    ["Classification", "Trigger", "What happens"],
    ["Deterministic", "Needs an exact, current figure", "Routed to the matching BS-1..BS-5 API only — never answered from the document index"],
    ["Non-deterministic", "Needs a definition or policy explanation", "Routed to the on-prem retrieval index only, with the source document cited"],
    ["Hybrid", "Needs both", "Both paths run; only the connecting sentence is model narrative"],
  ];
  table(s, rows, [0.6, 3.6, 6.9], [2.9, 3.2, 5.8], 2.2, { rowH: 0.85, fontSize: 11 });

  box(s, 0.6, 5.35, 12.1, 1.35, {
    fill: "FFF4E5", line: { color: "EF9F27", width: 1 },
    title: "On misclassification",
    titleColor: "854F0B", titleSize: 12,
    sub: "The dangerous failure is a deterministic question silently answered from retrieval, because the document index contains a plausible old figure. The retrieval tool is never described as able to serve current figures; the classifier defaults to the API path whenever a live number could be expected.",
    subColor: "854F0B", subSize: 10.5, subY: 0.4, subLine: 14,
  });
  pageNum(s, 7, false);
}

// ---------- Slide 8: Sovereignty + concerns ----------
{
  const s = lightSlide(deck);
  kicker(s, "Sovereignty & Risk");
  title(s, "Data Sovereignty, Concerns and Mitigations");

  const rows = [
    ["Concern", "Mitigation"],
    ["Direct database access bypasses the middleware", "Structurally impossible — BS-6 holds no database credentials, only the ability to call BS-1..BS-5 as the requesting user"],
    ["Confidential data disclosed to an unauthorised user", "Every call carries the user's own identity token; existing RBAC / cost-centre-scope checks apply identically"],
    ["Data or queries leave MCMC infrastructure", "Embedding model and LLM both self-hosted; zero external API calls (clause 40.8)"],
    ["Deterministic question answered from stale text", "Classifier defaults to the API path whenever a live number could be expected"],
    ["Assistant takes a financial action without approval", "Out of scope for v1 — every action still goes through the normal BS-4 workflow and LOA check"],
  ];
  table(s, rows, [0.6, 5.4], [4.6, 7.3], 2.05, { rowH: 0.85, fontSize: 10.5 });
  pageNum(s, 8, false);
}

// ---------- Slide 9: Decisions required ----------
{
  const s = darkSlide(deck);
  kicker(s, "Next Steps", "8B95C9");
  title(s, "Decisions Required", WHITE);

  s.addText("Resolved: retrieval documents are user-uploaded on demand — no curated set to maintain. Plan 1 (tool-calling) is the committed default and does not wait on client approval.", {
    x: 0.6, y: 1.6, w: 11.8, h: 0.7, fontFace: "Calibri", fontSize: 12.5, color: ICE, isTextBox: true, margin: 0, lineSpacing: 17,
  });

  const items = [
    ["1", "Which BS-1..BS-5 endpoints to expose first", "BS-3 (budget availability) and BS-5 (reporting/enquiry) are the natural starting set for the pilot"],
    ["2", "Model selection for tool-calling", "Evaluate candidates against the project's real, full endpoint catalogue — accuracy degrades as the endpoint count grows"],
    ["3", "Whether and when to offer Plan 2 to the client", "Select AI is a later enhancement, contingent on explicit approval and on VPD/proxy-authentication being feasible"],
  ];
  let y = 2.6;
  items.forEach((it) => {
    s.addShape(deck.ShapeType.roundRect, { x: 0.6, y, w: 0.6, h: 0.6, rectRadius: 0.3, fill: { color: "2D3A8C" }, line: { type: "none" } });
    s.addText(it[0], { x: 0.6, y, w: 0.6, h: 0.6, fontFace: "Cambria", fontSize: 16, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
    s.addText(it[1], { x: 1.4, y: y - 0.02, w: 10.9, h: 0.4, fontFace: "Calibri", fontSize: 13.5, bold: true, color: WHITE, isTextBox: true, margin: 0 });
    s.addText(it[2], { x: 1.4, y: y + 0.38, w: 10.9, h: 0.6, fontFace: "Calibri", fontSize: 11.5, color: ICE, isTextBox: true, margin: 0, lineSpacing: 15 });
    y += 1.15;
  });
  pageNum(s, 9, true);
}

// ---------- Slide 10: Bottom line ----------
{
  const s = darkSlide(deck);
  s.addText("Bottom Line", { x: 0.9, y: 2.6, w: 8, h: 0.4, fontFace: "Calibri", fontSize: 13, bold: true, color: "8B95C9", charSpacing: 2, isTextBox: true, margin: 0 });
  s.addText("A Tier-3 Service, Not a\nSeparate Analytics Product", {
    x: 0.9, y: 3.05, w: 11.2, h: 1.7, fontFace: "Cambria", fontSize: 32, bold: true, color: WHITE, isTextBox: true, margin: 0, lineSpacing: 40,
  });
  s.addText("Facts from a governed API call. Knowledge from an on-premises retrieval index. Neither ever substitutes for the other — no path exists around the access control that already protects every budget figure in the system.", {
    x: 0.9, y: 4.75, w: 10.6, h: 1.0, fontFace: "Calibri", fontSize: 13.5, italic: true, color: ICE, isTextBox: true, margin: 0, lineSpacing: 18,
  });
  s.addShape(deck.ShapeType.rect, { x: 0.9, y: 5.9, w: 1.6, h: 0.05, fill: { color: ACCENT } });
  pageNum(s, 10, true);
}

deck.writeFile({ fileName: "BEMS_BS6_AI_Assistant_Development_Plan.pptx" }).then(() => console.log("done"));
