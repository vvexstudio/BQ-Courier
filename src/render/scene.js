// Renderer, scene, camera, lights, and the 16-bit daytime styling. Kept
// separate from the game loop so phase 2+ (bike, chase cam) can reuse it.

import * as THREE from 'three';
import { PALETTE, FX } from '../config.js';

export function createScene(container) {
  // logarithmicDepthBuffer dramatically improves precision across our large
  // near/far range, which kills the z-fighting between the near-coplanar
  // ground / road / bike-lane layers.
  // antialias off on purpose: the retro pass upscales nearest-neighbor and
  // pixel art wants hard edges, not smoothed ones.
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(1); // the retroFX target is tiny anyway
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // No filmic tone mapping: 16-bit color is flat and saturated, not graded.
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 260, 1100);

  const camera = new THREE.PerspectiveCamera(
    FX.fov, window.innerWidth / window.innerHeight, 1, 3000
  );
  camera.position.set(120, 140, 180);

  // Key (warm daylight sun), rim (cool sky), and ambient fill.
  // Sun sits high so the street canyons stay lit — at the old low angle,
  // every facade facing away from it rendered near-black at street level.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.3);
  sun.position.set(120, 300, 60);
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

  const rim = new THREE.DirectionalLight(PALETTE.rim, 0.35);
  rim.position.set(-160, 120, -140);
  scene.add(rim);

  // The hemisphere doubles as the ambient: vertical walls take ~half of it,
  // so it needs to be strong (and near-white) for facades to read as their
  // palette color instead of a silhouette. Tuned live 2026-07-04.
  const hemi = new THREE.HemisphereLight(0xdfeeff, 0xcfd8c4, 2.2);
  scene.add(hemi);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Light handles go out so the escalation system can drag the whole scene
  // from Brooklyn afternoon to Armageddon without reaching into the graph.
  return { renderer, scene, camera, lights: { sun, rim, hemi } };
}
