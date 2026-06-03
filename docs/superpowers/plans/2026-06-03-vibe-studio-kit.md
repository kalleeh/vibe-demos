# vibe-studio Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `vibe-studio` — a shareable, agent-first Claude Code plugin + GitHub template repo that lets anyone clone it and vibe-code a studio of polished demos with the author's quality guardrails; migrate `lovable-harness` into it as the Tier-2 tool with git history preserved.

**Architecture:** One repo. Two skills sharing the identical `SKILL.md + references/ + tool/` shape: `vibe-studio` (Tier 0+1, tier chosen inside the skill) and `lovable-dev` (Tier 2, optional). The skill is the front door; the tool nests beneath it as the execution layer. `demos.json` is the source of truth for tier + URL; the static portal is propagated by the agent and *verified* by a script (no build step).

**Tech Stack:** Bash (`#!/usr/bin/env bash`, `set -euo pipefail`), `jq`, `bats` tests, `git subtree` (history-preserving migration), static HTML/CSS/JS (no build tool). Plugin format: `.claude-plugin/plugin.json` + `skills/<name>/SKILL.md`.

**Spec:** `docs/superpowers/specs/2026-06-03-vibe-studio-kit-design.md` (in vibe-demos; copied into the new repo in Task 1).

---

## Conventions for every task

