# BQ Courier 🚲🥯

A 3D arcade game where you play a food-delivery courier biking through Brooklyn.
Pick up an order, navigate to a **real** Brooklyn address, and survive the chaos
— cars in the bike lane, buses blocking the street, pedestrians materializing
mid-block — to deliver on time for points.

> **Vibe:** _Crazy Taxi_ for the dynamics and intensity, 2007 _Need for Speed_
> for the look. Fast, funny, and built to be screenshotted.

This is an early MVP. **Phases 1–3 are complete.** Phase 1 (the world pipeline)
pulls real South Williamsburg from OpenStreetMap and renders it as a stylized,
navigable 3D scene — **1779 buildings, 1221 roads, and 64 highlighted bike lanes
at 60fps**. Phase 2 (the bike + controls) drops a **rideable courier bike** into
that world: arcade physics with lean-into-turns, WASD steering, a Crazy-Taxi
chase cam, and collision so you can't ride through walls. Phase 3 (the delivery
loop) makes it a **game**: orders spawn at **real tagged addresses** (1437 in
the bbox), an A* route over the street graph renders as a glowing ribbon
in-world and on a **minimap**, a nav chevron leads the way, and drop-zone
arrival scores against a route-length timer with streak bonuses — all wrapped
in a dense delivery-app HUD. Hands-off, **lane assist** keeps the bike tracking
the street's curve instead of drifting into a facade. Next up is **Phase 4: the
Brooklyn obstacles** (the vibe).

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

## Quickstart

```bash
npm install
npm run dev
```

Then open the URL Vite prints (it auto-opens). On first load the app fetches
South Williamsburg from the public Overpass API and caches it in `localStorage`,
so subsequent loads are instant.

- **W / S** throttle & brake-reverse · **A / D** steer · **Space** brake.
- **O** toggles a debug free-cam (drag to orbit · scroll to zoom · right-drag to pan).
- An order appears automatically — follow the amber route (or the chevron, or
  the minimap) to the pink beacon and ride into the ring before the clock runs out.

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
