// The Brooklyn obstacle bestiary — every prop the traffic system can spawn,
// built from primitives in the same 16-bit spirit as the bike: flat saturated
// colors, chunky shapes, readable at 1/3 resolution through the pixel filter.
//
// Every factory returns { group, ...handles } with the prop's local -Z as
// "forward" (the bike convention), so traffic.js can place anything with a
// plain position + rotation.y. Animation state lives in the handles, driven
// by traffic.js per frame — props stay dumb meshes.

import * as THREE from 'three';
import { PALETTE } from '../config.js';

const flat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
const shadow = (g) => {
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
};

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

function carWheels(group, halfLen, y = 0.32) {
  const geom = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 8);
  geom.rotateZ(Math.PI / 2);
  const mat = flat(0x14161f);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(geom, mat);
      w.position.set(sx * 0.82, y, sz * halfLen * 0.62);
      group.add(w);
    }
  }
}

// A sedan, ~1.8 × 4.4 m. Nose faces -Z.
export function makeCar(color = 0x3a4a6b) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 4.4), flat(color));
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.2), flat(0x1c2230));
  cabin.position.set(0, 1.15, 0.25);
  group.add(cabin);
  carWheels(group, 2.2);
  return { group: shadow(group) };
}

// The signature gag: a car parked dead in the bike lane, hazards blinking,
// driver unbothered. `tick(t)` blinks the lights.
export function makeLaneBlocker() {
  const { group } = makeCar(PALETTE.carColors[Math.floor(Math.random() * PALETTE.carColors.length)]);
  const hazardMat = new THREE.MeshStandardMaterial({
    color: 0xffa021, emissive: 0xffa021, emissiveIntensity: 1,
  });
  const geom = new THREE.BoxGeometry(0.3, 0.14, 0.06);
  const lights = [];
  for (const sx of [-1, 1]) {
    for (const z of [-2.21, 2.21]) {
      const l = new THREE.Mesh(geom, hazardMat);
      l.position.set(sx * 0.55, 0.72, z);
      group.add(l);
      lights.push(l);
    }
  }
  function tick(t) {
    hazardMat.emissiveIntensity = (Math.floor(t * 1.6) % 2) ? 1.2 : 0.05;
  }
  return { group, tick };
}

// The dooring machine: parked car whose driver door swings into the lane when
// a bike approaches. Door hinges at its front edge; `setDoor(0..1)` opens it.
// `doorTip()` returns the door's outer edge in world space for the collider.
export function makeDoorCar() {
  const { group } = makeCar(0xd9d4c8); // pale car, dark door — the door must read
  const door = new THREE.Group();
  door.position.set(-0.9, 0.62, -0.4); // driver side (left of -Z forward), hinge
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 1.1), flat(0x7a3b3b));
  panel.position.z = 0.55; // extends rearward from the hinge
  panel.castShadow = true;
  door.add(panel);
  group.add(door);

  const tipLocal = new THREE.Vector3();
  function setDoor(open) {
    // 0 = flush with the body, 1 = swung ~70° into the lane.
    door.rotation.y = open * 1.2;
  }
  function doorTip(out = new THREE.Vector3()) {
    tipLocal.set(0, 0, 1.05);
    return door.localToWorld(out.copy(tipLocal));
  }
  setDoor(0);
  return { group, setDoor, doorTip };
}

// Big slow yellow school bus, ~2.5 × 10 m. Nose faces -Z. `lettered: true`
// adds the white side board with blocky dark marks — the neighborhood school
// bus, readable as lettering through the pixel filter without being any.
export function makeBus({ lettered = false } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.1, 10), flat(0xf2b02e));
  body.position.y = 1.55;
  group.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.22, 10.02), flat(0x23283a));
  stripe.position.y = 1.35;
  group.add(stripe);
  const wind = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.7, 0.1), flat(0x1c2230));
  wind.position.set(0, 2.1, -4.96);
  group.add(wind);
  if (lettered) {
    for (const sx of [-1, 1]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 6.4), flat(0xf2f2f2));
      board.position.set(sx * 1.28, 1.85, 0.4);
      group.add(board);
      // Blocky marks, right-to-left spacing — suggestion, not typography.
      for (let i = 0; i < 6; i++) {
        const mark = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.34 + Math.random() * 0.14, 0.5 + Math.random() * 0.25),
          flat(0x23283a)
        );
        mark.position.set(sx * 1.33, 1.9, 2.8 - i * 0.95 + (Math.random() - 0.5) * 0.1);
        group.add(mark);
      }
    }
  }
  carWheels(group, 3.6, 0.4);
  return { group: shadow(group) };
}

