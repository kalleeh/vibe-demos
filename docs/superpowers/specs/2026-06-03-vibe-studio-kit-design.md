# vibe-studio — Shareable Agent-First Demo Kit — Design

**Status:** Design approved (2026-06-03). Not yet implemented.

**Goal:** Extract the *reusable framework* behind vibe-demos into a shareable, agent-first
kit — `vibe-studio` — so anyone can clone it, point an AI coder at it, and build their own
studio of polished demos with the same quality guardrails. The author's specific demos do
**not** ship; one worked example per tier does.

**One-line architecture:** The entrypoint is always a **skill** an AI coder loads; **tools
nest beneath skills** as their execution layer (the official skill shape: `SKILL.md` +
`references/` + executable `tool/`). The kit ships as a single Claude Code **plugin +
template repo**.

---

## Why this exists (context & decisions log)

This design replaces an earlier, abandoned "continuum CLI plugin platform" idea
(`docs/superpowers/specs/2026-06-03-continuum-cli-plugin-platform-design.md`, written in
lovable-harness). That plan tried to unify self-hosted-infra bash tools under a
`continuum`-branded plugin *host*. Re-examination found its premise wrong:

- The tools share almost nothing functionally — lovable runs Supabase-local; pocketbase is
  a self-hosted server used **only** by vibe-demos. The sole overlap (box provisioning) is
  ~30 lines of bash, not worth a shared framework.
- **continuum is a shipping product** (relay + iOS app, real end users); the dev tooling is
  a *personal/ shareable rig*. Binding the rig to the product's name/namespace was wrong.
  The relay box must not be "poisoned" with lovable/pocketbase workloads (they already run
  on their own separate boxes — confirmed; nothing changes that).

**The real insight (the reframe):** the valuable thing isn't infra consolidation — it's a
**shareable kit** that makes "vibe-coding polished demos" reusable by a friend, with the
editorial portal, the canned-first/BYO-key AI-demo pattern, the domain-tuned-prompt
methodology, the PWA shell, and an optional backend. **Lovable apps are "just another vibe
demo,"** differing only in where they run and what they cost.

**Decisions taken during brainstorming (chosen AND rejected):**

1. **Shareable kit** (chosen) over infra-consolidation CLI (rejected: tools don't share
   enough; wrong premise).
2. **No `continuum` branding** (chosen). Naming fully dissociated from the continuum
   product. The dev rig and the product stay separate.
