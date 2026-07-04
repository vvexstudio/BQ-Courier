# BQ Courier 🚲🥯

A 3D arcade game where you play a food-delivery courier biking through Brooklyn.
Pick up an order, navigate to a **real** Brooklyn address, and survive the chaos
— cars in the bike lane, buses blocking the street, pedestrians materializing
mid-block — to deliver on time for points.

> **Vibe:** _Crazy Taxi_ for the dynamics and intensity, 2007 _Need for Speed_
> for the look. Fast, funny, and built to be screenshotted.

This is an early MVP. **Phases 1–4 are complete (plus most of Phase 5).**
Phase 1 (the world pipeline) pulls real South Williamsburg from OpenStreetMap
and renders it as a stylized, navigable 3D scene — **1779 buildings, 1221
roads, and 64 highlighted bike lanes at 60fps**. Phase 2 (the bike + controls)
drops a **rideable courier bike** into that world: arcade physics with
lean-into-turns, WASD steering, a Crazy-Taxi chase cam, and collision. Phase 3
(the delivery loop) makes it a **game**: orders spawn at **real tagged
addresses** (1437 in the bbox), an A* route renders as a glowing ribbon
in-world and on a **minimap**, and drop-zone arrival scores against a
route-length timer with streak bonuses. Phase 4 makes it **fun**: the street
fights back. Curated Brooklyn obstacles spawn along every route — cars parked
in the bike lane, doors swinging open, phone-zombie jaywalkers, leash
tripwires, trash mountains, a honking school bus, a wrong-way salmon courier.
Hard hits **wipe you out** (1.5s eating asphalt, run continues); shaving past
obstacles at speed scores **near-miss combos**; **Shift bunny-hops** over
leashes and trash; riding unblocked bike lanes or drafting trucks charges a
**boost meter** (E to fire). A street-life pass (sidewalks, ~220 parked cars
with collision, rooftop water towers, hydrants) plus 16 procedural chiptune
SFX (ring the **bell** with B — pedestrians scatter) round out the vibe.
And a **chaos director** keeps the street alive on its own schedule: every
so often a car careens off the road into a hydrant and the geyser erupts for
half a minute (ride the spray for points), and most orders route you past a
school bus double-parked dead across an intersection while its elders hold
an animated debate in the street. The bus is not moving. The bell changes
nothing.

The neighborhood itself keeps showing up: Hasidic families crossing
mid-block and strollers on the sidewalks (pass close and you'll hear a
softly hummed niggun), a pride parade sweeping across your route behind its
float, championship-night crowds mobbing a block around a burning couch,
oncoming cars in your lane, and one guy having a very large night in the
bike lane. The city grades your riding in Yiddish — "MAZEL TOV!" on
delivery, "SHTARK!" at a ×3 combo, "OY GEVALT" when you eat asphalt — over
a sparse procedural lo-fi bed that gets darker as the run escalates (and at
the final tier, stops entirely).

