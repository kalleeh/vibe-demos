/* 책친구 — app logic. Reads window.BOOKS / THEME_VOCAB / MOOD_VOCAB from catalog.js. */
"use strict";
// (filled in Tasks 3–5)

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
const NOTE_LEXICON = [
  { kw: ["공룡","티라노","브라키오","다이노","dino","dinosaur"], theme:"공룡" },
  { kw: ["우주","로켓","행성","별","space","rocket","planet"], theme:"우주" },
  { kw: ["동물","강아지","고양이","토끼","곰","사자","animal","puppy","cat"], theme:"동물" },
  { kw: ["공주","왕자","드레스","princess"], theme:"공주" },
  { kw: ["자동차","부릉","car"], theme:"자동차" },
  { kw: ["기차","버스","비행기","탈것","train","bus","plane"], theme:"탈것" },
  { kw: ["그림","색칠","크레용","draw","paint","color"], theme:"그림그리기" },
  { kw: ["잠","자기 전","잠들기","재우","잠자리","bedtime","sleep"], theme:"잠자리", mood:"잔잔한" },
  { kw: ["자연","숲","나무","꽃","바다","nature","forest"], theme:"자연" },
  { kw: ["음식","먹","요리","빵","과자","food","eat"], theme:"음식" },
  { kw: ["가족","엄마","아빠","할머니","형제","family"], theme:"가족" },
  { kw: ["친구","우정","friend"], theme:"친구" },
  { kw: ["감정","마음","화","슬픔","무서","feeling","emotion"], theme:"감정" },
  { kw: ["환상","마법","요정","상상","fantasy","magic"], theme:"환상" },
  { kw: ["일상","하루","어린이집","유치원","daily","routine"], theme:"일상" },
  { kw: ["모험","탐험","여행","adventure","explore"], theme:"모험", mood:"모험" },
  { kw: ["숫자","글자","한글","abc","number","letter","알파벳"], theme:"숫자/글자", mood:"학습" },
  { kw: ["웃긴","까르르","웃겨","재밌","funny","laugh"], theme:"유머", mood:"웃긴" },
  { kw: ["따뜻","포근","사랑","warm","cozy"], mood:"따뜻한" },
  { kw: ["배우","공부","교육","learn","educational"], mood:"학습" },
  { kw: ["무서워","무서운","scary","afraid"], mood:"모험", dir:-1 }, // downweight scary/adventure
];

