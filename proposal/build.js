const pptxgen = require("pptxgenjs");

const NAVY = "1E2761";
const ICE = "CADCFC";
const WHITE = "FFFFFF";
const INK = "1B1F3B";
const MUTED = "5B6180";
const CARD = "F4F6FC";

function newDeck() {
  const p = new pptxgen();
  p.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
  return p;
}

function darkSlide(p) {
  const s = p.addSlide();
  s.background = { color: NAVY };
  return s;
}

function lightSlide(p) {
  const s = p.addSlide();
  s.background = { color: WHITE };
  return s;
}

function kicker(s, text, opts = {}) {
  s.addText(text.toUpperCase(), {
    x: opts.x ?? 0.6, y: opts.y ?? 0.45, w: opts.w ?? 8, h: 0.35,
    fontFace: "Calibri", fontSize: 12, bold: true, color: opts.color ?? "6B7CC7",
    charSpacing: 2, isTextBox: true, margin: 0,
  });
}

function title(s, text, opts = {}) {
  s.addText(text, {
    x: opts.x ?? 0.6, y: opts.y ?? 0.78, w: opts.w ?? 11.8, h: opts.h ?? 0.9,
    fontFace: "Cambria", fontSize: opts.size ?? 30, bold: true,
    color: opts.color ?? INK, isTextBox: true, margin: 0,
  });
}

function pageNum(s, n, dark) {
  s.addText(String(n), {
    x: 12.7, y: 7.05, w: 0.5, h: 0.3, fontFace: "Calibri", fontSize: 10,
    color: dark ? "8B95C9" : "A6ADC6", align: "right", isTextBox: true, margin: 0,
  });
}

const deck = newDeck();

// ---------- Slide 1: Title ----------
{
  const s = darkSlide(deck);
  s.addText("BEMS AI & INTELLIGENT AUTOMATION", {
    x: 0.9, y: 2.3, w: 11.5, h: 0.4, fontFace: "Calibri", fontSize: 14, bold: true,
    color: "8B95C9", charSpacing: 3, isTextBox: true, margin: 0,
  });
  s.addText("Delivery Approach & Technical Roadmap", {
    x: 0.9, y: 2.75, w: 11.5, h: 1.3, fontFace: "Cambria", fontSize: 40, bold: true,
    color: WHITE, isTextBox: true, margin: 0,
  });
  s.addText("How we propose to build, govern and deliver the AI capabilities required under\nSection 40.1.3.5 of the MCMC BEMS Technical Tender.", {
    x: 0.9, y: 3.95, w: 10.5, h: 0.9, fontFace: "Calibri", fontSize: 15,
    color: ICE, isTextBox: true, margin: 0, lineSpacing: 22,
  });
  s.addShape(deck.ShapeType.rect, { x: 0.9, y: 5.15, w: 1.6, h: 0.05, fill: { color: "6B7CC7" } });
  s.addText("Internal Proposal Review  |  Prepared for Management", {
    x: 0.9, y: 6.6, w: 8, h: 0.4, fontFace: "Calibri", fontSize: 11,
    color: "6B7CC7", isTextBox: true, margin: 0,
  });
}

// ---------- Slide 2: Why this matters / positioning ----------
{
  const s = lightSlide(deck);
  kicker(s, "Context");
  title(s, "From Tender Requirements to a Deliverable Product");
  s.addText(
    "The tender specifies seven AI capabilities (40.1.3.5a–g) as mandatory or value-added scope. " +
    "Our approach is to map each requirement to a concrete, demonstrable capability — built on " +
    "the existing BEMS platform — rather than a generic AI add-on.",
    { x: 0.6, y: 1.75, w: 7.2, h: 1.6, fontFace: "Calibri", fontSize: 14.5, color: MUTED, isTextBox: true, margin: 0, lineSpacing: 22 }
  );

  const principles = [
    ["Deterministic core", "Financial calculations and compliance rules stay in rules engines and services — never inferred by a model."],
    ["AI as an interpretation layer", "Forecasting, anomaly explanation, recommendations and narrative sit on top of governed data, not in place of it."],
    ["Data sovereignty by design", "All application data and AI inference stay on-premises, per Section 41.2.1 — no external model APIs in the critical path."],
  ];
  let y = 1.75;
  principles.forEach((pr) => {
    s.addShape(deck.ShapeType.roundRect, { x: 8.1, y, w: 4.6, h: 1.55, rectRadius: 0.08, fill: { color: CARD }, line: { type: "none" } });
    s.addText(pr[0], { x: 8.4, y: y + 0.15, w: 4.0, h: 0.35, fontFace: "Calibri", fontSize: 14, bold: true, color: NAVY, isTextBox: true, margin: 0 });
    s.addText(pr[1], { x: 8.4, y: y + 0.55, w: 4.0, h: 0.9, fontFace: "Calibri", fontSize: 11.5, color: MUTED, isTextBox: true, margin: 0, lineSpacing: 15 });
    y += 1.75;
  });
  pageNum(s, 2, false);
}

