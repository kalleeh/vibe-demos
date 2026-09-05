/* 책친구 — app logic. Reads window.BOOKS / THEME_VOCAB / MOOD_VOCAB from catalog.js. */
"use strict";

// Hand-drawn crayon icons (SD3.5-generated, bg-removed) live in ./icons/<key>.png.
// Map each theme/mood to its icon key; missing keys fall back to a label-only chip.
const THEME_ICON = {
  "공룡":"gongryong","우주":"uju","동물":"dongmul","공주":"gongju","자동차":"jadongcha","탈것":"talgeot",
  "그림그리기":"geurim","잠자리":"jamjari","자연":"jayeon","음식":"eumsik","가족":"gajok","친구":"chingu",
  "감정":"gamjeong","일상":"ilsang","환상":"hwansang","모험":"moheom","숫자/글자":"sutja","유머":"yumeo"
};
const MOOD_ICON = { "웃긴":"yumeo","따뜻한":"mood-ttaseuthan","모험":"moheom","학습":"mood-hakseup","잔잔한":"mood-janjan" };

// Free-text → signal lexicon. Maps words a parent types in the note to theme/mood nudges.
// Deterministic, offline — this is how the note steers recs without any model.
// Matching rules (see matchKw): Korean keys are substrings but MUST be 2+ syllables —
// single syllables (화, 별, 잠, 먹, 곰) fire on unrelated words ("동화책" → 감정, "특별한" → 우주).
// Latin keys match whole words only ("scary" must not hit "car", "planet" must not hit "plane").
const NOTE_LEXICON = [
  { kw: ["공룡","티라노","브라키오","다이노","dino","dinos","dinosaur","dinosaurs"], theme:"공룡" },
  { kw: ["우주","로켓","행성","별님","별자리","별들","별을","별이","space","rocket","rockets","planet","planets","stars"], theme:"우주" },
  { kw: ["동물","강아지","고양이","토끼","곰돌이","곰 인형","북극곰","사자","animal","animals","puppy","puppies","cat","cats","dog","dogs"], theme:"동물" },
  { kw: ["공주","왕자","드레스","princess","princesses"], theme:"공주" },
  { kw: ["자동차","부릉","car","cars"], theme:"자동차" },
  { kw: ["기차","버스","비행기","탈것","train","trains","bus","buses","plane","planes"], theme:"탈것" },
  { kw: ["그리기","그림 그리","색칠","크레용","낙서","draw","drawing","paint","painting","color","colors","colour","colours"], theme:"그림그리기" },
  { kw: ["잠자","잠들","잠들기","자기 전","재우","잠자리","낮잠","bedtime","sleep","sleepy"], theme:"잠자리", mood:"잔잔한" },
  { kw: ["자연","숲","나무","꽃","바다","nature","forest"], theme:"자연" },
  { kw: ["음식","먹는","먹을","먹기","요리","빵","과자","간식","food","eat","eating"], theme:"음식" },
  { kw: ["가족","엄마","아빠","할머니","할아버지","형제","family"], theme:"가족" },
  { kw: ["친구","우정","friend","friends"], theme:"친구" },
  { kw: ["감정","마음","화나","화가 나","슬픔","슬퍼","무서","feeling","feelings","emotion","emotions"], theme:"감정" },
  { kw: ["환상","마법","요정","상상","fantasy","magic"], theme:"환상" },
  { kw: ["일상","하루","어린이집","유치원","daily","routine"], theme:"일상" },
  { kw: ["모험","탐험","여행","adventure","adventures","explore"], theme:"모험", mood:"모험" },
  { kw: ["숫자","글자","한글","알파벳","abc","number","numbers","letter","letters"], theme:"숫자/글자", mood:"학습" },
  { kw: ["웃긴","까르르","웃겨","재밌","funny","laugh"], theme:"유머", mood:"웃긴" },
  { kw: ["따뜻","포근","사랑","warm","cozy"], mood:"따뜻한" },
  { kw: ["배우","공부","교육","learn","learning","educational"], mood:"학습" },
  { kw: ["무서워","무서운","scary","afraid"], mood:"모험", dir:-1 }, // downweight scary/adventure
];

