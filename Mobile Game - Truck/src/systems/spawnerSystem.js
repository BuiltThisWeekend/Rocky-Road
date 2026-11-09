import { GATE_POOLS, ORE_TYPES } from '../config/rewards.config.js';

export class SpawnerSystem {
  constructor() {
    this.nextSpawnZ = 40;
    this.entityIdCounter = 1;
  }

  reset() {
    this.nextSpawnZ = 40;
    this.entityIdCounter = 1;
  }

  update(dt, runState) {
    const dz = runState.speed * dt;
    runState.distanceTraveled += dz;

    // Advance all world entities toward the truck (z = 0) and update moving dynamics
    for (const ent of runState.worldEntities) {
      ent.z -= dz + (ent.vz || 0) * dt;
      if (ent.vx) {
        ent.x += ent.vx * dt;
        // Bounce moving hazards within their patrol bounds so at least one lane stays passable
        const minX = ent.patrolMinX ?? -1.35;
        const maxX = ent.patrolMaxX ?? 1.35;
        if (ent.x < minX) {
          ent.x = minX;
          ent.vx = Math.abs(ent.vx);
        } else if (ent.x > maxX) {
          ent.x = maxX;
          ent.vx = -Math.abs(ent.vx);
        }
      }
    }

    // Remove passed or collected entities
    runState.worldEntities = runState.worldEntities.filter((e) => e.z > -8 && !e.collected);

    // Balanced wave spacing (~26m apart) so hazards never stack into undodgeable walls
    const furthestZ = runState.worldEntities.reduce((max, e) => Math.max(max, e.z), 0);
    if (furthestZ < 185) {
      this.spawnWave(runState, Math.max(82, furthestZ + 26));
    }
  }

  spawnWave(runState, zPos) {
    // Simplified active spawn pool: Only Ore Payloads ("$") and Boulders / Moving Pickup Obstacles.
    // (Gate entities and other hazard definitions remain preserved in memory below).
    const roll = Math.random();

    if (roll < 0.46) {
      // Spawn Ore Vein Payload ("$") (Occasionally with 1 well-spaced boulder/pickup in a separate lane)
      const ore = ORE_TYPES[Math.floor(Math.random() * ORE_TYPES.length)];
      const lanes = [-1.0, 0, 1.0];
      const oreLaneIdx = Math.floor(Math.random() * lanes.length);
      const oreX = lanes[oreLaneIdx];

      runState.worldEntities.push({
        id: this.entityIdCounter++,
        category: 'ore',
        type: ore.id,
        label: ore.label,
        isHighGrade: ore.isHighGrade,
        tonnage: ore.tonnage,
        creditValuePerTon: ore.creditValuePerTon,
        color: '#00ff66',
        x: oreX,
        z: zPos,
        width: 0.62,
        height: 1.25,
        vx: 0,
        vz: 0
      });

      // 30% chance of a companion boulder or moving pickup placed well behind (+12m) in a different lane
      if (Math.random() < 0.3) {
        const hazX = lanes[(oreLaneIdx + 1) % lanes.length];
        const pool = runState.level.allowedHazards;
        const hazardType = pool[Math.floor(Math.random() * pool.length)];
        runState.worldEntities.push(this.createHazardEntity(zPos + 12, hazX, hazardType));
      }
    } else {
      // Spawn Static Boulder (`boulder.png`) or Moving Pickup (`pickup.png`)
      const pool = runState.level.allowedHazards;
      const hazardType = pool[Math.floor(Math.random() * pool.length)];
      const laneX = [-1.0, 0, 1.0][Math.floor(Math.random() * 3)];
      runState.worldEntities.push(this.createHazardEntity(zPos, laneX, hazardType));

      if (Math.random() < 0.2) {
        const secondType = pool[Math.floor(Math.random() * pool.length)];
        const secondX = laneX === 0 ? (Math.random() > 0.5 ? -1.0 : 1.0) : -laneX;
        runState.worldEntities.push(this.createHazardEntity(zPos + 14, secondX, secondType));
      }
    }
  }

  createGateEntity(z, x, gateCfg) {
    return {
      id: this.entityIdCounter++,
      category: 'gate',
      type: gateCfg.id,
      label: gateCfg.label,
      op: gateCfg.op,
      targetStat: gateCfg.targetStat,
      value: gateCfg.value,
      isPositive: gateCfg.isPositive,
      color: gateCfg.color,
      x,
      z,
      width: 0.68,
      height: 2.4,
      vx: 0,
      vz: 0
    };
  }

  createHazardEntity(z, x, hazardType) {
    const dir = Math.random() > 0.5 ? 1 : -1;
    const labels = {
      boulder: 'BOULDER OBSTACLE',
      clay_slick: 'WET CLAY SLICK',
      dust_plume: 'SILICA DUST PLUME',
      rockslide: 'TUMBLING ROCKSLIDE',
      trench: 'BENCH TRENCH DROP',
      rogue_loader: 'ROGUE LHD LOADER',
      service_truck: 'CREW PICKUP TRUCK',
      drill_drone: 'SURVEY DRILL RIG'
    };

    let vx = 0;
    let vz = 0;
    let width = 0.62;
    let height = 1.45;
    // Constrain lateral patrol zone so a single moving hazard never sweeps the entire road width at once
    let patrolMinX = -1.32;
    let patrolMaxX = 1.32;
    if (x < -0.2) {
      patrolMinX = -1.32;
      patrolMaxX = 0.25;
    } else if (x > 0.2) {
      patrolMinX = -0.25;
      patrolMaxX = 1.32;
    } else {
      patrolMinX = -0.85;
      patrolMaxX = 0.85;
    }

    if (hazardType === 'rockslide') {
      vx = dir * 0.58;
      vz = 2.0;
      width = 0.62;
      height = 1.4;
    } else if (hazardType === 'rogue_loader') {
      vx = dir * 0.22;
      vz = 7.0;
      width = 0.68;
      height = 1.55;
    } else if (hazardType === 'service_truck') {
      vx = dir * 0.65;
      vz = 4.2;
      width = 0.58;
      height = 1.3;
    } else if (hazardType === 'drill_drone') {
      vx = dir * 0.78;
      vz = 1.2;
      width = 0.56;
      height = 1.35;
    } else if (hazardType === 'dust_plume') {
      width = 1.35;
      height = 2.0;
      vx = dir * 0.15;
    } else if (hazardType === 'trench') {
      width = 0.72;
      height = 0.42;
    } else if (hazardType === 'boulder') {
      width = 0.64;
      height = 1.45;
    }

    return {
      id: this.entityIdCounter++,
      category: 'hazard',
      type: hazardType,
      label: labels[hazardType] || 'HAZARD',
      x,
      z,
      width,
      height,
      vx,
      vz,
      patrolMinX,
      patrolMaxX,
      color: '#ff3344'
    };
  }
}
