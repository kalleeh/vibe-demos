// contraption-lab/js/part-icons.js
// Hand-shaded gradient-SVG art for every real part, ported from the Claude Design
// handoff ("Contraption Lab.dc.html"). Two consumers:
//   • the parts tray (DOM) — inline 40×40 ICONS[type]
//   • the canvas renderer  — rasterized SPRITE markup (square emblem or proportioned
//     bar) registered in sprites.js as an Image; render-only, never touches physics.
//
// DEFS holds the shared gradients; it is injected once into the page (tray) and
// inlined into each rasterized sprite (canvas) so the gradients resolve offscreen.

export const DEFS = `
<linearGradient id="clWoodL" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#e6b478"/><stop offset="1" stop-color="#a86d2c"/></linearGradient>
<linearGradient id="clWoodD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6630"/><stop offset="1" stop-color="#5e3c18"/></linearGradient>
<linearGradient id="clSteel" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#f6fafc"/><stop offset="0.5" stop-color="#c4d0dc"/><stop offset="1" stop-color="#8b9aab"/></linearGradient>
<linearGradient id="clSteelD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3ced9"/><stop offset="1" stop-color="#697686"/></linearGradient>
<radialGradient id="clRed" cx="0.38" cy="0.32" r="0.8"><stop offset="0" stop-color="#ff9072"/><stop offset="0.55" stop-color="#e8503a"/><stop offset="1" stop-color="#b8301f"/></radialGradient>
<linearGradient id="clRedF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef5b41"/><stop offset="1" stop-color="#b22a1b"/></linearGradient>
<radialGradient id="clBlue" cx="0.38" cy="0.3" r="0.85"><stop offset="0" stop-color="#9ad6ff"/><stop offset="0.6" stop-color="#3f8ed8"/><stop offset="1" stop-color="#225f9e"/></radialGradient>
<linearGradient id="clYellow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd964"/><stop offset="1" stop-color="#e3a31c"/></linearGradient>
<linearGradient id="clDark" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#414c5b"/><stop offset="1" stop-color="#1b222d"/></linearGradient>
<radialGradient id="clIron" cx="0.36" cy="0.3" r="0.85"><stop offset="0" stop-color="#9aa8b8"/><stop offset="0.6" stop-color="#4a5563"/><stop offset="1" stop-color="#262d38"/></radialGradient>
<radialGradient id="clBall" cx="0.35" cy="0.28" r="0.9"><stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#c2cedb"/><stop offset="1" stop-color="#5f7082"/></radialGradient>
<radialGradient id="clGlowM" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#f0a8ff"/><stop offset="0.6" stop-color="#a347d6"/><stop offset="1" stop-color="#5d1f8f"/></radialGradient>
<radialGradient id="clGlowO" cx="0.4" cy="0.3" r="0.85"><stop offset="0" stop-color="#ffd08a"/><stop offset="0.6" stop-color="#ff8a3a"/><stop offset="1" stop-color="#d4561a"/></radialGradient>
<linearGradient id="clCopper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8a866"/><stop offset="1" stop-color="#a4632b"/></linearGradient>
<radialGradient id="clGreen" cx="0.4" cy="0.3" r="0.85"><stop offset="0" stop-color="#aef0c4"/><stop offset="0.6" stop-color="#43c97a"/><stop offset="1" stop-color="#1d8a4e"/></radialGradient>
<linearGradient id="clIce" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#eaffff"/><stop offset="0.5" stop-color="#a9e6f7"/><stop offset="1" stop-color="#62b7d8"/></linearGradient>`;