const LATIN_RE_CACHE = new Map();
function matchKw(noteLower, k){
  if (/^[a-z]/i.test(k)){
    let re = LATIN_RE_CACHE.get(k);
    if (!re){ re = new RegExp("\\b" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"); LATIN_RE_CACHE.set(k, re); }
    return re.test(noteLower);
  }
  return noteLower.includes(k.toLowerCase());
}

// Returns {themes:{theme:weight}, moods:{mood:weight}} derived from the note text.
function lexiconSignals(note){
  const out = { themes:{}, moods:{} };
  if(!note) return out;
  const n = note.toLowerCase();
  for(const e of NOTE_LEXICON){
    if(e.kw.some(k => matchKw(n, k))){
      const w = (e.dir===-1) ? -1 : 1;
      if(e.theme) out.themes[e.theme] = (out.themes[e.theme]||0) + w;
      if(e.mood)  out.moods[e.mood]   = (out.moods[e.mood]||0) + w;
    }
  }
  return out;
}

function chip(val, iconKey, pressed, label){
  const img = iconKey ? `<img class="chip-ic" src="./icons/${iconKey}.png" alt="" aria-hidden="true">` : "";
  return `<button type="button" class="chip${iconKey?" has-ic":""}" data-val="${val}" aria-pressed="${pressed?"true":"false"}">${img}<span class="chip-tx">${label || val}</span></button>`;
}

// Age bands (static vocab, label-only); themes & moods get crayon icons.
// No gender input: books carry no gender field (tagging picture books by gender would
// bake in stereotypes), so a gender chip would be a dead input.
const AGE_BANDS = ["0-2","3-4","5-6","7-9"];
document.getElementById("ageChips").innerHTML    = AGE_BANDS.map(a => chip(a, "", false, a + "세")).join("");
document.getElementById("themeChips").innerHTML  = window.THEME_VOCAB.map(t => chip(t, THEME_ICON[t]||"", false)).join("");
document.getElementById("moodChips").innerHTML   = window.MOOD_VOCAB.map(m => chip(m, MOOD_ICON[m]||"", false)).join("");

function wireGroup(containerId, single){
  const el = document.getElementById(containerId);
  el.addEventListener("click", e => {
    const b = e.target.closest(".chip"); if(!b) return;
    if (single) el.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c===b ? "true":"false"));
    else b.setAttribute("aria-pressed", b.getAttribute("aria-pressed")==="true" ? "false":"true");
    if (containerId === "ageChips") document.getElementById("ageHint").hidden = true;
  });
}
wireGroup("ageChips", true);
["themeChips","moodChips"].forEach(id => wireGroup(id, false));

function readProfile(){
  const sel = (id) => [...document.getElementById(id).querySelectorAll('.chip[aria-pressed="true"]')].map(c=>c.dataset.val);
  return {
    age: sel("ageChips")[0] || null,
    themes: sel("themeChips"),
    moods: sel("moodChips"),
    note: (document.getElementById("noteBox").value||"").trim()
  };
}

// "exact" | "adj" | "far" — how a book's age bands sit relative to the picked band.
function ageFit(b, age){
  if (b.ages.includes(age)) return "exact";
  const pi = AGE_BANDS.indexOf(age);
  return b.ages.some(a => Math.abs(AGE_BANDS.indexOf(a)-pi)===1) ? "adj" : "far";
}

// Deterministic fit score. Higher = better. Uses age curve, weighted theme/mood match,
// the note lexicon, and a small build-time quality prior. No model, no randomness here
// (reroll variety lives in pickVaried); a tiny id tiebreak keeps equal scores stable.
function scoreBook(b, p){
  let s = 0;
  // age: exact band must outrank ANY single theme hit (primary theme = +4), so a
  // 3-4 dinosaur book can't beat a 0-2 book for a 0-2 child. Adjacent soft, far penalized.
  if (p.age){
    const fit = ageFit(b, p.age);
    s += fit === "exact" ? 8 : fit === "adj" ? 1.5 : -4;
  }
  // themes: primary (first listed) match weighted higher than secondary matches
  const picked = new Set(p.themes||[]);
  if (b.themes && b.themes.length){
    if (picked.has(b.themes[0])) s += 4;                       // primary theme hit
    for (let i=1;i<b.themes.length;i++) if(picked.has(b.themes[i])) s += 2; // secondary hits
  }
  // mood overlap
  s += (b.mood||[]).filter(m => (p.moods||[]).includes(m)).length * 2;
  // free-text lexicon signals (boost matched themes/moods, downweight negatives)
  const sig = lexiconSignals(p.note);
  for (const t of (b.themes||[])) if (sig.themes[t]) s += sig.themes[t] * 2.5;
  for (const m of (b.mood||[])) if (sig.moods[m]) s += sig.moods[m] * 1.5;
  // build-time quality prior: small nudge so classics surface (range ~0..1.2).
  // 0.7 is the same neutral default the build pipeline assigns.
  s += (typeof b.quality === "number" ? b.quality : 0.7) * 1.2;
  // stable tiny tiebreak
  s += (b.id.charCodeAt(b.id.length-1) % 7) * 0.01;
  return s;
}

let shuffleSalt = 0;

/* ── "이미 있어요" / "숨기기": per-book shelf state, persisted as id arrays ──
   Both kinds drop the book from every future pool; the footer lets a parent restore. */
const SHELF_KEYS = { owned: "kb.owned", hidden: "kb.hidden" };
function loadIds(key){
  try { const v = JSON.parse(localStorage.getItem(key) || "[]"); return new Set(Array.isArray(v) ? v.filter(x => typeof x === "string") : []); }
  catch(_) { return new Set(); }
}
const SHELF = { owned: loadIds(SHELF_KEYS.owned), hidden: loadIds(SHELF_KEYS.hidden) };
function saveShelf(kind){ try { localStorage.setItem(SHELF_KEYS[kind], JSON.stringify([...SHELF[kind]])); } catch(_){} }
function shelved(id){ return SHELF.owned.has(id) || SHELF.hidden.has(id); }

