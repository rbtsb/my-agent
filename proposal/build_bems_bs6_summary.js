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
function kicker(s, text, color, y) {
  s.addText(text.toUpperCase(), { x: 0.6, y: y ?? 0.4, w: 10, h: 0.32, fontFace: "Calibri", fontSize: 11.5, bold: true, color: color || "6B7CC7", charSpacing: 2, isTextBox: true, margin: 0 });
}
function title(s, text, color, size, y) {
  s.addText(text, { x: 0.6, y: y ?? 0.68, w: 12.2, h: 0.7, fontFace: "Cambria", fontSize: size || 24, bold: true, color: color || INK, isTextBox: true, margin: 0 });
}
function pageNum(s, n, dark) {
  s.addText(String(n), { x: 12.7, y: 7.1, w: 0.5, h: 0.3, fontFace: "Calibri", fontSize: 10, color: dark ? "8B95C9" : "A6ADC6", align: "right", isTextBox: true, margin: 0 });
}

const deck = newDeck();

function box(s, x, y, w, h, opts = {}) {
  s.addShape(deck.ShapeType.roundRect, { x, y, w, h, rectRadius: opts.r ?? 0.06, fill: { color: opts.fill ?? CARD }, line: opts.line ?? { type: "none" } });
  if (opts.title) s.addText(opts.title, { x: x + 0.14, y: y + 0.07, w: w - 0.28, h: 0.32, fontFace: "Calibri", fontSize: opts.titleSize ?? 11.5, bold: true, color: opts.titleColor ?? NAVY, isTextBox: true, margin: 0, align: opts.align ?? "left" });
  if (opts.sub) s.addText(opts.sub, { x: x + 0.14, y: y + (opts.subY ?? 0.36), w: w - 0.28, h: h - (opts.subY ?? 0.36) - 0.06, fontFace: "Calibri", fontSize: opts.subSize ?? 9.5, color: opts.subColor ?? MUTED, isTextBox: true, margin: 0, align: opts.align ?? "left", lineSpacing: opts.subLine ?? 12 });
}
function arrow(s, x1, y1, x2, y2, color) {
  const x = Math.min(x1, x2), y = Math.min(y1, y2);
  const w = Math.max(Math.abs(x2 - x1), 0.01), h = Math.max(Math.abs(y2 - y1), 0.01);
  s.addShape(deck.ShapeType.line, { x, y, w, h, flipH: x1 > x2, flipV: y1 > y2, line: { color: color ?? ACCENT, width: 1.5, endArrowType: "triangle" } });
}
function table(s, rows, colX, colW, startY, opts = {}) {
  const rowH = opts.rowH ?? 0.5;
  rows[0].forEach((h, i) => {
    s.addText(h, { x: colX[i], y: startY - 0.32, w: colW[i], h: 0.28, fontFace: "Calibri", fontSize: 10.5, bold: true, color: NAVY, isTextBox: true, margin: 0 });
  });
  s.addShape(deck.ShapeType.line, { x: colX[0], y: startY - 0.03, w: colX[colX.length - 1] + colW[colW.length - 1] - colX[0], h: 0, line: { color: "D8DCEE", width: 1 } });
  rows.slice(1).forEach((r, i) => {
    const y = startY + i * rowH;
    if (i % 2 === 1) s.addShape(deck.ShapeType.rect, { x: colX[0], y, w: colX[colX.length - 1] + colW[colW.length - 1] - colX[0], h: rowH, fill: { color: CARD }, line: { type: "none" } });
    r.forEach((cell, ci) => {
      s.addText(cell, { x: colX[ci] + 0.05, y: y + 0.05, w: colW[ci] - 0.1, h: rowH - 0.1, fontFace: "Calibri", fontSize: opts.fontSize ?? 10, color: ci === 0 ? INK : MUTED, bold: ci === 0 && opts.boldFirst, isTextBox: true, margin: 0, valign: "top", lineSpacing: opts.lineSpacing ?? 12 });
    });
  });
}

// ============ SLIDE 1: Title ============
{
  const s = darkSlide(deck);
  s.addText("BEMS — BS-6", { x: 0.9, y: 2.2, w: 11.5, h: 0.4, fontFace: "Calibri", fontSize: 14, bold: true, color: "8B95C9", charSpacing: 3, isTextBox: true, margin: 0 });
  s.addText("AI & Intelligent Automation", { x: 0.9, y: 2.65, w: 11.5, h: 1.0, fontFace: "Cambria", fontSize: 38, bold: true, color: WHITE, isTextBox: true, margin: 0 });
  s.addText("Executive Summary, Architecture and Scope of Work", { x: 0.9, y: 3.55, w: 11, h: 0.5, fontFace: "Calibri", fontSize: 16, color: ICE, isTextBox: true, margin: 0 });
  s.addShape(deck.ShapeType.rect, { x: 0.9, y: 4.25, w: 1.6, h: 0.05, fill: { color: ACCENT } });
  pageNum(s, 1, true);
}

