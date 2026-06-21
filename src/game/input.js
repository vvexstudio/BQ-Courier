// Keyboard input -> a tiny intent object the bike controller reads each frame.
//
// We expose *intent* (throttle / steer / brake), not raw keys, so the physics
// code never has to know about WASD vs. arrows. Both schemes are wired, plus a
// couple of dev keys surfaced as one-shot flags the game loop can consume.

const DOWN = new Set();

// Keys we drive with — swallow their default so arrows/space don't scroll.
const HANDLED = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space',
]);

const once = new Set(); // one-shot key presses (e.g. toggles), drained per read

export function createInput(target = window) {
  target.addEventListener('keydown', (e) => {
    if (HANDLED.has(e.code)) e.preventDefault();
    if (!DOWN.has(e.code)) once.add(e.code); // first frame of this press
    DOWN.add(e.code);
  });
  target.addEventListener('keyup', (e) => DOWN.delete(e.code));
  // Don't leave a key "stuck down" if focus is lost mid-press.
  target.addEventListener('blur', () => DOWN.clear());

  const held = (a, b) => (DOWN.has(a) || DOWN.has(b) ? 1 : 0);

  return {
    // -1 (left) .. +1 (right)
    get steer() {
      return held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft');
    },
    // -1 (reverse/brake) .. +1 (forward)
    get throttle() {
      return held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown');
    },
    get brake() {
      return DOWN.has('Space');
    },
    // True exactly once per physical press of `code`. Used for view toggles etc.
    pressed(code) {
      if (once.has(code)) {
        once.delete(code);
        return true;
      }
      return false;
    },
  };
}
