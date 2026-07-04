// The density pass — everything that makes the blocks read as *Brooklyn*
// instead of colored slabs on a lawn: sidewalks hugging every street, rows of
// curb-parked cars (with collision — they're steel, not decals), cedar water
// towers and AC units on the rooflines, hydrants and trash cans at the curb.
//
// Everything here is static and merged into a handful of draw calls, same
// budget discipline as the buildings. Parked cars additionally return their
// rectangle footprints so the collider treats them like tiny buildings — a
// fast hit is a real crash.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { project } from './geo.js';
import { PALETTE, ROAD_WIDTHS } from '../config.js';
import { ribbon, isBikeLane } from './roads.js';

const SIDEWALK_Y = 0.02;
const SIDEWALK_W = 2.2;

// Streets that get the full curb treatment.
const DRESSED = new Set([
  'primary', 'secondary', 'tertiary', 'residential', 'living_street', 'unclassified',
]);
// Streets calm enough to park on.
const PARKABLE = new Set(['residential', 'tertiary', 'unclassified', 'living_street']);

function bakeColor(geom, color) {
  const n = geom.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}

// Offset a polyline sideways (miter-less: each vertex moves along the normal
// of its following segment — corner gaps disappear under the pixel filter).
function offsetLine(pts, off) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.min(i, pts.length - 2)];
    const b = pts[Math.min(i + 1, pts.length - 1)];
    let dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    out.push({ x: pts[i].x + -dz * off, z: pts[i].z + dx * off });
  }
  return out;
}

