// The delivery loop — Phase 3's whole point. Owns orders, routing, the timer,
// and the score; the rest of the game just renders what this reports.
//
// Flow: pick a real tagged address a sane ride away -> A* a route to it ->
// count down a timer derived from the route length -> detect arrival inside
// the drop radius -> score it -> short celebration -> next order. If the rider
// wanders off the route the "GPS" recalculates from wherever they are, so the
// arrow and route line always mean something.

import { DELIVERY } from '../config.js';
import { routeLength } from '../world/roadGraph.js';

// Flavor only — what you're allegedly carrying. Pure Williamsburg.
const CARGO = [
  'Bagels + lox', 'Chopped cheese', 'Cold brew, oat milk', 'Kosher takeout',
  'Natural wine', 'Two slices, well done', 'Matcha + croissant', 'Pierogi',
  'A single vinyl record', 'Babka, still warm', 'Vegan ramen', 'Seltzer, a case',
];

export function createDelivery({ addresses, roadGraph, onEvent }) {
  const state = {
    phase: 'idle',        // 'idle' | 'riding' | 'delivered'
    order: null,          // { label, name, cargo, x, z, dropX, dropZ }
    route: null,          // [{x,z}, ...] bike -> drop
    routeVersion: 0,      // bumped whenever `route` is replaced (for the ribbon)
    segIndex: 0,          // current segment of the route we're on
    segT: 0,              // progress 0..1 along that segment
    distLeft: 0,          // m remaining along the route
    timeLeft: 0,          // s on the order clock
    timeLimit: 0,
    score: 0,
    streak: 0,
    delivered: 0,
    expired: 0,
  };

  let celebration = 0;    // countdown to the next order after a delivery
  let rerouteCheck = 0;   // throttle for off-route detection

  const usable = addresses.filter((a) => roadGraph.nearestOnRoad(a.x, a.z));

  function newOrder(bx, bz) {
    // Try random addresses until one routes within the target distance band.
    // Relax the band if the cache/bbox is address-poor rather than spin forever.
    for (let relax = 0; relax < 3; relax++) {
      const minD = DELIVERY.minRouteDist / (relax + 1);
      const maxD = DELIVERY.maxRouteDist * (relax + 1);
      for (let tries = 0; tries < 25; tries++) {
        const addr = usable[Math.floor(Math.random() * usable.length)];
        if (!addr || addr === state.order?.addr) continue;
        const route = roadGraph.route(bx, bz, addr.x, addr.z);
        if (!route || route.length < 2) continue;
        const dist = routeLength(route);
        if (dist < minD || dist > maxD) continue;

        const drop = route[route.length - 1]; // road-snapped end of the route
        state.order = {
          addr,
          label: addr.label,
          name: addr.name,
          cargo: CARGO[Math.floor(Math.random() * CARGO.length)],
          x: addr.x, z: addr.z,
          dropX: drop.x, dropZ: drop.z,
        };
        setRoute(route);
        state.timeLimit = DELIVERY.baseTime + dist / DELIVERY.paceSpeed;
        state.timeLeft = state.timeLimit;
        state.phase = 'riding';
        onEvent?.('order', state.order);
        return true;
      }
    }
    return false; // no routable addresses at all — stay idle
  }

  function setRoute(route) {
    state.route = route;
    state.routeVersion++;
    state.segIndex = 0;
    state.segT = 0;
    state.distLeft = routeLength(route);
  }

  // Project the bike onto the current route, advance segment progress, and
  // return the perpendicular distance off the route (for reroute checks).
  function trackProgress(bx, bz) {
    const r = state.route;
    let best = { off: Infinity, seg: state.segIndex, t: 0 };
    // Only look a few segments around where we last were — routes don't teleport.
    const lo = Math.max(0, state.segIndex - 1);
    const hi = Math.min(r.length - 2, state.segIndex + 4);
    for (let i = lo; i <= hi; i++) {
      const ax = r[i].x, az = r[i].z;
      const dx = r[i + 1].x - ax, dz = r[i + 1].z - az;
      const len2 = dx * dx + dz * dz;
      const t = len2 ? Math.max(0, Math.min(1, ((bx - ax) * dx + (bz - az) * dz) / len2)) : 0;
      const px = ax + dx * t, pz = az + dz * t;
      const off = Math.hypot(bx - px, bz - pz);
      if (off < best.off) best = { off, seg: i, t };
    }
    state.segIndex = best.seg;
    state.segT = best.t;

    // Distance remaining: rest of the current segment + all following ones.
    let d = 0;
    const s = best.seg;
    d += Math.hypot(r[s + 1].x - r[s].x, r[s + 1].z - r[s].z) * (1 - best.t);
    for (let i = s + 1; i < r.length - 1; i++) {
      d += Math.hypot(r[i + 1].x - r[i].x, r[i + 1].z - r[i].z);
    }
    state.distLeft = d;
    return best.off;
  }

  // A point ~aheadM meters further along the route from current progress —
  // the nav arrow aims here so it points down the street, not through a wall.
  function aimPoint(aheadM = 18) {
    const r = state.route;
    if (!r) return null;
    let left = aheadM;
    for (let i = state.segIndex; i < r.length - 1; i++) {
      const dx = r[i + 1].x - r[i].x, dz = r[i + 1].z - r[i].z;
      const len = Math.hypot(dx, dz);
      // On the current segment, measure from the rider's projection, not the
      // segment start — otherwise long segments aim the arrow *behind* the bike.
      const t0 = i === state.segIndex ? state.segT : 0;
      const rem = len * (1 - t0);
      if (rem >= left) {
        const t = t0 + left / len;
        return { x: r[i].x + dx * t, z: r[i].z + dz * t };
      }
      left -= rem;
    }
    return r[r.length - 1];
  }

  function update(dt, bike) {
    if (state.phase === 'idle') {
      if (usable.length) newOrder(bike.x, bike.z);
      return state;
    }

    if (state.phase === 'delivered') {
      celebration -= dt;
      if (celebration <= 0) newOrder(bike.x, bike.z);
      return state;
    }

    // --- riding ---
    state.timeLeft -= dt;
    const off = trackProgress(bike.x, bike.z);

    // Arrived?
    const dDrop = Math.hypot(bike.x - state.order.dropX, bike.z - state.order.dropZ);
    if (dDrop <= DELIVERY.dropRadius) {
      const bonus = Math.max(0, Math.ceil(state.timeLeft * DELIVERY.timeBonusRate));
      state.streak += 1;
      const points = DELIVERY.baseScore + bonus + (state.streak - 1) * DELIVERY.streakBonus;
      state.score += points;
      state.delivered += 1;
      state.phase = 'delivered';
      celebration = DELIVERY.nextOrderDelay;
      onEvent?.('delivered', { points, bonus, streak: state.streak, order: state.order });
      return state;
    }

    // Blown the clock? Lose the streak, not the run — arcade, not punishment.
    if (state.timeLeft <= 0) {
      state.expired += 1;
      state.streak = 0;
      onEvent?.('expired', { order: state.order });
      state.phase = 'delivered'; // reuse the pause, then a fresh order
      celebration = DELIVERY.nextOrderDelay * 0.6;
      return state;
    }

    // Off the route: recalculate from here, like any bike GPS (throttled).
    rerouteCheck -= dt;
    if (off > DELIVERY.rerouteDist && rerouteCheck <= 0) {
      rerouteCheck = 1.0;
      const r = roadGraph.route(bike.x, bike.z, state.order.x, state.order.z);
      if (r && r.length >= 2) {
        setRoute(r);
        onEvent?.('reroute', {});
      }
    }

    return state;
  }

  // Style points from the street (near-misses, pigeons, trash) land on the
  // same score the deliveries feed — one number to brag about.
  function addScore(points) {
    state.score += points;
  }

  // Powerup hook: buy seconds on the active order (clamped to the limit so a
  // hoarded clock can't make an order *longer* than it started).
  function addTime(s) {
    if (state.phase !== 'riding') return;
    state.timeLeft = Math.min(state.timeLimit, state.timeLeft + s);
  }

  return { state, update, aimPoint, addScore, addTime };
}