// ---- 40×40 inner art for each real part type (drawn into viewBox 0 0 40 40) ----
// Ported verbatim from the handoff where a part maps; authored in the same style
// (same gradients, stroke weights, drop-shadow) for parts the mockup didn't cover.
const ART = {
  ramp: `<path d="M5 31 H35 L5 13 Z" fill="url(#clWoodL)" stroke="#3a2412" stroke-width="2.4" stroke-linejoin="round"/><path d="M5 31 H35 V34 H5 Z" fill="url(#clWoodD)" stroke="#3a2412" stroke-width="2.4" stroke-linejoin="round"/><path d="M10 27 H27 M10 23 L22 23" stroke="#6e4520" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>`,
  fan: `<circle cx="20" cy="20" r="14" fill="url(#clSteel)" stroke="#2a3340" stroke-width="2.4"/><g stroke="#2a3340" stroke-width="1.4"><path d="M20 20 C18 10 27 10 26 18 Z" fill="url(#clSteelD)"/><path d="M20 20 C30 22 27 30 21 26 Z" fill="url(#clSteelD)"/><path d="M20 20 C10 23 11 13 18 15 Z" fill="url(#clSteelD)"/></g><circle cx="20" cy="20" r="3.4" fill="url(#clRed)" stroke="#7a1d12" stroke-width="1.6"/>`,
  conveyor: `<rect x="4" y="14" width="32" height="13" rx="6.5" fill="url(#clDark)" stroke="#11161f" stroke-width="2.4"/><circle cx="12" cy="20.5" r="3" fill="url(#clSteel)" stroke="#11161f" stroke-width="1.5"/><circle cx="28" cy="20.5" r="3" fill="url(#clSteel)" stroke="#11161f" stroke-width="1.5"/><path d="M16 20.5 H24 M21.5 18 L24.5 20.5 L21.5 23" stroke="#ffd45a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  seesaw: `<path d="M14 31 H26 L20 21 Z" fill="url(#clSteelD)" stroke="#2a3340" stroke-width="2"/><g transform="rotate(-9 20 20)"><rect x="5" y="14" width="30" height="6" rx="3" fill="url(#clWoodL)" stroke="#3a2412" stroke-width="2.2"/></g>`,
  gear: `<g fill="url(#clSteelD)" stroke="#2a3340" stroke-width="1.6"><rect x="17.3" y="3" width="5.4" height="6" rx="1"/><rect x="17.3" y="31" width="5.4" height="6" rx="1"/><rect x="3" y="17.3" width="6" height="5.4" rx="1"/><rect x="31" y="17.3" width="6" height="5.4" rx="1"/><rect x="6.6" y="6.6" width="5.4" height="5.4" rx="1" transform="rotate(45 9.3 9.3)"/><rect x="28" y="6.6" width="5.4" height="5.4" rx="1" transform="rotate(45 30.7 9.3)"/><rect x="6.6" y="28" width="5.4" height="5.4" rx="1" transform="rotate(45 9.3 30.7)"/><rect x="28" y="28" width="5.4" height="5.4" rx="1" transform="rotate(45 30.7 30.7)"/></g><circle cx="20" cy="20" r="11" fill="url(#clSteel)" stroke="#2a3340" stroke-width="2.4"/><circle cx="20" cy="20" r="3.6" fill="#1c232e" stroke="#2a3340" stroke-width="1.4"/>`,
  balloon: `<path d="M20 7 C11 7 11 21 20 26 C29 21 29 7 20 7 Z" fill="url(#clRed)" stroke="#7a1d12" stroke-width="2.2"/><path d="M20 26 L18 30 H22 Z" fill="#b8301f" stroke="#7a1d12" stroke-width="1.6" stroke-linejoin="round"/><path d="M20 30 C23 33 17 35 20 38" fill="none" stroke="#3a2412" stroke-width="1.4"/><ellipse cx="16" cy="14" rx="2.4" ry="3.4" fill="#fff" opacity=".5"/>`,
  domino: `<rect x="9" y="7" width="9" height="27" rx="2" fill="#f4f0e6" stroke="#2a2218" stroke-width="2.2"/><g transform="rotate(7 26 21)"><rect x="22" y="9" width="9" height="27" rx="2" fill="#e8e1d2" stroke="#2a2218" stroke-width="2.2"/></g><circle cx="13.5" cy="14" r="1.3" fill="#2a2218"/><circle cx="13.5" cy="27" r="1.3" fill="#2a2218"/>`,
  magnet: `<path d="M11 9 V21 a9 9 0 0 0 18 0 V9" fill="none" stroke="#7a1d12" stroke-width="9.5"/><path d="M11 9 V21 a9 9 0 0 0 18 0 V9" fill="none" stroke="url(#clRedF)" stroke-width="6.5"/><rect x="6.3" y="7" width="9.4" height="6" fill="url(#clSteel)" stroke="#7a1d12" stroke-width="1.6"/><rect x="24.3" y="7" width="9.4" height="6" fill="url(#clSteel)" stroke="#7a1d12" stroke-width="1.6"/><path d="M13.6 11 V21" stroke="#ff9a86" stroke-width="1.6" opacity=".5"/>`,
  portal: `<ellipse cx="20" cy="20" rx="9" ry="14" fill="url(#clGlowM)" stroke="#5a1d8a" stroke-width="2.4"/><ellipse cx="20" cy="20" rx="4.4" ry="8" fill="#250b35" opacity=".85"/><ellipse cx="20" cy="20" rx="9" ry="14" fill="none" stroke="#edb8ff" stroke-width="1" opacity=".6"/>`,
  tnt: `<rect x="9" y="15" width="22" height="16" rx="2" fill="url(#clRedF)" stroke="#7a1d12" stroke-width="2.2"/><rect x="9" y="19" width="22" height="3.6" fill="#f4e4c0" opacity=".92"/><path d="M9 26 H31" stroke="#7a1d12" stroke-width="1"/><path d="M20 15 V10 C20 8 23 8 23 10" fill="none" stroke="#3a2412" stroke-width="1.8"/><circle cx="23.5" cy="9" r="1.8" fill="#ffb13a"/>`,
  spring: `<path d="M11 9 H29 M11 31 H29" stroke="#2a3340" stroke-width="2.4" stroke-linecap="round"/><path d="M14 9 C7 12 33 14 26 17 C19 20 7 22 14 25 C21 28 33 29 26 31" fill="none" stroke="#5b6878" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 9 C7 12 33 14 26 17 C19 20 7 22 14 25 C21 28 33 29 26 31" fill="none" stroke="url(#clSteelD)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  weight: `<path d="M13.5 13 A6.5 6.5 0 0 1 26.5 13" fill="none" stroke="#1c232e" stroke-width="3.6"/><circle cx="20" cy="24" r="11" fill="url(#clIron)" stroke="#11161f" stroke-width="2.4"/><ellipse cx="16" cy="20" rx="3.2" ry="2" fill="#aebcc9" opacity=".5"/>`,
  wedge: `<path d="M6 30 H34 L6 18 Z" fill="url(#clWoodL)" stroke="#3a2412" stroke-width="2.4" stroke-linejoin="round"/><path d="M6 30 H34 V33 H6 Z" fill="url(#clWoodD)" stroke="#3a2412" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 27 H27" stroke="#6e4520" stroke-width="1.4" opacity=".5"/>`,
  rope: `<g fill="none" stroke-linecap="round"><path d="M11 13 C31 9 31 18 12 18 C31 18 31 27 12 26 C28 25 28 32 15 31" stroke="#7a4a20" stroke-width="5.4"/><path d="M11 13 C31 9 31 18 12 18 C31 18 31 27 12 26 C28 25 28 32 15 31" stroke="url(#clCopper)" stroke-width="3.4"/></g>`,
  bumper: `<circle cx="20" cy="21" r="13" fill="url(#clYellow)" stroke="#8a5a10" stroke-width="2.2"/><circle cx="20" cy="21" r="8" fill="url(#clRed)" stroke="#7a1d12" stroke-width="2"/><ellipse cx="17" cy="17.5" rx="2.6" ry="1.8" fill="#fff" opacity=".55"/>`,
  trampoline: `<path d="M6 16 L9 30 M34 16 L31 30" stroke="#2a3340" stroke-width="2.4" stroke-linecap="round"/><g stroke="url(#clSteelD)" stroke-width="1.6"><path d="M10 17 V25 M20 18 V28 M30 17 V25"/></g><ellipse cx="20" cy="16" rx="15" ry="5" fill="url(#clBlue)" stroke="#1d4f86" stroke-width="2.2"/><ellipse cx="16" cy="14.5" rx="3.5" ry="1.4" fill="#fff" opacity=".4"/>`,
  pipe: `<path d="M13 7 V20 a7 7 0 0 0 7 7 H34" fill="none" stroke="#2a3340" stroke-width="11"/><path d="M13 7 V20 a7 7 0 0 0 7 7 H34" fill="none" stroke="url(#clSteel)" stroke-width="7"/><path d="M13 9 V20 a5 5 0 0 0 5 5 H32" fill="none" stroke="#fff" stroke-width="1.2" opacity=".4"/>`,
  bucket: `<path d="M11 16 A11 8 0 0 1 29 16" fill="none" stroke="#2a3340" stroke-width="1.8"/><path d="M10 14 H30 L27.5 32 H12.5 Z" fill="url(#clSteel)" stroke="#2a3340" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="20" cy="14" rx="10" ry="2.6" fill="url(#clSteelD)" stroke="#2a3340" stroke-width="2"/><path d="M13 18 L14.5 30" stroke="#fff" stroke-width="1.2" opacity=".4"/>`,
  ball: `<circle cx="20" cy="20" r="13" fill="url(#clBall)" stroke="#3a4452" stroke-width="2"/><ellipse cx="15" cy="14.5" rx="4.2" ry="2.8" fill="#fff" opacity=".75"/>`,
  // ---- authored in the design's style for the real parts the mockup omitted ----
  wall: `<rect x="5" y="13" width="30" height="14" rx="2" fill="url(#clSteelD)" stroke="#2a3340" stroke-width="2.2"/><g stroke="#2a3340" stroke-width="1.2" opacity=".5"><path d="M5 20 H35 M15 13 V20 M25 20 V27 M10 20 V27 M20 13 V20 M30 13 V20"/></g>`,
  crate: `<rect x="7" y="12" width="26" height="20" rx="2" fill="url(#clWoodL)" stroke="#3a2412" stroke-width="2.4"/><path d="M7 12 L33 32 M33 12 L7 32" stroke="#6e4520" stroke-width="2" opacity=".55"/><rect x="7" y="12" width="26" height="20" rx="2" fill="none" stroke="#3a2412" stroke-width="2.4"/>`,
  gears: `<g transform="translate(-3 1) scale(0.74)"><g fill="url(#clSteelD)" stroke="#2a3340" stroke-width="2"><rect x="17.3" y="3" width="5.4" height="6" rx="1"/><rect x="17.3" y="31" width="5.4" height="6" rx="1"/><rect x="3" y="17.3" width="6" height="5.4" rx="1"/><rect x="31" y="17.3" width="6" height="5.4" rx="1"/><rect x="6.6" y="6.6" width="5.4" height="5.4" rx="1" transform="rotate(45 9.3 9.3)"/><rect x="28" y="6.6" width="5.4" height="5.4" rx="1" transform="rotate(45 30.7 9.3)"/><rect x="6.6" y="28" width="5.4" height="5.4" rx="1" transform="rotate(45 9.3 30.7)"/><rect x="28" y="28" width="5.4" height="5.4" rx="1" transform="rotate(45 30.7 30.7)"/></g><circle cx="20" cy="20" r="11" fill="url(#clSteel)" stroke="#2a3340" stroke-width="2.4"/><circle cx="20" cy="20" r="3.4" fill="#1c232e"/></g><g transform="translate(20 16) scale(0.56)"><g fill="url(#clSteelD)" stroke="#2a3340" stroke-width="2"><rect x="17.3" y="3" width="5.4" height="6" rx="1"/><rect x="17.3" y="31" width="5.4" height="6" rx="1"/><rect x="3" y="17.3" width="6" height="5.4" rx="1"/><rect x="31" y="17.3" width="6" height="5.4" rx="1"/><rect x="6.6" y="6.6" width="5.4" height="5.4" rx="1" transform="rotate(45 9.3 9.3)"/><rect x="28" y="6.6" width="5.4" height="5.4" rx="1" transform="rotate(45 30.7 9.3)"/><rect x="6.6" y="28" width="5.4" height="5.4" rx="1" transform="rotate(45 9.3 30.7)"/><rect x="28" y="28" width="5.4" height="5.4" rx="1" transform="rotate(45 30.7 30.7)"/></g><circle cx="20" cy="20" r="11" fill="url(#clSteel)" stroke="#2a3340" stroke-width="2.4"/><circle cx="20" cy="20" r="3.4" fill="#1c232e"/></g>`,
  pinwheel: `<g transform="rotate(20 20 20)"><path d="M20 20 L20 5 C28 6 28 16 20 20 Z" fill="url(#clRed)" stroke="#7a1d12" stroke-width="1.6"/><path d="M20 20 L35 20 C34 28 24 28 20 20 Z" fill="url(#clBlue)" stroke="#1d4f86" stroke-width="1.6"/><path d="M20 20 L20 35 C12 34 12 24 20 20 Z" fill="url(#clYellow)" stroke="#8a5a10" stroke-width="1.6"/><path d="M20 20 L5 20 C6 12 16 12 20 20 Z" fill="url(#clGreen)" stroke="#1d8a4e" stroke-width="1.6"/></g><circle cx="20" cy="20" r="3" fill="url(#clSteel)" stroke="#2a3340" stroke-width="1.6"/>`,
  platform: `<rect x="4" y="16" width="32" height="9" rx="2.5" fill="url(#clSteelD)" stroke="#2a3340" stroke-width="2.2"/><path d="M9 20.5 H31" stroke="#fff" stroke-width="1" opacity=".3"/><rect x="9" y="25" width="4" height="9" fill="url(#clDark)" stroke="#11161f" stroke-width="1.6"/><rect x="27" y="25" width="4" height="9" fill="url(#clDark)" stroke="#11161f" stroke-width="1.6"/>`,
  bowlingpin: `<path d="M20 6 C16 6 16 11 17 14 C13 17 13 28 16 32 a4 4 0 0 0 8 0 C27 28 27 17 23 14 C24 11 24 6 20 6 Z" fill="#f4f0e6" stroke="#2a2218" stroke-width="2.2" stroke-linejoin="round"/><path d="M16 16 H24" stroke="#e8503a" stroke-width="2.4"/><ellipse cx="17" cy="11" rx="1.6" ry="2.4" fill="#fff" opacity=".6"/>`,
  ice: `<rect x="5" y="15" width="30" height="11" rx="2.5" fill="url(#clIce)" stroke="#5aa8c8" stroke-width="2.2"/><path d="M10 18 L14 23 M20 17 L24 24 M28 18 L31 23" stroke="#fff" stroke-width="1.4" opacity=".6" stroke-linecap="round"/><path d="M8 20.5 H32" stroke="#fff" stroke-width="1" opacity=".4"/>`,
  sticky: `<rect x="5" y="16" width="30" height="10" rx="3" fill="url(#clGlowO)" stroke="#a04a10" stroke-width="2.2"/><g fill="#a04a10"><circle cx="11" cy="27" r="1.6"/><circle cx="20" cy="28.5" r="1.8"/><circle cx="29" cy="27" r="1.6"/></g><path d="M9 19 H31" stroke="#fff" stroke-width="1.1" opacity=".45"/>`,
  accelerator: `<rect x="5" y="17" width="30" height="8" rx="2" fill="url(#clDark)" stroke="#11161f" stroke-width="2.2"/><g fill="none" stroke="#ffd45a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17.5 L16 21 L11 24.5"/><path d="M18 17.5 L23 21 L18 24.5"/><path d="M25 17.5 L30 21 L25 24.5"/></g>`,
  vortex: `<circle cx="20" cy="20" r="14" fill="url(#clGlowM)" stroke="#5a1d8a" stroke-width="2.2"/><g fill="none" stroke="#edb8ff" stroke-width="2.2" stroke-linecap="round"><path d="M20 20 C20 13 27 13 28 19 C29 26 13 27 12 18 C11 8 30 8 31 20"/></g><circle cx="20" cy="20" r="2.6" fill="#250b35"/>`,
  button: `<rect x="7" y="24" width="26" height="8" rx="2" fill="url(#clDark)" stroke="#11161f" stroke-width="2.2"/><rect x="12" y="16" width="16" height="10" rx="3" fill="url(#clRedF)" stroke="#7a1d12" stroke-width="2.2"/><ellipse cx="20" cy="19" rx="5" ry="1.8" fill="#fff" opacity=".4"/>`,
  gate: `<rect x="9" y="6" width="22" height="5" rx="1.5" fill="url(#clSteelD)" stroke="#2a3340" stroke-width="2"/><rect x="12" y="11" width="4" height="23" fill="url(#clSteel)" stroke="#2a3340" stroke-width="2"/><rect x="24" y="11" width="4" height="23" fill="url(#clSteel)" stroke="#2a3340" stroke-width="2"/><path d="M18 14 H22 M18 20 H22 M18 26 H22" stroke="#2a3340" stroke-width="1.6"/>`,
  goal: `<path d="M12 6 H28 V12 a8 8 0 0 1 -16 0 Z" fill="url(#clYellow)" stroke="#8a5a10" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 8 H7 a4 4 0 0 0 5 4 M28 8 H33 a4 4 0 0 1 -5 4" fill="none" stroke="#8a5a10" stroke-width="2.2"/><rect x="16" y="20" width="8" height="5" fill="url(#clYellow)" stroke="#8a5a10" stroke-width="2"/><rect x="12" y="25" width="16" height="4" rx="1" fill="url(#clYellow)" stroke="#8a5a10" stroke-width="2"/><path d="M18 12 V20 M22 12 V20" stroke="#8a5a10" stroke-width="1.6"/>`,
  // ---- Track D: saw, one-way gate, zipline, laser+mirror ----
  saw: `<g fill="url(#clSteel)" stroke="#2a3340" stroke-width="1.8"><path d="M20 4 L23 12 L20 10 L17 12 Z"/><path d="M20 36 L23 28 L20 30 L17 28 Z"/><path d="M4 20 L12 17 L10 20 L12 23 Z"/><path d="M36 20 L28 17 L30 20 L28 23 Z"/><path d="M9.3 9.3 L15 13 L11 15 L13 11 Z"/><path d="M30.7 9.3 L25 13 L29 15 L27 11 Z"/><path d="M9.3 30.7 L15 27 L11 25 L13 29 Z"/><path d="M30.7 30.7 L25 27 L29 25 L27 29 Z"/></g><circle cx="20" cy="20" r="10" fill="url(#clSteel)" stroke="#2a3340" stroke-width="2.4"/><circle cx="20" cy="20" r="3" fill="#1c232e"/>`,
  oneway: `<rect x="4" y="14" width="32" height="12" rx="2" fill="url(#clSteelD)" stroke="#2a3340" stroke-width="2.2"/><path d="M15 15 L23 20 L15 25 Z" fill="#ffd45a" stroke="#8a5a10" stroke-width="1.6" stroke-linejoin="round"/>`,
  zipline: `<path d="M6 8 L34 30" stroke="#5b6878" stroke-width="2.2" stroke-linecap="round"/><g transform="translate(24 24) rotate(24)"><rect x="-9" y="-6" width="18" height="12" rx="2" fill="url(#clWoodL)" stroke="#3a2412" stroke-width="2.2"/></g>`,
  laser: `<rect x="7" y="14" width="14" height="12" rx="2" fill="url(#clRedF)" stroke="#7a1d12" stroke-width="2.2"/><circle cx="19" cy="20" r="2.6" fill="#fff8e6"/><path d="M21 20 H33" stroke="url(#clGlowO)" stroke-width="2.6" stroke-linecap="round"/>`,
  mirror: `<rect x="6" y="15" width="28" height="10" rx="2" fill="url(#clIce)" stroke="#5aa8c8" stroke-width="2.2" transform="rotate(-8 20 20)"/><path d="M12 16 L16 21 M22 15 L26 20" stroke="#fff" stroke-width="1.4" opacity=".7" stroke-linecap="round" transform="rotate(-8 20 20)"/>`,
};

// Build a complete inline SVG string for the tray (40×40, own defs).
export function iconSVG(type) {
  const art = ART[type];
  if (!art) return null;
  return `<svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.5))"><defs>${DEFS}</defs>${art}</svg>`;
}

export const hasIcon = (type) => !!ART[type];

// Parts whose physics body is a SINGLE square-ish body, so the 40×40 emblem reads
// correctly on the canvas without distortion. Excluded on purpose:
//   • ball/fan/goal — keep their curated per-theme override art (showcase feature)
//   • gears — two separate disc bodies (an emblem would draw twice / doubled)
//   • elongated bodies (wall/gate/domino/pinwheel/trampoline/button/spring/
//     bowlingpin) and long "plank" parts (ramp/conveyor/seesaw/pipe/platform/ice/
//     sticky/accelerator) — keep their tiling PNG.
export const CANVAS_EMBLEM = new Set([
  "gear", "bumper", "vortex", "portal",
  "balloon", "crate", "weight", "tnt", "magnet", "wedge",
]);
export const canvasEmblem = (type) => CANVAS_EMBLEM.has(type) && !!ART[type];

// Data-URI SVG of the emblem for canvas rasterization (Image src). Same art as the
// tray, self-contained defs so gradients resolve in an isolated <img> document.
export function spriteDataURI(type) {
  const art = ART[type];
  if (!art) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="96" height="96"><defs>${DEFS}</defs>${art}</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
