// Legacy / dormant hazard types kept in memory for future activation:
// ['clay_slick', 'dust_plume', 'rockslide', 'trench', 'rogue_loader', 'drill_drone']

export const LEVELS_CONFIG = [
  {
    id: 'bench_upper',
    name: 'Sector 01: Dusty Sunlit Pit (-120m)',
    condition: 'dusty',
    conditionLabel: 'DUSTY',
    depthMeters: 120,
    targetRunDistance: 1800,
    ambientDustDensity: 0.34,
    speedMultiplier: 1.0,
    contractBonus: 600,
    allowedHazards: ['boulder', 'service_truck']
  },
  {
    id: 'decline_portal',
    name: 'Sector 02: Muddy Bog Haul (-450m)',
    condition: 'muddy',
    conditionLabel: 'MUDDY',
    depthMeters: 450,
    targetRunDistance: 2400,
    ambientDustDensity: 0.40,
    speedMultiplier: 1.15,
    contractBonus: 1250,
    allowedHazards: ['boulder', 'service_truck']
  },
  {
    id: 'abyssal_stope',
    name: 'Sector 03: Monsoon Rain Gorge (-780m)',
    condition: 'rainy',
    conditionLabel: 'RAINY',
    depthMeters: 780,
    targetRunDistance: 2900,
    ambientDustDensity: 0.56,
    speedMultiplier: 1.28,
    contractBonus: 2000,
    allowedHazards: ['boulder', 'service_truck']
  },
  {
    id: 'arctic_glacier',
    name: 'Sector 04: Snowy Alpine Drift (-1120m)',
    condition: 'snowy',
    conditionLabel: 'SNOWY',
    depthMeters: 1120,
    targetRunDistance: 3400,
    ambientDustDensity: 0.68,
    speedMultiplier: 1.38,
    contractBonus: 2850,
    allowedHazards: ['boulder', 'service_truck']
  }
];
