/* clinic-admin — English strings for the shared-entities layer (same keys as ko.entities.js; tools/i18n-extract.mjs
   fails on drift). Same style as en.js: translate meaning, keep the Korean domain term as a parenthesised gloss where
   it matters, leave sample names / codes / numbers as they are. */
export default {
  /* ── Institution profile (core/entities.js Org · core/org-form.js) ── */
  "org.eyebrow": "Institution · one-time setup",
  "org.stepTitle": "Which <em>institution</em> is this admin office for?",
  "org.stepNote": "Name, HIRA institution code (요양기관기호), business registration number, type and representative go into the header of the non-covered report, the year-end tax data and the auto-insurance settlement sheets. You can skip this now — the institution chip in the top bar and ⓘ Info let you fill it in any time. For a demo, “Tour with sample data” fills in 한솔한방병원.",
  "org.f.name": "Institution name", "org.f.ykiho": "HIRA institution code (8 digits)", "org.f.biz": "Business registration no.", "org.f.kind": "Type", "org.f.rep": "Representative",
  "org.phName": "e.g. 한솔한방병원", "org.phYkiho": "11000123", "org.phBiz": "123-45-67890", "org.phRep": "e.g. 윤지훈",
  "org.kind.병원": "Hospital (한방병원)", "org.kind.의원": "Clinic (한의원)",
  "org.skipBtn": "Fill in later", "org.statusComplete": "Complete", "org.statusIncomplete": "Some fields empty",
  "org.errYkiho": "The HIRA institution code is 8 digits", "org.errBiz": "The business registration number is 000-00-00000",
  "org.logSaved": "Institution profile saved", "org.savedToast": "Institution profile saved — {name}", "org.msgSaved": "Saved",
  "org.unsetChip": "Institution not set", "org.chipTitle": "Institution profile — {kind} · representative {rep} (click to edit)", "org.chipTitleIncomplete": "The institution profile is empty — click to fill it in (used in every report/export header)",
  "org.col.name": "Institution", "org.col.ykiho": "HIRA institution code", "org.col.biz": "Business reg. no.", "org.col.kind": "Type", "org.col.rep": "Representative",
  "shell.infoOrgH": "Institution", "shell.infoOrgNote": "Institution details that go into the header of every report and export (stored in this browser only · not personal data).",

  /* ── Pseudonymous patients (Patients) · intake board ── */
  "entities.patientAlias": "Patient {ref}",
  "board.newPatient": "+ New pseudonymous patient (P-YYYY-NNNN generated)",

  /* ── Staff roster + logins (Staff · tab 08) ── */
  "license.loginH": "Issue login", "license.loginRoleLabel": "System role", "license.loginOk": "Issue",
  "license.loginNote": "The “Director” role can manage users and PINs, export the activity log and destroy everything. The PIN is never stored — it only wraps the master key.",
  "license.loginWho": "Issuing a workspace login to {name} ({job})",
  "license.issueLogin": "Issue login", "license.revokeLogin": "Revoke login", "license.noLogin": "No login",
  "license.ownerTag": "Director rights", "license.loginTag": "Login · {role}", "license.loginTagTitle": "This person can unlock the workspace with their own PIN", "license.meTag": "me",
  "license.logLoginIssued": "Login issued ({role})", "license.loginIssuedToast": "Login issued — {who} · {role}",
  "license.confirmRevoke": "Revoke the login of {who}? That PIN will no longer open the workspace. The roster row stays.",
  "license.logLoginRevoked": "Login revoked", "license.loginRevokedToast": "Login revoked — {who}",
  "license.errHasLogin": "This person has a login — revoke it first.",

  /* ── Users panel (view over Staff logins) ── */
  "users.ownerTag": "Director rights", "users.revokeLogin": "Revoke login",
  "users.addNoteOwner": "A name already in the roster is linked to that row; otherwise a new row is added (job by role: KM doctor · admin · front desk).",
  "users.confirmRevokeLogin": "Revoke the login of {name} ({role})? That PIN will no longer open the workspace. The roster row stays.",
  "users.logRevokeLogin": "Login revoked ({role})", "users.msgLoginRevoked": "Login revoked",
  "users.rosterNote": "A login is linked to one row of the staff roster (08) — job and licence live there, the PIN here.", "users.openRoster": "Open roster →",

  /* ── seed · lifecycle ── */
  "shell.logSeedEntities": "Sample institution data — {n} staff · {l} logins · {p} pseudonymous patients",
  "shell.seededLogins": "Sample logins (윤지훈 · 정수아 · 한지우) use PIN {pin}.",
  "lifecycle.restoreMigrated": "v{v} backup — institution, roster and tariff moved to the new structure"
};
