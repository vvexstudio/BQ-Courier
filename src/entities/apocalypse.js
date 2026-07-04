// The end times come to Brooklyn — and the orders keep coming. Every factory
// here is a disaster the event system can drop on the grid: same 16-bit rules
// as props.js, flat saturated colors, silhouettes that survive the pixel
// filter. If it can't be read at 1/3 resolution from a moving bike, it's cut.
//
// Same contract as props.js: { group, ...handles }, group at origin, ground at
// y=0, local -Z is forward. Animation state lives in the handles; the game
// drives them per frame. Meshes stay dumb, even during the apocalypse.

import * as THREE from 'three';

const flat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
const shadow = (g) => {
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
};

// ---------------------------------------------------------------------------
// Ground hazards
// ---------------------------------------------------------------------------

// The street just gives up. Near-black disc floats a hair above the asphalt
// (road tops out at 0.15) so it reads as depth, not paint. `setOpen(0..1)`
// yawns it from pothole to void; `tick` keeps the rim nervous while it grows.
export function makeSinkhole() {
  const group = new THREE.Group();

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.25, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x05060a })
  );
  disc.position.y = 0.25;
  group.add(disc);

  // Jagged rim: broken slabs tipping into the dark.
  const rim = new THREE.Group();
  const rimMat = flat(0x3a3d45);
  const chunks = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(0.7 + Math.random() * 0.5, 0.2, 0.5 + Math.random() * 0.4),
      rimMat
    );
    c.position.set(Math.cos(a) * 2.3, 0.22, Math.sin(a) * 2.3);
    // Wide face tangent to the hole, plus a drunken tilt.
    c.rotation.set((Math.random() - 0.5) * 0.5, Math.PI / 2 - a, (Math.random() - 0.5) * 0.5);
    rim.add(c);
    chunks.push({ mesh: c, baseY: c.position.y, phase: Math.random() * 10 });
  }
  shadow(rim);
  group.add(rim);

  // Cracks racing outward — the warning you get before you don't.
  const crackMat = flat(0x14161f);
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2;
    const len = 2 + Math.random() * 1.5;
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, len), crackMat);
    crack.position.set(Math.cos(a) * (2.3 + len / 2), 0.18, Math.sin(a) * (2.3 + len / 2));
    crack.rotation.y = -a + Math.PI / 2;
    group.add(crack);
  }

  let open = 0;
  function setOpen(t01) {
    open = Math.min(1, Math.max(0, t01));
    const s = 0.05 + open * 0.95;
    disc.scale.setScalar(s);
    rim.visible = open > 0.05;
    rim.scale.setScalar(s);
  }
  function tick(dt, t) {
    // Rim shudders hardest mid-collapse, settles once fully open.
    const nerve = open * (1 - open) * 4 * 0.04 + 0.008;
    for (const c of chunks) {
      c.mesh.position.y = c.baseY + Math.sin(t * 21 + c.phase) * nerve;
    }
  }
  setOpen(0);
  return { group, setOpen, tick };
}

// The mantle wants in on the lunch rush. Zigzag of glowing quads down local Z
// with flames guttering out of the seams. Basic materials — lava is the light.
export function makeLavaCrack() {
  const group = new THREE.Group();
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
  const lavaColorA = new THREE.Color(0xd42a10);
  const lavaColorB = new THREE.Color(0xff7a2a);

  // Five offset segments — the zigzag IS the silhouette.
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.9 + Math.random() * 0.3, 0.02, 1.9), lavaMat);
    seg.position.set(
      (i % 2 === 0 ? -1 : 1) * 0.3,
      0.22,
      -3.5 + 1.55 * i + 0.75
    );
    seg.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.25;
    group.add(seg);
  }

  const flames = [];
  const flameColors = [0xff8c1f, 0xffd23f, 0xff6a1f];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.7, 0.3),
      new THREE.MeshBasicMaterial({ color: flameColors[i] })
    );
    f.position.set((i % 2 === 0 ? -1 : 1) * 0.25, 0.55, -2.4 + i * 2.4);
    group.add(f);
    flames.push({ mesh: f, phase: i * 2.3 });
  }

  function tick(dt, t) {
    lavaMat.color.lerpColors(lavaColorA, lavaColorB, 0.5 + 0.5 * Math.sin(t * 4.5));
    for (const f of flames) {
      // Flames gutter, never loop cleanly — two frequencies keep it alive.
      const lick = 0.7 + Math.sin(t * 11 + f.phase) * 0.25 + Math.sin(t * 17 + f.phase * 3) * 0.15;
      f.mesh.scale.set(1, Math.max(0.2, lick), 1);
      f.mesh.position.y = 0.22 + 0.35 * Math.max(0.2, lick);
    }
  }
  return { group, tick };
}