/* ── rendering, crayon SVG covers, Open Library swap, varied reroll ── */

// A crayon mini-book cover: framed rect, emoji, title. Always renders, never breaks.
function svgCover(b){
  const pal = (b.cover && Array.isArray(b.cover.palette)) ? b.cover.palette : [];
  const c1 = pal[0] || "#ffe9c7", c2 = pal[1] || "#ffffff";
  const emoji = (b.cover && b.cover.emoji) || "📖";
  const title = b.title.length>14 ? b.title.slice(0,13)+"…" : b.title;
  return `<svg viewBox="0 0 120 150" class="cv" role="img" aria-label="${escapeHtml(b.title)} 표지">
    <rect x="4" y="4" width="112" height="142" rx="7" fill="${escapeHtml(c1)}" stroke="var(--ink)" stroke-width="2.4" filter="url(#crayon)"/>
    <rect x="12" y="12" width="96" height="80" rx="5" fill="${escapeHtml(c2)}" opacity=".85"/>
    <text x="60" y="64" font-size="44" text-anchor="middle" dominant-baseline="central">${escapeHtml(emoji)}</text>
    <text x="60" y="116" font-size="12" text-anchor="middle" fill="var(--ink)" font-weight="700">${escapeHtml(title)}</text>
  </svg>`;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }

// Where to actually find the book: 알라딘 title search for Korean titles, Open Library
// for English (by ISBN when we have one, else a title search).
function findLink(b){
  if (b.lang === "ko") return { href: "https://www.aladin.co.kr/search/wsearchresult.aspx?SearchWord=" + encodeURIComponent(b.title), label: "알라딘에서 찾기 →" };
  const href = b.isbn ? "https://openlibrary.org/isbn/" + encodeURIComponent(b.isbn)
                      : "https://openlibrary.org/search?q=" + encodeURIComponent(b.title);
  return { href, label: "Open Library에서 보기 →" };
}

const FLAG = { ko:"🇰🇷", en:"🇬🇧" };
function cardHtml(b, pending){
  const lvl = escapeHtml(b.level);
  const meta = escapeHtml(b.author) + (b.publisher ? " · " + escapeHtml(b.publisher) : "");
  // pending = this card's AI reason/tip is still being written
  const badge = pending ? `<span class="aibadge">✨ AI 다듬는 중…</span>` : "";
  const link = findLink(b);
  return `<article class="bookcard${pending?" ai-pending":""}" data-bookid="${escapeHtml(b.id)}" data-isbn="${b.lang==="en" && b.isbn ? escapeHtml(b.isbn) : ""}">
    <div class="cover">${svgCover(b)}</div>
    <div class="info">
      <div class="toprow"><span class="flag">${FLAG[b.lang]||""}</span>
        <span class="lvl">${lvl}</span>${badge}</div>
      <h3 class="btitle">${escapeHtml(b.title)}</h3>
      <div class="bmeta">${meta}</div>
      <p class="why"><b>왜 이 책일까요?</b> <span class="why-tx">${escapeHtml(b.blurb)}</span></p>
      <p class="tip"><b>함께 읽기 팁</b> <span class="tip-tx">${escapeHtml(b.readAloud)}</span></p>
      <a class="findlink" href="${escapeHtml(link.href)}" target="_blank" rel="noopener">${link.label}</a>
      <div class="cardacts">
        <button type="button" class="act" data-act="owned" aria-label="『${escapeHtml(b.title)}』 이미 있어요 — 우리 책장에 넣고 추천에서 빼기">📚 이미 있어요</button>
        <button type="button" class="act" data-act="hidden" aria-label="『${escapeHtml(b.title)}』 숨기기 — 다음 추천에서 빼기">🙈 숨기기</button>
      </div>
    </div>
  </article>`;
}

