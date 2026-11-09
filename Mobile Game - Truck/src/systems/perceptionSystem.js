export class PerceptionSystem {
  update(dt, runState) {
    // Update purge timer & cooldown
    if (runState.purgeCooldown > 0) {
      runState.purgeCooldown = Math.max(0, runState.purgeCooldown - dt);
    }
    if (runState.purgingTimer > 0) {
      runState.purgingTimer = Math.max(0, runState.purgingTimer - dt);
    }

    // Calculate active dust density (ambient + nearby dust_plume entities)
    let localDust = runState.level.ambientDustDensity;
    for (const ent of runState.worldEntities) {
      if (ent.type === 'dust_plume' && ent.z > 0 && ent.z < 55) {
        const proximity = 1 - ent.z / 55;
        localDust = Math.min(1.0, localDust + proximity * 0.55);
      }
    }
    runState.activeDustDensity = localDust;

    // Passive mud accumulation on low bumper mounts in high dust/mud levels
    const passiveOpticDecay = 0.008 * localDust * dt;
    runState.opticClarity = Math.max(0.1, runState.opticClarity - passiveOpticDecay);

    // Aggregate multi-modal perception capabilities with distinct range windows & trade-offs
    const envelope = {
      shortLidarMinZ: 999,
      shortLidarRange: 0,
      shortLidarDensity: 0,
      shortLidarBiasX: 0,

      longLidarMinZ: 999,
      longLidarRange: 0,
      longLidarDensity: 0,
      longLidarBiasX: 0,

      radarMinZ: 999,
      radarRange: 0,
      radarActive: false,
      radarBiasX: 0,
      radarJitter: 0.45,

      cameraMinZ: 999,
      cameraRange: 0,
      cameraSemanticClear: false,
      cameraBiasX: 0,

      maxIlluminatedZ: 0
    };

    for (const mount of Object.values(runState.mountedSensors)) {
      if (mount.health <= 0.05) continue;
      const { sensor, hardpoint, health, calibrationOffset } = mount;

      // Dust attenuation calculation
      const effectiveDustPen = Math.min(1.0, sensor.dustPenetration + hardpoint.dustBypassBonus);
      const dustAttenuation = 1 - localDust * (1 - effectiveDustPen) * 0.65;

      const rawRange =
        sensor.effectiveRange *
        hardpoint.rangeMultiplier *
        runState.rangeBonusMultiplier *
        health *
        dustAttenuation;

      const netBiasX = hardpoint.lateralOffset + calibrationOffset;

      if (sensor.type === 'lidar_short') {
        envelope.shortLidarMinZ = Math.min(envelope.shortLidarMinZ, sensor.minRange || 1);
        envelope.shortLidarRange = Math.max(envelope.shortLidarRange, rawRange);
        envelope.shortLidarDensity +=
          sensor.pointDensityMultiplier * hardpoint.detailMultiplier * runState.resolutionMultiplier * health;
        envelope.shortLidarBiasX += netBiasX;
      } else if (sensor.type === 'lidar_long') {
        const minZ = Math.max(18, sensor.minRange || 32);
        envelope.longLidarMinZ = Math.min(envelope.longLidarMinZ, minZ);
        envelope.longLidarRange = Math.max(envelope.longLidarRange, rawRange);
        envelope.longLidarDensity +=
          sensor.pointDensityMultiplier * hardpoint.detailMultiplier * runState.resolutionMultiplier * health;
        envelope.longLidarBiasX += netBiasX;
      } else if (sensor.type === 'radar') {
        envelope.radarMinZ = Math.min(envelope.radarMinZ, sensor.minRange || 6);
        envelope.radarRange = Math.max(envelope.radarRange, rawRange);
        envelope.radarActive = true;
        envelope.radarBiasX += netBiasX;
        envelope.radarJitter = Math.min(
          envelope.radarJitter,
          (sensor.positionJitter || 0.45) / Math.max(0.7, hardpoint.detailMultiplier)
        );
      } else if (sensor.type === 'camera') {
        // Camera blinds out for 0.35s while the high-pressure wiper purge runs
        const wiperOpen = runState.purgingTimer <= 0.05;
        envelope.cameraMinZ = Math.min(envelope.cameraMinZ, sensor.minRange || 2);
        envelope.cameraRange = wiperOpen ? Math.max(envelope.cameraRange, rawRange) : 0;
        envelope.cameraSemanticClear = wiperOpen && runState.opticClarity >= 0.48;
        envelope.cameraBiasX += netBiasX;
      }
    }

    envelope.maxIlluminatedZ = Math.max(
      envelope.shortLidarRange,
      envelope.longLidarRange,
      envelope.radarRange,
      envelope.cameraRange
    );

    runState.perceptionEnvelope = envelope;
  }

  /**
   * Computes how strongly any mounted sensor illuminates a given 3D world point (worldX, worldZ).
   * Enforces each sensor's minRange deadzone and maxRange cutoff!
   */
  getPointVisibility(worldX, worldZ, runState) {
    const env = runState.perceptionEnvelope;
    if (!env || worldZ <= 0.5) return 0;

    const relX = worldX - runState.truckX;
    let maxVis = 0;

    // 1. Short-Range LiDAR (Wide 180° perimeter cone, 1m to ~30m ONLY)
    if (
      env.shortLidarRange > 2 &&
      worldZ >= env.shortLidarMinZ &&
      worldZ <= env.shortLidarRange
    ) {
      const distNorm = 1 - (worldZ - env.shortLidarMinZ) / (env.shortLidarRange - env.shortLidarMinZ);
      const halfSpanX = 2.5 + worldZ * 0.45;
      const dx = Math.abs(relX - env.shortLidarBiasX * 0.45);
      if (dx <= halfSpanX) {
        const edgeFade = 1 - Math.pow(dx / halfSpanX, 2.2);
        maxVis = Math.max(maxVis, Math.min(1, distNorm * 1.45) * edgeFade);
      }
    }

    // 2. Long-Range LiDAR (Narrow 34° forward tunnel beam, BLIND close-up < 32m!)
    if (
      env.longLidarRange > env.longLidarMinZ &&
      worldZ >= env.longLidarMinZ &&
      worldZ <= env.longLidarRange
    ) {
      const spanZ = env.longLidarRange - env.longLidarMinZ;
      const distNorm = 1 - (worldZ - env.longLidarMinZ) / spanZ;
      const nearRamp = Math.min(1, (worldZ - env.longLidarMinZ) / 6);
      const halfSpanX = 1.15 + worldZ * 0.055;
      const dx = Math.abs(relX - env.longLidarBiasX * 0.45);
      if (dx <= halfSpanX) {
        const edgeFade = 1 - Math.pow(dx / halfSpanX, 2);
        maxVis = Math.max(maxVis, Math.min(1, distNorm * 1.3) * nearRamp * edgeFade);
      }
    }

    // 3. 4D Radar (Medium-wide all-weather cone, 6m to ~120m, pierces dust)
    if (
      env.radarActive &&
      env.radarRange > env.radarMinZ &&
      worldZ >= env.radarMinZ &&
      worldZ <= env.radarRange
    ) {
      const distNorm = 1 - (worldZ - env.radarMinZ) / (env.radarRange - env.radarMinZ);
      const nearRamp = Math.min(1, (worldZ - env.radarMinZ) / 4);
      const halfSpanX = 1.45 + worldZ * 0.12;
      const dx = Math.abs(relX - env.radarBiasX * 0.45);
      if (dx <= halfSpanX) {
        const edgeFade = 1 - Math.pow(dx / halfSpanX, 2);
        maxVis = Math.max(maxVis, Math.min(1, distNorm * 1.15) * nearRamp * edgeFade * 0.78);
      }
    }

    // 4. AI Camera (Short-range optical floodlight cone, 2m to ~42m)
    if (
      env.cameraRange > env.cameraMinZ &&
      worldZ >= env.cameraMinZ &&
      worldZ <= env.cameraRange
    ) {
      const distNorm = 1 - (worldZ - env.cameraMinZ) / (env.cameraRange - env.cameraMinZ);
      const halfSpanX = 1.35 + worldZ * 0.09;
      const dx = Math.abs(relX - env.cameraBiasX * 0.45);
      if (dx <= halfSpanX) {
        const edgeFade = 1 - Math.pow(dx / halfSpanX, 2);
        maxVis = Math.max(maxVis, Math.min(1, distNorm * 1.35) * edgeFade);
      }
    }

    return Math.max(0, Math.min(1, maxVis));
  }

  triggerOpticPurge(runState, audioSystem, hudRenderer) {
    if (runState.purgeCooldown > 0 || !runState.active) return false;
    runState.purgeCooldown = 1.6;
    runState.purgingTimer = 0.42;
    runState.opticClarity = 1.0;

    // Also restore minor calibration drift on optical cameras
    for (const mount of Object.values(runState.mountedSensors)) {
      if (mount.sensor.type === 'camera') {
        mount.calibrationOffset *= 0.25;
      }
    }

    if (audioSystem) audioSystem.playPurgeHiss();
    if (hudRenderer) hudRenderer.triggerWiperAnimation();
    return true;
  }
}
