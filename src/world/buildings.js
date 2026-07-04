// Turn OSM building footprints into extruded 3D boxes.
//
// Footprint polygons come in as lat/lng rings; we project to world XZ, build a
// THREE.Shape, extrude upward, and merge everything into one geometry so the
// whole neighborhood draws in a single (or few) draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { project } from './geo.js';
import { PALETTE } from '../config.js';

const METERS_PER_LEVEL = 3.2;

function heightForTags(tags = {}) {
  const h = parseFloat(tags.height);
  if (!isNaN(h)) return h;
  const levels = parseFloat(tags['building:levels']);
  if (!isNaN(levels)) return levels * METERS_PER_LEVEL;
  // Brooklyn fallback: mostly low/mid rise. Deterministic-ish jitter.
  return 9 + Math.random() * 12;
}

export function buildBuildings(buildingWays) {
  const geoms = [];
  // World-space XZ footprint rings, kept for the collider (Phase 2).
  const footprints = [];

  // 16-bit facades: each building gets one flat color from the Williamsburg
  // variant palette, with a touch of per-building lightness jitter so two
  // brick-red neighbors don't read as one blob.
  const variants = PALETTE.buildingVariants.map((c) => new THREE.Color(c));
  const tmp = new THREE.Color();

  for (const way of buildingWays) {
    const ring = way.geometry;
    if (!ring || ring.length < 4) continue; // need a closed-ish ring

    const shape = new THREE.Shape();
    const footprint = [];
    let started = false;
    for (const node of ring) {
      const { x, z } = project(node.lat, node.lon);
      footprint.push({ x, z });
      // Shape lives in XY; we store world-Z as -Y so that after rotateX(-90)
      // it maps back to +Z (no mirroring vs. the road layer).
      if (!started) {
        shape.moveTo(x, -z);
        started = true;
      } else {
        shape.lineTo(x, -z);
      }
    }
    footprints.push(footprint);

    const height = heightForTags(way.tags);
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      steps: 1,
    });
    geom.rotateX(-Math.PI / 2); // XY plane + Z extrude -> XZ footprint rising in +Y

    tmp.copy(variants[Math.floor(Math.random() * variants.length)]);
    tmp.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
    const count = geom.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geoms.push(geom);
  }

  const group = new THREE.Group();
  group.name = 'buildings';
  group.userData.footprints = footprints;
  if (geoms.length === 0) return group;

  const merged = mergeGeometries(geoms, false);
  merged.computeVertexNormals();

  // Roofs a shade darker than the walls — separates the skyline planes the way
  // 16-bit tilesets do. Extrude output is non-indexed, so vertex normals are
  // face normals: normal.y ≈ 1 means "this vertex is on a roof".
  {
    const n = merged.attributes.normal;
    const c = merged.attributes.color;
    for (let i = 0; i < n.count; i++) {
      if (n.getY(i) > 0.9) {
        c.setXYZ(i, c.getX(i) * 0.72, c.getY(i) * 0.72, c.getZ(i) * 0.72);
      }
    }
  }

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.0,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.userData.count = geoms.length;
  return group;
}
