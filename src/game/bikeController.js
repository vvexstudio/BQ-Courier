// Arcade bike physics. Holds the dynamic state (position, heading, speed) and
// drives the bike group + wheels each frame. Crazy-Taxi rules: throttle is a
// direct accelerator, steering authority scales with speed, and the chassis
// leans into turns for juice. No tire model, no momentum vectors — heading *is*
// travel direction, which is exactly why it feels arcade.
//
// Frame convention (geo.js): X=east, Z=south, Y=up; the bike model's local -Z is
// forward. heading is yaw about Y applied straight to the model as
// `group.rotation.y = heading`, so the model's world forward — and therefore the
// travel direction — is exactly (-sin h, -cos h). h=0 faces -Z (north). Keeping
// movement, camera, and the model all derived from this one formula is what stops
// the bike from "crabbing" (body pointing one way while sliding another).

import * as THREE from 'three';
import { BIKE, LANE_ASSIST } from '../config.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function createBikeController(bike, collider, spawn = {}, roadGraph = null) {
  const state = {
    x: spawn.x ?? 0,
    z: spawn.z ?? 0,
    heading: spawn.heading ?? 0,
    speed: 0, // signed: + forward, - reverse
    lean: 0,
  };
  let lastSteer = 0; // most recent steer input, for the cosmetic front-wheel yaw

  function forwardVec() {
    // Must match the model's world forward under group.rotation.y = heading.
    return { x: -Math.sin(state.heading), z: -Math.cos(state.heading) };
  }

  function update(dt, input) {
    const throttle = input.throttle; // -1..1
    const steer = input.steer;       // -1..1
    const braking = input.brake;
    lastSteer = steer;

    // --- Longitudinal: throttle, brake, reverse, coast drag ---
    if (braking) {
      // Hard brake toward zero from whichever direction we're moving.
      state.speed -= Math.sign(state.speed) * BIKE.brakeDecel * dt;
      if (Math.abs(state.speed) < BIKE.brakeDecel * dt) state.speed = 0;
    } else if (throttle > 0) {
      // Pressing forward while rolling backward brakes first, then accelerates.
      const a = state.speed < 0 ? BIKE.brakeDecel : BIKE.accel;
      state.speed = Math.min(state.speed + a * dt, BIKE.maxSpeed);
    } else if (throttle < 0) {
      const a = state.speed > 0 ? BIKE.brakeDecel : BIKE.accel;
      state.speed = Math.max(state.speed - a * dt, -BIKE.maxReverse);
    } else {
      // Coasting: roll to a stop.
      const drag = BIKE.rollDrag * dt;
      if (Math.abs(state.speed) <= drag) state.speed = 0;
      else state.speed -= Math.sign(state.speed) * drag;
    }

    // --- Steering: authority scales down with speed, dies near standstill ---
    const speedAbs = Math.abs(state.speed);
    const authority = speedAbs < 0.4
      ? speedAbs / 0.4 // ramp in from a stop so it can't pivot in place
      : 1 / (1 + speedAbs * BIKE.turnSpeedFalloff);
    // Reverse inverts steering, like backing up any vehicle.
    // With forward = (-sin h, -cos h), turning right (toward +X) means *lowering*
    // heading, so steer=+1 (D / right) gets a negative yaw rate.
    const dir = Math.sign(state.speed) || 1;
    let yawRate = -steer * BIKE.turnRate * authority * dir;

    // --- Lane assist: hands-off, the bike follows the street, not a ruler ---
    // Roads curve; without this, holding W ends at the nearest facade. When the
    // player isn't steering (and is rolling forward on/near a road), aim at a
    // point a few meters ahead *along the road* and yaw gently toward it.
    if (roadGraph && steer === 0 && state.speed > 1.5) {
      const near = roadGraph.nearestOnRoad(state.x, state.z);
      if (near && near.dist < LANE_ASSIST.maxDist) {
        const f = forwardVec();
        // Road direction, disambiguated to whichever way we're facing.
        const sign = (f.x * near.dx + f.z * near.dz) >= 0 ? 1 : -1;
        const rdx = near.dx * sign;
        const rdz = near.dz * sign;
        // Aim point: ahead along the road from our snapped position.
        const ahead = LANE_ASSIST.lookAhead + speedAbs * LANE_ASSIST.lookAheadSpeed;
        const aimX = near.x + rdx * ahead;
        const aimZ = near.z + rdz * ahead;
        // Desired heading toward the aim point (inverse of forward=(-sin,-cos)).
        const wantH = Math.atan2(-(aimX - state.x), -(aimZ - state.z));
        const err = wrapAngle(wantH - state.heading);
        // Big error means the player deliberately left the road — don't yank.
        if (Math.abs(err) < LANE_ASSIST.maxAngle) {
          const maxStep = LANE_ASSIST.rate * dt;
          yawRate += THREE.MathUtils.clamp(err, -maxStep, maxStep) / dt;
        }
      }
    }

    state.heading += yawRate * dt;

    // --- Integrate position with wall collision ---
    const f = forwardVec();
    const nx = state.x + f.x * state.speed * dt;
    const nz = state.z + f.z * state.speed * dt;
    const r = collider.resolve(state.x, state.z, nx, nz);
    state.x = r.x;
    state.z = r.z;
    if (r.hit) state.speed *= BIKE.hitSpeedKeep; // scrape: bleed momentum

    // --- Visual lean: bike tips into the turn, target ~ turn rate, smoothed ---
    // Lean tracks the sign of the yaw so the bike always tips toward the inside
    // of the turn (verified on screen).
    const targetLean = THREE.MathUtils.clamp(
      yawRate / BIKE.turnRate, -1, 1
    ) * BIKE.maxLean;
    state.lean += (targetLean - state.lean) * Math.min(1, dt * 8);

    applyToModel(dt);
    return state;
  }

  function applyToModel(dt) {
    bike.group.position.set(state.x, 0, state.z);
    bike.group.rotation.y = state.heading;
    // Lean rolls the chassis about its local forward (-Z) axis.
    bike.chassis.rotation.z = state.lean;

    // Wheel spin from ground speed; front wheel yaws with the steering input.
    const spin = (state.speed / bike.wheelRadius) * dt;
    bike.wheels.front.rotation.x += spin;
    bike.wheels.rear.rotation.x += spin;
    bike.steer.rotation.y = -lastSteer * 0.4;
  }

  return { state, update, forwardVec };
}
