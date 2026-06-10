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
function recommend(p){
  const scored = window.BOOKS
    .map(b => ({ b, s: scoreBook(b,p) + ((b.id.length*7 + shuffleSalt*13) % 11)*0.02 }))
    .filter(x => x.s > -2)
    .sort((a,b) => b.s - a.s);
  const ko = scored.filter(x => x.b.lang==="ko");
  const en = scored.filter(x => x.b.lang==="en");
  const pick = [...ko.slice(0,3), ...en.slice(0,3)];
  if (pick.length < 6){
    const used = new Set(pick.map(x=>x.b.id));
    for (const x of scored){ if(pick.length>=6) break; if(!used.has(x.b.id)) pick.push(x); }
  }
  return pick.map(x => x.b);
}