// ---------------------------------------------------------------------------
// Things in the sky
// ---------------------------------------------------------------------------

// The classic. They crossed the galaxy and picked Flatbush. Beam hangs 16m
// below the hull — the game parks the saucer over a lane and flips it on.
export function makeUFO() {
  const group = new THREE.Group();

  const hull = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 2.6, 0.9, 16), flat(0x9aa2ad));
  group.add(hull);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.1, 0.6, 12), flat(0x6b7280));
  belly.position.y = -0.7;
  group.add(belly);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshBasicMaterial({ color: 0xbfffcf, transparent: true, opacity: 0.55 })
  );
  dome.position.y = 0.4;
  group.add(dome);
  shadow(group);

  // Rim lights on their own spinner group — chase pattern via opacity wave.
  const spinner = new THREE.Group();
  const lightGeom = new THREE.BoxGeometry(0.35, 0.2, 0.35);
  const lights = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const l = new THREE.Mesh(
      lightGeom,
      new THREE.MeshBasicMaterial({ color: 0x8affae, transparent: true, opacity: 1 })
    );
    l.position.set(Math.cos(a) * 3.1, -0.25, Math.sin(a) * 3.1);
    spinner.add(l);
    lights.push(l);
  }
  group.add(spinner);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x5aff7a, transparent: true, opacity: 0.25, depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 3.2, 16, 14, 1, true), beamMat);
  beam.position.y = -8; // top kisses the hull, mouth at -16
  beam.visible = false;
  group.add(beam);

  function setBeam(on) { beam.visible = !!on; }
  function tick(dt, t) {
    spinner.rotation.y = t * 1.4;
    for (let i = 0; i < lights.length; i++) {
      // The chase: one bright pulse laps the rim, the rest smolder.
      lights[i].material.opacity = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * 5 - i * (Math.PI / 4)), 3);
    }
    if (beam.visible) {
      beamMat.opacity = 0.2 + 0.12 * Math.sin(t * 6);
      beam.rotation.y = t * 0.8;
    }
  }
  return { group, setBeam, tick };
}

// Airliner, retired from service, about to be very retired. No livery, no
// lettering — just the universal white tube everyone recognizes from below.
// Nose faces -Z; the game owns the flight path.
export function makePlane() {
  const group = new THREE.Group();
  const white = flat(0xe8e8ea);

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 14, 10), white);
  fuselage.geometry.rotateX(Math.PI / 2); // long axis onto Z
  fuselage.position.y = 1.6;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), white);
  nose.position.set(0, 1.6, -7);
  group.add(nose);

  const windscreen = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 0.9), flat(0x1c2230));
  windscreen.position.set(0, 2.05, -6.2);
  group.add(windscreen);

  // Swept wings — flat boxes yawed back. Silhouette does all the work.
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.18, 2.2), white);
    wing.position.set(s * 3.6, 1.5, 0.6);
    wing.rotation.y = s * -0.45;
    group.add(wing);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 10), flat(0x8a8f99));
    engine.geometry.rotateX(Math.PI / 2);
    engine.position.set(s * 2.6, 0.95, 0.1);
    group.add(engine);
  }

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 2), white);
  fin.position.set(0, 3.3, 6.4);
  fin.rotation.x = -0.25; // raked back
  group.add(fin);
  for (const s of [-1, 1]) {
    const stab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 1.2), white);
    stab.position.set(s * 1.5, 2.1, 6.6);
    stab.rotation.y = s * -0.35;
    group.add(stab);
  }
  return { group: shadow(group) };
}