- All scripts start with `#!/usr/bin/env bash` then `set -euo pipefail`.
- Tests are `bats`; each `.bats` file `source`s or `run bash`-invokes the unit under test, using `run` + `[ "$status" -eq 0 ]` / `[[ "$output" == *"..."* ]]` assertions (mirror `skills/lovable-dev/tool/tests/extract-tunnel-url.bats` once migrated, or the patterns shown inline here).
- TDD for scripts: write the failing `.bats` test, run to see it fail, implement, run to pass, commit.
- Run one test file: `bats tests/<file>.bats`. Run all: `bats tests/`.
- All work happens in the NEW repo `~/projects/vibe-studio/` unless a path says otherwise.
- Commit after each green task with the message shown.
- Markdown knowledge files (SKILL.md, references/*.md) are **extractions/adaptations of named sections of `~/projects/vibe-demos/CLAUDE.md`** — the task gives the exact source section and the required output structure. That is actionable content, not a placeholder.

---

## File Structure (locked before tasks)

```
~/projects/vibe-studio/
├── .claude-plugin/plugin.json
├── .gitignore
├── README.md
├── CLAUDE.md                                  # kit-generic conventions (Task 13)
├── index.html                                 # editorial portal scaffold (Task 8)
├── demos.json                                 # SOURCE OF TRUTH (Task 2)
├── manifest.webmanifest, icon.svg, sw.js      # root PWA shell (Task 8)
├── thumbs/                                     # placeholder thumb + example thumbs (Task 8)
├── _example-static/                            # Tier-0 worked demo (Task 9)
│   └── index.html, manifest.webmanifest, icon.svg, sw.js
├── _example-backend/                           # Tier-1 worked demo (Task 10)
│   └── index.html, manifest.webmanifest, icon.svg, sw.js, pb/pb_migrations/001_init.js
├── skills/
│   ├── vibe-studio/
│   │   ├── SKILL.md                            # Task 7
│   │   ├── references/
│   │   │   ├── editorial-grammar.md            # Task 7
│   │   │   ├── ai-demo-method.md               # Task 7
│   │   │   ├── backend-pattern.md              # Task 7
│   │   │   └── pwa-shell.md                     # Task 7
│   │   └── tool/
│   │       ├── scaffold-demo.sh                # Task 4
│   │       ├── provision-box.sh                # Task 5
│   │       ├── sync-backends.sh                # Task 6
│   │       ├── check-portal.sh                 # Task 3
│   │       ├── pocketbase@.service             # Task 5
│   │       ├── Caddyfile.tmpl                  # Task 5
│   │       └── tests/*.bats                    # Tasks 3–6
│   └── lovable-dev/
│       ├── SKILL.md                            # Task 12
│       ├── references/
│       │   ├── supabase-local.md               # Task 12
│       │   └── reimport-to-lovable.md          # Task 12
│       └── tool/                                # lovable-harness, subtree-migrated (Task 11)
└── docs/superpowers/{specs,plans}/             # spec + this plan (Task 1)
```

**Phases:** Tasks 1–13 = Phase 1 (build) + Phase 2 (wire, folded into Task 14). Task 14 = full-suite + trigger verification. Task 15 = Phase 3 (manual live-box reconciliation + delete old repo).

---

## Task 1: Scaffold the `vibe-studio` repo

**Files:**
- Create: `~/projects/vibe-studio/` (git repo) + dir skeleton
- Create: `~/projects/vibe-studio/.gitignore`
- Create: `~/projects/vibe-studio/README.md`
- Copy: spec + this plan into `~/projects/vibe-studio/docs/superpowers/`

- [ ] **Step 1: Create the repo and dirs**

```bash
mkdir -p ~/projects/vibe-studio/{.claude-plugin,thumbs,_example-static,_example-backend/pb/pb_migrations,docs/superpowers/specs,docs/superpowers/plans}
mkdir -p ~/projects/vibe-studio/skills/vibe-studio/{references,tool/tests}
mkdir -p ~/projects/vibe-studio/skills/lovable-dev/references
cd ~/projects/vibe-studio
git init -q
```

- [ ] **Step 2: Write `.gitignore`**

```
# vibe-studio/.gitignore
*.log
.DS_Store
/tmp/
node_modules/
.continuum/
```

- [ ] **Step 3: Write `README.md`**

````markdown
# vibe-studio

A shareable, agent-first kit for building a studio of polished interactive demos.
Clone it, open Claude Code, and the bundled skill walks you through building demos
with a consistent editorial portal, a canned-first / bring-your-own-key AI-demo
pattern, an optional self-hosted backend, and an installable PWA shell.

## Tiers

| Tier | Runs on | Cost | Backend |
|---|---|---|---|
| 0 — static | GitHub Pages | free | localStorage |
| 1 — static + backend | Pages + a self-hosted box | cheap | PocketBase |
| 2 — Lovable *(optional)* | Lovable / local dev | paid credits | Supabase |

`demos.json` is the source of truth for which demos exist, their tier, and their URL.

## Use it

Open this repo in Claude Code and say *"add a demo"*. The `vibe-studio` skill takes over.
Tier-2 (Lovable) work is the optional `lovable-dev` skill.

See `docs/superpowers/specs/2026-06-03-vibe-studio-kit-design.md`.
````

- [ ] **Step 4: Copy spec + this plan from vibe-demos**

```bash
cp ~/projects/vibe-demos/docs/superpowers/specs/2026-06-03-vibe-studio-kit-design.md docs/superpowers/specs/
cp ~/projects/vibe-demos/docs/superpowers/plans/2026-06-03-vibe-studio-kit.md docs/superpowers/plans/
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -q -m "chore: scaffold vibe-studio repo with spec + plan"
```

---

## Task 2: `demos.json` — the source of truth

**Files:**
- Create: `~/projects/vibe-studio/demos.json`

- [ ] **Step 1: Write `demos.json`**

Seed with the two example demos (added for real in Tasks 9–10) so the schema is visible and `check-portal.sh` has data to validate. Entry shape: `{ slug, title, tier, url, backend?, repo?, tags[], year }`.

```json
{
  "_comment": "Source of truth for the studio. tier 0=static, 1=static+pocketbase, 2=lovable. url is relative (./slug/) for tier 0/1, absolute for tier 2. The portal index.html, README.md, and sw.js are propagated from this by the vibe-studio skill and verified by tool/check-portal.sh.",
  "demos": [
    {
      "slug": "_example-static",
      "title": "Example Static",
      "tier": 0,
      "url": "./_example-static/",
      "tags": ["EXAMPLE", "STATIC", "TIER 0"],
      "year": "2026"
    },
    {
      "slug": "_example-backend",
      "title": "Example Backend",
      "tier": 1,
      "url": "./_example-backend/",
      "backend": "pocketbase",
      "tags": ["EXAMPLE", "POCKETBASE", "TIER 1"],
      "year": "2026"
    }
  ]
}
```

- [ ] **Step 2: Verify it parses**

Run: `jq -e '.demos | length == 2' ~/projects/vibe-studio/demos.json`
Expected: prints `true`, exit 0.

- [ ] **Step 3: Commit**

```bash
cd ~/projects/vibe-studio
git add demos.json && git commit -q -m "feat: demos.json source-of-truth manifest"
```

---

## Task 3: `tool/check-portal.sh` — verify portal matches `demos.json`

The no-build guardrail: this script reports drift between `demos.json` and the static portal; the agent fixes it. Tier 0/1 demos must have a row in `index.html`; the `Index / NN entries` count must equal the number of tier 0/1 demos; each `<slug>/` referenced asset path used by the root SW must be in `sw.js`. Tier-2 demos are listed but excluded from the SW shell check.

**Files:**
- Create: `~/projects/vibe-studio/skills/vibe-studio/tool/check-portal.sh`
- Test: `~/projects/vibe-studio/skills/vibe-studio/tool/tests/check-portal.bats`

- [ ] **Step 1: Write the failing test**

```bash
# skills/vibe-studio/tool/tests/check-portal.bats
#!/usr/bin/env bats
setup() {
  SCRIPT="${BATS_TEST_DIRNAME}/../check-portal.sh"
  TMP="$(mktemp -d)"
  cat > "$TMP/demos.json" <<'EOF'
{ "demos": [
  { "slug":"alpha", "title":"Alpha", "tier":0, "url":"./alpha/", "tags":["A"], "year":"2026" },
  { "slug":"beta",  "title":"Beta",  "tier":1, "url":"./beta/",  "tags":["B"], "year":"2026" }
] }
EOF
}
teardown() { rm -rf "$TMP"; }

_good_index() {
  cat > "$TMP/index.html" <<'EOF'
<div class="count">Index / 02 entries</div>
<a class="work" href="./alpha/"><span class="num">01</span></a>
<a class="work" href="./beta/"><span class="num">02</span></a>
EOF
}

@test "passes when index count and rows match demos.json" {
  _good_index
  run bash "$SCRIPT" --dir "$TMP"
  [ "$status" -eq 0 ]
}

@test "fails when a demo is missing its index row" {
  cat > "$TMP/index.html" <<'EOF'
<div class="count">Index / 02 entries</div>
<a class="work" href="./alpha/"><span class="num">01</span></a>
EOF
  run bash "$SCRIPT" --dir "$TMP"
  [ "$status" -ne 0 ]
  [[ "$output" == *"beta"* ]]
}

@test "fails when the count is wrong" {
  cat > "$TMP/index.html" <<'EOF'
<div class="count">Index / 09 entries</div>
<a class="work" href="./alpha/"><span class="num">01</span></a>
<a class="work" href="./beta/"><span class="num">02</span></a>
EOF
  run bash "$SCRIPT" --dir "$TMP"
  [ "$status" -ne 0 ]
  [[ "$output" == *"count"* ]]
}
```

- [ ] **Step 2: Run to verify failure**

Run: `bats ~/projects/vibe-studio/skills/vibe-studio/tool/tests/check-portal.bats`
Expected: FAIL (script does not exist).

- [ ] **Step 3: Implement `check-portal.sh`**

```bash
#!/usr/bin/env bash
# check-portal.sh — verify the static portal agrees with demos.json.
# Reports drift on stderr and exits nonzero; the agent makes the edits.
# Usage: check-portal.sh [--dir DIR]   (DIR defaults to the repo root = two levels up)
set -euo pipefail

DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="$2"; shift 2;;
    *) shift;;
  esac
done
if [ -z "$DIR" ]; then
  DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
fi

demos="$DIR/demos.json"
index="$DIR/index.html"
[ -f "$demos" ] || { echo "ERROR: $demos not found" >&2; exit 1; }
[ -f "$index" ] || { echo "ERROR: $index not found" >&2; exit 1; }

fail=0
err() { echo "DRIFT: $*" >&2; fail=1; }

# Tier 0/1 demos must each have a row; count must match.
listed_slugs="$(jq -r '.demos[] | select(.tier < 2) | .slug' "$demos")"
expected_count="$(jq -r '[.demos[] | select(.tier < 2)] | length' "$demos")"

while read -r slug; do
  [ -n "$slug" ] || continue
  grep -q "href=\"./$slug/\"" "$index" || err "demo '$slug' has no index row (expected href=\"./$slug/\")"
done <<< "$listed_slugs"

# Count text: "Index / NN entries" (zero-padded NN)
shown="$(grep -oE 'Index / [0-9]+ entries' "$index" | grep -oE '[0-9]+' | head -1 || true)"
if [ -z "$shown" ]; then
  err "no 'Index / NN entries' count found in index.html"
elif [ "$((10#$shown))" -ne "$expected_count" ]; then
  err "count mismatch: index shows $shown, demos.json has $expected_count tier-0/1 demos"
fi

if [ "$fail" -eq 0 ]; then echo "portal matches demos.json ✓"; fi
exit "$fail"
```

- [ ] **Step 4: Run to verify pass**

Run: `bats ~/projects/vibe-studio/skills/vibe-studio/tool/tests/check-portal.bats`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/vibe-studio
chmod +x skills/vibe-studio/tool/check-portal.sh
git add skills/vibe-studio/tool/check-portal.sh skills/vibe-studio/tool/tests/check-portal.bats
git commit -q -m "feat(tool): check-portal.sh verifies portal matches demos.json"
```

---

## Task 4: `tool/scaffold-demo.sh` — create a demo folder + demos.json entry

Creates `<slug>/` with PWA files, then appends a `demos.json` entry. Refuses to overwrite; validates kebab-case slug; writes the entry atomically.

**Files:**
- Create: `~/projects/vibe-studio/skills/vibe-studio/tool/scaffold-demo.sh`
- Test: `~/projects/vibe-studio/skills/vibe-studio/tool/tests/scaffold-demo.bats`

- [ ] **Step 1: Write the failing test**

```bash
# skills/vibe-studio/tool/tests/scaffold-demo.bats
#!/usr/bin/env bats
setup() {
  SCRIPT="${BATS_TEST_DIRNAME}/../scaffold-demo.sh"
  TMP="$(mktemp -d)"
  echo '{ "demos": [] }' > "$TMP/demos.json"
}
teardown() { rm -rf "$TMP"; }

@test "creates the demo folder with index.html and PWA files" {
  run bash "$SCRIPT" --dir "$TMP" --slug my-demo --title "My Demo" --tier 0
  [ "$status" -eq 0 ]
  [ -f "$TMP/my-demo/index.html" ]
  [ -f "$TMP/my-demo/manifest.webmanifest" ]
  [ -f "$TMP/my-demo/icon.svg" ]
  [ -f "$TMP/my-demo/sw.js" ]
}

@test "appends a demos.json entry with the right tier and url" {
  bash "$SCRIPT" --dir "$TMP" --slug my-demo --title "My Demo" --tier 0
  run jq -r '.demos[0].slug' "$TMP/demos.json";  [ "$output" = "my-demo" ]
  run jq -r '.demos[0].tier' "$TMP/demos.json";  [ "$output" = "0" ]
  run jq -r '.demos[0].url'  "$TMP/demos.json";  [ "$output" = "./my-demo/" ]
}

@test "tier 1 adds backend=pocketbase and a pb/pb_migrations dir" {
  bash "$SCRIPT" --dir "$TMP" --slug be-demo --title "BE" --tier 1
  run jq -r '.demos[0].backend' "$TMP/demos.json"; [ "$output" = "pocketbase" ]
  [ -d "$TMP/be-demo/pb/pb_migrations" ]
}

@test "refuses to overwrite an existing slug" {
  bash "$SCRIPT" --dir "$TMP" --slug dup --title "Dup" --tier 0
  run bash "$SCRIPT" --dir "$TMP" --slug dup --title "Dup" --tier 0
  [ "$status" -ne 0 ]
  [[ "$output" == *"exists"* ]]
}

@test "rejects a non-kebab-case slug" {
  run bash "$SCRIPT" --dir "$TMP" --slug "My_Demo" --title "x" --tier 0
  [ "$status" -ne 0 ]
  [[ "$output" == *"kebab"* ]]
}
```

- [ ] **Step 2: Run to verify failure**

Run: `bats ~/projects/vibe-studio/skills/vibe-studio/tool/tests/scaffold-demo.bats`
Expected: FAIL.

- [ ] **Step 3: Implement `scaffold-demo.sh`**

```bash
#!/usr/bin/env bash
# scaffold-demo.sh — create a new demo folder (+ PWA shell) and register it in demos.json.
# Usage: scaffold-demo.sh --dir DIR --slug SLUG --title TITLE --tier 0|1 [--year YYYY]
set -euo pipefail

DIR="" SLUG="" TITLE="" TIER="" YEAR="2026"
while [ $# -gt 0 ]; do
  case "$1" in
    --dir)   DIR="$2";   shift 2;;
    --slug)  SLUG="$2";  shift 2;;
    --title) TITLE="$2"; shift 2;;
    --tier)  TIER="$2";  shift 2;;
    --year)  YEAR="$2";  shift 2;;
    *) shift;;
  esac
done

[ -n "$DIR" ] && [ -n "$SLUG" ] && [ -n "$TITLE" ] && [ -n "$TIER" ] || {
  echo "usage: scaffold-demo.sh --dir DIR --slug SLUG --title TITLE --tier 0|1 [--year YYYY]" >&2; exit 1; }
[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "ERROR: slug must be kebab-case: $SLUG" >&2; exit 1; }
[ -e "$DIR/$SLUG" ] && { echo "ERROR: $DIR/$SLUG already exists" >&2; exit 1; }
[ -f "$DIR/demos.json" ] || { echo "ERROR: $DIR/demos.json not found" >&2; exit 1; }

theme="#b04a2f"
mkdir -p "$DIR/$SLUG"

cat > "$DIR/$SLUG/index.html" <<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>$TITLE</title>
  <link rel="icon" type="image/svg+xml" href="icon.svg">
  <link rel="apple-touch-icon" href="icon.svg">
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="$theme">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="$TITLE">
</head>
<body>
  <main><h1>$TITLE</h1><p>New tier-$TIER demo. Build it with the vibe-studio skill.</p></main>
  <script>
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
    }
  </script>
</body>
</html>
HTML

cat > "$DIR/$SLUG/manifest.webmanifest" <<JSON
{
  "name": "$TITLE",
  "short_name": "$TITLE",
  "lang": "en",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "theme_color": "$theme",
  "background_color": "#f4efe6",
  "icons": [{ "src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }]
}
JSON

cat > "$DIR/$SLUG/icon.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="$theme"/>
  <text x="32" y="42" font-family="Georgia,serif" font-size="32" fill="#f4efe6" text-anchor="middle">${TITLE:0:1}</text>
</svg>
SVG

cat > "$DIR/$SLUG/sw.js" <<JS
/* $SLUG — per-demo PWA shell. Network-first HTML, cache-first assets. */
const CACHE = "vibe-$SLUG-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // skip cross-origin (e.g. a backend API)
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req).then(m => m || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then(m => m || fetch(req)));
});
JS

