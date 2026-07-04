// The escalation director — Phase 6's spine. Watches the delivery count and
// walks the run up a tier ladder: Brooklyn → something's off → the invasion →
// Armageddon. Each tier bump fires an event (the obstacle system re-arms its
// spawn tables off the new tier) and retargets the environment; every frame
// this lerps sky, fog, and lights toward the current tier's look, so the world
// slides into the hellscape instead of snapping.
//
// Escalation is monotonic. Blowing a streak does not un-end the world.

import * as THREE from 'three';
import { ESCALATION } from '../config.js';

export function createEscalation({ scene, lights, sky, onTier }) {
  let tier = 0;

  // Live color instances we mutate in place each frame.
  const cur = {
    sky: new THREE.Color(ESCALATION.env[0].sky),
    fog: scene.fog.color.clone(),
    fogNear: scene.fog.near,
    fogFar: scene.fog.far,
    sun: lights.sun.color.clone(),
    sunI: lights.sun.intensity,
    hemiI: lights.hemi.intensity,
  };
  const target = { sky: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color() };
  let env = ESCALATION.env[0];

  function retarget() {
    env = ESCALATION.env[Math.min(tier, ESCALATION.env.length - 1)];
    target.sky.setHex(env.sky);
    target.fog.setHex(env.fog);
    target.sun.setHex(env.sun);
  }
  retarget();

  function update(dt, delivered) {
    // Tier from deliveries — walk up every threshold we've passed.
    while (tier < ESCALATION.tierAt.length && delivered >= ESCALATION.tierAt[tier]) {
      tier++;
      retarget();
      onTier?.(tier, ESCALATION.tierNames[tier] ?? '');
    }

    // Ease the world toward the tier's look.
    const k = Math.min(1, dt * ESCALATION.envLerp);
    cur.sky.lerp(target.sky, k);
    cur.fog.lerp(target.fog, k);
    cur.sun.lerp(target.sun, k);
    cur.fogNear += (env.fogNear - cur.fogNear) * k;
    cur.fogFar += (env.fogFar - cur.fogFar) * k;
    cur.sunI += (env.sunI - cur.sunI) * k;
    cur.hemiI += (env.hemiI - cur.hemiI) * k;

    sky.set(cur.sky, cur.fog); // gradient redraw: zenith from sky, horizon from fog
    scene.fog.color.copy(cur.fog);
    scene.fog.near = cur.fogNear;
    scene.fog.far = cur.fogFar;
    lights.sun.color.copy(cur.sun);
    lights.sun.intensity = cur.sunI;
    lights.hemi.intensity = cur.hemiI;
  }

  return { update, get tier() { return tier; } };
}
