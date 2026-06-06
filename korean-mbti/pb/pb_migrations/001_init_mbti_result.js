// korean-mbti/pb/pb_migrations/001_init_mbti_result.js
migrate((app) => {
  let collection = new Collection({
    type: "base",
    name: "mbti_result",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "type", required: true, max: 8 },
      { type: "text", name: "nickname", max: 40 },
      { type: "text", name: "player_id" },
    ],
  });
  app.save(collection);
}, (app) => {
  let collection = app.findCollectionByNameOrId("mbti_result");
  app.delete(collection);
});
