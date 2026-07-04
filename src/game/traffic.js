// The street fights back — Phase 4's dynamic obstacle layer.
//
// Two populations:
//   1. Route-anchored obstacles, reseeded on every new order: curated Brooklyn
//      hazards (lane blockers, doorings, phone pedestrians, trash mountains…)
//      placed procedurally *along the active route*, so every order is a
//      gauntlet but the placement still feels hand-set.
//   2. Roamers that live on the street graph permanently: cruising cars, a
//      school bus, and the salmon — a courier riding the wrong way down your
//      route, toward you.
//
// The system owns collision vs. the bike (circle colliders; hard hits call
// bikeCtl.crash(), soft ones slow and amuse), near-miss detection with a combo
// multiplier, the dooring trigger, the leash tripwire (hoppable), the pigeon
// scatter, drafting queries for the boost meter, and the bell (peds hustle out
// of the way when rung). Everything the game needs to know comes out as
// onEvent(type, data) — scoring and sound stay out of here.

import * as THREE from 'three';
import { TRAFFIC, WIPEOUT, CHAOS, ESCALATION, BAGEL } from '../config.js';
import {
  makeLaneBlocker, makeDoorCar, makeBus, makeTruck, makeCar,
  makePedestrian, makeDogWalker, makeSalmon, makeTrashPile, makePigeons,
  makeElder, makeGeyser,
} from '../entities/props.js';
import {
  makeSinkhole, makeLavaCrack, makeUFO, makeZombie, makeRubble,
  makePlane, makeExplosion, makeKaiju, makeBagel,
} from '../entities/apocalypse.js';
import {
  makeFan, makeCouchFire, makeMarcher, makeFloat, makeDrunk,
} from '../entities/streetparty.js';
import { CULTURE } from '../config.js';
import { PALETTE } from '../config.js';

// Free the GPU memory of a despawned prop (each order seeds fresh ones).
function disposeGroup(g) {
  g.traverse((o) => {
    if (o.isMesh || o.isLine) {
      o.geometry?.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    }
  });
}

// Cumulative-length index over a route polyline, for "point at distance d".
// Exported: the powerup seeder walks routes the same way.
export function routeIndex(route) {
  const cum = [0];
  for (let i = 1; i < route.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z));
  }
  const total = cum[cum.length - 1];
  function pointAt(d) {
    d = THREE.MathUtils.clamp(d, 0, total);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const segLen = cum[i] - cum[i - 1] || 1;
    const t = (d - cum[i - 1]) / segLen;
    const dx = (route[i].x - route[i - 1].x) / segLen;
    const dz = (route[i].z - route[i - 1].z) / segLen;
    return {
      x: route[i - 1].x + (route[i].x - route[i - 1].x) * t,
      z: route[i - 1].z + (route[i].z - route[i - 1].z) * t,
      dx, dz, // unit direction of travel along the route here
    };
  }
  return { pointAt, total };
}

// Heading that faces a unit direction (inverse of forward = (-sin h, -cos h)).
const headingOf = (dx, dz) => Math.atan2(-dx, -dz);

