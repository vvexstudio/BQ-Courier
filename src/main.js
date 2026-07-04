// BQ Courier — entry point.
//
// Phase 1 built the world (real South Williamsburg from OSM). Phase 2 made it
// rideable (arcade bike, chase cam, collision). Phase 3 — this — makes it a
// game: orders spawn at real tagged addresses, an A* route is drawn on the
// street and on a minimap, a nav arrow leads the way, and arriving in the drop
// zone scores against a route-length timer. Lane assist keeps a hands-off bike
// following the street instead of coasting into a facade.
// See sprintboard.md for the roadmap and what comes next.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene } from './render/scene.js';
import { buildWorld } from './world/worldBuilder.js';
import { createBike } from './entities/bike.js';
import { createInput } from './game/input.js';
import { createCollider } from './game/collision.js';
import { createBikeController } from './game/bikeController.js';
import { createChaseCam } from './render/chaseCam.js';
import { createDelivery } from './game/delivery.js';
import { createTraffic } from './game/traffic.js';
import { createEscalation } from './game/escalation.js';
import { createPowerups } from './game/powerups.js';
import { createNavMarkers } from './render/markers.js';
import { createRetroFX } from './render/retroFX.js';
import { createSFX } from './audio/sfx.js';
import { createHUD } from './ui/hud.js';
import { createTouchControls } from './ui/touch.js';
import { routeLength } from './world/roadGraph.js';
import { WORLD, BOOST, POWERUPS } from './config.js';

const app = document.getElementById('app');
const hud = createHUD();

function setStatus(msg) {
  hud.setStatus(msg);
  console.log('[bq]', msg);
}

const { renderer, scene, camera, lights, sky } = createScene(app);
const fx = createRetroFX(renderer); // 16-bit pixelation + fisheye pass
const input = createInput();
createTouchControls(); // portrait thumbs feed the same key events as WASD
const chaseCam = createChaseCam(camera);
const nav = createNavMarkers(scene);

// Debug free-cam — disabled until toggled on with 'O'.
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.enabled = false;
let orbitMode = false;

const sfx = createSFX(); // unlocks itself on the first keydown

let bikeCtl = null;  // set once the world is built
let delivery = null;
let traffic = null;
let escalation = null;
let powerups = null;
let graph = null;    // road graph, needed per-frame for the boost lane check
let runTime = 0;     // elapsed ride time for the big HUD clock
let lastCrashes = 0; // edge-detect wipeouts for sound + ticker
let wasBoosting = false;
let crashPinged = false; // traffic already ran a labeled wipeout ticker this frame

// FPS readout
let frames = 0;
let lastFpsT = performance.now();
let fps = 0;

