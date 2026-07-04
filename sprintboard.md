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

**Sprint 04 — The Brooklyn obstacles + juice (Phases 4–5)**

> Goal: make it *fun*. The street becomes the antagonist: curated obstacles
> seeded along every route, stakes (the wipeout), rewards for skill (near-miss
> combos), two new verbs (bunny hop, boost), a street-life density pass, and a
> procedural chiptune SFX layer.

- **Status:** implemented (2026-07-04). Shipped in one pass:
  - **Wipeout**: any hard hit above 5.5 m/s knocks the rider down for 1.5 s
    (tumble pose, control lock, boost spilled). The run never ends — the
    seconds are the punishment.
  - **Near-miss combos**: passing within ~2.4 m of any obstacle above 7 m/s
    scores +25 × combo (4 s window). Crash resets the combo.
  - **Obstacle bestiary** (`entities/props.js` + `game/traffic.js`): car
    parked in the bike lane (hazards blinking), the dooring (door swings open as
    you approach), phone-zombie + Hasidic-family jaywalkers, dog walker
    whose leash is a hoppable tripwire, trash-bag mountain (soft, bursts),
    angled box truck (reversing beeps), pigeon flocks (scatter for +5/bird),
    roaming cars + school bus that follow the street graph and honk, and the
    salmon — a courier riding the wrong way down *your* route.
  - **Route seeding**: obstacles spawn procedurally along the active A* route
    every ~52 m (reseeded on new order + reroute); bike-lane segments prefer
    lane blockers — the gag is a spawn rule.
  - **Two verbs**: Shift bunny-hop (clears leashes/trash, softer steering
    midair) and E boost (meter charges from riding unblocked bike lanes and
    drafting vehicles; +45% top speed).
  - **Street life** (`world/streetlife.js`): sidewalks on every dressed
    street, ~220 curb-parked cars *with collision*, 55 rooftop water towers,
    380 AC units, hydrants, trash cans.
  - **Sound** (`audio/sfx.js`): 13 procedural WebAudio chiptune SFX — bell
    (B, scatters pedestrians + pigeons), crash, whoosh, stings, horn, etc.
- **Verified:** `npm run build` clean; live in-browser playtest with a
  scripted route-following rider (see changelog). 59 fps with the full
  density pass + 20 active obstacles.
- **Addendum (same day): the chaos director.** Unscripted set pieces near the
  player — runaway car → hydrant geyser (rideable spray, +15), and the
  intersection bus summit with arguing elders (see changelog). Live-verified:
  geyser erupts behind the slewed wreck, summit bus + elders read perfectly
  at chase-cam range, reseed-per-order stable (found + fixed a salmon-cleanup
  crash that silently killed obstacle seeding after the first order).
- **Next up:** human feel-check + tuning pass (obstacle density, near-miss
  band), then Phase 5 leftovers: end card, speed FX, awning/storefront pass.

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

### Phase 4 — The Brooklyn obstacles (the vibe) ✅ (implemented 2026-07-04)

Shipped as *procedural placement of curated types* along the active route
(better than hand-placing: every order is a fresh gauntlet):

- [x] Car parked dead in the bike lane, hazards blinking (forces a swerve)
- [x] The dooring — parked car's door swings open as you approach
- [x] Big slow yellow school bus honking, roaming the street graph
- [x] Pedestrians (incl. Hasidic families, phone zombies) crossing mid-block
- [x] Dog walker with a leash tripwire (bunny-hop over it)
- [x] Trash-bag mountain (soft: bursts, slows, +10)
- [x] Box truck angled mid-reverse, beeping
- [x] Pigeon flock (scatters for +5/bird)
- [x] The salmon — courier riding the wrong way down your route
- [x] *(mechanics)* Wipeout crash state, near-miss combo scoring, bunny hop
      (Shift), boost meter (E; charged by bike lanes + drafting)
- [ ] One aggressive driver that nudges toward you (deferred — roamers don't
      target the player yet)

### Phase 6 — The escalation ✅ (implemented 2026-07-04)

The run ends the world: delivery-driven tier ladder (3/6/9), environment
slide to a red-sky hellscape, sinkholes → zombie hordes + saucer + plane
crashes → lava + kaiju, powerups (pizza/coffee/bagel shield/clock), and the
bagel toss (Q). See the changelog for the full inventory. Deliberately
excluded: any real-world terror-attack framing — plane crashes are generic
disaster-movie mayhem with nobody at the controls.

