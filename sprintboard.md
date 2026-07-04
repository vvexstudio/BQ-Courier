# BQ Courier — Sprintboard

**This file is the single source of truth for what we're building, what's done,
and what to do next.** Roadmap, changelog, decisions, and risks all live here.

---

## 📌 How to use this file

**For anyone (human or AI) working on this repo:**

1. **Consult before you work.** Read the [Current sprint](#-current-sprint) and
   [Roadmap](#️-roadmap) before picking up a task. Don't invent scope — pull the
   next item from here. If what you want to do isn't listed, add it to the
   [Backlog](#-backlog--icebox) first and confirm priority.
2. **Update before you commit.** Every commit that changes behavior must also
   update this file:
   - Move the task's checkbox to done in the roadmap.
   - Add a dated bullet to the [Changelog](#-changelog).
   - Bump [Current sprint](#-current-sprint) if the focus shifted.
   - Record any non-obvious technical choice in the [Decision log](#-decision-log).
3. **One source of truth.** If code and this file disagree, that's a bug — fix
   the mismatch in the same change. Don't keep a second roadmap anywhere else.
4. **Keep entries terse and dated.** Newest changelog entry on top. Use
   `YYYY-MM-DD`.

> Suggested commit ritual: make the change → update this file → review the diff →
> commit both together.

---

## 🎯 The MVP bar

One playable ride through South Williamsburg: courier on a bicycle, gets an
order, follows a route to a real WB address, dodges a handful of signature
Brooklyn obstacles, delivers, sees a score. **The bar is "the vibe lands"** — if
a first player laughs and says "yep, that's Williamsburg," it worked. Feature-
completeness is explicitly *not* the bar.

---

## 🏃 Current sprint

**Sprint 03 — The delivery loop (Phase 3)**

> Goal: turn the rideable world into a *game with a point*. An order spawns at a
> real WB address, an on-screen arrow points the way, arriving in the drop zone
> fires "Delivered!", and a score + timer track the run.

- **Status:** implemented; in-browser playtest done (scripted rider, 2026-07-03)
  — found and fixed a nav bug (aim point ignored progress along the current
  route segment, so the chevron pointed backward on long blocks). Full loop
  verified: 2 consecutive deliveries with correct scoring/streak, plus the
  expiry path (streak lost, run continues). A human feel-check (fps, handling)
  on real hardware is still worth a ride. Orders spawn at real
  tagged addresses (1437 in the bbox), an A* route over a rideable-roads graph
  renders as a glowing ribbon in-world + on a minimap, a nav chevron points down
  the route, drop-zone arrival scores against a route-length timer with streaks,
  and the HUD is a full "delivery app" layer (order card, timer bar, score,
  speedo, minimap, toasts). Also shipped **lane assist**: hands-off, the bike
  follows the street's curve instead of coasting straight into a facade — the
  navigation complaint from Sprint 02 playtesting.
- **Verified:** Node smoke test against live Overpass — graph builds (1376
  nodes / 1516 segments), origin snaps to a road at 4.5 m, 10/10 routes to
  random addresses succeed (221–707 m). `npm run build` clean.
- **Next up:** human feel-check on real hardware, then Phase 4 (the obstacles).

> **Sprint 02 — The bike + controls (Phase 2): ✅ DONE.** A courier bike now
> rides the verified world. Placeholder bike + rider, arcade physics
> (accel/brake/reverse, speed-scaled steering, lean-into-turns), WASD/arrow
> steering, a Crazy-Taxi chase cam that pulls back with speed, and grid-bucketed
> building collision with axis-slide resolution. Spawns on the nearest road
> facing down it; 'O' toggles a debug free-cam. Verified live: rides at ~72 km/h,
> stops dead at walls, 148fps.

> **Sprint 01 — World pipeline (Phase 1): ✅ DONE.** Real South Williamsburg
> loads as a stylized, navigable 3D scene — **1779 buildings, 1221 roads, 64
> bike lanes at 60fps**, verified live. Shipped through three iterations: initial
> scaffold → styling (first dusk pass was too dark) → two rendering bugfixes
> (roads invisible from above due to ribbon winding; z-fighting + shadow acne on
> the flat layers). Streets and the green bike network render correctly with no
> artifacts at any camera angle. Carryover polish items tracked under Phase 1.

---

## 🗺️ Roadmap

Phases are sequential but the deferred list is designed-for, not built.

### Phase 1 — World pipeline ✅ (complete)

- [x] Project scaffold (Vite + Three.js, dev/build scripts)
- [x] Lat/lng → local-meters projection (`world/geo.js`)
- [x] Overpass fetch + localStorage cache (`world/overpass.js`)
- [x] Building footprint extrusion with height fallback (`world/buildings.js`)
- [x] Road ribbons + highlighted bike lanes (`world/roads.js`)
- [x] Stylized dusk scene: lights, fog, tone mapping (`render/scene.js`)
- [x] Orbit camera to fly around the loaded world (`main.js`)
- [x] **Verify live**: 1779 buildings / 1221 roads / 64 bike lanes @ 60fps in WB.
- [x] Re-tune styling: first dusk pass was too dark; brightened palette + lights,
      boosted bike-lane emissive glow.
- [x] Bugfix: roads/bike lanes invisible from above (ribbon winding) → DoubleSide.
- [x] Bugfix: z-fighting + shadow acne on flat layers → log depth buffer, layer
      separation, shadow bias. Verified clean at all angles.

**Carryover (polish, not blocking Phase 2):**

- [ ] Capture a clean screenshot for the README.
- [ ] Graceful fallback / bundled sample OSM dump for offline + demo reliability.
- [ ] Tune bbox so the start + a plausible delivery address are both in-frame.

### Phase 2 — The bike + controls ✅ (complete)

- [x] Placeholder bicycle model + rider (`entities/bike.js`)
- [x] Arcade physics: accel, braking, reverse, lean into turns (`game/bikeController.js`)
- [x] WASD / arrow steering + Space brake (`game/input.js`)
- [x] Third-person chase cam, pulls back with speed (`render/chaseCam.js`)
- [x] Collision against buildings via footprint grid (`game/collision.js`)
- [x] Spawn on nearest road, facing down it (`world/worldBuilder.js`)
- [x] Debug free-cam toggle ('O') retained from Phase 1's OrbitControls
- [x] **Verify live**: rides to ~72 km/h, leans into turns, stops at walls, 148fps.

### Phase 3 — The delivery loop ✅ (implemented, pending live playtest)

- [x] Order spawns with a target real WB address (`addr:*` tags, `game/delivery.js`)
- [x] Waypoint marker / on-screen arrow to the destination (route ribbon +
      beacon + nav chevron, `render/markers.js`)
- [x] Drop zone arrival detection → "Delivered!" (drop radius on the
      road-snapped route end, toast + celebration pause)
- [x] Score + timer (route-length-derived countdown, time bonus, streak bonus)
- [x] *(bonus)* Rideable-roads graph + A* routing + GPS-style reroute
      (`world/roadGraph.js`)
- [x] *(bonus)* Lane assist — hands-off bike follows the street, not a ruler
      (`game/bikeController.js`, fixes "rides straight into a building")
- [x] *(bonus)* Dense HUD: order card, timer bar, score panel, speedo, live
      minimap, event toasts (`ui/hud.js`, `index.html`)

### Phase 4 — The Brooklyn obstacles (the vibe)

Curated, hand-placed along the route for MVP (not procedural yet):

- [ ] Car parked dead in the bike lane (forces a swerve)
- [ ] Car stopped mid-lane, music thumping, driver unbothered
- [ ] Big slow yellow school bus honking, blocking the street
- [ ] Pedestrians (incl. Hasidic families) stepping out — near-misses
- [ ] One aggressive driver that nudges toward you

### Phase 5 — Juice & share

- [ ] Near-miss bonus + feedback
- [ ] Speed FX (motion blur / bloom — see deferred postprocessing)
- [ ] "Delivered — Score: X" end card designed for screenshots
- [ ] Sound: horns, music snippets, bike bell

---

## 🧊 Backlog / icebox

Designed-for, explicitly **not** in the MVP:

- Vehicle select: e-bike, unicycle, scooter, rollerblades
- Side quests: lox & bagels, puppy from the vet, free curb chair (Park Slope),
  grab a pizza
- Other-courier AI: NPC bikers who help or sabotage
- Procedural / endless obstacle generation
- Multiplayer / leaderboards
- Photoreal backdrop via Google 3D Tiles (distant scenery only)
- Hero Gaussian-splat asset (e.g. a captured bodega or the destination building)
- Postprocessing pass (UnrealBloom + motion blur) for the full NFS look

---

## 🧱 Decision log

Short ADR-style records of choices that aren't obvious from the code.

- **2026-06-19 — Map data: OSM (Overpass), not Mapbox or Google.**
  Game mechanics need *semantic* geometry (drivable roads, collidable buildings,
  and especially **tagged bike lanes** for the bike-lane-blocking gag). OSM ships
  all of that for free with no token/billing/ToS friction; Mapbox lacks bike-lane
  tags in its default tileset. Mapbox remains a fallback source.
- **2026-06-19 — Rejected photoreal sources for the playable world.**
  Google Photorealistic 3D Tiles and Gaussian splats are "triangle soup": no
  road/building separation, no semantics, hard collision-only, and they clash
  with the stylized 2007-NFS art direction. Kept in the icebox as optional
  *backdrop* / *hero asset*, never the play surface.
- **2026-06-19 — Three.js + Vite, vanilla JS.** One scene, no framework needed.
  Vite gives fast dev + `three/addons` imports.
- **2026-06-19 — Arcade physics, not a sim.** Crazy Taxi isn't a simulator; feel
  beats realism. Custom arcade movement planned over a physics engine.
- **2026-06-19 — MVP location: South Williamsburg (~600m bbox).** Hasidic +
  hipster overlap is exactly the cultural collision the game roasts. Small bbox
  keeps Overpass happy and holds 60fps.
- **2026-06-21 — Bike physics: heading *is* travel direction.** No tire/slip
  model or velocity vector — `heading` is yaw and the bike always moves along its
  forward axis. Steering authority scales down with speed (twitchy slow, planted
  fast) and is killed near standstill so it can't pivot in place; lean is a purely
  cosmetic chassis roll. This is the Crazy-Taxi "feel > sim" call from Phase 1,
  made concrete. Reverse inverts steering.
- **2026-06-21 — Collision: footprint grid + axis-slide, not raycasts.**
  Buildings render as one merged mesh, so per-frame raycasts are awkward. The
  builder hands the collider the flat XZ footprint polygons; they're bucketed into
  a 24m uniform grid, and we point-in-polygon test only the bike's current cell.
  Resolution is arcade: on a blocked move, retry each axis alone so the bike
  slides along walls instead of sticking, and bleed speed on contact. Bike is
  treated as a point (no radius) — fine at building scale, revisit if it clips.
- **2026-06-21 — Spawn on the nearest road vertex.** Rather than trust the bbox
  center (which can land inside a building), the builder picks the road-network
  vertex closest to the origin and faces the bike along that segment. Robust to
  bbox retuning and guarantees we start on asphalt pointing down a street.
- **2026-07-02 — Routing graph: weld on raw coordinates, rideable ways only.**
  Overpass `out geom` repeats the *exact* lat/lon of a shared OSM node in every
  way that touches it, so graph nodes are keyed by the raw `lat,lon` string —
  intersections connect with no welding tolerance or node-id pass. Footways,
  steps, and motorway/trunk (the BQE) are excluded from the graph, spawn, and
  minimap: routes must be legally/physically rideable, and footway spawns were
  a source of "spawn facing a wall".
- **2026-07-02 — Lane assist is a steering nudge, not a rail.** The fix for
  "holding W rides into a building" is a per-frame corrective yaw toward a
  look-ahead point on the nearest road (max 1.4 rad/s vs. the player's 2.6),
  active only when steer input is zero, speed > 1.5 m/s, within 12 m of a road,
  and under a 1-rad heading error. Any player steering wins instantly and big
  errors mean "leaving on purpose" — the game must never wrestle the player.
- **2026-07-02 — Delivery timer derives from the actual route.** `baseTime +
  routeLength / paceSpeed` instead of a flat clock, so far orders are fair and
  near ones stay tense. Missing the clock costs the streak, never ends the run
  — arcade forgiveness over roguelike punishment.
- **2026-07-02 — Destinations are real tagged addresses.** Orders target
  buildings with `addr:housenumber` + `addr:street` (1437 in the bbox — WB is
  well tagged), so the order card reads "184 Broadway", not "waypoint 7". The
  drop point is the route's road-snapped end, so arrival never requires
  entering the building footprint.
- **2026-06-19 — Flat-layer rendering: DoubleSide ribbons + logarithmic depth.**
  Road/bike ribbons are built as per-segment quads wound facing down, so they
  must render `DoubleSide` to be visible from above. Ground/road/bike are nearly
  coplanar, so we use `logarithmicDepthBuffer` + explicit vertical separation
  (ground −0.4, road 0.15, bike 0.4) instead of `polygonOffset` (which is
  unreliable with a log depth buffer). Shadow `bias`/`normalBias` handle acne.

---

## ⚠️ Known risks

- **OSM data quality in WB** — building heights are often missing (we fall back
  to a Brooklyn-ish random height); bike-lane coverage must be verified live.
- **Performance** — extruded buildings + obstacles + FX must hold 60fps in a
  browser. Merge geometry, keep the bbox small.
- **Overpass rate limits** — public mirrors are shared; we cache aggressively and
  should ship a bundled sample dump for demo reliability.
- **Scope creep / "humor is the product"** — the map tech is necessary but not
  sufficient. The obstacles and tone are what make it spread; don't let
  engineering eat all the time.

---

## 📓 Changelog

- **2026-07-03** — **Playtest + fix: nav aim point anchored to segment start.**
  In-browser playtest of Phase 3 (scripted rider driving the real
  `bikeCtl.update`/`delivery.update` loop). Found: `aimPoint()` in
  `game/delivery.js` measured the look-ahead from the *start* of the current
  route segment, ignoring the rider's progress along it (`trackProgress`
  computed the projection `t` but discarded it) — on long welded segments
  (100m+ blocks) the nav chevron aimed at a point *behind* the bike until the
  next segment. Fixed by keeping `segT` in state and measuring the look-ahead
  from the rider's projection. Verified post-fix: aim point sits 18 m ahead
  while riding; two consecutive deliveries land with exact expected scores
  (+420, then +444 with the ×2 streak bonus); order expiry correctly drops the
  streak without ending the run; `npm run build` clean.
- **2026-07-02** — **Phase 3 implemented: the delivery loop + navigation.**
  New rideable-roads graph (`world/roadGraph.js`): nodes welded on shared OSM
  coordinates, segment grid for nearest-road queries, A* routing between any
  two world points. Orders (`game/delivery.js`) pick a real `addr:housenumber`
  + `addr:street` building a 140–650 m route away, count down a timer derived
  from route length, detect drop-radius arrival, and score with time + streak
  bonuses; wandering off-route triggers a GPS-style reroute. Navigation renders
  three ways (`render/markers.js`): pulsing amber route ribbon on the street, a
  magenta beacon column + ground ring at the drop, and a chevron over the bike
  aimed ~18 m *along the route* (so it turns at corners). HUD rebuilt as a
  dense delivery-app layer (`ui/hud.js` + `index.html`): order card with cargo
  + distance + timer bar, score/streak panel, big speedo, live minimap (roads,
  route, drop, bike heading), and event toasts. **Lane assist** added to the
  bike controller: when the player isn't steering, the bike yaws gently toward
  a look-ahead point on the nearest road, so holding W follows the street's
  curve instead of drifting into a facade (player input always overrides; it
  disengages off-road). Spawn now restricted to rideable ways (footway spawns
  could face a courtyard wall). Verified via Node smoke test against live
  Overpass (1437 addresses, 10/10 routes OK, `scripts/smoke-nav.mjs`) + clean
  `npm run build`; live in-browser playtest is next.
- **2026-06-21** — **Fix bike "crabbing" / broken turning.** The controller moved
  the bike (and chase cam) along `forward = (sin h, -cos h)`, but Three.js
  `group.rotation.y = h` actually points the model along `(-sin h, -cos h)` — the
  X components have opposite signs, so once you turned, the body pointed one way
  while the bike slid another and steering felt broken. Unified everything on the
  Three.js-native convention `forward = (-sin h, -cos h)` (forwardVec, chaseCam,
  spawn heading), flipped the steer sign so D/right still turns right, and
  re-derived the lean so it tips into the turn. Verified on screen: body tracks
  travel, banks into turns, no crabbing.
- **2026-06-21** — **Phase 2 complete: the bike rides.** Added a placeholder
  bike + rider (`entities/bike.js`), arcade physics (`game/bikeController.js`:
  accel/brake/reverse, speed-scaled steering, lean), WASD/arrow + Space input
  (`game/input.js`), a chase cam that pulls back with speed (`render/chaseCam.js`),
  and building collision via a footprint grid with axis-slide resolution
  (`game/collision.js`). Builder now exports building footprints + a road-based
  spawn. `main.js` reworked into a clamped fixed-step game loop with a HUD speed
  readout and an 'O' debug free-cam. Verified live: accelerates to ~72 km/h,
  leans into turns, stops dead at walls (never clips through), holds 148fps.
- **2026-06-19** — **Fix z-fighting + shadow acne.** Flat layers (ground/road/
  bike) sat within a few cm and fought in the depth buffer; the directional light
  also produced moiré self-shadow speckle. Enabled `logarithmicDepthBuffer`,
  raised the camera near plane (0.1→1), widened layer separation (ground −0.4,
  road 0.15, bike 0.4), and added shadow `bias`/`normalBias`. Verified clean at
  both street level and high/far oblique angles.
- **2026-06-19** — **Bugfix: roads & bike lanes were invisible from above.** The
  ribbon triangles were wound facing down (−Y normals), so `FrontSide` materials
  culled them at any top-down angle — the street grid read as black voids. Set
  road + bike-lane materials to `DoubleSide`. Also raised road/ground contrast
  (lit asphalt vs. dark ground), softened the sun + raised hemisphere fill so
  shadowed streets stay legible, and widened/brightened bike lanes. Streets and
  the green bike network now render correctly.
- **2026-06-19** — Phase 1 verified live in-browser: South Williamsburg loads
  1779 buildings, 1221 roads, 64 bike lanes at 60fps. First dusk styling pass
  was too dark — brightened palette + hemisphere/rim lights, raised tone-mapping
  exposure, and boosted bike-lane emissive glow + width for legibility.
- **2026-06-19** — Project scaffolded. Phase 1 world pipeline implemented and
  runnable: Vite + Three.js setup; OSM Overpass fetch with caching; lat/lng→meters
  projection; building extrusion; road ribbons with highlighted bike lanes;
  dusk-styled scene with orbit camera. Added README and this sprintboard.
  _Status: pending live in-browser verification._
