export class CollisionSystem {
  update(dt, runState, input, audioSystem) {
    // Agile, high-response steering toward thumb / keyboard input
    const desiredX = input.targetSteer;
    const steerDelta = desiredX - runState.truckX;
    runState.lateralVelocity = steerDelta * 10.5;
    runState.truckX = Math.max(-1.48, Math.min(1.48, runState.truckX + runState.lateralVelocity * dt));

    if (runState.alertTimer > 0) {
      runState.alertTimer = Math.max(0, runState.alertTimer - dt);
    }

    // Compact truck footprint (truck width ~0.34m) so dodging relies on agility rather than squeezing
    const truckFootprintWidth = 0.34;

    // Check collisions with entities near the haul truck (z between 1.8m and 4.4m)
    for (const ent of runState.worldEntities) {
      if (ent.collected) continue;
      if (ent.z <= 4.4 && ent.z >= 1.8) {
        const lateralDist = Math.abs(ent.x - runState.truckX);
        const hitThreshold = (ent.width + truckFootprintWidth) * 0.5;

        if (lateralDist <= hitThreshold) {
          ent.collected = true;
          this.resolveCollision(ent, runState, input, audioSystem);
        }
      }
    }
  }

  resolveCollision(ent, runState, input, audioSystem) {
    if (ent.category === 'gate') {
      if (ent.op === 'multiply') {
        runState[ent.targetStat] = Math.max(
          0.35,
          Math.min(2.6, runState[ent.targetStat] * ent.value)
        );
      } else if (ent.op === 'add') {
        runState[ent.targetStat] = Math.max(
          0.1,
          Math.min(1.5, runState[ent.targetStat] + ent.value)
        );
      }

      if (ent.isPositive) {
        audioSystem?.playGateChime(true);
        runState.triggerAlert(`GATE ENGAGED: ${ent.label}`, 1.5);
      } else {
        audioSystem?.playGateChime(false);
        runState.triggerAlert(`SENSOR DEGRADATION: ${ent.label}`, 1.8);
      }
      return;
    }

    if (ent.category === 'ore') {
      const spaceLeft = Math.max(0, runState.maxPayloadTons - runState.payloadTons);
      const addedTons = Math.min(spaceLeft, ent.tonnage);
      runState.payloadTons += addedTons;
      runState.earnedCredits += Math.round(addedTons * ent.creditValuePerTon);
      audioSystem?.playOrePickup(ent.isHighGrade);
      runState.triggerAlert(`EXTRACTED: ${ent.label}`, 1.4);
      return;
    }

    if (ent.category === 'hazard') {
      audioSystem?.playHazardImpact();

      if (ent.type === 'clay_slick') {
        // Mud splashes optics & induces lateral skid
        const bumperMount = runState.mountedSensors.front_bumper;
        const mudVuln = bumperMount ? bumperMount.hardpoint.mudVulnerability : 1.0;
        runState.opticClarity = Math.max(0.12, runState.opticClarity - 0.42 * mudVuln);
        input.targetSteer = Math.max(-1.35, Math.min(1.35, input.targetSteer + (Math.random() - 0.5) * 0.85));
        runState.triggerAlert('CLAY SLICK — OPTIC OCCLUSION [TAP PURGE]', 2.4);
      } else if (ent.type === 'dust_plume') {
        runState.opticClarity = Math.max(0.2, runState.opticClarity - 0.25);
        runState.triggerAlert('DENSE DUST PLUME — 4D RADAR REQUIRED', 2.0);
      } else {
        // Kinetic impact (boulder, rockslide, trench, rogue_loader, service_truck, drill_drone)
        const isHeavyVehicle = ent.type === 'rogue_loader' || ent.type === 'service_truck';
        const baseDmg = isHeavyVehicle ? 26 : 18;
        runState.hullIntegrity = Math.max(0, runState.hullIntegrity - baseDmg);

        // Front bumper sensors take heavy impact damage & calibration misalignment
        for (const mount of Object.values(runState.mountedSensors)) {
          const vuln = mount.hardpoint.impactVulnerability;
          mount.health = Math.max(0.15, mount.health - 0.14 * vuln);
          mount.calibrationOffset += (Math.random() - 0.5) * 0.25 * vuln;
        }
        runState.triggerAlert(`IMPACT: ${ent.label} — BUMPER ARRAY MISALIGNED`, 2.4);
      }
    }
  }
}
