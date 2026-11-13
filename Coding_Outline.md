# Project Context: The Autonomous Haulage Vanguard

## 1. Core Architecture & File Structure
- **Tech Stack:** Vanilla ES6+ JavaScript Modules (`type="module"`), HTML5 2D `<canvas>` 3D perspective projection + hybrid 2D sprite/3D mesh rendering, Web Audio API procedural synthesis, and offline-capable Service Worker PWA (`sw.js`, `manifest.json`).
- **Strict Separation of Concerns:**
  - `src/config/*.config.js`: Pure data definitions:
    - `sensors.config.js`: Sensor stats, min/max range windows, FOV angles, dust penetration, radar jitter, power/weight costs, and upgrade scaling.
    - `equipment.config.js`: Truck chassis tiers (`Mk.I Hauler`, `Mk.II Titan`, `Mk.III Ultra`), structural hardpoints (`front_bumper`, `roof_mast`, `fender_left`, `fender_right`), and power/mass validation.
    - `levels.config.js`: Four themed driving sectors (`bench_upper` = `DUSTY`, `decline_portal` = `MUDDY`, `abyssal_stope` = `RAINY`, `arctic_glacier` = `SNOWY`), depths, ambient hazard density, and active spawn pools.
    - `rewards.config.js`: Multiplier gate definitions (`GATE_POOLS`) and ore vein payload types (`ORE_TYPES`).
  - `src/core/`:
    - `loop.js`: Fixed 60fps timestep game loop (`GameLoop`).
    - `input.js`: Direct 1:1 cursor/touch-tracking steering (`clientXToSteer` calibrated to `project3D` at `z = 3.1`), keyboard fallback, and tap-to-purge (`onPurgeCallback`) (`InputController`).
    - `state.js`: Active run telemetry, mounted sensor health/calibration, hull integrity, optic clarity, and world entities (`RunState`).
    - `saveManager.js`: `localStorage` persistence (`VANGUARD_SAVE_LEDGER_V1`) plus JSON file export/import (`SaveManager`).
  - `src/systems/`:
    - `perceptionSystem.js`: Evaluates mounted sensor frustums, min-range deadzones, max-range horizons, dust attenuation, per-point pit visibility (`getPointVisibility`), and high-pressure wiper Optic Purge (`PerceptionSystem`).
    - `spawnerSystem.js`: Spawns balanced waves of dual multiplier gates, ore veins, static hazards, and bounded-patrol moving vehicles/rockslides (`SpawnerSystem`).
    - `collisionSystem.js`: Direct 1:1 lateral tracking (`CollisionSystem`), compact truck footprint collision checks, ore extraction, gate buffs, and mud/kinetic hazard impacts.
    - `audioSystem.js`: Procedural Web Audio turbine rumble, LiDAR sweep pings, gate chimes, ore pickup tones, impact crunches, and pneumatic wiper hiss (`AudioSystem`).
  - `src/render/`:
    - `modelRegistry.js`: Hybrid **2D Sprite (`.png`/`.svg`) & 3D Mesh (`.obj`/procedural)** registry (`ModelRegistry`). Preloads `./Truck_Model.png`, `./boulder.png`, and `./pickup.png`, alongside 3D polyhedral fallbacks.
    - `canvasRenderer.js`: 3D perspective projection (`project3D` with `camX = truckX * 0.12` for direct pointer-to-truck alignment), `Truck_Model.png` chase-cam rendering with condition-matched tire spray (`drawTireConditionSpray`) and lens occlusion (`drawMudOcclusionOverlay`), instant-read ground signatures, and multi-modal entity rendering (`CanvasRenderer`).
    - `sensorLayers.js`: Renders cartoony-realistic condition backdrops (`renderConditionBackground`), themed open-pit haul roads with puddles/drifts/snowbanks (`renderHaulRoadPit`), horizon-preserving dark fog shroud (`renderDarkFogOverlay`), and animated weather particles (`renderWeatherParticles`) (`SensorLayersRenderer`).
    - `rigPreviewRenderer.js`: Interactive top-down schematic canvas (`#rig-preview-canvas`) in the Rigging Bay showing `Truck_Model.png` facing upward with live sensor FOV cones, range windows, and near-field blind spots (`RigPreviewRenderer`).
    - `hudRenderer.js`: Updates diegetic cab telemetry (`DEPTH`, `VELOCITY`, `PAYLOAD`, `HORIZON`), hull/optic gauges, hardpoint health readouts, and the wiper sweep animation (`HudRenderer`).

---

## 2. Multi-Modal Perception Mechanics & Trade-Offs
Areas of the haul road pit not illuminated by an active sensor frustum are shrouded in **Subterranean Dark Fog**. Each sensor has distinct strengths and blind spots:

1. **Short-Range Perimeter LiDAR (`short_lidar`):**
   - **Window:** `1m–30m` (`180°` wide perimeter cone).
   - **Role & Trade-Off:** High-density cyan/color-coded 3D point-cloud and wireframe right around the bumper and berms. Pinpoints close obstacles, but is **completely blind beyond 30m**.
2. **Long-Range Forward LiDAR (`long_lidar`):**
   - **Window:** `32m–155m` (`34°` narrow forward tunnel beam).
   - **Role & Trade-Off:** Projects green topographic pit scanlines and 3D wireframes deep down the haul corridor, but suffers from a **32m near-field blind spot (`BLIND <32m`)** right in front of the truck.
3. **4D Imaging Doppler Radar (`radar_4d`):**
   - **Window:** `6m–120m` (`68°` medium cone).
   - **Role & Trade-Off:** Pierces **100% of silica dust and dark fog** and displays steady bounding boxes and Doppler velocity vectors (`v=m/s`) on moving traffic, at higher power/mass cost and `6m` minimum range.
4. **AI Optical & Thermal Camera (`optical_cam`):**
   - **Window:** `2m–42m` (`60°` floodlight cone).
   - **Role & Trade-Off:** Illuminates true 3D surface shading, decodes multiplier gate math (`[ARRAY GAIN +25%]`), and classifies ore grades, but has short range and degrades into `[GATE: ???]` static when `opticClarity < 0.48` until cleared via **Optic Purge**.

---

## 3. Spatial Hardpoint Rigging & Mobile UI
- **Upward-Facing Spatial Workbench:** In the Rigging Bay (`#screen-garage`), the haul truck (`Truck_Model.png`) faces **UP** toward the top of the screen.
- **4 Physical Hardpoints:** Clickable spatial pills are positioned directly around the truck matching their physical mounts:
  - `front_bumper` (`▲ BUMPER` — Top-Center): `+35%` point detail, `0.9x` range, high mud/impact exposure.
  - `fender_left` (`◄ LEFT` — Port Side): `-0.85m` left lane frustum bias, `1.05x` range.
  - `fender_right` (`RIGHT ►` — Starboard Side): `+0.85m` right lane frustum bias, `1.05x` range.
  - `roof_mast` (`● ROOF` — Bottom-Center over Cab): `+35%` far-field range (`1.35x`), `+25%` dust bypass, low mud vulnerability.
- **Mobile Optimization:** Responsive CSS (`@media (max-width: 760px)`) compacts the schematic stage, uses concise role badges, and hides secondary prose so rigging requires minimal scrolling on phones.
- **Mid-Run Exit:** Players can abort a run at any time via the top-right `EXIT ×` button (`#btn-exit-level`), banking all ore credits extracted up to that point.

---

## 4. High-Speed Object Readability & Custom Asset Hooks
- **Simplified Active Spawn Pool (Other Hazards Preserved in Memory):**
  - Currently, only **Payloads (`category: 'ore'`)**, **Static Boulders (`boulder`)**, and **Moving Pickups (`service_truck`)** actively spawn in [`levels.config.js`](file:///c:/Users/samir/Desktop/Mobile%20Game%20-%20Truck/src/config/levels.config.js) and [`spawnerSystem.js`](file:///c:/Users/samir/Desktop/Mobile%20Game%20-%20Truck/src/systems/spawnerSystem.js). All other obstacle and gate definitions (`clay_slick`, `dust_plume`, `rockslide`, `trench`, `rogue_loader`, `drill_drone`, `gate`) remain intact in memory for future activation.
- **Instant Visual Archetypes:**
  - **Payloads (`category: 'ore'`):** Signified by a large, glowing green **`$`** symbol floating above a green diamond floor ring (`#00ff66`).
  - **Static Obstacles (`boulder`):** Rendered using [`boulder.png`](file:///c:/Users/samir/Desktop/Mobile%20Game%20-%20Truck/boulder.png) anchored on a crimson hazard pad (`#ff3344`).
  - **Moving Obstacles (`service_truck`):** Rendered using [`pickup.png`](file:///c:/Users/samir/Desktop/Mobile%20Game%20-%20Truck/pickup.png) (automatically flipped to face its lateral travel direction) within bounded patrol zones (`patrolMinX` / `patrolMaxX`).
- **Adding Custom 2D Sprites or 3D `.OBJ` Models:**
  - **2D Sprite Image (`.png` / `.svg`):**
    ```js
    modelRegistry.loadSprite('truck', './Truck_Model.png');
    modelRegistry.loadSprite('boulder', './boulder.png');
    modelRegistry.loadSprite('service_truck', './pickup.png');
    ```
  - **3D Wavefront Mesh (`.obj`):**
    ```js
    modelRegistry.loadOBJ('boulder', './assets/boulder.obj', { scale: 0.8 });
    ```