// Box truck angled across the street, reverse lights on. Nose faces -Z.
export function makeTruck() {
  const group = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 2.0), flat(0xd9d4c8));
  cab.position.set(0, 1.15, -2.6);
  group.add(cab);
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 4.6), flat(0x8a8f99));
  box.position.set(0, 1.6, 0.7);
  group.add(box);
  const revMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9,
  });
  for (const sx of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.06), revMat);
    l.position.set(sx * 0.9, 0.7, 3.02);
    group.add(l);
  }
  carWheels(group, 2.6, 0.36);
  return { group: shadow(group) };
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

// A chunky pedestrian. Style: 'phone' (glowing screen, head down), 'hasidic'
// (black coat + brimmed hat), 'plain'. `bob(t)` does the walk cycle.
export function makePedestrian(style = 'plain') {
  const group = new THREE.Group();
  const coat = style === 'hasidic' ? 0x1a1a20 : PALETTE.carColors[(Math.random() * PALETTE.carColors.length) | 0];
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.72, 0.24), flat(0x23283a));
  legs.position.y = 0.36;
  group.add(legs);
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, style === 'hasidic' ? 0.78 : 0.6, 0.3), flat(coat)
  );
  torso.position.y = style === 'hasidic' ? 1.06 : 1.0;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), flat(0xe0a878));
  head.position.y = 1.55;
  group.add(head);

  if (style === 'hasidic') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 10), flat(0x101014));
    brim.position.y = 1.66;
    group.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.18, 10), flat(0x101014));
    crown.position.y = 1.76;
    group.add(crown);
  }
  if (style === 'phone') {
    head.position.z = -0.1; // head down over the screen
    head.position.y = 1.48;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.34), flat(0xe0a878));
    arm.position.set(0.16, 1.18, -0.2);
    group.add(arm);
    const phone = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.2, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0xbfe8ff, emissiveIntensity: 0.9 })
    );
    phone.position.set(0.16, 1.24, -0.4);
    group.add(phone);
  }

  function bob(t, moving = true) {
    group.position.y = moving ? Math.abs(Math.sin(t * 7)) * 0.05 : 0;
    legs.rotation.x = moving ? Math.sin(t * 7) * 0.35 : 0;
  }
  return { group: shadow(group), bob };
}

// An elder mid-debate: long black coat, brimmed hat, gray beard, and arms that
// actually argue — `argue(t)` waves them with periodic emphatic flourishes.
export function makeElder() {
  const group = new THREE.Group();
  const coat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.15, 0.34), flat(0x1a1a20));
  coat.position.y = 0.72;
  group.add(coat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), flat(0xe0c9a8));
  head.position.y = 1.5;
  group.add(head);
  const beard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.1), flat(0xb9b9b4));
  beard.position.set(0, 1.4, -0.12);
  group.add(beard);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 10), flat(0x101014));
  brim.position.y = 1.62;
  group.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 10), flat(0x101014));
  crown.position.y = 1.74;
  group.add(crown);

  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.28, 1.22, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.42), flat(0x1a1a20));
    arm.position.z = -0.18;
    arm.castShadow = true;
    shoulder.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), flat(0xe0c9a8));
    hand.position.z = -0.4;
    shoulder.add(hand);
    group.add(shoulder);
    arms.push(shoulder);
  }

  // The whole point. Slow sine = general gesturing; the squared fast term
  // throws in emphatic "listen to me" flourishes every few seconds.
  function argue(t, phase = 0) {
    const heat = 0.5 + 0.5 * Math.sin(t * 0.5 + phase); // argument intensity
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const wave = Math.sin(t * 3.1 + phase + i * 2.1);
      const flourish = Math.pow(Math.max(0, Math.sin(t * 0.9 + phase + i)), 4);
      arms[i].rotation.x = -0.5 - wave * 0.3 * heat - flourish * 0.7;
      arms[i].rotation.z = s * (0.25 + flourish * 0.5);
    }
    group.rotation.x = Math.sin(t * 1.6 + phase) * 0.045 * heat; // leaning in
  }
  return { group: shadow(group), argue };
}