// Patch one already-rendered card in place when its AI result arrives.
function patchCard(id, upd){
  const card = document.querySelector(`#results .bookcard[data-bookid="${cssEsc(id)}"]`);
  if (!card) return;
  card.classList.remove("ai-pending");
  const badge = card.querySelector(".aibadge");
  if (upd.failed) { if (badge) badge.remove(); return; }   // keep catalog blurb, drop badge
  const why = card.querySelector(".why-tx"), tip = card.querySelector(".tip-tx");
  if (upd.reason && why) why.textContent = upd.reason;
  if (upd.tip && tip) tip.textContent = upd.tip;
  if (badge) badge.remove();
  card.classList.add("ai-justfilled");
  setTimeout(() => card.classList.remove("ai-justfilled"), 700);
}
// CSS.escape isn't on all engines for attribute selectors; ids are kebab so this is safe.
function cssEsc(s){ return String(s).replace(/["\\]/g, "\\$&"); }

// AI status pill (shared convention across the AI demos): exactly three states —
// busy "다듬는 중…", success "라이브 · Claude", failure "기본 추천 · AI 다듬기 실패".
// Default (AI off) renders no pill at all.
const PILL = {
  busy: { text: "다듬는 중…",             cls: "busy" },
  live: { text: "라이브 · Claude",         cls: "live" },
  warn: { text: "기본 추천 · AI 다듬기 실패", cls: "warn" },
};
function pillHtml(state){
  const p = PILL[state]; if (!p) return "";
  return `<span class="demo-pill ${p.cls}">${escapeHtml(p.text)}</span>`;
}
function renderResults(books, opts){
  opts = opts || {};
  const wrap = document.getElementById("results");
  const pend = opts.pending instanceof Set ? opts.pending : null;
  // aria-live sits on the count + pill only — announcing the whole grid on every reroll is noisy.
  wrap.innerHTML = `<div class="resbar"><span aria-live="polite"><span class="cnt">${books.length}권 추천</span>${pillHtml(opts.pill)}</span>
    <span class="btns"><button id="copyLink" class="reroll copy" type="button">링크 복사 🔗</button>
    <button id="reroll" class="reroll" type="button">다시 추천 🎲</button></span></div>
    <div class="grid">${books.map((b,i) => `<div class="cardwrap" style="--i:${i}">${cardHtml(b, pend ? pend.has(b.id) : false)}</div>`).join("")}</div>`;
  // lazy real-cover swap (English ISBNs only). Open Library; silent fallback to SVG.
  swapCovers(wrap);
}
function updateCount(){
  const c = document.querySelector("#results .resbar .cnt");
  const n = document.querySelectorAll("#results .bookcard").length;
  if (c) c.textContent = `${n}권 추천`;
}
function swapCovers(wrap){
  wrap.querySelectorAll(".bookcard[data-isbn]").forEach(card => {
    const isbn = card.getAttribute("data-isbn"); if(!isbn) return;
    const img = new Image();
    img.onload = () => { if(img.naturalWidth>2){ const c=card.querySelector(".cover");
      if(c) c.innerHTML = `<img class="realcover" src="${img.src}" alt="" loading="lazy">`; } };
    img.src = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`;
  });
}

// Pick `n` items from the top `poolSize` of a sorted list, varied by shuffleSalt — so
// "다시 추천" surfaces a genuinely different but still well-fit set, not the same 6.
function pickVaried(sortedPool, n, poolSize){
  const pool = sortedPool.slice(0, Math.max(n, poolSize));
  if (pool.length <= n) return pool.slice(0, n);
  // deterministic rotation by salt, then take n spread across the pool
  const start = (shuffleSalt * 3) % pool.length;
  const out = [];
  for (let k=0; out.length<n && k<pool.length; k++){
    out.push(pool[(start + k) % pool.length]);
  }
  return out.slice(0, n);
}
// Greedy diversity pick: from a score-sorted pool, take up to n books while avoiding
// repeating the same PRIMARY theme. Keeps strong fits but spreads across themes so
// results aren't 6 near-identical books. Themes the user EXPLICITLY picked get a cap
// of 2 instead of 1 — diversity shouldn't fight stated intent ("공룡 좋아해요" should
// surface more than one dino book). When the exact-age pool is thin (fewer distinct
// primary themes than slots — the 0-2 shelf is mostly 동물), the cap relaxes so we
// repeat a theme inside the right age band rather than leave the band for variety.
function pickDiverse(sortedPool, n, pickedThemes, age){
  const out = [], primCount = {};
  const exact = age ? sortedPool.filter(x => ageFit(x.b, age) === "exact") : sortedPool;
  const distinct = new Set(exact.map(x => x.b.themes && x.b.themes[0]).filter(Boolean)).size;
  const relaxed = distinct < n ? Math.ceil(n / Math.max(1, distinct)) : 0;
  const cap = (prim) => relaxed || ((pickedThemes && pickedThemes.has(prim)) ? 2 : 1);
  for (const x of sortedPool){
    if (out.length >= n) break;
    const prim = x.b.themes && x.b.themes[0];
    if (prim && (primCount[prim]||0) >= cap(prim)) continue;
    out.push(x); if (prim) primCount[prim] = (primCount[prim]||0) + 1;
  }
  if (out.length < n){   // few distinct themes available → backfill by score
    const have = new Set(out.map(x=>x.b.id));
    for (const x of sortedPool){ if(out.length>=n) break; if(!have.has(x.b.id)){ out.push(x); have.add(x.b.id);} }
  }
  return out.slice(0, n);
}
function recommend(p, varied){
  // owned ("이미 있어요") and hidden ("숨기기") books never enter the pool
  let scored = window.BOOKS
    .filter(b => !shelved(b.id))
    .map(b => ({ b, s: scoreBook(b,p) }))
    .filter(x => x.s > -2)
    .sort((a,b) => b.s - a.s);
  // babies: never reach two bands up. A 5-6 book is not a 0-2 book however well its theme fits.
  if (p.age === "0-2") scored = scored.filter(x => ageFit(x.b, "0-2") !== "far");
  const ko = scored.filter(x => x.b.lang==="ko");
  const en = scored.filter(x => x.b.lang==="en");
  const pickedThemes = new Set(p.themes || []);
  let koPick, enPick;
  if (varied){
    // reroll: rotate a wider pool for variety, THEN diversify by theme. The pool is
    // clamped to the exact-age books (they lead the sorted list) so rotation never
    // walks past them into adjacent bands — with a floor of 8 when the band is thin.
    const poolFor = (list) => p.age ? Math.min(16, Math.max(8, list.filter(x => ageFit(x.b, p.age) === "exact").length)) : 16;
    koPick = pickDiverse(pickVaried(ko, 8, poolFor(ko)), 3, pickedThemes, p.age);
    enPick = pickDiverse(pickVaried(en, 8, poolFor(en)), 3, pickedThemes, p.age);
  } else {
    koPick = pickDiverse(ko, 3, pickedThemes, p.age);
    enPick = pickDiverse(en, 3, pickedThemes, p.age);
  }
  let pick = [...koPick, ...enPick];
  if (pick.length < 6){
    const used = new Set(pick.map(x=>x.b.id));
    for (const x of scored){ if(pick.length>=6) break; if(!used.has(x.b.id)){ pick.push(x); used.add(x.b.id);} }
  }
  return pick.map(x => x.b);
}

function scrollResults(){ document.getElementById("results").scrollIntoView({behavior:"smooth", block:"start"}); }

/* ── shareable results: profile ⇄ URL hash (#age=3-4&t=공룡,동물&m=웃긴&s=2&n=…) ──
   Scoring is deterministic, so the same hash reproduces the same 6 books exactly. */
function writeHash(p){
  const q = new URLSearchParams();
  if (p.age) q.set("age", p.age);
  if (p.themes.length) q.set("t", p.themes.join(","));
  if (p.moods.length)  q.set("m", p.moods.join(","));
  if (shuffleSalt)     q.set("s", String(shuffleSalt));
  if (p.note)          q.set("n", p.note);
  history.replaceState(null, "", location.pathname + location.search + "#" + q.toString());
}
function applyHash(){
  const h = location.hash.replace(/^#/, "");
  if (!h) return false;
  const q = new URLSearchParams(h);
  const press = (id, vals) => document.getElementById(id).querySelectorAll(".chip").forEach(c =>
    c.setAttribute("aria-pressed", vals.includes(c.dataset.val) ? "true" : "false"));
  const age = q.get("age");
  press("ageChips",   AGE_BANDS.includes(age) ? [age] : []);
  press("themeChips", (q.get("t")||"").split(",").filter(t => window.THEME_VOCAB.includes(t)));
  press("moodChips",  (q.get("m")||"").split(",").filter(m => window.MOOD_VOCAB.includes(m)));
  document.getElementById("noteBox").value = q.get("n") || "";
  shuffleSalt = Math.max(0, parseInt(q.get("s")||"0", 10) || 0);
  return AGE_BANDS.includes(age);
}
async function copyLink(btn){
  const old = btn.textContent;
  try { await navigator.clipboard.writeText(location.href); btn.textContent = "복사됐어요 ✓"; }
  catch(_) { btn.textContent = "복사 실패"; }
  setTimeout(() => { btn.textContent = old; }, 1600);
}

/* ── optional AI mode via shared Bedrock proxy (non-streaming) ── */

const CLAUDE_PROXY = "https://ai.pb.gurum.se";
async function solveProxyPoW(signal){
  const r = await fetch(CLAUDE_PROXY + "/api/claude-challenge", { signal });
  if(!r.ok){ const e=new Error("challenge "+r.status); e.status=r.status; throw e; }
  const { nonce, exp, sig, difficulty } = await r.json();
  const enc = new TextEncoder();
  const leadBits = (buf)=>{ const b=new Uint8Array(buf); let bits=0;
    for(const x of b){ if(x===0){bits+=8;continue;} let v=x,c=0; while((v&0x80)===0){c++;v<<=1;} bits+=c; break; } return bits; };
  for(let counter=0;;counter++){
    if(signal && signal.aborted) throw new DOMException("aborted","AbortError");
    const d = await crypto.subtle.digest("SHA-256", enc.encode(nonce+":"+counter));
    if(leadBits(d)>=difficulty) return { "X-PoW-Nonce":nonce,"X-PoW-Exp":exp,"X-PoW-Sig":sig,"X-PoW-Counter":String(counter) };
    if(counter>5000000) throw new Error("pow-timeout");
  }
}

function buildSys(){
  return `<role>당신은 한국 어린이도서관의 그림책 큐레이터입니다. 0~9세 아이를 키우는 한국 부모에게 책을 추천합니다. 당신은 영미권 사서가 아니라, 한국 그림책 문화와 영어권 그림책 정전을 모두 아는 이중언어 큐레이터입니다.</role>
<voice>따뜻하고 구체적인 한국어. 부모가 아이와 함께 읽는 장면이 그려지도록. 과장·광고 문구 금지. 추천 이유는 1~2문장, 따뜻하고 자신감 있게.</voice>
<reasoning_order>1) 아이 나이대에 맞는 책인지 확인 2) 관심사·분위기와 어떻게 맞는지 3) 부모의 '한마디'를 반영 4) 함께 읽을 때의 팁을 떠올린다 5) 한국 책과 영어 책의 균형.</reasoning_order>
<canonical_books>추천할 책은 user 메시지에 JSON으로 제공됩니다. 추천 이유는 그 책에 대해서만 쓰세요. 제공되지 않은 책의 줄거리를 지어내지 마세요.</canonical_books>
<canonical_authors>백희나, 권정생, 이수지, 안녕달, 이억배, 채인선, 최숙희, 고대영, 이지은, Julia Donaldson, Axel Scheffler, Eric Carle, Mo Willems, Oliver Jeffers, Maurice Sendak, Janet & Allan Ahlberg</canonical_authors>
<errors_to_avoid>
1) 없는 책·작가·출판사·ISBN을 절대 지어내지 말 것. 확신이 없으면 언급하지 말 것.
2) 한글 제목을 로마자로 바꾸지 말 것 — 한글이 정식 제목.
3) 아이 나이대보다 높은(무섭거나 성숙한) 내용을 추천하지 말 것.
4) 미국 도서관/학교 용어(Lexile, guided reading) 쓰지 말 것.
5) 영어 책이라도 '왜 이 책일까요?'와 '함께 읽기 팁'은 한국어로 쓸 것.
6) 추천 이유에 과장·광고 문구를 넣지 말 것.
7) 같은 유명 책만 반복하지 말고 부모가 고른 관심사·분위기·나이에 맞출 것.
8) 환상은 분위기가 아니라 테마임 — 분위기는 웃긴/따뜻한/모험/학습/잔잔한.
9) 한국 명절·정서 책(추석, 설, 한복)에 중국/미국 문화 틀을 섞지 말 것.
10) 지나치게 망설이는 말투("혹시 고려해 보실 수도…") 금지 — 사서답게 따뜻하고 분명하게.
</errors_to_avoid>
<output_constraints>각 책의 reason은 1~2문장 한국어, tip은 한 줄 한국어. 부모의 '한마디'가 있으면 reason에 자연스럽게 반영. 제공된 모든 책에 대해 하나씩, id를 그대로 돌려줄 것.</output_constraints>
<output>반드시 book_blurbs 도구를 호출해 결과를 구조화해 반환하세요. 평문으로 답하지 마세요.</output>`;
}

// One tool call covers the whole set: {items:[{id, reason, tip}, …]} keyed by book id.
// One request = one proof-of-work challenge per run (the proxy caps challenges at
// 20/min/IP; six per run burned through that after ~3 runs). The proxy forwards
// tools/tool_choice to Bedrock, so Sonnet returns a guaranteed-shape tool_use block.
const BOOKS_TOOL = {
  name: "book_blurbs",
  description: "제공된 그림책 각각에 대한 추천 이유와 함께 읽기 팁을 한국어로 작성한다. 책 id를 그대로 돌려준다.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string" }, reason: { type: "string" }, tip: { type: "string" } },
          required: ["id", "reason", "tip"]
        }
      }
    },
    required: ["items"]
  }
};

// Polish ALL picked books in one call. Returns Map<id, {reason, tip}>; books the model
// skipped simply aren't in the map (their cards keep the catalog text).
async function aiBlurbsForBooks(p, books, signal){
  const sys = buildSys();
  const slim = books.map(b => ({ id:b.id, lang:b.lang, title:b.title, author:b.author, ages:b.ages, level:b.level, themes:b.themes, mood:b.mood }));
  const user = `아이 정보: 나이 ${p.age||"미정"}, 관심사 [${p.themes.join(", ")||"없음"}], 분위기 [${p.moods.join(", ")||"없음"}]\n부모 한마디: ${p.note||"(없음)"}\n\n추천할 책 ${books.length}권:\n${JSON.stringify(slim)}\n\n각 책에 대한 추천 이유(reason)와 함께 읽기 팁(tip)을 book_blurbs 도구로 반환하세요. 부모의 '한마디'를 자연스럽게 반영하세요.`;
  const pow = await solveProxyPoW(signal);
  const res = await fetch(CLAUDE_PROXY + "/api/claude", {
    method:"POST", headers:{ "Content-Type":"application/json", ...pow }, signal,
    body: JSON.stringify({ model:"sonnet", max_tokens:2500, system:sys,
      messages:[{ role:"user", content:user }],
      tools:[BOOKS_TOOL], tool_choice:{ type:"tool", name:"book_blurbs" } })
  });
  if(!res.ok){ const e=new Error("proxy "+res.status); e.status=res.status; throw e; }
  const j = await res.json();
  const tu = (j.content || []).find(c => c.type === "tool_use" && c.name === "book_blurbs");
  if (!tu || !tu.input || !Array.isArray(tu.input.items)) throw new Error("no structured output");
  const out = new Map();
  for (const it of tu.input.items) if (it && typeof it.id === "string") out.set(it.id, { reason: it.reason, tip: it.tip });
  return out;
}

document.getElementById("aiToggle").addEventListener("click", function(){
  this.setAttribute("aria-pressed", this.getAttribute("aria-pressed")==="true" ? "false":"true");
});
// Generation token: a reroll/new search bumps this so an in-flight result from a
// previous run is discarded instead of writing onto the new cards.
let aiGen = 0;
let aiAbort = null;
let lastRun = null;   // { p, books } — what "다시 시도" re-polishes

function setModePill(state){
  const live = document.querySelector("#results .resbar [aria-live]");
  if (!live) return;
  const old = live.querySelector(".demo-pill"); if (old) old.remove();
  live.insertAdjacentHTML("beforeend", pillHtml(state));
}
// Error line under the results bar: "라이브 서버가 잠시 바쁩니다 (NNN) — 다시 시도".
// `code` is the proxy HTTP status when we have one, else a short cause.
function showAiFailNote(code){
  const grid = document.querySelector("#results .grid");
  if (!grid) return;
  const old = document.querySelector("#results .ainote"); if (old) old.remove();
  grid.insertAdjacentHTML("beforebegin",
    `<div class="ainote" role="status"><span>라이브 서버가 잠시 바쁩니다 (${escapeHtml(code)}) —</span><button type="button" class="retry">다시 시도</button></div>`);
}
// Busy = whole call (challenge + PoW + fetch). Trigger, toggle, reroll and the per-card
// shelf actions are disabled so a double-submit can't burn a nonce or race the render.
const FIND_LABEL = document.getElementById("findBtn").textContent;
function setBusy(on){
  const find = document.getElementById("findBtn");
  find.disabled = on; find.textContent = on ? "다듬는 중…" : FIND_LABEL;
  document.getElementById("aiToggle").disabled = on;
  const rr = document.getElementById("reroll"); if (rr) rr.disabled = on;
  document.getElementById("results").classList.toggle("ai-busy", on);
}

async function polishWithAI(p, books){
  aiGen++; const gen = aiGen;
  if (aiAbort) aiAbort.abort();
  const ctl = new AbortController();
  aiAbort = ctl;
  // safety net: don't let a stalled request lock the UI forever. Abort THIS run's
  // controller, not whatever aiAbort points at by the time the timer fires.
  const timer = setTimeout(() => { try { ctl.abort(); } catch(_){} }, 30000);
  setBusy(true);
  setModePill("busy");
  books.forEach(b => { const c = document.querySelector(`#results .bookcard[data-bookid="${cssEsc(b.id)}"]`);
    if (c && !c.querySelector(".aibadge")) { c.classList.add("ai-pending"); c.querySelector(".toprow").insertAdjacentHTML("beforeend", `<span class="aibadge">✨ AI 다듬는 중…</span>`); } });
  try {
    const got = await aiBlurbsForBooks(p, books, ctl.signal);
    if (gen !== aiGen) return;
    let anyOk = false;
    for (const b of books){
      const r = got.get(b.id);
      if (r && (r.reason || r.tip)) { anyOk = true; patchCard(b.id, r); }
      else patchCard(b.id, { failed: true });
    }
    if (!anyOk) throw new Error("empty result");
    setModePill("live");
  } catch(err) {
    // Only bail silently when a NEWER run superseded us (its render replaced our cards).
    if (gen !== aiGen) return;
    const code = err.name === "AbortError" ? "시간 초과" : (err.status ? String(err.status) : "연결 실패");
    console.warn("[책친구] AI polish failed:", code, err.message);
    books.forEach(b => patchCard(b.id, { failed: true }));   // keep catalog blurbs, drop badges
    setModePill("warn");                                      // deterministic engine is the fallback
    showAiFailNote(code);
  } finally {
    clearTimeout(timer);
    if (gen === aiGen) setBusy(false);
  }
}