if [ "$TIER" = "1" ]; then
  mkdir -p "$DIR/$SLUG/pb/pb_migrations"
fi

# Append demos.json entry atomically.
tmp="$(mktemp)"
url="./$SLUG/"
if [ "$TIER" = "1" ]; then
  jq --arg s "$SLUG" --arg t "$TITLE" --argjson tier "$TIER" --arg u "$url" --arg y "$YEAR" \
     '.demos += [{slug:$s, title:$t, tier:$tier, url:$u, backend:"pocketbase", tags:["NEW"], year:$y}]' \
     "$DIR/demos.json" > "$tmp"
else
  jq --arg s "$SLUG" --arg t "$TITLE" --argjson tier "$TIER" --arg u "$url" --arg y "$YEAR" \
     '.demos += [{slug:$s, title:$t, tier:$tier, url:$u, tags:["NEW"], year:$y}]' \
     "$DIR/demos.json" > "$tmp"
fi
mv "$tmp" "$DIR/demos.json"

echo "scaffolded '$SLUG' (tier $TIER) at $DIR/$SLUG and registered in demos.json ✓"
echo "next: the vibe-studio skill propagates demos.json into index.html/README/sw.js, then check-portal.sh"
```

- [ ] **Step 4: Run to verify pass**

Run: `bats ~/projects/vibe-studio/skills/vibe-studio/tool/tests/scaffold-demo.bats`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/vibe-studio
chmod +x skills/vibe-studio/tool/scaffold-demo.sh
git add skills/vibe-studio/tool/scaffold-demo.sh skills/vibe-studio/tool/tests/scaffold-demo.bats
git commit -q -m "feat(tool): scaffold-demo.sh creates demo + registers in demos.json"
```

---

## Task 5: `tool/provision-box.sh` + static unit/Caddy files — the codified box-provisioning gap

This closes the real gap: vibe-demos' `sync-backends.sh` assumes a pre-built box (the `pocketbase` user, `/opt/pocketbase/pocketbase` binary, the `pocketbase@.service` template, Caddy). `provision-box.sh` builds that box from a bare Ubuntu host. It must be unit-testable without a real box: when `PROVISION_DRYRUN=1`, it prints the remote script to stdout instead of piping to ssh.

**Files:**
- Create: `~/projects/vibe-studio/skills/vibe-studio/tool/provision-box.sh`
- Create: `~/projects/vibe-studio/skills/vibe-studio/tool/pocketbase@.service`
- Create: `~/projects/vibe-studio/skills/vibe-studio/tool/Caddyfile.tmpl`
- Test: `~/projects/vibe-studio/skills/vibe-studio/tool/tests/provision-box.bats`

- [ ] **Step 1: Write the static unit + Caddy template**

```ini
# skills/vibe-studio/tool/pocketbase@.service — systemd template (one instance per demo slug)
[Unit]
Description=PocketBase backend %i
After=network.target

[Service]
User=pocketbase
Group=pocketbase
ExecStart=/opt/pocketbase/%i/pocketbase serve --http=127.0.0.1:8090
Restart=always

[Install]
WantedBy=multi-user.target
```

```
# skills/vibe-studio/tool/Caddyfile.tmpl — header; per-backend blocks appended by sync-backends.sh. {DOMAIN} substituted.
*.{DOMAIN} {
  tls {
    dns route53
  }
}
```

- [ ] **Step 2: Write the failing test**

