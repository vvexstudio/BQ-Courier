// BQ Courier — entry point.
//
// Phase 1 goal: load real South Williamsburg from OSM as a navigable, stylized
// 3D scene. No gameplay yet — an orbit camera you can fly around in. This
// de-risks the whole project: if the map pipeline works, everything else builds
// on top of it. See sprintboard.md for the roadmap and what comes next.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene } from './render/scene.js';
import { buildWorld } from './world/worldBuilder.js';
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

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49; // keep above the ground
controls.target.set(0, 0, 0);

// FPS readout
let frames = 0;
let lastFpsT = performance.now();
let fps = 0;

async function init() {
  try {
    const { world, stats } = await buildWorld(WORLD.bbox, { onStatus: setStatus });
    scene.add(world);
    setStatus(
      `${WORLD.name} loaded — ${stats.buildings} buildings, ` +
      `${stats.roads} roads, ${stats.bikeLanes} bike lanes. Drag to look around.`
    );
  } catch (err) {
    setStatus(`Failed to build world: ${err.message}`);
    console.error(err);
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);

  frames++;
  const now = performance.now();
  if (now - lastFpsT >= 500) {
    fps = Math.round((frames * 1000) / (now - lastFpsT));
    frames = 0;
    lastFpsT = now;
    els.stats.textContent = `${fps} fps`;
  }
}

init();
animate();