async function init() {
  try {
    const { world, stats, footprints, spawn, roadGraph, addresses, roadLines, hydrants } =
      await buildWorld(WORLD.bbox, { onStatus: setStatus });
    scene.add(world);

    const bike = createBike();
    scene.add(bike.group);

    const collider = createCollider(footprints);
    bikeCtl = createBikeController(bike, collider, spawn, roadGraph);

    hud.initMap(roadLines);

    graph = roadGraph;

    // The street fights back: obstacles seeded along each order's route,
    // roaming traffic, near-miss combos. Events route to score/HUD/sound here.
    traffic = createTraffic({
      scene,
      roadGraph,
      hydrants,
      onEvent(type, data) {
        if (type === 'nearmiss') {
          delivery?.addScore(data.points);
          // The neighborhood grades your riding — in Yiddish, but only when
          // the neighborhood is actually standing there watching.
          const watched = bikeCtl && traffic.nearNeighbors(bikeCtl.state);
          const call = watched && data.combo >= 5 ? 'A MECHAYEH!'
            : watched && data.combo >= 3 ? 'SHTARK!'
            : 'CLOSE CALL';
          hud.ping(`${call} +${data.points}${data.combo > 1 ? ` · ×${data.combo}` : ''}`);
          sfx.play('whoosh');
        } else if (type === 'pigeons') {
          delivery?.addScore(data.points);
          hud.ping(`+${data.points} · ${data.count} PIGEONS FLUSHED`);
          sfx.play('flutter');
        } else if (type === 'soft') {
          if (data.points) delivery?.addScore(data.points);
          hud.ping(data.text ?? 'SPLAT');
          sfx.play('blip');
        } else if (type === 'crash') {
          const watched = bikeCtl && traffic.nearNeighbors(bikeCtl.state);
          hud.ping(watched ? `OY GEVALT — ${data.label}` : `WIPEOUT — ${data.label}`, true);
          crashPinged = true;
        } else if (type === 'bump') {
          hud.ping(data.label, true);
        } else if (type === 'horn') {
          sfx.play('horn');
        } else if (type === 'beep') {
          sfx.play('beep');
        } else if (type === 'door') {
          sfx.play('creak');
        } else if (type === 'skid') {
          sfx.play('skid');
        } else if (type === 'hydrant') {
          sfx.play('splash');
          hud.ping("HYDRANT'S OPEN");
        } else if (type === 'argue') {
          sfx.play('argue');
        } else if (type === 'summit') {
          hud.ping('THE SUMMIT CONTINUES', true);
        } else if (type === 'rumble') {
          sfx.play('rumble');
        } else if (type === 'groan') {
          sfx.play('groan');
        } else if (type === 'roar') {
          sfx.play('roar');
        } else if (type === 'ufo') {
          sfx.play('ufo');
        } else if (type === 'dropped') {
          hud.ping('CATCH AND RELEASE', true);
        } else if (type === 'planecrash') {
          sfx.play('explosion');
          hud.ping('AIR TRAFFIC PROBLEM', true);
        } else if (type === 'glazed') {
          delivery?.addScore(data.points);
          hud.ping(`GLAZED +${data.points}`);
          sfx.play('glazed');
        } else if (type === 'chant') {
          sfx.play('chant');
        } else if (type === 'party') {
          sfx.play('party');
        } else if (type === 'nigun') {
          sfx.play('nigun');
        } else if (type === 'hiccup') {
          sfx.play('hiccup');
        }
      },
    });

    // The world ends gradually: tier by deliveries, environment lerp per frame.
    escalation = createEscalation({
      scene,
      lights,
      sky,
      onTier(n, name) {
        hud.toast(name, n >= 3 ? 'deliver anyway' : 'keep riding', n >= 2);
        sfx.play(n >= 3 ? 'roar' : 'lose');
        sfx.setMusicTier(n); // the bed follows the world down
        traffic.setTier(n);
      },
    });

    powerups = createPowerups({
      scene,
      onEvent(type, data) {
        if (type !== 'powerup') return;
        sfx.play('pickup');
        const s = bikeCtl.state;
        if (data.kind === 'pizza') {
          s.boost = 100;
          hud.ping('PIZZA — BOOST FULL');
        } else if (data.kind === 'coffee') {
          s.overdrive = POWERUPS.coffeeTime;
          hud.ping('COFFEE — OVERDRIVE');
        } else if (data.kind === 'shield') {
          s.shield = true;
          hud.ping('BAGEL SHIELD ON');
        } else if (data.kind === 'clock') {
          delivery?.addTime(POWERUPS.clockBonus);
          hud.ping(`+${POWERUPS.clockBonus}s ON THE CLOCK`);
        }
      },
    });

    delivery = createDelivery({
      addresses,
      roadGraph,
      onEvent(type, data) {
        if (type === 'order') {
          hud.toast('NEW ORDER', `${data.cargo} → ${data.label}`);
          sfx.play('order');
          traffic.seedRoute(delivery?.state.route ?? null);
          powerups.seedRoute(delivery?.state.route ?? null);
        } else if (type === 'delivered') {
          // "Mazel tov" is earned by delivering in front of the neighbors.
          const watched = bikeCtl && traffic.nearNeighbors(bikeCtl.state);
          hud.toast(
            `${watched ? 'MAZEL TOV!' : 'DELIVERED!'} +${data.points}`,
            data.streak > 1 ? `×${data.streak} streak · +${data.bonus} time bonus` : `+${data.bonus} time bonus`
          );
          sfx.play('win');
        } else if (type === 'expired') {
          hud.toast('ORDER EXPIRED', 'streak lost — new order incoming', true);
          sfx.play('lose');
        } else if (type === 'reroute') {
          // New line on the map = new gauntlet on the street.
          traffic.seedRoute(delivery?.state.route ?? null);
        }
      },
    });

    // Place the chase cam behind the bike on the very first frame.
    chaseCam.update(0.016, bikeCtl.state);

    // Dev handle for inspecting the scene graph from the console.
    window.__bq = { scene, camera, world, bike, bikeCtl, collider, delivery, traffic, escalation, powerups, roadGraph, stats };
    setStatus(
      `${WORLD.name} — ${stats.buildings} buildings, ${stats.roads} roads, ` +
      `${stats.bikeLanes} bike lanes, ${addresses.length} addresses.`
    );
  } catch (err) {
    setStatus(`Failed to build world: ${err.message}`);
    console.error(err);
  }
}

