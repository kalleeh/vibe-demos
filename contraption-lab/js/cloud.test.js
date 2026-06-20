// contraption-lab/js/cloud.test.js
// Pure transforms only — the network/auth methods are verified in-browser (Task 9).
export async function cloudCases() {
  const C = await import("./cloud.js");
  return [
    { name:"leaderboardRows reads display_name + flags me by user id", fn:()=>{
        const rows = C.leaderboardRows(
          [ {best_parts:1,best_ms:100,user:"A",display_name:"Ada"},
            {best_parts:2,best_ms:50, user:"B",display_name:"Boo"} ], "B");
        if(rows.length!==2) throw new Error("len "+rows.length);
        if(rows[0].name!=="Ada"||rows[0].parts!==1) throw new Error("row0 "+JSON.stringify(rows[0]));
        if(rows[0].isMe) throw new Error("row0 should not be me");
        if(!rows[1].isMe) throw new Error("row1 me-flag missing");
      }},
    { name:"leaderboardRows falls back to Anon when display_name missing", fn:()=>{
        const rows = C.leaderboardRows([{best_parts:1,best_ms:1,user:"X"}], null);
        if(rows[0].name!=="Anonymous") throw new Error("name "+rows[0].name);
      }},
    { name:"bestOf keeps lower parts then lower ms", fn:()=>{
        if(C.bestOf({best_parts:3,best_ms:100},{best_parts:2,best_ms:999}).best_parts!==2) throw new Error("parts");
        if(C.bestOf({best_parts:2,best_ms:100},{best_parts:2,best_ms:40}).best_ms!==40) throw new Error("ms");
      }},
    { name:"bestOf is order-independent (worse arg never wins)", fn:()=>{
        // whichever side the worse record is on, the better (fewer parts) must win
        if(C.bestOf({best_parts:2,best_ms:50},{best_parts:5,best_ms:10}).best_parts!==2) throw new Error("worse as b overwrote");
        if(C.bestOf({best_parts:5,best_ms:10},{best_parts:2,best_ms:50}).best_parts!==2) throw new Error("worse as a won");
        // equal parts: lower ms wins regardless of order
        if(C.bestOf({best_parts:2,best_ms:40},{best_parts:2,best_ms:900}).best_ms!==40) throw new Error("ms order a");
        if(C.bestOf({best_parts:2,best_ms:900},{best_parts:2,best_ms:40}).best_ms!==40) throw new Error("ms order b");
      }},
    { name:"bestOf ORs solved flag", fn:()=>{
        if(C.bestOf({best_parts:9,best_ms:9,solved:false},{best_parts:1,best_ms:1,solved:true}).solved!==true) throw new Error("solved not ORed");
      }},
  ];
}

export async function cloudLevelCases() {
  const C = await import("./cloud.js");
  return [
    { name:"levelCard passes through id/title/plays/likes/data", fn:()=>{
        const rec = {id:"lvl_123", title:"Test Level", author_name:"Author", data:{foo:"bar"}};
        const card = C.levelCard(rec, 42, 7);
        if(card.id!=="lvl_123") throw new Error("id "+card.id);
        if(card.title!=="Test Level") throw new Error("title "+card.title);
        if(card.author_name!=="Author") throw new Error("author_name "+card.author_name);
        if(card.plays!==42) throw new Error("plays "+card.plays);
        if(card.likes!==7) throw new Error("likes "+card.likes);
        if(card.data.foo!=="bar") throw new Error("data "+JSON.stringify(card.data));
      }},
    { name:"levelCard missing author_name → Anonymous", fn:()=>{
        const card = C.levelCard({id:"x", title:"T", data:{}}, 0, 0);
        if(card.author_name!=="Anonymous") throw new Error("author_name "+card.author_name);
      }},
    { name:"levelCard missing title → Untitled", fn:()=>{
        const card = C.levelCard({id:"x", author_name:"A", data:{}}, 0, 0);
        if(card.title!=="Untitled") throw new Error("title "+card.title);
      }},
  ];
}
