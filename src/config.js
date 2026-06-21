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
  cycleway: 5, footway: 2, path: 2, pedestrian: 3,
  _default: 6,
};

// Arcade bike feel (Phase 2). Tuned for fun, not realism — a courier bike that
// accelerates like a moped and turns like a shopping cart on purpose.
export const BIKE = {
  maxSpeed: 20,        // m/s forward top speed (~45 mph; arcade-fast)
  maxReverse: 5,       // m/s
  accel: 16,           // m/s^2 throttle
  brakeDecel: 34,      // m/s^2 active braking (Space / reverse-into-motion)
  rollDrag: 6,         // m/s^2 passive deceleration when coasting
  turnRate: 2.6,       // rad/s peak yaw rate
  // Steering authority falls off at speed (twitchy when slow, planted when fast)
  // and is killed near standstill so the bike doesn't pivot in place.
  turnSpeedFalloff: 0.045,
  maxLean: 0.5,        // rad — how far the chassis rolls into a hard turn
  hitSpeedKeep: 0.35,  // fraction of speed retained on a wall scrape
};

// 2007-Need-for-Speed-ish dusk palette. Moody blue hour, but legible — not
// "lights off". Streets read as wet asphalt, buildings catch warm sun + cool rim.
export const PALETTE = {
  sky: 0x1b2138,
  fog: 0x1b2138,
  ground: 0x0e1018, // dark, so the lit asphalt clearly stands out against it
  building: 0x44506b,
  buildingTop: 0x556280,
  road: 0x5a6178, // wet-asphalt grey — must read as a street, not a void
  roadEdge: 0x6b7390, // (unused yet)
  bikeLane: 0x39ff9a, // the gag depends on these being unmissable
  sun: 0xffd9a0,
  rim: 0x6f8dff,
};