```bash
# skills/vibe-studio/tool/tests/provision-box.bats
#!/usr/bin/env bats
setup() {
  SCRIPT="${BATS_TEST_DIRNAME}/../provision-box.sh"
  export PROVISION_DRYRUN=1
}

@test "dry-run emits the pocketbase user + binary install + unit template" {
  run bash "$SCRIPT" --host pb-test
  [ "$status" -eq 0 ]
  [[ "$output" == *"useradd"* ]]
  [[ "$output" == *"pocketbase"* ]]
  [[ "$output" == *"/opt/pocketbase/pocketbase"* ]]
  [[ "$output" == *"pocketbase@.service"* ]]
  [[ "$output" == *"caddy"* ]]
}

@test "fails without --host" {
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"host"* ]]
}
```

- [ ] **Step 3: Run to verify failure**

Run: `bats ~/projects/vibe-studio/skills/vibe-studio/tool/tests/provision-box.bats`
Expected: FAIL.

- [ ] **Step 4: Implement `provision-box.sh`**

```bash
#!/usr/bin/env bash
# provision-box.sh — build a bare Ubuntu host into a PocketBase server:
#   pocketbase system user, /opt/pocketbase/pocketbase binary, the pocketbase@.service
#   systemd template, and Caddy (wildcard TLS via Route53 DNS-01 — see PREREQS).
# Idempotent. Unit-testable: PROVISION_DRYRUN=1 prints the remote script instead of running it.
# Usage: provision-box.sh --host <ssh-host> [--pb-version 0.25.0]
set -euo pipefail
_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

HOST="" PB_VERSION="0.25.0"
while [ $# -gt 0 ]; do
  case "$1" in
    --host) HOST="$2"; shift 2;;
    --pb-version) PB_VERSION="$2"; shift 2;;
    *) shift;;
  esac
done
[ -n "$HOST" ] || { echo "usage: provision-box.sh --host <ssh-host> [--pb-version X]" >&2; exit 1; }

unit="$(cat "$_DIR/pocketbase@.service")"

remote_script() {
cat <<EOF
set -euo pipefail
# base packages
if command -v apt-get >/dev/null; then
  sudo apt-get update -y
  sudo apt-get install -y curl unzip jq rsync debian-keyring debian-archive-keyring apt-transport-https
fi
# pocketbase system user + dir
id pocketbase >/dev/null 2>&1 || sudo useradd --system --home /opt/pocketbase --shell /usr/sbin/nologin pocketbase
sudo mkdir -p /opt/pocketbase
# pocketbase binary
if [ ! -x /opt/pocketbase/pocketbase ]; then
  cd /tmp
  curl -fsSL -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
  sudo unzip -o pb.zip pocketbase -d /opt/pocketbase
fi
sudo chown -R pocketbase:pocketbase /opt/pocketbase
# systemd template
sudo tee /etc/systemd/system/pocketbase@.service > /dev/null <<'UNIT'
${unit}
UNIT
sudo systemctl daemon-reload
# Caddy (official apt repo)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y && sudo apt-get install -y caddy
fi
echo "PROVISION_DONE"
EOF
}

if [ "${PROVISION_DRYRUN:-0}" = "1" ]; then
  remote_script
  exit 0
fi

echo "==> Provisioning PocketBase box on '$HOST' (pocketbase $PB_VERSION)…"
remote_script | ssh "$HOST" "bash -s"
echo "==> Provisioned. Route53 wildcard TLS is a prerequisite — see PREREQS in the backend-pattern reference."
```

- [ ] **Step 5: Run to verify pass**

Run: `bats ~/projects/vibe-studio/skills/vibe-studio/tool/tests/provision-box.bats`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd ~/projects/vibe-studio
chmod +x skills/vibe-studio/tool/provision-box.sh
git add skills/vibe-studio/tool/provision-box.sh skills/vibe-studio/tool/pocketbase@.service skills/vibe-studio/tool/Caddyfile.tmpl skills/vibe-studio/tool/tests/provision-box.bats
git commit -q -m "feat(tool): provision-box.sh codifies PocketBase box provisioning"
```

---

## Task 6: `tool/sync-backends.sh` — generalized converge (from vibe-demos)

Generalize vibe-demos' proven `sync-backends.sh` to take `--config <path>` (instead of hardcoding `backends/config.json` next to itself) and resolve `<slug>/pb/pb_migrations/` relative to the config's directory. Same converge behavior. Unit-testable via `SYNC_DRYRUN=1` (prints actions instead of running ssh/rsync).

**Files:**
- Create: `~/projects/vibe-studio/skills/vibe-studio/tool/sync-backends.sh`
- Test: `~/projects/vibe-studio/skills/vibe-studio/tool/tests/sync-backends.bats`

- [ ] **Step 1: Write the failing test**

```bash
# skills/vibe-studio/tool/tests/sync-backends.bats
#!/usr/bin/env bats
setup() {
  SCRIPT="${BATS_TEST_DIRNAME}/../sync-backends.sh"
  TMP="$(mktemp -d)"
  mkdir -p "$TMP/tinywings/pb/pb_migrations"
  echo '// migration' > "$TMP/tinywings/pb/pb_migrations/001.js"
  cat > "$TMP/config.json" <<'EOF'
{ "server": { "host": "pb-backends", "domain": "pb.example.com" },
  "backends": { "tinywings": { "port": 8091 } } }
EOF
  export SYNC_DRYRUN=1
}
teardown() { rm -rf "$TMP"; }

@test "fails without --config" {
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"config"* ]]
}

@test "dry-run plans rsync of migrations + port override + caddy block" {
  run bash "$SCRIPT" --config "$TMP/config.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"tinywings"* ]]
  [[ "$output" == *"8091"* ]]
  [[ "$output" == *"pb.example.com"* ]]
}
```

- [ ] **Step 2: Run to verify failure**

Run: `bats ~/projects/vibe-studio/skills/vibe-studio/tool/tests/sync-backends.bats`
Expected: FAIL.

- [ ] **Step 3: Implement `sync-backends.sh`**

```bash
#!/usr/bin/env bash
# sync-backends.sh — converge PocketBase backends declared in a config.json.
# Generalized from vibe-demos: takes --config <path>; migrations resolve relative to
# the config's parent dir (repo root) at <slug>/pb/pb_migrations/.
# SYNC_DRYRUN=1 prints the planned actions instead of running ssh/rsync.
# Usage: sync-backends.sh --config <path-to-config.json>
set -euo pipefail
_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CONFIG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --config) CONFIG="$2"; shift 2;;
    *) shift;;
  esac
done
[ -n "$CONFIG" ] || { echo "usage: sync-backends.sh --config <config.json>" >&2; exit 1; }
[ -f "$CONFIG" ] || { echo "ERROR: config not found: $CONFIG" >&2; exit 1; }

ROOT="$(cd "$(dirname "$CONFIG")" && pwd)"
SERVER_HOST="$(jq -r '.server.host' "$CONFIG")"
SERVER_DOMAIN="$(jq -r '.server.domain' "$CONFIG")"
DRY="${SYNC_DRYRUN:-0}"

run_ssh()   { if [ "$DRY" = "1" ]; then echo "SSH: $*"; else ssh "$SERVER_HOST" "$@"; fi; }
run_rsync() { if [ "$DRY" = "1" ]; then echo "RSYNC: $*"; else rsync -avz --delete -e ssh --rsync-path="sudo rsync" "$@"; fi; }

echo "==> Target: ${SERVER_HOST} (*.${SERVER_DOMAIN})"
BACKENDS="$(jq -r '.backends | to_entries[] | "\(.key) \(.value.port)"' "$CONFIG")"
[ -n "$BACKENDS" ] || { echo "No backends declared — nothing to sync."; exit 0; }