export function buildStreetLife(roadWays, roofs) {
  const group = new THREE.Group();
  group.name = 'streetlife';
  const carFootprints = [];
  const hydrantSpots = []; // world positions, for the chaos director's aim

  const sidewalkGeoms = [];
  const carBodyGeoms = [];   // vertex-colored
  const carDarkGeoms = [];   // cabins + wheels, one dark material
  const tankGeoms = [];      // water tower drums
  const darkRoofGeoms = [];  // tower cones + legs
  const acGeoms = [];
  const hydrantGeoms = [];
  const canGeoms = [];

  const carColors = PALETTE.carColors.map((c) => new THREE.Color(c));
  const tmp = new THREE.Color();

  let cars = 0, hydrants = 0, cans = 0;

  // Shuffle so the per-category caps spread across the whole bbox instead of
  // exhausting on whichever ways Overpass happened to list first.
  const ways = [...roadWays];
  for (let i = ways.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [ways[i], ways[j]] = [ways[j], ways[i]];
  }

  for (const way of ways) {
    const hw = way.tags?.highway;
    if (!DRESSED.has(hw)) continue;
    const pts = way.geometry.map((n) => project(n.lat, n.lon));
    if (pts.length < 2) continue;
    const halfW = (ROAD_WIDTHS[hw] ?? ROAD_WIDTHS._default) / 2;

    // --- Sidewalks: one ribbon per side, offset past the curb ---
    for (const side of [-1, 1]) {
      const line = offsetLine(pts, side * (halfW + SIDEWALK_W / 2 + 0.2));
      const g = ribbon(line, SIDEWALK_W, SIDEWALK_Y);
      if (g) sidewalkGeoms.push(g);
    }

    // --- Curb furniture + parked cars, walked along the segments ---
    const parkable = PARKABLE.has(hw) && !isBikeLane(way.tags);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      let dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 16) continue; // short stubs are intersections — keep them clear
      dx /= len; dz /= len;
      const px = -dz, pz = dx; // unit perpendicular

      // Parked cars: both curbs, 8m in from the corners, gap-toothed rows.
      if (parkable && cars < 220) {
        for (const side of [-1, 1]) {
          for (let d = 9; d < len - 9; d += 6.5) {
            if (Math.random() < 0.45) continue; // Brooklyn parking is never full
            const cx = a.x + dx * d + px * side * (halfW - 0.4);
            const cz = a.z + dz * d + pz * side * (halfW - 0.4);
            const h = Math.atan2(-dx, -dz) + (Math.random() < 0.5 ? 0 : Math.PI);

            const body = new THREE.BoxGeometry(1.75, 0.6, 4.3);
            body.translate(0, 0.6, 0);
            body.rotateY(h);
            body.translate(cx, 0, cz);
            tmp.copy(carColors[(Math.random() * carColors.length) | 0]);
            tmp.offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
            carBodyGeoms.push(bakeColor(body, tmp));

            const cabin = new THREE.BoxGeometry(1.55, 0.48, 2.1);
            cabin.translate(0, 1.12, 0.25);
            cabin.rotateY(h);
            cabin.translate(cx, 0, cz);
            carDarkGeoms.push(cabin);

            // Collider rectangle (slightly padded so scrapes feel like contact).
            const fx = -Math.sin(h), fz = -Math.cos(h);
            const hl = 2.25, hs = 1.0;
            carFootprints.push([
              { x: cx + fx * hl + px * hs, z: cz + fz * hl + pz * hs },
              { x: cx + fx * hl - px * hs, z: cz + fz * hl - pz * hs },
              { x: cx - fx * hl - px * hs, z: cz - fz * hl - pz * hs },
              { x: cx - fx * hl + px * hs, z: cz - fz * hl + pz * hs },
            ]);
            cars++;
            if (cars >= 220) break;
          }
          if (cars >= 220) break;
        }
      }

      // Hydrants + trash cans on the sidewalk line, sparse.
      if (hydrants < 90 && len > 30 && Math.random() < 0.5) {
        const d = 6 + Math.random() * (len - 12);
        const side = Math.random() < 0.5 ? -1 : 1;
        const hx = a.x + dx * d + px * side * (halfW + 1.2);
        const hz = a.z + dz * d + pz * side * (halfW + 1.2);
        const hyd = new THREE.CylinderGeometry(0.16, 0.2, 0.62, 6);
        hyd.translate(hx, 0.31, hz);
        hydrantGeoms.push(hyd);
        const cap = new THREE.SphereGeometry(0.14, 6, 5);
        cap.translate(hx, 0.66, hz);
        hydrantGeoms.push(cap);
        hydrantSpots.push({ x: hx, z: hz });
        hydrants++;
      }
      if (cans < 130 && len > 24 && Math.random() < 0.5) {
        const d = 6 + Math.random() * (len - 12);
        const side = Math.random() < 0.5 ? -1 : 1;
        const cx = a.x + dx * d + px * side * (halfW + 1.6);
        const cz = a.z + dz * d + pz * side * (halfW + 1.6);
        const can = new THREE.CylinderGeometry(0.32, 0.28, 0.78, 7);
        can.translate(cx, 0.39, cz);
        canGeoms.push(can);
        cans++;
      }
    }
  }

  // --- Rooftop clutter: water towers on the tall stock, AC units everywhere ---
  let towers = 0, acs = 0;
  for (const roof of roofs) {
    if (towers < 55 && roof.h > 13 && roof.span > 11 && Math.random() < 0.3) {
      const drum = new THREE.CylinderGeometry(1.9, 1.9, 2.8, 9);
      drum.translate(roof.x, roof.h + 2.2, roof.z);
      tankGeoms.push(drum);
      const cone = new THREE.ConeGeometry(2.15, 1.3, 9);
      cone.translate(roof.x, roof.h + 4.2, roof.z);
      darkRoofGeoms.push(cone);
      const legs = new THREE.BoxGeometry(2.6, 0.9, 2.6);
      legs.translate(roof.x, roof.h + 0.45, roof.z);
      darkRoofGeoms.push(legs);
      towers++;
    } else if (acs < 380 && roof.h > 7 && roof.span > 7 && Math.random() < 0.4) {
      const n = 1 + (Math.random() * 2 | 0);
      for (let i = 0; i < n; i++) {
        const ac = new THREE.BoxGeometry(1.1, 0.7, 1.1);
        ac.translate(
          roof.x + (Math.random() - 0.5) * roof.span * 0.35,
          roof.h + 0.35,
          roof.z + (Math.random() - 0.5) * roof.span * 0.35
        );
        acGeoms.push(ac);
        acs++;
      }
    }
  }

  const add = (geoms, material, name, receive = false) => {
    if (!geoms.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(geoms, false), material);
    mesh.castShadow = !receive;
    mesh.receiveShadow = receive;
    mesh.name = name;
    group.add(mesh);
  };

  add(sidewalkGeoms, new THREE.MeshStandardMaterial({
    color: PALETTE.sidewalk, roughness: 1, side: THREE.DoubleSide,
  }), 'sidewalks', true);
  add(carBodyGeoms, new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness: 0.7, flatShading: true,
  }), 'parkedCars');
  add(carDarkGeoms, new THREE.MeshStandardMaterial({
    color: 0x1c2230, roughness: 0.6,
  }), 'parkedCarGlass');
  add(tankGeoms, new THREE.MeshStandardMaterial({
    color: PALETTE.waterTower, roughness: 0.95, flatShading: true,
  }), 'waterTowers');
  add(darkRoofGeoms, new THREE.MeshStandardMaterial({
    color: 0x4a4038, roughness: 0.95, flatShading: true,
  }), 'towerRoofs');
  add(acGeoms, new THREE.MeshStandardMaterial({
    color: 0xb9bec9, roughness: 0.9, flatShading: true,
  }), 'acUnits');
  add(hydrantGeoms, new THREE.MeshStandardMaterial({
    color: PALETTE.hydrant, roughness: 0.8,
  }), 'hydrants');
  add(canGeoms, new THREE.MeshStandardMaterial({
    color: 0x3d5245, roughness: 0.9,
  }), 'trashCans');

  group.userData.stats = { cars, towers, acs, hydrants, cans };
  return { group, carFootprints, hydrantSpots };
}