function runRecommend(varied){
  const p = readProfile();
  if (!p.age){
    const hint = document.getElementById("ageHint");
    hint.hidden = false;
    const first = document.querySelector("#ageChips .chip");
    if (first) first.focus();
    document.getElementById("ageLab").scrollIntoView({ behavior:"smooth", block:"center" });
    return;
  }
  const books = recommend(p, !!varied);
  const aiOn = document.getElementById("aiToggle").getAttribute("aria-pressed")==="true";
  writeHash(p);
  lastRun = { p, books, varied: !!varied };
  dismissHint();

  // a new render supersedes any in-flight AI call
  aiGen++;
  if (aiAbort) aiAbort.abort();
  setBusy(false);

  if(!aiOn){ renderResults(books); scrollResults(); return; }

  // Render all cards IMMEDIATELY with catalog blurbs + a per-card "AI 다듬는 중…" badge,
  // then fill them in place when the single batched call returns.
  renderResults(books, { pill:"busy", pending: new Set(books.map(b => b.id)) });
  scrollResults();
  polishWithAI(p, books);
}

/* ── shelf actions on a card: "이미 있어요" → owned, "숨기기" → hidden ──
   The card is swapped in place for the next-best unseen book (scoring is deterministic,
   so recommend() with the book excluded yields the same set plus one newcomer). */