// ---------------------------------------------------------------------------
// The formerly living, the recently collapsed
// ---------------------------------------------------------------------------

// A pedestrian who kept walking after the walking stopped mattering. Same body
// plan as the living kind, arms out front, one leg that no longer cooperates.
export function makeZombie() {
  const group = new THREE.Group();
  const skin = flat(0x8fb36a);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.24), flat(0x23283a));
  legL.position.set(-0.1, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.24), flat(0x1a1d29));
  legR.position.set(0.1, 0.36, 0);
  group.add(legR);

  // Torn two-tone rags — mismatched boxes read as tatters at 1/3 res.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.3), flat(0x2e3328));
  torso.position.y = 1.0;
  group.add(torso);
  const rag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.26), flat(0x1f2419));
  rag.position.set(0.04, 0.82, 0.04);
  rag.rotation.z = 0.15;
  group.add(rag);

  // A sphere doesn't show its tilt, so the head hangs off-center too.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), skin);
  head.position.set(0.09, 1.52, -0.04);
  head.rotation.z = 0.35;
  group.add(head);

  // Both arms locked forward. The pose IS the character.
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.28, 1.22, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.55), skin);
    arm.position.z = -0.3;
    arm.castShadow = true;
    shoulder.add(arm);
    group.add(shoulder);
    arms.push(shoulder);
  }

  // The lurch: two frequencies that never agree, so the gait never settles.
  // One hip swings, the other drags — undeath is asymmetric.
  function shamble(t, phase = 0) {
    const a = Math.sin(t * 3.2 + phase);
    const b = Math.sin(t * 5.1 + phase * 1.7);
    group.position.y = Math.abs(a) * 0.05 + Math.abs(b) * 0.02;
    group.rotation.z = a * 0.08 + b * 0.04;
    legL.rotation.x = a * 0.4;
    legR.rotation.x = Math.max(-0.1, a * -0.15); // the dragger
    arms[0].rotation.x = a * 0.1 - 0.05;
    arms[1].rotation.x = Math.sin(t * 3.2 + phase + 1.4) * 0.1 - 0.05;
    arms[0].rotation.z = 0.06 + b * 0.05;
    arms[1].rotation.z = -0.06 - a * 0.05;
  }
  return { group: shadow(group), shamble };
}

// What's left of a facade. Static — rubble's whole job is lying there.
export function makeRubble() {
  const group = new THREE.Group();
  const mats = [flat(0x6e6e74), flat(0x565a63), flat(0x8a4a3a)];
  const n = 3 + (Math.random() * 3 | 0);
  for (let i = 0; i < n; i++) {
    const s = 0.4 + Math.random() * 0.7;
    const mesh = Math.random() < 0.5
      ? new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.55, 0), mats[(Math.random() * mats.length) | 0])
      : new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.6, s * 0.8), mats[(Math.random() * mats.length) | 0]);
    mesh.position.set(
      (Math.random() - 0.5) * 1.4,
      s * 0.25 + Math.random() * 0.3,
      (Math.random() - 0.5) * 1.4
    );
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    group.add(mesh);
  }
  return { group: shadow(group) };
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

