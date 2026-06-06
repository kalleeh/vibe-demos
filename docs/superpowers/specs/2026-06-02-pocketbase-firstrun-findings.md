# PocketBase first-integration findings (tinywings leaderboard)

First end-to-end use of the PocketBase pattern. Log of what was fixed, why, and what's still open.

## Fixed (committed)

- **`sync-backends.sh` — first-ever-backend failure (commit 680f778).** rsync ran *before* the
  server-side `mkdir`, and rsync only creates the final path component → missing
  `/opt/pocketbase/<slug>/` caused ENOENT. Also `/opt/pocketbase` is owned by the `pocketbase`
  user while rsync runs over ssh as the login user → write denied. Fix: `sudo mkdir -p` the dest,
  then `rsync --rsync-path="sudo rsync"`; existing chown re-owns to pocketbase:pocketbase.
- **CLAUDE.md `tinywings` reference note** — said "realtime score updates"; we shipped
  **fetch-on-open** (realtime was explicitly YAGNI'd). Corrected + expanded to describe the real pattern.
- **CLAUDE.md importmap guidance** — added: importmap goes in `<head>`; if a demo has no module yet
  (classic-`<script>` game), this is its first one; bridge classic↔module via a `window.__*` hook;
  `node --check` is the static syntax check when no browser is available.
- **CLAUDE.md deploy phrasing** — unified `sync-backends.sh` as "the single deploy command, run from
  repo root"; dropped the inconsistent "human runs this" / "agent doesn't manage this" wording.

## Decisions (intentional, do NOT revert)

- **No realtime.** Fetch-on-open only (+ refetch after submit via `lbCacheDirty`). Matches spec.
- **Tier 1 public.** `player_id` is anonymous, for "you" highlighting only — not access control.
- **Maintenance contract NOT triggered** — in-place enhancement of a shipped demo, so works index /
  README / thumbnail are unchanged. Correct.
- **Test row cleanup** — Tier 1 blocks DELETE via public API (403); rows are removed via a PB
  superuser over SSH. A fresh instance refuses to delete its *only* superuser → rotate its password
  instead. No standing admin credentials were left behind.

## Still open / worth a look

- **CLAUDE.md "Currently shipped demos" line for tinywings (~line 29)** still describes only the
  glider; doesn't mention the leaderboard / that it's the canonical PocketBase demo. Consider a tweak.
- **Minor code nits (not blocking, demo-acceptable):** `submitScore` doesn't re-check `btn.disabled`,
  so a fast Enter-then-click has a narrow double-submit window; the SW's explicit cross-origin
  early-return is belt-and-suspenders (the cache-put guard already covered it).
- **No focus trap** on the leaderboard overlay (ARIA roles present); acceptable for a demo.
- **`backends/config.json` / `sync-backends.sh`** were untracked before this work and got first-committed
  inside the feature; fine, just noted.