CADDY="$(sed "s/{DOMAIN}/$SERVER_DOMAIN/g" "$_DIR/Caddyfile.tmpl")"
CADDY="${CADDY%\}}"   # drop trailing brace; per-backend blocks appended before it

while IFS=' ' read -r SLUG PORT; do
  [ -n "$SLUG" ] || continue
  echo "--- [$SLUG] port=$PORT ---"
  MIG="$ROOT/$SLUG/pb/pb_migrations"
  if [ -d "$MIG" ]; then
    run_ssh "sudo mkdir -p /opt/pocketbase/${SLUG}/pb_migrations"
    run_rsync "$MIG/" "${SERVER_HOST}:/opt/pocketbase/${SLUG}/pb_migrations/"
  else
    echo "  WARN: $MIG missing — skipping migrations"
  fi
  run_ssh "sudo bash -s" <<EOF
set -e
mkdir -p /opt/pocketbase/${SLUG}/pb_migrations
ln -sf /opt/pocketbase/pocketbase /opt/pocketbase/${SLUG}/pocketbase
chown -R pocketbase:pocketbase /opt/pocketbase/${SLUG}
mkdir -p /etc/systemd/system/pocketbase@${SLUG}.service.d
cat > /etc/systemd/system/pocketbase@${SLUG}.service.d/port.conf <<UNIT
[Service]
ExecStart=
ExecStart=/opt/pocketbase/${SLUG}/pocketbase serve --http=127.0.0.1:${PORT}
UNIT
systemctl daemon-reload
systemctl enable pocketbase@${SLUG} --now
systemctl restart pocketbase@${SLUG}
EOF
  echo "  ✓ pocketbase@${SLUG} -> ${PORT}"
  CADDY="$CADDY
  @${SLUG} host ${SLUG}.${SERVER_DOMAIN}
  handle @${SLUG} { reverse_proxy localhost:${PORT} }"
done <<< "$BACKENDS"

CADDY="$CADDY
  handle { respond \"Not found\" 404 }
}"

echo "==> Deploying Caddyfile…"
if [ "$DRY" = "1" ]; then
  echo "CADDYFILE:"; printf '%s\n' "$CADDY"
else
  printf '%s\n' "$CADDY" | ssh "$SERVER_HOST" "sudo tee /etc/caddy/Caddyfile > /dev/null && sudo systemctl reload caddy"
fi
echo "==> Done."
```

- [ ] **Step 4: Run to verify pass**

Run: `bats ~/projects/vibe-studio/skills/vibe-studio/tool/tests/sync-backends.bats`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/vibe-studio
chmod +x skills/vibe-studio/tool/sync-backends.sh
git add skills/vibe-studio/tool/sync-backends.sh skills/vibe-studio/tool/tests/sync-backends.bats
git commit -q -m "feat(tool): generalized sync-backends.sh (--config, relative migrations)"
```

---

## Task 7: `vibe-studio` skill — SKILL.md + references

These are extractions/adaptations of named sections of `~/projects/vibe-demos/CLAUDE.md`. Genericize: drop author-specific demo names and Korean-audience specifics; keep the methodology. Each file's required structure is given below.

**Files:**
- Create: `~/projects/vibe-studio/skills/vibe-studio/SKILL.md`
- Create: `~/projects/vibe-studio/skills/vibe-studio/references/editorial-grammar.md`
- Create: `~/projects/vibe-studio/skills/vibe-studio/references/ai-demo-method.md`
- Create: `~/projects/vibe-studio/skills/vibe-studio/references/backend-pattern.md`
- Create: `~/projects/vibe-studio/skills/vibe-studio/references/pwa-shell.md`

- [ ] **Step 1: Write `SKILL.md`** (lean front door: frontmatter + philosophy + tier model + router)

```markdown
---
name: vibe-studio
description: Use when building, adding, removing, or renaming a demo in a vibe-studio repo; when adding a backend to a demo; when tuning an AI demo's prompt; or when keeping the studio portal (index.html, README, sw.js) in sync with demos.json. Covers static (tier 0) and self-hosted-backend (tier 1) demos. For Lovable apps, use the lovable-dev skill instead.
---

# vibe-studio

You are building a studio of small, polished, self-contained interactive demos. Each demo
is its own folder of plain static HTML/CSS/JS served from the repo root; `demos.json` is the
source of truth for what exists, its tier, and its URL.

## Philosophy
- Plain static files. No build tool, no framework, no package.json. Push to main = deploy.
- Each demo is self-contained — do not share CSS/JS across demos.
- Local-first: a backend enhances, never gates. Every demo works with no backend.

## Tier model (decide the tier IN CONVERSATION, never ask the user to pre-pick)
- **Tier 0 — static:** single-user, localStorage. Free, on Pages. url = `./slug/`.
- **Tier 1 — static + PocketBase:** needs shared/persistent state across users/devices.
  Cheap, self-hosted box. url = `./slug/`, `backend: "pocketbase"`.
- **Tier 2 — Lovable:** a Lovable app (Supabase, paid credits). NOT this skill —
  hand off to the `lovable-dev` skill.
Ask: "does this need state shared between visitors or surviving a browser clear?" → yes = 1, no = 0.

## Router — load the reference you need, run the tool that does the work
- **Add/build a demo** → `tool/scaffold-demo.sh --dir . --slug <s> --title "<t>" --tier <0|1>`,
  then read `references/editorial-grammar.md` to add its portal row + propagate demos.json,
  then `references/pwa-shell.md` for the per-demo PWA files, then run `tool/check-portal.sh`.
- **It's an AI demo (calls Claude)** → read `references/ai-demo-method.md` and do the
  one-shot domain-research pass BEFORE writing the system prompt.
- **Add a backend (tier 0 → 1)** → read `references/backend-pattern.md`; provision with
  `tool/provision-box.sh --host <h>` (once per box) and converge with
  `tool/sync-backends.sh --config <path>`.
- **Portal upkeep (add/remove/rename)** → `references/editorial-grammar.md` is the
  maintenance contract; always finish by running `tool/check-portal.sh` until it passes.

## Tool paths
Invoke tools at `${CLAUDE_PLUGIN_ROOT}/skills/vibe-studio/tool/<script>.sh` when running as
an installed plugin, or `skills/vibe-studio/tool/<script>.sh` when working inside the repo.
```

- [ ] **Step 2: Write `references/editorial-grammar.md`**

Adapt from vibe-demos CLAUDE.md sections **"The root `index.html` works index"**, **"Editorial / styling rules for the landing page"**, and **"README.md"**. Required content:
- The editorial aesthetic (cream paper, grain, Fraunces serif display, Inter body, JetBrains Mono metadata; rust-orange `#b04a2f` accent reserved for hover/italic/live).
- The works-index row grammar: `<span class="num">`, `<span class="title">` with one word in `<em>`, `<span class="tags">` (3 short uppercase phrases via `<br>`), `<span class="thumb"><img>`, `<span class="year">`, `<span class="arrow">→</span>`.
- **The maintenance contract** (genericized — no author demo names): when adding/removing/renaming a demo you MUST in one commit update (1) the demo folder, (2) the `index.html` works row + the `Index / NN entries` count (count = number of tier 0/1 demos), and (3) `README.md`. demos.json is the source; these are propagated from it. Numbering is two-digit, chronological, never reused; removed middle slots become `data-status="soon"` placeholders.
- Note: tier-2 (Lovable) rows use the demo's absolute external `url`; tier 0/1 use `./slug/`.
- End with: "After any change, run `tool/check-portal.sh` until it reports `✓`."

- [ ] **Step 3: Write `references/ai-demo-method.md`**