let lastT = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  // Clamp dt so a tab-out / GC pause can't teleport the bike through a wall.
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;

  if (input.pressed('KeyO')) {
    orbitMode = !orbitMode;
    orbit.enabled = orbitMode;
    if (!orbitMode) chaseCam.reset(); // snap back behind the bike
    if (orbitMode && bikeCtl) orbit.target.set(bikeCtl.state.x, 1, bikeCtl.state.z);
  }

  if (bikeCtl) {
    runTime += dt;

    // Boost inputs the controller can't know on its own: are we on a bike
    // lane, are we tucked behind a vehicle?
    const st = bikeCtl.state;
    const near = graph?.nearestOnRoad(st.x, st.z);
    const env = {
      onLane: !!(near?.seg?.bike && near.dist < BOOST.laneWidth),
      draft: traffic ? traffic.draft(st) : false,
    };

    const s = bikeCtl.update(dt, input, env);
    if (s.hopped) sfx.play('hop');
    if (s.boosting && !wasBoosting) sfx.play('boost');
    wasBoosting = s.boosting;

    if (input.pressed('KeyB')) {
      sfx.play('bell');
      traffic?.ring(s);
    }
    // Space or Q lobs the bagel (Space freed up when S took over braking).
    const shoot = input.pressed('Space');
    if ((input.pressed('KeyQ') || shoot) && s.wipeout === 0) {
      sfx.play('toss');
      traffic?.throwBagel(s);
    }
    if (s.shieldUsed) {
      s.shieldUsed = false;
      hud.ping('BAGEL SHIELD SPENT', true);
      sfx.play('glazed');
    }

    // Obstacles move, collide, and score before the camera looks at anything.
    if (traffic && delivery) {
      const dl = delivery.state;
      const progress = dl.route ? Math.max(0, routeLength(dl.route) - dl.distLeft) : 0;
      traffic.update(dt, s, bikeCtl, progress);
    }

    // Any wipeout this frame (building, car, leash…) sounds the same; traffic
    // already ran a labeled ticker for its own, so only add the generic one.
    if (s.crashes > lastCrashes) {
      sfx.play('crash');
      if (!crashPinged) hud.ping('WIPEOUT', true);
      lastCrashes = s.crashes;
    }
    crashPinged = false;

    if (powerups) powerups.update(dt, s);

    if (delivery) {
      const d = delivery.update(dt, s);
      nav.update(dt, d, s, delivery.aimPoint());
      if (escalation) escalation.update(dt, d.delivered);
    }

    if (orbitMode) {
      orbit.target.set(s.x, 1, s.z);
      orbit.update();
    } else {
      chaseCam.update(dt, s);
    }
  }

  fx.render(scene, camera);

  frames++;
  if (now - lastFpsT >= 250) {
    fps = Math.round((frames * 1000) / (now - lastFpsT));
    frames = 0;
    lastFpsT = now;
  }
  if (bikeCtl && delivery) {
    const kmh = Math.round(Math.abs(bikeCtl.state.speed) * 3.6);
    hud.update(delivery.state, bikeCtl.state, kmh, fps, runTime);
  }
}

init();
animate();
