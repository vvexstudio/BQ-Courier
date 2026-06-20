// Lat/lng -> local meter-based world coordinates.
//
// We use a flat equirectangular projection centered on the world origin. Over a
// few city blocks the distortion is negligible, and it keeps Three.js working in
// clean meters instead of tiny degree fractions.
//
// Convention: X = east(+), Z = south(+), Y = up. North is -Z (i.e. "forward").

const DEG2RAD = Math.PI / 180;
const M_PER_DEG_LAT = 111320; // good enough at NYC latitudes

let origin = null; // { lat0, lng0, mLng }

export function setOrigin(lat0, lng0) {
  origin = {
    lat0,
    lng0,
    mLng: M_PER_DEG_LAT * Math.cos(lat0 * DEG2RAD),
  };
}

export function project(lat, lon) {
  if (!origin) throw new Error('geo.setOrigin() must be called before project()');
  return {
    x: (lon - origin.lng0) * origin.mLng,
    z: -(lat - origin.lat0) * M_PER_DEG_LAT,
  };
}

// Convenience for a [s, w, n, e] bbox -> its center lat/lng.
export function bboxCenter([s, w, n, e]) {
  return { lat: (s + n) / 2, lng: (w + e) / 2 };
}
