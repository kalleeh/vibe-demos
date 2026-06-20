// contraption-lab/js/sprites.test.js
export async function spriteCases() {
  const S = await import("./sprites.js");
  const R = await import("./render.js");
  return [
    { name:"resolveSprite known part", fn:()=>{ const r=S.resolveSprite("ball","blueprint"); if(!r||r.fit!=="circle") throw new Error("ball should be circle fit, got "+JSON.stringify(r)); } },
    { name:"resolveSprite unknown → null", fn:()=>{ if(S.resolveSprite("nope","blueprint")!==null) throw new Error("unknown should be null"); } },
    { name:"resolveSprite defaults scale/overflow", fn:()=>{ const r=S.resolveSprite("ball","blueprint"); if(r.scale==null||r.overflow==null) throw new Error("missing defaults"); } },
    { name:"themeOverride precedence (temp inject on a non-override part)", fn:()=>{
        // use 'wall' (no shipped overrides) so we don't clobber real ones
        const r1=S.resolveSprite("wall","blueprint");
        const saved=S.SPRITES.wall.themeOverrides;
        S.SPRITES.wall.themeOverrides = { neon: "./assets/parts/neon/wall.png" };
        const r2=S.resolveSprite("wall","neon");
        S.SPRITES.wall.themeOverrides = saved;
        if(r2.src===r1.src) throw new Error("override not applied");
        if(!r2.src.includes("neon/")) throw new Error("wrong override src "+r2.src);
      }},
    { name:"shipped hero overrides (ball/fan/goal in neon+blueprint)", fn:()=>{
        for(const part of ["ball","fan","goal"]){
          const n=S.resolveSprite(part,"neon").src, b=S.resolveSprite(part,"blueprint").src, c=S.resolveSprite(part,"cartoon").src;
          if(!n.includes("neon/"+part)) throw new Error(part+" neon override missing: "+n);
          if(!b.includes("blueprint/"+part)) throw new Error(part+" blueprint override missing: "+b);
          if(c!=="./assets/parts/"+part+".png") throw new Error(part+" cartoon should fall back to shared: "+c);
        }
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
