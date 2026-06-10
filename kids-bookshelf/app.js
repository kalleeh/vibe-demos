/* 책친구 — app logic. Reads window.BOOKS / THEME_VOCAB / MOOD_VOCAB from catalog.js. */
"use strict";
// (filled in Tasks 3–5)

const THEME_EMOJI = {
  "공룡":"🦖","우주":"🚀","동물":"🐱","공주":"👑","자동차":"🚗","탈것":"🚂",
  "그림그리기":"🎨","잠자리":"🌙","자연":"🌳","음식":"🍪","가족":"👨‍👩‍👧","친구":"🤝",
  "감정":"💛","일상":"🏠","환상":"✨","모험":"🗺️","숫자/글자":"🔤","유머":"😆"
};
const MOOD_EMOJI = { "웃긴":"😆","따뜻한":"🤗","모험":"🗺️","학습":"📚","잔잔한":"🌿" };

function chip(val, emoji, pressed, label){
  const text = (emoji ? emoji + " " : "") + (label || val);
  return `<button type="button" class="chip" data-val="${val}" aria-pressed="${pressed?"true":"false"}">${text}</button>`;
}

// Age & gender groups (static vocab); themes & moods from catalog globals.
const AGE_BANDS = ["0-2","3-4","5-6","7-9"];
const GENDERS = ["남아","여아","상관없음"];
document.getElementById("ageChips").innerHTML    = AGE_BANDS.map(a => chip(a, "", false, a + "세")).join("");
document.getElementById("genderChips").innerHTML = GENDERS.map(g => chip(g, "", g==="상관없음")).join("");
document.getElementById("themeChips").innerHTML  = window.THEME_VOCAB.map(t => chip(t, THEME_EMOJI[t]||"•", false)).join("");
document.getElementById("moodChips").innerHTML   = window.MOOD_VOCAB.map(m => chip(m, MOOD_EMOJI[m]||"•", false)).join("");

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

// Score one book against the profile. Higher = better fit. Age is a soft gate.
function scoreBook(b, p){
  let s = 0;
  if (p.age){
    if (b.ages.includes(p.age)) s += 5;
    else {
      const order = ["0-2","3-4","5-6","7-9"];
      const pi = order.indexOf(p.age);
      const adj = b.ages.some(a => Math.abs(order.indexOf(a)-pi)===1);
      s += adj ? 1.5 : -4;
    }
  }
  s += b.themes.filter(t => p.themes.includes(t)).length * 3;
  s += b.mood.filter(m => p.moods.includes(m)).length * 2;
  if (p.note){
    const note = p.note.toLowerCase();
    if (b.themes.some(t => note.includes(t.toLowerCase()))) s += 2;
    if (note.includes(b.title.toLowerCase())) s += 4;
  }
  // gender: soft nudge only; no gender field on books at launch -> reserved hook, 0.
  s += (b.id.charCodeAt(b.id.length-1) % 7) * 0.01;
  return s;
}

let shuffleSalt = 0;
// Thin alias retained for compat; routes through recommend2 (defined below). DRY.
function recommend(p){ return recommend2(p, false); }

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
function cardHtml(b, reason, tip, tag){
  reason = reason || b.blurb; tip = tip || b.readAloud;
  const lvl = escapeHtml(b.level);
  const meta = escapeHtml(b.author) + (b.publisher ? " · " + escapeHtml(b.publisher) : "");
  return `<article class="bookcard" data-isbn="${b.lang==="en" && b.isbn ? escapeHtml(b.isbn) : ""}">
    <div class="cover">${svgCover(b)}</div>
    <div class="info">
      <div class="toprow"><span class="flag">${FLAG[b.lang]||""}</span>
        <span class="lvl">${lvl}</span>${tag ? `<span class="aitag">${escapeHtml(tag)}</span>`:""}</div>
      <h3 class="btitle">${escapeHtml(b.title)}</h3>
      <div class="bmeta">${meta}</div>
      <p class="why"><b>왜 이 책일까요?</b> ${escapeHtml(reason)}</p>
      <p class="tip"><b>함께 읽기 팁</b> ${escapeHtml(tip)}</p>
    </div>
  </article>`;
}

function renderResults(books, opts){
  opts = opts || {};
  const wrap = document.getElementById("results");
  const loadingBar = opts.loading ? `<div class="scribble" aria-hidden="true"></div>` : "";
  const errNote = opts.aiError ? `<div class="ainote">AI 추천을 지금 불러올 수 없어 기본 추천을 보여드려요.</div>` : "";
  const label = opts.modeLabel ? `<span class="demo-pill">${escapeHtml(opts.modeLabel)}</span>` : "";
  wrap.innerHTML = `<div class="resbar"><span>${books.length}권 추천${label}</span>
    <button id="reroll" class="reroll" type="button">다시 추천 🎲</button></div>
    ${errNote}${loadingBar}
    <div class="grid">${books.map((b,i) => `<div class="cardwrap" style="--i:${i}">${cardHtml(b, opts.reasons?.[b.id], opts.tips?.[b.id], opts.tags?.[b.id])}</div>`).join("")}</div>`;
  // lazy real-cover swap (English ISBNs only). Open Library; silent fallback to SVG.
  if (!opts.loading) swapCovers(wrap);
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
function recommend2(p, varied){
  const scored = window.BOOKS
    .map(b => ({ b, s: scoreBook(b,p) }))
    .filter(x => x.s > -2)
    .sort((a,b) => b.s - a.s);
  const ko = scored.filter(x => x.b.lang==="ko");
  const en = scored.filter(x => x.b.lang==="en");
  let pick;
  if (varied){
    // draw from the top ~8 of each pool so rerolls feel alive but stay well-fit
    pick = [...pickVaried(ko, 3, 8), ...pickVaried(en, 3, 8)];
  } else {
    pick = [...ko.slice(0,3), ...en.slice(0,3)];
  }
  if (pick.length < 6){
    const used = new Set(pick.map(x=>x.b.id));
    for (const x of scored){ if(pick.length>=6) break; if(!used.has(x.b.id)){ pick.push(x); used.add(x.b.id);} }
  }
  return pick.map(x => x.b);
}

function scrollResults(){ document.getElementById("results").scrollIntoView({behavior:"smooth", block:"start"}); }
function runRecommend(varied){
  const p = readProfile();
  const books = recommend2(p, !!varied);
  renderResults(books, { modeLabel:" · 추천 예시" });   // canned-mode label (Task 5 overrides when AI on)
  scrollResults();
}
document.getElementById("findBtn").addEventListener("click", () => runRecommend(false));
document.getElementById("results").addEventListener("click", e => {
  if (e.target.closest("#reroll")) { shuffleSalt++; runRecommend(true); }
});