// ---------- Slide 3: Capability map (7 requirements -> delivery approach) ----------
{
  const s = lightSlide(deck);
  kicker(s, "Scope");
  title(s, "Seven Requirements, Seven Delivery Work Packages");

  const rows = [
    ["A. Predict", "40.1.3.5a", "Forecasting & scenario modelling", "Time-series ML + explainability"],
    ["B. Detect", "40.1.3.5b", "Anomaly detection & alerts", "Statistical models + rules + dashboard"],
    ["C. Recommend", "40.1.3.5c", "Budget adjustment suggestions", "Recommendation engine + evidence trail"],
    ["D. Converse", "40.1.3.5d", "Natural-language assistant", "Governed retrieval, role-aware access"],
    ["E. Automate", "40.1.3.5e", "Consolidation & reporting", "Event-driven pipeline + scheduler"],
    ["F. Govern", "40.1.3.5f", "AI Compliance Advisor", "Rules engine + AI explanation layer"],
    ["G. Report", "40.1.3.5g", "Bilingual BM/EN reporting", "Terminology control + templated generation"],
  ];

  const startY = 1.85;
  const rowH = 0.62;
  const colX = [0.6, 2.15, 3.55, 8.55];
  const colW = [1.45, 1.3, 4.7, 4.1];
  const headers = ["Package", "Ref.", "Requirement", "Approach"];
  headers.forEach((h, i) => {
    s.addText(h, { x: colX[i], y: startY - 0.4, w: colW[i], h: 0.35, fontFace: "Calibri", fontSize: 11, bold: true, color: NAVY, isTextBox: true, margin: 0 });
  });
  s.addShape(deck.ShapeType.line, { x: 0.6, y: startY - 0.05, w: 12.1, h: 0, line: { color: "D8DCEE", width: 1 } });

  rows.forEach((r, i) => {
    const y = startY + i * rowH;
    if (i % 2 === 1) {
      s.addShape(deck.ShapeType.rect, { x: 0.6, y, w: 12.1, h: rowH, fill: { color: CARD }, line: { type: "none" } });
    }
    s.addText(r[0], { x: colX[0], y: y + 0.08, w: colW[0], h: 0.45, fontFace: "Calibri", fontSize: 12.5, bold: true, color: INK, isTextBox: true, margin: 0.05 });
    s.addText(r[1], { x: colX[1], y: y + 0.08, w: colW[1], h: 0.45, fontFace: "Calibri", fontSize: 11, color: MUTED, isTextBox: true, margin: 0.05 });
    s.addText(r[2], { x: colX[2], y: y + 0.08, w: colW[2], h: 0.45, fontFace: "Calibri", fontSize: 12, color: INK, isTextBox: true, margin: 0.05 });
    s.addText(r[3], { x: colX[3], y: y + 0.08, w: colW[3], h: 0.45, fontFace: "Calibri", fontSize: 11.5, color: MUTED, isTextBox: true, margin: 0.05 });
  });
  pageNum(s, 3, false);
}