// Returns {themes:{theme:weight}, moods:{mood:weight}} derived from the note text.
function lexiconSignals(note){
  const out = { themes:{}, moods:{} };
  if(!note) return out;
  const n = note.toLowerCase();
  for(const e of NOTE_LEXICON){
    if(e.kw.some(k => n.includes(k.toLowerCase()))){
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

// Age & gender groups (static vocab, label-only); themes & moods get crayon icons.
const AGE_BANDS = ["0-2","3-4","5-6","7-9"];
const GENDERS = ["남아","여아","상관없음"];
document.getElementById("ageChips").innerHTML    = AGE_BANDS.map(a => chip(a, "", false, a + "세")).join("");
document.getElementById("genderChips").innerHTML = GENDERS.map(g => chip(g, "", g==="상관없음")).join("");
document.getElementById("themeChips").innerHTML  = window.THEME_VOCAB.map(t => chip(t, THEME_ICON[t]||"", false)).join("");
document.getElementById("moodChips").innerHTML   = window.MOOD_VOCAB.map(m => chip(m, MOOD_ICON[m]||"", false)).join("");

function wireGroup(containerId, single){
  const el = document.getElementById(containerId);
  el.addEventListener("click", e => {
    const b = e.target.closest(".chip"); if(!b) return;
    if (single) el.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c===b ? "true":"false"));
    else b.setAttribute("aria-pressed", b.getAttribute("aria-pressed")==="true" ? "false":"true");
  });
}
["ageChips","genderChips"].forEach(id => wireGroup(id, true));
["themeChips","moodChips"].forEach(id => wireGroup(id, false));

function readProfile(){
  const sel = (id) => [...document.getElementById(id).querySelectorAll('.chip[aria-pressed="true"]')].map(c=>c.dataset.val);
  return {
    age: sel("ageChips")[0] || null,
    gender: sel("genderChips")[0] || "상관없음",
    themes: sel("themeChips"),
    moods: sel("moodChips"),
    note: (document.getElementById("noteBox").value||"").trim()
  };
}

// Deterministic fit score. Higher = better. Uses age curve, weighted theme/mood match,
// the note lexicon, and a small build-time quality prior. No model, no randomness here
// (reroll variety lives in pickVaried); a tiny id tiebreak keeps equal scores stable.
function scoreBook(b, p){
  // p.gender is deliberately NOT scored: books carry no gender field (tagging picture
  // books by gender would bake in stereotypes). It only flavors the AI-mode prompt.
  let s = 0;
  // age: exact band best, adjacent soft, far penalized (soft gate, not hard)
  if (p.age){
    if (b.ages.includes(p.age)) s += 5;
    else {
      const order = ["0-2","3-4","5-6","7-9"];
      const pi = order.indexOf(p.age);
      const adj = b.ages.some(a => Math.abs(order.indexOf(a)-pi)===1);
      s += adj ? 1.5 : -4;
    }
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
  // build-time quality prior: small nudge so classics surface (range ~0..1.2)
  s += (typeof b.quality === "number" ? b.quality : 0.5) * 1.2;
  // stable tiny tiebreak
  s += (b.id.charCodeAt(b.id.length-1) % 7) * 0.01;
  return s;
}

let shuffleSalt = 0;

/* ── Task 4: rendering, crayon SVG covers, Open Library swap, varied reroll ── */

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

const FLAG = { ko:"🇰🇷", en:"🇬🇧" };
function cardHtml(b, pending){
  const lvl = escapeHtml(b.level);
  const meta = escapeHtml(b.author) + (b.publisher ? " · " + escapeHtml(b.publisher) : "");
  // pending = this card's AI reason/tip is still being written (per-book progressive load)
  const badge = pending ? `<span class="aibadge">✨ AI 다듬는 중…</span>` : "";
  return `<article class="bookcard${pending?" ai-pending":""}" data-bookid="${escapeHtml(b.id)}" data-isbn="${b.lang==="en" && b.isbn ? escapeHtml(b.isbn) : ""}">
    <div class="cover">${svgCover(b)}</div>
    <div class="info">
      <div class="toprow"><span class="flag">${FLAG[b.lang]||""}</span>
        <span class="lvl">${lvl}</span>${badge}</div>
      <h3 class="btitle">${escapeHtml(b.title)}</h3>
      <div class="bmeta">${meta}</div>
      <p class="why"><b>왜 이 책일까요?</b> <span class="why-tx">${escapeHtml(b.blurb)}</span></p>
      <p class="tip"><b>함께 읽기 팁</b> <span class="tip-tx">${escapeHtml(b.readAloud)}</span></p>
    </div>
  </article>`;
}

// Patch one already-rendered card in place when its per-book AI result arrives.
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

function renderResults(books, opts){
  opts = opts || {};
  const wrap = document.getElementById("results");
  const label = opts.modeLabel ? `<span class="demo-pill">${escapeHtml(opts.modeLabel)}</span>` : "";
  const pend = opts.pending instanceof Set ? opts.pending : null;
  wrap.innerHTML = `<div class="resbar"><span>${books.length}권 추천${label}</span>
    <button id="reroll" class="reroll" type="button">다시 추천 🎲</button></div>
    <div class="grid">${books.map((b,i) => `<div class="cardwrap" style="--i:${i}">${cardHtml(b, pend ? pend.has(b.id) : false)}</div>`).join("")}</div>`;
  // lazy real-cover swap (English ISBNs only). Open Library; silent fallback to SVG.
  swapCovers(wrap);
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
// surface more than one dino book).
function pickDiverse(sortedPool, n, pickedThemes){
  const out = [], primCount = {};
  const cap = (prim) => (pickedThemes && pickedThemes.has(prim)) ? 2 : 1;
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
function recommend2(p, varied){
  const scored = window.BOOKS
    .map(b => ({ b, s: scoreBook(b,p) }))
    .filter(x => x.s > -2)
    .sort((a,b) => b.s - a.s);
  const ko = scored.filter(x => x.b.lang==="ko");
  const en = scored.filter(x => x.b.lang==="en");
  const pickedThemes = new Set(p.themes || []);
  let koPick, enPick;
  if (varied){
    // reroll: rotate a wider pool for variety, THEN diversify by theme
    koPick = pickDiverse(pickVaried(ko, 8, 16), 3, pickedThemes);
    enPick = pickDiverse(pickVaried(en, 8, 16), 3, pickedThemes);
  } else {
    koPick = pickDiverse(ko, 3, pickedThemes);
    enPick = pickDiverse(en, 3, pickedThemes);
  }
  let pick = [...koPick, ...enPick];
  if (pick.length < 6){
    const used = new Set(pick.map(x=>x.b.id));
    for (const x of scored){ if(pick.length>=6) break; if(!used.has(x.b.id)){ pick.push(x); used.add(x.b.id);} }
  }
  return pick.map(x => x.b);
}

function scrollResults(){ document.getElementById("results").scrollIntoView({behavior:"smooth", block:"start"}); }

/* ── Task 5: optional AI mode via shared Bedrock proxy (non-streaming) ── */

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
<output_constraints>reason은 1~2문장 한국어, tip은 한 줄 한국어. 부모의 '한마디'가 있으면 reason에 자연스럽게 반영.</output_constraints>
<output>반드시 book_blurb 도구를 호출해 결과를 구조화해 반환하세요. 평문으로 답하지 마세요.</output>`;
}

// Per-book tool: one book in, {reason, tip} out. Lets cards fill progressively.
// The proxy forwards tools/tool_choice to Bedrock, so Sonnet returns a
// guaranteed-shape tool_use block (no fragile text parsing).
const BOOK_TOOL = {
  name: "book_blurb",
  description: "이 한 권에 대한 추천 이유와 함께 읽기 팁을 한국어로 작성한다.",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string" }, tip: { type: "string" } },
    required: ["reason", "tip"]
  }
};

// Recommend ONE book — fast (~3-5s) so the grid fills card-by-card. Reuses buildSys()
// for the same voice/errors, but the user turn is scoped to a single title.
async function aiBlurbForBook(p, b, signal){
  const sys = buildSys();
  const user = `아이 정보: 나이 ${p.age||"미정"}, 성별 ${p.gender}, 관심사 [${p.themes.join(", ")||"없음"}], 분위기 [${p.moods.join(", ")||"없음"}]\n부모 한마디: ${p.note||"(없음)"}\n\n추천할 책 한 권:\n${JSON.stringify({id:b.id,lang:b.lang,title:b.title,author:b.author,ages:b.ages,level:b.level,themes:b.themes,mood:b.mood})}\n\n이 책에 대한 추천 이유(reason)와 함께 읽기 팁(tip)을 book_blurb 도구로 반환하세요. 부모의 '한마디'를 자연스럽게 반영하세요.`;
  const pow = await solveProxyPoW(signal);
  const res = await fetch(CLAUDE_PROXY + "/api/claude", {
    method:"POST", headers:{ "Content-Type":"application/json", ...pow }, signal,
    body: JSON.stringify({ model:"sonnet", max_tokens:600, system:sys,
      messages:[{ role:"user", content:user }],
      tools:[BOOK_TOOL], tool_choice:{ type:"tool", name:"book_blurb" } })
  });
  if(!res.ok){ const e=new Error("proxy "+res.status); e.status=res.status; throw e; }
  const j = await res.json();
  const tu = (j.content || []).find(c => c.type === "tool_use" && c.name === "book_blurb");
  if (!tu || !tu.input) throw new Error("no structured output");
  return tu.input;   // { reason, tip }
}

// Run up to `limit` async tasks at a time (keeps us under the proxy rate window
// and avoids hammering — 6 books at 3-wide finishes in ~2 waves).
async function runPool(items, limit, worker){
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

document.getElementById("aiToggle").addEventListener("click", function(){
  this.setAttribute("aria-pressed", this.getAttribute("aria-pressed")==="true" ? "false":"true");
});
// Generation token: a reroll/new search bumps this so in-flight per-book patches
// from a previous run are discarded instead of writing onto the new cards.
let aiGen = 0;
let aiAbort = null;

async function runRecommend(varied){
  const p = readProfile();
  const books = recommend2(p, !!varied);
  const aiOn = document.getElementById("aiToggle").getAttribute("aria-pressed")==="true";

  // cancel any previous run's in-flight calls
  aiGen++; const gen = aiGen;
  if (aiAbort) aiAbort.abort();

  if(!aiOn){ renderResults(books, { modeLabel:" · 추천 예시" }); scrollResults(); return; }

  // Render all cards IMMEDIATELY with catalog blurbs + a per-card "AI 다듬는 중…" badge,
  // then fill each card in place as its single-book call returns (progressive load).
  const pending = new Set(books.map(b => b.id));
  renderResults(books, { modeLabel:" · AI 맞춤 추천", pending });
  scrollResults();

  aiAbort = new AbortController();
  const signal = aiAbort.signal;
  // safety net: don't let a stalled book hang its card forever
  const timer = setTimeout(() => { try { aiAbort && aiAbort.abort(); } catch(_){} }, 40000);

  let anyOk = false, anyFail = false;
  try {
    await runPool(books, 3, async (b) => {
      if (gen !== aiGen) return;                 // a newer run superseded this one
      try {
        const r = await aiBlurbForBook(p, b, signal);
        if (gen !== aiGen) return;
        anyOk = true;
        patchCard(b.id, { reason: r.reason, tip: r.tip });
      } catch(err) {
        // Only bail silently when a NEWER run superseded us (its render replaced our
        // cards). An abort on the CURRENT gen is the 40s safety timer firing — that
        // card must still be released or its "AI 다듬는 중…" badge pulses forever.
        if (gen !== aiGen) return;
        anyFail = true;
        const why = err.name === "AbortError" ? "aborted (timeout)" : (err.status ? "proxy "+err.status : err.message);
        console.warn("[책친구] book", b.id, "AI failed:", why);
        patchCard(b.id, { failed: true });        // keep the catalog blurb, drop the badge
      }
    });
  } finally {
    clearTimeout(timer);
  }
  if (gen !== aiGen) return;
  // if literally nothing succeeded, surface the soft fallback note
  if (!anyOk && anyFail) {
    const bar = document.querySelector("#results .resbar span .demo-pill");
    if (bar) bar.textContent = " · 추천 예시";
    const grid = document.querySelector("#results .grid");
    if (grid && !document.querySelector("#results .ainote")) {
      grid.insertAdjacentHTML("beforebegin", `<div class="ainote">AI 추천을 지금 불러올 수 없어 기본 추천을 보여드려요.</div>`);
    }
  }
}
document.getElementById("findBtn").addEventListener("click", () => runRecommend(false));
document.getElementById("results").addEventListener("click", e => {
  if (e.target.closest("#reroll")) { shuffleSalt++; runRecommend(true); }
});
