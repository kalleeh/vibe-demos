# clinic-admin — shared multi-tenant workspace (design spec)

**Date:** 2026-06-06
**Demo:** `clinic-admin/` — 한방병원 행정 도구함 (administrative-director toolkit)
**Scope:** Spec 1 of 2 in the "support the new PocketBase backends fully" effort. This spec covers the clinical *tools* (clinic-admin here; intake-companion folded in at the end as a lighter sibling). The playful/social demos (korean-mbti, live-globe, sweden-food-guide, resonans) are a separate spec.

---

## 1. Problem & intent

clinic-admin ships nine researched admin workflows grounded in real Korean standards (KCD-8, 자보 EDI 국토부 고시, 의료법 §25/§30 면허신고, 한국의료기관평가인증원 인증). Today every tab is **stateless and single-device**: a file goes in, gets validated/converted, comes out; nothing persists, nothing is shared. A small "실시간 접수 현황판" widget on the 오늘 dashboard is the only backend touch, and its realtime `subscribe()` is half-wired.

But the real work of a 행정원장 is **collective and persistent**: a 직원 면허 명부 belongs to the whole clinic, 인증평가 prep is a months-long checklist multiple staff tick off, recurring 자보 삭감 사유 only become visible across many claims over time. The demo currently fakes all of this as solo-on-this-device.

**Intent:** use the PocketBase backend to transform the *existing researched workflows* from stateless tools into a **shared, persistent, multi-tenant clinic database** — import once, hosted centrally, jointly modified, exportable by anyone — gated behind real authentication. The backend does **not** invent a new clinical workflow; it makes the genuinely-collective admin tasks actually collective.

**Non-goals:**
- No new clinical/patient-flow board (an earlier idea, explicitly rejected — out of scope for an *administrative* toolkit).
- No change to the file-in/validate-out tools that are genuinely per-person (see §4 "stays local").
- No patient-identifying data on the server (see §6 Privacy).

---

## 2. The ethos tension (and how we resolve it)

This repo's signature is **canned-first / local-first / no-signup**. A bare login wall is exactly the friction that makes a viewer bounce before the demo earns attention. Auth is nonetheless the right call here because it makes multi-tenant sharing and the privacy promise true *by construction*.

**Resolution (user decision):** a **real login screen is the front door** (option B), **with a one-tap demo shortcut on it** (option A). Real per-user accounts are the product story; the demo button is the bounce-preventer.

---

## 3. Architecture — PocketBase auth + multi-tenancy

### 3.1 Tenancy model

**Clinic = tenant** (user decision). Data is scoped per clinic; staff at the same clinic share datasets, different clinics are isolated.

### 3.2 Collections

**`users`** (PocketBase *auth* collection — extend the built-in)
- `email`, `password` (built-in), Google OAuth2 provider enabled
- `name` (text)
- `clinic` (relation → `clinic`, single)
- `role` (select: `원장` | `직원`)

**`clinic`** (base — the tenant)
- `name` (text, required, max 60)
- `join_code` (text, indexed, unique — short shareable code, e.g. `SEORAK-4821`)
- `created` / `updated` (autodate)

**Domain collections** — each carries `clinic` (relation) for scoping. Per the PocketBase pattern, every base collection declares `created`/`updated` as **autodate** fields (the bug fixed in commit `c2b4d3c` — do not omit). Concrete set:

| Collection | Fields (beyond clinic + autodate) | Notes |
|---|---|---|
| `license` (면허 명부) | `staff_name`, `kind` (한의사/간호사/…), `license_no`, `expires_on` (date), `last_report_on` (date) | 08 면허·자격 |
| `accred_item` (인증 체크리스트) | `domain` (안전/환자권리/의무기록/감염관리/시설/인사), `label`, `done` (bool), `checked_by` (text), `checked_at` (date) | 09 인증평가 |
| `kcd_code` (KCD-8 코드표) | `code`, `name_ko`, `note` | 01 — hosted reference table |
| `bigeup_item` (비급여 항목) | `name`, `price` (number), `category` | 04 비급여 반기보고 |
| `jabo_deduction` (자보 삭감 추세) | `insurer`, `reason`, `month` (text YYYY-MM), `amount` (number) | 02 — **aggregate only, no patient detail** |
| `intake_card` (오늘 현황판) | `patient_name`, `status` (대기/진료중/완료), `summary`, `station` (was `player_id`) | 00 — existing widget, retained & reframed |

