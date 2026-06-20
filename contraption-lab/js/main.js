// Matter is provided globally by vendor/matter.min.js
console.log("Contraption Lab boot — Matter", Matter && Matter.version);

if (new URLSearchParams(location.search).has("test")) {
  import("./level.test.js").then(m => m.runTests());
}
