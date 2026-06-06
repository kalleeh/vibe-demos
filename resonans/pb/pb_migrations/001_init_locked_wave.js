// resonans/pb/pb_migrations/001_init_locked_wave.js
//
// A collective sketchbook of locked resonances — emphatically NOT a
// leaderboard. Each row is a small anonymous artifact of a standing wave
// someone inked in: the harmonic mode n, an amplitude flavour value, and an
// optional short note. No score, no ranking, no competitive field.
migrate((app) => {
  let collection = new Collection({
    type: "base",
    name: "locked_wave",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "number", name: "mode", required: true, min: 1, max: 5 },
      { type: "number", name: "amplitude" },
      { type: "text", name: "label", max: 40 },
      { type: "text", name: "player_id" },
    ],
  });
  app.save(collection);
}, (app) => {
  let collection = app.findCollectionByNameOrId("locked_wave");
  app.delete(collection);
});
