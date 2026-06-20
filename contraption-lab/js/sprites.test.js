// contraption-lab/js/sprites.test.js
export async function spriteCases() {
  const S = await import("./sprites.js");
  return [
    { name:"resolveSprite known part", fn:()=>{ const r=S.resolveSprite("ball","blueprint"); if(!r||r.fit!=="circle") throw new Error("ball should be circle fit, got "+JSON.stringify(r)); } },
    { name:"resolveSprite unknown → null", fn:()=>{ if(S.resolveSprite("nope","blueprint")!==null) throw new Error("unknown should be null"); } },
    { name:"resolveSprite defaults scale/overflow", fn:()=>{ const r=S.resolveSprite("ball","blueprint"); if(r.scale==null||r.overflow==null) throw new Error("missing defaults"); } },
    { name:"themeOverride precedence", fn:()=>{
        const r1=S.resolveSprite("ball","blueprint");
        // inject a temporary override to prove precedence logic without shipping per-theme art
        S.SPRITES.ball.themeOverrides = { neon: "./assets/parts/neon/ball.png" };
        const r2=S.resolveSprite("ball","neon");
        S.SPRITES.ball.themeOverrides = {};
        if(r2.src===r1.src) throw new Error("override not applied");
        if(!r2.src.includes("neon/")) throw new Error("wrong override src "+r2.src);
      }},
    { name:"plank parts use plank fit", fn:()=>{ for(const t of ["ramp","conveyor","seesaw"]){ const r=S.resolveSprite(t,"blueprint"); if(!r||r.fit!=="plank") throw new Error(t+" should be plank fit"); } } },
  ];
}
