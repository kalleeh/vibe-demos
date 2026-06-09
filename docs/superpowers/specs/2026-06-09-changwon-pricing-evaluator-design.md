# Changwon Homes — Intelligent Pricing Evaluator (design spec)

**Date:** 2026-06-09
**Demo:** `changwon-homes/` — Leaflet apartment finder on real MOLIT 실거래가 (902 complexes, hedonic value model).
**Goal:** Upgrade each property's per-band card from "value score + one-line delta" to a **layered, transparent pricing evaluator**: a model-predicted fair price (Layer 1), a line-by-line rationale showing how that price is derived (Layer 2), and an optional on-demand AI natural-language read (Layer 3).

---

## 1. Context — what already exists (do NOT rebuild)

changwon-homes is sophisticated already. Per band (size-band of a complex) it computes:
- **`bandFactors(h,b,peers)`** → 5 axes 0..10 (`value, newness, location, floor, size`), each grounded in a real hedonic regression (`scripts/hedonic.py`, R²=0.69, n=12,720).
- **`blendScore`** → personal weighted score (user sliders); rendered as a ring + factor chips + verdict in `bandBlock(h,x)`.
- **Peer comparison** via `bandPeers` (4-tier locality/age fallback), with `avgPrice`, `avgPPP`, `ppp` on each `_band`.
- A delta line: "평균보다 8% 저렴/비쌈".

**Crucially, the regression coefficients are already in the data** — `data.json.meta.hedonic`:
```
{ r2:0.69, n:12720, distCorePerKm:-0.073, brand:0.136, agePerYear:-0.041, floorLow:-0.037, floorTop:-0.091 }
```
DV is `log(만원/평)`, so each coef is a log-price elasticity. This makes a true **fair-price prediction feasible client-side** — the evaluator's "intelligence" is a published regression, not hand-waving, which fits the app's evidence ethos.

**What's missing (the gap this closes):** the current rationale is thin (one delta line); there's no predicted *fair price* (only "cheaper/pricier than peers"), and no natural-language explanation.

`changwon-homes` has **no AI wiring today** (not one of the 4 proxy demos) — Layer 3 adds the proxy call fresh.

---

## 2. The three layers

### Layer 1 — Fair-price estimate (the spine, deterministic)

A new pure function `fairPrice(h, x)` where `x` is a `_band`. It predicts this unit's fair 평단가 (만원/평) from the peer baseline adjusted by the hedonic coefficients for THIS unit's deltas vs. the peer set:

```
baseline = x.avgPPP                         // peer-average 평단가 (already floor-normalized)
log_adj  =  H.distCorePerKm * (h.dcore - peerMean(dcore))                  // farther→cheaper (coef<0)
          + H.agePerYear    * (peerMeanAge - thisAge)                      // SIGN: agePerYear is
              // per-YEAR-OF-AGE (coef −0.041). age = currentYear − built. A NEWER unit (smaller
              // age) than peers → (peerMeanAge − thisAge) > 0 → ×(−0.041) → negative? NO. Use
              // age delta so older lowers price: log_adj += H.agePerYear * (thisAge − peerMeanAge).
              // i.e. older-than-peers (positive Δage) × (−0.041) → price down. Implement with AGE
              // (= refYear − built), not raw build-year, to keep the sign unambiguous.
          + H.brand         * ((h.brand?1:0) - peerFrac(brand))            // branded→higher (coef>0)
          + floorAdj(x.b, h)                                                // H.floorLow / H.floorTop if low/top
predicted_ppp = baseline * exp(log_adj)
predicted_price = predicted_ppp * pyeong→price conversion (mirror bandPrice's 만원↔억)
```
- `H = data.json.meta.hedonic`. `peerMean`/`peerFrac` computed over `x.peers` (already attached).
- **Output** attached to each `_band` as `x.fair = { ppp, price, low, high, deltaPct, ledger[] }` during `recompute()` (zero new fetches).
- **deltaPct** = (observed − predicted)/predicted × 100 → the headline "N% 저평가/고평가".
- **Confidence band** `low/high`: derive a ± range from the regression's unexplained variance (R²=0.69 → ~±(1−R²)-scaled spread; concretely a fixed ~±8–10% band at implementation, label it as model uncertainty, not false precision).

**UI (in `bandBlock`, above the existing score ring):** a fair-price card —
`실거래 {observed}억  ·  예상 적정가 {low}–{high}억  →  {N}% 저평가/고평가`, plus an observed-vs-expected bar. Color reuses `scoreColor` semantics (green = undervalued).

**Visual stacking order within the card (decided):**
1. **Fair-price headline** (this layer) — the number + over/under.
2. **AI friendly explanation** (Layer 3, on-demand) sits **directly under the headline** — the plain-language "why" as the immediate human translation of the number.
3. **Detailed factor ledger** (Layer 2) below, collapsible — the "show your work" for anyone who wants the exact math.

