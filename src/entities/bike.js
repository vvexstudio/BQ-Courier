// Placeholder courier bike + rider, built from primitives.
//
// This is intentionally cheap and readable — a stand-in until a real asset
// lands. The point of Phase 2 is *feel*, so what matters here is that the group
// has clean handles the controller can drive: wheels spin, the front wheel and
// handlebars steer, and the whole rig leans into turns.
//
// Convention matches geo.js: the bike's local -Z is "forward". We model it that
// way so the controller can place it with a plain yaw rotation about Y.

import * as THREE from 'three';
import { PALETTE } from '../config.js';

const FRAME_COLOR = 0xff5d3b;   // courier-orange — pops against the dusk blues
const RIDER_COLOR = 0x232838;   // dark hoodie
const SKIN_COLOR = 0xd9a679;
const WHEEL_COLOR = 0x14161f;
const RIM_COLOR = PALETTE.bikeLane; // tie the wheels to the loud bike-lane green

const WHEEL_RADIUS = 0.36;
const WHEELBASE = 1.05; // front-to-rear hub distance (meters)

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
      color: RIM_COLOR, emissive: RIM_COLOR, emissiveIntensity: 0.5, roughness: 0.5,
    })
  );
  rim.rotation.z = Math.PI / 2; // align cylinder axis with X (the roll axis)
  g.add(rim);

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createBike() {
  const root = new THREE.Group();
  root.name = 'bike';

  // `chassis` holds everything that should lean; `root` only carries position +
  // yaw, so the lean roll never feeds back into the heading math.
  const chassis = new THREE.Group();
  chassis.name = 'chassis';
  root.add(chassis);

  const frameMat = new THREE.MeshStandardMaterial({
    color: FRAME_COLOR, roughness: 0.5, metalness: 0.1,
  });

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
  const bars = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.05, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
  );
  bars.position.y = 0.5;
  bars.castShadow = true;
  steer.add(bars);
  chassis.add(steer);

  // Rider: blocky torso, head, and arms reaching for the bars. Crude on purpose.
  const rider = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.5, 0.28),
    new THREE.MeshStandardMaterial({ color: RIDER_COLOR, roughness: 0.9 })
  );
  torso.position.set(0, WHEEL_RADIUS + 0.78, 0.18);
  torso.rotation.x = -0.35; // hunched forward over the bars
  torso.castShadow = true;
  rider.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 10),
    new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.8 })
  );
  head.position.set(0, WHEEL_RADIUS + 1.12, 0.02);
  head.castShadow = true;
  rider.add(head);

  chassis.add(rider);

  return {
    group: root,
    chassis,
    wheels: { front, rear },
    steer,
    wheelRadius: WHEEL_RADIUS,
  };
}
