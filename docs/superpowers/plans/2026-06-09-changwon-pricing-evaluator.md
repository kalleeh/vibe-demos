# Changwon Pricing Evaluator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a layered pricing evaluator to each property's size-band card in `changwon-homes`: a model-predicted fair-price range (deterministic, from the hedonic coefficients already in the data), a collapsible per-factor rationale ledger, and an optional on-demand AI natural-language explanation via the Bedrock proxy.

**Architecture:** A pure `fairPrice(h, x)` function predicts the fair 평단가 by adjusting the peer-average 평단가 with the published regression coefficients (`data.json.meta.hedonic`) for THIS unit's attribute deltas vs. its peers; results attach to each `_band` as `x.fair` during the existing `recompute()`. `bandBlock()` renders the fair-price headline + collapsible ledger; an "AI 평가 보기" button calls the proxy (Sonnet) on demand, fed only the computed numbers. Deterministic Layers 1–2 always render; generative Layer 3 is opt-in and degrades gracefully.

**Tech Stack:** Plain static HTML/JS (no build tool), the existing changwon-homes hedonic data, the live Bedrock proxy at `https://ai.pb.gurum.se` (PoW-gated), Web Crypto for the PoW solve.

**Spec:** `docs/superpowers/specs/2026-06-09-changwon-pricing-evaluator-design.md`.

---

## Important constraints

- **Plain static HTML/JS — NO build tool, NO package.json.** Edit `changwon-homes/index.html` (+ `sw.js` cache bump). All JS is in one classic `<script>`.
- **Reuse existing helpers, don't duplicate:** `bandPPP`, `bandPrice`, `bandPeers`, `clamp`, `scoreColor`, `fmtEok`, `fmtPPP`, `pct`, `esc`, the `mode` global, `priceLabel`. Units: sale/jeonse metric is 억 (×10000 → 만원); `bandPPP` returns 만원/평.
- **Sign care (from spec):** the hedonic DV is `log(만원/평)`; coefficients are log-elasticities applied multiplicatively as `exp(Σ coef·Δ)`. Age uses `age = REF_YEAR − built` so older-than-peers (positive Δage) × `agePerYear`(−0.041) lowers price. `dcore` is km-to-core; farther (positive Δ) × `distCorePerKm`(−0.073) lowers price. `brand` is 0/1; branded vs peer-fraction × `brand`(+0.136) raises price.
- **Honesty:** fair price is ALWAYS a range + the caveat "공개 실거래가 기반 모델 추정치 · 감정평가 아님". Never a bare point estimate.
- **Mode handling:** show the full evaluator for **sale + jeonse** (where a 적정 억 figure is meaningful). For **wolse**, skip Layer 1's 억 headline (show nothing new, or the existing card unchanged) — guarded by `if (mode === "wolse") return "";` in the evaluator render.
- **AI layer:** model `"sonnet"`, on-demand button, fed only computed numbers, graceful 429/503 fallback, labeled. The proxy + PoW pattern is identical to the 4 AI demos.
- **Verification:** no unit-test framework — use `node --check`-style syntax validation by extracting the script, plus a headless Playwright smoke against the real deployed demo where useful. The fair-price math gets a **standalone Node unit test** (pure function, no DOM) — this is the one piece with real logic worth testing in isolation.

---

## File Structure

```
changwon-homes/
├── index.html   ← ALL changes: fairPrice() fn, recompute() hook, bandBlock() UI (Layers 1-2),
│                   the AI button + solveProxyPoW + proxy call (Layer 3), CSS for the new card
└── sw.js        ← cache version bump
```

One file. The work decomposes into: (1) the pure `fairPrice` function + its unit test, (2) wiring it into `recompute`, (3) Layer-1 UI + CSS, (4) Layer-2 ledger UI, (5) Layer-3 AI button + proxy call, (6) SW bump + verification.

---

## Task 1: The `fairPrice(h, x)` pure function + standalone unit test

**Files:**
- Modify: `changwon-homes/index.html` (add `fairPrice` near `bandFactors`, ~line 557)
- Create (temp, deleted in Task 6): `changwon-homes/_fairprice.test.mjs`

- [ ] **Step 1: Write the function.** Insert immediately AFTER `bandFactors` (before `DEFAULT_WEIGHTS`, ~line 581). It must be pure (no DOM) so it's testable and so `recompute` can call it per band. It reads `H` from a module-level const added in Step 2.