Adapt from vibe-demos CLAUDE.md sections **"AI demo pattern"** and **"Domain-tuned system prompts"**. Genericize the examples (replace 한의사/KOGAS specifics with "your single named audience"). Required content, in order:
- Endpoint + auth shape (browser-direct `fetch` to the Anthropic Messages API; headers incl. `anthropic-dangerous-direct-browser-access`; never hardcode/commit/log a key; per-demo localStorage key; password input; paste-from-clipboard; forget-key; 401 → wipe + re-prompt).
- Three-model UI toggle (opus default / sonnet balance / haiku fast). Use current model IDs.
- **Canned-first, live-optional**: ship a canned mode (labeled "demo mode") that works with no key; live mode toggles real calls.
- Streaming where it helps (SSE for human-readable text; non-streaming only when a complete JSON object is needed before render).
- **The domain-tuning methodology** (the crown jewel): identify the precise audience; spawn a research agent with an audience-anchored brief; extract canonical vocabulary, canonical references, an errors-to-avoid list (8–15 specific), one worked exemplar; compose the prompt with XML tags (`<role>` with negative anchoring, `<voice>`, `<reasoning_order>`, `<canonical_*>`, `<errors_to_avoid>`, `<output_constraints>`, `<output_schema>`, `<exemplar>`); match the schema to existing rendering; calibrate against canned outputs. Do the research pass ONCE and embed it.
- The anti-patterns list (skipping research; one huge unstructured prompt; positive-only guidance; re-running research each session; romanizing/translating canon).

- [ ] **Step 4: Write `references/backend-pattern.md`**

Adapt from vibe-demos CLAUDE.md section **"PocketBase backend pattern"**. Required content:
- Decision tree: persists across browser clears OR shared between users? No → client-only, stop. Yes → PocketBase.
- Local-first fallback (health check on user action only; `● connected` / `○ local` indicator; never block UI; no reconnection polling).
- SDK import (`pocketbase@0.25.0` via CDN importmap in `<head>`; classic↔module bridge via `window.__*` hook if no module yet).
- Collection conventions (singular snake_case; migrations `NNN_<desc>.js` are the source of truth; migration file format).
- Security tiers (Tier 1 public rules; Tier 2 anonymous `player_id`; Tier 3 real accounts). XSS: `textContent`, never `innerHTML`, for user-submitted fields.
- **Provisioning + deploy (the codified part):** a NEW backend box is built once with
  `tool/provision-box.sh --host <ssh-host>`; backends are converged with
  `tool/sync-backends.sh --config <repo>/backends/config.json`. `config.json` shape:
  `{ server: {host, domain}, backends: { <slug>: {port} } }`; ports start at 8091, never reused.
- **PREREQS:** Caddy wildcard TLS uses Route53 DNS-01 — the hosted zone, AWS creds on the box, and `*.<domain>` record are account-specific and set up out of band (not automated).

- [ ] **Step 5: Write `references/pwa-shell.md`**

Adapt from vibe-demos CLAUDE.md section **"PWA shell pattern"**. Required content: the per-demo files (`manifest.webmanifest`, `icon.svg`, `sw.js` with cache name `vibe-<slug>-v1`, network-first HTML / cache-first assets, skip cross-origin); the head tags to inject; the SW registration snippet; cache-bump on meaningful change. Note `scaffold-demo.sh` writes a minimal version of all of these; this reference is how to extend them.

- [ ] **Step 6: Sanity-check + commit**

Run: `test -f ~/projects/vibe-studio/skills/vibe-studio/SKILL.md && head -3 ~/projects/vibe-studio/skills/vibe-studio/SKILL.md`
Expected: prints the frontmatter `---` / `name:` lines.

```bash
cd ~/projects/vibe-studio
git add skills/vibe-studio/SKILL.md skills/vibe-studio/references
git commit -q -m "feat(skill): vibe-studio SKILL.md + references (grammar, ai-method, backend, pwa)"
```

---

## Task 8: Portal scaffold — `index.html`, root PWA shell, thumbs

The editorial landing, genericized from vibe-demos' `index.html` and root `sw.js`, seeded with the two example demos' rows so `check-portal.sh` passes.

**Files:**
- Create: `~/projects/vibe-studio/index.html`
- Create: `~/projects/vibe-studio/sw.js`, `manifest.webmanifest`, `icon.svg`
- Create: `~/projects/vibe-studio/thumbs/placeholder.jpg` (any 1280×720 placeholder; copy an existing vibe-demos thumb)

- [ ] **Step 1: Create `index.html`**

Adapt `~/projects/vibe-demos/index.html`: keep the editorial styling and the `<section class="works" id="works">` grammar, but replace the author's 9 demo rows with exactly the two example rows below, and set the count to `02`. Keep marquee/header text generic ("a studio of small interactive demos"). The two rows:

```html
<div class="count">Index / 02 entries</div>
<a class="work" href="./_example-static/">
  <span class="num">01</span>
  <span class="title">Example <em>Static</em></span>
  <span class="tags">TIER 0<br>STATIC<br>LOCALSTORAGE</span>
  <span class="thumb"><img src="./thumbs/placeholder.jpg" alt="" loading="lazy"></span>
  <span class="year">2026</span>
  <span class="arrow">→</span>
</a>
<a class="work" href="./_example-backend/">
  <span class="num">02</span>
  <span class="title">Example <em>Backend</em></span>
  <span class="tags">TIER 1<br>POCKETBASE<br>SHARED STATE</span>
  <span class="thumb"><img src="./thumbs/placeholder.jpg" alt="" loading="lazy"></span>
  <span class="year">2026</span>
  <span class="arrow">→</span>
</a>
```

- [ ] **Step 2: Create the root PWA shell**

Adapt `~/projects/vibe-demos/sw.js` (cache name `vibe-root-v1`, `CACHE_PREFIX = "vibe-root-"`, subpath-exclusion fetch handler). Trim `SHELL` to: `"./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./thumbs/placeholder.jpg"`. Write a matching `manifest.webmanifest` (name "vibe-studio") and a simple `icon.svg`.

- [ ] **Step 3: Add a placeholder thumb**

```bash
cp ~/projects/vibe-demos/thumbs/resonans.jpg ~/projects/vibe-studio/thumbs/placeholder.jpg
```

- [ ] **Step 4: Verify check-portal passes against the real repo**

Run: `bash ~/projects/vibe-studio/skills/vibe-studio/tool/check-portal.sh --dir ~/projects/vibe-studio`
Expected: `portal matches demos.json ✓` (exit 0). If it fails, fix the index rows/count until it passes.

- [ ] **Step 5: Commit**

```bash
cd ~/projects/vibe-studio
git add index.html sw.js manifest.webmanifest icon.svg thumbs/placeholder.jpg
git commit -q -m "feat: editorial portal scaffold + root PWA shell"
```

---

## Task 9: `_example-static` — the worked Tier-0 demo

Replace the placeholder folder with a real, tiny, self-contained Tier-0 demo so cloners have a crib.

**Files:**
- Create/replace: `~/projects/vibe-studio/_example-static/{index.html,manifest.webmanifest,icon.svg,sw.js}`

- [ ] **Step 1: Generate the PWA shell via the tool, then flesh out index.html**

The folder already has a demos.json entry (Task 2). Use the scaffold tool's file pattern by hand here (the slug already exists, so the tool would refuse): write `manifest.webmanifest`, `icon.svg`, `sw.js` (cache `vibe-_example-static-v1`) per `references/pwa-shell.md`, and an `index.html` that is a complete minimal interactive toy (e.g. a localStorage tap-counter) demonstrating: theme-color, PWA head tags, SW registration, and a labeled "no backend — state is local" note.

- [ ] **Step 2: Verify it loads (static check)**

