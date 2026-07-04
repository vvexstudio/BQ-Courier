// 16-bit retro render pass: draw the scene at a low internal resolution, then
// upscale with nearest-neighbor filtering (chunky pixels) and a subtle barrel
// distortion in the upscale shader. main.js calls fx.render() instead of
// renderer.render() so every frame goes through this pipeline.

import * as THREE from 'three';
import { FX } from '../config.js';

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Barrel distortion on the sample UV — edges bulge outward for a wide-lens feel.
const FRAG = `
uniform sampler2D tDiffuse;
uniform float fisheye;
uniform float aspect;
varying vec2 vUv;

void main() {
  vec2 coord = vUv - 0.5;
  coord.x *= aspect;
  float r2 = dot(coord, coord);
  coord *= 1.0 + fisheye * r2;
  coord.x /= aspect;
  vec2 sampleUv = coord + 0.5;

  if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) {
    gl_FragColor = vec4(0.0);
  } else {
    gl_FragColor = texture2D(tDiffuse, sampleUv);
  }
}
`;

export function createRetroFX(renderer) {
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture },
      fisheye: { value: FX.fisheye },
      aspect: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  });
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  function syncSize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rw = Math.max(1, Math.floor(w / FX.pixelScale));
    const rh = Math.max(1, Math.floor(h / FX.pixelScale));
    if (rt.width !== rw || rt.height !== rh) {
      rt.setSize(rw, rh);
      material.uniforms.aspect.value = w / h;
    }
  }

  window.addEventListener('resize', syncSize);
  syncSize();

  return {
    render(scene, camera) {
      syncSize();
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCam);
    },
  };
}
