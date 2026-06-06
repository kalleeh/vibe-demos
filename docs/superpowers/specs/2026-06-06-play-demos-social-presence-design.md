# Play demos — social & presence layer (design spec)

**Date:** 2026-06-06
**Demos:** `live-globe/`, `sweden-food-guide/`, `korean-mbti/`, `resonans/`
**Scope:** Spec 2 of 2 in the "support the new PocketBase backends fully" effort. Covers the playful/ambient demos. The clinical tools (clinic-admin, intake-companion) are in the sibling spec `2026-06-06-clinic-admin-shared-workspace-design.md`.

---

## 1. Intent

All four demos already have a PocketBase collection that today does "write + read a recent feed." Each backend's social/shared dimension is under-used. This spec brings each one to "fully and intuitively" supported — **tuned per demo**, because the four have very different souls. The guiding rule: **add the one lever that fits each demo's identity, and nothing more.**

Cross-cutting principles (unchanged from the repo's PB pattern):
- **Local-first:** every demo works with no backend; PB enhances, never gates.
- **Anonymous by default:** `player_id` is an anonymous UUID for "this is yours" highlighting, not auth. (One exception: korean-mbti optional login — §4.)
- **Realtime only where it's the point:** the pattern defaults to fetch-on-open and warns against reconnection polling. True `subscribe()` is used in **live-globe only**; the others use fetch-on-open or fetch-on-action.
- **XSS-safe rendering:** all user-submitted fields via `textContent`, never `innerHTML`.

---

## 2. live-globe → live presence (realtime)

**Identity:** anonymous. Pins are public; `player_id` highlights yours.

**Today:** `globe_ping` collection; pins fetched once on open via `getList(1, 50, {sort:'-created'})` (line ~2304). Other people's pins only appear on reload. No realtime.

**Change — make presence felt:**
1. **Realtime pin drops.** Add `pb.collection('globe_ping').subscribe('*', …)`. When anyone creates a ping, it animates onto the globe within ~1s — a pin descends, a soft ring pulses at the lat/lon, then settles. This is the one demo where live updating *is* the magic, so it's the only one getting `subscribe()`.
2. **Soft presence count.** A quiet "지금 N명이 보는 중 / N people here right now" — derived from recent ping activity (not true connection count; see open question). Understated, near the globe HUD, not a scoreboard.
3. **Arrival glow.** A newly-arrived ping (yours or others') glows briefly so the eye catches it; fades to the resting pin style.

**Loading/empty states:** honor the existing skeleton; reduced-motion replaces the descend/pulse with a simple fade.

**SW:** bump `vibe-live-globe-vN`. Cross-origin (PB) fetches already skipped from caching.

**Why this and not more:** live-globe is ambient/observational, not competitive. Presence (others are here, things are happening) is the right lever; leaderboards/streaks would be foreign to it.

---

## 3. sweden-food-guide → living votes + trending (light game)

**Identity:** anonymous. `spot_vote` already carries `player_id` to prevent double-voting.

**Today:** `community_spot` + `spot_vote`; vote counts computed client-side by counting `spot_vote` rows (comment at line ~3157). Spots fetched on open. No live update, no trending.

**Change — gentle social proof, not a leaderboard:**
1. **Live vote tally.** When you vote, the count ticks up immediately (optimistic local increment + write), and the demo re-fetches counts on vote actions so other voters' tallies stay current. (Fetch-on-action, not polling.)
2. **"이번 주 인기" (popular this week) rail.** A small horizontal strip surfacing spots with the most votes in a recent window. Uses the new `created` autodate on `spot_vote` to bound the window (this is one reason the autodate fix mattered). Falls back to all-time counts offline.
3. **Climbing-count feel.** Your contributed spot shows its vote count, and a subtle "+1" animation when it rises. Friendly, warm — explicitly *not* a ranked leaderboard with positions.

**Tone guard:** the demo is a curated travel/food guide, not a contest. Trending is framed as discovery ("뜨는 곳"), never ranking ("#1"). Keep the gold-on-cream aesthetic; no badges or points.

**SW:** bump `vibe-sweden-food-guide-vN`.

---

## 4. korean-mbti → social proof + optional login

**Identity:** anonymous by default; **optional login** (the one play demo where it earns its place).

**Today:** `mbti_result` collection; social-proof UI is **already scaffolded** (CSS `.social`, i18n strings `socialLocal: "local tally"` / `socialConnected: "live tally"`, per-facet tally logic). The live type distribution is half-built — this spec finishes it.

**Change A — finish the live distribution (anonymous, fetch-on-open):**
1. On result reveal, show where the viewer lands in the crowd: "ENFP는 전체의 14% · 잔망 루피 동료 1,203명." Computed from `getFullList` of `mbti_result` (demo-scale; existing approach).
2. Dramatize the reveal moment — the percentage and companion-count animate in alongside the type nickname, turning a solo result into "you + everyone like you."
3. Wire the existing `socialLocal`/`socialConnected` strings to the real online/offline state (already present, just connect).

**Change B — optional login for personal history (Tier 3, opt-in):**
- A soft, skippable prompt after a result: "로그인하면 결과를 기억해요 — 다시 풀거나 다른 기기에서도." Reuses the **same `users` auth collection introduced in clinic-admin's spec** (one auth collection across the studio).
- Logged-in: results persist to the user, viewable as a small personal history ("지난 결과: ENFP → INFP"). Cross-device.
- Anonymous: unchanged, fully functional. Login is never required to take the test or see the distribution.
- This is the only play demo touching auth, and only as an upsell. If login feels like scope creep at build time, Change A ships alone and B becomes a follow-up.

**Note on cost omission (memory):** korean-mbti intentionally omits the Opus model toggle for cost reasons — unrelated to this spec, do not re-add.

**SW:** bump `vibe-korean-mbti-vN` (already skips `api.anthropic.com` from caching).

---

## 5. resonans → faint ghost lines (ambient only)

**Identity:** anonymous.

**Today:** `locked_wave` collection. The code carries an explicit creed (line ~1598): *"NOT a leaderboard: no scores, no ranking, no counts, no 'you're #1'. The value is persistence and quiet company."* This must be protected.

**Change — the minimum that conveys company (user decision: faint ghost lines):**
- Others' locked waves **drift faintly across the paper as pale, fading ghost lines** behind the active string — drawn in the same hand-inked style, low opacity, slowly fading. You sense others have been here and found resonances, with **zero** counts, names, or ranking.
- Fetched on open (the existing `getList(1, 30, {sort:'-created'})`), no realtime, no polling — quiet by design.
- Reduced-motion: ghost lines render static and even fainter, or are omitted.

**Hard guard:** no number, no name, no ranking, no "+1", no "N others." If a future idea introduces any count to resonans, it violates the demo's stated creed and is out of scope. Adding *nothing* would also have been valid; ghost lines are the chosen maximum.

**SW:** bump `vibe-resonans-vN`.

---

## 6. Realtime vs. fetch — summary table

| Demo | Mechanism | Why |
|---|---|---|
| live-globe | `subscribe('*')` realtime | Live pin drops are the whole point |
| sweden-food-guide | fetch-on-action (vote) | Votes are user-initiated; no idle polling |
| korean-mbti | fetch-on-open | Distribution is a reveal-moment snapshot |
| resonans | fetch-on-open | Quiet by design; realtime would break calm |

No demo implements reconnection polling (per the PB pattern). live-globe relies on the SDK's auto-reconnect for its subscription.

---

## 7. Local-first fallback (all four)

Each demo keeps its current `○ local` / `● connected` indicator and localStorage fallback. Offline behavior:
- live-globe: shows cached + your local pins, no live drops.
- sweden: all-time client-side counts, no trending window.
- korean-mbti: "local tally" from local results only.
- resonans: your own locked waves only, no ghost lines.

---

## 8. Migrations

No schema changes are strictly required — all four collections exist with `created`/`updated` autodate (added in commit `c2b4d3c`). sweden's "this week" window and any new read patterns use existing fields. If a demo needs an index for performance at demo scale, add it in a `003_*.js` migration; otherwise none needed. Deploy any new migration via `./sync-backends.sh`.

---

## 9. Scope & sequencing

Smaller and more independent than Spec 1 — these can ship in any order, or in parallel, since they don't share state or an auth requirement (except korean-mbti's optional login, which depends on the `users` collection from Spec 1). Suggested order by impact-per-effort:
1. **live-globe realtime** — highest visible wow, self-contained.
2. **sweden votes + trending** — clear UX win, no auth.
3. **korean-mbti distribution (Change A)** — mostly wiring existing scaffold.
4. **resonans ghost lines** — small, aesthetic, careful.
5. **korean-mbti login (Change B)** — only after Spec 1's `users` exists; optional.

---

## 10. Open questions (non-blocking)

- **live-globe "N people here":** true presence requires either a heartbeat collection or counting connected realtime clients (PB doesn't expose the latter cleanly). Simplest honest version: count pings in the last few minutes and label it "최근 활동" rather than implying live connection count. Decide at implementation; lean to the honest activity-based label.
- **sweden trending window:** "this week" vs. "last 50 votes" vs. "last 7 days." Lean to a rolling 7-day window via `created`, falling back to all-time offline.
- **korean-mbti history UI:** how much history to show logged-in users (last result vs. a short timeline). Lean to last 3–5.
- **One auth collection across the studio:** confirm korean-mbti reuses clinic-admin's `users` rather than a separate collection (keeps the studio coherent; lean yes).
