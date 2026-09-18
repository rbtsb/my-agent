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
function box(s, x, y, w, h, opts = {}) {
  s.addShape(deck.ShapeType.roundRect, { x, y, w, h, rectRadius: opts.r ?? 0.07, fill: { color: opts.fill ?? CARD }, line: opts.line ?? { type: "none" } });
  if (opts.title) s.addText(opts.title, { x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.35, fontFace: "Calibri", fontSize: opts.titleSize ?? 12.5, bold: true, color: opts.titleColor ?? NAVY, isTextBox: true, margin: 0, align: opts.align ?? "left" });
  if (opts.sub) s.addText(opts.sub, { x: x + 0.15, y: y + (opts.subY ?? 0.42), w: w - 0.3, h: h - (opts.subY ?? 0.42) - 0.08, fontFace: "Calibri", fontSize: opts.subSize ?? 10, color: opts.subColor ?? MUTED, isTextBox: true, margin: 0, align: opts.align ?? "left", lineSpacing: opts.subLine ?? 13 });
}
function arrow(s, x1, y1, x2, y2, color) {
  // pptxgenjs always draws a "line" shape's path from (x,y) to (x+w,y+h) — i.e. top-left to
  // bottom-right of its bounding box. To point the arrowhead at the real (x2,y2), the box must
  // be flipped whenever the intended direction runs the other way on that axis.
  const x = Math.min(x1, x2), y = Math.min(y1, y2);
  const w = Math.max(Math.abs(x2 - x1), 0.01), h = Math.max(Math.abs(y2 - y1), 0.01);
  s.addShape(deck.ShapeType.line, {
    x, y, w, h, flipH: x1 > x2, flipV: y1 > y2,
    line: { color: color ?? ACCENT, width: 1.75, endArrowType: "triangle" },
  });
}

const deck = newDeck();

// ---------- Slide 1: Title ----------
{
  const s = darkSlide(deck);
  s.addText("AI ASSISTANT — TECHNICAL DESIGN", { x: 0.9, y: 2.35, w: 11.5, h: 0.4, fontFace: "Calibri", fontSize: 14, bold: true, color: "8B95C9", charSpacing: 3, isTextBox: true, margin: 0 });
  s.addText("RAG + Tool Calling Architecture", { x: 0.9, y: 2.8, w: 11.5, h: 1.1, fontFace: "Cambria", fontSize: 40, bold: true, color: WHITE, isTextBox: true, margin: 0 });
  s.addText("On-premises retrieval, live data, and governed answers — the design behind the BEMS AI assistant.", {
    x: 0.9, y: 3.9, w: 10.5, h: 0.6, fontFace: "Calibri", fontSize: 15, color: ICE, isTextBox: true, margin: 0,
  });
  s.addShape(deck.ShapeType.rect, { x: 0.9, y: 4.55, w: 1.6, h: 0.05, fill: { color: ACCENT } });
  pageNum(s, 1, true);
}

// ---------- Slide 2: Architecture diagram ----------
{
  const s = lightSlide(deck);
  kicker(s, "Architecture");
  title(s, "End-to-End Flow, On-Premises Boundary");

  // Layout is centered on the boundary's mid-x (7.8) so both branches sit symmetrically.
  const BOUND_X = 2.7, BOUND_W = 10.2, MID = BOUND_X + BOUND_W / 2; // mid = 7.8

  // User node (outside the boundary)
  box(s, 0.4, 1.85, 1.9, 0.9, { fill: NAVY, title: "User", titleColor: WHITE, titleSize: 13, sub: "Question via chat UI", subColor: ICE, align: "center", subY: 0.42 });

  // On-prem boundary
  s.addShape(deck.ShapeType.roundRect, { x: BOUND_X, y: 1.15, w: BOUND_W, h: 5.55, rectRadius: 0.08, fill: { color: "FAFBFF" }, line: { color: NAVY, width: 1.5, dashType: "dash" } });
  s.addText("ON-PREMISES BOUNDARY  (Section 41.2.1)", { x: BOUND_X + 0.25, y: 1.25, w: 6, h: 0.3, fontFace: "Calibri", fontSize: 10, bold: true, color: NAVY, charSpacing: 1, isTextBox: true, margin: 0 });

  // Router — centered
  const routerW = 2.4, routerX = MID - routerW / 2, routerY = 1.7, routerH = 0.75;
  box(s, routerX, routerY, routerW, routerH, { fill: "2D3A8C", title: "Intent Router", titleColor: WHITE, titleSize: 12.5, sub: "live data, knowledge, or both?", subColor: ICE, align: "center", subY: 0.38 });

  // Two branches, symmetric around MID with a gap between them
  const branchW = 3.0, gap = 0.6;
  const leftX = MID - gap / 2 - branchW, rightX = MID + gap / 2;
  const row1Y = 2.95, row1H = 1.0;
  const row2Y = 4.3, row2H = 0.85;
  const leftMidX = leftX + branchW / 2, rightMidX = rightX + branchW / 2;

  box(s, leftX, row1Y, branchW, row1H, { fill: CARD, title: "Tool Calling", sub: "Direct calls to BEMS\nJava/Spring Boot APIs", subY: 0.4 });
  box(s, rightX, row1Y, branchW, row1H, { fill: CARD, title: "Embedding Model", sub: "Self-hosted (bge-m3)\nEmbeds the query", subY: 0.4 });

  box(s, leftX, row2Y, branchW, row2H, { fill: CARD, title: "BEMS Data", sub: "Budget · Actual · PR/PO · HR", subY: 0.38 });
  box(s, rightX, row2Y, branchW, row2H, { fill: CARD, title: "Milvus", sub: "Vector search over policy docs, role-filtered", subY: 0.38 });

  // LLM — centered, below both branches
  const llmW = 4.0, llmX = MID - llmW / 2, llmY = 5.45, llmH = 0.95;
  box(s, llmX, llmY, llmW, llmH, { fill: NAVY, title: "LLM (self-hosted)", titleColor: WHITE, titleSize: 12.5, sub: "Merges fact + retrieved text; labels each", subColor: ICE, align: "center", subY: 0.4 });

  // Answer node (outside the boundary, below User)
  box(s, 0.4, 5.75, 1.9, 0.85, { fill: NAVY, title: "Answer", titleColor: WHITE, titleSize: 13, sub: "Fact / knowledge / narrative labelled", subColor: ICE, align: "center", subY: 0.4 });

  // Arrows — every one drawn from its true start to its true end
  arrow(s, 2.3, 2.3, BOUND_X, 2.3, NAVY); // User -> boundary
  arrow(s, MID, routerY + routerH, leftMidX, row1Y, ACCENT); // Router -> Tool Calling
  arrow(s, MID, routerY + routerH, rightMidX, row1Y, ACCENT); // Router -> Embedding Model
  arrow(s, leftMidX, row1Y + row1H, leftMidX, row2Y, ACCENT); // Tool Calling -> BEMS Data
  arrow(s, rightMidX, row1Y + row1H, rightMidX, row2Y, ACCENT); // Embedding -> Milvus
  arrow(s, leftMidX, row2Y + row2H, llmX + 0.6, llmY, ACCENT); // BEMS Data -> LLM
  arrow(s, rightMidX, row2Y + row2H, llmX + llmW - 0.6, llmY, ACCENT); // Milvus -> LLM
  arrow(s, llmX, llmY + llmH * 0.6, 2.3, 6.15, WHITE); // LLM -> Answer

  pageNum(s, 2, false);
}

