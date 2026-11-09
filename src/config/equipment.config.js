export const HARDPOINTS_CONFIG = {
  front_bumper: {
    id: 'front_bumper',
    name: 'Front Bumper',
    description: '+35% ground detail; high mud exposure.',
    visualRoleBadge: '+35% DETAIL | HIGH MUD',
    lateralOffset: 0,
    rangeMultiplier: 0.9,
    detailMultiplier: 1.35,
    dustBypassBonus: 0.0,
    mudVulnerability: 1.65,
    impactVulnerability: 1.5
  },
  roof_mast: {
    id: 'roof_mast',
    name: 'Roof Mast',
    description: '+35% far range & clears low pit dust.',
    visualRoleBadge: '+35% RANGE | LOW DUST',
    lateralOffset: 0,
    rangeMultiplier: 1.35,
    detailMultiplier: 1.0,
    dustBypassBonus: 0.25,
    mudVulnerability: 0.45,
    impactVulnerability: 0.5
  },
  fender_left: {
    id: 'fender_left',
    name: 'Left Fender',
    description: 'Angled left (-0.85m) to cover port wall.',
    visualRoleBadge: 'LEFT BIAS | x1.05 RANGE',
    lateralOffset: -0.85,
    rangeMultiplier: 1.05,
    detailMultiplier: 1.1,
    dustBypassBonus: 0.05,
    mudVulnerability: 0.9,
    impactVulnerability: 0.95
  },
  fender_right: {
    id: 'fender_right',
    name: 'Right Fender',
    description: 'Angled right (+0.85m) to cover stbd wall.',
    visualRoleBadge: 'RIGHT BIAS | x1.05 RANGE',
    lateralOffset: 0.85,
    rangeMultiplier: 1.05,
    detailMultiplier: 1.1,
    dustBypassBonus: 0.05,
    mudVulnerability: 0.9,
    impactVulnerability: 0.95
  }
};

export const CHASSIS_TIERS = [
  {
    tier: 1,
    name: 'Mk.I Hauler',
    maxPowerKw: 95,
    maxWeightKg: 360,
    payloadCapacityTons: 300,
    maxHullIntegrity: 100,
    upgradeCost: 1000
  },
  {
    tier: 2,
    name: 'Mk.II Titan',
    maxPowerKw: 120,
    maxWeightKg: 450,
    payloadCapacityTons: 420,
    maxHullIntegrity: 135,
    upgradeCost: 2400
  },
  {
    tier: 3,
    name: 'Mk.III Ultra',
    maxPowerKw: 155,
    maxWeightKg: 580,
    payloadCapacityTons: 600,
    maxHullIntegrity: 180,
    upgradeCost: null
  }
];

export function validateRigConfiguration(rigMap, sensorLevels, chassisTierIndex) {
  const chassis = CHASSIS_TIERS[chassisTierIndex] || CHASSIS_TIERS[0];
  let totalPower = 0;
  let totalWeight = 0;

  for (const [slotId, sensorId] of Object.entries(rigMap)) {
    if (!sensorId) continue;
    const hp = HARDPOINTS_CONFIG[slotId];
    const sensor = sensorLevels[sensorId];
    if (hp && sensor) {
      totalPower += sensor.powerDrawKw;
      totalWeight += sensor.weightKg;
    }
  }

  return {
    valid: totalPower <= chassis.maxPowerKw && totalWeight <= chassis.maxWeightKg,
    totalPower,
    maxPower: chassis.maxPowerKw,
    totalWeight,
    maxWeight: chassis.maxWeightKg
  };
}
