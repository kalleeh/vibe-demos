// intake-companion/pb/pb_migrations/001_init_case_brief.js
//
// Anonymized shared case corpus for the 한방 intake demo. PURE DEMO DATA —
// no real patients, no identifying free text. Each row is a de-identified
// snapshot of one generated brief: the 변증 pattern, the 처방 formula, the
// 경혈 points (comma-joined), and a short generic chief-complaint label.
//
// Tier 1 public: anyone reads, anyone writes, nobody edits/deletes.
// player_id is an anonymous UUID used only to mark "your own" cases in the
// browser — it is NOT access control (rules are public).
migrate((app) => {
  let collection = new Collection({
    type: "base",
    name: "case_brief",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: null,
    deleteRule: null,
    fields: [
      // 변증 — the named pattern, e.g. "비양허 · 심비양허"
      { type: "text", name: "pattern", required: true, max: 120 },
      // 처방 — the formula name, e.g. "보중익기탕"
      { type: "text", name: "prescription", required: true, max: 120 },
      // 경혈 — acupoints, comma-joined, e.g. "ST 36 족삼리, SP 6 삼음교, …"
      { type: "text", name: "points", max: 200 },
      // Short generic chief-complaint label (demo only), e.g. "불면 · 수족냉증"
      { type: "text", name: "chief_complaint", max: 80 },
      // Anonymous UUID — highlights "your own" cases, NOT auth.
      { type: "text", name: "player_id" },
    ],
  });
  app.save(collection);
}, (app) => {
  let collection = app.findCollectionByNameOrId("case_brief");
  app.delete(collection);
});