// ---------- Slide 3: Three design decisions, condensed ----------
{
  const s = lightSlide(deck);
  kicker(s, "Design Decisions");
  title(s, "Three Constraints That Shaped the Design");

  const cols = [
    ["Sovereignty", "Embedding model + Milvus + LLM all self-hosted. No document text or query ever leaves the network."],
    ["Fact vs. knowledge", "Live figures come only from tool calling. RAG never answers a question that needs an exact, current number."],
    ["Role-aware retrieval", "Access filter applied before similarity search, not after — the model never sees data outside the user's scope."],
  ];
  cols.forEach((c, i) => {
    const x = 0.6 + i * 4.15;
    box(s, x, 1.9, 3.85, 3.9, {
      fill: CARD, title: c[0], titleSize: 15, titleColor: NAVY,
      sub: c[1], subSize: 12.5, subY: 0.6, subLine: 17,
    });
  });
  pageNum(s, 3, false);
}

// ---------- Slide 4: Risk / mitigation summary ----------
{
  const s = lightSlide(deck);
  kicker(s, "Summary");
  title(s, "Concerns Raised, and How Each Is Addressed");

  const rows = [
    ["Data leaves the network via embeddings", "Self-hosted embedding model, on-prem Milvus"],
    ["RAG answers become factually stale", "Live figures always via tool calling, never retrieval"],
    ["Cross-role data leakage in retrieval", "Metadata role filter applied before similarity search"],
    ["User can't tell fact from AI guess", "Every answer labels fact / knowledge / narrative"],
    ["Compliance decisions made by the model", "Rules engine decides; AI explains; human approves"],
  ];
  const startY = 1.95, rowH = 0.78;
  ["Concern", "Mitigation"].forEach((h, i) => {
    s.addText(h, { x: i === 0 ? 0.6 : 6.6, y: startY - 0.4, w: i === 0 ? 5.8 : 6.1, h: 0.35, fontFace: "Calibri", fontSize: 11, bold: true, color: NAVY, isTextBox: true, margin: 0 });
  });
  s.addShape(deck.ShapeType.line, { x: 0.6, y: startY - 0.05, w: 12.1, h: 0, line: { color: "D8DCEE", width: 1 } });
  rows.forEach((r, i) => {
    const y = startY + i * rowH;
    if (i % 2 === 1) s.addShape(deck.ShapeType.rect, { x: 0.6, y, w: 12.1, h: rowH, fill: { color: CARD }, line: { type: "none" } });
    s.addText(r[0], { x: 0.85, y: y + 0.1, w: 5.5, h: rowH - 0.2, fontFace: "Calibri", fontSize: 12.5, color: INK, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(r[1], { x: 6.85, y: y + 0.1, w: 5.7, h: rowH - 0.2, fontFace: "Calibri", fontSize: 12, color: MUTED, isTextBox: true, margin: 0, valign: "middle" });
  });
  pageNum(s, 4, false);
}

// ---------- Slide 5: Closing ----------
{
  const s = darkSlide(deck);
  s.addText("Bottom Line", { x: 0.9, y: 2.7, w: 8, h: 0.4, fontFace: "Calibri", fontSize: 13, bold: true, color: "8B95C9", charSpacing: 2, isTextBox: true, margin: 0 });
  s.addText("On-Prem End to End.\nFacts, Knowledge and Decisions Never Blended.", {
    x: 0.9, y: 3.15, w: 11.2, h: 1.7, fontFace: "Cambria", fontSize: 30, bold: true, color: WHITE, isTextBox: true, margin: 0, lineSpacing: 38,
  });
  s.addShape(deck.ShapeType.rect, { x: 0.9, y: 4.75, w: 1.6, h: 0.05, fill: { color: ACCENT } });
  pageNum(s, 5, true);
}

deck.writeFile({ fileName: "BEMS_AI_RAG_Architecture.pptx" }).then(() => console.log("done"));
