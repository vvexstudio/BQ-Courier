// Building collision for the bike — "can't drive through walls".
//
// Buildings render as one merged mesh, so we can't raycast cheaply against them.
// Instead the world builder hands us the flat XZ footprint polygons, and we test
// the bike's position against them with a point-in-polygon test. Thousands of
// buildings would be slow to test one-by-one every frame, so we bucket each
// polygon into a uniform grid and only test the few in the bike's current cell.
//
// Resolution is arcade, not physical: if the target point is inside a wall we
// try moving on each axis alone, which makes the bike slide along the face
// instead of sticking. Good enough for feel; no impulses or restitution.

const CELL = 24; // meters — a couple of buildings per cell

function polyBBox(poly) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { minX, minZ, maxX, maxZ };
}

// Standard even-odd ray cast in the XZ plane.
function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, zi = poly[i].z;
    const xj = poly[j].x, zj = poly[j].z;
    const intersect =
      (zi > z) !== (zj > z) &&
      x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function createCollider(footprints = []) {
  const grid = new Map(); // "cx,cz" -> [polygon, ...]
  const key = (cx, cz) => cx + ',' + cz;

  for (const poly of footprints) {
    if (!poly || poly.length < 3) continue;
    const bb = polyBBox(poly);
    const cx0 = Math.floor(bb.minX / CELL), cx1 = Math.floor(bb.maxX / CELL);
    const cz0 = Math.floor(bb.minZ / CELL), cz1 = Math.floor(bb.maxZ / CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const k = key(cx, cz);
        (grid.get(k) ?? grid.set(k, []).get(k)).push(poly);
      }
    }
  }

  // Is world point (x,z) inside any building?
  function blocked(x, z) {
    const cell = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!cell) return false;
    for (const poly of cell) if (pointInPoly(x, z, poly)) return true;
    return false;
  }

  // Resolve a proposed move from (fromX,fromZ) to (toX,toZ). Returns the allowed
  // destination and whether a wall was hit (so the controller can bleed speed).
  function resolve(fromX, fromZ, toX, toZ) {
    if (!blocked(toX, toZ)) return { x: toX, z: toZ, hit: false };
    if (!blocked(toX, fromZ)) return { x: toX, z: fromZ, hit: true }; // slide along Z wall
    if (!blocked(fromX, toZ)) return { x: fromX, z: toZ, hit: true }; // slide along X wall
    return { x: fromX, z: fromZ, hit: true }; // fully stuck — stop
  }

  return { blocked, resolve, count: footprints.length };
}
