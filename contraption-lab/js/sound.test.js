// sound.test.js — pure tests for sound params + mute state.
// Node-safe: uses a localStorage shim if needed, never touches AudioContext.

export async function soundCases() {
  // Shim localStorage if not present (Node environment)
  if (typeof globalThis.localStorage === "undefined") {
    const store = {};
    globalThis.localStorage = {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    };
  }

  const { sfxParams, setMuted, isMuted } = await import("./sound.js");

  return [
    {
      name: "isMuted defaults to false",
      fn: () => {
        // Clear any existing state
        try { globalThis.localStorage.removeItem("cl.muted"); } catch {}
        if (isMuted() !== false) throw new Error("expected false");
      }
    },
    {
      name: "setMuted(true) persists",
      fn: () => {
        setMuted(true);
        if (isMuted() !== true) throw new Error("expected true after setMuted(true)");
      }
    },
    {
      name: "setMuted(false) persists",
      fn: () => {
        setMuted(false);
        if (isMuted() !== false) throw new Error("expected false after setMuted(false)");
      }
    },
    {
      name: "sfxParams(win) returns truthy object/array",
      fn: () => {
        const p = sfxParams("win");
        if (!p) throw new Error("win params are null");
        // Should be an array of note descriptors
        if (!Array.isArray(p)) throw new Error("win params should be an array");
        if (p.length === 0) throw new Error("win params array is empty");
      }
    },
    {
      name: "sfxParams(nope) returns null",
      fn: () => {
        const p = sfxParams("nope");
        if (p !== null) throw new Error("expected null for unknown name");
      }
    },
    {
      name: "sfxParams(place) returns valid descriptor",
      fn: () => {
        const p = sfxParams("place");
        if (!p || typeof p.type !== "string" || typeof p.freq !== "number" || typeof p.dur !== "number") {
          throw new Error("place params invalid");
        }
      }
    },
    {
      name: "sfxParams(bounce) returns valid descriptor",
      fn: () => {
        const p = sfxParams("bounce");
        if (!p || typeof p.type !== "string" || typeof p.freq !== "number" || typeof p.dur !== "number") {
          throw new Error("bounce params invalid");
        }
      }
    },
    {
      name: "sfxParams(explode) returns valid descriptor",
      fn: () => {
        const p = sfxParams("explode");
        if (!p || typeof p.type !== "string" || typeof p.dur !== "number") {
          throw new Error("explode params invalid");
        }
      }
    },
  ];
}
