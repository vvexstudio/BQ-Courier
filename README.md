# BQ Courier 🚲🥯

A 3D arcade game where you play a food-delivery courier biking through Brooklyn.
Pick up an order, navigate to a **real** Brooklyn address, and survive the chaos
— cars in the bike lane, buses blocking the street, pedestrians materializing
mid-block — to deliver on time for points.

> **Vibe:** _Crazy Taxi_ for the dynamics and intensity, 2007 _Need for Speed_
> for the look. Fast, funny, and built to be screenshotted.

This is an early MVP. **Phase 1 (the world pipeline) is complete**: real South
Williamsburg is pulled from OpenStreetMap and rendered as a stylized, navigable
3D scene — **1779 buildings, 1221 roads, and 64 highlighted bike lanes at 60fps**,
with an orbit camera to fly around. Next up is **Phase 2: the bike + controls**.

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
| Physics        | Custom arcade (planned, Phase 2) — feel beats simulation     |

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

- **Drag** to orbit · **scroll** to zoom · **right-drag** to pan.

### Other commands

```bash
npm run build     # production bundle into dist/
npm run preview   # serve the production build locally
```

## Project layout

```
src/
  main.js            # entry: scene + orbit camera + load world (Phase 1)
  config.js          # bbox (the playable area), palette, road widths
  render/
    scene.js         # renderer, camera, lights, dusk styling
  world/
    overpass.js      # Overpass API fetch + localStorage cache
    geo.js           # lat/lng -> local meters projection
    buildings.js     # extrude OSM footprints into 3D
    roads.js         # road ribbons + highlighted bike lanes
    worldBuilder.js  # orchestrates the OSM -> 3D pipeline
```

## Changing the location

Edit `WORLD.bbox` in [src/config.js](./src/config.js) — `[south, west, north, east]`
in lat/lng. Keep it to a few blocks for 60fps.

## License

TBD.
