// Courier bike + rider, built from primitives in the 16-bit spirit: flat
// saturated colors, chunky shapes, readable from the chase cam — i.e. from
// BEHIND. The player mostly sees the rider's back, so that's where the color
// goes: bright jersey, helmet, courier backpack, and legs that actually pedal.
//
// Handles the controller drives: wheels spin, the front wheel + bars steer,
// the chassis leans, and pedal(spin) cranks the legs from ground speed.
//
// Convention matches geo.js: the bike's local -Z is "forward". We model it that
// way so the controller can place it with a plain yaw rotation about Y.

import * as THREE from 'three';
import { PALETTE } from '../config.js';

const FRAME_COLOR = 0xff5d3b;   // courier-orange frame
const JERSEY_COLOR = 0xffd23c;  // banana-yellow jersey — the 2014-game look
const SLEEVE_COLOR = 0xe23d3d;  // red shoulders/sleeves
const SHORTS_COLOR = 0x23283a;  // black bib shorts
const SKIN_COLOR = 0xe0a878;
const HELMET_COLOR = 0xe23d3d;  // red lid with a white stripe
const STRIPE_COLOR = 0xf2f2f2;
const PACK_COLOR = 0x2ec4b6;    // teal delivery backpack — pops off the yellow
const SHOE_COLOR = 0xf2f2f2;
const WHEEL_COLOR = 0x14161f;
const RIM_COLOR = PALETTE.bikeLane;

const WHEEL_RADIUS = 0.36;
const WHEELBASE = 1.05; // front-to-rear hub distance (meters)

const flat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });

function wheel() {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(WHEEL_RADIUS, 0.07, 8, 20),
    new THREE.MeshStandardMaterial({ color: WHEEL_COLOR, roughness: 0.8 })
  );
  // Torus lies in its own XY plane; rotate so it stands up and rolls about X.
  tire.rotation.y = Math.PI / 2;
  g.add(tire);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS * 0.55, WHEEL_RADIUS * 0.55, 0.03, 12),
    new THREE.MeshStandardMaterial({
      color: RIM_COLOR, emissive: RIM_COLOR, emissiveIntensity: 0.3, roughness: 0.5,
    })
  );
  rim.rotation.z = Math.PI / 2; // align cylinder axis with X (the roll axis)
  g.add(rim);

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// One leg: hip pivot -> thigh -> knee pivot -> shin -> shoe. Rotating the hip
// (and counter-rotating the knee) around X gives a convincing pedal stroke.
function leg(side) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.11, WHEEL_RADIUS + 0.62, 0.30);

  const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.30, 0.14), flat(SHORTS_COLOR));
  thigh.position.y = -0.14;
  thigh.castShadow = true;
  hip.add(thigh);

  const knee = new THREE.Group();
  knee.position.y = -0.30;
  hip.add(knee);

  const shin = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.28, 0.11), flat(SKIN_COLOR));
  shin.position.y = -0.13;
  shin.castShadow = true;
  knee.add(shin);

  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.22), flat(SHOE_COLOR));
  shoe.position.set(0, -0.30, -0.04);
  shoe.castShadow = true;
  knee.add(shoe);

  return { hip, knee };
}

export function createBike() {
  const root = new THREE.Group();
  root.name = 'bike';

  // `chassis` holds everything that should lean; `root` only carries position +
  // yaw, so the lean roll never feeds back into the heading math.
  const chassis = new THREE.Group();
  chassis.name = 'chassis';
  root.add(chassis);

  const frameMat = flat(FRAME_COLOR);

  // Frame: a low slab between the hubs at hub height.
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, WHEELBASE * 0.9), frameMat);
  frame.position.y = WHEEL_RADIUS + 0.16;
  frame.castShadow = true;
  chassis.add(frame);

  // Seat post + saddle.
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.34), frameMat);
  seat.position.set(0, WHEEL_RADIUS + 0.52, WHEELBASE * 0.32);
  seat.castShadow = true;
  chassis.add(seat);

  // Rear wheel — fixed.
  const rear = wheel();
  rear.position.set(0, WHEEL_RADIUS, WHEELBASE / 2);
  chassis.add(rear);

  // Steering assembly: front wheel + a handlebar, both yawed together.
  const steer = new THREE.Group();
  steer.name = 'steer';
  steer.position.set(0, WHEEL_RADIUS, -WHEELBASE / 2);
  const front = wheel();
  steer.add(front);
  const bars = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), flat(0x111111));
  bars.position.y = 0.5;
  bars.castShadow = true;
  steer.add(bars);
  chassis.add(steer);

  // --- Rider, dressed for the chase cam ---
  const rider = new THREE.Group();

  // Torso: yellow jersey, hunched over the bars.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.26), flat(JERSEY_COLOR));
  torso.position.set(0, WHEEL_RADIUS + 0.86, 0.10);
  torso.rotation.x = -0.42;
  torso.castShadow = true;
  rider.add(torso);

  // Red shoulder yoke across the top of the jersey.
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.27), flat(SLEEVE_COLOR));
  yoke.position.set(0, WHEEL_RADIUS + 1.05, 0.02);
  yoke.rotation.x = -0.42;
  yoke.castShadow = true;
  rider.add(yoke);

  // Teal courier backpack — small enough that the yellow jersey still reads.
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.12), flat(PACK_COLOR));
  pack.position.set(0, WHEEL_RADIUS + 0.88, 0.28);
  pack.rotation.x = -0.42;
  pack.castShadow = true;
  rider.add(pack);

  // Hips on the saddle.
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.16, 0.24), flat(SHORTS_COLOR));
  hips.position.set(0, WHEEL_RADIUS + 0.60, 0.28);
  hips.castShadow = true;
  rider.add(hips);

  // Arms: skin, reaching forward-down to the bars.
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.46), flat(SKIN_COLOR));
    arm.position.set(side * 0.20, WHEEL_RADIUS + 0.94, -0.16);
    arm.rotation.x = 0.45;
    arm.castShadow = true;
    rider.add(arm);
  }

  // Head + helmet with a white stripe.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), flat(SKIN_COLOR));
  head.position.set(0, WHEEL_RADIUS + 1.16, -0.06);
  head.castShadow = true;
  rider.add(head);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    flat(HELMET_COLOR)
  );
  helmet.position.copy(head.position).y += 0.02;
  helmet.rotation.x = -0.3;
  helmet.castShadow = true;
  rider.add(helmet);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.26), flat(STRIPE_COLOR));
  stripe.position.set(0, WHEEL_RADIUS + 1.28, -0.07);
  stripe.rotation.x = -0.3;
  rider.add(stripe);

  // Legs that pedal.
  const legL = leg(-1);
  const legR = leg(1);
  rider.add(legL.hip, legR.hip);

  chassis.add(rider);

  // Crank the legs from wheel spin: hips swing opposite phase, knees flex to
  // keep the feet near the (imaginary) pedal circle.
  let crank = 0;
  function pedal(spinDelta) {
    crank += spinDelta * 0.55; // gear ratio: legs turn slower than the wheels
    const a = Math.sin(crank), b = Math.sin(crank + Math.PI);
    legL.hip.rotation.x = -0.55 + a * 0.45;
    legL.knee.rotation.x = 0.75 - a * 0.35;
    legR.hip.rotation.x = -0.55 + b * 0.45;
    legR.knee.rotation.x = 0.75 - b * 0.35;
  }
  pedal(0); // settle into the riding pose

  return {
    group: root,
    chassis,
    wheels: { front, rear },
    steer,
    pedal,
    wheelRadius: WHEEL_RADIUS,
  };
}