So reading order is: *the number → a friendly explanation of it → the precise breakdown*. (Note: Layer 3 is generative + on-demand, so before the AI button is tapped, the card shows headline → [AI 평가 보기 button] → ledger; after tap, the AI paragraph fills the slot between headline and ledger.)

**Honesty (decided):** always a **range + caveat** — "공개 실거래가 기반 모델 추정치 · 감정평가 아님". Never a bare point estimate implying appraisal precision.

### Layer 2 — Per-factor rationale (the "clear rationale", deterministic)

Render `x.fair.ledger` as a transparent ledger inside the band card (collapsible `<details>`, matching the existing peers disclosure):
```
인근 평균 평단가         1,250만/평
· 신도시 코어 1.2km      −8.8%
· 2019년식 (신축 편)     +12.3%
· 저층(3층)              −3.7%
= 예상 적정 평단가        1,313만/평
```
Each row = one coefficient × this unit's attribute delta, formatted as a %. The `ledger[]` is built inside `fairPrice()` (one entry per non-trivial adjustment) so UI just maps it. Fully traceable; no black box.

### Layer 3 — AI natural-language read (optional, on-demand, generative)

**Placement:** directly under the Layer-1 fair-price headline (above the Layer-2 ledger) — it's the friendly, immediate explanation of the number, with the precise ledger as the deeper "show your work" below it. (See Layer 1's "Visual stacking order.")

A "🤖 AI 평가 보기" button in the band card. On tap:
1. Solve the proxy proof-of-work (`solveProxyPoW`, the same helper the 4 AI demos use — added fresh here against `https://ai.pb.gurum.se`).
2. POST to the proxy with **`model: "sonnet"`** (summarization, not deep reasoning — lighter on the daily cap than Opus, fast enough). System prompt: a Korean real-estate-savvy explainer; user content = the **already-computed numbers** from Layers 1+2 (observed, predicted range, each ledger factor, peer count) as structured context, instructed to *explain* them, not invent.
3. Render one grounded Korean paragraph, labeled "🤖 AI · Sonnet via Bedrock".
4. **Fallback:** on proxy 429/503/error, show a calm "AI 평가를 지금 불러올 수 없어요 — 위 수치로 판단해 주세요." Layers 1+2 always stand alone (the button failing never breaks the panel).

Per-property button; one Bedrock call only when tapped (respects the proxy's 800/day cap; viewer opts in).

---

## 3. Data flow & integration

- **`recompute()`** (line ~596): after building each `_band`, call `x.fair = fairPrice(h, x)`. No new I/O — uses `x.peers`, `h.dcore/built/brand/maxFloor`, `x.b.floor/pyeong`, and `H` from the already-loaded data.
- **`bandBlock(h, x)`** (line ~760): insert the Layer-1 fair-price card at the top of the card and the Layer-2 ledger as a `<details>`; keep the existing score ring, delta, factor chips, peers (the evaluator *complements* the personal score, doesn't replace it). Add the Layer-3 button + a result container.
- **New (small) module:** the Layer-3 proxy call + `solveProxyPoW` helper (copy the verified ~25-line helper from any of the 4 AI demos), in changwon-homes's classic `<script>`.
- **Units:** mirror the existing `bandPrice`/`bandPPP`/`fmtEok`/`fmtPPP` conversions exactly (sale/jeonse 억↔만원 ×10000; wolse uses 환산월세 — for wolse mode, fair-price applies to the conversion metric or is suppressed; decide at plan time — lean: show the evaluator for **sale + jeonse only**, since a "fair price" 억 figure is meaningful there; for wolse show Layers 1-2 in 평단가 terms or hide Layer 1's 억 headline).

---

## 4. What changes / untouched

- **New:** `fairPrice()`, the fair-price card + ledger UI in `bandBlock`, the AI button + proxy call.
- **Reused:** `meta.hedonic` coefficients, `bandPeers`, `bandFactors`, `scoreColor`, `fmtEok/fmtPPP`, the score ring/verdict.
- **Untouched:** map, clustering, weight sliders, the 5-axis personal score, the upload chute, PWA/SW (bump cache on ship).

---

## 5. Honesty guardrails

- Fair price = always a range + "모델 추정치, 감정평가 아님" caveat.
- Layers 1-2 are pure deterministic math from public 실거래가 + a published regression; only Layer 3 is generative, fed only computed numbers, clearly labeled AI.
- The evaluator sits alongside (not replacing) the existing transparent factor chips, so a skeptical user can still see every input.

---

## 6. Open questions (resolve at plan time)

- **Wolse handling** for Layer 1 (a "적정 억" figure is odd for monthly rent) — lean: evaluator on sale + jeonse; for wolse keep the existing card unchanged or show 평단가-only rationale.
- **Confidence-band width** — fixed ±% vs. a residual-derived value. Lean: a simple fixed band (~±8–10%) labeled as model uncertainty; avoid implying per-unit prediction intervals the data can't support.
- **AI system prompt** — needs a short domain-tuned Korean prompt (per the repo's AI-demo pattern). Compose at implementation; feed it only the computed numbers.