### Phase 5 — Juice & share (partially shipped 2026-07-04)

- [x] Near-miss bonus + feedback (ticker + combo multiplier + whoosh)
- [x] Sound: procedural chiptune SFX — bell, horns, crash, stings (`audio/sfx.js`)
- [x] Street-life density pass: sidewalks, parked cars, water towers, AC units,
      hydrants, trash cans (`world/streetlife.js`)
- [ ] Speed FX (motion blur / bloom — see deferred postprocessing)
- [ ] "Delivered — Score: X" end card designed for screenshots (needs a run
      structure — currently endless)
- [ ] Storefront awnings with procedural names (the Williamsburg roast)

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
- **2026-07-04 — Obstacles: procedural placement of curated types, seeded on
  the route.** Instead of hand-placing (the original Phase 4 plan) or a world-
  wide spawner, obstacles spawn along the *active A\* route* (~every 52 m,
  reseeded per order/reroute, bike-lane segments biased toward lane blockers).
  Hand-set feel, fresh gauntlet every order, and zero cost for streets the
  player never sees. Dynamic obstacles use circle colliders resolved in
  `traffic.js` (push-out + crash/bump/soft), *not* the footprint grid — they
  move and need near-miss distance anyway. Static parked cars go the other
  way: rectangle footprints injected into the existing building collider.
- **2026-07-04 — Boost charges from riding well, not from pickups.** The meter
  fills while riding an unblocked bike lane or drafting a vehicle. This makes
  the bike-lane-blocker gag *mechanical*: a car in your lane is stealing your
  boost line, not just your path. Crash spills the whole meter.
- **2026-07-04 — Sound is synthesized, not sampled.** 13 SFX from oscillators
  + one noise buffer (`audio/sfx.js`): zero assets, zero load time, fits the
  16-bit register, and the AudioContext unlock (first keydown) is the only
  ceremony. Sampled audio stays open for music later.
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

- **2026-07-04 (night)** — **Deploy: GitHub Pages on every push to main.**
  `.github/workflows/deploy.yml` builds with Node 20 + `npm ci` and ships
  `dist/` through the official Pages artifact flow (no gh-pages branch).
  `vite.config.js` gains `base: './'` so assets resolve from the
  `/BQ-Courier/` subpath (verified: dist emits `./assets/…`).
  `configure-pages` auto-enables Pages with the Actions source on first
  run; if that step 403s, enable it once under Settings → Pages. Live URL:
  https://vvexstudio.github.io/BQ-Courier/
- **2026-07-04 (evening)** — **Phase 6.5: the neighborhood, turned up.**
  Street culture layer (`CULTURE` config; props from a parallel subagent in
  `entities/streetparty.js`) + a music bed:
  - **The celebration** (chaos director, any tier): the Knicks finally won
    and this block is where everyone went — 10 jumping fans in orange and
    blue mobbing the street around a burning couch, crowd-chant SFX in
    range, ~60 s. Fans are dead-stop bumps ("GO KNICKS"); the couch is
    furniture, furniture is hard.
  - **The parade** (35%/order): a float + 8 marchers with rainbow flags
    sweeping back and forth across a block on the route; whistles + cheers
    in range; thread the gaps for near-misses.
  - **Oncoming traffic** (1–2/order by tier): cars driving the player's
    route the wrong way, weaving off their line, horn inside 15 m — the
    salmon's four-wheeled cousins.
  - **More neighbors**: crossing groups are now all-Hasidic families (wider
    spawn band), plus 2 stroller pairs per route pacing the sidewalks —
    pass within 12 m and you hear a soft hummed **niggun** (synthesized,
    wordless, warm — a melody on a stoop, not a caricature).
  - **The drunk** (60%/order): weaving from the parked cars to the middle
    of the bike lane and back, throttled hiccup in range, dead-stop bump
    ("HE'S FINE").
  - **Yiddish scoring**: DELIVERED → "MAZEL TOV!", wipeouts → "OY GEVALT —
    …", combo ≥3 → "SHTARK!", combo ≥5 → "A MECHAYEH!", expiry → "oy vey".
  - **Music** (`audio/sfx.js`): a sparse procedural lo-fi bed at 84 BPM on
    its own gain bus (~0.07 effective — under every SFX): bass root on the
    one, occasional fifth, whispered hats, a filtered pad every other bar.
    Follows the escalation: warm → wary → minor → at tier 3 the music stops
    and only a 55 Hz ground-hum drone remains. Standard lookahead
    scheduler; starts on the first keypress with the audio unlock.
  - Set pieces gained a generic `dispose()` in the lifecycle; the debug
    handle now exposes manual triggers (`_debug.spawnRiot` etc.) — used to
    stage verification shots.
  - **Verified live:** celebration (fans + burning couch on the route
    ribbon), parade (rainbow flags crossing, float leading, salmon
    threading it), 2 stroller pairs + 3 families + oncoming car seeded per
    order, `npm run build` clean, zero console errors. Playtest note: the
    preview tab throttles rAF when backgrounded — game state is fine, it's
    a headless-tab artifact, not a bug.
