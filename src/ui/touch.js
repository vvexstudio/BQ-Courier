// Touch controls — the portrait-phone rig. Zero changes to the input system:
// every control here dispatches the same synthetic KeyboardEvents the desktop
// keys produce, so the bike controller can't tell a thumb from a keyboard.
//
// Scheme (tuned for one-handed portrait play):
//   - Auto-throttle: W goes down on your first touch and stays down. Riding
//     is the default state; you steer and react.
//   - Bottom corners are hold-to-steer zones (left/right).
//   - A button column sits on the right edge: HOP and BELL/BAGEL are taps,
//     BOOST and BRAKE are holds. BRAKE swaps W for S while held, so a long
//     press brakes to a stop and then backs up — same semantics as keys.
//
// Only mounts on touch-capable devices; desktop never sees any of it.

export function createTouchControls() {
  // `?touch` forces the rig on any device — for styling and debugging the
  // controls with a mouse.
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 ||
    new URLSearchParams(location.search).has('touch');
  if (!isTouch) return { enabled: false };
  document.body.classList.add('touch');

  const key = (code, down) => window.dispatchEvent(
    new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true })
  );

  // First touch anywhere puts the hammer down (and doubles as the audio
  // unlock gesture, since the synthetic keydown fires inside it).
  let rolling = false;
  function ensureRolling() {
    if (rolling) return;
    rolling = true;
    key('KeyW', true);
  }

  const el = (id) => document.getElementById(id);

  // Hold semantics that survive fingers sliding off buttons mid-panic.
  function bindHold(elm, code, { onDown, onUp } = {}) {
    const down = (e) => {
      e.preventDefault();
      ensureRolling();
      if (onDown) onDown(); else key(code, true);
    };
    const up = (e) => {
      e.preventDefault();
      if (onUp) onUp(); else key(code, false);
    };
    elm.addEventListener('pointerdown', down);
    elm.addEventListener('pointerup', up);
    elm.addEventListener('pointercancel', up);
    elm.addEventListener('pointerleave', up);
  }

  function bindTap(elm, code) {
    elm.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      ensureRolling();
      key(code, true);
      key(code, false);
    });
  }

  bindHold(el('steer-left'), 'KeyA');
  bindHold(el('steer-right'), 'KeyD');
  bindTap(el('tb-hop'), 'ShiftLeft');
  bindHold(el('tb-boost'), 'KeyE');
  bindTap(el('tb-bell'), 'KeyB');
  bindTap(el('tb-bagel'), 'KeyQ');
  // Brake: trade the held W for S (brake → reverse), give W back on release.
  bindHold(el('tb-brake'), null, {
    onDown() { key('KeyW', false); key('KeyS', true); },
    onUp() { key('KeyS', false); if (rolling) key('KeyW', true); },
  });

  // No page gestures: this is a game surface, not a document.
  document.getElementById('touch').addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  return { enabled: true };
}
