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

// Bunny hop (Phase 4). One small jump — enough to clear a leash line, a rat
// swarm, or a pothole, not enough to clear a car. Steering softens in the air.
export const HOP = {
  impulse: 4.4,      // m/s initial vertical velocity
  gravity: 15,       // m/s^2 — heavier than earth on purpose, snappy arc
  minSpeed: 2,       // can't hop from a trackstand
  airSteer: 0.4,     // steering authority multiplier while airborne
};

// Boost (Phase 4). The meter charges from *riding well* — holding an unblocked
// bike lane or drafting a moving vehicle — and dumps into a sprint on E. This
// is the bike-lane gag becoming a system: a car in your lane is stealing your
// boost line, not just your path.
export const BOOST = {
  laneChargeRate: 9,    // meter/s while riding a bike lane above minChargeSpeed
  draftChargeRate: 26,  // meter/s while slipstreaming a vehicle
  minChargeSpeed: 4,    // m/s — no charging while soft-pedaling
  drainRate: 40,        // meter/s while boosting (full bar ≈ 2.5s of boost)
  speedMult: 1.45,      // maxSpeed multiplier while boosting
  accelMult: 1.7,       // accel multiplier while boosting
  laneWidth: 3.2,       // m from a bike-lane centerline that counts as "in lane"
};

// The wipeout (Phase 4). Hitting something hard knocks you down; the run never
// ends, but the seconds hurt — that's the whole economy of the obstacles.
export const WIPEOUT = {
  minSpeed: 5.5,     // m/s — slower contact is a bump, not a crash
  downTime: 1.5,     // s flat on the asphalt before remounting
  bounceBack: -0.15, // fraction of impact speed kept, reversed (a little kickback)
};

// The Brooklyn obstacles (Phase 4). Curated types, procedurally placed along
// the *active route* so every order is a gauntlet.
export const TRAFFIC = {
  routeSpacing: 52,     // m between route-anchored obstacles (±40% jitter)
  routeSkipStart: 30,   // m of clean road after the spawn/pickup
  routeSkipEnd: 18,     // m of clean road before the drop
  maxRouteObstacles: 12,
  roamingCars: 2,       // cruising cars that follow the street graph
  roamingBuses: 1,
  nearMissBand: 2.4,    // m outside an obstacle's collider that counts as "close"
  nearMissSpeed: 7,     // m/s minimum — no points for walking past
  nearMissPoints: 25,   // × current combo
  comboWindow: 4,       // s between near-misses before the combo resets
  pigeonPoints: 5,      // per bird flushed
  bellRadius: 11,       // m — pedestrians ahead scatter when you ring
  draftDist: 9,         // m behind a moving vehicle that counts as slipstream
  draftLateral: 2.4,    // m sideways tolerance for the draft
};

// The chaos director (Phase 4.5). Unscripted street theater that fires near
// the player on a timer: a car loses it and takes out a hydrant (geyser), and
// once per order a school bus double-parks across an intersection while its
// elders hold a summit in the street. Pure vibe, lightly interactive.
export const CHAOS = {
  minInterval: 13,     // s between director rolls
  maxInterval: 25,
  maxGeysers: 2,       // simultaneous hydrant events
  geyserLife: 30,      // s before the wreck + geyser despawn
  hydrantRange: [30, 95], // m from the player a hydrant qualifies
  showerPoints: 15,    // riding through the spray
  runawaySpeed: 14,    // m/s of the car leaving the road
  summitChance: 0.75,  // per-order odds of the intersection bus summit
  argueRadius: 26,     // m within which you hear the debate
};

