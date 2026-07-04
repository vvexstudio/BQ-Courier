// The block party bestiary — everything Brooklyn does when it stops driving
// and starts celebrating. Same 16-bit rules as props.js: flat saturated
// colors, chunky shapes, silhouettes that survive the pixel filter.
//
// Every factory returns { group, ...handles }; group sits at origin, feet on
// y=0, local -Z is forward. The game moves them — the handles are pure body
// language, driven per frame.

import * as THREE from 'three';

const flat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
const shadow = (g) => {
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
};

const SKIN = [0xe0a878, 0x8d5a3b, 0xf2d4b0, 0x6b4226];
const VIVID = [0xff4fa3, 0x2fd97a, 0x63c5f2, 0xffd23c, 0xb083f0, 0xff7a1f];
const pick = (list) => list[(Math.random() * list.length) | 0];

// Shared pedestrian chassis: legs + torso + head, props.js proportions.
function makeBody(torsoColor, skin = pick(SKIN)) {
  const group = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.72, 0.24), flat(0x23283a));
  legs.position.y = 0.36;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.3), flat(torsoColor));
  torso.position.y = 1.0;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), flat(skin));
  head.position.y = 1.55;
  group.add(head);
  return { group, legs, torso, head, skin };
}

// ---------------------------------------------------------------------------
// The fan: they just won everything and the arms know it.
// ---------------------------------------------------------------------------

export function makeFan() {
  const { group, skin } = makeBody(0xff7a1f); // championship orange
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.32), flat(0x2b56c9));
  yoke.position.y = 1.24; // blue across the shoulders — the home colorway
  group.add(yoke);

  // Both arms up. Forever. Shoulders pivot, arms extend +Y from the pivot.
  const shoulders = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.28, 1.24, 0);
    shoulder.rotation.z = -side * 0.5; // up and OUT — victory V
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.11), flat(skin));
    arm.position.y = 0.26;
    shoulder.add(arm);
    group.add(shoulder);
    shoulders.push({ pivot: shoulder, base: -side * 0.5 });
  }

  // Half the crowd brought a pennant. Rides in the right fist.
  if (Math.random() < 0.5) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), flat(0xd9d4c8));
    pole.position.y = 0.72;
    shoulders[1].pivot.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.3), flat(0x2b56c9));
    flag.position.set(0, 0.94, -0.16); // close enough to a triangle at 1/3 res
    shoulders[1].pivot.add(flag);
  }

  // The jump. The pump. The little twist. Championship physics.
  function celebrate(t, phase = 0) {
    group.position.y = Math.abs(Math.sin(t * 4 + phase)) * 0.35;
    for (const s of shoulders) {
      s.pivot.rotation.z = s.base + Math.sin(t * 8 + phase) * 0.3;
    }
    group.rotation.y = Math.sin(t * 2.3 + phase) * 0.15;
  }
  return { group: shadow(group), celebrate };
}

// ---------------------------------------------------------------------------
// The couch fire: tradition demands it.
// ---------------------------------------------------------------------------