Then the run **escalates**. Every few deliveries the world slides a tier —
*something is off* → *the invasion* → *Armageddon*: sinkholes rumble open
under the asphalt, zombie hordes shamble at slow riders, a flying saucer
tractor-beams anyone dawdling (stay fast — it can't hold a moving target),
airliners come down on the skyline and turn streets into rubble fields, the
sky goes blood-red, lava fissures split the road, and a 55-meter silhouette
walks the horizon, roaring. You still have to deliver the bagels. Grab
**powerups** on the route (pizza = full boost, coffee = overdrive, bagel
shield = one free crash, bodega clock = +12s) and fight back with **Q — the
bagel toss** (stuns zombies for +15 GLAZED).

📋 **[sprintboard.md](./sprintboard.md) is the source of truth** for the roadmap,
changelog, and what to work on next. Read it before starting work; update it
before every commit.

---

## Stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------ |
| Render / loop  | [Three.js](https://threejs.org) (WebGL)                      |
| Map data       | [OpenStreetMap](https://www.openstreetmap.org) via Overpass  |
| Build / dev    | [Vite](https://vitejs.dev)                                   |
| Physics        | Custom arcade (no engine) — feel beats simulation           |

**Why OSM and not Mapbox/Google?** OSM ships *semantic* geometry for free — and
crucially, **bike lanes are tagged** (`highway=cycleway`, `cycleway:*`), which
the core "car blocking the bike lane" gag depends on. Photorealistic options
(Google 3D Tiles, Gaussian splats) are "triangle soup" with no gameplay
semantics and clash with the stylized look. See the decision log in
[sprintboard.md](./sprintboard.md).

**Play it:** https://vvexstudio.github.io/BQ-Courier/ (auto-deployed from
`main` via GitHub Actions).

## Quickstart

```bash
npm install
npm run dev
```

Then open the URL Vite prints (it auto-opens). On first load the app fetches
South Williamsburg from the public Overpass API and caches it in `localStorage`,
so subsequent loads are instant.

- **W / S** throttle & brake-reverse · **A / D** steer · **Space** brake.
- **Shift** bunny hop (clears leashes, trash piles, sinkholes, lava) · **E**
  boost (meter charges on unblocked bike lanes and while drafting vehicles) ·
  **B** bell (scatters pedestrians and pigeons) · **Q** bagel toss (stuns
  zombies, hurries everyone else).
- **O** toggles a debug free-cam (drag to orbit · scroll to zoom · right-drag to pan).
- **On a phone** (portrait, one thumb): the bike auto-throttles from your
  first touch. The lower part of the screen is one gesture surface — hold
  left/right to steer (slide to adjust), tap the bottom strip to JUMP, tap
  the band above the steering to FIRE a bagel, and flick upward anywhere for
  a BOOST burst. No brake: riding into a wall kicks you back automatically.
  Add `?touch` to the URL to force the touch rig on desktop for debugging.
- An order appears automatically — follow the amber route (or the chevron, or
  the minimap) to the pink beacon and ride into the ring before the clock runs out.
- The street fights back: swerve the bike-lane blockers, watch for opening car
  doors, and shave past everything at speed for near-miss combo points. Hard
  hits knock you down for a second and a half — the clock keeps running.

### Other commands

```bash
npm run build     # production bundle into dist/
npm run preview   # serve the production build locally
node scripts/smoke-nav.mjs  # headless check of the routing stack vs live OSM
```

## Project layout

```
src/
  main.js            # entry: world load + game loop (bike, delivery, HUD)
  config.js          # bbox, palette, road widths, bike feel, lane assist, delivery tuning
  render/
    scene.js         # renderer, camera, lights, dusk styling
    chaseCam.js      # third-person chase camera (Phase 2)
    markers.js       # route ribbon, drop beacon, nav chevron (Phase 3)
  entities/
    bike.js          # placeholder bike + rider model (Phase 2)
  game/
    input.js         # keyboard -> throttle/steer/brake intent (Phase 2)
    bikeController.js # arcade physics + lane assist (Phases 2–3)
    collision.js     # building-footprint grid collider (Phase 2)
    delivery.js      # orders, routing, timer, score, streaks (Phase 3)
  ui/
    hud.js           # order card, score, speedo, minimap, toasts (Phase 3)
  world/
    overpass.js      # Overpass API fetch + localStorage cache
    geo.js           # lat/lng -> local meters projection
    buildings.js     # extrude OSM footprints into 3D (+ footprints for collision)
    roads.js         # road ribbons + highlighted bike lanes
    roadGraph.js     # rideable street graph: nearest-road snap + A* routing (Phase 3)
    worldBuilder.js  # orchestrates OSM -> 3D, spawn, addresses, road graph
scripts/
  smoke-nav.mjs      # headless routing smoke test against live Overpass
```

## Changing the location

Edit `WORLD.bbox` in [src/config.js](./src/config.js) — `[south, west, north, east]`
in lat/lng. Keep it to a few blocks for 60fps.

## License

TBD.
