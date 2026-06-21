// Third-person chase camera — the Crazy Taxi / 2007-NFS "behind and above" rig.
//
// It chases a target {x, z, heading, speed} rather than parenting to the bike,
// so it lags and swings instead of rigidly tracking. The lag *is* the feel:
// the camera trails on hard turns and pulls back as speed climbs to sell motion.

import * as THREE from 'three';

const BACK = 9;     // base distance behind the bike (m)
const HEIGHT = 4.2; // base height above it (m)
const LOOK_AHEAD = 6; // aim point ahead of the bike
const SPEED_PULLBACK = 0.18; // extra distance per m/s of speed

export function createChaseCam(camera) {
  const camPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  let initialized = false;

  function update(dt, target) {
    // Forward must match the bike's: model world forward under rotation.y=heading.
    const fx = -Math.sin(target.heading);
    const fz = -Math.cos(target.heading);

    const back = BACK + Math.abs(target.speed) * SPEED_PULLBACK;
    // Desired camera position: behind (-forward) and above the bike.
    const desired = new THREE.Vector3(
      target.x - fx * back,
      HEIGHT,
      target.z - fz * back
    );
    // Aim a bit ahead of and above the bike so the road fills the frame.
    const desiredLook = new THREE.Vector3(
      target.x + fx * LOOK_AHEAD,
      1.2,
      target.z + fz * LOOK_AHEAD
    );

    if (!initialized) {
      camPos.copy(desired);
      lookAt.copy(desiredLook);
      initialized = true;
    } else {
      // Critically-damped-ish smoothing, frame-rate independent.
      const posK = 1 - Math.exp(-dt * 6);
      const lookK = 1 - Math.exp(-dt * 9);
      camPos.lerp(desired, posK);
      lookAt.lerp(desiredLook, lookK);
    }

    camera.position.copy(camPos);
    camera.lookAt(lookAt);
  }

  // Snap instantly (e.g. after a respawn or first frame) with no smoothing.
  function reset() {
    initialized = false;
  }

  return { update, reset };
}
