/* clinic-admin — English strings for the Phase-2 information architecture (areas · sub-nav · overlay · drawer · home ·
   claims landing · new panels). Same keys as ko.ia.js; merged after en.reporting.js. Style as en.js: translate meaning,
   keep the Korean domain term as a parenthesised gloss where it matters, statutory references untouched. */
export default {
  /* ── areas · navigation chrome ── */
  "nav.area.home": "Home", "nav.area.patients": "Patients", "nav.area.claims": "Claims", "nav.area.records": "Reports & records", "nav.area.org": "Organisation",
  "nav.board": "Intake board", "nav.claims": "Claim batch", "nav.org": "Institution profile", "nav.privacy": "Data processing", "nav.masters": "Master upload",
  "shell.areasAria": "Areas", "shell.subnavAria": "Sub-menu", "shell.moreBtn": "More",
  "shell.railAi": "✦ AI coding assist", "shell.aiWord": "AI",
  "shell.aiBtnTitle": "AI coding assist — a right-side drawer on every screen (also from ⌘K)",
  "shell.pal.utility": "Utility", "shell.pal.ai": "Open AI coding assist", "shell.pal.aiMeta": "Clinical note → draft diagnosis / procedure codes (drawer)",
  "shell.pal.info": "About · sources", "shell.pal.infoMeta": "Source links · version · institution summary",

  /* ── global search overlay ── */
  "search.overlayAria": "Search · go · commands",
  "search.overlayPlaceholder": "Go · command · code — low back pain, S13.4, ㅇㅈ, lock…",
  "search.navH": "Go · commands",
  "search.codesH": "Codes — diagnosis · procedures & fees · non-covered",
  "search.demoBtn": "Sample query: “요통”",
  "search.shownMax": "first {n} shown (the XLSX has all)",

  /* ── Home (task-first) ── */
  "home.todoH": "To do now", "home.numbersH": "This month in numbers", "home.recentH": "Recent work", "home.deadlinesH": "Upcoming deadlines · all", "home.activityH": "Activity",
  "home.todo.empty": "Nothing to do right now — no deadline within 30 days and no open claim step.",
  "home.todo.count": "{n}", "home.todo.open": "Open", "home.todo.step": "Claims", "home.todo.resume": "Resume", "home.todo.resumeBtn": "Resume",
  "home.todo.manualCase": "Manual auto-insurance case in progress — {who}",

  /* ── Patients › intake board panel ── */
  "board.num": "Patients · Intake board",
  "board.h3": "Today’s <em>waiting · in treatment · done</em>, on one board",
  "board.badgeLive": "PocketBase realtime · E2E encrypted", "board.badge": "Pseudonymous patients only · no real names",
  "board.blurb": "The front-desk whiteboard, moved here — pick a pseudonymous patient, add a one-line note, and the card appears <em>instantly on every device and tab</em>. Card contents are <em>end-to-end encrypted</em> with this workspace key; the server only ever sees ciphertext. Payment guarantees, issued-document ledger and non-covered consent join this area in the next phase.",

  /* ── Claims › claim batch landing ── */
  "claims.num": "Claims · Claim batch",
  "claims.h3": "Upload the statements once, finish in <em>three steps</em>",
  "claims.badgeLaw": "Auto-insurance fee schedule · HIRA (심평원) auto-insurance review", "claims.badgeLive": "Diagnosis codes → review reconciliation → appeals",
  "claims.blurb": "The <em>claim batch</em> is the unit — one claim-statement export from the EMR becomes the batch that both diagnosis-code cleanup and review reconciliation work on, and HIRA’s review-result file is linked to it. Upload both files here and just read <em>how far you are</em> in the three steps below. Appeals arrive in the next phase.",
  "claims.uploadH": "Upload — claim statements · review results",
  "claims.dropClaims": "Claim statement export", "claims.dropClaimsHint": "Statement no. · patient no. · visit date · diagnosis code · procedure code · claimed amount — becomes a new claim batch",
  "claims.dropReview": "HIRA review-result file", "claims.dropReviewHint": "Statement no. · procedure code · approved amount · adjustment reason — linked to the current batch",
  "claims.caveat": "※ Uploading the same file in <strong>Diagnosis codes</strong> or <strong>Review reconciliation</strong> creates the same batch. Batches are encrypted in the browser and kept 90 days · up to 20 (Organisation › Data processing).",
  "claims.stepsH": "Progress — current batch",
  "claims.statusClaims": "{src} — {n} statements read as a new claim batch. Start with the diagnosis codes.",
  "claims.statusReview": "{src} — {n} review lines linked to the current batch. The reconciliation refreshes.",
  "claims.card.empty": "No claim batch yet — upload a claim-statement export on the left and the batch summary and progress appear here.",
  "claims.card.noReview": "No review results",
  "claims.card.stmts": "Statements", "claims.card.patients": "Patients", "claims.card.kcdLines": "Diagnosis lines", "claims.card.itemLines": "Procedure lines", "claims.card.created": "Uploaded", "claims.card.batches": "Batches kept",
  "claims.step.kcd": "Diagnosis code cleanup", "claims.step.noBatch": "Upload a claim batch first",
  "claims.step.kcdNoSide": "This batch has no diagnosis columns (procedures only)",
  "claims.step.kcdTodo": "{n} diagnosis lines — not cleaned yet", "claims.step.kcdDone": "{n} reviewed · {m} not listed / invalid · {r} to review",
  "claims.step.kcdBtn": "Start cleanup", "claims.step.kcdOpen": "Open diagnosis codes",
  "claims.step.recon": "Review reconciliation", "claims.step.reconNoSide": "This batch has no procedure columns (diagnoses only)",
  "claims.step.reconNeed": "No HIRA review-result file yet — upload it and every statement and procedure is reconciled",
  "claims.step.reconTodo": "{n} review lines linked — check the reconciliation table", "claims.step.reconDone": "Adjusted {cut} · rate {rate}%",
  "claims.step.reconUpload": "Upload review results", "claims.step.reconBtn": "View reconciliation", "claims.step.reconOpen": "Open reconciliation",
  "claims.step.appeal": "Appeals", "claims.step.appealSoon": "Next phase — an appeal tracker per adjusted line plugs in here", "claims.step.appealBtn": "Coming next",
  "claims.state.idle": "waiting", "claims.state.todo": "to do", "claims.state.need": "file needed", "claims.state.done": "done", "claims.state.soon": "next phase",
  "jabo.batch.open": "Claim batch →",

  /* ── Organisation › institution profile panel ── */
  "org.num": "Organisation · Institution profile",
  "org.h3": "Which <em>institution</em> is this admin office?",
  "org.badgeLaw": "Medical Service Act §45-2 · Income Tax Act §165 file headers", "org.badge": "Stored in this browser only · not personal data",
  "org.blurb": "Name, institution code, business registration number, type and representative go straight into the headers of the <em>non-covered report</em>, the <em>year-end tax data</em> and the <em>auto-insurance settlement sheet</em>; the type (hospital · clinic) sets the non-covered reporting cadence and the deadline calendar. Enter it once and every screen reads the same profile.",
  "org.panelH": "Institution profile",
  "org.caveat": "※ Institution data is public business-registration information, <strong>not personal data</strong>, so it is stored in plain text (plain tier) — see the “Institution profile” row in Organisation › Data processing. In a demo, “Tour with sample data” fills in 한솔한방병원.",

  /* ── Organisation › data processing panel ── */
  "privacy.badgeLaw": "PIPA §29 · Medical Service Act §21", "privacy.badge": "AES-GCM · retention auto-purge · encrypted backup",

  /* ── Organisation › master upload panel ── */
  "masters.num": "Organisation · Master upload",
  "masters.h3": "The bundled tables are <em>samples</em> — upload the real masters and they become the reference",
  "masters.blurb": "The bundled diagnosis and procedure tables are <em>demo excerpts</em>. Upload the <em>KOICD diagnosis master</em> and the <em>HIRA (심평원) procedure & fee master</em> (xlsx) here, map the headers, and diagnosis cleanup, review reconciliation, search and the AI assist all work against the real masters. Public reference tables — kept in this browser (IndexedDB) only."
};
