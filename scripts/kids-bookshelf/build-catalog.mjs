// scripts/kids-bookshelf/build-catalog.mjs — OFFLINE build tool. Not shipped to the browser.
// Sources real titles, enriches tags/blurb via the Bedrock proxy (BUILD-TIME ONLY), emits catalog.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PROXY = "https://ai.pb.gurum.se";
const ORIGIN = "https://kalleeh.github.io";
const HERE = path.dirname(new URL(import.meta.url).pathname);

const THEME_VOCAB = ["공룡","우주","동물","공주","자동차","탈것","그림그리기","잠자리","자연","음식","가족","친구","감정","일상","환상","모험","숫자/글자","유머"];
const MOOD_VOCAB  = ["웃긴","따뜻한","모험","학습","잔잔한"];
const AGES = ["0-2","3-4","5-6","7-9"];
const LEVELS = ["보드북","그림책","책읽기","초기챕터북"];

const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

// The proxy rate-limits challenges at 20/min/IP and calls at 24/min/IP. Retry 429s
// (and transient 5xx) with jittered backoff so the run self-paces instead of burning
// out. Build-time only — this just throttles; the request bodies are unchanged.
async function fetchRetry(url, opts, tries=8){
  for(let i=0;;i++){
    let r;
    try { r = await fetch(url, opts); }
    catch(err){ if(i>=tries) throw err; await sleep(1500*(i+1)); continue; }
    if(r.status===429 || (r.status>=500 && r.status<600)){
      if(i>=tries) return r;
      await sleep(3000*(i+1) + Math.floor(Math.random()*1500));
      continue;
    }
    return r;
  }
}

async function solvePoW(){
  const r = await fetchRetry(PROXY + "/api/claude-challenge", { headers: { Origin: ORIGIN } });
  if(!r.ok) throw new Error("challenge " + r.status);
  const { nonce, exp, sig, difficulty } = await r.json();
  const lead = (buf)=>{ let n=0; for(const x of buf){ if(x===0){n+=8;continue;} let v=x,c=0; while((v&0x80)===0){c++;v<<=1;} n+=c; break; } return n; };
  for(let c=0;;c++){ const d=crypto.createHash("sha256").update(nonce+":"+c).digest();
    if(lead(d)>=difficulty) return { "X-PoW-Nonce":nonce,"X-PoW-Exp":exp,"X-PoW-Sig":sig,"X-PoW-Counter":String(c) }; }
}

const ENRICH_TOOL = {
  name: "tag_book",
  description: "어린이 그림책 한 권에 메타데이터 태그와 한국어 소개를 단다.",
  input_schema: {
    type: "object",
    properties: {
      real: { type: "boolean", description: "이 책이 실제로 존재하는 책이면 true. 확실하지 않으면 false." },
      confidence: { type: "number", description: "이 책이 실존한다고 확신하는 정도 0-1" },
      ages: { type: "array", items: { type: "string", enum: AGES } },
      level: { type: "string", enum: LEVELS },
      themes: { type: "array", items: { type: "string", enum: THEME_VOCAB }, description: "2-4개, 첫 번째가 핵심 테마" },
      mood: { type: "array", items: { type: "string", enum: MOOD_VOCAB }, description: "1-2개" },
      blurb: { type: "string", description: "왜 이 책일까요? 한국어 1-2문장" },
      readAloud: { type: "string", description: "함께 읽기 팁, 한국어 한 줄" },
      coverEmoji: { type: "string", description: "이 책을 대표하는 이모지 하나" },
      palette: { type: "array", items: { type: "string" }, description: "표지 색 2개, hex" },
      quality: { type: "number", description: "수상작/고전/스테디셀러일수록 1에 가깝게, 0-1" }
    },
    required: ["real","confidence","ages","level","themes","mood","blurb","readAloud","coverEmoji","palette","quality"]
  }
};

