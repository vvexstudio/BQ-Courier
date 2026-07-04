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

// Lane assist (Phase 3). When the player isn't steering, the bike gently tracks
// the nearest road's centerline instead of ruler-straight into a facade —
// streets curve, W-held-down shouldn't end at a wall. It's an aim-ahead
// correction, deliberately weaker than player input so it never fights an
// intentional turn, and it disengages entirely off-road / at big angles.
export const LANE_ASSIST = {
  maxDist: 12,    // m off the centerline before assist lets go
  lookAhead: 6,   // m ahead along the road we aim for (plus a speed term)
  lookAheadSpeed: 0.35, // extra look-ahead per m/s — smoother at speed
  rate: 1.4,      // rad/s max corrective yaw (player turnRate is 2.6)
  maxAngle: 1.0,  // rad — beyond this we assume the player *means* to leave
};

// The delivery loop (Phase 3). Timing is arcade-generous: the timer is derived
// from the actual route length at a "casual rider" pace, so a clean run always
// beats the clock and the bonus rewards hustle.
export const DELIVERY = {
  minRouteDist: 140,   // m — don't hand out orders you can see from the spawn
  maxRouteDist: 650,   // m — nor cross-map epics (bbox is only ~600m wide)
  dropRadius: 9,       // m from the (road-snapped) drop point that counts
  baseTime: 15,        // s of slack on every order
  paceSpeed: 6.5,      // m/s assumed pace: timeLimit = base + dist / pace
  baseScore: 100,      // points for any completed delivery
  timeBonusRate: 8,    // points per second left on the clock
  streakBonus: 25,     // extra points per consecutive on-time delivery
  rerouteDist: 26,     // m off-route before the GPS recalculates
  nextOrderDelay: 2.5, // s of "Delivered!" celebration before the next order
};

// 16-bit indie daytime palette (art pivot 2026-07-03, replacing the NFS dusk).
// Saturated SNES-cartridge colors: bright sky, grassy block interiors, warm
// brick-and-pastel facades. Flat and cheerful, not filmic.
export const PALETTE = {
  sky: 0x63c5f2,
  fog: 0xa8dcf5,
  ground: 0x74b04e, // grassy block interiors — reads "cheerful map", not asphalt void
  building: 0xc4705a, // fallback; real facades come from buildingVariants
  buildingTop: 0x556280,
  road: 0x9096a6, // light warm asphalt — clearly a street against the grass
  roadEdge: 0x6b7390, // (unused yet)
  bikeLane: 0x2fd97a, // the gag depends on these being unmissable
  sun: 0xfff2cf,
  rim: 0xcfe8ff,
  // Williamsburg facades: brick reds, terracotta, tan, cream, pastels.
  buildingVariants: [
    0xb9554a, 0xd98e5a, 0xd9c08a, 0xe6dcb8,
    0x9ec27a, 0x8fb0d9, 0xa07456, 0xd9a1a1,
  ],
  treeTrunk: 0x8a5a3b,
  treeLeaves: [0x4e9e4a, 0x62b556, 0x3f8f52],
};

// Retro render pass: draw the scene small, upscale nearest-neighbor (the 16-bit
// pixel look), and bend it slightly in the upscale shader (subtle fisheye).
export const FX = {
  pixelScale: 3,  // render at 1/pixelScale of the canvas — bigger = chunkier
  fisheye: 0.45,  // barrel distortion strength; 0 disables
  fov: 70,        // a touch wide, sells the lens
};
