// Turn OSM highway centerlines into flat drivable ribbons.
//
// For the MVP we build a simple per-segment quad strip offset by half the road
// width. It's not a perfect mitered ribbon (tiny gaps at sharp corners) but it
// reads correctly and is cheap. Bike lanes are detected and rendered in a loud
// green at a higher y so they're unmissable — the bike-lane-blocking gag is a
// core mechanic, so the data has to be legible from the start.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { project } from './geo.js';
import { ROAD_WIDTHS, PALETTE } from '../config.js';

const ROAD_Y = 0.06;
const BIKE_Y = 0.12; // sits just above the road surface

function isBikeLane(tags = {}) {
  if (tags.highway === 'cycleway') return true;
  if (tags.bicycle === 'designated') return true;
  return Object.keys(tags).some(
    (k) => k.startsWith('cycleway') && tags[k] && tags[k] !== 'no'
  );
}

function widthFor(tags = {}) {
  return ROAD_WIDTHS[tags.highway] ?? ROAD_WIDTHS._default;
}

// Build a ribbon geometry from world-space points [{x,z}], at height y.
function ribbon(points, width, y) {
  if (points.length < 2) return null;
  const half = width / 2;
  const pos = [];
  const idx = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    dx /= len;
    dz /= len;
    // perpendicular in XZ
    const nx = -dz * half;
    const nz = dx * half;

    const base = pos.length / 3;
    pos.push(
      a.x + nx, y, a.z + nz, // 0
      a.x - nx, y, a.z - nz, // 1
      b.x + nx, y, b.z + nz, // 2
      b.x - nx, y, b.z - nz  // 3
    );
    idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }

  if (pos.length === 0) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  return geom;
}

export function buildRoads(roadWays) {
  const roadGeoms = [];
  const bikeGeoms = [];

  for (const way of roadWays) {
    const pts = way.geometry.map((n) => project(n.lat, n.lon));
    const bike = isBikeLane(way.tags);
    const geom = ribbon(pts, widthFor(way.tags), bike ? BIKE_Y : ROAD_Y);
    if (!geom) continue;
    (bike ? bikeGeoms : roadGeoms).push(geom);
  }

  const group = new THREE.Group();
  group.name = 'roads';

  if (roadGeoms.length) {
    const mesh = new THREE.Mesh(
      mergeGeometries(roadGeoms, false),
      new THREE.MeshStandardMaterial({
        color: PALETTE.road, roughness: 0.95, metalness: 0.0,
      })
    );
    mesh.receiveShadow = true;
    mesh.name = 'roadway';
    group.add(mesh);
  }

  if (bikeGeoms.length) {
    const mesh = new THREE.Mesh(
      mergeGeometries(bikeGeoms, false),
      new THREE.MeshStandardMaterial({
        color: PALETTE.bikeLane,
        emissive: PALETTE.bikeLane,
        emissiveIntensity: 0.35,
        roughness: 0.7,
      })
    );
    mesh.name = 'bikelanes';
    group.add(mesh);
  }

  group.userData.bikeCount = bikeGeoms.length;
  group.userData.roadCount = roadGeoms.length;
  return group;
}