// ============ SLIDE 2: Approach at a glance ============
{
  const s = lightSlide(deck);
  kicker(s, "Approach at a Glance");
  title(s, "Two Data Sources, One Rule: Never Blend Fact and Knowledge");

  const quads = [
    ["Two data sources", "BS-1..BS-5 APIs over the Oracle DB for exact figures. A self-hosted vector index (Milvus) over user-uploaded documents for definitions and policy."],
    ["Never a direct query", "Clause 40.2.6.1c forbids bypassing the middleware. Every figure comes from a BS-1..BS-5 API call under the user's own identity — the same RBAC that protects the UI protects the assistant."],
    ["Intent decides the path", "An on-prem classifier reads every question first and routes it to Oracle (deterministic), Milvus (retrieval), or both — before anything is called."],
    ["Fully on-premises", "Embedding model, vector store and LLM are all self-hosted. No external or public AI service is ever called (clause 40.8)."],
  ];
  let x = 0.6, y = 1.75;
  quads.forEach((q, i) => {
    box(s, x, y, 5.9, 2.35, { fill: CARD, title: q[0], titleSize: 14, titleColor: NAVY, sub: q[1], subSize: 11.5, subY: 0.5, subLine: 16 });
    x += 6.15;
    if (i === 1) { x = 0.6; y += 2.55; }
  });
  pageNum(s, 2, false);
}

