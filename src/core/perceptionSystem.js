export class PerceptionSystem {
  update(dt, runState, input) {
    runState.lidarPitchDeg = input.lidarPitchDeg;

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

    // Aggregate multi-modal perception capabilities
    const envelope = {
      shortLidarRange: 0,
      shortLidarDensity: 0,
      shortLidarBiasX: 0,
      longLidarRange: 0,
      longLidarDensity: 0,
      longLidarBiasX: 0,
      radarRange: 0,
      radarActive: false,
      radarBiasX: 0,
      cameraRange: 0,
      cameraSemanticClear: false,
      slamDamping: 0
    };

    // Pitch modifier: pitching up extends far-field range (+28%) at the expense of near-field traction density
    const pitchNorm = runState.lidarPitchDeg / 20; // -0.75 to +1.0
    const pitchRangeFactor = 1 + pitchNorm * 0.28;
    const pitchNearFactor = 1 - pitchNorm * 0.22;

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
        envelope.shortLidarRange = Math.max(envelope.shortLidarRange, rawRange * pitchNearFactor);
        envelope.shortLidarDensity +=
          sensor.pointDensityMultiplier * hardpoint.detailMultiplier * runState.resolutionMultiplier * health;
        envelope.shortLidarBiasX += netBiasX;
      } else if (sensor.type === 'lidar_long') {
        envelope.longLidarRange = Math.max(envelope.longLidarRange, rawRange * pitchRangeFactor);
        envelope.longLidarDensity +=
          sensor.pointDensityMultiplier * hardpoint.detailMultiplier * runState.resolutionMultiplier * health;
        envelope.longLidarBiasX += netBiasX;
      } else if (sensor.type === 'radar') {
        envelope.radarRange = Math.max(envelope.radarRange, rawRange);
        envelope.radarActive = true;
        envelope.radarBiasX += netBiasX;
      } else if (sensor.type === 'camera') {
        // Camera blinds out for 0.35s while the high-pressure wiper purge runs
        const wiperOpen = runState.purgingTimer <= 0.05;
        envelope.cameraRange = wiperOpen ? Math.max(envelope.cameraRange, rawRange) : 0;
        envelope.cameraSemanticClear = wiperOpen && runState.opticClarity >= 0.48;
      } else if (sensor.type === 'localization') {
        envelope.slamDamping = Math.max(envelope.slamDamping, sensor.driftDamping * health);
      }
    }

    // Update subterranean GPS / SLAM localization drift
    const rawGps = runState.level.gpsSignalStrength;
    runState.effectiveGpsQuality = Math.min(1.0, rawGps + (1 - rawGps) * envelope.slamDamping);
    const driftSeverity = 1 - runState.effectiveGpsQuality;

    runState.gpsDriftPhase += dt * (1.3 + driftSeverity * 2.2);
    runState.gpsDriftOffset = Math.sin(runState.gpsDriftPhase) * driftSeverity * 0.65;

    runState.perceptionEnvelope = envelope;
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