Run: `python3 -c "import html.parser,sys; html.parser.HTMLParser().feed(open('$HOME/projects/vibe-studio/_example-static/index.html').read()); print('ok')"`
Expected: `ok` (well-formed enough to parse).

- [ ] **Step 3: Commit**

```bash
cd ~/projects/vibe-studio
git add _example-static
git commit -q -m "feat: _example-static worked tier-0 demo"
```

---

## Task 10: `_example-backend` — the worked Tier-1 demo

A real Tier-1 demo demonstrating the PocketBase local-first pattern (health check, `● connected`/`○ local`, `textContent` rendering) + a migration file. Mirrors the tinywings leaderboard pattern but generic.

**Files:**
- Create/replace: `~/projects/vibe-studio/_example-backend/{index.html,manifest.webmanifest,icon.svg,sw.js}`
- Create: `~/projects/vibe-studio/_example-backend/pb/pb_migrations/001_init_guestbook.js`

- [ ] **Step 1: Write the migration**

```javascript
// _example-backend/pb/pb_migrations/001_init_guestbook.js
migrate((app) => {
  let collection = new Collection({
    type: "base",
    name: "guestbook",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "name", required: true, max: 20 },
      { type: "text", name: "message", required: true, max: 140 },
    ],
  });
  app.save(collection);
}, (app) => {
  let collection = app.findCollectionByNameOrId("guestbook");
  app.delete(collection);
});
```

- [ ] **Step 2: Write index.html + PWA files**

`index.html`: a guestbook that reads/writes the `guestbook` collection via `pocketbase@0.25.0` (CDN importmap in `<head>`), with `const PB_URL = 'https://_example-backend.pb.gurum.se';` replaced by a clearly-commented placeholder the cloner edits; the local-first fallback (health check on submit, `● connected`/`○ local` indicator, localStorage cache); `textContent` rendering (no innerHTML). Add the PWA files (`manifest.webmanifest`, `icon.svg`, `sw.js` cache `vibe-_example-backend-v1`, skip cross-origin from caching). Add the collection schema comment block at the top of the module script.

- [ ] **Step 3: Syntax-check the module script**

Extract the module body and run `node --check` per the CLAUDE.md guidance (or verify the migration parses):
Run: `node --check ~/projects/vibe-studio/_example-backend/pb/pb_migrations/001_init_guestbook.js`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
cd ~/projects/vibe-studio
git add _example-backend
git commit -q -m "feat: _example-backend worked tier-1 demo (PocketBase guestbook)"
```

---

## Task 11: Migrate `lovable-harness` into `skills/lovable-dev/tool/` (history preserved)

The risky task. Use `git subtree` to bring the whole repo in under the prefix, preserving its commit history. Internal structure stays intact. Gate: its existing `bats` suite passes unchanged before AND after.

**Files:**
- Create: `~/projects/vibe-studio/skills/lovable-dev/tool/` (subtree)

- [ ] **Step 1: Record the lovable-harness bats baseline (pre-move)**

Run: `cd ~/projects/lovable-harness && bats tests/ 2>&1 | tail -3`
Expected: all pass. **Record the exact pass count** (this is the no-regression baseline). Note: `tests/lovable-auth-shim.test.ts` is a non-bats file; only `.bats` files count.

- [ ] **Step 2: Subtree-add the repo under the tool prefix**

The `skills/lovable-dev/` dir currently has only `references/` (empty) from Task 1 — `git subtree add` requires the prefix not exist, so add directly to `skills/lovable-dev/tool`:

```bash
cd ~/projects/vibe-studio
# ensure clean tree
git status --porcelain
git subtree add --prefix=skills/lovable-dev/tool "$HOME/projects/lovable-harness" main
```

Expected: a merge commit; `skills/lovable-dev/tool/bin/lovable`, `lib/`, `provisioning/`, `apps.json`, `tests/`, etc. now present with history.

- [ ] **Step 3: Verify the move is intact + bats passes at the new location**

```bash
ls ~/projects/vibe-studio/skills/lovable-dev/tool/bin/lovable
cd ~/projects/vibe-studio/skills/lovable-dev/tool && bats tests/ 2>&1 | tail -3
```
Expected: same pass count as Step 1 (internal relative paths unchanged, so tests pass identically).

- [ ] **Step 4: Commit** (subtree add already created commits; this just confirms tree state)

```bash
cd ~/projects/vibe-studio
git log --oneline -3
# no extra commit needed if subtree created one; otherwise:
git add -A && git commit -q -m "chore: confirm lovable-harness subtree at skills/lovable-dev/tool" || true
```

---

## Task 12: `lovable-dev` skill — SKILL.md + references

**Files:**
- Create: `~/projects/vibe-studio/skills/lovable-dev/SKILL.md`
- Create: `~/projects/vibe-studio/skills/lovable-dev/references/supabase-local.md`
- Create: `~/projects/vibe-studio/skills/lovable-dev/references/reimport-to-lovable.md`

- [ ] **Step 1: Write `SKILL.md`**

```markdown
---
name: lovable-dev
description: Use when developing, running, testing, or fixing a Lovable app locally to save paid Lovable credits — the tier-2 vibe-studio workflow. Reproduces the app's Supabase backend locally, runs the real dev server behind a tunnel, and pushes fixes back for Lovable to re-import. Use when the user mentions a Lovable app, running a Lovable project outside credits, or the lovable harness. For static (tier 0) or self-hosted-backend (tier 1) demos, use the vibe-studio skill instead.
---

# lovable-dev (Tier 2)

A Lovable app is just another vibe demo — it differs only in where it runs (Lovable / local)
and what it costs (paid credits). This skill drives the bundled lovable-harness tool to do
the bulk of development locally, reserving Lovable credits for final polish.

## The loop
1. `up <app>` — clone, deps, Supabase local, env, dev server + Cloudflare tunnel (tmux).
2. Edit + test live in browser / on phone via the tunnel URL.
3. `git push origin main` — Lovable auto-re-imports from the synced branch.
4. Final polish in Lovable.

## Tool
The tool is the migrated lovable-harness, at:
`${CLAUDE_PLUGIN_ROOT}/skills/lovable-dev/tool/bin/lovable <up|down|status|url|logs|attach> [app]`
(or `skills/lovable-dev/tool/bin/lovable …` when working inside the repo).
Apps are declared in `skills/lovable-dev/tool/apps.json`. It can still be run standalone.

## References
- `references/supabase-local.md` — how the local Supabase backend reproduces Lovable Cloud.
- `references/reimport-to-lovable.md` — the push-back / re-import contract.