function shelveBook(id, kind){
  if (!SHELF[kind]) return;
  SHELF[kind].add(id); saveShelf(kind);
  const card = document.querySelector(`#results .bookcard[data-bookid="${cssEsc(id)}"]`);
  const wrap = card ? card.closest(".cardwrap") : null;
  if (lastRun){
    const shown = new Set(lastRun.books.map(b => b.id));
    const repl = recommend(lastRun.p, lastRun.varied).find(b => !shown.has(b.id)) || null;
    lastRun.books = lastRun.books.filter(b => b.id !== id);
    if (repl) lastRun.books.push(repl);
    if (wrap){
      if (repl){
        wrap.innerHTML = cardHtml(repl, false);
        wrap.style.animation = "none"; void wrap.offsetWidth; wrap.style.animation = ""; // replay draw-on
        wrap.style.setProperty("--i", 0);
        swapCovers(wrap);
        const aiOn = document.getElementById("aiToggle").getAttribute("aria-pressed")==="true";
        if (aiOn) polishWithAI(lastRun.p, [repl]);
      } else wrap.remove();
    }
  } else if (wrap) wrap.remove();
  updateCount();
  renderShelf();
}

/* ── footer: "우리 책장" (owned, collapsed) + "숨긴 책 N권 · 관리" (hidden) with restore ── */
function bookById(id){ return window.BOOKS.find(b => b.id === id); }
function renderShelf(){
  const el = document.getElementById("shelf"); if (!el) return;
  const owned  = [...SHELF.owned].map(bookById).filter(Boolean);
  const hidden = [...SHELF.hidden].map(bookById).filter(Boolean);
  const wasOpen = (id) => { const d = document.getElementById(id); return !!(d && d.open); };
  const openOwned = wasOpen("ownedBox"), openHidden = wasOpen("hiddenBox");
  if (!owned.length && !hidden.length){ el.innerHTML = ""; return; }
  const row = (b, kind) => `<li><span class="sflag">${FLAG[b.lang]||""}</span>
    <span class="sname"><span class="stitle">${escapeHtml(b.title)}</span> <span class="sauth">${escapeHtml(b.author)}</span></span>
    <button type="button" class="restore" data-kind="${kind}" data-id="${escapeHtml(b.id)}" aria-label="『${escapeHtml(b.title)}』 ${kind==="owned"?"책장에서 빼기":"다시 추천받기"}">${kind==="owned"?"빼기":"되살리기"}</button></li>`;
  el.innerHTML =
    (owned.length ? `<details class="shelfbox" id="ownedBox"${openOwned?" open":""}><summary>📚 우리 책장 · ${owned.length}권</summary>
      <p class="shelfnote">이미 있다고 표시한 책이에요. 추천에서는 빠져요.</p><ul>${owned.map(b => row(b,"owned")).join("")}</ul></details>` : "")
  + (hidden.length ? `<details class="shelfbox hiddenbox" id="hiddenBox"${openHidden?" open":""}><summary>숨긴 책 ${hidden.length}권 · 관리</summary>
      <ul>${hidden.map(b => row(b,"hidden")).join("")}</ul></details>` : "");
}
document.getElementById("shelf").addEventListener("click", e => {
  const r = e.target.closest(".restore"); if (!r) return;
  const kind = r.dataset.kind; if (!SHELF[kind]) return;
  SHELF[kind].delete(r.dataset.id); saveShelf(kind);
  renderShelf();
});
renderShelf();