```javascript
/* ---- FAIR-PRICE ESTIMATE (hedonic prediction) ----
   Predict this unit's fair 평단가 by adjusting the peer-average 평단가 with the
   published regression coefficients (data.json.meta.hedonic) for THIS unit's
   attribute deltas vs. its peers. DV is log(만원/평) → adjustments are
   multiplicative: predicted = baseline * exp(Σ coef·Δ). Returns null when there's
   no usable peer baseline. Pure (no DOM) — unit-tested in _fairprice.test.mjs. ---- */
const REF_YEAR = 2026; // contract-period reference for age (data is 2025-06~2026-06)
function fairPrice(h, x, H){
  const baseline = x.avgPPP;            // peer-average 평단가 (만원/평), already floor-normalized
  const ppp = x.ppp;                    // this unit's 평단가
  if(baseline==null || ppp==null || !x.peers || !x.peers.length) return null;

  // peer means/fractions over the peer COMPLEXES (p.h) for the attributes we adjust on
  const peers = x.peers;
  const mean = (sel) => { let s=0,n=0; for(const p of peers){ const v=sel(p); if(v!=null){s+=v;n++;} } return n?s/n:null; };
  const peerDcore = mean(p=>p.h.dcore);
  const peerAge   = mean(p=>p.h.built!=null ? (REF_YEAR - p.h.built) : null);
  const peerBrand = mean(p=>p.h.brand?1:0);

  const ledger = [{ label:"인근 평균 평단가", ppp: baseline, pct: null }];
  let logAdj = 0;

  // LOCATION: distance to 신도시 core, coef<0 (farther → cheaper)
  if(h.dcore!=null && peerDcore!=null){
    const d = h.dcore - peerDcore;
    if(Math.abs(d) > 0.05){ const a = H.distCorePerKm * d; logAdj += a;
      ledger.push({ label:`신도시 코어 ${h.dcore.toFixed(1)}km`, pct: (Math.exp(a)-1)*100 }); }
  }
  // AGE: coef<0 per year of age (older → cheaper). age = REF_YEAR - built.
  if(h.built!=null && peerAge!=null){
    const thisAge = REF_YEAR - h.built;
    const dAge = thisAge - peerAge;     // older-than-peers → positive → ×(−)→ down
    if(Math.abs(dAge) >= 1){ const a = H.agePerYear * dAge; logAdj += a;
      ledger.push({ label:`${h.built}년식${dAge<0?" (신축 편)":dAge>0?" (구축 편)":""}`, pct:(Math.exp(a)-1)*100 }); }
  }
  // BRAND: coef>0 (branded → pricier)
  if(peerBrand!=null){
    const d = (h.brand?1:0) - peerBrand;
    if(Math.abs(d) > 0.05){ const a = H.brand * d; logAdj += a;
      ledger.push({ label: h.brand?"브랜드 단지":"비브랜드", pct:(Math.exp(a)-1)*100 }); }
  }
  // FLOOR: low/top penalties (coef<0). Uses this band's median floor vs building height.
  if(x.b.floor!=null && h.maxFloor){
    const rel = x.b.floor/Math.max(h.maxFloor,3);
    let a = 0, lab = null;
    if(x.b.floor<=2 || rel<0.15){ a = H.floorLow; lab = `저층(${x.b.floor}층)`; }
    else if(rel>=0.92){ a = H.floorTop; lab = `탑층(${x.b.floor}층)`; }
    if(a){ logAdj += a; ledger.push({ label: lab, pct:(Math.exp(a)-1)*100 }); }
  }

  const predPPP = baseline * Math.exp(logAdj);
  ledger.push({ label:"예상 적정 평단가", ppp: predPPP, pct: null, total:true });

  // observed vs predicted (positive deltaPct = OVER fair, negative = UNDER fair = 저평가)
  const deltaPct = (ppp - predPPP) / predPPP * 100;

  // confidence band: fixed ±9% (model uncertainty at R²=0.69; NOT a per-unit interval)
  const BAND = 0.09;
  return {
    predPPP,
    lowPPP: predPPP*(1-BAND), highPPP: predPPP*(1+BAND),
    deltaPct, ledger,
  };
}
```

- [ ] **Step 2: Source the coefficients — REUSE the existing `DATA_META` global (confirmed).** The app already sets `DATA_META = data.meta` (~line 483) and reads `DATA_META.hedonic` elsewhere (~line 1119). So `fairPrice`'s caller passes `DATA_META.hedonic` as `H` — **do NOT add a new global**. (`fairPrice` still takes `H` as a param to stay pure/testable.) Confirmed available fields on each HOME: `h.dcore`, `h.brand` (bool), `h.built`, `h.maxFloor`; on each band: `x.b.floor`, `x.b.pyeong`. No data changes needed.

