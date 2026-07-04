// Touch controls — the one-thumb portrait rig. No buttons: the lower part of
// the screen is a single gesture surface, split into horizontal bands, and
// everything dispatches the same synthetic KeyboardEvents the desktop keys
// produce — the bike controller can't tell a thumb from a keyboard.
//
//   ┌───────────────────────────┐
//   │        (the game)         │
//   ├───────────────────────────┤
//   │   FIRE — tap = bagel      │   top band of the surface
//   │  ◀  STEER (hold, slide) ▶ │   the thumb lives here
//   │   JUMP — tap = hop        │   bottom strip
//   └───────────────────────────┘
//
// Flick UP from anywhere on the surface = a boost burst (E held ~1.5s).
// Throttle is automatic from the first touch; there is no brake — the
// controller's wall-unstick handles the one case brake existed for.
//
// Only mounts on touch-capable devices; `?touch` forces it for debugging.

const BOOST_BURST_MS = 1500;
const FLICK_DY = -45;      // px upward within…
const FLICK_MS = 280;      // …this window = a flick
const STEER_DEADBAND = 0.06; // fraction of width around center = ride straight

export function createTouchControls() {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 ||
    new URLSearchParams(location.search).has('touch');
  if (!isTouch) return { enabled: false };
  document.body.classList.add('touch');

  const key = (code, down) => window.dispatchEvent(
    new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true })
  );
  const tap = (code) => { key(code, true); key(code, false); };

  // First touch anywhere puts the hammer down (and is the audio unlock).
  let rolling = false;
  function ensureRolling() {
    if (rolling) return;
    rolling = true;
    key('KeyW', true);
  }

  const surface = document.getElementById('touch');

  // One thumb: track a single active pointer, ignore extras.
  let pid = null;
  let startX = 0, startY = 0, startT = 0;
  let steer = 0; // -1 (A), 0, +1 (D)
  let boostTimer = null;

  function setSteer(dir) {
    if (dir === steer) return;
    if (steer === -1) key('KeyA', false);
    if (steer === 1) key('KeyD', false);
    if (dir === -1) key('KeyA', true);
    if (dir === 1) key('KeyD', true);
    steer = dir;
  }

  // Which band is a touch in? Fractions of the surface height, top-down.
  function band(y) {
    const r = surface.getBoundingClientRect();
    const f = (y - r.top) / r.height;
    if (f < 0.24) return 'fire';
    if (f > 0.8) return 'jump';
    return 'steer';
  }

  function steerFromX(x) {
    const half = window.innerWidth / 2;
    const off = (x - half) / window.innerWidth;
    return off < -STEER_DEADBAND ? -1 : off > STEER_DEADBAND ? 1 : 0;
  }

  surface.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (pid !== null) return;
    pid = e.pointerId;
    // Capture so the release reaches us even if the thumb slides off the
    // surface first — a stuck pid means stuck steering and dead controls.
    try { surface.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    startX = e.clientX; startY = e.clientY; startT = performance.now();
    ensureRolling();
    const b = band(e.clientY);
    if (b === 'fire') tap('KeyQ');       // time-critical: fire on the press
    else if (b === 'jump') tap('ShiftLeft');
    else setSteer(steerFromX(e.clientX)); // hold to steer, slide to adjust
  });

  surface.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    e.preventDefault();
    // The thumb slides: steering follows its x wherever it started.
    if (band(startY) === 'steer') setSteer(steerFromX(e.clientX));
    // Flick up = boost burst, from any band.
    const dy = e.clientY - startY;
    if (dy < FLICK_DY && performance.now() - startT < FLICK_MS &&
        Math.abs(dy) > Math.abs(e.clientX - startX) * 1.2) {
      startY = e.clientY; // one boost per flick, not per pixel
      key('KeyE', true);
      clearTimeout(boostTimer);
      boostTimer = setTimeout(() => key('KeyE', false), BOOST_BURST_MS);
    }
  });

  function release(e) {
    if (e.pointerId !== pid) return;
    e.preventDefault();
    pid = null;
    setSteer(0);
  }
  // Window-level too: belt and suspenders against a release we never see.
  surface.addEventListener('pointerup', release);
  surface.addEventListener('pointercancel', release);
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', () => { pid = null; setSteer(0); });

  // No page gestures: this is a game surface, not a document.
  surface.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  return { enabled: true };
}
