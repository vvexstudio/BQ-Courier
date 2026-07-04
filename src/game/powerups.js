// Powerups — floating pickups seeded along each order's route. Ride through
// one and it applies instantly: pizza refills the boost meter, coffee is a
// legal stimulant (free overdrive), the bagel shield eats your next crash,
// and the bodega clock buys time on the order. This module only owns spawn +
// pickup detection; the actual effects land in main (they touch the bike,
// the delivery clock, and the HUD).

import * as THREE from 'three';
import { POWERUPS } from '../config.js';
import { makePowerup } from '../entities/apocalypse.js';
import { routeIndex } from './traffic.js';

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    }
  });
}

export function createPowerups({ scene, onEvent }) {
  const group = new THREE.Group();
  group.name = 'powerups';
  scene.add(group);

  let items = []; // { kind, prop, x, z, taken }
  let t = 0;

  function clear() {
    for (const it of items) {
      group.remove(it.prop.group);
      disposeGroup(it.prop.group);
    }
    items = [];
  }

  function seedRoute(route) {
    clear();
    if (!route || route.length < 2) return;
    const idx = routeIndex(route);
    if (idx.total < 120) return;
    for (let i = 0; i < POWERUPS.perRoute; i++) {
      // Spread through the middle of the ride — never at the door, never at
      // the drop.
      const d = idx.total * (0.25 + 0.55 * ((i + Math.random() * 0.8) / POWERUPS.perRoute));
      const pt = idx.pointAt(d);
      const kind = POWERUPS.kinds[(Math.random() * POWERUPS.kinds.length) | 0];
      const prop = makePowerup(kind);
      const ox = (Math.random() - 0.5) * 2;
      prop.group.position.set(pt.x + -pt.dz * ox, 0, pt.z + pt.dx * ox);
      group.add(prop.group);
      items.push({ kind, prop, x: prop.group.position.x, z: prop.group.position.z, taken: false });
    }
  }

  function update(dt, bike) {
    t += dt;
    for (const it of items) {
      if (it.taken) continue;
      it.prop.tick(dt, t);
      if (Math.hypot(bike.x - it.x, bike.z - it.z) < POWERUPS.radius) {
        it.taken = true;
        group.remove(it.prop.group);
        disposeGroup(it.prop.group);
        onEvent?.('powerup', { kind: it.kind });
      }
    }
  }

  return { seedRoute, update };
}