- [ ] **Step 3: Write the standalone unit test.** Create `changwon-homes/_fairprice.test.mjs` — copy the `fairPrice` + `REF_YEAR` source into it (it's pure), add the real coefficients, and assert directional correctness + a worked number:

```javascript
// _fairprice.test.mjs — node _fairprice.test.mjs
const REF_YEAR = 2026;
// <PASTE the exact fairPrice function body from index.html here>

const H = { distCorePerKm:-0.073, brand:0.136, agePerYear:-0.041, floorLow:-0.037, floorTop:-0.091 };
let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;} else {fail++; console.log("FAIL:",m);} };

// Peer set: 3 peers at 1000만/평, core 2.0km, built 2010, no brand, mid floor.
const peers = [0,1,2].map(()=>({ h:{dcore:2.0, built:2010, brand:0, maxFloor:15}, b:{floor:8,pyeong:30} }));
const mkX = (overrides) => ({ avgPPP:1000, ppp:1000, peers, b:{floor:8,pyeong:30,...(overrides.b||{})} });

// 1. Identical-to-peers unit → predicted ≈ baseline, delta ≈ 0
{ const h={dcore:2.0,built:2010,brand:0,maxFloor:15};
  const r=fairPrice(h, mkX({}), H);
  ok(Math.abs(r.predPPP-1000)<1, `identical unit predicts baseline, got ${r.predPPP}`);
  ok(Math.abs(r.deltaPct)<0.5, `identical unit delta~0, got ${r.deltaPct}`); }

// 2. Closer to core than peers → fair price HIGHER (predPPP > baseline)
{ const h={dcore:0.5,built:2010,brand:0,maxFloor:15};
  const r=fairPrice(h, mkX({}), H);
  ok(r.predPPP>1000, `closer-to-core → higher fair price, got ${r.predPPP}`); }

// 3. Newer than peers (built 2022 vs 2010) → fair price HIGHER
{ const h={dcore:2.0,built:2022,brand:0,maxFloor:15};
  const r=fairPrice(h, mkX({}), H);
  ok(r.predPPP>1000, `newer → higher fair price, got ${r.predPPP}`); }

// 4. Older than peers (built 1995) → fair price LOWER
{ const h={dcore:2.0,built:1995,brand:0,maxFloor:15};
  const r=fairPrice(h, mkX({}), H);
  ok(r.predPPP<1000, `older → lower fair price, got ${r.predPPP}`); }

// 5. Low floor → penalty applied (ledger has a 저층 row, predPPP < baseline-equivalent)
{ const h={dcore:2.0,built:2010,brand:0,maxFloor:15};
  const r=fairPrice(h, mkX({b:{floor:1}}), H);
  ok(r.ledger.some(l=>/저층/.test(l.label||"")), "low floor adds a 저층 ledger row"); }

// 6. Observed BELOW predicted → negative deltaPct (= 저평가)
{ const h={dcore:0.5,built:2022,brand:1,maxFloor:15};
  const x=mkX({}); x.ppp=900; // observed cheaper than a high fair price
  const r=fairPrice(h, x, H);
  ok(r.deltaPct<0, `observed<predicted → negative delta (저평가), got ${r.deltaPct}`); }

// 7. No peers → null
ok(fairPrice({dcore:2,built:2010,brand:0,maxFloor:15}, {avgPPP:1000,ppp:1000,peers:[],b:{floor:8,pyeong:30}}, H)===null, "no peers → null");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
```

- [ ] **Step 4: Run the test, expect all pass.**
```bash
cd /home/ubuntu/projects/vibe-demos/changwon-homes
node _fairprice.test.mjs
```
Expected: `7 passed, 0 failed`. If a directional assertion fails, the sign of an adjustment is wrong — fix in `fairPrice` (and mirror the fix into index.html).

- [ ] **Step 5: Commit** (test file stays uncommitted — deleted in Task 6; commit only index.html):
```bash
cd /home/ubuntu/projects/vibe-demos
git add changwon-homes/index.html
git commit -m "changwon: add fairPrice() hedonic prediction (pure fn)"
```

---

## Task 2: Wire `fairPrice` into `recompute()`

**Files:** Modify `changwon-homes/index.html` (`recompute`, ~line 596)

- [ ] **Step 1: Attach `x.fair` per band.** In `recompute()`, the per-band loop pushes `{ b, peers, avgPrice, avgPPP, ppp, factors, score }`. After computing `factors`/`score`, add `fair`. Find:
```javascript
      h._bands.push({ b, peers, avgPrice, avgPPP, ppp:bandPPP(b), factors,
                      score:blendScore(factors,h) });
```
Replace with:
```javascript
      const band = { b, peers, avgPrice, avgPPP, ppp:bandPPP(b), factors,
                     score:blendScore(factors,h) };
      band.fair = fairPrice(h, band, DATA_META.hedonic);   // hedonic fair-price estimate (null if no peers)
      h._bands.push(band);
```
(Uses the existing `DATA_META.hedonic` — confirmed present, no new global.)

- [ ] **Step 2: Syntax check.**
```bash
cd /home/ubuntu/projects/vibe-demos
node -e "const h=require('fs').readFileSync('changwon-homes/index.html','utf8'); const m=h.match(/<script>([\s\S]*)<\/script>\s*<\/body>/); /* fallback: just confirm file parses structurally */ console.log('readable', h.length>0)"
```
Then extract the main `<script>` and `node --check` it:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('changwon-homes/index.html','utf8');const s=h.split('<script>').pop().split('</script>')[0];fs.writeFileSync('/tmp/cw.mjs', s);" && node --check /tmp/cw.mjs && echo "SCRIPT SYNTAX OK"
```
Expected: `SCRIPT SYNTAX OK`. (If the page has multiple `<script>` blocks, target the one containing `recompute` — adjust the split. Leaflet/global libs may use bare names but `--check` is syntax-only.)

- [ ] **Step 3: Commit.**
```bash
git add changwon-homes/index.html
git commit -m "changwon: compute x.fair per band in recompute()"
```

---

## Task 3: Layer 1 — fair-price headline card + CSS (sale/jeonse only)

**Files:** Modify `changwon-homes/index.html` — CSS (in `<style>`) + `bandBlock` (~line 760)

- [ ] **Step 1: Add CSS** near the existing `.bandcard`/`.delta` rules (~line 195). Reuses the app's tokens (`--line`, `--good`, `--bad`, `--muted`, Fraunces):
```css
  /* ── fair-price evaluator card ── */
  .fair{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 12px;background:#fff}
  .fair .lbl{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);font-weight:600}
  .fair .row{display:flex;align-items:baseline;gap:8px;margin-top:5px}
  .fair .obs{font-family:"Fraunces",serif;font-size:26px;font-weight:500;font-variant-numeric:tabular-nums}
  .fair .obs small{font-size:12px;color:var(--muted);font-weight:400;font-family:inherit}
  .fair .verdict{margin-left:auto;font-weight:700;font-size:13px;white-space:nowrap}
  .fair .verdict.under{color:var(--good)} .fair .verdict.over{color:var(--bad)} .fair .verdict.fair{color:var(--muted)}
  .fair .est{font-size:12px;color:var(--muted);margin-top:3px}
  .fair .est b{color:var(--ink)}
  .fair .fbar{position:relative;height:7px;background:#eee7d8;border-radius:4px;margin-top:9px}
  .fair .fbar .fobs{position:absolute;top:0;height:100%;border-radius:4px}
  .fair .fbar .fexp{position:absolute;top:-3px;width:2px;height:13px;background:var(--bad)}
  .fair .caveat{font-size:10px;color:var(--muted);margin-top:7px;font-style:italic}
```

- [ ] **Step 2: Add the render helper** above `bandBlock` (~line 759). It produces the Layer-1 card (and is the container the Layer-2 ledger + Layer-3 button get appended into in Tasks 4–5):
```javascript
/* Layer 1: fair-price headline. Returns "" for wolse or when no estimate. */
function fairCard(h, x){
  if(mode==="wolse" || !x.fair) return "";
  const f = x.fair;
  // observed/predicted in 억 for sale/jeonse (bandPrice metric is 억). predPPP is 만원/평
  // → convert back to 억 via this band's pyeong: 억 = ppp(만원/평)*pyeong/10000.
  const toEok = ppp => ppp * x.b.pyeong / 10000;
  const obs = bandPrice(x.b);                 // 억
  const lo = toEok(f.lowPPP), hi = toEok(f.highPPP);
  const d = f.deltaPct;
  const vcls = d < -2.5 ? "under" : d > 2.5 ? "over" : "fair";
  const vword = d < -2.5 ? `${Math.abs(Math.round(d))}% 저평가 ↓`
              : d > 2.5 ? `${Math.round(d)}% 고평가 ↑` : "적정가 수준";
  // bar: observed vs the expected midpoint, scaled to expected*2
  const expMid = toEok(f.predPPP), scale = expMid*2;
  const obsW = Math.max(4, Math.min(98, obs/scale*100));
  const expW = Math.max(4, Math.min(98, expMid/scale*100));
  const obsColor = scoreColor(d < -2.5 ? 8 : d > 2.5 ? 2.5 : 5);
  return `
    <div class="fair">
      <div class="lbl">적정가 평가</div>
      <div class="row">
        <span class="obs">${fmtEok(obs)}<small> 실거래</small></span>
        <span class="verdict ${vcls}">${vword}</span>
      </div>
      <div class="est">예상 적정가 <b>${fmtEok(lo)}–${fmtEok(hi)}</b> · 회귀모델 (R²=0.69, 실거래 ${DATA_META.hedonic.n.toLocaleString()}건)</div>
      <div class="fbar">
        <div class="fobs" style="width:${obsW}%;background:${obsColor}"></div>
        <div class="fexp" style="left:${expW}%"></div>
      </div>
      <div class="caveat">공개 실거래가 기반 모델 추정치 · 감정평가 아님</div>
      <div class="fair-explain" data-id="${h.id}" data-pyeong="${x.b.pyeong}"></div>
    </div>`;
}
```

- [ ] **Step 2b: Insert the card** at the TOP of the `bandBlock` return, right after `<div class="bandcard">`:
```javascript
    <div class="bandcard">
      ${fairCard(h, x)}
      <div class="bandhead">
```

- [ ] **Step 3: Verify it renders.** Deploy isn't needed for a visual check — open locally. Headless smoke: load the page, click a marker (or call `openPanel` for a known id), assert a `.fair` element exists with text containing "적정가". Use the cached chromium (chrome-linux64) + playwright at `/tmp/node_modules`. Write `changwon-homes/_smoke.mjs`:
```javascript
import { chromium } from 'playwright';
import { readdirSync } from 'fs';
const root='/home/ubuntu/.cache/ms-playwright';
const dir=readdirSync(root).find(d=>d.startsWith('chromium-')&&!d.includes('headless'));
const b=await chromium.launch({executablePath:`${root}/${dir}/chrome-linux64/chrome`,args:['--no-sandbox']});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file:///home/ubuntu/projects/vibe-demos/changwon-homes/index.html');
await p.waitForTimeout(2500);
// open the first complex's panel via the app's own API
const opened = await p.evaluate(()=>{ const h=(window.HOMES||[]).find(x=>x._bands&&x._bands.length&&x._bands.some(b=>b.fair)); if(!h) return false; openPanel(h.id); return true; });
await p.waitForTimeout(500);
const hasFair = await p.evaluate(()=>{ const el=document.querySelector('.fair'); return el && /적정가/.test(el.textContent); });
await b.close();
console.log('pageerrors:', errs); console.log('opened:', opened, 'fair card:', hasFair);
if(errs.length || !hasFair){ console.log('SMOKE FAIL'); process.exit(1);} console.log('SMOKE OK');
```
Run (NODE_PATH for playwright):
```bash
cd /home/ubuntu/projects/vibe-demos && NODE_PATH=/tmp/node_modules node changwon-homes/_smoke.mjs
```
Expected: `fair card: true`, `SMOKE OK`, no pageerrors. (If `HOMES`/`openPanel` aren't on `window`, the smoke's evaluate returns false — in that case verify by checking the rendered HTML string from `bandBlock` instead, or expose nothing and rely on the next deploy check. Note which.)

- [ ] **Step 4: Commit.**
```bash
git add changwon-homes/index.html
git commit -m "changwon: Layer 1 fair-price headline card (sale/jeonse)"
```

---

## Task 4: Layer 2 — collapsible per-factor ledger

**Files:** Modify `changwon-homes/index.html` — CSS + `fairCard`

- [ ] **Step 1: Add ledger CSS** (after the `.fair` rules from Task 3):
```css
  .fair .ledger{margin-top:10px}
  .fair .ledger summary{cursor:pointer;font-size:11.5px;font-weight:600;color:var(--teal-deep);list-style:none}
  .fair .ledger summary::-webkit-details-marker{display:none}
  .fair .ledger .chev{display:inline-block;transition:transform .2s}
  .fair .ledger[open] summary .chev{transform:rotate(90deg)}
  .fair .ltable{font-family:var(--mono,monospace);font-size:11.5px;margin-top:8px}
  .fair .lrow{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0ebdf}
  .fair .lrow.tot{font-weight:700;border-bottom:0;border-top:1px solid var(--line);padding-top:6px;font-family:inherit}
  .fair .lrow .up{color:var(--good)} .fair .lrow .dn{color:var(--bad)}
```

- [ ] **Step 2: Render the ledger** inside `fairCard`, between the `.caveat` and the `.fair-explain` div. Build rows from `f.ledger` (each entry is `{label, ppp?, pct?, total?}`):
```javascript
      <details class="ledger">
        <summary><span class="chev">›</span> 적정가 산출 근거</summary>
        <div class="ltable">
          ${f.ledger.map(l=>{
            const right = l.ppp!=null
              ? `${Math.round(l.ppp).toLocaleString()}만/평`
              : `<span class="${l.pct>=0?'up':'dn'}">${l.pct>=0?'+':''}${l.pct.toFixed(1)}%</span>`;
            return `<div class="lrow${l.total?' tot':''}"><span>${l.total?'= ':''}${esc(l.label)}</span><span>${right}</span></div>`;
          }).join("")}
        </div>
      </details>
```
Insert it so card order is: headline → `.fair-explain` (Layer-3 slot, Task 5) → ledger. Adjust the `fairCard` template so the final structure is: `lbl, row, est, fbar, caveat, <div class="fair-explain">…</div>, <details class="ledger">…</details>`. (Per spec: number → friendly AI explanation → detailed ledger.)

- [ ] **Step 3: Re-run the smoke** from Task 3 Step 3, additionally asserting a `.ledger` exists and the total row text matches `/예상 적정 평단가/`. Update `_smoke.mjs`'s final evaluate:
```javascript
const ok = await p.evaluate(()=>{ const f=document.querySelector('.fair'); return !!f && /적정가/.test(f.textContent) && !!f.querySelector('.ledger') && /예상 적정 평단가/.test(f.textContent); });
```
Run it; expect `SMOKE OK`.

- [ ] **Step 4: Commit.**
```bash
git add changwon-homes/index.html
git commit -m "changwon: Layer 2 collapsible per-factor rationale ledger"
```

---

## Task 5: Layer 3 — on-demand AI explanation via the proxy

**Files:** Modify `changwon-homes/index.html` — CSS, a `solveProxyPoW` helper, the AI button + click handler

- [ ] **Step 1: Add the proxy helper** (copy the verified one from any AI demo, e.g. `live-globe`) near the top of the main script:
```javascript
  const CLAUDE_PROXY = "https://ai.pb.gurum.se";
  async function solveProxyPoW(){
    const r = await fetch(CLAUDE_PROXY + "/api/claude-challenge");
    if(!r.ok){ const e=new Error("challenge "+r.status); e.status=r.status; throw e; }
    const { nonce, exp, sig, difficulty } = await r.json();
    const enc=new TextEncoder();
    const leadBits=(buf)=>{const b=new Uint8Array(buf);let n=0;for(const x of b){if(x===0){n+=8;continue;}let v=x,c=0;while((v&0x80)===0){c++;v<<=1;}n+=c;break;}return n;};
    for(let counter=0;;counter++){
      const d=await crypto.subtle.digest("SHA-256", enc.encode(nonce+":"+counter));
      if(leadBits(d)>=difficulty) return {"X-PoW-Nonce":nonce,"X-PoW-Exp":exp,"X-PoW-Sig":sig,"X-PoW-Counter":String(counter)};
      if(counter>5000000) throw new Error("pow-timeout");
    }
  }
```

- [ ] **Step 2: Add CSS for the button + result:**
```css
  .fair .aibtn{margin-top:9px;border:1px solid var(--line);background:#fdf6f0;color:var(--teal-deep);
    border-radius:8px;padding:7px 11px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;width:100%}
  .fair .aibtn:disabled{opacity:.6;cursor:default}
  .fair .aitext{margin-top:9px;font-size:12.5px;line-height:1.6;color:#5a4536;background:#fdf6f0;
    border:1px dashed #cfae9a;border-radius:9px;padding:11px;display:none}
  .fair .aitext.on{display:block}
  .fair .aitext .tag{font-size:10px;color:var(--accent,#b04a2f);font-weight:600;display:block;margin-bottom:4px}
```

- [ ] **Step 3: Populate the `.fair-explain` slot** in `fairCard` with the button + an empty result div (replace the empty `<div class="fair-explain" …></div>` from Task 3):
```javascript
      <div class="fair-explain">
        <button class="aibtn" type="button">🤖 AI 평가 보기</button>
        <div class="aitext"><span class="tag">🤖 AI · Sonnet via Bedrock</span><span class="aibody"></span></div>
      </div>
```

- [ ] **Step 4: Wire the click handler** via event delegation on the panel (the panel re-renders, so delegate rather than bind per-render). In `openPanel` or a one-time init where `panel` is set up, add a delegated listener. Find where the panel's click handlers live (search `panel.addEventListener` / `.peer` click for the existing pattern) and add:
```javascript
  panel.addEventListener("click", async (e)=>{
    const btn = e.target.closest(".fair .aibtn");
    if(!btn) return;
    const card = btn.closest(".fair");
    const out = card.querySelector(".aitext"), body = card.querySelector(".aibody");
    btn.disabled = true; btn.textContent = "AI 평가 생성 중…";
    try {
      // gather the already-computed numbers from THIS card (no re-derivation)
      const ctx = card.querySelector(".fair-explain");
      // pull the structured numbers off the currently-open band:
      const data = window.__fairCtx || null;   // set in openPanel render below
      const pow = await solveProxyPoW();
      const sys = "당신은 한국 부동산 평가를 쉽게 설명하는 도우미입니다. 주어진 수치(실거래가, 모델 예상 적정가 범위, 산출 요인별 가감, 비교 단지 수)를 근거로, 이 매물이 비슷한 인근 단지 대비 싼지/비싼지와 그 이유를 2~3문장의 자연스러운 한국어로 설명하세요. 수치를 지어내지 말고 주어진 값만 사용하세요. 감정평가가 아닌 참고용 추정임을 한 번 가볍게 언급하세요.";
      const res = await fetch(CLAUDE_PROXY + "/api/claude", {
        method:"POST", headers:{"Content-Type":"application/json", ...pow},
        body: JSON.stringify({ model:"sonnet", max_tokens:400, system: sys,
          messages:[{ role:"user", content: btn.dataset.ctx || "수치 정보 없음" }] }),
      });
      if(!res.ok){ const er=new Error("proxy "+res.status); er.status=res.status; throw er; }
      const j = await res.json();
      const txt = (j.content && j.content[0] && j.content[0].text) || "";
      body.textContent = txt;
      out.classList.add("on");
      btn.style.display = "none";
    } catch(err){
      out.querySelector(".aibody").textContent = "AI 평가를 지금 불러올 수 없어요 — 위 수치로 판단해 주세요.";
      out.classList.add("on");
      btn.disabled = false; btn.textContent = "🤖 AI 평가 보기";
    }
  });
```

- [ ] **Step 5: Provide the AI context string.** The handler needs the computed numbers as text. Simplest robust approach: stamp a `data-ctx` attribute onto the button in `fairCard` with a compact Korean summary of the numbers (so it travels with the DOM, no global state). In `fairCard`, build it from `f` + observed and add to the button:
```javascript
  const ctxStr = [
    `실거래 ${fmtEok(obs)}`,
    `모델 예상 적정가 ${fmtEok(lo)}~${fmtEok(hi)} (중앙값 ${fmtEok(expMid)})`,
    `평가: ${vword.replace(/[↓↑]/g,'').trim()}`,
    `산출요인: ${f.ledger.filter(l=>l.pct!=null).map(l=>`${l.label} ${l.pct>=0?'+':''}${l.pct.toFixed(1)}%`).join(', ')}`,
    `비교 단지 ${x.peers.length}곳`,
    `단지: ${h.name} ${x.b.pyeong}평 ${h.built||''}년식`,
  ].join(' · ');
```
and on the button: `<button class="aibtn" type="button" data-ctx="${esc(ctxStr)}">🤖 AI 평가 보기</button>`. (Drop the unused `window.__fairCtx` line from Step 4 — read `btn.dataset.ctx` directly, which the handler already does.)

- [ ] **Step 6: Verify live against the deployed proxy.** Extend `_smoke.mjs`: open a panel, click `.aibtn`, wait, assert `.aitext.on` appears and `.aibody` is non-empty (a real Sonnet reply) OR the graceful fallback text. This makes a real (Sonnet) proxy call — fine, it counts toward the 800/day cap.
```javascript
// after asserting the fair card:
await p.evaluate(()=>document.querySelector('.fair .aibtn')?.click());
await p.waitForTimeout(6000); // PoW (~830ms) + Sonnet round-trip
const ai = await p.evaluate(()=>{ const t=document.querySelector('.fair .aitext'); return t && t.classList.contains('on') && t.querySelector('.aibody').textContent.trim().length>0; });
console.log('AI explanation rendered:', ai);
```
Run the smoke; expect the fair card + ledger asserts AND `AI explanation rendered: true`. If the proxy is rate-limited, the fallback text also satisfies "non-empty" — acceptable; note which path hit.

- [ ] **Step 7: `node --check` the script + commit.**
```bash
cd /home/ubuntu/projects/vibe-demos
node -e "const fs=require('fs');const h=fs.readFileSync('changwon-homes/index.html','utf8');const s=h.split('<script>').pop().split('</script>')[0];fs.writeFileSync('/tmp/cw.mjs', s);" && node --check /tmp/cw.mjs && echo "OK"
git add changwon-homes/index.html
git commit -m "changwon: Layer 3 on-demand AI explanation (Sonnet via proxy)"
```

---

## Task 6: SW cache bump, cleanup, final verification

**Files:** Modify `changwon-homes/sw.js`; delete temp test/smoke files

- [ ] **Step 1: Bump the SW cache.** Read `changwon-homes/sw.js`, find the cache constant (e.g. `const CACHE = "vibe-changwon-homes-vN"`), increment N. (Grep to confirm the exact name/version.)

- [ ] **Step 2: Delete temp files.**
```bash
cd /home/ubuntu/projects/vibe-demos/changwon-homes
rm -f _fairprice.test.mjs _smoke.mjs
```

- [ ] **Step 3: Final syntax + clean-tree check.**
```bash
cd /home/ubuntu/projects/vibe-demos
node -e "const fs=require('fs');const h=fs.readFileSync('changwon-homes/index.html','utf8');const s=h.split('<script>').pop().split('</script>')[0];fs.writeFileSync('/tmp/cw.mjs', s);" && node --check /tmp/cw.mjs && echo "SYNTAX OK" && rm -f /tmp/cw.mjs
git status --short changwon-homes/
```
Expected: `SYNTAX OK`; status shows only `index.html` + `sw.js` modified, no `_*.mjs`.

- [ ] **Step 4: Commit.**
```bash
git add changwon-homes/index.html changwon-homes/sw.js
git commit -m "changwon: SW cache bump for pricing evaluator"
```

---

## Task 7: Manual verification checklist (against deployed site after push)

No code — confirm end-to-end after the change is on `main`/Pages.

- [ ] Open a complex with peers (most in the 신도시 core). Confirm the **fair-price card** shows 실거래 vs 예상 적정가 range + a 저평가/고평가/적정 verdict + the observed-vs-expected bar.
- [ ] Expand **적정가 산출 근거** → confirm the ledger lines (거리/연식/브랜드/층) sum from 인근 평균 평단가 to 예상 적정 평단가, signs sensible (closer/newer/branded push up; far/old/low-floor push down).
- [ ] Tap **🤖 AI 평가 보기** → ~1s later a Korean paragraph appears, consistent with the numbers, labeled Sonnet. Tap again on another unit → works.
- [ ] Switch to **월세 (wolse)** mode → the fair-price card is **absent** (evaluator is sale/jeonse only); the rest of the panel is unchanged.
- [ ] Rate-limit path: if you click many AI buttons fast, confirm the calm fallback text appears rather than an error/dead panel.
- [ ] `prefers-reduced-motion` / mobile: the card is readable, the ledger expands, no layout break in the bottom sheet.

---

## Self-review notes (already applied)

- **Spec coverage:** Layer 1 (Task 3 + `fairPrice` Task 1), Layer 2 ledger (Task 4), Layer 3 AI on-demand (Task 5), placement order number→AI→ledger (Tasks 3–5 structure), confidence band + caveat (Task 1 BAND + Task 3 caveat), sale/jeonse-only wolse guard (Task 3 `fairCard` early return), honesty labels (Tasks 3,5). ✓
- **No placeholders:** every step has concrete code/commands. Coefficient source confirmed = existing `DATA_META.hedonic` (no new global); all required fields (`h.dcore/brand/built/maxFloor`, `x.b.floor/pyeong`) verified present in data.json. The only local confirmation left is the main `<script>` split for `node --check` (Task 2) — flagged with how (grep), not vague.
- **Type/name consistency:** `fairPrice(h,x,H)` → returns `{predPPP,lowPPP,highPPP,deltaPct,ledger}`; `x.fair` used identically in `recompute` (Task 2, passing `DATA_META.hedonic`) and `fairCard` (Tasks 3–5); ledger entry shape `{label,ppp?,pct?,total?}` consistent between Task 1 (build) and Task 4 (render). ✓
- **CLAUDE.md compliance:** no build tool; reuses existing helpers; XSS-safe (`esc()` on name + `textContent` for AI body + `esc()` on the data-ctx attr); SW bumped; proxy/PoW pattern identical to the 4 AI demos; AI fed only computed numbers.