// ============ SLIDE 3: Architecture ============
{
  const s = lightSlide(deck);
  kicker(s, "Architecture");
  title(s, "BS-6 Inside the BEMS Tier Structure", null, 22);

  const BOUND_X = 2.55, BOUND_W = 10.35, MID = BOUND_X + BOUND_W / 2;
  const branchW = 3.1, gap = 0.55;
  const leftX = MID - gap / 2 - branchW, rightX = MID + gap / 2;
  const leftMidX = leftX + branchW / 2, rightMidX = rightX + branchW / 2;

  const boundTop = 2.35, boundBottom = 6.55;
  s.addShape(deck.ShapeType.roundRect, { x: BOUND_X, y: boundTop, w: BOUND_W, h: boundBottom - boundTop, rectRadius: 0.08, fill: { color: "FAFBFF" }, line: { color: NAVY, width: 1.5, dashType: "dash" } });
  s.addText("MCMC INFRASTRUCTURE — ON-PREMISES (CLAUSE 40.8)", { x: BOUND_X + 0.22, y: boundTop + 0.08, w: 8, h: 0.26, fontFace: "Calibri", fontSize: 9.5, bold: true, color: NAVY, charSpacing: 1, isTextBox: true, margin: 0 });

  const userY = 1.6, userH = 0.55;
  box(s, 0.35, userY, 1.85, userH, { fill: NAVY, title: "User", titleColor: WHITE, titleSize: 12, sub: "BEMS UI", subColor: ICE, align: "center", subY: 0.3 });

  const clsY = 2.75, clsW = 3.4, clsX = MID - clsW / 2, clsH = 0.62;
  box(s, clsX, clsY, clsW, clsH, { fill: "2D3A8C", title: "BS-6 Intent Classifier", titleColor: WHITE, titleSize: 11.5, sub: "on-prem LLM — deterministic, retrieval, or both", subColor: ICE, align: "center", subY: 0.3 });

  const colLabelY = clsY + clsH + 0.14;
  s.addText("DETERMINISTIC → ORACLE", { x: leftX, y: colLabelY, w: branchW, h: 0.24, fontFace: "Calibri", fontSize: 9.5, bold: true, color: "0F6E56", align: "center", isTextBox: true, margin: 0 });
  s.addText("RETRIEVAL (RAG) → MILVUS", { x: rightX, y: colLabelY, w: branchW, h: 0.24, fontFace: "Calibri", fontSize: 9.5, bold: true, color: "3C3489", align: "center", isTextBox: true, margin: 0 });

  const row2Y = colLabelY + 0.3, rowH = 0.62;
  box(s, leftX, row2Y, branchW, rowH, { fill: CARD, title: "Tier-2 API Gateway", titleSize: 11, sub: "calls Oracle as the requesting user", subY: 0.32, subSize: 9 });
  box(s, rightX, row2Y, branchW, rowH, { fill: CARD, title: "TEI embedding server", titleSize: 11, sub: "Rust, self-hosted (+ OCR fallback for scans)", subY: 0.32, subSize: 9 });

  const row3Y = row2Y + rowH + 0.14;
  box(s, leftX, row3Y, branchW, rowH, { fill: CARD, title: "BS-1..BS-5 (Tier 3)", titleSize: 11, sub: "Policy Engine: RBAC + LOA per call", subY: 0.32, subSize: 9 });
  box(s, rightX, row3Y, branchW, rowH, { fill: CARD, title: "Milvus", titleSize: 11, sub: "vector similarity search over indexed docs", subY: 0.32, subSize: 9 });

  const row4Y = row3Y + rowH + 0.14;
  box(s, leftX, row4Y, branchW, rowH, { fill: "E1F5EE", line: { color: "0F6E56", width: 0.6 }, title: "Single Oracle DB", titleSize: 11, titleColor: "085041", sub: "+ Knowledge Layer tables (40.3.4.7.1)", subY: 0.32, subSize: 9, subColor: "0F6E56" });
  box(s, rightX, row4Y, branchW, rowH, { fill: "E1F5EE", line: { color: "0F6E56", width: 0.6 }, title: "MinIO", titleSize: 11, titleColor: "085041", sub: "object storage backing Milvus", subY: 0.32, subSize: 9, subColor: "0F6E56" });

  const ansY = boundBottom + 0.2, ansW = 3.8, ansX = MID - ansW / 2, ansH = 0.58;
  box(s, ansX, ansY, ansW, ansH, { fill: NAVY, title: "Labelled answer", titleColor: WHITE, titleSize: 11.5, sub: "fact / knowledge / narrative, source cited", subColor: ICE, align: "center", subY: 0.28, subSize: 9.5 });

  arrow(s, 1.28, userY + userH, clsX, clsY + clsH / 2, NAVY);
  arrow(s, MID, clsY + clsH, leftMidX, row2Y, ACCENT);
  arrow(s, MID, clsY + clsH, rightMidX, row2Y, ACCENT);
  arrow(s, leftMidX, row2Y + rowH, leftMidX, row3Y, ACCENT);
  arrow(s, rightMidX, row2Y + rowH, rightMidX, row3Y, ACCENT);
  arrow(s, leftMidX, row3Y + rowH, leftMidX, row4Y, ACCENT);
  arrow(s, rightMidX, row3Y + rowH, rightMidX, row4Y, ACCENT);
  arrow(s, leftMidX, row4Y + rowH, ansX + 0.75, ansY, ACCENT);
  arrow(s, rightMidX, row4Y + rowH, ansX + ansW - 0.75, ansY, ACCENT);
  pageNum(s, 3, false);
}

// ============ SLIDE 4: Knowledge Layer ============
{
  const s = lightSlide(deck);
  kicker(s, "New Capability");
  title(s, "Knowledge Layer — Persistent User Memory");
  s.addText("A dedicated persistence pattern built for BEMS's single Oracle database. This is the assistant's memory of the user — not a new answer type.", {
    x: 0.6, y: 1.55, w: 11.8, h: 0.55, fontFace: "Calibri", fontSize: 12.5, color: MUTED, isTextBox: true, margin: 0, lineSpacing: 16,
  });

  const rows = [
    ["Aspect", "Design"],
    ["What's captured", "Behaviour, stated interests, working preferences (report format, level of detail), recurring questions, role context — never raw transcripts"],
    ["Storage", "New tables in the same centralised Oracle DB — no new database (40.3.4.7.1)"],
    ["Write / read path", "A governed API, alongside BS-1..BS-5 — never a direct table write, always under the user's own identity"],
    ["Access control", "Scoped strictly to the user it was recorded for; no cross-user query path"],
    ["Purpose", "Personalises future answers to that specific user, instead of starting from zero every session"],
  ];
  table(s, rows, [0.6, 3.5], [2.8, 9.4], 2.5, { rowH: 0.68, fontSize: 10.5 });

  box(s, 0.6, 6.55, 12.1, 0.5, {
    fill: "FFF4E5", line: { color: "EF9F27", width: 1 },
    sub: "The fact / knowledge / narrative rule is unchanged — memory shapes how a question is answered, it is never itself cited as the answer.",
    subColor: "854F0B", subSize: 10, subY: 0.08, subLine: 12,
  });
  pageNum(s, 4, false);
}

