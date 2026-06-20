// Renderer, scene, camera, lights, and the dusk styling. Kept separate from the
// game loop so phase 2+ (bike, chase cam) can reuse it.

import * as THREE from 'three';
import { PALETTE } from '../config.js';

export function createScene(container) {
  // logarithmicDepthBuffer dramatically improves precision across our large
  // near/far range, which kills the z-fighting between the near-coplanar
  // ground / road / bike-lane layers.
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 200, 900);

  const camera = new THREE.PerspectiveCamera(
    60, window.innerWidth / window.innerHeight, 1, 3000
  );
  camera.position.set(120, 140, 180);

  // Key (warm sodium sun), rim (cool blue), and ambient fill.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.25);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  const s = 400;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s });
  // Kill shadow acne (the moiré speckle on flat roofs/streets).
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 1.0;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(PALETTE.rim, 0.7);
  rim.position.set(-160, 120, -140);
  scene.add(rim);

  scene.add(new THREE.HemisphereLight(PALETTE.sky, PALETTE.ground, 1.05));

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera };
}