export function makeCouchFire() {
  const group = new THREE.Group();
  const maroon = flat(0x7a4040); // twelve years on a stoop before tonight
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 0.85), maroon);
  seat.position.y = 0.45;
  group.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 0.25), maroon);
  back.position.set(0, 0.95, 0.35); // backrest behind (+Z of the -Z forward)
  group.add(back);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.65, 0.85), maroon);
    arm.position.set(sx * 1.09, 0.55, 0);
    group.add(arm);
  }
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.47, 0.87), flat(0x5c3030));
  seam.position.y = 0.45; // where the cushions never quite met
  group.add(seam);
  shadow(group);

  // Fire doesn't take shadows and doesn't share materials — each flame
  // flickers on its own clock.
  const fireOrange = new THREE.MeshBasicMaterial({ color: 0xff8c1f, transparent: true, opacity: 0.95 });
  const fireYellow = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.95 });
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const mat = (i % 2 ? fireYellow : fireOrange).clone();
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.22 + Math.random() * 0.12, 0.55, 0.22), mat);
    const bx = -0.7 + i * 0.35 + (Math.random() - 0.5) * 0.1;
    f.position.set(bx, 0.95, (Math.random() - 0.5) * 0.4);
    group.add(f);
    flames.push({
      mesh: f, bx,
      f1: 6 + Math.random() * 4, f2: 11 + Math.random() * 5,
      phase: Math.random() * Math.PI * 2,
    });
  }

  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a30, transparent: true, opacity: 0.6 });
  const smoke = [];
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), smokeMat.clone());
    const p = i * 0.5; // stagger the loop
    s.position.set((i - 0.5) * 0.6, 1.3 + p * 1.5, 0);
    group.add(s);
    smoke.push({ mesh: s, p, bx: (i - 0.5) * 0.6 });
  }

  function tick(dt, t) {
    for (const fl of flames) {
      // Two mixed sines land the flicker between ~0.6 and ~1.4.
      fl.mesh.scale.y = 1 + Math.sin(t * fl.f1 + fl.phase) * 0.25 + Math.sin(t * fl.f2 + fl.phase * 2) * 0.15;
      fl.mesh.position.x = fl.bx + Math.sin(t * 13 + fl.phase) * 0.03;
    }
    for (const s of smoke) {
      s.p = (s.p + dt * 0.35) % 1; // rise ~1.5m then quietly loop back
      s.mesh.position.y = 1.3 + s.p * 1.5;
      s.mesh.position.x = s.bx + Math.sin(t * 2 + s.p * 6) * 0.12;
      s.mesh.material.opacity = 0.6 * (1 - s.p);
    }
  }
  return { group, tick };
}

// ---------------------------------------------------------------------------
// The marcher: loudest colors on the block, flag held higher than the traffic.
// ---------------------------------------------------------------------------

export function makeMarcher() {
  const { group, legs, skin } = makeBody(pick(VIVID));

  // Off arm swings free at the side.
  const offArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.45, 0.11), flat(skin));
  offArm.position.set(-0.32, 1.02, 0);
  group.add(offArm);

  // Flag arm: raised, with the whole flag rig parented to the fist so the
  // wave handle moves pole and stripes together.
  const flagArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.45, 0.11), flat(skin));
  flagArm.position.set(0.32, 1.35, 0);
  flagArm.rotation.z = -0.25;
  group.add(flagArm);

  const flag = new THREE.Group();
  flag.position.set(0.42, 1.55, 0); // the fist, roughly
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), flat(0xd9d4c8));
  pole.position.y = 0.55; // cylinder axis is already Y — pole points up
  flag.add(pole);
  // Six stripes, canon order, hanging off the pole top toward -Z.
  const RAINBOW = [0xe40303, 0xff8c00, 0xffed00, 0x008026, 0x24408e, 0x732982];
  RAINBOW.forEach((c, i) => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.075, 0.5), flat(c));
    stripe.position.set(0, 1.06 - i * 0.075, -0.27);
    flag.add(stripe);
  });
  group.add(flag);

  // Parade step: springier than a commute, flag doing most of the talking.
  function march(t, phase = 0) {
    group.position.y = Math.abs(Math.sin(t * 5 + phase)) * 0.08;
    legs.rotation.x = Math.sin(t * 5 + phase) * 0.35;
    flag.rotation.z = Math.sin(t * 3 + phase) * 0.18;
    flag.rotation.y = Math.sin(t * 1.7 + phase) * 0.1;
  }
  return { group: shadow(group), march };
}

// ---------------------------------------------------------------------------
// The float: a flatbed, an arch, bunting, and two people paid in joy.
// ---------------------------------------------------------------------------

