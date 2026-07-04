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
const ROUTE_WIDTH = 2.4;
const ROUTE_COLOR = 0xffb02e;  // hot amber — distinct from the green bike lanes
const BEACON_COLOR = 0xff4fa3; // magenta column, NFS-lollipop energy

function ribbonGeometry(pts, width, y) {
  const half = width / 2;
  const pos = [];
  const idx = [];
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
    idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  return geom;
}

export function createNavMarkers(scene) {
  const group = new THREE.Group();
  group.name = 'nav';
  scene.add(group);

  // --- Route ribbon ---
  const routeMat = new THREE.MeshBasicMaterial({
    color: ROUTE_COLOR,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
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
      routeMat.opacity = 0.65 + 0.25 * Math.sin(t * 4); // slow breathing pulse
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