3. **Template repo + skill pack together** (chosen) over template-only (rejected: a prose
   `CLAUDE.md` won't reliably enforce method) or skills-only (rejected: no cold-start).
4. **Tiers as the spine** (chosen): every demo has a tier defined by where it runs + what
   it costs. Tier is **chosen inside the skill conversation**, never pre-selected by the
   user.
5. **Two skills, not one and not three** (chosen). Tier 0+1 share the entire static
   foundation (one becomes the other — e.g. tinywings shipped Tier 0, became Tier 1 when it
   got a leaderboard), so they are ONE skill with tier as an internal branch. Tier 2
   (Lovable) has a genuinely independent trigger (different repo, runtime, paid cost,
   leans on the lovable-harness tool) → its own skill. Per-tier-skill (3) rejected: user
   doesn't know the tier at trigger time, and Tier 0/1 descriptions would collide.
6. **Skill is the front door; tool nests beneath** (chosen) over tool-with-skill-underneath
   (rejected: entrypoint is an agent loading SKILL.md, not a human running a CLI then
   discovering a skill). Matches official skills (`skill-creator` = SKILL.md + scripts/).
7. **One coherent structure across all tiers** (chosen): both skills use the identical
   `SKILL.md + references/ + tool/` shape for project coherence.
8. **One repo** (chosen): lovable-harness migrates INTO `vibe-studio` via proper git history
   migration; the old repo is deleted only AFTER everything works.
9. **`demos.json` is the source of truth** (chosen) for tier + URL tracking. Propagated to
   the static portal by the agent (a skill action), NOT a build step or runtime JS — the
   "no build tool / push = deploy / JS-free editorial portal" rule is preserved.
10. **Demos are demos — breakage is acceptable** during the move (chosen), since the target
    boxes are already provisioned; environments are reconciled at the END (Phase 3).

**Out of scope (recorded for future specs):**
- Publishing `vibe-studio` to a public marketplace.
- Deep PocketBase box-provisioning hardening beyond a working `provision-box.sh`.
- Any continuum involvement (explicitly dropped — different product/audience).
- Multi-cloud; additional tiers/backends.

---

## The tier spine

`demos.json` is the canonical record. Entry shape:
`{ slug, title, tier, url, backend?, repo?, tags[], year }`.

| Tier | Runs on | Cost | Backend | `url` |
|---|---|---|---|---|
| **0 — static** | GitHub Pages | free | localStorage | `./slug/` (relative, derived from slug) |
| **1 — static + backend** | Pages + self-hosted box | cheap | PocketBase | `./slug/` + `backend:"pocketbase"` |
| **2 — Lovable** *(optional)* | Lovable prod / local dev | **paid credits** | Supabase | external URL + `repo` (may be unlisted/private) |

The skill boundary IS the optionality boundary: Tier 0+1 (`vibe-studio` skill) is fully
shareable, free→cheap. Tier 2 (`lovable-dev` skill) is the optional paid-Lovable companion.

---

## Repository structure (one repo, coherent shape)

```
vibe-studio/                            (Claude Code plugin + GitHub template repo)
├── .claude-plugin/plugin.json          # name, description, author
├── index.html                          # editorial portal scaffold (the studio landing)
├── demos.json                          # SOURCE OF TRUTH: tier + url per demo
├── sw.js                               # root PWA shell (subpath-exclusion pattern)
├── thumbs/                             # demo thumbnails
├── README.md                           # human-facing; mirrors demos.json
├── CLAUDE.md                           # conventions (trimmed to kit-generic; no author demos)
├── _example-static/                    # one worked Tier-0 demo (the crib)
│   └── index.html, manifest.webmanifest, icon.svg, sw.js
├── _example-backend/                   # one worked Tier-1 demo (PocketBase)
│   └── index.html, pb/pb_migrations/, ...
└── skills/
    ├── vibe-studio/                    # FRONT DOOR · Tier 0 + 1
    │   ├── SKILL.md                    # philosophy + tier model + router (lean, always-loaded)
    │   ├── references/                 # depth, loaded on demand
    │   │   ├── editorial-grammar.md    #   portal visual rules + maintenance contract
    │   │   ├── ai-demo-method.md       #   domain-tuned-prompt methodology (the crown jewel)
    │   │   ├── backend-pattern.md      #   PocketBase pattern + security tiers
    │   │   └── pwa-shell.md            #   per-demo PWA file pattern
    │   └── tool/                       # deterministic execution layer
    │       ├── scaffold-demo.sh        #   writes demo folder + PWA files + demos.json entry
    │       ├── provision-box.sh        #   codifies the PocketBase box-provisioning GAP
    │       ├── sync-backends.sh        #   generalized from vibe-demos' sync-backends.sh
    │       └── check-portal.sh         #   verify index.html/README/sw.js match demos.json
    └── lovable-dev/                    # FRONT DOOR · Tier 2 · optional
        ├── SKILL.md                    # the dev-outside-paid-credits loop
        ├── references/
        │   ├── supabase-local.md       #   reproduce Lovable's Supabase backend locally
        │   └── reimport-to-lovable.md  #   push-back / re-import workflow
        └── tool/                       # lovable-harness, MIGRATED IN INTACT
            └── (bin/lovable, lib/, provisioning/, apps.json, shims/, overrides/, tests/, ...)
```

Both skills share the identical `SKILL.md + references/ + tool/` shape. The only difference:
Tier 2's `tool/` is a mature CLI; Tier 0/1's `tool/` is a few scripts.

---

## How the skills work

**`vibe-studio/SKILL.md` (the front door, lean):** carries the philosophy + tier model + a
router table. On *"build a demo"* it asks the tier-deciding question — *needs shared/
persistent state?* → Tier 1; *single-user, local only?* → Tier 0; *it's a Lovable app?* →
hand off to `lovable-dev`. It then loads the relevant `references/*.md` for depth and runs
`tool/*` for deterministic work. **Tier is a branch inside the skill**, never pre-selected.

Triggering: descriptions are written so *"build/add a demo," "add a backend," "update the
portal"* fire `vibe-studio`; *"work on my lovable app," "dev my Lovable project outside
credits"* fire `lovable-dev`. No overlapping triggers.

**Tool invocation:** skills call tools by plugin-relative path, e.g.
`${CLAUDE_PLUGIN_ROOT}/skills/lovable-dev/tool/bin/lovable up <app>`. Standalone use of
`bin/lovable` at that path still works — it just isn't the primary door.

**`check-portal.sh` and the no-build rule:** `demos.json` is canonical. The script
*verifies* that `index.html`, `README.md`, and `sw.js` agree with `demos.json` and reports
drift; the **agent makes the edits** (governed by `editorial-grammar.md`). No build step, no
runtime JS added to the portal. Deploy stays "push to `main`."

---

## Error handling

- `scaffold-demo.sh` refuses to overwrite an existing slug; validates kebab-case; appends
  to `demos.json` atomically (temp + move).
- `check-portal.sh` exits nonzero and names each drift (missing index row, stale count,
  README mismatch, SW allow-list gap) so the agent knows exactly what to fix.
- `provision-box.sh` / `sync-backends.sh` keep the local-first ethos: a backend is never
  required for a demo to load; provisioning failures are reported, not swallowed.
- `lovable-dev` tool preserves lovable-harness's existing behavior and error paths verbatim
  (it's moved intact, not rewritten).

---

## Testing strategy

- **lovable-harness migration is gated by its existing `bats` suite passing unchanged** —
  the no-regression contract. Record the baseline count before the move; require the same
  count after.
- **New `tool/` scripts** (`scaffold-demo.sh`, `check-portal.sh`) get `bats` tests:
  scaffold writes the right files + a valid `demos.json` entry; check-portal detects each
  drift class on fixtures.
- **`provision-box.sh` / `sync-backends.sh`** unit-tested against a mock remote
  (stub ssh/rsync), asserting the systemd/Caddy/migration steps emit correctly (mirrors the
  abandoned plan's dry-run approach, which was sound).
- **Skill triggering** verified by inspection: the two descriptions must not collide.
- **End-to-end** (provision a real box → scaffold Tier-1 demo → sync → load) is a documented
  **manual** step, not automated — same posture as today.

---

## Three-phase delivery (order matters)

**Phase 1 — Build the new structure.**
Create `vibe-studio` (plugin.json, portal scaffold, `demos.json`, both skill skeletons,
example demos). Author the `vibe-studio` skill + its `tool/` scripts (scaffold, provision,
sync, check-portal) with tests. Migrate `lovable-harness` into `skills/lovable-dev/tool/`
via **proper git history migration** (e.g. `git subtree`/`filter-repo`), preserving commits.
Author the `lovable-dev` skill referencing the moved tool. Do NOT delete the old
lovable-harness repo yet.

**Phase 2 — Make skills + tools work seamlessly in the new structure.**
Update every skill and tool to the new paths/logic: tool invocation via
`${CLAUDE_PLUGIN_ROOT}`, internal relative paths intact, `demos.json` wired through, the
existing vibe-demos `sync-backends.sh` replaced/forwarded to the generalized one. Full
`bats` suites green (lovable baseline count preserved). Verify skills trigger and route
correctly.

**Phase 3 — Reconcile target environments.**
Bring the live boxes (the PocketBase `pb-backends` box; the lovable Lightsail box) and the
vibe-demos consumer repo into agreement with the new structure, skills, tools, and workflow.
Re-run the real provision/sync/up paths against the actual boxes; fix drift. Only once Phase
3 verifies end-to-end: **delete the old `lovable-harness` repo.**

---

## Self-review notes

- **Coherence:** identical `SKILL.md + references/ + tool/` shape for both skills, per the
  user's explicit ask.
- **Optionality:** Tier 2 is isolated to the `lovable-dev` skill; a friend who won't pay for
  Lovable clones `vibe-studio` and is missing nothing in Tier 0/1.
- **No-build rule:** preserved — `demos.json` → portal propagation is an agent action +
  verification script, never a build/runtime-JS step.
- **Risk control:** live tool migrated intact (not rewritten); bats baseline is the gate;
  old repo deleted only after Phase 3 verifies; breakage tolerated mid-flight because boxes
  are reconciled at the end (user's explicit call).
- **Known seam:** `ai-demo-method.md` is the one piece with value outside a vibe studio; if
  later wanted standalone, it graduates from a reference to its own skill. v1 keeps it a
  reference.
```
