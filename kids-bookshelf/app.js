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

/* ── Task 5: optional AI mode via shared Bedrock proxy (non-streaming) ── */

const CLAUDE_PROXY = "https://ai.pb.gurum.se";
async function solveProxyPoW(){
  const r = await fetch(CLAUDE_PROXY + "/api/claude-challenge");
  if(!r.ok){ const e=new Error("challenge "+r.status); e.status=r.status; throw e; }
  const { nonce, exp, sig, difficulty } = await r.json();
  const enc = new TextEncoder();
  const leadBits = (buf)=>{ const b=new Uint8Array(buf); let bits=0;
    for(const x of b){ if(x===0){bits+=8;continue;} let v=x,c=0; while((v&0x80)===0){c++;v<<=1;} bits+=c; break; } return bits; };
  for(let counter=0;;counter++){
    const d = await crypto.subtle.digest("SHA-256", enc.encode(nonce+":"+counter));
    if(leadBits(d)>=difficulty) return { "X-PoW-Nonce":nonce,"X-PoW-Exp":exp,"X-PoW-Sig":sig,"X-PoW-Counter":String(counter) };
    if(counter>5000000) throw new Error("pow-timeout");
  }
}

function buildSys(){
  return `<role>당신은 한국 어린이도서관의 그림책 큐레이터입니다. 0~9세 아이를 키우는 한국 부모에게 책을 추천합니다. 당신은 영미권 사서가 아니라, 한국 그림책 문화와 영어권 그림책 정전을 모두 아는 이중언어 큐레이터입니다.</role>
<voice>따뜻하고 구체적인 한국어. 부모가 아이와 함께 읽는 장면이 그려지도록. 과장·광고 문구 금지. 추천 이유는 1~2문장, 따뜻하고 자신감 있게.</voice>
<reasoning_order>1) 아이 나이대에 맞는 책인지 확인 2) 관심사·분위기와 어떻게 맞는지 3) 부모의 '한마디'를 반영 4) 함께 읽을 때의 팁을 떠올린다 5) 한국 책과 영어 책의 균형.</reasoning_order>
<canonical_books>아래 후보(catalog)는 user 메시지에 JSON으로 제공됩니다. 추천 이유는 이 후보 책들에 대해서만 쓰세요. 후보에 없는 책의 줄거리를 지어내지 마세요.</canonical_books>
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
<output_constraints>user가 준 후보 catalog의 각 책 id에 대해 reason(1~2문장, 한국어)과 tip(한 줄, 한국어)을 작성. 부모의 '한마디'가 있으면 reason에 자연스럽게 반영. 추가로 catalog에 없지만 아주 잘 맞는 실제 존재하는 책을 최대 2권까지 "extra"로 제안 가능 — 단 확실히 실재하는 책만, 도전 추천으로.</output_constraints>
<output_schema>순수 JSON만 출력(코드펜스 없이): {"items":{"<book id>":{"reason":"...","tip":"..."}}, "extra":[{"title":"...","author":"...","lang":"ko"|"en","reason":"...","tip":"..."}]}</output_schema>`;
}

async function aiRecommend(p, books){
  const sys = buildSys();
  const candidates = books.map(b => ({ id:b.id, lang:b.lang, title:b.title, author:b.author,
    ages:b.ages, level:b.level, themes:b.themes, mood:b.mood }));
  const user = `아이 정보: 나이 ${p.age||"미정"}, 성별 ${p.gender}, 관심사 [${p.themes.join(", ")||"없음"}], 분위기 [${p.moods.join(", ")||"없음"}]\n부모 한마디: ${p.note||"(없음)"}\n\n추천 후보 catalog(JSON):\n${JSON.stringify(candidates)}\n\n각 후보에 대한 추천 이유와 팁을 위 스키마(JSON)로만 답하세요.`;
  const pow = await solveProxyPoW();
  const res = await fetch(CLAUDE_PROXY + "/api/claude", {
    method:"POST", headers:{ "Content-Type":"application/json", ...pow },
    body: JSON.stringify({ model:"sonnet", max_tokens:1600, system:sys,
      messages:[{ role:"user", content:user }] })
  });
  if(!res.ok){ const e=new Error("proxy "+res.status); e.status=res.status; throw e; }
  const j = await res.json();
  const txt = (j.content && j.content[0] && j.content[0].text) || "{}";
  return JSON.parse(txt.replace(/^```json\s*|\s*```$/g,"").trim());
}

document.getElementById("aiToggle").addEventListener("click", function(){
  this.setAttribute("aria-pressed", this.getAttribute("aria-pressed")==="true" ? "false":"true");
});
async function runRecommend(varied){
  const p = readProfile();
  const books = recommend2(p, !!varied);
  const aiOn = document.getElementById("aiToggle").getAttribute("aria-pressed")==="true";
  if(!aiOn){ renderResults(books, { modeLabel:" · 추천 예시" }); scrollResults(); return; }
  renderResults(books, { modeLabel:" · AI 생성 중…", loading:true });
  scrollResults();
  try{
    const out = await aiRecommend(p, books);
    const reasons={}, tips={}, tags={};
    for(const b of books){ const it = out.items && out.items[b.id]; if(it){ reasons[b.id]=it.reason; tips[b.id]=it.tip; } }
    const extras = (Array.isArray(out.extra)?out.extra:[]).slice(0,2).map((x,i)=>({
      id:"ai-"+i, lang:x.lang==="en"?"en":"ko", title:String(x.title||""), author:String(x.author||""), publisher:"",
      ages:[p.age||"3-4"], level:"그림책", themes:[], mood:[], blurb:String(x.reason||""), readAloud:String(x.tip||""),
      cover:{emoji:"✨", palette:["#fff3d6","#ffe9c7"]}, source:"ai"
    }));
    const all=[...books, ...extras];
    extras.forEach(e=>{ reasons[e.id]=e.blurb; tips[e.id]=e.readAloud; tags[e.id]="✨ 도전 추천"; });
    renderResults(all, { modeLabel:" · AI 맞춤 추천", reasons, tips, tags });
  }catch(err){
    renderResults(books, { modeLabel:" · 추천 예시", aiError:true });
  }
}
document.getElementById("findBtn").addEventListener("click", () => runRecommend(false));
document.getElementById("results").addEventListener("click", e => {
  if (e.target.closest("#reroll")) { shuffleSalt++; runRecommend(true); }
});
