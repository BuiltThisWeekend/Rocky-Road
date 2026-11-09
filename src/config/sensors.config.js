export const SENSORS_CONFIG = {
  short_lidar: {
    id: 'short_lidar',
    name: 'Short-Range LiDAR',
    shortLabel: 'SR-LiDAR',
    type: 'lidar_short',
    description: '180° near-field 3D point cloud (1–30m). Blind beyond 30m.',
    visualRoleBadge: '1–30m NEAR CONE | BLIND FAR',
    minRange: 1,
    baseRange: 30,
    fovAngle: 180,
    dustPenetration: 0.35,
    powerDrawKw: 18,
    weightKg: 85,
    renderColor: '#00f0ff',
    baseUpgradeCost: 300,
    costMultiplier: 1.55,
    perLevelBonus: {
      range: 4,
      pointDensity: 0.22
    }
  },
  long_lidar: {
    id: 'long_lidar',
    name: 'Long-Range LiDAR',
    shortLabel: 'LR-LiDAR',
    type: 'lidar_long',
    description: 'Deep 34° tunnel laser (32–155m). Blind close-up (<32m).',
    visualRoleBadge: '32–155m FAR BEAM | BLIND <32m',
    minRange: 32,
    baseRange: 155,
    fovAngle: 34,
    dustPenetration: 0.25,
    powerDrawKw: 28,
    weightKg: 110,
    renderColor: '#00ff66',
    baseUpgradeCost: 450,
    costMultiplier: 1.6,
    perLevelBonus: {
      range: 16,
      pointDensity: 0.18
    }
  },
  radar_4d: {
    id: 'radar_4d',
    name: '4D Doppler Radar',
    shortLabel: '4D-RADAR',
    type: 'radar',
    description: 'Pierces 100% dust & tracks speed, but locations jitter.',
    visualRoleBadge: '100% DUST PROOF | JITTERY POS',
    minRange: 6,
    baseRange: 120,
    fovAngle: 68,
    dustPenetration: 1.0,
    basePositionJitter: 0.45,
    powerDrawKw: 32,
    weightKg: 125,
    renderColor: '#ffaa00',
    baseUpgradeCost: 550,
    costMultiplier: 1.65,
    perLevelBonus: {
      range: 12,
      jitterReduction: 0.06
    }
  },
  optical_cam: {
    id: 'optical_cam',
    name: 'AI Optical Camera',
    shortLabel: 'AI-OPTIC',
    type: 'camera',
    description: 'Short-range floodlight (2–42m). Decodes Gates & Ore grades.',
    visualRoleBadge: '2–42m FLOODLIGHT | IDs GATES',
    minRange: 2,
    baseRange: 42,
    fovAngle: 60,
    dustPenetration: 0.4,
    powerDrawKw: 24,
    weightKg: 70,
    renderColor: '#ffffff',
    baseUpgradeCost: 400,
    costMultiplier: 1.5,
    perLevelBonus: {
      range: 6,
      mudResistance: 0.15
    }
  }
};

export function getSensorStatsAtLevel(sensorId, level = 1) {
  const cfg = SENSORS_CONFIG[sensorId];
  if (!cfg) return null;
  const lvlIndex = Math.max(0, level - 1);
  return {
    ...cfg,
    level,
    minRange: cfg.minRange || 1,
    effectiveRange: cfg.baseRange + (cfg.perLevelBonus.range || 0) * lvlIndex,
    pointDensityMultiplier: 1 + (cfg.perLevelBonus.pointDensity || 0) * lvlIndex,
    mudResistance: Math.min(0.85, (cfg.perLevelBonus.mudResistance || 0) * lvlIndex),
    positionJitter: cfg.basePositionJitter
      ? Math.max(0.15, cfg.basePositionJitter - (cfg.perLevelBonus.jitterReduction || 0) * lvlIndex)
      : 0,
    nextUpgradeCost: Math.round(cfg.baseUpgradeCost * Math.pow(cfg.costMultiplier, lvlIndex))
  };
}