- **2026-07-04 (later still)** — **Phase 6: the escalation. The run now ends
  the world.** A tier ladder driven by deliveries (3/6/9 →
  SOMETHING IS OFF / THE INVASION / ARMAGEDDON, `game/escalation.js` +
  `ESCALATION` config) lerps the whole environment per frame — sky, fog,
  sun, hemisphere — from Brooklyn afternoon to a blood-red hellscape, and
  arms tier-gated spawn tables in the obstacle system:
  - **Sinkholes** (T1+): sleep under the asphalt, rumble open as you
    approach; ride in on the ground and you're SWALLOWED BY BROOKLYN
    (wipeout + fished out at the rim). Hop over the gap.
  - **Zombie hordes** (T2+): packs that mill, then shamble at you in scent
    range. Plow through above 8 m/s for +10 BOWLED OVER; roll up slow and
    they GRAB (heavy slow — pedal out). Groan SFX in range.
  - **The saucer** (T2+): cruises the streets at altitude; locks onto slow
    riders — beam down, gentle lift, and at ~5.5 m it loses interest and
    drops you (new hard-landing rule: touching down faster than −7.5 m/s is
    a crash). Counterplay: stay above ~11 m/s and it can't hold you.
  - **Plane crashes** (T2+, chaos director): a generic airliner comes in
    low, hits a block near the route — explosion, and the street below
    becomes a rubble field (hard obstacles, ~45 s). No one is flying these;
    it's the apocalypse, planes just do this.
  - **Lava fissures** (T3): glowing cracks across the road; ride through =
    TOASTED (heavy slow, 1.5 s burn cooldown), hop clears.
  - **The kaiju** (T3): a 55 m silhouette walking a slow ring outside the
    bbox, roaring on a timer. Pure horizon dread; he never enters the map.
  - **Powerups** (`game/powerups.js`, 2/route): pizza = boost meter full,
    coffee = 9 s overdrive (+35% top speed), bagel shield = absorbs the next
    crash (shield state in the controller; crash() consumes it and returns
    false), bodega clock = +12 s on the order (clamped to the limit).
  - **The bagel toss** (Q, `BAGEL` config): arcing projectile; direct hit
    stuns a zombie 6 s for +15 GLAZED, and works as an insistent bell on
    pedestrians/pigeons — *on a direct hit only* (found live: reusing
    onBell meant bagels detonated at the 11 m bell radius; onBell now takes
    a radius override).
  - 8 new synthesized SFX: explosion, roar, rumble, ufo, groan, pickup,
    toss, glazed. Escalation tier toasts. Prop meshes built in parallel by a
    subagent (`entities/apocalypse.js`, 10 factories, spec-matched).
  - **Verified live:** tiers climb on schedule, sky reaches #8e1f1f, T3
    route seeds 3 sinkholes + 2 hordes + 4 lava cracks alongside the normal
    bestiary, zombies chased and *grabbed the rider mid-screenshot*, bagel
    glaze deterministically probed (stun 6.0 → decay, +15), UFO + kaiju
    present, powerups seeded, 60 fps in full Armageddon, zero console
    errors, `npm run build` clean.
