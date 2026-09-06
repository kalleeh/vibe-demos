// clinic-admin/pb/pb_migrations/003_field_limits.js
//
// Tighten field constraints on intake_card. The board is a PUBLIC demo with
// open create/update rules (see 001), so the server — not just the UI — has to
// refuse anything that could carry a real name or long free text. The frontend
// now offers patient_name only as a <select> of fixed fictional names; this
// migration mirrors that list as a server-side pattern so the API cannot be
// used to publish arbitrary names either.
//
//   patient_name  → max 20, must match one of the fixed fictional names
//   status        → 대기 | 진료중 | 완료 only
//   summary       → max 120 (was 200)
//   player_id     → max 64 (was unbounded)
//
// deployed 2026-09-05 via sync-backends.sh
// seed names in index.html (김민서·이준호·박서연·정우진) are in the allow-list,
// so existing seed rows stay valid.
const FICTIONAL_NAMES = ["예시 환자", "김민서", "이준호", "박서연", "정우진", "최하은", "강도윤", "윤지아", "임시우"];

migrate((app) => {
  const collection = app.findCollectionByNameOrId("intake_card");

  const name = collection.fields.getByName("patient_name");
  name.max = 20;
  name.pattern = "^(" + FICTIONAL_NAMES.join("|") + ")$";

  const status = collection.fields.getByName("status");
  status.pattern = "^(대기|진료중|완료)$";

  const summary = collection.fields.getByName("summary");
  summary.max = 120;

  const pid = collection.fields.getByName("player_id");
  pid.max = 64;

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("intake_card");

  const name = collection.fields.getByName("patient_name");
  name.max = 40;
  name.pattern = "";

  const status = collection.fields.getByName("status");
  status.pattern = "";

  const summary = collection.fields.getByName("summary");
  summary.max = 200;

  const pid = collection.fields.getByName("player_id");
  pid.max = 0;

  app.save(collection);
});