> `intake_card.player_id` is **renamed `station`** in concept (접수/진료/치료/원장 origin tag, not a "player"). Migration keeps the column name `player_id` for compatibility but the UI labels it 스테이션; a follow-up migration may rename. Decide at implementation — renaming a populated field needs an `003` migration, not a rewrite of `001`.

### 3.3 API rules (authorization)

Default for clinic-scoped collections:
```
listRule / viewRule: "clinic = @request.auth.clinic"
createRule:          "clinic = @request.auth.clinic"
updateRule:          "clinic = @request.auth.clinic"
deleteRule:          "clinic = @request.auth.clinic"
```
Role-gated where it matters (server-side, not JS):
- `license`, `kcd_code`, `bigeup_item`: **write/delete require `원장`** →
  `updateRule: "clinic = @request.auth.clinic && @request.auth.role = '원장'"`
- `accred_item.done`, `intake_card`, `jabo_deduction`: any clinic member may write (collaborative).

The **demo clinic** is a real `clinic` row whose data is world-readable for the demo session (its rules relax to `""` for list/view on demo-flagged rows, or simpler: the demo account is a normal authed user of a shared clinic — preferred, keeps rules uniform).

### 3.4 Front door & onboarding

**Login screen** (`이메일/비밀번호` · `Google로 계속` · `회원가입`) with a **🩺 데모 클리닉으로 둘러보기** card (가입 없이 바로, pre-seeded shared clinic).

**회원가입 forks into two explicit paths — join is primary, create is rare** (user decision: most users join; per-user clinics should be rare):
- **우리 병원에 합류하기 (primary, default-weighted):** enter 참여 코드 (or tap emailed invite link) → resolves to existing `clinic` → user created with that `clinic` + role `직원`.
- **새 클리닉 만들기 (secondary, "원장·관리자용"):** creates a new `clinic` → user is first member, role `원장` → receives the `join_code` to share.

**Demo path:** taps 데모 클리닉 → silent `authWithPassword` (or anonymous) into the shared demo clinic. Inside, a small **원장 · 접수 · 치료 role switcher** lets one viewer open two browser tabs as two roles and watch the 명부/checklist sync live under the server-side role rules. A banner reads "데모 모드 · 공용 예시 데이터."

---

## 4. Per-workflow disposition

**Becomes shared/central (auth-gated, realtime where it helps):**

| Tab | Transformation | Realtime? |
|---|---|---|
| 08 면허·자격 갱신 | Shared **직원 면허 명부**, 원장-editable, clinic-wide D-day alerts | yes (subscribe) |
| 09 인증평가 | Shared **prep checklist**, live % complete, "누가 체크했는지" | yes |
| 01 KCD-8 정비 | **Hosted code table** — import once, team shares, export updated | light |
| 04 비급여 반기보고 | Shared **비급여 dataset**, assembled jointly, exportable for 심평원 | light |
| 02 자보 EDI 정산 | Shared **삭감 추세 ledger** (aggregate over insurer/month) | light |
| 00 오늘 | Retain realtime **접수 현황판** widget; reframe player→station; complete the `subscribe()` | yes (core) |

**Stays local / transient (sharing adds nothing; often touches PII):**
- 03 연말정산 사전검증, 06 코드 검색, 07 AI 코딩 어시스트 — lookup or file-validate, per-person.
- 05 보존 감사 — keep as-is unless a clear shared story emerges (default: local).

**Joint-DB UX (every shared tab):** ⬆ 가져오기 / ⬇ 내보내기 (.csv/.xlsx) buttons + a live presence line ("● 김선생님이 방금 N개 수정"). Flow: import once → hosted centrally → everyone edits the same data → anyone exports current state.