// Escalation (Phase 6). The run starts as Brooklyn and ends as a disaster
// movie. Tier is driven by completed deliveries; each tier layers new spawn
// types onto the obstacle system and shifts the whole environment (sky, fog,
// light) toward the hellscape. Losing a streak never de-escalates — the
// apocalypse does not care about your stats.
export const ESCALATION = {
  // deliveries needed to enter tier 1, 2, 3.
  tierAt: [3, 6, 9],
  tierNames: ['', 'SOMETHING IS OFF', 'THE INVASION', 'ARMAGEDDON'],
  envLerp: 0.5,        // per-second blend rate toward the tier's environment
  // Per-tier environment targets (tier 0 = the daytime scene as shipped).
  env: [
    { sky: 0x63c5f2, fog: 0xa8dcf5, fogNear: 260, fogFar: 1100, sun: 0xfff2cf, sunI: 1.3, hemiI: 2.2 },
    { sky: 0x8fb8d8, fog: 0xb8c4c0, fogNear: 220, fogFar: 950,  sun: 0xffe4b0, sunI: 1.2, hemiI: 2.0 },
    { sky: 0x7a6a9e, fog: 0xa08a8a, fogNear: 170, fogFar: 750,  sun: 0xffb070, sunI: 1.1, hemiI: 1.7 },
    { sky: 0x8e1f1f, fog: 0x7a2020, fogNear: 110, fogFar: 520,  sun: 0xff5a3c, sunI: 1.3, hemiI: 1.3 },
  ],
  // Tier-gated spawn budgets (per order, along the route).
  sinkholes: [0, 2, 2, 3],
  zombiePacks: [0, 0, 2, 2],
  lavaCracks: [0, 0, 0, 4],
  ufoFrom: 2,          // tier that puts the saucer in the sky
  kaijuFrom: 3,        // tier that puts the big fella on the skyline
  planeCrashFrom: 2,   // tier that adds plane crashes to the chaos director
};

// Powerups (Phase 6). Spawn floating on the route; ride through to grab.
export const POWERUPS = {
  perRoute: 2,          // pickups seeded per order
  radius: 1.7,          // m pickup radius
  coffeeTime: 9,        // s of free overdrive
  coffeeMult: 1.35,     // overdrive top-speed multiplier
  clockBonus: 12,       // s added to the order timer
  kinds: ['pizza', 'coffee', 'shield', 'clock'],
};

// The bagel toss (Phase 6). Q lobs a bagel: stuns zombies, hurries everyone
// else. Brooklyn's native projectile.
export const BAGEL = {
  speed: 22,            // m/s launch, flat-ish arc
  lift: 3.5,            // m/s initial vertical
  gravity: 14,
  life: 2.2,            // s before despawn
  hitRadius: 0.9,
  stunTime: 6,          // s a glazed zombie stays down
  points: 15,           // per zombie glazed
};

// Street culture (Phase 6.5): the neighborhood, turned up. Championship
// celebrations, the parade, oncoming traffic in your lane, more neighbors on
// the sidewalks (with a hummed niggun when you pass close), and one guy
// having a very large night in the bike lane.
export const CULTURE = {
  paradeChance: 0.35,   // per-order odds the parade crosses your route
  paradeSize: 8,        // marchers, plus the float
  riotWeight: 0.35,     // chaos-director share for the celebration block
  riotFans: 10,
  riotLife: 60,         // s the party runs before the cops^W despawn
  oncomingCars: [1, 1, 2, 2], // per tier: cars driving your route at you
  strollerPacks: 2,     // sidewalk stroller pairs seeded per route
  nigunRadius: 12,      // m — you hear the humming when you pass close
  drunkChance: 0.6,     // per-order odds of the bike-lane drunk
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
  sidewalk: 0xc2bcae, // concrete — separates street wall from grass interiors
  hydrant: 0xe23d3d,
  waterTower: 0xa9764f, // cedar tank — THE Brooklyn roofline silhouette
  // Street-parked cars: sun-faded Brooklyn curb colors + the inevitable cab.
  carColors: [
    0x3a4a6b, 0x8a8f99, 0x2b2e38, 0x7a3b3b, 0xd9d4c8,
    0x4b6b52, 0xf2c23c, 0x5b4a6b, 0x8f2f2f, 0xe8e5da,
  ],
};

// Retro render pass, SNES edition (art pass 2026-07-04): full-frame nearest-
// neighbor upscale — no fisheye, no TV bezel — with a 16-bit color grade:
// saturation/contrast push, then ordered-dither quantization so gradients
// break into Bayer crosshatch instead of banding.
export const FX = {
  pixelScale: 2,    // render at 1/2 res — finer than the old chunky 1/3
  fov: 70,
  saturation: 1.22, // SNES colors are confident
  contrast: 1.06,
  levels: 31,       // quantization steps per channel (5-bit, era-correct)
};