// A hydrant blowing its cap: jittering water column, orbiting droplets, and a
// pulsing splash ring. MeshBasicMaterial — water shouldn't take shadows.
export function makeGeyser() {
  const group = new THREE.Group();
  const waterMat = new THREE.MeshBasicMaterial({
    color: 0xbfe8ff, transparent: true, opacity: 0.85,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xe8f6ff, transparent: true, opacity: 0.95,
  });

  const columns = [];
  for (let i = 0; i < 3; i++) {
    const w = 0.5 + i * 0.16;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(w, 1.7, w), i === 0 ? coreMat : waterMat);
    seg.position.y = 1 + i * 1.5;
    group.add(seg);
    columns.push(seg);
  }
  const bloom = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 1.7), waterMat);
  bloom.position.y = 5.1;
  group.add(bloom);

  const drops = [];
  for (let i = 0; i < 10; i++) {
    // Own material per droplet — their opacity animates individually.
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), waterMat.clone());
    group.add(d);
    drops.push({ mesh: d, a: Math.random() * Math.PI * 2, p: Math.random() });
  }

  const splash = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 1.3, 12),
    new THREE.MeshBasicMaterial({
      color: 0xd8f0ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    })
  );
  splash.rotation.x = -Math.PI / 2;
  splash.position.y = 0.12;
  group.add(splash);

  function tick(dt, t) {
    for (let i = 0; i < columns.length; i++) {
      const jitter = 1 + Math.sin(t * 13 + i * 2.4) * 0.16;
      columns[i].scale.set(jitter, 1 + Math.sin(t * 9 + i) * 0.12, jitter);
      columns[i].rotation.y = t * (1.2 + i * 0.4);
    }
    bloom.scale.setScalar(1 + Math.sin(t * 11) * 0.2);
    bloom.rotation.y = -t * 1.6;
    for (const d of drops) {
      // Each droplet loops a little ballistic arc out of the bloom.
      d.p = (d.p + dt * 0.9) % 1;
      const r = 0.4 + d.p * 2.2;
      d.mesh.position.set(
        Math.cos(d.a) * r,
        5 + d.p * 1.8 - d.p * d.p * 5.2,
        Math.sin(d.a) * r
      );
      d.mesh.material.opacity = 0.85 * (1 - d.p);
    }
    const ring = 1 + (t % 0.7) * 1.6;
    splash.scale.setScalar(ring);
    splash.material.opacity = 0.55 * (1 - (t % 0.7) / 0.7);
  }
  return { group, tick };
}

// Dog walker: owner + dog + the leash between them — the leash is the obstacle.
// traffic.js positions `dog` each frame; `tick()` restrings the leash line.
export function makeDogWalker() {
  const owner = makePedestrian('plain');
  const group = new THREE.Group();
  group.add(owner.group);

  const dog = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.6), flat(0x8a5a3b));
  body.position.y = 0.3;
  dog.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.24), flat(0x8a5a3b));
  head.position.set(0, 0.44, -0.36);
  dog.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.26), flat(0x6b452e));
  tail.position.set(0, 0.42, 0.36);
  tail.rotation.x = -0.7;
  dog.add(tail);
  shadow(dog);
  group.add(dog);

  const leashGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(), new THREE.Vector3(),
  ]);
  const leash = new THREE.Line(leashGeom, new THREE.LineBasicMaterial({ color: 0xe8e5da }));
  group.add(leash);

  // Restring the leash from the owner's hand to the dog's collar (local coords).
  function tick(t) {
    tail.rotation.z = Math.sin(t * 9) * 0.5;
    const pos = leashGeom.attributes.position;
    pos.setXYZ(0, owner.group.position.x + 0.2, 1.05, owner.group.position.z);
    pos.setXYZ(1, dog.position.x, 0.45, dog.position.z);
    pos.needsUpdate = true;
  }
  return { group, owner, dog, bob: owner.bob, tick };
}

