// clinic-admin/pb/pb_migrations/001_init_intake_card.js
//
// Live shared intake board — the realtime showcase for clinic-admin.
// PURE DEMO DATA: cards are fake sample patients. There is no real patient
// data in this collection and never will be (the frontend seeds it with
// fictional 환자 names and labels it "demo mode / sample data").
//
// Rules decision — permissive create + update (Tier 1-ish, demo board):
//   listRule / viewRule / createRule = "" (anyone reads + creates)
//   updateRule = ""   ← anyone can advance a card's status
//   deleteRule = ""   ← anyone can clear a demo card
//
// Why not the Tier 2 `player_id = @request.body.player_id` update rule?
// The whole point of this demo is a *shared* board where status advances
// (대기 → 진료중 → 완료) propagate live across devices/tabs. A nurse on
// device B must be able to advance a card that the front desk on device A
// created. Tier 2 would forbid that and break the realtime narrative.
// Because the data is entirely fictional demo seed (no real records, ever),
// open update/delete is the right tradeoff here — it makes the realtime
// sync demo work cleanly with zero ownership friction. `player_id` is still
// stored (anonymous UUID) purely to tag which device created a card so the
// UI can highlight "added by you"; it is NOT access control.
migrate((app) => {
  let collection = new Collection({
    type: "base",
    name: "intake_card",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { type: "text", name: "patient_name", required: true, max: 40 },
      { type: "text", name: "status", required: true, max: 12 }, // 대기 | 진료중 | 완료
      { type: "text", name: "summary", max: 200 },
      { type: "text", name: "player_id" }, // anonymous UUID — origin tag, not auth
    ],
  });
  app.save(collection);
}, (app) => {
  let collection = app.findCollectionByNameOrId("intake_card");
  app.delete(collection);
});
