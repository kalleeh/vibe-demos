// contraption-lab/js/cloud.test.js
// Pure transforms only — the network/auth methods are verified in-browser (Task 9).
export async function cloudCases() {
  const C = await import("./cloud.js");
  return [
    { name:"leaderboardRows maps + flags me", fn:()=>{
        const rows = C.leaderboardRows(
          [ {best_parts:1,best_ms:100,expand:{user:{id:"A",name:"Ada"}}},
            {best_parts:2,best_ms:50, expand:{user:{id:"B",name:"Boo"}}} ], "B");
        if(rows.length!==2) throw new Error("len "+rows.length);
        if(rows[0].name!=="Ada"||rows[0].parts!==1) throw new Error("row0 "+JSON.stringify(rows[0]));
        if(!rows[1].isMe) throw new Error("me-flag missing");
      }},
    { name:"leaderboardRows falls back to Anon name", fn:()=>{
        const rows = C.leaderboardRows([{best_parts:1,best_ms:1,expand:{}}], null);
        if(rows[0].name!=="Anonymous") throw new Error("name "+rows[0].name);
      }},
    { name:"bestOf keeps lower parts then lower ms", fn:()=>{
        if(C.bestOf({best_parts:3,best_ms:100},{best_parts:2,best_ms:999}).best_parts!==2) throw new Error("parts");
        if(C.bestOf({best_parts:2,best_ms:100},{best_parts:2,best_ms:40}).best_ms!==40) throw new Error("ms");
      }},
  ];
}