async function enrichOne(seed, lang){
  const sys = `너는 한국 어린이도서관의 그림책 큐레이터다. 주어진 실제 그림책 한 권에 대해 태그와 한국어 소개를 tag_book 도구로 단다.
규칙: 존재하지 않는 책이면 real=false로 표시하고 지어내지 마라. themes/mood는 주어진 어휘에서만 고른다. 환상은 mood가 아니라 theme다. blurb/readAloud는 영어책이라도 한국어로 쓴다. 0~9세 아이에게 맞는 책만 다룬다.`;
  const user = `책: 제목 "${seed.title}", 글 ${seed.author}${seed.publisher?`, 출판사 ${seed.publisher}`:""}, 언어 ${lang}. 이 책의 태그를 tag_book 도구로 달아줘.`;
  const pow = await solvePoW();
  const res = await fetchRetry(PROXY + "/api/claude", {
    method:"POST", headers:{ "Content-Type":"application/json", Origin:ORIGIN, ...pow },
    body: JSON.stringify({ model:"sonnet", max_tokens:1200, system:sys,
      messages:[{ role:"user", content:user }], tools:[ENRICH_TOOL], tool_choice:{ type:"tool", name:"tag_book" } })
  });
  if(!res.ok) throw new Error("proxy " + res.status);
  const j = await res.json();
  const tu = (j.content||[]).find(b=>b.type==="tool_use" && b.name==="tag_book");
  if(!tu||!tu.input) throw new Error("no tool_use");
  return tu.input;
}

function slug(lang, title){
  const base = title.toLowerCase().replace(/[^a-z0-9가-힣]+/g,"-").replace(/^-|-$/g,"").slice(0,32);
  const h = crypto.createHash("sha1").update(lang+":"+title).digest("hex").slice(0,4);
  return `${lang}-${base||"book"}-${h}`;
}

async function pool(items, limit, worker){
  let i=0; const out=new Array(items.length);
  const runners=Array.from({length:Math.min(limit,items.length)}, async ()=>{
    while(i<items.length){ const idx=i++; try{ out[idx]=await worker(items[idx],idx); }catch(e){ out[idx]={__error:e.message}; } }
  });
  await Promise.all(runners); return out;
}

async function main(){
  const en = JSON.parse(fs.readFileSync(path.join(HERE,"sources/en-canon.json"),"utf8")).map(s=>({...s,lang:"en"}));
  const ko = JSON.parse(fs.readFileSync(path.join(HERE,"sources/ko-canon.json"),"utf8")).map(s=>({...s,lang:"ko"}));
  const seeds = [...ko, ...en];
  const outPath = path.join(HERE,"enriched.json");
  const done = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath,"utf8")) : [];
  const doneTitles = new Set(done.map(d=>d.lang+"|"+d.title));
  const todo = seeds.filter(s=>!doneTitles.has(s.lang+"|"+s.title));
  console.log(`enriching ${todo.length} of ${seeds.length} (${done.length} already done)`);

  // Flush incrementally so an interrupt (Ctrl-C, network death, daily cap) keeps every
  // book enriched so far — the resume set above is keyed off whatever made it to disk.
  let fails=0, ok=0;
  const flush = ()=>fs.writeFileSync(outPath, JSON.stringify(done,null,1));
  await pool(todo, 2, async (seed)=>{
    let tags;
    try { tags = await enrichOne(seed, seed.lang); }
    catch(e){ fails++; console.warn("FAIL:", seed.lang+"|"+seed.title, "—", e.message); return; }
    done.push({
      id: slug(seed.lang, seed.title), lang: seed.lang, title: seed.title, author: seed.author,
      publisher: seed.publisher || "", isbn: seed.isbn || undefined,
      ages: tags.ages, level: tags.level, themes: tags.themes, mood: tags.mood,
      blurb: tags.blurb, readAloud: tags.readAloud,
      cover: { emoji: tags.coverEmoji, palette: tags.palette },
      quality: Math.max(0, Math.min(1, Number(tags.quality)||0.5)),
      real: tags.real, confidence: tags.confidence, source: "curated"
    });
    ok++;
    flush();
  });
  flush();
  console.log(`wrote ${done.length} enriched entries (${ok} ok, ${fails} failed this run) → ${outPath}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
