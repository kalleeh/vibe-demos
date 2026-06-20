// Matter is provided globally by vendor/matter.min.js
console.log("Contraption Lab boot — Matter", Matter && Matter.version);

if (new URLSearchParams(location.search).has("test")) {
  Promise.all([import("./level.test.js"), import("./parts.js")]).then(([t, p]) => {
    t.runTests([
      { name: "PALETTE_TYPES non-empty", fn: () => { if (!p.PALETTE_TYPES.length) throw new Error("empty"); } },
      { name: "makePart ball builds a body", fn: () => { const r = p.makePart("ball", {x:100,y:100}); if (!r.bodies.length) throw new Error("no body"); } },
      { name: "makePart unknown throws", fn: () => { try { p.makePart("nope", {x:0,y:0}); throw new Error("did not throw"); } catch(e){ if(!/unknown/.test(e.message)) throw e; } } },
      { name: "ball body tagged", fn: () => { const r = p.makePart("ball", {x:1,y:1,tag:"goal"}); if (r.bodies[0].plugin.tag!=="goal") throw new Error("no tag"); } },
    ]);
  });
}
