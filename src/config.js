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
