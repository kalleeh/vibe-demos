// contraption-lab/js/editor.test.js
// Unit tests for the level editor + browse (pure functions only — no DOM, headless).

export async function editorCases() {
  const E = await import("./editor.js");
  const L = await import("./level.js");
  const B = await import("./browse.js");

  const level1 = E.emptyLevel();
  const level2 = E.emptyLevel();
  level2.inventory = [{type:"ramp",count:2}];
  const level3 = {
    schema:1,
    world:{w:1280,h:720,gravity:1},
    goal:{type:"dwell",object:"ball",zone:{x:1040,y:560,w:160,h:140},ms:500},
    fixed:[{type:"wall",x:100,y:100}],
    start:[{type:"ball",x:50,y:50,tag:"ball"}],
    inventory:[{type:"ramp",count:2}],
  };
  const level4 = {...level3, _solvedInTest:true};

  return [
    { name:"emptyLevel() returns valid schema", fn:()=>{
        const v = L.validateLevel(level1);
        if(!v.ok) throw new Error("emptyLevel invalid: "+v.reason);
      }},
    { name:"emptyLevel() has no inventory", fn:()=>{
        if(level1.inventory.length !== 0) throw new Error("expected empty inventory");
      }},
    { name:"canPublish false when inventory empty", fn:()=>{
        if(E.canPublish(level1, true)) throw new Error("should reject empty inventory");
      }},
    { name:"canPublish false when not solved", fn:()=>{
        if(E.canPublish(level2, false)) throw new Error("should reject unsolved");
      }},
    { name:"canPublish false when invalid level", fn:()=>{
        const bad = {...level2, schema:99};
        if(E.canPublish(bad, true)) throw new Error("should reject invalid level");
      }},
    { name:"canPublish true when valid+solved+inventory", fn:()=>{
        if(!E.canPublish(level3, true)) throw new Error("should accept valid level");
      }},
    { name:"built level round-trips via serializeLevel", fn:()=>{
        const s = L.serializeLevel(level3);
        const parsed = JSON.parse(s);
        const v = L.validateLevel(parsed);
        if(!v.ok) throw new Error("round-trip failed: "+v.reason);
      }},
    { name:"stripLevel removes _solvedInTest", fn:()=>{
        const stripped = E.stripLevel(level4);
        if("_solvedInTest" in stripped) throw new Error("_solvedInTest not removed");
        if(!stripped.inventory || stripped.inventory.length === 0) throw new Error("lost real fields");
      }},
    { name:"thumbnailFor doesn't throw on valid level", fn:()=>{
        // Smoke test: thumbnailFor should accept a valid level + stub canvas without throwing.
        // (Full rendering requires a real canvas + Matter runtime, tested in the browser ?test.)
        const canvas = { width:320, height:180, getContext:()=>null };
        try { B.thumbnailFor(level3, canvas); }
        catch (e) { throw new Error("thumbnailFor threw: "+e.message); }
      }},
    { name:"thumbnailFor doesn't throw on empty/invalid level", fn:()=>{
        const canvas = { width:320, height:180, getContext:()=>null };
        try { B.thumbnailFor({}, canvas); }
        catch (e) { throw new Error("thumbnailFor threw on bad level (should silently leave canvas blank): "+e.message); }
      }},
  ];
}
