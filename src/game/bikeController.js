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
import { BIKE, LANE_ASSIST, HOP, BOOST, WIPEOUT, POWERUPS } from '../config.js';

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
    crashes: 0, // hard hits (HUD counter)
    y: 0,       // air height (bunny hop)
    vy: 0,
    wipeout: 0, // s left flat on the asphalt; >0 means down
    boost: 0,   // 0..100 meter, charged by lanes + drafting
    boosting: false,
    hopped: false, // frame flag for SFX, consumed by the game loop
    shield: false,    // bagel shield: absorbs the next crash
    shieldUsed: false, // frame flag — the loop toasts + plays the crunch
    overdrive: 0,      // s of coffee left: free top-speed multiplier
  };
  let lastSteer = 0; // most recent steer input, for the cosmetic front-wheel yaw
  let crashCooldown = 0; // one scrape-y corner shouldn't count as five crashes

  function forwardVec() {
    // Must match the model's world forward under group.rotation.y = heading.
    return { x: -Math.sin(state.heading), z: -Math.cos(state.heading) };
  }

  // Knock the rider down. The obstacle system calls this too, so it lives here
  // and owns the debounce: a crash mid-crash is the same crash.
  function crash() {
    if (state.wipeout > 0 || crashCooldown > 0) return false;
    if (state.shield) {
      // The bagel shield takes the hit. Returns false: no wipeout happened.
      state.shield = false;
      state.shieldUsed = true;
      state.speed *= 0.5;
      crashCooldown = 1.0; // brief mercy window so one pileup ≠ two hits
      return false;
    }
    state.wipeout = WIPEOUT.downTime;
    state.crashes++;
    state.speed *= WIPEOUT.bounceBack; // small reversed kickback, arcade-style
    state.boost = 0; // eating asphalt spills the meter
    state.boosting = false;
    crashCooldown = WIPEOUT.downTime + 0.6;
    return true;
  }

  function update(dt, input, env = {}) {
    state.hopped = false;

    // --- Down on the asphalt: no control, bleed everything, get back up ---
    if (state.wipeout > 0) {
      state.wipeout = Math.max(0, state.wipeout - dt);
      crashCooldown = Math.max(0, crashCooldown - dt);
      state.speed *= Math.max(0, 1 - dt * 6);
      state.y = Math.max(0, state.y - dt * 4); // if we crashed mid-hop, come down
      state.vy = 0;
      const f0 = forwardVec();
      const slid = collider.resolve(
        state.x, state.z,
        state.x + f0.x * state.speed * dt, state.z + f0.z * state.speed * dt
      );
      state.x = slid.x;
      state.z = slid.z;
      applyToModel(dt);
      return state;
    }

    const throttle = input.throttle; // -1..1
    const steer = input.steer;       // -1..1
    const braking = input.brake;
    lastSteer = steer;

    // --- Boost: charge from riding well, drain into a sprint on E ---
    const airborne = state.y > 0.01;
    if (Math.abs(state.speed) > BOOST.minChargeSpeed) {
      if (env.onLane) state.boost += BOOST.laneChargeRate * dt;
      if (env.draft) state.boost += BOOST.draftChargeRate * dt;
    }
    state.boost = THREE.MathUtils.clamp(state.boost, 0, 100);
    state.boosting = !!input.boost && state.boost > 0 && state.speed > 1;
    if (state.boosting) state.boost = Math.max(0, state.boost - BOOST.drainRate * dt);
    state.overdrive = Math.max(0, state.overdrive - dt); // coffee wears off
    const od = state.overdrive > 0 ? POWERUPS.coffeeMult : 1;
    const topSpeed = BIKE.maxSpeed * (state.boosting ? BOOST.speedMult : 1) * od;
    const accelNow = BIKE.accel * (state.boosting ? BOOST.accelMult : 1) * (od > 1 ? 1.3 : 1);

    // --- Bunny hop ---
    if (input.hop() && !airborne && Math.abs(state.speed) > HOP.minSpeed) {
      state.vy = HOP.impulse;
      state.hopped = true;
    }
    if (state.y > 0 || state.vy > 0) {
      state.vy -= HOP.gravity * dt;
      state.y = Math.max(0, state.y + state.vy * dt);
      if (state.y === 0) {
        // A hop lands at ~-4.5 m/s; anything much harder (a saucer dropping
        // you, a rooftop excursion) is a crash landing.
        if (state.vy < -7.5) crash();
        state.vy = 0;
      }
    }

    // --- Longitudinal: throttle, brake, reverse, coast drag ---
    if (braking) {
      // Hard brake toward zero from whichever direction we're moving.
      state.speed -= Math.sign(state.speed) * BIKE.brakeDecel * dt;
      if (Math.abs(state.speed) < BIKE.brakeDecel * dt) state.speed = 0;
    } else if (throttle > 0) {
      // Pressing forward while rolling backward brakes first, then accelerates.
      const a = state.speed < 0 ? BIKE.brakeDecel : accelNow;
      if (state.speed > topSpeed) {
        // Boost just ended: sag back to the cap instead of snapping to it.
        state.speed = Math.max(topSpeed, state.speed - BIKE.rollDrag * dt);
      } else {
        state.speed = Math.min(state.speed + a * dt, topSpeed);
      }
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
    let authority = speedAbs < 0.4
      ? speedAbs / 0.4 // ramp in from a stop so it can't pivot in place
      : 1 / (1 + speedAbs * BIKE.turnSpeedFalloff);
    if (airborne) authority *= HOP.airSteer; // wheels aren't touching anything
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
    crashCooldown = Math.max(0, crashCooldown - dt);
    if (r.hit) {
      // A fast hit is a full wipeout (debounced); slow contact is just a scrape.
      if (Math.abs(state.speed) > WIPEOUT.minSpeed) {
        crash();
      } else {
        state.speed *= BIKE.hitSpeedKeep; // bleed momentum on a scrape
      }
    }

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
    bike.group.position.set(state.x, state.y, state.z);
    bike.group.rotation.y = state.heading;

    if (state.wipeout > 0) {
      // Down: roll the chassis flat on its side and skid, nose slightly dug in.
      // The lerp gives one readable "going down" frame even at 60fps.
      bike.chassis.rotation.z += (1.35 - bike.chassis.rotation.z) * Math.min(1, dt * 14);
      bike.chassis.rotation.x += (-0.18 - bike.chassis.rotation.x) * Math.min(1, dt * 14);
      return;
    }
    bike.chassis.rotation.x *= Math.max(0, 1 - dt * 10); // recover from the tumble
    // Lean rolls the chassis about its local forward (-Z) axis.
    bike.chassis.rotation.z = state.lean;

    // Wheel spin from ground speed; front wheel yaws with the steering input.
    const spin = (state.speed / bike.wheelRadius) * dt;
    bike.wheels.front.rotation.x += spin;
    bike.wheels.rear.rotation.x += spin;
    bike.pedal?.(spin);
    bike.steer.rotation.y = -lastSteer * 0.4;
  }

  return { state, update, forwardVec, crash };
}
