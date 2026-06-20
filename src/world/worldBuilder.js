// Orchestrates the OSM -> 3D world pipeline. Given a bbox, it sets the world
// origin, fetches OSM, and returns a group containing ground + roads + buildings
// plus some stats for the HUD.

import * as THREE from 'three';
import { fetchOSM, partition } from './overpass.js';
import { setOrigin, bboxCenter } from './geo.js';
import { buildBuildings } from './buildings.js';
import { buildRoads } from './roads.js';
import { PALETTE } from '../config.js';

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
    stats: {
      buildings: buildingGroup.userData.count ?? 0,
      roads: roadGroup.userData.roadCount ?? 0,
      bikeLanes: roadGroup.userData.bikeCount ?? 0,
    },
  };
}
