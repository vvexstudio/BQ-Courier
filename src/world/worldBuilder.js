// Orchestrates the OSM -> 3D world pipeline. Given a bbox, it sets the world
// origin, fetches OSM, and returns a group containing ground + roads + buildings
// plus some stats for the HUD.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fetchOSM, partition } from './overpass.js';
import { setOrigin, bboxCenter } from './geo.js';
import { buildBuildings } from './buildings.js';
import { buildRoads } from './roads.js';
import { buildStreetLife } from './streetlife.js';
import { buildRoadGraph, isRideable } from './roadGraph.js';
import { project } from './geo.js';
import { PALETTE } from '../config.js';

// Pick a spawn on the street network: the road vertex nearest the world origin,
// facing along its segment. Guarantees the bike starts on asphalt, not inside a
// building, and pointing down a road instead of at a wall. Rideable ways only —
// a footway vertex can face straight into a courtyard wall.
function pickSpawn(roads) {
  let best = null;
  let bestD2 = Infinity;
  for (const way of roads) {
    if (!isRideable(way.tags)) continue;
    const pts = way.geometry;
    for (let i = 0; i < pts.length; i++) {
      const { x, z } = project(pts[i].lat, pts[i].lon);
      const d2 = x * x + z * z;
      if (d2 < bestD2) {
        // Heading from this vertex toward the next (or previous) one.
        const nb = pts[i + 1] ?? pts[i - 1];
        let heading = 0;
        if (nb) {
          const p2 = project(nb.lat, nb.lon);
          const dx = (i + 1 < pts.length ? p2.x - x : x - p2.x);
          const dz = (i + 1 < pts.length ? p2.z - z : z - p2.z);
          // Face along the segment. Inverse of forward=(-sin h, -cos h).
          heading = Math.atan2(-dx, -dz);
        }
        bestD2 = d2;
        best = { x, z, heading };
      }
    }
  }
  return best ?? { x: 0, z: 0, heading: 0 };
}

// Real deliverable addresses: buildings tagged with addr:housenumber +
// addr:street. The drop point is the footprint centroid; the delivery system
// snaps it to the nearest road for routing.
function collectAddresses(buildings) {
  const out = [];
  for (const way of buildings) {
    const t = way.tags ?? {};
    if (!t['addr:housenumber'] || !t['addr:street']) continue;
    let sx = 0, sz = 0, n = 0;
    for (const node of way.geometry) {
      const { x, z } = project(node.lat, node.lon);
      sx += x; sz += z; n++;
    }
    if (!n) continue;
    out.push({
      x: sx / n,
      z: sz / n,
      label: `${t['addr:housenumber']} ${t['addr:street']}`,
      name: t.name ?? null,
    });
  }
  return out;
}

// Projected road centerlines for the minimap: [{ pts: [{x,z},...], bike }].
function collectRoadLines(roads) {
  const lines = [];
  for (const way of roads) {
    if (!isRideable(way.tags)) continue;
    lines.push({
      pts: way.geometry.map((n) => project(n.lat, n.lon)),
      bike: way.tags?.highway === 'cycleway',
    });
  }
  return lines;
}

// Scatter simple low-poly trees (cylinder trunk + icosahedron canopy) across
// the map — the 16-bit environment dressing. Positions are rejection-sampled:
// not on a road (roadGraph distance) and not inside any building footprint.
function buildTrees(footprints, roadGraph, count = 140) {
  // Cached footprint bboxes make the point-in-polygon sweep cheap.
  const boxes = footprints.map((fp) => {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const p of fp) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    return { fp, minX, minZ, maxX, maxZ };
  });
  const inBuilding = (x, z) => {
    for (const b of boxes) {
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      let inside = false;
      const fp = b.fp;
      for (let i = 0, j = fp.length - 1; i < fp.length; j = i++) {
        if (
          fp[i].z > z !== fp[j].z > z &&
          x < ((fp[j].x - fp[i].x) * (z - fp[i].z)) / (fp[j].z - fp[i].z) + fp[i].x
        ) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  };

  const trunkGeoms = [];
  const leafGeoms = [];
  const leafColors = PALETTE.treeLeaves.map((c) => new THREE.Color(c));
  const tmp = new THREE.Color();

  let placed = 0;
  for (let tries = 0; tries < count * 25 && placed < count; tries++) {
    const x = (Math.random() - 0.5) * 560;
    const z = (Math.random() - 0.5) * 560;
    const near = roadGraph.nearestOnRoad(x, z);
    if (near && near.dist < 8) continue; // keep the streets clear
    if (inBuilding(x, z)) continue;

    const s = 0.8 + Math.random() * 0.7;
    const trunk = new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 2.6 * s, 5);
    trunk.translate(x, 1.3 * s, z);
    trunkGeoms.push(trunk);

    const leaf = new THREE.IcosahedronGeometry(2.1 * s, 0);
    leaf.translate(x, (2.6 + 1.5) * s, z);
    tmp.copy(leafColors[Math.floor(Math.random() * leafColors.length)]);
    tmp.offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
    const n = leaf.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    leaf.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    leafGeoms.push(leaf);
    placed++;
  }

  const group = new THREE.Group();
  group.name = 'trees';
  if (trunkGeoms.length) {
    const trunks = new THREE.Mesh(
      mergeGeometries(trunkGeoms, false),
      new THREE.MeshStandardMaterial({ color: PALETTE.treeTrunk, roughness: 0.95 })
    );
    trunks.castShadow = true;
    group.add(trunks);
  }
  if (leafGeoms.length) {
    const leaves = new THREE.Mesh(
      mergeGeometries(leafGeoms, false),
      new THREE.MeshStandardMaterial({
        color: 0xffffff, vertexColors: true, roughness: 0.9, flatShading: true,
      })
    );
    leaves.castShadow = true;
    group.add(leaves);
  }
  return group;
}

function buildGround() {
  const geom = new THREE.PlaneGeometry(4000, 4000);
  geom.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: PALETTE.ground, roughness: 1.0, metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.y = -0.4;
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

export async function buildWorld(bbox, { onStatus } = {}) {
  const { lat, lng } = bboxCenter(bbox);
  setOrigin(lat, lng);

  const osm = await fetchOSM(bbox, { onStatus });
  const { buildings, roads } = partition(osm);

  onStatus?.(`Extruding ${buildings.length} buildings, ${roads.length} roads…`);

  const world = new THREE.Group();
  world.name = 'world';
  world.add(buildGround());

  const roadGroup = buildRoads(roads);
  const buildingGroup = buildBuildings(buildings);
  world.add(roadGroup);
  world.add(buildingGroup);

  const roadGraph = buildRoadGraph(roads);
  world.add(buildTrees(buildingGroup.userData.footprints ?? [], roadGraph));

  // Street-life density pass: sidewalks, parked cars, rooftop clutter. Parked
  // cars hand back footprints so the collider treats them like small buildings.
  const streetLife = buildStreetLife(roads, buildingGroup.userData.roofs ?? []);
  world.add(streetLife.group);

  return {
    world,
    footprints: [
      ...(buildingGroup.userData.footprints ?? []),
      ...streetLife.carFootprints,
    ],
    spawn: pickSpawn(roads),
    roadGraph,
    addresses: collectAddresses(buildings),
    roadLines: collectRoadLines(roads),
    hydrants: streetLife.hydrantSpots,
    stats: {
      buildings: buildingGroup.userData.count ?? 0,
      roads: roadGroup.userData.roadCount ?? 0,
      bikeLanes: roadGroup.userData.bikeCount ?? 0,
    },
  };
}
