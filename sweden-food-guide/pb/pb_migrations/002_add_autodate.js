// sweden-food-guide/pb/pb_migrations/002_add_autodate.js
// Base collections in PocketBase 0.25 do NOT auto-create created/updated.
// The frontend sorts by `-created`, which 400s without these fields.
// Both community_spot and spot_vote need them.
migrate((app) => {
  for (const name of ["community_spot", "spot_vote"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.add(new Field({
      type: "autodate", name: "created", onCreate: true, onUpdate: false, system: false, hidden: false, presentable: false,
    }));
    collection.fields.add(new Field({
      type: "autodate", name: "updated", onCreate: true, onUpdate: true, system: false, hidden: false, presentable: false,
    }));
    app.save(collection);
  }
}, (app) => {
  for (const name of ["community_spot", "spot_vote"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.removeByName("created");
    collection.fields.removeByName("updated");
    app.save(collection);
  }
});
