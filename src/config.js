// Central tuning + the single source of truth for *where* the MVP takes place.
//
// bbox is [south, west, north, east] in lat/lng — the Overpass convention.
// We keep it small (a few blocks) so the browser stays at 60fps and Overpass
// stays happy. Center is derived from the bbox and used as the world origin.

export const WORLD = {
  name: 'South Williamsburg',
  // ~600m box around Marcy Ave / South Williamsburg — Hasidic + hipster overlap,
  // exactly the cultural collision the game is about.
  bbox: [40.7036, -73.963, 40.7126, -73.9512],
};

export const OVERPASS = {
  // Public mirrors. We try them in order if one is rate-limited / down.
  endpoints: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ],
  timeoutSec: 30,
};

// Road render widths (meters) by OSM highway class. Arcade-wide on purpose.
export const ROAD_WIDTHS = {
  motorway: 14, trunk: 13, primary: 12, secondary: 10, tertiary: 8,
  residential: 7, living_street: 6, unclassified: 7, service: 4,
  cycleway: 2.6, footway: 2, path: 2, pedestrian: 3,
  _default: 6,
};

// 2007-Need-for-Speed-ish dusk palette.
export const PALETTE = {
  sky: 0x10131f,
  fog: 0x10131f,
  ground: 0x0c0e16,
  building: 0x262b38,
  buildingTop: 0x323848,
  road: 0x14161e,
  roadEdge: 0x2a2f3d,
  bikeLane: 0x2ec27e, // the gag depends on these being unmissable
  sun: 0xffd9a0,
  rim: 0x5b7cff,
};