// One-shot blast, ~2.5s from bang to smoke. Fire-and-forget: the game spawns
// it, ticks it, and reaps it when `done` flips true.
export function makeExplosion() {
  const group = new THREE.Group();
  const DUR = 2.5;

  const coreMat = new THREE.MeshBasicMaterial({ color: 0xff8c1f, transparent: true, opacity: 1 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), coreMat);
  core.position.y = 0.8;
  group.add(core);

  const shards = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.25, 0.4),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xffd23f : 0xff6a1f, transparent: true, opacity: 1,
      })
    );
    s.position.y = 0.8;
    group.add(s);
    const a = Math.random() * Math.PI * 2;
    const pitch = 0.3 + Math.random() * 1.1;
    shards.push({
      mesh: s,
      vx: Math.cos(a) * Math.cos(pitch) * (4 + Math.random() * 4),
      vy: Math.sin(pitch) * (5 + Math.random() * 4),
      vz: Math.sin(a) * Math.cos(pitch) * (4 + Math.random() * 4),
      spin: 4 + Math.random() * 6,
    });
  }

  const smokes = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshBasicMaterial({ color: 0x3a3d45, transparent: true, opacity: 0 })
    );
    s.position.set((Math.random() - 0.5) * 1.2, 0.5, (Math.random() - 0.5) * 1.2);
    s.rotation.y = Math.random() * 3;
    group.add(s);
    smokes.push({ mesh: s, rise: 1.2 + Math.random() * 0.8, delay: i * 0.12 });
  }

  let age = 0;
  function tick(dt) {
    age += dt;
    const p = Math.min(1, age / DUR);

    // Core: violent growth in the first quarter second, then gone.
    const corePhase = Math.min(1, age / 0.5);
    core.scale.setScalar(0.5 + corePhase * 4.5);
    coreMat.opacity = Math.max(0, 1 - corePhase * 1.4);
    core.visible = coreMat.opacity > 0;

    for (const s of shards) {
      s.vy -= 6 * dt; // lazy gravity — this is a cartoon
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.mesh.rotation.x += s.spin * dt;
      s.mesh.material.opacity = Math.max(0, 1 - p * 1.6);
    }
    for (const s of smokes) {
      const sp = Math.min(1, Math.max(0, (age - s.delay) / (DUR - s.delay)));
      s.mesh.position.y += s.rise * dt;
      s.mesh.scale.setScalar(1 + sp * 2.5);
      // Fade in fast, linger, fade out.
      s.mesh.material.opacity = 0.7 * Math.min(1, sp * 5) * (1 - sp);
    }
  }
  return { group, tick, get done() { return age >= DUR; } };
}

// ---------------------------------------------------------------------------
// The big one
// ---------------------------------------------------------------------------

// 55 meters of bad news on the skyline. It never gets close — it's a shape
// over the rooftops, so every proportion is tuned for the silhouette and
// nothing else. Two red pixels for eyes so you know it's looking.
export function makeKaiju() {
  const group = new THREE.Group();
  const hide = flat(0x24262c);

  const hips = new THREE.Group();
  hips.position.y = 24;
  group.add(hips);

  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 4.5, 0, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(6, 24, 7), hide);
    leg.position.y = -12;
    hip.add(leg);
    hips.add(hip);
    legs.push(hip);
  }

  const body = new THREE.Group();
  body.position.y = 24;
  group.add(body);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(13, 20, 10), hide);
  torso.position.y = 10;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(5.5, 5, 7), hide);
  head.position.set(0, 22.5, -3);
  body.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.5), eyeMat);
    eye.position.set(s * 1.6, 23.5, -6.6);
    body.add(eye);
  }

  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3, 10, 3.5), hide);
    arm.position.set(s * 8.5, 12, -1);
    arm.rotation.z = s * 0.15;
    body.add(arm);
  }

  // Counterweight. Swings against the sway or the whole thing reads wrong.
  const tail = new THREE.Group();
  tail.position.set(0, 3, 5);
  const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 22), hide);
  tailMesh.position.z = 11;
  tail.add(tailMesh);
  body.add(tail);

  // Dorsal fins marching up the spine — the one detail the silhouette needs.
  for (let i = 0; i < 5; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4 + (2 - Math.abs(i - 2)) * 1.5, 3), hide);
    fin.position.set(0, 20 - i * 4, 5.5 + i * 0.6);
    fin.rotation.x = 0.3;
    body.add(fin);
  }
  shadow(group);

  // Continental-drift stride. Everything slow, everything heavy.
  function walk(t) {
    const stride = Math.sin(t * 0.9);
    legs[0].rotation.x = stride * 0.4;
    legs[1].rotation.x = -stride * 0.4;
    body.rotation.z = Math.sin(t * 0.9) * 0.05;
    tail.rotation.y = -Math.sin(t * 0.9) * 0.25;
    group.position.y = Math.abs(Math.sin(t * 0.9)) * 0.8;
  }
  return { group, walk };
}

