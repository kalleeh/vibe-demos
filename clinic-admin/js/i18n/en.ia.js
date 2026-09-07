/* clinic-admin — English strings for the Phase-2 information architecture (areas · sub-nav · overlay · drawer · home ·
   claims landing · new panels). Same keys as ko.ia.js; merged after en.reporting.js. Style as en.js: translate meaning,
   keep the Korean domain term as a parenthesised gloss where it matters, statutory references untouched. */
export default {
  /* ── areas · navigation chrome ── */
  "nav.area.home": "Home", "nav.area.patients": "Patients", "nav.area.claims": "Claims", "nav.area.records": "Reports & records", "nav.area.org": "Organisation",
  "nav.board": "Intake board", "nav.claims": "Claim batch", "nav.org": "Institution profile", "nav.privacy": "Data processing", "nav.masters": "Master upload",
  "shell.areasAria": "Areas", "shell.subnavAria": "Sub-menu", "shell.moreBtn": "More",
  "shell.aiWord": "AI",
  "shell.aiBtnTitle": "AI assist — a right-side drawer on every screen (also from ⌘K)",
  "shell.pal.utility": "Utility", "shell.pal.ai": "Open AI assist", "shell.pal.aiMeta": "Clinical note → draft diagnosis / procedure codes (drawer)",
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
  "board.blurb": "The front-desk whiteboard, moved here — pick a pseudonymous patient, add a one-line note, and the card appears <em>instantly on every device and tab</em>. Card contents are <em>end-to-end encrypted</em> with this workspace key; the server only ever sees ciphertext. A card’s <em>⋯</em> menu opens that patient’s <em>auto-insurance guarantee</em>, <em>document issuance log</em> and <em>non-covered consent</em> directly — the three trackers are the other panels of this area.",

  /* ── Claims › claim batch landing (payer-aware head copy — claims.p3.* — and the payer cards live in en.claims2.js) ── */
  "claims.num": "Claims · Claim batch",

  "claims.dropClaims": "Claim statement export",
  "claims.dropReview": "HIRA review-result file", "claims.dropReviewHint": "Statement no. · procedure code · approved amount · adjustment reason — linked to the current batch",
  "claims.caveat": "※ Uploading the same file in <strong>Diagnosis codes</strong> or <strong>Auto-insurance reconciliation</strong> creates the same batch. Batches are encrypted in the browser and kept 90 days · up to 20 (Organisation › Data processing).",
  "claims.statusReview": "{src} — {n} review lines linked to the current batch. The reconciliation refreshes.",
  "claims.card.noReview": "No review results",
  "claims.card.stmts": "Statements", "claims.card.patients": "Patients", "claims.card.kcdLines": "Diagnosis lines", "claims.card.itemLines": "Procedure lines", "claims.card.created": "Uploaded",
  "claims.step.kcd": "Diagnosis code cleanup", "claims.step.noBatch": "Upload a claim batch first",
  "claims.step.kcdNoSide": "This batch has no diagnosis columns (procedures only)",
  "claims.step.kcdTodo": "{n} diagnosis lines — not cleaned yet", "claims.step.kcdDone": "{n} reviewed · {m} not listed / invalid · {r} to review",
  "claims.step.kcdBtn": "Start cleanup", "claims.step.kcdOpen": "Open diagnosis codes",
  "claims.step.recon": "Auto-insurance reconciliation", "claims.step.reconNoSide": "This batch has no procedure columns (diagnoses only)",
  "claims.step.reconNeed": "No HIRA review-result file yet — upload it and every statement and procedure is reconciled",
  "claims.step.reconTodo": "{n} review lines linked — check the reconciliation table", "claims.step.reconDone": "Adjusted {cut} · rate {rate}%",
  "claims.step.reconUpload": "Upload review results", "claims.step.reconBtn": "View reconciliation", "claims.step.reconOpen": "Open reconciliation",
  "claims.step.appeal": "Appeals",
  "claims.state.idle": "waiting", "claims.state.todo": "to do", "claims.state.need": "file needed", "claims.state.done": "done",
  "jabo.batch.open": "Claim batch →",

  /* ── Organisation › institution profile panel ── */
  "org.num": "Organisation · Institution profile",
  "org.h3": "Which <em>institution</em> is this admin office?",
  "org.badgeLaw": "Medical Service Act §45-2 · Income Tax Act §165 file headers", "org.badge": "Stored in this browser only · not personal data",
  "org.blurb": "Name, institution code, business registration number, type and representative go straight into the headers of the <em>non-covered report</em>, the <em>year-end tax data</em> and the <em>auto-insurance settlement sheet</em>; the type (hospital · clinic) sets the non-covered reporting cadence and the deadline calendar. Enter it once and every screen reads the same profile.",

  "org.caveat": "※ Institution data is public business-registration information, <strong>not personal data</strong>, so it is stored in plain text (plain tier) — see the “Institution profile” row in Organisation › Data processing. In a demo, “Tour with sample data” fills in 한솔한방병원.",

  /* ── Organisation › data processing panel ── */
  "privacy.badgeLaw": "PIPA §29 · Medical Service Act §21", "privacy.badge": "AES-GCM · retention auto-purge · encrypted backup",

  /* ── Organisation › master upload panel ── */
  "masters.num": "Organisation · Master upload",
  "masters.h3": "The bundled tables are <em>samples</em> — upload the real masters and they become the reference",
  "masters.blurb": "The bundled diagnosis and procedure tables are <em>demo excerpts</em>. Upload the <em>KOICD diagnosis master</em> and the <em>HIRA (심평원) procedure & fee master</em> (xlsx) here, map the headers, and diagnosis cleanup, reconciliation, search and the AI assist all work against the real masters. Public reference tables — kept in this browser (IndexedDB) only.",
  // Phase 3 slots (coordinator scaffold)
  "nav.guarantee": "Auto-insurance guarantees",
  "nav.docs": "Document issuance log",
  "nav.consent": "Non-covered consent",
  "nav.nhis": "NHIS reconciliation",
  "nav.appeal": "Appeals",
  "p3.guarantee.num": "Patients · Auto-insurance guarantees (자보 지불보증)",
  "p3.guarantee.h3": "Insurer <em>payment guarantees</em> and the phone/fax log in one place",
  "p3.docs.num": "Patients · Document issuance log (발급 대장)",
  "p3.docs.h3": "Certificates as a <em>statutory issuance log</em>",
  "p3.consent.num": "Patients · Non-covered consent (비급여 설명·동의)",
  "p3.consent.h3": "Records of <em>prior explanation and consent</em> for non-covered items",
  "p3.nhis.num": "Claims · NHIS reconciliation (건보 심사결과 대조)",
  "p3.nhis.h3": "Match the NHIS <em>review result</em> against the claim statements",
  "p3.appeal.num": "Claims · Appeals (이의신청)",
  "p3.appeal.h3": "<em>Appeals</em> for adjusted lines, with their deadlines",

  /* ── guided tour (js/tour.js) ── */
  "tour.n": "{i} / {n}", "tour.prev": "← Back", "tour.next": "Next →", "tour.done": "Done", "tour.seedBtn": "Fill with sample data", "tour.seeded": "Sample data is already in",
  "tour.seed.title": "Start with sample data", "tour.seed.body": "The fictional Hansol Korean Medicine Hospital — 7 staff, 5 pseudonymous patients, 2026-08 auto-insurance and NHIS claim batches with review results, 3 appeals, guarantees, an issuance log and consents — fills every screen in one go. Never enter real patient data anywhere.",
  "tour.todo.title": "Home · To do now", "tour.todo.body": "Start here every morning. Deadlines within 30 days, open claim steps, guarantees about to expire and overdue appeals, one line each — every line has one button that takes you there. “This month in numbers” below can be copied as a director’s summary.",
  "tour.claims.title": "Claims · Claim batch", "tour.claims.body": "One EMR statement export becomes a batch and is sorted into auto-insurance or NHIS by its payer column. Each batch’s three steps — diagnosis codes → reconciliation → appeals — show how far they have come, side by side, with one button per step.",
  "tour.recon.title": "Claims · Auto-insurance reconciliation", "tour.recon.body": "Claim statements and the HIRA (심평원) review results are matched line by line on statement no. + procedure code. Adjusted lines are grouped by reason and by month, and each can be handed on with “Prepare appeal”. NHIS works the same way in the neighbouring panel.",
  "tour.appeal.title": "Claims · Appeals", "tour.appeal.body": "Drafts handed over from adjusted lines form the register — enter the notice date and the deadline (+90 days, to be confirmed) attaches as a D-day; move the status preparing → submitted → result and print the draft letter. Overdue appeals also surface in Home’s to-do list.",
  "tour.patients.title": "Patients · the three trackers", "tour.patients.body": "Auto-insurance guarantees (insurer calls · expiry D-day), the document issuance log (statutory ledger · issuer check) and non-covered consent (priced from the price table) — all store only the pseudonymous patient number (****0142). The intake board’s card ⋯ menu opens them directly.",
  "tour.org.title": "Organisation · staff roster and the rest", "tour.org.body": "The roster computes licence renewal deadlines (3 years) and issues logins (PIN). The institution profile heads every report file, the accreditation self-check is auto-judged from the other screens, data processing shows per-item encryption · retention · erasure · backup, and master upload takes the KOICD / HIRA tables. That is the tour — use the left menu from here.",

  /* ── canonical panel flow ── */
  "flow.step1": "Sample · demo", "flow.step2": "Upload", "flow.step2entry": "Enter", "flow.step3": "Review", "flow.step4": "Download · next step",
  "flow.sample": "Download sample <span class=\"arrow\">↓</span>", "flow.sampleMaster": "Download sample master <span class=\"arrow\">↓</span>",
  "flow.demo": "<span class=\"play\">▶</span> Run demo",
  "flow.upload": "Drop an Excel / CSV file here, or click to upload", "flow.columns": "Show column names",
  "flow.review": "Reviewed", "flow.state.demo": "Demo run", "flow.state.saved": "Entered",
  "flow.export.xlsx": "Download XLSX <span class=\"arrow\">↓</span>", "flow.export.csv": "Download CSV <span class=\"arrow\">↓</span>",
  "flow.export.ics": "Download .ics <span class=\"arrow\">↓</span>", "flow.export.print": "Print <span class=\"arrow\">↗</span>",
  "flow.next": "Next step",
  "flow.emptyHint": "First time? ① Sample · demo — download the sample file or press “Run demo”.",
  "flow.emptyHintDemo": "First time? “Run demo” in ① Sample · demo fills in example records.",
  "flow.emptyHintManual": "First time? “Manual sample” in ② Upload fills an example case.",
  /* per-panel ① sentences · ④ captions */
  "claims.demoLabel": "<strong>Hansol KM Hospital 2026-08</strong> — 12 auto-insurance and 10 NHIS statements with their HIRA review results become two batches, and the three-step progress fills in side by side.",
  "claims.noExport": "The batch itself is not exported — results live on each step's screen", "claims.statusDemo": "Both payers' batches and review results are linked.",
  "guarantee.demoLabel": "<strong>Guarantees for two auto-insurance patients</strong> — an extension request expiring in five days (Samsung Fire) and an already expired one (DB Insurance), with five phone/fax log lines.",
  "docs.demoLabel": "<strong>Four issued documents</strong> — a January receipt re-issue (year-end hint), a certificate for an auto-insurance claim, an opinion letter picked up by a proxy (power of attorney · ID checked), a visit confirmation for an employer.",
  "consent.demoLabel": "<strong>Three consent records</strong> — 14 days of herbal decoction, pharmacopuncture outside the guarantee scope, and Chuna sessions over the limit turned non-covered (signature pending). Prices come from the non-covered price table.",
  "license.demoLabel": "<strong>Hansol KM Hospital's 7 staff</strong> — 2 KM doctors · nurse · physiotherapist · nursing assistant · admin · front desk. One row without a report date (unverified), one near its deadline, and 3 logins (PIN 000000).",
  "license.statusDemo": "{n} staff · {l} logins added — existing rows untouched.", "license.icsK": "Report · CME deadlines",
  "accred.demoLabel": "Ticks the <strong>nine basics</strong> a running KM hospital has (patient ID, emergency cart, rights posted, infection control, waste, oxygen, orientation…) — the auto-judged items judge themselves from the roster, the price table and the last checks.",
  "accred.checkH": "Tick the items", "accred.autoH": "Auto-judged summary", "accred.autoState": "Self-check", "accred.autoSummary": "auto-judged {ok}/{n} met · {p}% overall", "accred.printK": "Self-check sheet",
  "accred.logDemo": "Accreditation self-check demo — nine basics ticked",
  "masters.demoLabel": "Two sample master files — the bundled excerpt written in the <strong>KOICD diagnosis-master shape</strong> (상병기호 · 한글명 · 영문명 · 완전코드구분) and the <strong>HIRA procedure/fee-master shape</strong> (수가코드 · 한글명 · 단가 · 분류 · 급여구분 · 자보구분), to try the header mapping in ②. There is no sample master to run — the bundled tables are the demo.",
  "masters.sourceH": "Current reference tables", "masters.noExport": "Masters are reference tables — nothing to export. Diagnosis cleanup · reconciliation · search · the AI assist use the uploaded table directly",
  "masters.sampleKcdFile": "sample_master_KOICD_diagnoses.xlsx", "masters.sampleKcdSheet": "Diagnosis master (sample)", "masters.sampleFeeFile": "sample_master_HIRA_procedures.xlsx", "masters.sampleFeeSheet": "Procedure/fee master (sample)",
  "masters.logSample": "Sample master file downloaded ({n} rows)",
  "org.completeH": "Completeness", "org.completeCount": "{n}/{total} fields", "org.completeMissing": "empty: {f}",
  "org.noExport": "The profile heads every report file — nothing to export separately",
  "bigeup.web.k": "Website notice", "bigeup.history.k": "Change history", "bigeup.notice.k": "Price notice",
};
