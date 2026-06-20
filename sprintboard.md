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

**Sprint 01 — World pipeline (Phase 1)**

> Goal: real Williamsburg geometry loads as a stylized, navigable 3D scene. This
> is the riskiest part, so it goes first — if the map pipeline works, everything
> else builds on top.

- **Status:** scaffolded & runnable. Needs in-browser verification against live
  Overpass data (building heights, bike-lane coverage, framerate).
- **Next up:** verify the data quality for the chosen bbox, then start Phase 2
  (the bike + controls).

---

## 🗺️ Roadmap

Phases are sequential but the deferred list is designed-for, not built.

### Phase 1 — World pipeline ⏳ (in progress)

- [x] Project scaffold (Vite + Three.js, dev/build scripts)
- [x] Lat/lng → local-meters projection (`world/geo.js`)
- [x] Overpass fetch + localStorage cache (`world/overpass.js`)
- [x] Building footprint extrusion with height fallback (`world/buildings.js`)
- [x] Road ribbons + highlighted bike lanes (`world/roads.js`)
- [x] Stylized dusk scene: lights, fog, tone mapping (`render/scene.js`)
- [x] Orbit camera to fly around the loaded world (`main.js`)
- [ ] **Verify live**: confirm WB building heights, bike-lane coverage, and 60fps
      in-browser; capture a screenshot for the README.
- [ ] Graceful fallback / bundled sample OSM dump for offline + demo reliability.
- [ ] Tune bbox so the start + a plausible delivery address are both in-frame.

### Phase 2 — The bike + controls

- [ ] Placeholder bicycle model + rider
- [ ] Arcade physics: accel, braking, lean into turns (feel > simulation)
- [ ] WASD / arrow steering
- [ ] Third-person chase cam (Crazy-Taxi style)
- [ ] Collision against buildings (can't drive through walls)

### Phase 3 — The delivery loop

- [ ] Order spawns with a target real WB address
- [ ] Waypoint marker / on-screen arrow to the destination
- [ ] Drop zone arrival detection → "Delivered!"
- [ ] Score + timer

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

- **2026-06-19** — Project scaffolded. Phase 1 world pipeline implemented and
  runnable: Vite + Three.js setup; OSM Overpass fetch with caching; lat/lng→meters
  projection; building extrusion; road ribbons with highlighted bike lanes;
  dusk-styled scene with orbit camera. Added README and this sprintboard.
  _Status: pending live in-browser verification._