// ---------------------------------------------------------------------------
// Projectiles & pickups
// ---------------------------------------------------------------------------

// Ammunition. Everything bagel, minus everything except sesame.
export function makeBagel() {
  const group = new THREE.Group();
  const bagel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.09, 8, 14), flat(0xd9a45b));
  bagel.rotation.x = Math.PI / 2; // torus is born upright; lay it flat
  bagel.position.y = 0.09; // rests on the ground when dropped
  group.add(bagel);
  const fleck = flat(0xf0e6c8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), fleck);
    f.position.set(Math.cos(a) * 0.22, 0.19, Math.sin(a) * 0.22);
    group.add(f);
  }
  return { group: shadow(group) };
}

// Floating pickup: an icon spinning over a landing-pad ring. Apocalypse or
// not, a courier runs on pizza, coffee, bagels, and borrowed time.
export function makePowerup(kind = 'pizza') {
  const group = new THREE.Group();

  const ringColors = { pizza: 0xff8c1f, coffee: 0x8a5a3b, shield: 0xd9a45b, clock: 0xbfe8ff };
  const ringMat = new THREE.MeshBasicMaterial({
    color: ringColors[kind] ?? 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.85, 16), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);

  const icon = new THREE.Group();
  icon.position.y = 1.3;
  group.add(icon);

  if (kind === 'pizza') {
    // One slice, extruded flat, pepperoni you can count from a moving bike.
    const tri = new THREE.Shape();
    tri.moveTo(0, -0.45);
    tri.lineTo(-0.32, 0.35);
    tri.lineTo(0.32, 0.35);
    tri.closePath();
    const slice = new THREE.Mesh(
      new THREE.ExtrudeGeometry(tri, { depth: 0.08, bevelEnabled: false }),
      flat(0xf2b02e)
    );
    slice.rotation.x = Math.PI / 2; // lie flat, tip toward -Z
    slice.position.y = 0.04;
    icon.add(slice);
    const crust = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.1), flat(0xc9873a));
    crust.position.set(0, 0, 0.32);
    icon.add(crust);
    const pep = flat(0xc42a10);
    for (const [px, pz] of [[0, 0.05], [-0.12, -0.18], [0.13, -0.12]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8), pep);
      p.position.set(px, 0.06, pz);
      icon.add(p);
    }
  } else if (kind === 'coffee') {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.5, 10), flat(0xf2f2f2));
    icon.add(cup);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10), flat(0x5a3a26));
    top.position.y = 0.26;
    icon.add(top);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), flat(0xf2f2f2));
    handle.position.set(0.28, 0, 0);
    icon.add(handle);
  } else if (kind === 'shield') {
    // The bagel IS the shield. This city defends its own.
    const bagel = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.14, 8, 16), flat(0xd9a45b));
    icon.add(bagel); // upright — a shield faces you
  } else {
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 14), flat(0xf2f2f2));
    face.rotation.x = Math.PI / 2; // face forward, not up
    icon.add(face);
    const minute = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.04), flat(0x23283a));
    minute.position.set(0, 0.11, -0.06);
    icon.add(minute);
    const hour = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.17, 0.04), flat(0x23283a));
    hour.position.set(0.06, 0.04, -0.06);
    hour.rotation.z = -1.1;
    icon.add(hour);
  }
  shadow(icon);

  function tick(dt, t) {
    icon.rotation.y = t * 2;
    icon.position.y = 1.3 + Math.sin(t * 3) * 0.15;
    ringMat.opacity = 0.35 + 0.25 * Math.sin(t * 4);
  }
  return { group, tick };
}