export function makeFloat() {
  const group = new THREE.Group();

  // Wheels stay on the ground; everything festive rides the deck and bobs.
  const wheelGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 8);
  wheelGeom.rotateZ(Math.PI / 2); // cylinder axis is Y — roll it onto X
  const wheelMat = flat(0x14161f);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeom, wheelMat);
      w.position.set(sx * 1.1, 0.3, sz * 1.7);
      group.add(w);
    }
  }

  const deck = new THREE.Group();
  group.add(deck);
  const bedColor = pick([0xb083f0, 0x2fd97a]);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 5), flat(bedColor));
  bed.position.y = 0.5;
  deck.add(bed);

  // The arch: three boxes, one squared rainbow-less rainbow. Pivots at deck
  // level so the sway reads as flex, not levitation.
  const arch = new THREE.Group();
  arch.position.y = 0.75;
  const archColor = pick(VIVID.filter((c) => c !== bedColor));
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 0.2), flat(archColor));
    post.position.set(sx * 1.1, 0.9, 0);
    arch.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 0.2), flat(archColor));
  lintel.position.y = 1.9;
  arch.add(lintel);
  deck.add(arch);

  // Bunting: alternating color blocks down both long edges.
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.18, 0.16),
        flat(VIVID[(i + (sx > 0 ? 0 : 3)) % VIVID.length])
      );
      b.position.set(sx * 1.28, 0.85, -1.8 + i * 1.2);
      deck.add(b);
    }
  }

  // Two riders, waving on the clock. Simple torso + head — the crowd fills
  // in the rest.
  const arms = [];
  for (const [i, rz] of [-1, 1].entries()) {
    const rider = new THREE.Group();
    rider.position.set((i ? -1 : 1) * 0.6, 0.75, rz * 1.1);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.9, 0.3), flat(pick(VIVID)));
    torso.position.y = 0.65;
    rider.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), flat(pick(SKIN)));
    head.position.y = 1.25;
    rider.add(head);
    const shoulder = new THREE.Group();
    shoulder.position.set(0.28, 0.95, 0);
    shoulder.rotation.z = -0.5; // raised, mid-wave
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), flat(pick(SKIN)));
    arm.position.y = 0.24;
    shoulder.add(arm);
    rider.add(shoulder);
    deck.add(rider);
    arms.push({ pivot: shoulder, phase: i * 1.7 });
  }

  function tick(dt, t) {
    deck.position.y = Math.sin(t * 1.3) * 0.04;
    arch.rotation.z = Math.sin(t * 0.9) * 0.03;
    for (const a of arms) {
      a.pivot.rotation.z = -0.5 + Math.sin(t * 4 + a.phase) * 0.35;
    }
  }
  return { group: shadow(group), tick };
}

// ---------------------------------------------------------------------------
// The drunk: gravity is a rumor they heard about earlier tonight.
// ---------------------------------------------------------------------------

export function makeDrunk() {
  const { group, head, skin } = makeBody(pick([0x6b5a4a, 0x4a5a6b]));

  // The untucked layer: a second torso box, offset and askew.
  const untucked = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.34), flat(0x3a3a40));
  untucked.position.set(0.04, 0.74, 0.02);
  untucked.rotation.y = 0.12;
  group.add(untucked);

  head.position.x = 0.05;
  head.rotation.z = 0.15; // the lean starts at the top

  // Bottle arm: hangs low and forward, still doing its one job.
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), flat(skin));
  arm.position.set(0.3, 0.95, -0.08);
  arm.rotation.x = -0.3;
  group.add(arm);
  const bottle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.07), flat(0x1e4028));
  bottle.position.set(0.3, 0.72, -0.18);
  group.add(bottle);

  // The walk belongs to the game. This is just what the body does about it:
  // two off-beat sways, a slow uneven bob, and the periodic sixth-power
  // "whoa—okay—I'm good" lurch.
  function stumble(t, phase = 0) {
    const lurch = Math.pow(Math.max(0, Math.sin(t * 0.7 + phase)), 6);
    group.rotation.z =
      Math.sin(t * 1.7 + phase) * 0.16 +
      Math.sin(t * 2.9 + phase * 2) * 0.09 +
      lurch * 0.22;
    group.rotation.x = Math.sin(t * 2.3 + phase * 1.3) * 0.06;
    group.position.y =
      Math.abs(Math.sin(t * 1.6 + phase)) * 0.03 +
      Math.abs(Math.sin(t * 2.7 + phase * 1.5)) * 0.02;
  }
  return { group: shadow(group), stumble };
}
