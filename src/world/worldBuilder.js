// Orchestrates the OSM -> 3D world pipeline. Given a bbox, it sets the world
// origin, fetches OSM, and returns a group containing ground + roads + buildings
// plus some stats for the HUD.

import * as THREE from 'three';
import { fetchOSM, partition } from './overpass.js';
import { setOrigin, bboxCenter } from './geo.js';
import { buildBuildings } from './buildings.js';
import { buildRoads } from './roads.js';
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

  return {
    world,
    footprints: buildingGroup.userData.footprints ?? [],
    spawn: pickSpawn(roads),
    roadGraph: buildRoadGraph(roads),
    addresses: collectAddresses(buildings),
    roadLines: collectRoadLines(roads),
    stats: {
      buildings: buildingGroup.userData.count ?? 0,
      roads: roadGroup.userData.roadCount ?? 0,
      bikeLanes: roadGroup.userData.bikeCount ?? 0,
    },
  };
}
