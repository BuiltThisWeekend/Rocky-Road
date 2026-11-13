import { LEVELS_CONFIG } from '../config/levels.config.js';
import { CHASSIS_TIERS, HARDPOINTS_CONFIG } from '../config/equipment.config.js';
import { getSensorStatsAtLevel } from '../config/sensors.config.js';

export class RunState {
  constructor() {
    this.reset('bench_upper', {}, {}, 0);
  }

  reset(levelId, rigConfig, ownedSensorLevels, chassisTierIndex) {
    const levelCfg = LEVELS_CONFIG.find((l) => l.id === levelId) || LEVELS_CONFIG[0];
    const chassis = CHASSIS_TIERS[chassisTierIndex] || CHASSIS_TIERS[0];

    this.level = levelCfg;
    this.chassis = chassis;
    this.active = false;
    this.distanceTraveled = 0;
    this.speed = 28 * levelCfg.speedMultiplier; // meters per second
    this.baseSpeed = this.speed;

    // Truck lateral position (-1.5 left berm to +1.5 right berm)
    this.truckX = 0;
    this.lateralVelocity = 0;

    // Hull & Environment
    this.hullIntegrity = chassis.maxHullIntegrity;
    this.maxHullIntegrity = chassis.maxHullIntegrity;
    this.activeDustDensity = levelCfg.ambientDustDensity;

    // Optics & Purge
    this.opticClarity = 1.0; // 1.0 = crystal clear, < 0.48 = static [GATE: ???]
    this.purgeCooldown = 0;
    this.purgingTimer = 0;

    // Dynamic Gate Multipliers
    this.rangeBonusMultiplier = 1.0;
    this.resolutionMultiplier = 1.0;

    // Payload & Economy
    this.payloadTons = 0;
    this.maxPayloadTons = chassis.payloadCapacityTons;
    this.earnedCredits = 0;
    this.alertBannerText = '';
    this.alertTimer = 0;
    this.alertTone = 'danger';

    // Build mounted sensor instances with hardpoint modifiers
    this.mountedSensors = {};

    for (const [slotId, sensorId] of Object.entries(rigConfig)) {
      if (!sensorId) continue;
      const lvl = ownedSensorLevels[sensorId] || 1;
      const stats = getSensorStatsAtLevel(sensorId, lvl);
      const hp = HARDPOINTS_CONFIG[slotId];
      if (stats && hp) {
        this.mountedSensors[slotId] = {
          slotId,
          hardpoint: hp,
          sensor: stats,
          health: 1.0,
          calibrationOffset: 0
        };
      }
    }

    this.worldEntities = [];
  }

  triggerAlert(message, duration = 2.2, tone = 'danger') {
    this.alertBannerText = message;
    this.alertTimer = duration;
    this.alertTone = tone;
  }
}
