// 16-bit render pass, SNES edition. Draw the scene at a low internal
// resolution, upscale nearest-neighbor (crisp chunky pixels, no smoothing),
// and grade the color like a good SNES game: a saturation/contrast push, then
// ordered-dither quantization to 5 bits per channel — flat fills stay flat,
// and gradients break into that unmistakable Bayer crosshatch instead of
// banding. Full-frame, no lens, no bezel: the game IS the screen.
// main.js calls fx.render() instead of renderer.render().

import * as THREE from 'three';
import { FX } from '../config.js';

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = `
uniform sampler2D tDiffuse;
uniform vec2 res;        // low-res target size, so the dither rides the big pixels
uniform float saturation;
uniform float contrast;
uniform float levels;    // quantization steps per channel (31 = 5-bit, SNES-ish)
varying vec2 vUv;

// Compact 4x4 Bayer threshold, 0..1 — the classic ordered-dither pattern.
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;

  // The 16-bit grade: colors lean saturated and confident, never filmic.
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, saturation);
  c = (c - 0.5) * contrast + 0.5;

  // Ordered dither + quantize, anchored to the low-res pixel grid.
  vec2 cell = floor(vUv * res);
  float d = (bayer4(cell) - 0.5) / levels;
  c = floor(clamp(c + d, 0.0, 1.0) * levels + 0.5) / levels;

  gl_FragColor = vec4(c, 1.0);
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
      res: { value: new THREE.Vector2(1, 1) },
      saturation: { value: FX.saturation },
      contrast: { value: FX.contrast },
      levels: { value: FX.levels },
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
      material.uniforms.res.value.set(rw, rh);
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
