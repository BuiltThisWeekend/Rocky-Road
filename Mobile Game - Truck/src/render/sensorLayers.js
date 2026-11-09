export class SensorLayersRenderer {
  constructor() {
    this.scanPhase = 0;
  }

  renderAllLayers(ctx, renderer, runState, perceptionSystem) {
    this.scanPhase = (this.scanPhase + 0.04) % 1;
    const env = runState.perceptionEnvelope;

    // Layer 1: Excavated Haul Road Pit Geometry (Roadbed, Earthen Safety Berms, Terraced Benches)
    // Only visible where sensors clear the subterranean dark fog!
    this.renderHaulRoadPit(ctx, renderer, runState, env, perceptionSystem);

    // Layer 2: Long-Range LiDAR Sweeping Green Pit Scanlines (Starts ONLY beyond longLidarMinZ!)
    if (env.longLidarRange > env.longLidarMinZ) {
      this.renderLongRangeLidar(ctx, renderer, runState, env);
    }

    // Layer 3: Short-Range LiDAR High-Density Cyan Perimeter Point Cloud (Near-field only!)
    if (env.shortLidarRange > env.shortLidarMinZ) {
      this.renderShortRangeLidar(ctx, renderer, runState, env);
    }

    // Layer 4: World Entities (3D Models with LiDAR Wireframes, Imprecise 4D Radar Boxes, & AI Camera Shading)
    this.renderEntitiesMultiModal(ctx, renderer, runState, env, perceptionSystem);

    // Layer 5: 3D Haul Truck Model (Foreground Chase View with Mounted Sensor Hardpoints)
    renderer.draw3DTruck(ctx, runState);

    // Layer 6: Subterranean Dark Fog Mask (Shrouds any area where no active sensor beam reaches)
    this.renderDarkFogOverlay(ctx, renderer, runState, env);
  }

  renderHaulRoadPit(ctx, renderer, runState, env, perceptionSystem) {
    const maxZ = Math.min(175, Math.max(12, env.maxIlluminatedZ * 1.08));
    const stepZ = 4.5;
    const scrollOffset = runState.distanceTraveled % stepZ;

    ctx.save();

    // Render pit slices from far to near so closer slices overlap cleanly
    for (let baseZ = Math.floor(maxZ / stepZ) * stepZ; baseZ >= 3.5; baseZ -= stepZ) {
      const zNear = baseZ - scrollOffset;
      const zFar = zNear + stepZ;
      if (zNear < 1.8) continue;

      const visCenter = perceptionSystem.getPointVisibility(runState.truckX, zNear, runState);
      const visLeft = perceptionSystem.getPointVisibility(-1.6, zNear, runState);
      const visRight = perceptionSystem.getPointVisibility(1.6, zNear, runState);
      const sliceVis = Math.max(visCenter, visLeft, visRight);

      if (sliceVis <= 0.02) continue; // Completely engulfed in dark fog (e.g., inside LR-LiDAR near deadzone if SR-LiDAR is unmounted)

      const rdNearL = renderer.project3D(-1.55, 0, zNear, runState);
      const rdNearR = renderer.project3D(1.55, 0, zNear, runState);
      const rdFarL = renderer.project3D(-1.55, 0, zFar, runState);
      const rdFarR = renderer.project3D(1.55, 0, zFar, runState);

      const bermTopNearL = renderer.project3D(-1.88, 0.68, zNear, runState);
      const bermTopFarL = renderer.project3D(-1.88, 0.68, zFar, runState);
      const bermTopNearR = renderer.project3D(1.88, 0.68, zNear, runState);
      const bermTopFarR = renderer.project3D(1.88, 0.68, zFar, runState);

      const bench1NearL = renderer.project3D(-3.1, 2.3, zNear, runState);
      const bench1FarL = renderer.project3D(-3.1, 2.3, zFar, runState);
      const bench1NearR = renderer.project3D(3.1, 2.3, zNear, runState);
      const bench1FarR = renderer.project3D(3.1, 2.3, zFar, runState);

      const benchFlatNearL = renderer.project3D(-3.9, 2.3, zNear, runState);
      const benchFlatFarL = renderer.project3D(-3.9, 2.3, zFar, runState);
      const benchFlatNearR = renderer.project3D(3.9, 2.3, zNear, runState);
      const benchFlatFarR = renderer.project3D(3.9, 2.3, zFar, runState);

      const bench2NearL = renderer.project3D(-5.2, 4.8, zNear, runState);
      const bench2FarL = renderer.project3D(-5.2, 4.8, zFar, runState);
      const bench2NearR = renderer.project3D(5.2, 4.8, zNear, runState);
      const bench2FarR = renderer.project3D(5.2, 4.8, zFar, runState);

      // Alternating earthen strata shading for speed sensation
      const bandIndex = Math.floor((baseZ + runState.distanceTraveled - scrollOffset) / stepZ);
      const isAlt = bandIndex % 2 === 0;

      // 1. Compacted Gravel / Mud Haul Roadbed
      ctx.globalAlpha = sliceVis * 0.92;
      ctx.fillStyle = isAlt ? '#1a1613' : '#15120f';
      this.fillQuad(ctx, rdNearL, rdNearR, rdFarR, rdFarL);

      // Heavy Haul Tire Ruts / Tracks in the Pit Floor
      ctx.strokeStyle = `rgba(92, 74, 56, ${sliceVis * 0.45})`;
      ctx.lineWidth = Math.max(1, 2.5 * (1 - zNear / 120));
      for (const trackX of [-0.85, -0.35, 0.35, 0.85]) {
        const tNear = renderer.project3D(trackX, 0, zNear, runState);
        const tFar = renderer.project3D(trackX, 0, zFar, runState);
        ctx.beginPath();
        ctx.moveTo(tNear.x, tNear.y);
        ctx.lineTo(tFar.x, tFar.y);
        ctx.stroke();
      }

      // 2. Raised Earthen Safety Berms (Left & Right shoulders)
      if (visLeft > 0.02) {
        ctx.globalAlpha = visLeft * 0.95;
        ctx.fillStyle = isAlt ? '#33261b' : '#2a1f16';
        this.fillQuad(ctx, rdNearL, bermTopNearL, bermTopFarL, rdFarL);

        // Reflective Mine Safety Chevron / Marker Post every 3 slices
        if (bandIndex % 3 === 0) {
          ctx.fillStyle = `rgba(255, 170, 0, ${visLeft * 0.85})`;
          ctx.fillRect(bermTopNearL.x - 2, bermTopNearL.y - 6, 4, 6);
        }

        // Stepped Open-Pit Excavation Wall (Left Slope + Flat Bench Terrace + Upper Wall)
        ctx.fillStyle = isAlt ? '#241c15' : '#1e1711';
        this.fillQuad(ctx, bermTopNearL, bench1NearL, bench1FarL, bermTopFarL);
        ctx.fillStyle = '#16120e';
        this.fillQuad(ctx, bench1NearL, benchFlatNearL, benchFlatFarL, bench1FarL);
        ctx.fillStyle = isAlt ? '#1c1610' : '#17120d';
        this.fillQuad(ctx, benchFlatNearL, bench2NearL, bench2FarL, benchFlatFarL);

        // Geological Rock Strata Contour Lines
        ctx.strokeStyle = `rgba(120, 92, 65, ${visLeft * 0.38})`;
        ctx.lineWidth = 1;
        this.strokeLine(ctx, bermTopNearL, bermTopFarL);
        this.strokeLine(ctx, bench1NearL, bench1FarL);
      }

      if (visRight > 0.02) {
        ctx.globalAlpha = visRight * 0.95;
        ctx.fillStyle = isAlt ? '#33261b' : '#2a1f16';
        this.fillQuad(ctx, rdNearR, bermTopNearR, bermTopFarR, rdFarR);

        if (bandIndex % 3 === 0) {
          ctx.fillStyle = `rgba(255, 170, 0, ${visRight * 0.85})`;
          ctx.fillRect(bermTopNearR.x - 2, bermTopNearR.y - 6, 4, 6);
        }

        // Stepped Open-Pit Excavation Wall (Right Slope + Flat Bench Terrace + Upper Wall)
        ctx.fillStyle = isAlt ? '#241c15' : '#1e1711';
        this.fillQuad(ctx, bermTopNearR, bench1NearR, bench1FarR, bermTopFarR);
        ctx.fillStyle = '#16120e';
        this.fillQuad(ctx, bench1NearR, benchFlatNearR, benchFlatFarR, bench1FarR);
        ctx.fillStyle = isAlt ? '#1c1610' : '#17120d';
        this.fillQuad(ctx, benchFlatNearR, bench2NearR, bench2FarR, benchFlatFarR);

        ctx.strokeStyle = `rgba(120, 92, 65, ${visRight * 0.38})`;
        ctx.lineWidth = 1;
        this.strokeLine(ctx, bermTopNearR, bermTopFarR);
        this.strokeLine(ctx, bench1NearR, bench1FarR);
      }
    }

    ctx.restore();
  }

  renderLongRangeLidar(ctx, renderer, runState, env) {
    const minZ = Math.max(18, env.longLidarMinZ);
    const maxZ = Math.min(185, env.longLidarRange);
    if (maxZ <= minZ) return;

    const stepZ = Math.max(4.0, 9 / Math.max(0.6, env.longLidarDensity));
    const scrollZ = (runState.distanceTraveled * 1.5) % stepZ;

    ctx.save();
    for (let z = minZ + scrollZ; z <= maxZ; z += stepZ) {
      const alpha = Math.max(0.08, (1 - (z - minZ) / (maxZ - minZ)) * 0.65);
      ctx.strokeStyle = `rgba(0, 255, 102, ${alpha})`;
      ctx.lineWidth = 1.1;

      const bias = env.longLidarBiasX * 0.4;
      const pBenchL = renderer.project3D(-2.6 + bias, 1.8, z, runState);
      const pBermL = renderer.project3D(-1.88 + bias, 0.68, z, runState);
      const pFloorL = renderer.project3D(-1.55 + bias, 0, z, runState);
      const pFloorR = renderer.project3D(1.55 + bias, 0, z, runState);
      const pBermR = renderer.project3D(1.88 + bias, 0.68, z, runState);
      const pBenchR = renderer.project3D(2.6 + bias, 1.8, z, runState);

      // Stepped Haul Pit Topographic Contour Scanline
      ctx.beginPath();
      ctx.moveTo(pBenchL.x, pBenchL.y);
      ctx.lineTo(pBermL.x, pBermL.y);
      ctx.lineTo(pFloorL.x, pFloorL.y);
      ctx.lineTo(pFloorR.x, pFloorR.y);
      ctx.lineTo(pBermR.x, pBermR.y);
      ctx.lineTo(pBenchR.x, pBenchR.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderShortRangeLidar(ctx, renderer, runState, env) {
    const minZ = Math.max(2.2, env.shortLidarMinZ);
    const maxZ = Math.min(42, env.shortLidarRange);
    if (maxZ <= minZ) return;

    const density = Math.min(2.5, env.shortLidarDensity);
    const scrollZ = (runState.distanceTraveled * 2) % 2.2;

    ctx.save();
    ctx.fillStyle = '#00f0ff';

    for (let z = minZ + scrollZ; z <= maxZ; z += 2.2 / density) {
      const alpha = Math.max(0.15, 1 - (z - minZ) / (maxZ - minZ));
      ctx.globalAlpha = alpha;

      for (let x = -2.1; x <= 2.1; x += 0.3 / density) {
        const biasedX = x + env.shortLidarBiasX * 0.4;
        const absX = Math.abs(biasedX);
        const yElev = absX > 1.55 ? Math.min(0.9, (absX - 1.55) * 1.8) : 0;
        const p = renderer.project3D(biasedX, yElev, z, runState);
        ctx.fillRect(p.x, p.y, 2.3, 2.3);
      }
    }
    ctx.restore();
  }

  renderEntitiesMultiModal(ctx, renderer, runState, env, perceptionSystem) {
    // Sort back-to-front (painter's algorithm)
    const sorted = [...runState.worldEntities].sort((a, b) => b.z - a.z);

    for (const ent of sorted) {
      if (ent.z < 1.4) continue;

      // Enforce both minimum deadzone and maximum range for every sensor modality!
      const inShortLidar =
        env.shortLidarRange > 0 &&
        ent.z >= env.shortLidarMinZ &&
        ent.z <= env.shortLidarRange;

      const inLongLidar =
        env.longLidarRange > 0 &&
        ent.z >= env.longLidarMinZ &&
        ent.z <= env.longLidarRange;

      const inRadar =
        env.radarActive &&
        ent.z >= env.radarMinZ &&
        ent.z <= env.radarRange;

      const inCamera =
        env.cameraRange > 0 &&
        ent.z >= env.cameraMinZ &&
        ent.z <= env.cameraRange;

      const pointVis = perceptionSystem.getPointVisibility(ent.x, ent.z, runState);
      if ((!inShortLidar && !inLongLidar && !inRadar && !inCamera) || pointVis <= 0.04) {
        continue; // Completely hidden in the dark Fog of War (including inside LR-LiDAR's close-range blind spot!)
      }

      // Render 3D Mesh / Wireframe / Sensor Overlays for this entity
      renderer.draw3DEntity(ctx, ent, runState, {
        inShortLidar,
        inLongLidar,
        inRadar,
        inCamera,
        radarJitter: env.radarJitter,
        semanticClear: env.cameraSemanticClear,
        visibility: pointVis
      });
    }
  }

  renderDarkFogOverlay(ctx, renderer, runState, env) {
    const { width, height } = renderer;
    ctx.save();

    if (env.maxIlluminatedZ <= 4) {
      const blindGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.85,
        24,
        width * 0.5,
        height * 0.65,
        height * 0.42
      );
      blindGrad.addColorStop(0, 'rgba(4, 6, 9, 0.25)');
      blindGrad.addColorStop(0.5, 'rgba(4, 6, 9, 0.92)');
      blindGrad.addColorStop(1, 'rgba(4, 6, 9, 0.99)');
      ctx.fillStyle = blindGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      return;
    }

    // Project the farthest illuminated point to anchor the fog horizon gradient
    const netBiasX =
      (env.longLidarBiasX + env.shortLidarBiasX + env.radarBiasX + env.cameraBiasX) * 0.2;
    const farPoint = renderer.project3D(
      runState.truckX + netBiasX,
      0.5,
      Math.max(12, env.maxIlluminatedZ),
      runState
    );

    const fogRadius = Math.max(width, height) * Math.min(0.78, 0.2 + (env.maxIlluminatedZ / 165) * 0.52);

    const fogGrad = ctx.createRadialGradient(
      farPoint.x,
      farPoint.y + height * 0.12,
      fogRadius * 0.2,
      width * 0.5,
      height * 0.5,
      fogRadius * 1.15
    );

    const dustDarkness = 0.78 + runState.activeDustDensity * 0.18;
    fogGrad.addColorStop(0, 'rgba(4, 6, 10, 0.0)');
    fogGrad.addColorStop(0.65, `rgba(5, 8, 12, ${0.42 + runState.activeDustDensity * 0.25})`);
    fogGrad.addColorStop(1, `rgba(3, 5, 8, ${Math.min(0.98, dustDarkness)})`);

    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, 0, width, height);

    // If ONLY Long-Range LiDAR is mounted (no near-field SR-LiDAR or Camera covering < 20m),
    // render a dark near-field blind-spot shadow right in front of the bumper!
    const minCoveredZ = Math.min(
      env.shortLidarRange > 0 ? env.shortLidarMinZ : 999,
      env.cameraRange > 0 ? env.cameraMinZ : 999,
      env.radarActive ? env.radarMinZ : 999,
      env.longLidarRange > 0 ? env.longLidarMinZ : 999
    );

    if (minCoveredZ > 12) {
      const nearBlindGrad = ctx.createLinearGradient(0, height * 0.58, 0, height * 0.92);
      nearBlindGrad.addColorStop(0, 'rgba(3, 5, 8, 0.0)');
      nearBlindGrad.addColorStop(0.45, 'rgba(3, 5, 8, 0.85)');
      nearBlindGrad.addColorStop(1, 'rgba(3, 5, 8, 0.94)');
      ctx.fillStyle = nearBlindGrad;
      ctx.fillRect(0, height * 0.58, width, height * 0.35);
    }

    ctx.restore();
  }

  fillQuad(ctx, p1, p2, p3, p4) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();
  }

  strokeLine(ctx, p1, p2) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
}
