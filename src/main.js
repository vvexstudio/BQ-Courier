// BQ Courier — entry point.
//
// Phase 1 built the world (real South Williamsburg from OSM). Phase 2 puts a
// rideable bike in it: arcade physics, WASD steering, a third-person chase cam,
// and collision against buildings. This is where it stops being a tech demo.
// An OrbitControls free-cam stays one keypress away ('O') for debugging.
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
import { WORLD } from './config.js';

const els = {
  app: document.getElementById('app'),
  stats: document.getElementById('stats'),
  status: document.getElementById('status'),
};

function setStatus(msg) {
  els.status.textContent = msg;
  console.log('[bq]', msg);
}

const { renderer, scene, camera } = createScene(els.app);
const input = createInput();
const chaseCam = createChaseCam(camera);

// Debug free-cam — disabled until toggled on with 'O'.
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.enabled = false;
let orbitMode = false;

let bikeCtl = null; // set once the world is built

// FPS readout
let frames = 0;
let lastFpsT = performance.now();
let fps = 0;

async function init() {
  try {
    const { world, stats, footprints, spawn } = await buildWorld(WORLD.bbox, {
      onStatus: setStatus,
    });
    scene.add(world);

    const bike = createBike();
    scene.add(bike.group);

    const collider = createCollider(footprints);
    bikeCtl = createBikeController(bike, collider, spawn);

    // Place the chase cam behind the bike on the very first frame.
    chaseCam.update(0.016, bikeCtl.state);

    // Dev handle for inspecting the scene graph from the console.
    window.__bq = { scene, camera, world, bike, bikeCtl, collider, stats };
    setStatus(
      `${WORLD.name} — ${stats.buildings} buildings, ${stats.roads} roads, ` +
      `${stats.bikeLanes} bike lanes. WASD to ride, Space to brake, O for free-cam.`
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
  }

  renderer.render(scene, camera);

  frames++;
  if (now - lastFpsT >= 500) {
    fps = Math.round((frames * 1000) / (now - lastFpsT));
    frames = 0;
    lastFpsT = now;
    const kmh = bikeCtl ? Math.round(Math.abs(bikeCtl.state.speed) * 3.6) : 0;
    els.stats.textContent = `${fps} fps · ${kmh} km/h`;
  }
}

init();
animate();