// The salmon: a courier riding the wrong way in YOUR lane. Simplified bike +
// rider (the player's silhouette, hostile colorway). Forward is -Z.
export function makeSalmon() {
  const group = new THREE.Group();
  const wheelGeom = new THREE.TorusGeometry(0.34, 0.07, 6, 14);
  wheelGeom.rotateY(Math.PI / 2);
  const wheelMat = flat(0x14161f);
  for (const z of [-0.5, 0.5]) {
    const w = new THREE.Mesh(wheelGeom, wheelMat);
    w.position.set(0, 0.34, z);
    group.add(w);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.9), flat(0x2ec4b6));
  frame.position.y = 0.5;
  group.add(frame);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.24), flat(0xff4fa3));
  torso.position.set(0, 1.1, 0.05);
  torso.rotation.x = -0.4;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), flat(0xe0a878));
  head.position.set(0, 1.42, -0.1);
  group.add(head);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), flat(0x23283a)
  );
  helmet.position.set(0, 1.44, -0.1);
  group.add(helmet);
  return { group: shadow(group) };
}

// ---------------------------------------------------------------------------
// Street junk & wildlife
// ---------------------------------------------------------------------------

// Garbage-night trash bag mountain. Soft obstacle: `burst()` flings the bags
// outward (traffic.js plays it once when the bike plows through).
export function makeTrashPile() {
  const group = new THREE.Group();
  const bagMat = flat(0x23283a);
  const bagMat2 = flat(0x2e4034);
  const bags = [];
  const n = 6 + (Math.random() * 3 | 0);
  for (let i = 0; i < n; i++) {
    const s = 0.35 + Math.random() * 0.3;
    const bag = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), Math.random() < 0.5 ? bagMat : bagMat2);
    bag.position.set(
      (Math.random() - 0.5) * 1.6,
      s * 0.7 + Math.random() * 0.5,
      (Math.random() - 0.5) * 1.6
    );
    bag.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    group.add(bag);
    bags.push({
      mesh: bag,
      vx: bag.position.x * 3 + (Math.random() - 0.5),
      vy: 2.5 + Math.random() * 2,
      vz: bag.position.z * 3 + (Math.random() - 0.5),
    });
  }
  let bursting = false;
  function burst() { bursting = true; }
  function tick(dt) {
    if (!bursting) return;
    for (const b of bags) {
      b.vy -= 12 * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y = Math.max(0.15, b.mesh.position.y + b.vy * dt);
      b.mesh.position.z += b.vz * dt;
      b.mesh.rotation.x += dt * 6;
    }
  }
  return { group: shadow(group), burst, tick };
}

// Pigeon flock: pecking birds that scatter when the bike gets close.
// `scatter()` launches them; tick flies them out; they never come back — the
// next order reseeds the world anyway.
export function makePigeons(count = 8) {
  const group = new THREE.Group();
  const birds = [];
  for (let i = 0; i < count; i++) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.22), flat(0x8f96a8));
    body.position.y = 0.08;
    b.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.08), flat(0x5b636b));
    head.position.set(0, 0.17, -0.12);
    b.add(head);
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 1.8;
    b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    b.rotation.y = Math.random() * Math.PI * 2;
    group.add(b);
    const fa = Math.random() * Math.PI * 2;
    birds.push({
      mesh: b, phase: Math.random() * 10,
      vx: Math.cos(fa) * (3 + Math.random() * 3),
      vz: Math.sin(fa) * (3 + Math.random() * 3),
      vy: 4 + Math.random() * 3,
    });
  }
  let scattered = false;
  function scatter() {
    if (scattered) return 0;
    scattered = true;
    return birds.length;
  }
  function tick(dt, t) {
    if (!scattered) {
      // Peck: little head-bob hops in place.
      for (const b of birds) {
        b.mesh.position.y = Math.max(0, Math.sin(t * 6 + b.phase)) * 0.05;
      }
      return;
    }
    for (const b of birds) {
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      b.mesh.rotation.z = Math.sin(t * 24 + b.phase) * 0.6; // frantic flapping
    }
  }
  return { group, scatter, tick, get scattered() { return scattered; } };
}