---

## 5. Local-first fallback (preserved)

The backend **enhances, never gates the page from loading**. If `pb.health.check()` fails:
- The page still loads fully; all *local* tools (KCD lookup, validators, OCR, AI assist) work unchanged.
- Shared tabs show the existing `○ local` indicator and fall back to the current `localStorage` store (`vibe.clinic-admin.intake-cards`, etc.).
- Shared *features* (joint editing, roster sync) naturally require login + connectivity; when offline they show a calm "오프라인 — 이 기기에서만" state rather than erroring.

Existing localStorage keys (`vibe.clinic-admin.player-id`, `vibe.clinic-admin.intake-cards`) are retained for the offline path.

---

## 6. Privacy — the promise, sharpened

Current welcome copy promises: *"환자 정보는 이 브라우저 밖으로 한 발짝도 나가지 않습니다."* Central hosting would contradict this **for patient PII**. Auth + data-splitting resolves it:

- **Hosted (gated to authenticated clinic staff):** reference & org data — code tables, 명부, 인증 체크리스트, 비급여 dataset, aggregate 삭감 추세. None of this is patient-identifying.
- **Browser-local, never leaves device:** individual patient claim detail (환자명/주민번호 in a 자보 case), OCR'd license/chart image originals, personal 영수증 originals. Processed locally; only PII-stripped results/aggregates persist to the server.

**Updated welcome copy (to write at implementation):**
> "우리 병원 팀이 함께 쓰는 행정 데이터 — 로그인한 직원만 봅니다. 환자 식별정보는 여전히 이 기기 안에서만 처리되고, 서버에는 집계·결과만 올라갑니다."

The promise becomes *true by construction*: shared data is gated, not public; patient identifiers are still local.

---

## 7. PWA / SW

Bump the cache name (`vibe-clinic-admin-vN` → `vN+1`) on ship. SW continues to skip cross-origin (PB) fetches from caching, per the established pattern.

---

## 8. Scope & sequencing note

This is materially larger than the autodate fix — it turns clinic-admin from "a demo with a shared widget" into a **multi-tenant authenticated app**, and establishes an auth/tenancy pattern the other demos *may* adopt (decided per-demo in Spec 2). Suggested build order:
1. Auth + `users`/`clinic` collections + login screen + demo shortcut + join/create fork.
2. The realtime 접수 현황판 (00) — completes existing stub, smallest shared win, proves the pattern.
3. 면허 명부 (08) + 인증 체크리스트 (09) — the two strongest shared workflows.
4. Hosted reference data (01 KCD, 04 비급여) with import/export.
5. 자보 삭감 ledger (02) — aggregate, last.

Each shared collection ships with its migration (`002+`, declaring autodate) and is deployed via `./sync-backends.sh`.

---

## 9. intake-companion (lighter sibling)

intake-companion (`case_brief`) is the other clinical tool. It currently creates a brief and reads a recent-30 feed. It is **single-clinician, not multi-station**, so it does **not** need the full multi-tenant treatment. Disposition:
- Keep it **local-first + optional auth**: a clinician may log in (reusing the same `users` collection) to get a **persistent personal 사례집 (casebook)** that syncs across their devices — Tier 3 "cross-device identity," the one case the PB pattern reserves auth for.
- Without login: unchanged (anonymous create + recent feed, local fallback).
- No clinic tenancy, no roles. This keeps intake-companion as the lightweight reference and avoids over-building.
- Detailed design deferred; if the personal-casebook idea is wanted, it gets a short follow-up spec rather than bloating this one.

---

## 10. Open questions for implementation (not blockers)

- Rename `intake_card.player_id` → `station` now (003 migration) or leave the column and relabel in UI only? (Lean: relabel UI now, rename later if it bothers.)
- Demo clinic as a normal shared authed account (uniform rules) vs. special demo-flagged public rows (lean: normal shared account).
- Export format priority: ship `.csv` first (zero-dep), add `.xlsx` only if asked (needs a lib — check against the no-build-tool rule; a CDN ESM xlsx writer is acceptable).
