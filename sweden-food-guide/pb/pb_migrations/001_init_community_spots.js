// sweden-food-guide/pb/pb_migrations/001_init_community_spots.js
//
// Community spots layer (Tier 1, public). Two create-only collections:
//   community_spot — a traveller-submitted place (name + city + one-line note)
//   spot_vote      — one row per upvote ("실제로 가봤어요"); votes are counted
//                    client-side, so no update rule is ever needed and votes
//                    can't be tampered with via updates.
migrate((app) => {
  let spot = new Collection({
    type: "base",
    name: "community_spot",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "name", required: true, max: 60 },
      { type: "text", name: "city", required: true, max: 20 },
      { type: "text", name: "note", max: 120 },
      { type: "text", name: "player_id" },
    ],
  });
  app.save(spot);

  let vote = new Collection({
    type: "base",
    name: "spot_vote",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "spot", required: true },
      { type: "text", name: "player_id", required: true },
    ],
  });
  app.save(vote);
}, (app) => {
  let vote = app.findCollectionByNameOrId("spot_vote");
  app.delete(vote);
  let spot = app.findCollectionByNameOrId("community_spot");
  app.delete(spot);
});