- **2026-07-04 (later)** — **The chaos director: unscripted street theater.**
  Two set pieces that fire *near the player* instead of being seeded on the
  route (`CHAOS` in config, logic in `game/traffic.js`):
  - **Hydrant catastrophe**: every 13–25 s the director picks a hydrant
    30–95 m from the bike, launches a hazard-blinking car off the nearest
    road (fishtailing, skid SFX), crashes it into the hydrant, and erupts a
    water geyser (jittering column + ballistic droplets + splash ring,
    `makeGeyser` in `entities/props.js`). The wreck is a hard obstacle for
    ~30 s; riding through the spray pays "SHOWERED +15". Hydrant positions
    now exported from `world/streetlife.js`.
  - **The intersection summit**: per order (75%), a *lettered* school bus
    (white side boards with blocky marks — suggestion, not typography) parks
    dead across the first real intersection (graph nodes with 3+ incident
    segments) past the route's opening stretch, and 2–4 elders (`makeElder`:
    long coat, brimmed hat, beard, arms that *actually gesticulate*, with
    periodic emphatic flourishes) hold a debate in the street. Within
    earshot you hear the argument — a synthesized two-voice nonverbal mutter
    (`sfx.argue`: rhythm and pitch, no words). The bus and the elders are
    near-missable; hitting an elder is a dead-stop bump ("WATCH THE
    ELDERS"), never a wipeout. Ringing the bell gets you "THE SUMMIT
    CONTINUES". New SFX: skid, splash, argue. Generalized the dog's
    no-wipeout collider into a `stop`-labeled circle both use.
- **2026-07-04** — **Phases 4+5 (partial): the street fights back.** One big
  pass, live-verified in-browser with a scripted route-following rider:
  - `game/traffic.js` + `entities/props.js`: dynamic obstacle layer. Curated
    Brooklyn hazards seeded procedurally along the active route (~every 52 m,
    reseeded on order/reroute; bike-lane segments prefer the lane-blocker gag):
    hazard-blinking lane blocker, dooring car (door swings on approach), phone
    zombie + Hasidic family crossers, dog walker with hoppable leash tripwire,
    bursting trash pile, angled box truck (reverse beeps), pigeon flocks
    (+5/bird flushed). Roamers follow the street graph forever: cruising cars,
    honking school bus, and the salmon — a wrong-way courier riding your route
    at you, weaving. Circle colliders vs. the bike; hard fast hits wipe out,
    slow ones bump, soft ones slow + amuse.
  - `game/bikeController.js`: **wipeout** (hard hit > 5.5 m/s → 1.5 s down,
    tumble pose, boost spilled, run continues), **bunny hop** (Shift; clears
    leash/trash; 0.4× steering midair), **boost** (E; meter charges riding
    unblocked bike lanes + drafting vehicles, +45% top speed / +70% accel;
    road-graph segments now carry a `bike` flag for the lane check).
  - **Near-miss combos**: pass within 2.4 m above 7 m/s → +25 × combo, 4 s
    window, crash resets. Scored through `delivery.addScore`.
  - `world/streetlife.js`: density pass — sidewalk ribbons on all dressed
    streets, 220 curb-parked cars (merged geometry + collider footprints, so
    they crash like buildings), 55 water towers, 380 AC units, 90 hydrants,
    130 trash cans. `buildings.js` exports roof records for tower placement.
  - `audio/sfx.js`: 13 procedural WebAudio chiptune sounds, no assets — bell
    (B; scatters peds + pigeons via `traffic.ring`), crash, whoosh, order/
    win/lose stings, hop, boost, horn, reverse beep, flutter, creak, blip.
  - HUD: event ticker (near-miss/combo/wipeout), boost bar under the speedo,
    updated help line. New keys: Shift hop, E boost, B bell.
  - **Verified live:** full delivery (+596 with time bonus) → immediate
    wipeout on the next leg → remount → riding again; near-miss +25 fired;
    boost charged to 22 and spilled to 0 on the crash; obstacles reseeded on
    the new order; 59 fps with everything on; zero console errors. `npm run
    build` clean. (Overpass mirrors were down for the *Node* smoke test —
    failure is in the fetch, pre-existing; browser used the cached/live copy.)
- **2026-07-04** — **Lighting fix: street canyons were black.** At street
  level, every facade facing away from the low sun rendered near-silhouette —
  the daytime palette never reached the walls (likely the root of "graphics
  aren't great"). Raised the sun (120,300,60 @ 1.3) so canyons catch light and
  turned the hemisphere into a real ambient (near-white sky/ground colors,
  intensity 2.2 — vertical walls only take ~half of a hemisphere). Tuned live
  in-browser; facades now read as their brick/terracotta/pastel colors from
  the chase cam. Also shuffled street-life way order so the parked-car /
  hydrant caps spread across the whole bbox instead of exhausting on the
  first ways Overpass returns.
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
