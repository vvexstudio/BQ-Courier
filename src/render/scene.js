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
  scene.fog = new THREE.Fog(PALETTE.fog, 260, 1100);

  // Gradient sky: a 1×128 canvas stretched as the screen-space background —
  // deep at the zenith, hazing into the fog color at the horizon, the way
  // 16-bit skies always did it. `sky.set(top, horizon)` redraws it; the
  // escalation calls that as the world slides toward the red end.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 1;
  skyCanvas.height = 128;
  const skyCtx = skyCanvas.getContext('2d');
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  const cTop = new THREE.Color();
  const cBot = new THREE.Color();
  const sky = {
    set(skyColor, horizonColor) {
      cTop.set(skyColor).offsetHSL(0, 0.05, -0.06); // zenith: a touch deeper
      cBot.set(horizonColor ?? skyColor).offsetHSL(0, -0.02, 0.08); // horizon haze
      const g = skyCtx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, '#' + cTop.getHexString());
      g.addColorStop(0.62, '#' + new THREE.Color().lerpColors(cTop, cBot, 0.55).getHexString());
      g.addColorStop(1, '#' + cBot.getHexString());
      skyCtx.fillStyle = g;
      skyCtx.fillRect(0, 0, 1, 128);
      skyTex.needsUpdate = true;
    },
  };
  sky.set(PALETTE.sky, PALETTE.fog);

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

  // Light + sky handles go out so the escalation system can drag the whole
  // scene from Brooklyn afternoon to Armageddon without reaching into the graph.
  return { renderer, scene, camera, lights: { sun, rim, hemi }, sky };
}
