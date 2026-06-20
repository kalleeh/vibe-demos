// contraption-lab/js/sprites.test.js
export async function spriteCases() {
  const S = await import("./sprites.js");
  const R = await import("./render.js");
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
    { name:"fan has spin", fn:()=>{ const r=S.resolveSprite("fan","blueprint"); if(!r||!r.spin||r.spin!==6) throw new Error("fan should have spin=6, got "+r.spin); } },
    { name:"pinwheel has spin", fn:()=>{ const r=S.resolveSprite("pinwheel","blueprint"); if(!r||!r.spin||r.spin!==4) throw new Error("pinwheel should have spin=4, got "+r.spin); } },
    { name:"spinAngle returns base when not running", fn:()=>{ const a=R.spinAngle(1,5,2000,false,false); if(a!==1) throw new Error("should return base when not running, got "+a); } },
    { name:"spinAngle returns base when reduced-motion", fn:()=>{ const a=R.spinAngle(1,5,2000,true,true); if(a!==1) throw new Error("should return base when reduced-motion, got "+a); } },
    { name:"spinAngle returns base when spin=0", fn:()=>{ const a=R.spinAngle(1,0,2000,true,false); if(a!==1) throw new Error("should return base when spin=0, got "+a); } },
    { name:"spinAngle adds spin*time when running", fn:()=>{ const a=R.spinAngle(1,5,2000,true,false); const exp=1+5*2; if(Math.abs(a-exp)>0.001) throw new Error("should be base+spin*now/1000="+exp+", got "+a); } },
  ];
}
