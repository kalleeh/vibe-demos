---
paths:
  - "*/sw.js"
  - "*/manifest.webmanifest"
  - "sw.js"
  - "manifest.webmanifest"
---

# PWA shell pattern

Every demo (and the root studio landing) ships as an installable PWA. Each demo is its own scoped app — adding it to home screen caches only that demo's files and shows only its name/icon/theme. The root has its own thin shell that does NOT shadow demo subroutes.

Reference implementations: `intake-companion/sw.js` (canonical demo SW), root `sw.js` (root SW with subpath exclusion), `korean-mbti/sw.js` (example with `api.anthropic.com` skipped from caching).

## Per-demo files

Each `<slug>/` folder has, alongside `index.html`:
- `manifest.webmanifest` — name, short_name, theme/background colors, `lang` (typically `"ko"`), `start_url: "./"`, `scope: "./"`, `display: "standalone"`, single SVG icon `purpose: "any maskable"`.
- `icon.svg` — distinctive editorial glyph per demo (NOT a shared mark).
- `sw.js` — scoped to the demo folder. Cache name `vibe-<slug>-v1`. **Network-first for HTML** (deploys propagate), **cache-first for assets** (instant repeat loads). Skip `api.anthropic.com` from caching for AI demos.

## Per-demo head tags

Inject inside `<head>`, after charset/viewport/title:

```html
<link rel="icon" type="image/svg+xml" href="icon.svg">
<link rel="apple-touch-icon" href="icon.svg">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="<demo theme color>">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="<black-translucent | default>">
<meta name="apple-mobile-web-app-title" content="<short title>">
```

## Service worker registration

Inject before `</body>`:

```html
<script>
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
</script>
```

## Root SW must not shadow demo SWs

The root `sw.js` is scoped to `./` (the whole deployment). Its `fetch` handler skips any path containing `/` after the scope root, so a demo subroute is handled exclusively by that demo's SW once registered:

```js
const root = new URL(self.registration.scope);
const path = url.pathname.slice(root.pathname.length);
if (path.includes("/")) return; // belongs to a demo SW
```

## Cache invalidation

When a demo ships a meaningful change, bump its cache name (`vibe-<slug>-v1` → `v2`). The activate handler already deletes caches that don't match the current name.
