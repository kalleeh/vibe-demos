// WebAudio synthesized SFX for Contraption Lab. Pure params + lazy context,
// gracefully degrades to silent no-op if AudioContext is unavailable.

const MUTE_KEY = "cl.muted";

// Pure function returning synth parameters for each named sound effect.
// Returns null for unknown names. Testable without AudioContext (Node-safe).
export function sfxParams(name) {
  const params = {
    place: { type: "square", freq: 440, dur: 0.08 },
    run: { type: "triangle", freq: 220, dur: 0.12 },
    win: [
      { type: "sine", freq: 523, dur: 0.15 }, // C
      { type: "sine", freq: 659, dur: 0.15 }, // E
      { type: "sine", freq: 784, dur: 0.25 }, // G
    ],
    bounce: { type: "sine", freq: 330, dur: 0.05 },
    explode: { type: "noise", freq: 0, dur: 0.3 },
  };
  return params[name] || null;
}

// Mute state: persisted to localStorage, defaults to false (unmuted).
export function setMuted(muted) {
  try {
    const storage = globalThis.localStorage;
    if (storage) storage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {}
}

export function isMuted() {
  try {
    const storage = globalThis.localStorage;
    if (storage) return storage.getItem(MUTE_KEY) === "1";
  } catch {}
  return false;
}

// Lazy AudioContext — created only after first sfx() call (user gesture required).
let audioCtx = null;
let lastBounce = 0;

// Play a named sound effect. Silently no-ops if muted, unknown name, or no AudioContext.
// Throttles "bounce" internally to max one per 80ms.
export function sfx(name) {
  try {
    if (isMuted()) return;

    const params = sfxParams(name);
    if (!params) return;

    // Throttle bounce sounds
    if (name === "bounce") {
      const now = Date.now();
      if (now - lastBounce < 80) return;
      lastBounce = now;
    }

    // Lazy init AudioContext (after user gesture)
    if (!audioCtx) {
      if (typeof AudioContext === "undefined" && typeof webkitAudioContext === "undefined") {
        return; // Not available in this environment
      }
      try {
        audioCtx = new (AudioContext || webkitAudioContext)();
      } catch {
        return; // Failed to create context
      }
    }

    // Play the sound(s)
    const sounds = Array.isArray(params) ? params : [params];
    let offset = 0;

    for (const p of sounds) {
      playSynth(p, offset);
      offset += p.dur;
    }
  } catch {
    // Never throw from sfx()
  }
}

function playSynth(p, startOffset = 0) {
  try {
    const ctx = audioCtx;
    if (!ctx) return;

    const now = ctx.currentTime + startOffset;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    // Envelope: quick attack, exponential decay
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + p.dur);

    if (p.type === "noise") {
      // White noise burst (for explode)
      const bufSize = ctx.sampleRate * p.dur;
      const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.connect(gain);
      noise.start(now);
    } else {
      // Oscillator (sine/square/triangle)
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.setValueAtTime(p.freq, now);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + p.dur);
    }
  } catch {
    // Never throw from playSynth
  }
}
