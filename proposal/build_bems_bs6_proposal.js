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
  s.addText(text.toUpperCase(), { x: 0.6, y: 0.4, w: 10, h: 0.32, fontFace: "Calibri", fontSize: 11.5, bold: true, color: color || "6B7CC7", charSpacing: 2, isTextBox: true, margin: 0 });
}
function title(s, text, color, size) {
  s.addText(text, { x: 0.6, y: 0.68, w: 12.2, h: 0.7, fontFace: "Cambria", fontSize: size || 24, bold: true, color: color || INK, isTextBox: true, margin: 0 });
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
  s.addText("Proposal", { x: 0.9, y: 2.65, w: 11.5, h: 1.0, fontFace: "Cambria", fontSize: 38, bold: true, color: WHITE, isTextBox: true, margin: 0 });
  s.addText("Scope of Work, Effort Estimate and Delivery Timeline — Plan 1", { x: 0.9, y: 3.55, w: 11, h: 0.5, fontFace: "Calibri", fontSize: 16, color: ICE, isTextBox: true, margin: 0 });
  s.addShape(deck.ShapeType.rect, { x: 0.9, y: 4.25, w: 1.6, h: 0.05, fill: { color: ACCENT } });
  pageNum(s, 1, true);
}

// ============ SLIDE 2: Scope of Work ============
{
  const s = lightSlide(deck);
  kicker(s, "Proposal");
  title(s, "Scope of Work");

  const rows = [
    ["Work item", "Included"],
    ["Intent classification", "On-prem LLM classifies every question as deterministic, retrieval, or hybrid before any call is made"],
    ["Tool-calling integration", "BS-1..BS-5 endpoints documented and exposed as callable tools; model selects and invokes the correct one"],
    ["RAG infrastructure", "Milvus (vector search) + MinIO (object storage) + TEI (self-hosted embedding) deployed on MCMC infrastructure"],
    ["Document ingestion & OCR", "User-driven upload — native text extraction, with a self-hosted OCR engine (PaddleOCR or a vision-language model) as fallback for scanned documents and images"],
    ["Knowledge Layer", "Persistent per-user memory (behaviour, interests, preferences) in the same Oracle database — written/read only via a governed API, scoped to each user"],
    ["Answer labelling", "Every response marks fact vs. knowledge vs. narrative, with source citation for retrieved content"],
    ["Audit integration", "Every API call and retrieval query logged with user, role, timestamp and question — feeding the existing audit trail (PS-2)"],
    ["Chat interface", "Conversational UI integrated into the BEMS front end"],
  ];
  table(s, rows, [0.6, 3.4], [2.7, 9.3], 1.85, { rowH: 0.53, fontSize: 9.5 });

  box(s, 0.6, 6.25, 12.1, 0.65, {
    fill: "FFF4E5", line: { color: "EF9F27", width: 1 },
    sub: "Out of scope for v1: the assistant taking any write/approval action; Plan 2 (Select AI) unless separately approved.",
    subColor: "854F0B", subSize: 10, subY: 0.1, subLine: 12,
  });
  pageNum(s, 2, false);
}

// ============ SLIDE 3: Effort & man-day estimate ============
{
  const s = lightSlide(deck);
  kicker(s, "Proposal");
  title(s, "Effort & Man-Day Estimate — Plan 1");
  s.addText("Indicative, based on Plan 1 (tool-calling) scope. Refined once the endpoint list and model are confirmed.", {
    x: 0.6, y: 1.55, w: 11.8, h: 0.45, fontFace: "Calibri", fontSize: 11, italic: true, color: MUTED, isTextBox: true, margin: 0,
  });

  s.addText("Roles match the existing BEMS delivery team (Man-Days Plan) — no new hires.", {
    x: 0.6, y: 2.05, w: 11.8, h: 0.3, fontFace: "Calibri", fontSize: 10.5, color: MUTED, isTextBox: true, margin: 0,
  });

  const rows = [
    ["Role", "Focus", "Man-days"],
    ["Backend Engineers", "Intent classifier, RAG infra (Milvus/MinIO/TEI), tool-calling wiring, Knowledge Layer API, OCR integration", "90"],
    ["Frontend Engineer", "Chat interface, answer labelling, memory-aware context", "12"],
    ["Test Engineer", "Test cases per intent path, accuracy evaluation, Knowledge Layer scoping tests, OCR accuracy sampling", "20"],
    ["DevOps Engineer", "Deploy Milvus, MinIO, TEI and the OCR engine on MCMC's VMware VMs", "15"],
    ["Project Manager", "Design review, governance sign-off, endpoint-priority coordination", "12"],
  ];
  table(s, rows, [0.6, 3.6, 10.8], [2.9, 7.0, 1.9], 2.65, { rowH: 0.56, fontSize: 10.5 });

  box(s, 0.6, 5.9, 12.1, 0.9, {
    fill: CARD,
    title: "Total: ~149 man-days", titleSize: 15, titleColor: NAVY,
    sub: "Approx. 10–12 calendar weeks, run in parallel with the core BEMS build. Excludes Plan 2 (Select AI), costed separately if approved.",
    subSize: 10.5, subY: 0.38, subLine: 13,
  });
  pageNum(s, 3, false);
}

// ============ SLIDE 4: Timeline ============
{
  const s = darkSlide(deck);
  kicker(s, "Proposal", "8B95C9");
  title(s, "Timeline", WHITE);

  const phases = [
    ["Weeks 1–2", "Discovery", "Confirm endpoint scope, evaluate tool-calling models against the real catalogue"],
    ["Weeks 2–5", "RAG infrastructure", "Deploy Milvus, MinIO, TEI and the OCR engine on-prem; build the intent classifier and Knowledge Layer"],
    ["Weeks 4–8", "Tool-calling integration", "Document and wire BS-3, BS-5 first; extend to remaining endpoints"],
    ["Weeks 8–10", "Chat UI & labelling", "Conversational interface, fact/knowledge/narrative labelling, audit integration"],
    ["Weeks 10–12", "Testing & hardening", "Accuracy evaluation, security review, UAT"],
  ];
  let y = 1.75;
  phases.forEach((ph) => {
    s.addShape(deck.ShapeType.roundRect, { x: 0.6, y, w: 1.7, h: 0.85, rectRadius: 0.06, fill: { color: "2D3A8C" }, line: { type: "none" } });
    s.addText(ph[0], { x: 0.6, y, w: 1.7, h: 0.85, fontFace: "Calibri", fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
    s.addText(ph[1], { x: 2.5, y: y + 0.08, w: 3.0, h: 0.7, fontFace: "Cambria", fontSize: 14, bold: true, color: WHITE, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(ph[2], { x: 5.6, y: y + 0.08, w: 7.1, h: 0.7, fontFace: "Calibri", fontSize: 11, color: ICE, isTextBox: true, margin: 0, valign: "middle", lineSpacing: 14 });
    y += 1.0;
  });
  pageNum(s, 4, true);
}

deck.writeFile({ fileName: "BEMS_BS6_Proposal_SOW.pptx" }).then(() => console.log("done"));