// ============ SLIDE 5: Delivery plan + governance ============
{
  const s = lightSlide(deck);
  kicker(s, "Delivery Plan & Governance");
  title(s, "Plan 1 (Default), Plan 2 (Conditional), and the Guardrails");

  const cols = [
    ["Plan 1 — Default", NAVY, [
      "Tool-calling over documented BS-1..BS-5 APIs",
      "Model chosen for tool-calling accuracy",
      "Built and priced now, no client sign-off needed",
    ]],
    ["Plan 2 — Conditional", "2D3A8C", [
      "Oracle Select AI translates question to SQL directly",
      "Only pursued with the client's explicit approval",
      "Requires Oracle VPD/proxy-auth first, or the confidentiality risk reopens",
    ]],
  ];
  let x = 0.6;
  cols.forEach((c) => {
    box(s, x, 1.75, 5.9, 2.15, { fill: CARD, title: c[0], titleSize: 13.5, titleColor: c[1] });
    const bullets = c[2].map((t, idx) => ({ text: t, options: { bullet: { code: "2022" }, breakLine: idx < c[2].length - 1, color: MUTED, fontSize: 10.5 } }));
    s.addText(bullets, { x: x + 0.25, y: 2.2, w: 5.4, h: 1.65, fontFace: "Calibri", isTextBox: true, margin: 0, paraSpaceAfter: 6, valign: "top" });
    x += 6.15;
  });

  const rows = [
    ["Concern", "Mitigation"],
    ["Confidential data disclosed", "Every call carries the user's own identity token; existing RBAC applies identically to the assistant"],
    ["Data leaves MCMC infrastructure", "Embedding model, vector store and LLM all self-hosted; zero external calls"],
    ["Stale figure answered from retrieval", "Classifier defaults to the API path whenever a live number could be expected"],
    ["Assistant acts without approval", "Out of scope for v1 — every action still goes through BS-4 workflow and LOA"],
    ["Cross-user leakage from Knowledge Layer", "Memory scoped strictly to the recording user; no cross-user query path"],
  ];
  table(s, rows, [0.6, 5.0], [4.3, 7.7], 4.3, { rowH: 0.46, fontSize: 10 });
  pageNum(s, 5, false);
}

// ============ SLIDE 6: Decisions + bottom line ============
{
  const s = darkSlide(deck);
  kicker(s, "Next Steps", "8B95C9");
  title(s, "Decisions Required, and the Bottom Line", WHITE);

  const items = [
    ["1", "Which BS-1..BS-5 endpoints to expose first", "BS-3 (budget availability) and BS-5 (reporting) start the pilot"],
    ["2", "Model selection for tool-calling", "Evaluated against the real, full endpoint catalogue before committing"],
    ["3", "Whether and when to offer Plan 2", "Contingent on client approval and VPD/proxy-auth feasibility"],
    ["4", "Finalising the Knowledge Layer schema", "Agree the field set and retention rules with MCMC before Phase 1 build starts"],
  ];
  let y = 1.55;
  items.forEach((it) => {
    s.addShape(deck.ShapeType.roundRect, { x: 0.6, y, w: 0.55, h: 0.55, rectRadius: 0.28, fill: { color: "2D3A8C" }, line: { type: "none" } });
    s.addText(it[0], { x: 0.6, y, w: 0.55, h: 0.55, fontFace: "Cambria", fontSize: 15, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
    s.addText(it[1], { x: 1.35, y: y - 0.02, w: 11, h: 0.35, fontFace: "Calibri", fontSize: 13, bold: true, color: WHITE, isTextBox: true, margin: 0 });
    s.addText(it[2], { x: 1.35, y: y + 0.33, w: 11, h: 0.35, fontFace: "Calibri", fontSize: 11, color: ICE, isTextBox: true, margin: 0 });
    y += 0.85;
  });

  s.addShape(deck.ShapeType.rect, { x: 0.6, y: y + 0.05, w: 12.1, h: 0.02, fill: { color: "3C4694" } });
  s.addText("Facts from a governed API call. Knowledge from an on-premises retrieval index. Neither ever substitutes for the other.", {
    x: 0.6, y: y + 0.25, w: 12.1, h: 0.7, fontFace: "Calibri", fontSize: 13.5, italic: true, color: ICE, isTextBox: true, margin: 0, lineSpacing: 18,
  });
  pageNum(s, 6, true);
}

deck.writeFile({ fileName: "BEMS_BS6_Executive_Summary_v2.pptx" }).then(() => console.log("done"));
