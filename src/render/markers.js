// Navigation you can *see* — the three in-world pieces of the delivery loop:
//
//   1. Route ribbon: a glowing strip laid over the streets along the A* route,
//      Crazy-Taxi style. Rebuilt only when the route changes (routeVersion).
//   2. Destination beacon: a tall light column + pulsing ground ring at the
//      drop point, visible over rooftops from anywhere in the bbox.
//   3. Nav arrow: a chevron floating above the bike that always points down
//      the route (at an aim point ~18m along it, so it turns at corners
//      instead of pointing through buildings).

import * as THREE from 'three';

const ROUTE_Y = 0.55;      // above the bike lanes (0.4) so it always reads
const ROUTE_WIDTH = 2.2;   // a guide line, not a runway (slimmed 2026-07-04)
const ROUTE_COLOR = 0xffb02e;  // hot amber — distinct from the green bike lanes
const BEACON_COLOR = 0xff4fa3; // magenta column, NFS-lollipop energy

// Ribbon with UVs: u runs across the width (0..1), v is meters along the
// route — the chevron shader needs the distance to march its arrows.
function ribbonGeometry(pts, width, y) {
  const half = width / 2;
  const pos = [];
  const uv = [];
  const idx = [];
  let d = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    let dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    dx /= len; dz /= len;
    const nx = -dz * half, nz = dx * half;
    const base = pos.length / 3;
    pos.push(
      a.x + nx, y, a.z + nz,
      a.x - nx, y, a.z - nz,
      b.x + nx, y, b.z + nz,
      b.x - nx, y, b.z - nz
    );
    uv.push(0, d, 1, d, 0, d + len, 1, d + len);
    idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    d += len;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  return geom;
}

export function createNavMarkers(scene) {
  const group = new THREE.Group();
  group.name = 'nav';
  scene.add(group);

  // --- Route ribbon: modern GPS line — a soft-edged translucent band with
  // bright chevrons marching toward the drop. The chevron tip leads at the
  // centerline (the |u| offset), so the arrows visibly point the way.
  const routeMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      base: { value: new THREE.Color(ROUTE_COLOR) },
      hot: { value: new THREE.Color(0xffe9a8) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    // The renderer runs a logarithmic depth buffer; raw ShaderMaterials must
    // opt in via the logdepthbuf chunks or every fragment loses the depth
    // test against the built-in materials (learned the hard way).
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float time;
      uniform vec3 base;
      uniform vec3 hot;
      varying vec2 vUv;
      void main() {
        #include <logdepthbuf_fragment>
        float cx = abs(vUv.x * 2.0 - 1.0);              // 0 center → 1 edge
        float band = 1.0 - smoothstep(0.7, 1.0, cx);    // soft-edged core
        // Chevrons every 7m, scrolling toward the destination at 7 m/s.
        float p = fract((vUv.y - cx * 1.2 - time * 7.0) / 7.0);
        float ch = smoothstep(0.02, 0.06, p) * (1.0 - smoothstep(0.16, 0.24, p));
        float alpha = band * (0.5 + ch * 0.5); // solid enough to trust at speed
        vec3 col = mix(base, hot, ch);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  let routeMesh = null;
  let shownVersion = -1;

  // --- Destination beacon: column + ground ring ---
  const beacon = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 90, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: BEACON_COLOR,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  column.position.y = 45;
  beacon.add(column);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 4.6, 40),
    new THREE.MeshBasicMaterial({
      color: BEACON_COLOR,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.6;
  beacon.add(ring);
  beacon.visible = false;
  group.add(beacon);

  // --- Nav arrow: flat chevron hovering above the bike ---
  const arrowShape = new THREE.Shape();
  // A chevron pointing along -Z (the world "forward" convention).
  arrowShape.moveTo(0, -0.9);
  arrowShape.lineTo(0.62, 0.45);
  arrowShape.lineTo(0, 0.12);
  arrowShape.lineTo(-0.62, 0.45);
  arrowShape.closePath();
  const arrowGeom = new THREE.ExtrudeGeometry(arrowShape, { depth: 0.12, bevelEnabled: false });
  arrowGeom.rotateX(-Math.PI / 2); // lie flat: shape XY -> world XZ
  const arrow = new THREE.Mesh(
    arrowGeom,
    new THREE.MeshBasicMaterial({ color: ROUTE_COLOR, transparent: true, opacity: 0.95 })
  );
  arrow.visible = false;
  group.add(arrow);

  let t = 0;

  // Called each frame with the delivery state, bike state, and an aim point.
  function update(dt, delivery, bike, aim) {
    t += dt;
    const riding = delivery.phase === 'riding' && delivery.route;

    // Rebuild the ribbon only when the route actually changed.
    if (riding && delivery.routeVersion !== shownVersion) {
      if (routeMesh) {
        routeMesh.geometry.dispose();
        group.remove(routeMesh);
      }
      routeMesh = new THREE.Mesh(ribbonGeometry(delivery.route, ROUTE_WIDTH, ROUTE_Y), routeMat);
      routeMesh.renderOrder = 2;
      group.add(routeMesh);
      shownVersion = delivery.routeVersion;
    }
    if (routeMesh) {
      routeMesh.visible = riding;
      routeMat.uniforms.time.value = t; // the chevrons march on this
    }

    // Beacon at the drop point, ring pulsing outward.
    const hasDrop = delivery.order && (riding || delivery.phase === 'delivered');
    beacon.visible = !!hasDrop;
    if (hasDrop) {
      beacon.position.set(delivery.order.dropX, 0, delivery.order.dropZ);
      const pulse = 1 + 0.25 * Math.sin(t * 3.2);
      ring.scale.setScalar(pulse);
      ring.material.opacity = 0.55 + 0.35 * Math.sin(t * 3.2 + 1.2);
    }

    // Arrow above the bike, yawed toward the route's aim point, gently bobbing.
    arrow.visible = riding && !!aim;
    if (arrow.visible) {
      arrow.position.set(bike.x, 3.1 + 0.15 * Math.sin(t * 2.4), bike.z);
      // Chevron tip points -Z at yaw 0, matching forward=(-sin h, -cos h).
      arrow.rotation.y = Math.atan2(-(aim.x - bike.x), -(aim.z - bike.z));
    }
  }

  return { update };
}
