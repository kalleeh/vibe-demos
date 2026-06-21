// fx.test.js — pure tests for the render-only juice helpers.
// Node-safe: imports only the pure functions + the Fx class (no canvas/DOM needed
// for the logic paths exercised here).

export async function fxCases() {
  const {
    easeOutQuad, easeOutCubic, easeOutBack, easeOutElastic,
    traumaToMagnitude, shakeNoise, squashStretch, impactIntensity,
    stepParticle, Fx,
  } = await import("./fx.js");

  const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

  return [
    {
      name: "easing endpoints: f(0)=0, f(1)=1",
      fn: () => {
        for (const f of [easeOutQuad, easeOutCubic, easeOutBack, easeOutElastic]) {
          if (!approx(f(0), 0)) throw new Error(`${f.name}(0) != 0 (${f(0)})`);
          if (!approx(f(1), 1, 1e-6)) throw new Error(`${f.name}(1) != 1 (${f(1)})`);
        }
      }
    },
    {
      name: "easeOutBack overshoots above 1 before settling",
      fn: () => {
        // outBack must exceed 1 somewhere in (0,1) — that's the "pop"
        let over = false;
        for (let t = 0.5; t < 1; t += 0.02) if (easeOutBack(t) > 1.0001) over = true;
        if (!over) throw new Error("easeOutBack never overshoots");
      }
    },
    {
      name: "traumaToMagnitude squares and clamps to [0,1]",
      fn: () => {
        if (!approx(traumaToMagnitude(0.5), 0.25)) throw new Error("0.5 → 0.25 expected");
        if (traumaToMagnitude(2) !== 1) throw new Error("clamp high → 1");
        if (traumaToMagnitude(-1) !== 0) throw new Error("clamp low → 0");
      }
    },
    {
      name: "shakeNoise stays in [-1,1] and varies over time",
      fn: () => {
        let min = 9, max = -9, distinct = new Set();
        for (let t = 0; t < 2000; t += 17) {
          const v = shakeNoise(3, t);
          if (v < min) min = v; if (v > max) max = v;
          distinct.add(v.toFixed(3));
        }
        if (min < -1.0001 || max > 1.0001) throw new Error(`out of range [${min},${max}]`);
        if (distinct.size < 20) throw new Error("noise not varying");
      }
    },
    {
      name: "squashStretch preserves area (sx*sy≈1) and stretches with speed",
      fn: () => {
        const a = squashStretch(0, 25);
        if (!approx(a.sx, 1) || !approx(a.sy, 1)) throw new Error("zero speed → identity");
        const b = squashStretch(25, 25, 0.2);
        if (!approx(b.sx * b.sy, 1, 1e-9)) throw new Error("area not preserved");
        if (!(b.sy > 1 && b.sx < 1)) throw new Error("fast should stretch tall, thin");
      }
    },
    {
      name: "impactIntensity: below threshold → 0, hard slam → 1",
      fn: () => {
        if (impactIntensity(3) !== 0) throw new Error("below 3.5 → 0");
        if (impactIntensity(100) !== 1) throw new Error("huge → clamp 1");
        const mid = impactIntensity(12.5);
        if (!(mid > 0 && mid < 1)) throw new Error("mid should be fractional");
      }
    },
    {
      name: "stepParticle moves, ages, and eventually dies",
      fn: () => {
        const p = { x: 0, y: 0, vx: 100, vy: 0, life: 50, maxLife: 50, size: 3, drag: 0, gravity: 900 };
        const alive1 = stepParticle(p, 16, 900);
        if (!alive1) throw new Error("should survive first step");
        if (!(p.x > 0)) throw new Error("vx should move x");
        if (!(p.vy > 0)) throw new Error("gravity should add downward vy");
        const alive2 = stepParticle(p, 50, 900);
        if (alive2) throw new Error("life exhausted → dead");
      }
    },
    {
      name: "Fx.addTrauma clamps and shakeOffset is zero at rest",
      fn: () => {
        const fx = new Fx();
        const rest = fx.shakeOffset();
        if (rest.x !== 0 || rest.y !== 0) throw new Error("no trauma → no shake");
        fx.addTrauma(5);
        if (fx.trauma !== 1) throw new Error("trauma should clamp to 1");
        const o = fx.shakeOffset(22);
        if (Math.abs(o.x) > 22.001 || Math.abs(o.y) > 22.001) throw new Error("shake exceeds max");
      }
    },
    {
      name: "Fx reduced-motion disables shake and shrinks bursts",
      fn: () => {
        const fx = new Fx({ reducedMotion: true });
        fx.addTrauma(1);
        if (fx.trauma !== 0) throw new Error("reduced motion → no trauma accrued");
        const o = fx.shakeOffset();
        if (o.x !== 0 || o.y !== 0) throw new Error("reduced motion → zero shake");
        fx.burst(0, 0, { count: 40 });
        if (fx.particles.length > 4) throw new Error("reduced motion → capped burst");
      }
    },
    {
      name: "Fx.update decays trauma and culls dead particles",
      fn: () => {
        const fx = new Fx();
        fx.addTrauma(1);
        fx.burst(100, 100, { count: 10, life: 30 });
        const n0 = fx.particles.length;
        if (n0 === 0) throw new Error("burst should add particles");
        fx.update(40); // > life, so all should die
        if (fx.particles.length !== 0) throw new Error("dead particles not culled");
        if (!(fx.trauma < 1)) throw new Error("trauma should decay");
      }
    },
    {
      name: "Fx.flash level fades from 1 to 0",
      fn: () => {
        const fx = new Fx();
        fx.flash(7, 100);
        if (!(fx.flashLevel(7) > 0.9)) throw new Error("fresh flash ≈ 1");
        fx.update(60);
        const mid = fx.flashLevel(7);
        if (!(mid > 0 && mid < 1)) throw new Error("flash should be mid-fade");
        fx.update(60);
        if (fx.flashLevel(7) !== 0) throw new Error("flash should expire");
      }
    },
    {
      name: "Fx particle cap is enforced",
      fn: () => {
        const fx = new Fx();
        for (let i = 0; i < 20; i++) fx.burst(0, 0, { count: 100 });
        if (fx.particles.length > 400) throw new Error("MAX_PARTICLES exceeded");
      }
    },
  ];
}