## Registering a tier-2 demo in the studio
A Lovable app you want listed in the studio portal gets a `demos.json` entry with
`tier: 2`, an absolute external `url` (its Lovable/prod URL), and `repo`. It is listed in
the portal but excluded from the root SW shell (different origin). Then run the vibe-studio
tool's `check-portal.sh`.
```

- [ ] **Step 2: Write the two references**

- `references/supabase-local.md` — adapt from `skills/lovable-dev/tool/README.md` and `docs/2026-05-30-lovable-harness-design.md` (now under the tool): why Lovable's managed Supabase is reproduced locally via the Supabase CLI, the `supabase_exclude` flags, the `@lovable.dev/cloud-auth-js` shim, the `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` tunnel-host mechanism.
- `references/reimport-to-lovable.md` — the contract: develop on the synced branch, `git push origin main`, Lovable re-imports; reserve credits for polish; the app repo stays external (only `apps.json` is harness config).

- [ ] **Step 3: Commit**

```bash
cd ~/projects/vibe-studio
git add skills/lovable-dev/SKILL.md skills/lovable-dev/references
git commit -q -m "feat(skill): lovable-dev SKILL.md + references (tier 2)"
```

---

## Task 13: `plugin.json` + kit `CLAUDE.md`

**Files:**
- Create: `~/projects/vibe-studio/.claude-plugin/plugin.json`
- Create: `~/projects/vibe-studio/CLAUDE.md`

- [ ] **Step 1: Write `plugin.json`**

```json
{
  "name": "vibe-studio",
  "description": "Build a studio of polished interactive demos. Static (tier 0), self-hosted PocketBase backend (tier 1), and optional Lovable (tier 2) demos, with an editorial portal, a canned-first AI-demo pattern, and an installable PWA shell. demos.json is the source of truth.",
  "author": { "name": "kalleeh" }
}
```

- [ ] **Step 2: Write a kit-generic `CLAUDE.md`**

A short repo guide (NOT a copy of vibe-demos' CLAUDE.md — the depth now lives in the skills). Required content: this is a vibe-studio kit; demos.json is the source of truth; the `vibe-studio` skill handles tier 0/1 and the `lovable-dev` skill handles tier 2; no build tool, push = deploy; point readers to the two skills' SKILL.md for how-to. ~30–50 lines.

- [ ] **Step 3: Validate plugin.json parses**

Run: `jq -e '.name == "vibe-studio"' ~/projects/vibe-studio/.claude-plugin/plugin.json`
Expected: `true`.

- [ ] **Step 4: Commit**

```bash
cd ~/projects/vibe-studio
git add .claude-plugin/plugin.json CLAUDE.md
git commit -q -m "feat: plugin.json manifest + kit CLAUDE.md"
```

---

## Task 14: Phase 2 — wire seamlessly + full verification

Confirm everything works together in the new structure. No new features — verification + any path fixes surfaced.

**Files:**
- Modify (only if a path bug is found): any `tool/*.sh` or `SKILL.md`

- [ ] **Step 1: Run the full vibe-studio tool bats suite**

Run: `cd ~/projects/vibe-studio/skills/vibe-studio/tool && bats tests/`
Expected: PASS (check-portal 3 + scaffold-demo 5 + provision-box 2 + sync-backends 2 = 12 tests).

- [ ] **Step 2: Run the migrated lovable tool bats suite**

Run: `cd ~/projects/vibe-studio/skills/lovable-dev/tool && bats tests/`
Expected: PASS with the SAME count recorded in Task 11 Step 1 (no regression).

- [ ] **Step 3: End-to-end dry-run of the studio loop (no live box)**

```bash
cd ~/projects/vibe-studio
# scaffold a throwaway tier-1 demo into a temp copy of the repo to avoid dirtying demos.json
T="$(mktemp -d)"; cp demos.json "$T/"; mkdir -p "$T/thumbs"; cp index.html "$T/" 2>/dev/null || true
bash skills/vibe-studio/tool/scaffold-demo.sh --dir "$T" --slug throwaway --title "Throw" --tier 1
jq -e '.demos[] | select(.slug=="throwaway") | .backend=="pocketbase"' "$T/demos.json"
SYNC_DRYRUN=1 bash skills/vibe-studio/tool/sync-backends.sh --config <(echo '{"server":{"host":"h","domain":"d.example"},"backends":{"throwaway":{"port":8099}}}') | grep -q throwaway && echo "sync dry-run ok"
PROVISION_DRYRUN=1 bash skills/vibe-studio/tool/provision-box.sh --host h | grep -q pocketbase && echo "provision dry-run ok"
rm -rf "$T"
```
Expected: the jq check passes, and both "ok" lines print.

- [ ] **Step 4: Verify the two skills' descriptions do not collide**

Read both `SKILL.md` frontmatter `description:` lines. Confirm: `vibe-studio` triggers on building/adding demos + backend + portal; `lovable-dev` triggers on Lovable-app work. They must not both claim the same intent. Fix wording if they overlap.

- [ ] **Step 5: Final portal check + commit any fixes**

```bash
cd ~/projects/vibe-studio
bash skills/vibe-studio/tool/check-portal.sh --dir .
git add -A && git commit -q -m "test: full-suite + e2e dry-run verification (phase 2)" || echo "nothing to commit"
```

---

## Task 15: Phase 3 — reconcile live environments + delete old repo (MANUAL)

> **This task touches live infrastructure and is intentionally MANUAL.** Do not automate. Execute interactively with the user, verifying each step against the real boxes. The earlier tasks tolerate mid-flight breakage; this is where the live boxes and the vibe-demos consumer are brought into agreement with the new structure, and only then is the old repo deleted.

- [ ] **Step 1: Push `vibe-studio` to a new remote** (confirm name with the user first)

```bash
cd ~/projects/vibe-studio
gh repo create kalleeh/vibe-studio --private --source=. --remote=origin --push
```

- [ ] **Step 2: Reconcile the lovable box** — confirm `skills/lovable-dev/tool/bin/lovable status` works against the existing lovable Lightsail box from the new path; run a real `up <app>` / `down` cycle on a throwaway app. Fix any `${CLAUDE_PLUGIN_ROOT}`/path assumptions surfaced.

- [ ] **Step 3: Reconcile the PocketBase box** — point `sync-backends.sh --config ~/projects/vibe-demos/backends/config.json` at the live `pb-backends` box in DRY-RUN first (`SYNC_DRYRUN=1`), diff against the current server state, then run for real. Confirm `tinywings` still serves. (Optionally validate `provision-box.sh` on a fresh throwaway Lightsail box, then destroy it.)

- [ ] **Step 4: Decide vibe-demos' relationship to the kit** — with the user: does vibe-demos adopt `vibe-studio` as an installed plugin (its `sync-backends.sh` becomes a one-line forwarder to the kit tool), or stay independent? Record the decision; make the agreed change.

- [ ] **Step 5: Delete the old `lovable-harness` repo — ONLY after Steps 2–4 verify end-to-end.**

```bash
# local
rm -rf ~/projects/lovable-harness
# remote (confirm with user; irreversible)
gh repo delete kalleeh/lovable-harness --yes
```

- [ ] **Step 6: Final commit / push**

```bash
cd ~/projects/vibe-studio && git add -A && git commit -q -m "chore: phase 3 reconciliation complete" && git push
```

---

## Self-review notes (filled by plan author)

- **Spec coverage:** plugin+template (Tasks 1,8,13); demos.json source-of-truth (2); no-build verifier (3); scaffold (4); codified provisioning gap (5); generalized sync (6); vibe-studio skill+references incl. the AI-demo crown jewel (7); example demos per tier (9,10); history-preserving lovable migration gated by bats (11); lovable-dev skill (12); two-skill coherent shape (7,12); three-phase delivery incl. manual reconciliation + delete-last (14,15). All spec sections mapped.
- **Placeholder scan:** the markdown knowledge files (Task 7,12 references) are specified as named-section extractions of vibe-demos/CLAUDE.md with required-content lists — actionable transforms of known source, not "TBD".
- **Type/name consistency:** `demos.json` `.demos[]` array with `{slug,title,tier,url,backend?,repo?,tags,year}` used identically across Tasks 2,3,4,8,14; tool paths `skills/<skill>/tool/<script>.sh` consistent; cache names `vibe-<slug>-v1` and `vibe-root-v1` consistent; `--config`/`--dir`/`--host`/`--slug` flags consistent across tool + tests.
- **Known deferrals (per spec):** public marketplace publish; deep provisioning hardening beyond a working script; any continuum involvement.
- **Risk control:** lovable migrated intact via subtree (history preserved), bats baseline is the gate (Task 11), old repo deleted only after live reconciliation (Task 15 Step 5); breakage tolerated mid-flight per the user's explicit call.
```
