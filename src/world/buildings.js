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

  for (const way of buildingWays) {
    const ring = way.geometry;
    if (!ring || ring.length < 4) continue; // need a closed-ish ring

    const shape = new THREE.Shape();
    let started = false;
    for (const node of ring) {
      const { x, z } = project(node.lat, node.lon);
      // Shape lives in XY; we store world-Z as -Y so that after rotateX(-90)
      // it maps back to +Z (no mirroring vs. the road layer).
      if (!started) {
        shape.moveTo(x, -z);
        started = true;
      } else {
        shape.lineTo(x, -z);
      }
    }

    const height = heightForTags(way.tags);
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      steps: 1,
    });
    geom.rotateX(-Math.PI / 2); // XY plane + Z extrude -> XZ footprint rising in +Y
    geoms.push(geom);
  }

  const group = new THREE.Group();
  group.name = 'buildings';
  if (geoms.length === 0) return group;

  const merged = mergeGeometries(geoms, false);
  merged.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: PALETTE.building,
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
