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
  // Roof records for the street-life pass (water towers, AC units): centroid,
  // height, and rough footprint size so clutter only lands on real roofs.
  const roofs = [];

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
    {
      let sx = 0, sz = 0;
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (const p of footprint) {
        sx += p.x; sz += p.z;
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }
      roofs.push({
        x: sx / footprint.length,
        z: sz / footprint.length,
        h: height,
        span: Math.min(maxX - minX, maxZ - minZ), // narrow dimension of the roof
      });
    }
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
  group.userData.roofs = roofs;
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

  // The 16-bit facade pass (art pass 2026-07-04): procedural window grids
  // drawn in the fragment shader, so buildings read as *buildings* instead of
  // extruded color slabs. Windows tile in world space (floors every 3m,
  // bays every 2.6m) on near-vertical faces above the ground floor; a hash
  // per window leaves ~8% of them warmly lit. The ground floor gets a subtle
  // storefront darkening. Cost: a few ALU ops — geometry untouched, still
  // one merged draw call.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBqWorld;
        varying vec3 vBqNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vBqWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vBqNormal = normalize(mat3(modelMatrix) * normal);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBqWorld;
        varying vec3 vBqNormal;
        float bqHash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float vert = 1.0 - abs(vBqNormal.y);
          if (vert > 0.7) {
            if (vBqWorld.y > 2.9) {
              // Coordinate along the wall, whichever way it faces.
              vec2 t = normalize(vec2(-vBqNormal.z, vBqNormal.x));
              float u = dot(vBqWorld.xz, t);
              vec2 cell = vec2(floor(u / 2.6), floor(vBqWorld.y / 3.0));
              vec2 f = vec2(fract(u / 2.6), fract(vBqWorld.y / 3.0));
              if (f.x > 0.28 && f.x < 0.72 && f.y > 0.32 && f.y < 0.8) {
                float h = bqHash(cell + floor(vBqWorld.xz * 0.01) * 7.0);
                vec3 glass = h > 0.92
                  ? vec3(0.98, 0.86, 0.52)                   // somebody's home
                  : mix(vec3(0.13, 0.16, 0.23),              // dark glass…
                        vec3(0.35, 0.42, 0.55), bqHash(cell + 3.7) * 0.5); // …with sky glints
                // Sill shadow line under each window sells the relief.
                float sill = smoothstep(0.32, 0.35, f.y) * (1.0 - smoothstep(0.77, 0.8, f.y));
                diffuseColor.rgb = mix(diffuseColor.rgb, glass, 0.92 * sill);
              }
            } else {
              // Ground floor: storefront band, a shade darker, lintel line on top.
              float lintel = step(2.55, vBqWorld.y);
              diffuseColor.rgb *= mix(0.86, 0.7, lintel);
            }
          }
        }`);
  };

  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.userData.count = geoms.length;
  return group;
}
