// Routable road network built from the same OSM ways we render.
//
// Three jobs, all serving navigation (Phase 3) and lane assist:
//   1. A node/edge graph of the *rideable* streets (no footways, no BQE) with
//      A* shortest-path routing between any two world points.
//   2. A uniform spatial grid of road segments for fast "nearest point on a
//      road" queries — the lane assist asks this every frame.
//   3. Both queries snap arbitrary points to the network, so destinations can
//      be building centroids and routes still land on asphalt.
//
// Nodes are keyed by their raw lat/lon strings: Overpass `out geom` emits the
// exact same coordinates for a shared OSM node in every way that uses it, so
// intersections connect without any welding tolerance.

import { project } from './geo.js';
import { isBikeLane } from './roads.js';

const CELL = 32; // meters, spatial grid for segment queries

// What the courier can actually ride. Footways/steps dead-end into buildings
// and the BQE (trunk/motorway) is neither legal nor survivable on a bike.
const RIDEABLE = new Set([
  'primary', 'secondary', 'tertiary', 'residential', 'living_street',
  'unclassified', 'service', 'cycleway', 'pedestrian',
  'primary_link', 'secondary_link', 'tertiary_link',
]);

export function isRideable(tags = {}) {
  return RIDEABLE.has(tags.highway);
}

export function buildRoadGraph(roadWays) {
  const nodes = new Map(); // key -> { x, z, adj: [{ to: key, len }] }
  const segments = [];     // { ax, az, bx, bz, dx, dz, len, a, b } (dx,dz unit)
  const grid = new Map();  // "cx,cz" -> [segment index, ...]
  const gk = (cx, cz) => cx + ',' + cz;

  function getNode(pt) {
    const key = pt.lat + ',' + pt.lon;
    let n = nodes.get(key);
    if (!n) {
      const { x, z } = project(pt.lat, pt.lon);
      n = { x, z, adj: [] };
      nodes.set(key, n);
    }
    return { key, n };
  }

  for (const way of roadWays) {
    if (!isRideable(way.tags)) continue;
    const bike = isBikeLane(way.tags); // segments carry this for the boost/gag logic
    const pts = way.geometry;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = getNode(pts[i]);
      const b = getNode(pts[i + 1]);
      let dx = b.n.x - a.n.x;
      let dz = b.n.z - a.n.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      dx /= len; dz /= len;

      a.n.adj.push({ to: b.key, len });
      b.n.adj.push({ to: a.key, len });

      const idx = segments.length;
      segments.push({
        ax: a.n.x, az: a.n.z, bx: b.n.x, bz: b.n.z,
        dx, dz, len, a: a.key, b: b.key, bike,
      });

      // Insert into every grid cell the segment's bbox touches.
      const cx0 = Math.floor(Math.min(a.n.x, b.n.x) / CELL);
      const cx1 = Math.floor(Math.max(a.n.x, b.n.x) / CELL);
      const cz0 = Math.floor(Math.min(a.n.z, b.n.z) / CELL);
      const cz1 = Math.floor(Math.max(a.n.z, b.n.z) / CELL);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          const k = gk(cx, cz);
          (grid.get(k) ?? grid.set(k, []).get(k)).push(idx);
        }
      }
    }
  }

  // Nearest point on any rideable segment to (x, z). Searches the 3x3 cells
  // around the query (covers everything within one CELL); widens once if that
  // comes up empty. Returns null only far from the network.
  function nearestOnRoad(x, z) {
    let best = null;
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let ring = 1; ring <= 3; ring += 2) {
      const seen = new Set();
      for (let ix = cx - ring; ix <= cx + ring; ix++) {
        for (let iz = cz - ring; iz <= cz + ring; iz++) {
          const cell = grid.get(gk(ix, iz));
          if (!cell) continue;
          for (const si of cell) {
            if (seen.has(si)) continue;
            seen.add(si);
            const s = segments[si];
            // Project the point onto the segment, clamped to its extent.
            let t = ((x - s.ax) * s.dx + (z - s.az) * s.dz);
            t = Math.max(0, Math.min(s.len, t));
            const px = s.ax + s.dx * t;
            const pz = s.az + s.dz * t;
            const d = Math.hypot(x - px, z - pz);
            if (!best || d < best.dist) {
              best = { x: px, z: pz, dist: d, dx: s.dx, dz: s.dz, t, seg: s };
            }
          }
        }
      }
      if (best) break;
    }
    return best;
  }

  // --- A* over the node graph -----------------------------------------------

  // Tiny binary min-heap keyed on f-score; enough for a few-thousand-node graph.
  function heapPush(heap, item) {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= heap[i].f) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  }
  function heapPop(heap) {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].f < heap[m].f) m = l;
        if (r < heap.length && heap[r].f < heap[m].f) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  }

  // Route between two arbitrary world points. Both ends snap to the nearest
  // segment; A* runs endpoint-node to endpoint-node; the returned polyline is
  // [snapped start, ...graph nodes..., snapped end]. Null if disconnected.
  function route(sx, sz, tx, tz) {
    const start = nearestOnRoad(sx, sz);
    const goal = nearestOnRoad(tx, tz);
    if (!start || !goal) return null;

    const h = (key) => {
      const n = nodes.get(key);
      return Math.hypot(n.x - goal.x, n.z - goal.z);
    };

    // Seed with both endpoints of the snapped start segment, costed by the
    // along-segment distance from the snap point.
    const gScore = new Map();
    const cameFrom = new Map();
    const heap = [];
    const seed = [
      { key: start.seg.a, g: start.t },
      { key: start.seg.b, g: start.seg.len - start.t },
    ];
    for (const s of seed) {
      gScore.set(s.key, s.g);
      heapPush(heap, { key: s.key, f: s.g + h(s.key) });
    }

    // Either endpoint of the goal segment finishes the search.
    const goalKeys = new Set([goal.seg.a, goal.seg.b]);
    const closed = new Set();
    let found = null;

    while (heap.length) {
      const cur = heapPop(heap);
      if (closed.has(cur.key)) continue;
      closed.add(cur.key);
      if (goalKeys.has(cur.key)) { found = cur.key; break; }

      const node = nodes.get(cur.key);
      const g = gScore.get(cur.key);
      for (const e of node.adj) {
        if (closed.has(e.to)) continue;
        const ng = g + e.len;
        if (ng < (gScore.get(e.to) ?? Infinity)) {
          gScore.set(e.to, ng);
          cameFrom.set(e.to, cur.key);
          heapPush(heap, { key: e.to, f: ng + h(e.to) });
        }
      }
    }
    if (!found) return null;

    const keys = [found];
    while (cameFrom.has(keys[0])) keys.unshift(cameFrom.get(keys[0]));
    const pts = keys.map((k) => {
      const n = nodes.get(k);
      return { x: n.x, z: n.z };
    });
    pts.unshift({ x: start.x, z: start.z });
    pts.push({ x: goal.x, z: goal.z });
    return pts;
  }

  return { nodes, segments, nearestOnRoad, route };
}

// Total length of a route polyline in meters.
export function routeLength(pts) {
  let d = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    d += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
  }
  return d;
}
