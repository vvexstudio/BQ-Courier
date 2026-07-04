// One-shot Node smoke test for the Phase 3 nav stack — no browser needed.
// Fetches the real bbox from Overpass, builds the road graph, and checks:
// addresses exist, nearest-road snapping works, and A* routes across the map.
// Run: node scripts/smoke-nav.mjs

import { setOrigin, bboxCenter, project } from '../src/world/geo.js';
import { buildRoadGraph, routeLength } from '../src/world/roadGraph.js';
import { WORLD } from '../src/config.js';

const bbox = WORLD.bbox;
const { lat, lng } = bboxCenter(bbox);
setOrigin(lat, lng);

const query = `[out:json][timeout:30];
(
  way["building"](${bbox.join(',')});
  way["highway"](${bbox.join(',')});
);
out geom;`;

let osm = null;
for (const endpoint of [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'bq-courier-smoke-test/0.1 (dev)',
      },
      body: 'data=' + encodeURIComponent(query),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    osm = await res.json();
    console.log(`fetched from ${endpoint}`);
    break;
  } catch (err) {
    console.warn(`${endpoint} failed: ${err.message}`);
  }
}
if (!osm) {
  console.error('SMOKE FAIL: all Overpass mirrors failed');
  process.exit(1);
}

const buildings = [];
const roads = [];
for (const el of osm.elements ?? []) {
  if (el.type !== 'way' || !el.geometry) continue;
  if (el.tags?.building) buildings.push(el);
  else if (el.tags?.highway) roads.push(el);
}
console.log(`OSM: ${buildings.length} buildings, ${roads.length} highways`);

const addresses = buildings.filter(
  (w) => w.tags['addr:housenumber'] && w.tags['addr:street']
);
console.log(`addresses with housenumber+street: ${addresses.length}`);

const graph = buildRoadGraph(roads);
console.log(`graph: ${graph.nodes.size} nodes, ${graph.segments.length} segments`);

// Snap test: world origin must be near a road.
const near = graph.nearestOnRoad(0, 0);
console.log(`nearestOnRoad(0,0): dist=${near?.dist.toFixed(1)}m`);

// Route test: origin -> 10 random address centroids.
let ok = 0, fail = 0;
const lens = [];
for (let i = 0; i < 10; i++) {
  const a = addresses[Math.floor(Math.random() * addresses.length)];
  let sx = 0, sz = 0, n = 0;
  for (const node of a.geometry) {
    const { x, z } = project(node.lat, node.lon);
    sx += x; sz += z; n++;
  }
  const r = graph.route(0, 0, sx / n, sz / n);
  if (r && r.length >= 2) {
    ok++;
    lens.push(routeLength(r));
  } else fail++;
}
console.log(`routes: ${ok} ok, ${fail} failed`);
console.log(`route lengths (m): ${lens.map((l) => Math.round(l)).join(', ')}`);

if (fail > ok || !near || graph.nodes.size === 0 || addresses.length === 0) {
  console.error('SMOKE FAIL');
  process.exit(1);
}
console.log('SMOKE PASS');