export function createTraffic({ scene, roadGraph, hydrants = [], onEvent }) {
  const group = new THREE.Group();
  group.name = 'traffic';
  scene.add(group);

  let entities = []; // route-anchored, cleared each order
  const roamers = [];  // persistent graph-followers
  let salmon = null;   // rides the active route the wrong way
  let routeIdx = null;
  let t = 0;

  // Chaos director: unscripted set pieces on their own lifecycle (they can
  // outlive an order — a hydrant doesn't stop erupting because you delivered).
  const setpieces = [];
  let chaosTimer = CHAOS.minInterval;

  // Escalation tier (set by the escalation director). Gates the apocalypse
  // spawn tables and wakes the sky-dwellers.
  let tier = 0;
  let ufo = null;    // the saucer, once tier permits
  let kaiju = null;  // the big fella, walking the horizon
  const bagels = []; // in-flight breakfast ordnance
  let playerDistNow = 0; // rider's progress along the route, for route-followers

  // Real intersections (3+ incident segments) — where the bus summit parks.
  const intersections = [...roadGraph.nodes.values()].filter((n) => n.adj.length >= 3);

  // Near-miss combo
  let combo = 0;
  let comboTimer = 0;

  // -------------------------------------------------------------------------
  // Entity plumbing
  // -------------------------------------------------------------------------
  //
  // Every entity: {
  //   label,            // toast text on contact
  //   group,            // THREE group, already positioned
  //   circles(),        // world colliders [{x, z, r}]
  //   hard,             // true: fast contact = wipeout. false: soft handler
  //   low,              // clearable with a bunny hop (bike y above lowY)
  //   lowY,             // air height that clears it
  //   tick(dt, bike),   // behavior + animation
  //   onPlow(bike),     // soft-contact handler (once); returns event data
  //   nm: { armed, cooldown }  // near-miss state
  // }

  function addEntity(e) {
    e.nm = { armed: false, cooldown: 0 };
    group.add(e.group);
    entities.push(e);
  }

  function clearEntities() {
    for (const e of entities) {
      e.dispose?.(); // crossers own meshes outside their placeholder group
      group.remove(e.group);
      disposeGroup(e.group);
    }
    entities = [];
    if (salmon) {
      group.remove(salmon.prop.group); // the salmon's mesh lives under .prop
      disposeGroup(salmon.prop.group);
      salmon = null;
    }
  }

  // -------------------------------------------------------------------------
  // Obstacle factories (behavior wrapped around the props)
  // -------------------------------------------------------------------------

  function spawnLaneBlocker(pt) {
    const prop = makeLaneBlocker();
    const h = headingOf(pt.dx, pt.dz);
    prop.group.position.set(pt.x, 0, pt.z);
    prop.group.rotation.y = h + (Math.random() - 0.5) * 0.3; // sloppily parked
    addEntity({
      label: 'CAR IN THE BIKE LANE',
      group: prop.group,
      hard: true,
      circles: () => [
        { x: pt.x - pt.dx * 1.3, z: pt.z - pt.dz * 1.3, r: 1.15 },
        { x: pt.x + pt.dx * 1.3, z: pt.z + pt.dz * 1.3, r: 1.15 },
      ],
      tick: () => prop.tick(t),
    });
  }

  function spawnDoorCar(pt) {
    const prop = makeDoorCar();
    const h = headingOf(pt.dx, pt.dz);
    // Curb-parked: shifted to the car's right so the driver door faces traffic.
    const cx = pt.x + Math.cos(h) * 2.3;
    const cz = pt.z - Math.sin(h) * 2.3;
    prop.group.position.set(cx, 0, cz);
    prop.group.rotation.y = h;
    let open = 0;       // 0..1 animated
    let opening = false;
    let cooldown = 0;
    const tip = new THREE.Vector3();
    addEntity({
      label: 'DOORED',
      group: prop.group,
      hard: true,
      circles() {
        const c = [
          { x: cx - pt.dx * 1.3, z: cz - pt.dz * 1.3, r: 1.1 },
          { x: cx + pt.dx * 1.3, z: cz + pt.dz * 1.3, r: 1.1 },
        ];
        if (open > 0.3) {
          prop.group.updateMatrixWorld();
          prop.doorTip(tip);
          c.push({ x: tip.x, z: tip.z, r: 0.75 });
        }
        return c;
      },
      tick(dt, bike) {
        cooldown = Math.max(0, cooldown - dt);
        if (!opening && cooldown === 0) {
          // Swing when the bike closes in from behind the parked car.
          const d = Math.hypot(bike.x - cx, bike.z - cz);
          const approaching = (bike.x - cx) * pt.dx + (bike.z - cz) * pt.dz < 0;
          if (d < 15 && d > 4 && approaching && Math.abs(bike.speed) > 4) {
            opening = true;
            onEvent?.('door', {});
          }
        }
        if (opening) {
          open = Math.min(1, open + dt * 3.2);
          if (open === 1) { opening = false; cooldown = 5; }
        } else if (open > 0 && cooldown < 2) {
          open = Math.max(0, open - dt * 1.2); // ease it shut for the next pass
        }
        prop.setDoor(open);
      },
    });
  }

  function spawnTruck(pt) {
    const prop = makeTruck();
    const h = headingOf(pt.dx, pt.dz) + 0.55; // angled mid-reverse across the lane
    prop.group.position.set(pt.x, 0, pt.z);
    prop.group.rotation.y = h;
    const fx = -Math.sin(h), fz = -Math.cos(h);
    let beep = 0;
    addEntity({
      label: 'BOX TRUCK',
      group: prop.group,
      hard: true,
      circles: () => [
        { x: pt.x + fx * 1.8, z: pt.z + fz * 1.8, r: 1.5 },
        { x: pt.x - fx * 1.6, z: pt.z - fz * 1.6, r: 1.5 },
      ],
      tick(dt, bike) {
        beep -= dt;
        if (beep <= 0 && Math.hypot(bike.x - pt.x, bike.z - pt.z) < 42) {
          beep = 1.2;
          onEvent?.('beep', {});
        }
      },
    });
  }

  function spawnTrash(pt) {
    const prop = makeTrashPile();
    prop.group.position.set(
      pt.x + (Math.random() - 0.5) * 2, 0, pt.z + (Math.random() - 0.5) * 2
    );
    let plowed = false;
    addEntity({
      label: 'TRASH DAY',
      group: prop.group,
      hard: false,
      low: true,
      lowY: 0.45, // a good hop sails over the pile
      circles: () => plowed ? [] : [
        { x: prop.group.position.x, z: prop.group.position.z, r: 1.3 },
      ],
      tick: (dt) => prop.tick(dt),
      onPlow() {
        if (plowed) return null;
        plowed = true;
        prop.burst();
        return { label: 'TRASH DAY', slow: 0.55, points: 10, text: 'BAG BLIZZARD +10' };
      },
    });
  }

  // A pedestrian (or a whole family) crossing mid-block. They ping-pong across
  // the street; the phone zombie stalls in the middle of the lane.
  function spawnCrossers(pt, style, count = 1) {
    const perpX = -pt.dz, perpZ = pt.dx; // across the street
    const span = 5.5; // curb-to-curb half width they wander
    const peds = [];
    for (let i = 0; i < count; i++) {
      // Groups crossing mid-block are the neighborhood's families — all of them.
      const p = makePedestrian(count > 1 ? 'hasidic' : style);
      group.add(p.group); // children of traffic group but posed in world coords
      peds.push({ prop: p, along: (i - (count - 1) / 2) * 0.9, phase: Math.random() * 2 });
    }
    let u = Math.random();          // 0..1 position across the street
    let dir = Math.random() < 0.5 ? 1 : -1;
    let pause = 0;
    let hustle = 0;                 // bell response: hurry to the nearest curb
    const speed = (style === 'phone' ? 0.55 : 0.8) / (span * 2) * (count > 1 ? 0.7 : 1);
    const label = count > 1 ? 'THE WHOLE FAMILY' : (style === 'phone' ? 'PHONE ZOMBIE' : 'JAYWALKER');

    const worldOf = (ped, uu) => ({
      x: pt.x + perpX * (uu * 2 - 1) * span + pt.dx * ped.along,
      z: pt.z + perpZ * (uu * 2 - 1) * span + pt.dz * ped.along,
    });

    addEntity({
      label,
      group: new THREE.Group(), // placeholder; real meshes were added above
      hard: true,
      peds, // kept so clearEntities can find them
      circles: () => peds.map((ped) => {
        const w = worldOf(ped, u);
        return { x: w.x, z: w.z, r: 0.55 };
      }),
      tick(dt) {
        hustle = Math.max(0, hustle - dt);
        if (pause > 0 && hustle === 0) {
          pause -= dt;
        } else {
          const mult = hustle > 0 ? 4 : 1;
          u += dir * speed * mult * dt * 60 * 0.016;
          if (u >= 1 || u <= 0) {
            u = THREE.MathUtils.clamp(u, 0, 1);
            dir *= -1;
            pause = 0.8 + Math.random() * 2.5;
          } else if (hustle === 0 && style === 'phone' && Math.abs(u - 0.5) < 0.04 && pause <= 0) {
            pause = 2.6; // dead stop in the middle of the lane, scrolling
          }
        }
        const moving = pause <= 0 || hustle > 0;
        for (const ped of peds) {
          const w = worldOf(ped, u);
          ped.prop.group.position.x = w.x;
          ped.prop.group.position.z = w.z;
          ped.prop.group.rotation.y = headingOf(perpX * dir, perpZ * dir);
          ped.prop.bob(t + ped.phase, moving);
        }
      },
      onBell(bike, radius = TRAFFIC.bellRadius) {
        const w = worldOf(peds[0], u);
        if (Math.hypot(bike.x - w.x, bike.z - w.z) < radius) {
          hustle = 2;
          dir = u > 0.5 ? 1 : -1; // nearest curb
          pause = 0;
          return true;
        }
        return false;
      },
      dispose() {
        for (const ped of peds) {
          group.remove(ped.prop.group);
          disposeGroup(ped.prop.group);
        }
      },
    });
  }

  // Dog walker: owner near the curb, dog roaming toward the middle of the
  // street, taut leash between them. The leash is the trap — duck it (no) or
  // hop it (yes).
  function spawnDogWalker(pt) {
    const prop = makeDogWalker();
    const perpX = -pt.dz, perpZ = pt.dx;
    const ox = pt.x + perpX * 3.4, oz = pt.z + perpZ * 3.4; // owner by the curb
    prop.group.position.set(ox, 0, oz);
    prop.group.rotation.y = headingOf(-perpX, -perpZ); // facing the street
    addEntity({
      label: 'THE LEASH',
      group: prop.group,
      hard: true,
      low: true,
      lowY: 0.35, // any real hop clears a leash
      // Owner + dog are point colliders; the leash is checked separately below.
      leash: true,
      circles() {
        const d = prop.dog.position;
        // dog position is local to the (rotated) group — get world.
        prop.group.updateMatrixWorld();
        const dw = prop.group.localToWorld(new THREE.Vector3(d.x, 0, d.z));
        return [
          { x: ox, z: oz, r: 0.5 },
          { x: dw.x, z: dw.z, r: 0.45, stop: 'ALMOST HIT THE DOG' },
        ];
      },
      // Endpoints of the leash for the line-collider check.
      leashSeg() {
        prop.group.updateMatrixWorld();
        const d = prop.dog.position;
        const dw = prop.group.localToWorld(new THREE.Vector3(d.x, 0, d.z));
        return { ax: ox, az: oz, bx: dw.x, bz: dw.z };
      },
      tick(dt) {
        // Dog meanders into the street and back, local -Z is "into the street".
        const reach = 3.2 + Math.sin(t * 0.7) * 2.6;
        prop.dog.position.set(Math.sin(t * 1.3) * 0.8, 0, -reach);
        prop.dog.rotation.y = Math.sin(t * 1.3) * 0.5;
        prop.bob(t, false);
        prop.tick(t);
      },
    });
  }

  function spawnPigeons(pt) {
    const prop = makePigeons(7 + (Math.random() * 4 | 0));
    prop.group.position.set(pt.x, 0.05, pt.z);
    addEntity({
      label: 'PIGEONS',
      group: prop.group,
      hard: false,
      circles: () => [], // never a collider — pure reward
      tick(dt, bike) {
        prop.tick(dt, t);
        if (!prop.scattered) {
          const d = Math.hypot(bike.x - pt.x, bike.z - pt.z);
          if (d < 4.5 && Math.abs(bike.speed) > 3) {
            const n = prop.scatter();
            if (n) onEvent?.('pigeons', { count: n, points: n * TRAFFIC.pigeonPoints });
          }
        }
      },
      onBell(bike, radius = TRAFFIC.bellRadius + 4) {
        if (!prop.scattered &&
            Math.hypot(bike.x - pt.x, bike.z - pt.z) < radius) {
          const n = prop.scatter();
          if (n) onEvent?.('pigeons', { count: n, points: n * TRAFFIC.pigeonPoints });
          return true;
        }
        return false;
      },
    });
  }

  // The summit: a lettered school bus dead across an intersection on your
  // route, elders out front settling something important. The bus is not
  // moving. The bell changes nothing.
  function spawnSummit() {
    if (!routeIdx || !intersections.length) return;
    // First intersection the route actually passes through, past the opening
    // stretch — scanning by distance keeps it on the ride, not off in a yard.
    let spot = null;
    for (let d = Math.max(50, routeIdx.total * 0.3); d < routeIdx.total - 40; d += 12) {
      const pt = routeIdx.pointAt(d);
      for (const n of intersections) {
        if (Math.hypot(n.x - pt.x, n.z - pt.z) < 10) { spot = { n, pt }; break; }
      }
      if (spot) break;
    }
    if (!spot) return;

    const { n, pt } = spot;
    const bus = makeBus({ lettered: true });
    const h = headingOf(pt.dx, pt.dz) + 1.1; // diagonal across the box
    bus.group.position.set(n.x, 0, n.z);
    bus.group.rotation.y = h;
    const fx = -Math.sin(h), fz = -Math.cos(h);

    // The debate happens by the bus door, on the route side.
    const cx = n.x - pt.dx * 5.5, cz = n.z - pt.dz * 5.5;
    const elders = [];
    const count = 2 + (Math.random() * 2 | 0);
    for (let i = 0; i < count; i++) {
      const e = makeElder();
      const a = (i / count) * Math.PI * 2 + 0.6;
      const ex = cx + Math.cos(a) * 1.05, ez = cz + Math.sin(a) * 1.05;
      e.group.position.set(ex, 0, ez);
      e.group.rotation.y = headingOf(cx - ex, cz - ez); // face the huddle
      group.add(e.group);
      elders.push({ prop: e, x: ex, z: ez, phase: Math.random() * 7 });
    }

    let argueIn = 1.5; // first mutter shortly after you're in earshot
    let bellIn = 0;
    addEntity({
      label: 'THE DOUBLE-PARKED BUS',
      group: bus.group,
      hard: true,
      circles: () => [-3.2, 0, 3.2].map((o) => ({
        x: n.x + fx * o, z: n.z + fz * o, r: 1.5,
      })),
      tick(dt, bike) {
        argueIn -= dt;
        bellIn = Math.max(0, bellIn - dt);
        for (const e of elders) e.prop.argue(t, e.phase);
        if (argueIn <= 0 &&
            Math.hypot(bike.x - cx, bike.z - cz) < CHAOS.argueRadius) {
          argueIn = 4 + Math.random() * 3;
          onEvent?.('argue', {});
        }
      },
      onBell(bike, radius = TRAFFIC.bellRadius + 8) {
        if (bellIn === 0 &&
            Math.hypot(bike.x - cx, bike.z - cz) < radius) {
          bellIn = 6;
          onEvent?.('summit', {}); // they heard you. they do not care.
          return true;
        }
        return false;
      },
      dispose() {
        for (const e of elders) {
          group.remove(e.prop.group);
          disposeGroup(e.prop.group);
        }
      },
    });

    // The elders are their own near-missable entity — separate label, and the
    // collision is a dead-stop bump, not a wipeout. You do not run them over.
    addEntity({
      label: 'THE DEBATE',
      group: new THREE.Group(),
      hard: true,
      circles: () => elders.map((e) => ({ x: e.x, z: e.z, r: 0.55, stop: 'WATCH THE ELDERS' })),
      tick() {},
    });
  }

  // -------------------------------------------------------------------------
  // The apocalypse spawn table (tier-gated, seeded on the route like the rest)
  // -------------------------------------------------------------------------

  // A sinkhole sleeps under the asphalt until you're close, then opens with a
  // rumble. Ride in (on the ground, fully open) and Brooklyn swallows you.
  function spawnSinkhole(pt) {
    const prop = makeSinkhole();
    const hx = pt.x + (Math.random() - 0.5) * 2;
    const hz = pt.z + (Math.random() - 0.5) * 2;
    prop.group.position.set(hx, 0, hz);
    prop.setOpen(0);
    let open = 0;
    let rumbled = false;
    addEntity({
      label: 'SINKHOLE',
      group: prop.group,
      hard: false,
      circles: () => [], // it's a hole, not a wall — near-misses don't apply
      tick(dt, bike) {
        prop.tick(dt, t);
        const d = Math.hypot(bike.x - hx, bike.z - hz);
        if (!rumbled && d < 30) {
          rumbled = true;
          onEvent?.('rumble', {});
        }
        if (rumbled && open < 1) {
          open = Math.min(1, open + dt * 1.4);
          prop.setOpen(open);
        }
      },
      hazard(bike, bikeCtl) {
        if (open > 0.8 && bike.y < 0.35 &&
            Math.hypot(bike.x - hx, bike.z - hz) < 1.9) {
          if (bikeCtl.crash()) {
            combo = 0;
            onEvent?.('crash', { label: 'SWALLOWED BY BROOKLYN' });
          }
          // Fished out at the rim, facing whatever direction fate chose.
          const a = Math.random() * Math.PI * 2;
          bike.x = hx + Math.cos(a) * 3.2;
          bike.z = hz + Math.sin(a) * 3.2;
        }
      },
    });
  }

  // A pack of the hungry dead. They mill around their block until you're in
  // scent range, then shamble at you. Plow through fast for points; roll up
  // slow and they grab. A well-thrown bagel settles them for a while.
  function spawnZombiePack(pt) {
    const count = 4 + (Math.random() * 3 | 0);
    const zombies = [];
    for (let i = 0; i < count; i++) {
      const prop = makeZombie();
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 4;
      const z = {
        prop,
        x: pt.x + Math.cos(a) * r,
        z: pt.z + Math.sin(a) * r,
        phase: Math.random() * 9,
        stun: 0,
        grabCd: 0,
      };
      prop.group.position.set(z.x, 0, z.z);
      group.add(prop.group);
      zombies.push(z);
    }
    let groanIn = 1;
    addEntity({
      label: 'THE HORDE',
      group: new THREE.Group(),
      hard: false,
      zombies, // the bagel system aims at these
      circles: () => zombies.filter((z) => z.stun <= 0)
        .map((z) => ({ x: z.x, z: z.z, r: 0.5 })),
      tick(dt, bike) {
        groanIn -= dt;
        const dPack = Math.hypot(bike.x - pt.x, bike.z - pt.z);
        if (groanIn <= 0 && dPack < 35) {
          groanIn = 3 + Math.random() * 3;
          onEvent?.('groan', {});
        }
        for (const z of zombies) {
          z.stun = Math.max(0, z.stun - dt);
          z.grabCd = Math.max(0, z.grabCd - dt);
          if (z.stun > 0) {
            // Face-down on the asphalt, sleeping it off.
            z.prop.group.rotation.x = Math.min(1.5, z.prop.group.rotation.x + dt * 8);
            continue;
          }
          z.prop.group.rotation.x = Math.max(0, z.prop.group.rotation.x - dt * 4);
          const dx = bike.x - z.x, dz = bike.z - z.z;
          const d = Math.hypot(dx, dz);
          if (d < 38 && d > 0.8) {
            const sp = 1.15 * dt;
            z.x += (dx / d) * sp;
            z.z += (dz / d) * sp;
            z.prop.group.rotation.y = Math.atan2(-dx / d, -dz / d);
          }
          z.prop.group.position.set(z.x, 0, z.z);
          z.prop.shamble(t, z.phase);
        }
      },
      hazard(bike, bikeCtl) {
        for (const z of zombies) {
          if (z.stun > 0 || z.grabCd > 0) continue;
          if (Math.hypot(bike.x - z.x, bike.z - z.z) < 0.9) {
            if (Math.abs(bike.speed) > 8) {
              z.stun = 5;
              onEvent?.('soft', { points: 10, text: 'BOWLED OVER +10' });
            } else {
              z.grabCd = 1.2;
              bike.speed *= 0.3;
              onEvent?.('bump', { label: 'GRABBED — PEDAL!' });
            }
          }
        }
      },
      dispose() {
        for (const z of zombies) {
          group.remove(z.prop.group);
          disposeGroup(z.prop.group);
        }
      },
    });
  }

  // Armageddon plumbing: a lava fissure across the street. Hop it or lose
  // your momentum (and your dignity) riding through.
  function spawnLavaCrack(pt) {
    const prop = makeLavaCrack();
    prop.group.position.set(pt.x, 0, pt.z);
    prop.group.rotation.y = headingOf(pt.dx, pt.dz) + Math.PI / 2; // across the road
    const fx = -Math.sin(prop.group.rotation.y), fz = -Math.cos(prop.group.rotation.y);
    let burnCd = 0;
    addEntity({
      label: 'LAVA',
      group: prop.group,
      hard: false,
      low: true,
      lowY: 0.3, // any hop clears a crack in the ground
      circles: () => [-2.4, 0, 2.4].map((o) => ({
        x: pt.x + fx * o, z: pt.z + fz * o, r: 0.9,
      })),
      tick(dt) {
        burnCd = Math.max(0, burnCd - dt);
        prop.tick(dt, t);
      },
      onPlow() {
        if (burnCd > 0) return null;
        burnCd = 1.5;
        return { slow: 0.45, text: 'TOASTED' };
      },
    });
  }

  // -------------------------------------------------------------------------
  // The neighborhood, turned up (Phase 6.5)
  // -------------------------------------------------------------------------

  // Neighbors out for a stroll: a pair pacing a stretch of sidewalk, deep in
  // conversation. Pass close and you catch the humming — a niggun, mostly to
  // himself. They're not obstacles unless you ride the sidewalk. So don't.
  function spawnStrollers(pt) {
    const perpX = -pt.dz, perpZ = pt.dx;
    const side = Math.random() < 0.5 ? 1 : -1;
    const ox = pt.x + perpX * side * 4.6, oz = pt.z + perpZ * side * 4.6;
    const peds = [];
    for (let i = 0; i < 2; i++) {
      const p = makePedestrian('hasidic');
      group.add(p.group);
      peds.push({ prop: p, off: i * 0.8 - 0.4, phase: Math.random() * 5 });
    }
    let u = Math.random(); // position along their 16m stretch
    let dir = 1;
    let humIn = 1 + Math.random() * 3;
    addEntity({
      label: 'THE NEIGHBORS',
      group: new THREE.Group(),
      hard: true,
      circles: () => peds.map((p) => ({
        x: p.wx ?? ox, z: p.wz ?? oz, r: 0.5, stop: 'EXCUSE YOU',
      })),
      tick(dt, bike) {
        u += dir * dt * 0.045; // an unhurried pace
        if (u > 1 || u < 0) { u = THREE.MathUtils.clamp(u, 0, 1); dir *= -1; }
        for (const p of peds) {
          p.wx = ox + pt.dx * ((u * 2 - 1) * 8 + p.off);
          p.wz = oz + pt.dz * ((u * 2 - 1) * 8 + p.off);
          p.prop.group.position.set(p.wx, 0, p.wz);
          p.prop.group.rotation.y = headingOf(pt.dx * dir, pt.dz * dir);
          p.prop.bob(t + p.phase, true);
        }
        humIn -= dt;
        if (humIn <= 0 &&
            Math.hypot(bike.x - (peds[0].wx ?? ox), bike.z - (peds[0].wz ?? oz)) < CULTURE.nigunRadius) {
          humIn = 7 + Math.random() * 5;
          onEvent?.('nigun', {});
        }
      },
      dispose() {
        for (const p of peds) {
          group.remove(p.prop.group);
          disposeGroup(p.prop.group);
        }
      },
    });
  }

  // One guy having a very large night, using the bike lane as a hallway.
  // He weaves from the parked cars to the middle of the lane and back —
  // near-miss gold, dead-stop bump if you clip him. He's fine. He's fine.
  function spawnDrunk(pt) {
    const prop = makeDrunk();
    group.add(prop.group);
    const perpX = -pt.dz, perpZ = pt.dx;
    let along = 0;
    let hicIn = 2;
    let wx = pt.x, wz = pt.z;
    addEntity({
      label: 'THE DRUNK',
      group: prop.group,
      hard: true,
      circles: () => [{ x: wx, z: wz, r: 0.5, stop: "HE'S FINE" }],
      tick(dt, bike) {
        along += dt * 0.55; // making progress, technically
        const drift = 3.2 - Math.abs(Math.sin(t * 0.35)) * 3.4; // curb ↔ mid-lane
        const d = Math.sin(along * 0.4) * 7;
        wx = pt.x + pt.dx * d + perpX * drift;
        wz = pt.z + pt.dz * d + perpZ * drift;
        prop.group.position.set(wx, 0, wz);
        prop.group.rotation.y = headingOf(pt.dx, pt.dz) + Math.sin(t * 0.8) * 0.6;
        prop.stumble(t, 0);
        hicIn -= dt;
        if (hicIn <= 0 && Math.hypot(bike.x - wx, bike.z - wz) < 14) {
          hicIn = 4 + Math.random() * 4;
          onEvent?.('hiccup', {});
        }
      },
    });
  }

  // The parade crosses your route: a float and a column of marchers with
  // flags, sweeping back and forth across the block. Thread the gaps for
  // near-misses; the float itself is a vehicle, treat it like one.
  function spawnParade(pt) {
    const perpX = -pt.dz, perpZ = pt.dx; // parade axis = across your street
    const span = 14;
    const marchers = [];
    for (let i = 0; i < CULTURE.paradeSize; i++) {
      const m = makeMarcher();
      group.add(m.group);
      marchers.push({
        prop: m,
        off: (i / CULTURE.paradeSize - 0.5) * 10 + (Math.random() - 0.5),
        lat: (Math.random() - 0.5) * 2.4,
        phase: Math.random() * 6,
        wx: pt.x, wz: pt.z,
      });
    }
    const float = makeFloat();
    group.add(float.group);
    let u = Math.random();
    let dir = 1;
    let partyIn = 1;
    const floatPos = { x: pt.x, z: pt.z };

    addEntity({
      label: 'THE PARADE',
      group: new THREE.Group(),
      hard: true,
      circles() {
        const c = marchers.map((m) => ({ x: m.wx, z: m.wz, r: 0.5, stop: 'IT\'S A PARADE' }));
        const fh = headingOf(perpX * dir, perpZ * dir);
        const ffx = -Math.sin(fh), ffz = -Math.cos(fh);
        for (const o of [-1.6, 1.6]) {
          c.push({ x: floatPos.x + ffx * o, z: floatPos.z + ffz * o, r: 1.4 });
        }
        return c;
      },
      tick(dt, bike) {
        u += dir * dt * 0.06;
        if (u > 1 || u < 0) { u = THREE.MathUtils.clamp(u, 0, 1); dir *= -1; }
        const head = (u * 2 - 1) * span;
        // Float leads the column…
        floatPos.x = pt.x + perpX * (head + dir * 6);
        floatPos.z = pt.z + perpZ * (head + dir * 6);
        float.group.position.set(floatPos.x, 0, floatPos.z);
        float.group.rotation.y = headingOf(perpX * dir, perpZ * dir);
        float.tick(dt, t);
        // …the marchers follow, loosely.
        for (const m of marchers) {
          m.wx = pt.x + perpX * (head + m.off) + pt.dx * m.lat;
          m.wz = pt.z + perpZ * (head + m.off) + pt.dz * m.lat;
          m.prop.group.position.set(m.wx, 0, m.wz);
          m.prop.group.rotation.y = headingOf(perpX * dir, perpZ * dir);
          m.prop.march(t, m.phase);
        }
        partyIn -= dt;
        if (partyIn <= 0 && Math.hypot(bike.x - pt.x, bike.z - pt.z) < 32) {
          partyIn = 5 + Math.random() * 4;
          onEvent?.('party', {});
        }
      },
      dispose() {
        for (const m of marchers) {
          group.remove(m.prop.group);
          disposeGroup(m.prop.group);
        }
        group.remove(float.group);
        disposeGroup(float.group);
      },
    });
  }

  // The Knicks finally did it, and this block is where everyone went. Fans
  // flooding the street, a couch already on fire. Set piece, not seeded:
  // the chaos director throws these parties near the player.
  function spawnRiot(bike) {
    const near = roadGraph.nearestOnRoad(
      bike.x + (Math.random() - 0.5) * 130,
      bike.z + (Math.random() - 0.5) * 130
    );
    if (!near || Math.hypot(near.x - bike.x, near.z - bike.z) < 25) return;

    const fans = [];
    for (let i = 0; i < CULTURE.riotFans; i++) {
      const f = makeFan();
      const wx = near.x + near.dx * (Math.random() - 0.5) * 22 + -near.dz * (Math.random() - 0.5) * 7;
      const wz = near.z + near.dz * (Math.random() - 0.5) * 22 + near.dx * (Math.random() - 0.5) * 7;
      f.group.position.set(wx, 0, wz);
      f.group.rotation.y = Math.random() * Math.PI * 2;
      group.add(f.group);
      fans.push({ prop: f, x: wx, z: wz, phase: Math.random() * 8 });
    }
    const couch = makeCouchFire();
    couch.group.position.set(near.x, 0, near.z);
    couch.group.rotation.y = Math.random() * Math.PI;
    group.add(couch.group);

    let chantIn = 0.5;
    setpieces.push({
      phase: 'crashed', // reuse the lifecycle: crashed + life = countdown
      hard: true,
      label: 'THE CELEBRATION',
      nm: { armed: false, cooldown: 0 },
      life: CULTURE.riotLife,
      fans, couch,
      circles() {
        const c = fans.map((f) => ({ x: f.x, z: f.z, r: 0.5, stop: 'GO KNICKS' }));
        c.push({ x: near.x, z: near.z, r: 1.2 }); // the couch is furniture, furniture is hard
        return c;
      },
      tick(dt, bike2) {
        this.life -= dt;
        couch.tick(dt, t);
        for (const f of fans) f.prop.celebrate(t, f.phase);
        chantIn -= dt;
        if (chantIn <= 0 && Math.hypot(bike2.x - near.x, bike2.z - near.z) < 38) {
          chantIn = 3 + Math.random() * 2.5;
          onEvent?.('chant', {});
        }
      },
      dispose() {
        for (const f of fans) {
          group.remove(f.prop.group);
          disposeGroup(f.prop.group);
        }
        group.remove(couch.group);
        disposeGroup(couch.group);
      },
    });
  }

  // Oncoming traffic: cars driving your route the wrong way, at you. The
  // salmon's four-wheeled cousins. Seeded per order, respawn up-route.
  function seedOncoming(count) {
    for (let i = 0; i < count; i++) {
      if (!routeIdx || routeIdx.total < 150) return;
      const prop = makeCar(PALETTE.carColors[(Math.random() * PALETTE.carColors.length) | 0]);
      group.add(prop.group);
      let hornIn = 0;
      const e = {
        label: 'ONCOMING TRAFFIC',
        group: prop.group,
        hard: true,
        dist: Math.min(routeIdx.total - 15, 120 + i * 90),
        pos: { x: 0, z: 0, h: 0 },
        circles() {
          const fx = -Math.sin(this.pos.h), fz = -Math.cos(this.pos.h);
          return [-1.2, 1.2].map((o) => ({
            x: this.pos.x + fx * o, z: this.pos.z + fz * o, r: 1.05,
          }));
        },
        tick(dt, bike) {
          this.dist -= 7.5 * dt;
          if (this.dist < playerDistNow - 30) {
            this.dist = Math.min(routeIdx.total - 10, playerDistNow + 110 + Math.random() * 60);
          }
          const p = routeIdx.pointAt(this.dist);
          // Keep to their side of the street — mostly.
          const lane = 1.8 + Math.sin(t * 0.9 + i * 3) * 0.7;
          this.pos.x = p.x + -p.dz * lane;
          this.pos.z = p.z + p.dx * lane;
          this.pos.h = headingOf(-p.dx, -p.dz);
          prop.group.position.set(this.pos.x, 0, this.pos.z);
          prop.group.rotation.y = this.pos.h;
          hornIn = Math.max(0, hornIn - dt);
          if (hornIn === 0 && Math.hypot(bike.x - this.pos.x, bike.z - this.pos.z) < 15) {
            hornIn = 3;
            onEvent?.('horn', {});
          }
        },
      };
      addEntity(e);
    }
  }

  // Chaos director: a car loses it, jumps the curb, and opens a hydrant.
  function spawnHydrantCrash(bike) {
    // A hydrant at dramatic-but-visible range, reachable from a road.
    const [minR, maxR] = CHAOS.hydrantRange;
    const candidates = hydrants.filter((hd) => {
      const d = Math.hypot(hd.x - bike.x, hd.z - bike.z);
      return d > minR && d < maxR;
    });
    while (candidates.length) {
      const i = (Math.random() * candidates.length) | 0;
      const hd = candidates.splice(i, 1)[0];
      const near = roadGraph.nearestOnRoad(hd.x, hd.z);
      if (!near || near.dist > 18) continue;

      const prop = makeLaneBlocker(); // hazards already blinking — fitting
      // Launch from up the road so it visibly careens off it.
      const sx = near.x + near.dx * 26, sz = near.z + near.dz * 26;
      prop.group.position.set(sx, 0, sz);
      group.add(prop.group);

      const sp = {
        phase: 'driving',
        hard: true, // it's a car, even mid-catastrophe
        car: prop,
        geyser: null,
        x: sx, z: sz,
        life: CHAOS.geyserLife,
        shower: 0,
        label: 'RUNAWAY CAR',
        nm: { armed: false, cooldown: 0 },
        circles() {
          const h = this.car.group.rotation.y;
          const fx2 = -Math.sin(h), fz2 = -Math.cos(h);
          return [-1.2, 1.2].map((o) => ({
            x: this.x + fx2 * o, z: this.z + fz2 * o, r: 1.1,
          }));
        },
        tick(dt, bike2) {
          this.car.tick(t);
          if (this.phase === 'driving') {
            const dx = hd.x - this.x, dz = hd.z - this.z;
            const d = Math.hypot(dx, dz);
            if (d < 1.4) {
              this.phase = 'crashed';
              this.car.group.rotation.y += 0.4; // slewed to a stop
              this.car.group.rotation.z = 0.13; // one wheel on the curb
              const g = makeGeyser();
              g.group.position.set(hd.x, 0, hd.z);
              group.add(g.group);
              this.geyser = g;
              onEvent?.('hydrant', {});
            } else {
              const step = CHAOS.runawaySpeed * dt;
              this.x += (dx / d) * step;
              this.z += (dz / d) * step;
              this.car.group.position.set(this.x, 0, this.z);
              this.car.group.rotation.y =
                headingOf(dx / d, dz / d) + Math.sin(t * 9) * 0.18; // fishtailing
            }
            return;
          }
          // Erupting: count down, and reward anyone riding the spray.
          this.life -= dt;
          this.geyser?.tick(dt, t);
          this.shower = Math.max(0, this.shower - dt);
          if (this.shower === 0 && Math.abs(bike2.speed) > 2 &&
              Math.hypot(bike2.x - hd.x, bike2.z - hd.z) < 1.9) {
            this.shower = 3;
            onEvent?.('soft', { points: CHAOS.showerPoints, text: `SHOWERED +${CHAOS.showerPoints}` });
          }
        },
      };
      setpieces.push(sp);
      onEvent?.('skid', {});
      return;
    }
  }

  // -------------------------------------------------------------------------
  // Roamers: vehicles that cruise the street graph forever
  // -------------------------------------------------------------------------

  const nodeKeys = [...roadGraph.nodes.keys()];

  function randomNode() {
    return nodeKeys[(Math.random() * nodeKeys.length) | 0];
  }

  function makeRoamer(kind) {
    const prop = kind === 'bus'
      ? makeBus()
      : makeCar(PALETTE.carColors[(Math.random() * PALETTE.carColors.length) | 0]);
    group.add(prop.group);
    let fromKey = randomNode();
    const fromNode = roadGraph.nodes.get(fromKey);
    let toKey = fromNode.adj.length ? fromNode.adj[(Math.random() * fromNode.adj.length) | 0].to : fromKey;
    let along = 0;
    const speed = kind === 'bus' ? 4.5 : 6.5;
    let horn = 0;

    return {
      kind,
      prop,
      speed,
      state: { x: fromNode.x, z: fromNode.z, heading: 0 },
      update(dt, bike) {
        const a = roadGraph.nodes.get(fromKey);
        const b = roadGraph.nodes.get(toKey);
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        along += speed * dt;
        if (along >= len) {
          along -= len;
          // Next segment: any neighbor except straight back (unless dead end).
          const options = b.adj.filter((e) => e.to !== fromKey);
          const pick = (options.length ? options : b.adj)[(Math.random() * (options.length ? options.length : b.adj.length)) | 0];
          fromKey = toKey;
          toKey = pick ? pick.to : fromKey;
        }
        const t01 = along / len;
        const x = a.x + (b.x - a.x) * t01;
        const z = a.z + (b.z - a.z) * t01;
        const h = headingOf((b.x - a.x) / len, (b.z - a.z) / len);
        this.state.x = x; this.state.z = z; this.state.heading = h;
        prop.group.position.set(x, 0, z);
        prop.group.rotation.y = h;

        // Bus leans on the horn when the player is dawdling in front of it.
        horn = Math.max(0, horn - dt);
        if (kind === 'bus' && horn === 0) {
          const fx = -Math.sin(h), fz = -Math.cos(h);
          const rx = bike.x - x, rz = bike.z - z;
          const aheadDist = rx * fx + rz * fz;
          const lateral = Math.abs(rx * -fz + rz * fx);
          if (aheadDist > 2 && aheadDist < 14 && lateral < 3) {
            horn = 2.5;
            onEvent?.('horn', {});
          }
        }
      },
      circles() {
        const h = this.state.heading;
        const fx = -Math.sin(h), fz = -Math.cos(h);
        if (kind === 'bus') {
          return [-3.2, 0, 3.2].map((o) => ({
            x: this.state.x + fx * o, z: this.state.z + fz * o, r: 1.5,
          }));
        }
        return [-1.2, 1.2].map((o) => ({
          x: this.state.x + fx * o, z: this.state.z + fz * o, r: 1.1,
        }));
      },
      label: kind === 'bus' ? 'SCHOOL BUS' : 'TRAFFIC',
      nm: { armed: false, cooldown: 0 },
    };
  }

  for (let i = 0; i < TRAFFIC.roamingCars; i++) roamers.push(makeRoamer('car'));
  for (let i = 0; i < TRAFFIC.roamingBuses; i++) roamers.push(makeRoamer('bus'));

  // The salmon rides the player's own route, the wrong way, weaving.
  function seedSalmon() {
    if (!routeIdx || routeIdx.total < 120) return;
    const prop = makeSalmon();
    group.add(prop.group);
    salmon = {
      prop,
      dist: Math.min(routeIdx.total - 20, 95), // starts up the road, coming at you
      label: 'SALMON COURIER',
      nm: { armed: false, cooldown: 0 },
      circles() {
        return [{ x: prop.group.position.x, z: prop.group.position.z, r: 0.8 }];
      },
      update(dt, bike, playerRouteDist) {
        this.dist -= 6.2 * dt; // riding toward the player = down-route
        if (this.dist < playerRouteDist - 25) {
          // Passed you; respawn up ahead for another pass.
          this.dist = Math.min(routeIdx.total - 10, playerRouteDist + 80 + Math.random() * 40);
        }
        const p = routeIdx.pointAt(this.dist);
        const weave = Math.sin(t * 2.2) * 0.9;
        prop.group.position.set(p.x + -p.dz * weave, 0, p.z + p.dx * weave);
        prop.group.rotation.y = headingOf(-p.dx, -p.dz); // facing DOWN the route
      },
    };
  }

  // -------------------------------------------------------------------------
  // Sky-dwellers (tier-gated roamers with their own rules)
  // -------------------------------------------------------------------------

  // The saucer cruises above the streets. Spot a slow rider and it locks on:
  // beam down, gentle lift. Get above ~5.5m and it loses interest — the drop
  // is your problem. Counterplay: stay fast, it can't hold a moving target.
  function wakeUFO() {
    const prop = makeUFO();
    group.add(prop.group);
    let nodeKey = randomNode();
    let target = roadGraph.nodes.get(nodeKey);
    let hum = 0;
    let cooldown = 0;
    ufo = {
      prop,
      x: target.x, z: target.z,
      state: 'cruise', // 'cruise' | 'beam'
      update(dt, bike) {
        hum = Math.max(0, hum - dt);
        cooldown = Math.max(0, cooldown - dt);
        const dBike = Math.hypot(bike.x - this.x, bike.z - this.z);

        if (this.state === 'cruise') {
          prop.setBeam(false);
          // Drift node to node like everyone else, just higher and smugger.
          const dx = target.x - this.x, dz = target.z - this.z;
          const d = Math.hypot(dx, dz);
          if (d < 3) {
            const n = roadGraph.nodes.get(nodeKey);
            const pick = n.adj[(Math.random() * n.adj.length) | 0];
            if (pick) { nodeKey = pick.to; target = roadGraph.nodes.get(nodeKey); }
          } else {
            this.x += (dx / d) * 9 * dt;
            this.z += (dz / d) * 9 * dt;
          }
          if (cooldown === 0 && dBike < 14 && Math.abs(bike.speed) < 9 && bike.wipeout === 0) {
            this.state = 'beam';
            onEvent?.('ufo', {});
          }
        } else {
          // Locked on: hover to directly overhead and pull.
          prop.setBeam(true);
          if (hum === 0) { hum = 1.6; onEvent?.('ufo', {}); }
          const dx = bike.x - this.x, dz = bike.z - this.z;
          const d = Math.hypot(dx, dz);
          this.x += dx * Math.min(1, dt * 2.2);
          this.z += dz * Math.min(1, dt * 2.2);
          if (d < 3.5) {
            bike.vy = Math.max(bike.vy, 2.4); // the lift — fight it with speed
          }
          const escaped = Math.abs(bike.speed) > 11 || d > 18;
          if (bike.y > 5.5) {
            // High enough. Bored now.
            this.state = 'cruise';
            cooldown = 8;
            onEvent?.('dropped', {});
          } else if (escaped || bike.wipeout > 0) {
            this.state = 'cruise';
            cooldown = 5;
          }
        }
        prop.group.position.set(this.x, 16, this.z);
        prop.tick(dt, t);
      },
    };
  }

  // The big fella walks a slow ring around the neighborhood, out past the
  // rooftops. Pure silhouette — but he has opinions, loudly, on a timer.
  function wakeKaiju() {
    const prop = makeKaiju();
    group.add(prop.group);
    let angle = Math.random() * Math.PI * 2;
    let roarIn = 6;
    kaiju = {
      prop,
      update(dt, bike) {
        angle += dt * 0.012; // one lap of the horizon in ~9 minutes
        const R = 430;
        prop.group.position.set(Math.cos(angle) * R, 0, Math.sin(angle) * R);
        // Walk tangent to the ring, facing travel.
        prop.group.rotation.y = Math.atan2(Math.sin(angle), Math.cos(angle));
        prop.walk(t);
        roarIn -= dt;
        if (roarIn <= 0) {
          roarIn = 18 + Math.random() * 14;
          onEvent?.('roar', {});
        }
      },
    };
  }

  // Disaster-movie air traffic: an airliner comes in low and hits a block
  // near the route. Flash, boom, and the street below is suddenly a rubble
  // field. Nobody's flying these — it's the apocalypse, planes just do this.
  function spawnPlaneCrash(bike) {
    const near = roadGraph.nearestOnRoad(
      bike.x + (Math.random() - 0.5) * 120,
      bike.z + (Math.random() - 0.5) * 120
    );
    if (!near) return;
    // Impact point: off the road edge, i.e. into the block face.
    const ix = near.x + -near.dz * 10;
    const iz = near.z + near.dx * 10;
    const iy = 12;

    const prop = makePlane();
    const approach = Math.random() * Math.PI * 2;
    const sx = ix + Math.cos(approach) * 320;
    const sz = iz + Math.sin(approach) * 320;
    prop.group.position.set(sx, 60, sz);
    group.add(prop.group);

    const sp = {
      phase: 'flying',
      hard: false,
      label: 'AIR TRAFFIC',
      nm: { armed: false, cooldown: 0 },
      plane: prop,
      explosion: null,
      rubble: [],
      life: 45,
      p: 0, // 0..1 along the dive
      circles() {
        // Only the rubble is a collider; the plane itself is scenery.
        return this.rubble.map((r) => ({ x: r.x, z: r.z, r: 1.1 }));
      },
      tick(dt, bike2) {
        if (this.phase === 'flying') {
          this.p = Math.min(1, this.p + dt / 3.2);
          const px = sx + (ix - sx) * this.p;
          const pz = sz + (iz - sz) * this.p;
          const py = 60 + (iy - 60) * this.p * this.p; // shallow then steep
          prop.group.position.set(px, py, pz);
          prop.group.rotation.y = headingOf((ix - sx), (iz - sz));
          prop.group.rotation.x = -0.25 * this.p;
          if (this.p === 1) {
            this.phase = 'crashed';
            group.remove(prop.group);
            disposeGroup(prop.group);
            const ex = makeExplosion();
            ex.group.position.set(ix, iy, iz);
            group.add(ex.group);
            this.explosion = ex;
            // The street below inherits the problem.
            for (let i = 0; i < 5; i++) {
              const rb = makeRubble();
              const rx = near.x + near.dx * (i - 2) * 4 + (Math.random() - 0.5) * 4;
              const rz = near.z + near.dz * (i - 2) * 4 + (Math.random() - 0.5) * 4;
              rb.group.position.set(rx, 0, rz);
              group.add(rb.group);
              this.rubble.push({ prop: rb, x: rx, z: rz });
            }
            this.hard = true; // rubble is masonry
            onEvent?.('planecrash', {});
          }
          return;
        }
        this.life -= dt;
        if (this.explosion && !this.explosion.done) this.explosion.tick(dt);
      },
    };
    setpieces.push(sp);
  }

  // -------------------------------------------------------------------------
  // The bagel toss — Brooklyn's native projectile
  // -------------------------------------------------------------------------

  function throwBagel(bike) {
    const prop = makeBagel();
    const fx = -Math.sin(bike.heading), fz = -Math.cos(bike.heading);
    const b = {
      prop,
      x: bike.x + fx * 1.2, y: 1.2 + bike.y, z: bike.z + fz * 1.2,
      vx: fx * (BAGEL.speed + Math.abs(bike.speed)),
      vz: fz * (BAGEL.speed + Math.abs(bike.speed)),
      vy: BAGEL.lift,
      life: BAGEL.life,
    };
    prop.group.position.set(b.x, b.y, b.z);
    group.add(b.prop.group);
    bagels.push(b);
  }

  function updateBagels(dt) {
    for (let i = bagels.length - 1; i >= 0; i--) {
      const b = bagels[i];
      b.life -= dt;
      b.vy -= BAGEL.gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.prop.group.position.set(b.x, b.y, b.z);
      b.prop.group.rotation.x += dt * 12; // it's a flying wheel, let it roll

      let spent = b.life <= 0 || b.y <= 0.05;
      if (!spent && b.y < 2.2) {
        for (const e of entities) {
          // Zombies get glazed…
          if (e.zombies) {
            for (const z of e.zombies) {
              if (z.stun <= 0 && Math.hypot(b.x - z.x, b.z - z.z) < BAGEL.hitRadius) {
                z.stun = BAGEL.stunTime;
                spent = true;
                onEvent?.('glazed', { points: BAGEL.points });
                break;
              }
            }
          }
          // …everyone else treats it as a very insistent bell — but only on a
          // direct hit, not at bell radius (a thrown bagel is not an area weapon).
          if (!spent && e.onBell &&
              e.onBell({ x: b.x, z: b.z }, BAGEL.hitRadius * 2)) spent = true;
          if (spent) break;
        }
      }
      if (spent) {
        group.remove(b.prop.group);
        disposeGroup(b.prop.group);
        bagels.splice(i, 1);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Route seeding
  // -------------------------------------------------------------------------

  function seedRoute(route) {
    clearEntities();
    if (!route || route.length < 2) { routeIdx = null; return; }
    routeIdx = routeIndex(route);

    let d = TRAFFIC.routeSkipStart + Math.random() * 20;
    let placed = 0;
    while (d < routeIdx.total - TRAFFIC.routeSkipEnd && placed < TRAFFIC.maxRouteObstacles) {
      const pt = routeIdx.pointAt(d);
      const near = roadGraph.nearestOnRoad(pt.x, pt.z);
      const onBikeLane = !!near?.seg?.bike;
      const roll = Math.random();

      if (onBikeLane) {
        // The gag: your green line is where the cars park.
        if (roll < 0.6) spawnLaneBlocker(pt);
        else if (roll < 0.8) spawnDoorCar(pt);
        else spawnTrash(pt);
      } else if (roll < 0.15) spawnLaneBlocker(pt);
      else if (roll < 0.29) spawnDoorCar(pt);
      else if (roll < 0.42) spawnCrossers(pt, 'phone');
      else if (roll < 0.60) spawnCrossers(pt, 'plain', 3 + (Math.random() * 2 | 0)); // the families
      else if (roll < 0.71) spawnDogWalker(pt);
      else if (roll < 0.82) spawnTrash(pt);
      else if (roll < 0.91) spawnPigeons(pt);
      else spawnTruck(pt);

      placed++;
      d += TRAFFIC.routeSpacing * (0.6 + Math.random() * 0.8);
    }
    seedSalmon();
    if (Math.random() < CHAOS.summitChance) spawnSummit();

    // The apocalypse layer: tier-gated extras scattered along the same route.
    const ti = Math.min(tier, 3);
    const randPt = () => routeIdx.pointAt(
      TRAFFIC.routeSkipStart +
      Math.random() * (routeIdx.total - TRAFFIC.routeSkipStart - TRAFFIC.routeSkipEnd)
    );
    for (let i = 0; i < ESCALATION.sinkholes[ti]; i++) spawnSinkhole(randPt());
    for (let i = 0; i < ESCALATION.zombiePacks[ti]; i++) spawnZombiePack(randPt());
    for (let i = 0; i < ESCALATION.lavaCracks[ti]; i++) spawnLavaCrack(randPt());

    // The neighborhood layer: always on, apocalypse or not. Life goes on.
    for (let i = 0; i < CULTURE.strollerPacks; i++) spawnStrollers(randPt());
    if (Math.random() < CULTURE.drunkChance) spawnDrunk(randPt());
    if (Math.random() < CULTURE.paradeChance) spawnParade(randPt());
    seedOncoming(CULTURE.oncomingCars[ti]);
  }

  // -------------------------------------------------------------------------
  // Per-frame update: behavior, collision, near-miss
  // -------------------------------------------------------------------------

  function distToSeg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    const u = THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1);
    return Math.hypot(px - (ax + dx * u), pz - (az + dz * u));
  }

  function fireNearMiss(e) {
    combo += 1;
    comboTimer = TRAFFIC.comboWindow;
    const points = TRAFFIC.nearMissPoints * combo;
    onEvent?.('nearmiss', { points, combo, label: e.label });
  }

  // Collision + near-miss for one entity against the bike. Returns true if a
  // hard contact happened (so the caller can stop early).
  function contact(e, bike, bikeCtl, dt) {
    const hoppedOver = e.low && bike.y > (e.lowY ?? 0.4);
    let minGap = Infinity;
    let hit = false;

    if (!hoppedOver) {
      for (const c of e.circles()) {
        const dx = bike.x - c.x, dz = bike.z - c.z;
        const d = Math.hypot(dx, dz);
        const gap = d - c.r;
        if (gap < minGap) minGap = gap;
        if (gap < 0) {
          hit = true;
          // Push the bike out to the collider edge so it can't tunnel.
          const inv = d > 1e-4 ? 1 / d : 0;
          bike.x = c.x + dx * inv * c.r;
          bike.z = c.z + dz * inv * c.r;
          if (e.hard) {
            // `c.stop` circles never wipe you out — they dead-stop you with a
            // guilt toast instead (the dog, the elders). Everything else
            // crashes at speed.
            if (Math.abs(bike.speed) > WIPEOUT.minSpeed && !c.stop) {
              if (bikeCtl.crash()) {
                combo = 0;
                onEvent?.('crash', { label: e.label });
              }
            } else {
              bike.speed *= 0.25; // shoulder-check bump
              if (c.stop) onEvent?.('bump', { label: c.stop });
            }
          } else if (e.onPlow) {
            const res = e.onPlow(bike);
            if (res) {
              bike.speed *= res.slow ?? 0.6;
              onEvent?.('soft', res);
            }
          }
        }
      }
      // Leash tripwire: a line, not a circle.
      if (!hit && e.leashSeg) {
        const s = e.leashSeg();
        if (distToSeg(bike.x, bike.z, s.ax, s.az, s.bx, s.bz) < 0.5) {
          hit = true;
          if (Math.abs(bike.speed) > WIPEOUT.minSpeed) {
            if (bikeCtl.crash()) {
              combo = 0;
              onEvent?.('crash', { label: 'CLOTHESLINED BY A LEASH' });
            }
          } else {
            bike.speed *= 0.2;
          }
        }
      }
    }

    // Near-miss bookkeeping — armed inside the band, fires on clean exit.
    e.nm.cooldown = Math.max(0, e.nm.cooldown - dt);
    if (hit) {
      e.nm.armed = false;
      e.nm.cooldown = 3;
    } else if (e.nm.cooldown === 0 && e.circles().length) {
      if (!e.nm.armed && minGap > 0 && minGap < TRAFFIC.nearMissBand &&
          Math.abs(bike.speed) > TRAFFIC.nearMissSpeed) {
        e.nm.armed = true;
      } else if (e.nm.armed && minGap > TRAFFIC.nearMissBand + 1.2) {
        e.nm.armed = false;
        e.nm.cooldown = 4;
        fireNearMiss(e);
      }
    }
    return hit;
  }

  function update(dt, bike, bikeCtl, playerRouteDist = 0) {
    t += dt;
    playerDistNow = playerRouteDist;
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer === 0) combo = 0;

    const down = bike.wipeout > 0;

    for (const e of entities) {
      e.tick?.(dt, bike);
      if (!down) {
        contact(e, bike, bikeCtl, dt);
        e.hazard?.(bike, bikeCtl); // sinkholes, zombie grabs — custom rules
      }
    }
    for (const r of roamers) {
      r.update(dt, bike);
      if (!down) contact(r, bike, bikeCtl, dt);
    }
    if (salmon) {
      salmon.update(dt, bike, playerRouteDist);
      if (!down) contact(salmon, bike, bikeCtl, dt);
    }

    // --- Sky-dwellers + ordnance ---
    if (ufo) ufo.update(dt, bike);
    if (kaiju) kaiju.update(dt, bike);
    updateBagels(dt);

    // --- Chaos director ---
    chaosTimer -= dt;
    if (chaosTimer <= 0) {
      chaosTimer = CHAOS.minInterval + Math.random() * (CHAOS.maxInterval - CHAOS.minInterval);
      if (setpieces.length < CHAOS.maxGeysers) {
        // The director's playlist: celebrations at any tier, planes once the
        // invasion starts, hydrants forever.
        const roll = Math.random();
        if (roll < CULTURE.riotWeight) {
          spawnRiot(bike);
        } else if (tier >= ESCALATION.planeCrashFrom && roll < CULTURE.riotWeight + 0.35) {
          spawnPlaneCrash(bike);
        } else {
          spawnHydrantCrash(bike);
        }
      }
    }
    for (let i = setpieces.length - 1; i >= 0; i--) {
      const sp = setpieces[i];
      sp.tick(dt, bike);
      if (!down) contact(sp, bike, bikeCtl, dt);
      if (sp.phase === 'crashed' && sp.life <= 0) {
        sp.dispose?.(); // set pieces that own their meshes (the riot)
        if (sp.car) {
          group.remove(sp.car.group);
          disposeGroup(sp.car.group);
        }
        if (sp.geyser) {
          group.remove(sp.geyser.group);
          disposeGroup(sp.geyser.group);
        }
        if (sp.explosion) {
          group.remove(sp.explosion.group);
          disposeGroup(sp.explosion.group);
        }
        for (const r of sp.rubble ?? []) {
          group.remove(r.prop.group);
          disposeGroup(r.prop.group);
        }
        setpieces.splice(i, 1);
      }
    }
  }

  // Is the bike tucked in behind a moving vehicle? (charges the boost meter)
  function draft(bike) {
    const fx = -Math.sin(bike.heading), fz = -Math.cos(bike.heading);
    for (const r of roamers) {
      const rx = r.state.x - bike.x, rz = r.state.z - bike.z;
      const ahead = rx * fx + rz * fz;
      const lateral = Math.abs(rx * -fz + rz * fx);
      if (ahead > 2 && ahead < TRAFFIC.draftDist && lateral < TRAFFIC.draftLateral) return true;
    }
    return false;
  }

  // Ring-ring: pedestrians hustle out of the lane, pigeons erupt.
  function ring(bike) {
    let any = false;
    for (const e of entities) {
      if (e.onBell?.(bike)) any = true;
    }
    if (any) onEvent?.('bellscatter', {});
    return any;
  }

  // Escalation hook: arm the tier's spawn tables and wake the sky-dwellers.
  function setTier(n) {
    tier = n;
    if (tier >= ESCALATION.ufoFrom && !ufo) wakeUFO();
    if (tier >= ESCALATION.kaijuFrom && !kaiju) wakeKaiju();
  }

  return {
    seedRoute, update, draft, ring, setTier, throwBagel,
    get combo() { return combo; },
    // Dev-console visibility + manual set-piece triggers
    // (window.__bq.traffic._debug) — cheap and load-bearing for playtest
    // forensics; not used by the game loop itself.
    _debug: {
      setpieces, hydrants,
      get entities() { return entities; },
      spawnRiot, spawnPlaneCrash, spawnHydrantCrash,
    },
  };
}
