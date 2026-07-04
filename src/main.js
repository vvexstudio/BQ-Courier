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
import { createNavMarkers } from './render/markers.js';
import { createHUD } from './ui/hud.js';
import { WORLD } from './config.js';

const app = document.getElementById('app');
const hud = createHUD();

function setStatus(msg) {
  hud.setStatus(msg);
  console.log('[bq]', msg);
}

const { renderer, scene, camera } = createScene(app);
const input = createInput();
const chaseCam = createChaseCam(camera);
const nav = createNavMarkers(scene);

// Debug free-cam — disabled until toggled on with 'O'.
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.enabled = false;
let orbitMode = false;

let bikeCtl = null;  // set once the world is built
let delivery = null;

// FPS readout
let frames = 0;
let lastFpsT = performance.now();
let fps = 0;

async function init() {
  try {
    const { world, stats, footprints, spawn, roadGraph, addresses, roadLines } =
      await buildWorld(WORLD.bbox, { onStatus: setStatus });
    scene.add(world);

    const bike = createBike();
    scene.add(bike.group);

    const collider = createCollider(footprints);
    bikeCtl = createBikeController(bike, collider, spawn, roadGraph);

    hud.initMap(roadLines);

    delivery = createDelivery({
      addresses,
      roadGraph,
      onEvent(type, data) {
        if (type === 'order') {
          hud.toast('NEW ORDER', `${data.cargo} → ${data.label}`);
        } else if (type === 'delivered') {
          hud.toast(
            `DELIVERED! +${data.points}`,
            data.streak > 1 ? `×${data.streak} streak · +${data.bonus} time bonus` : `+${data.bonus} time bonus`
          );
        } else if (type === 'expired') {
          hud.toast('ORDER EXPIRED', 'streak lost — new order incoming', true);
        }
      },
    });

    // Place the chase cam behind the bike on the very first frame.
    chaseCam.update(0.016, bikeCtl.state);

    // Dev handle for inspecting the scene graph from the console.
    window.__bq = { scene, camera, world, bike, bikeCtl, collider, delivery, roadGraph, stats };
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
    const s = bikeCtl.update(dt, input);
    if (orbitMode) {
      orbit.target.set(s.x, 1, s.z);
      orbit.update();
    } else {
      chaseCam.update(dt, s);
    }

    if (delivery) {
      const d = delivery.update(dt, s);
      nav.update(dt, d, s, delivery.aimPoint());
    }
  }

  renderer.render(scene, camera);

  frames++;
  if (now - lastFpsT >= 250) {
    fps = Math.round((frames * 1000) / (now - lastFpsT));
    frames = 0;
    lastFpsT = now;
  }
  if (bikeCtl && delivery) {
    const kmh = Math.round(Math.abs(bikeCtl.state.speed) * 3.6);
    hud.update(delivery.state, bikeCtl.state, kmh, fps);
  }
}

init();
animate();