// ---------- Slide 4: Architecture ----------
{
  const s = darkSlide(deck);
  kicker(s, "Architecture", { color: "8B95C9" });
  title(s, "A Governed AI Layer Over the Existing BEMS Platform", { color: WHITE });
  s.addText(
    "AI operates as a service layer over BEMS data and APIs — it never bypasses the deterministic " +
    "rules, workflow and approval logic that already governs financial control.",
    { x: 0.6, y: 1.65, w: 11.8, h: 0.6, fontFace: "Calibri", fontSize: 13, color: ICE, isTextBox: true, margin: 0 }
  );

  const layers = [
    ["BEMS UI", "React / portal / dashboards"],
    ["BEMS Services", "Java / Spring Boot REST APIs"],
    ["AI Services", "Forecasting · anomaly · recommendations · NLP · compliance advisor · bilingual reports"],
    ["Rules + Workflow", "LOA · compliance rules · approvals · event-driven automation"],
    ["Enterprise Data (on-prem)", "Budget · Actual · PR/PO · HR · COA · historical"],
  ];
  let y = 2.55;
  const h = 0.78;
  layers.forEach((l, i) => {
    const isAI = i === 2;
    s.addShape(deck.ShapeType.roundRect, {
      x: 1.4, y, w: 10.5, h, rectRadius: 0.06,
      fill: { color: isAI ? "2D3A8C" : "273080" }, line: { color: "42509E", width: 1 },
    });
    s.addText(l[0], { x: 1.7, y: y + 0.1, w: 3.0, h: h - 0.2, fontFace: "Calibri", fontSize: 13.5, bold: true, color: WHITE, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(l[1], { x: 4.8, y: y + 0.1, w: 6.9, h: h - 0.2, fontFace: "Calibri", fontSize: 11.5, color: ICE, isTextBox: true, margin: 0, valign: "middle" });
    if (i < layers.length - 1) {
      s.addText("↓", { x: 6.5, y: y + h - 0.03, w: 0.4, h: 0.3, fontFace: "Calibri", fontSize: 14, color: "6B7CC7", isTextBox: true, margin: 0, align: "center" });
    }
    y += h + 0.16;
  });
  pageNum(s, 4, true);
}

// ---------- Slide 5: Data sovereignty / model hosting ----------
{
  const s = lightSlide(deck);
  kicker(s, "Compliance Constraint");
  title(s, "On-Premises AI: No External Model APIs in Scope");
  s.addText(
    "Section 41.2.1 requires application data to remain on-premises. This shapes our model-hosting " +
    "decision from the outset — not as an afterthought.",
    { x: 0.6, y: 1.7, w: 11.8, h: 0.6, fontFace: "Calibri", fontSize: 13.5, color: MUTED, isTextBox: true, margin: 0 }
  );

  const cols = [
    ["Language model", "Self-hosted open-weight model (e.g. Llama 3.3 / Qwen2.5) served via vLLM or TGI on internal GPU infrastructure. No data leaves the network."],
    ["Retrieval layer", "pgvector or an internal vector store indexing governed BEMS data only, with role-aware filtering before anything reaches the model."],
    ["Everything else", "Forecasting, anomaly detection and compliance rules run as conventional ML/rules services — no LLM dependency, no external call, full determinism."],
  ];
  cols.forEach((c, i) => {
    const x = 0.6 + i * 4.1;
    s.addShape(deck.ShapeType.roundRect, { x, y: 2.6, w: 3.8, h: 3.6, rectRadius: 0.08, fill: { color: CARD }, line: { type: "none" } });
    s.addText(c[0], { x: x + 0.3, y: 2.85, w: 3.2, h: 0.5, fontFace: "Calibri", fontSize: 15, bold: true, color: NAVY, isTextBox: true, margin: 0 });
    s.addText(c[1], { x: x + 0.3, y: 3.4, w: 3.2, h: 2.6, fontFace: "Calibri", fontSize: 12, color: MUTED, isTextBox: true, margin: 0, lineSpacing: 17 });
  });
  pageNum(s, 5, false);
}

// ---------- Slide 6: Governance pattern (compliance advisor detail) ----------
{
  const s = lightSlide(deck);
  kicker(s, "Governance Pattern");
  title(s, "Rules Decide. AI Explains. A Human Approves.");
  s.addText(
    "The same three-stage pattern applies across anomaly detection, compliance advisory and recommendations — " +
    "it is the core mechanism that keeps AI output auditable and safe to act on.",
    { x: 0.6, y: 1.7, w: 11.8, h: 0.7, fontFace: "Calibri", fontSize: 13.5, color: MUTED, isTextBox: true, margin: 0 }
  );

  const stages = [
    ["1", "Deterministic Rules Engine", "Evaluates budget data against MCMC compliance rules, LOA thresholds and approval requirements. Produces a factual result — pass, fail, or flag."],
    ["2", "AI Explanation Layer", "Turns the rule result into plain-language explanation and prioritisation: what triggered, why it matters, what evidence supports it."],
    ["3", "Human Approver", "Makes the final decision wherever policy or authority requires it. AI output is advisory — it never executes a financial action on its own."],
  ];
  let x = 0.6;
  stages.forEach((st) => {
    s.addShape(deck.ShapeType.roundRect, { x, y: 2.7, w: 3.9, h: 0.7, rectRadius: 0.35, fill: { color: NAVY }, line: { type: "none" } });
    s.addText(st[0], { x, y: 2.7, w: 3.9, h: 0.7, fontFace: "Cambria", fontSize: 16, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
    s.addText(st[1], { x, y: 3.55, w: 3.9, h: 0.5, fontFace: "Calibri", fontSize: 13.5, bold: true, color: INK, isTextBox: true, margin: 0 });
    s.addText(st[2], { x, y: 4.05, w: 3.9, h: 1.9, fontFace: "Calibri", fontSize: 11.5, color: MUTED, isTextBox: true, margin: 0, lineSpacing: 16 });
    x += 4.15;
  });
  pageNum(s, 6, false);
}

// ---------- Slide 7: Delivery roadmap ----------
{
  const s = darkSlide(deck);
  kicker(s, "Roadmap", { color: "8B95C9" });
  title(s, "Phased Delivery, Not a Big-Bang Release", { color: WHITE });

  const phases = [
    ["Phase 1", "Foundation", "On-prem model hosting · data pipeline (Kafka) · rules engine for compliance · audit logging"],
    ["Phase 2", "Core Capabilities", "Forecasting · anomaly detection · automation of consolidation & reporting"],
    ["Phase 3", "Governed Intelligence", "Compliance Advisor · recommendation engine · evidence trail on every suggestion"],
    ["Phase 4", "Conversational & Bilingual", "NLP assistant with role-aware retrieval · BM/EN report generation · terminology controls"],
  ];
  let y = 2.15;
  phases.forEach((ph, i) => {
    s.addShape(deck.ShapeType.roundRect, { x: 0.7, y, w: 1.9, h: 1.05, rectRadius: 0.06, fill: { color: "2D3A8C" }, line: { type: "none" } });
    s.addText(ph[0], { x: 0.7, y: y + 0.1, w: 1.9, h: 0.35, fontFace: "Calibri", fontSize: 11, bold: true, color: "8B95C9", align: "center", isTextBox: true, margin: 0 });
    s.addText(ph[1], { x: 0.7, y: y + 0.42, w: 1.9, h: 0.5, fontFace: "Cambria", fontSize: 14, bold: true, color: WHITE, align: "center", isTextBox: true, margin: 0 });
    s.addText(ph[2], { x: 2.85, y: y + 0.12, w: 9.7, h: 0.85, fontFace: "Calibri", fontSize: 12.5, color: ICE, isTextBox: true, margin: 0, valign: "middle", lineSpacing: 17 });
    y += 1.2;
  });
  pageNum(s, 7, true);
}

// ---------- Slide 8: Why RBTSB / positioning close ----------
{
  const s = lightSlide(deck);
  kicker(s, "Fit");
  title(s, "Built on Stack We Already Operate");
  const items = [
    ["Java / Spring Boot backend", "Matches the existing BEMS services layer — no platform migration risk."],
    ["Keycloak-secured APIs", "Role-aware access control, already proven on our current delivery stack."],
    ["Audited, event-driven pipelines", "Kafka + full audit trail pattern we run in production today."],
    ["Data & analytics bench", "Existing Pentaho/Elastic experience covers the BI and reporting layer directly."],
  ];
  let y = 1.9;
  items.forEach((it) => {
    s.addShape(deck.ShapeType.roundRect, { x: 0.6, y, w: 0.35, h: 0.35, rectRadius: 0.35, fill: { color: NAVY }, line: { type: "none" } });
    s.addText("✓", { x: 0.6, y, w: 0.35, h: 0.35, fontFace: "Calibri", fontSize: 14, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
    s.addText(it[0], { x: 1.15, y: y - 0.05, w: 4.6, h: 0.45, fontFace: "Calibri", fontSize: 14, bold: true, color: INK, isTextBox: true, margin: 0 });
    s.addText(it[1], { x: 5.9, y: y - 0.05, w: 6.8, h: 0.5, fontFace: "Calibri", fontSize: 12.5, color: MUTED, isTextBox: true, margin: 0, valign: "top" });
    y += 0.85;
  });
  pageNum(s, 8, false);
}

// ---------- Slide 9: Closing / ask ----------
{
  const s = darkSlide(deck);
  s.addText("Next Step", { x: 0.9, y: 2.5, w: 8, h: 0.4, fontFace: "Calibri", fontSize: 13, bold: true, color: "8B95C9", charSpacing: 2, isTextBox: true, margin: 0 });
  s.addText("Approve the Phased Approach\nto Begin Foundation Work", {
    x: 0.9, y: 2.95, w: 10.8, h: 1.7, fontFace: "Cambria", fontSize: 32, bold: true, color: WHITE, isTextBox: true, margin: 0, lineSpacing: 40,
  });
  s.addText(
    "Same BEMS platform. Measurable AI capabilities. Governed implementation. Auditable results.",
    { x: 0.9, y: 4.7, w: 10, h: 0.5, fontFace: "Calibri", fontSize: 14, italic: true, color: ICE, isTextBox: true, margin: 0 }
  );
  s.addShape(deck.ShapeType.rect, { x: 0.9, y: 5.35, w: 1.6, h: 0.05, fill: { color: "6B7CC7" } });
  pageNum(s, 9, true);
}

deck.writeFile({ fileName: "BEMS_AI_Delivery_Proposal.pptx" }).then(() => console.log("done"));