/* ── one-time first-run hint on phones (≤600px) ── */
const HINT_KEY = "vibe.kids-bookshelf.hinted";
function dismissHint(){
  const el = document.getElementById("firstHint"); if (!el || el.hidden) return;
  el.hidden = true;
  try { localStorage.setItem(HINT_KEY, "1"); } catch(_){}
}
(function initHint(){
  const el = document.getElementById("firstHint"); if (!el) return;
  let seen = false; try { seen = localStorage.getItem(HINT_KEY) === "1"; } catch(_){}
  if (seen || location.hash || !window.matchMedia("(max-width:600px)").matches) return;
  el.hidden = false;
  el.querySelector(".hintclose").addEventListener("click", dismissHint);
})();

document.getElementById("findBtn").addEventListener("click", () => { shuffleSalt = 0; runRecommend(false); });
document.getElementById("results").addEventListener("click", e => {
  if (e.target.closest("#reroll")) { shuffleSalt++; runRecommend(true); return; }
  const copy = e.target.closest("#copyLink");
  if (copy) { copyLink(copy); return; }
  const act = e.target.closest(".act[data-act]");
  if (act) {
    if (document.getElementById("results").classList.contains("ai-busy")) return;
    const card = act.closest(".bookcard");
    if (card) shelveBook(card.dataset.bookid, act.dataset.act);
    return;
  }
  if (e.target.closest(".ainote .retry") && lastRun) {
    const note = document.querySelector("#results .ainote"); if (note) note.remove();
    polishWithAI(lastRun.p, lastRun.books);
  }
});

// Shared link? Restore the profile and show the same 6 books (AI mode stays off).
if (applyHash()) runRecommend(shuffleSalt > 0);
