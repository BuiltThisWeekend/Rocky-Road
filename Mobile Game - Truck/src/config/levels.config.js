// Legacy / dormant hazard types kept in memory for future activation:
// ['clay_slick', 'dust_plume', 'rockslide', 'trench', 'rogue_loader', 'drill_drone']

export const LEVELS_CONFIG = [
  {
    id: 'bench_upper',
    name: 'Sector 01: Upper Open-Pit Bench (-120m)',
    depthMeters: 120,
    targetRunDistance: 1800,
    ambientDustDensity: 0.18,
    speedMultiplier: 1.0,
    contractBonus: 600,
    allowedHazards: ['boulder', 'service_truck']
  },
  {
    id: 'decline_portal',
    name: 'Sector 02: Main Decline Portal (-450m)',
    depthMeters: 450,
    targetRunDistance: 2400,
    ambientDustDensity: 0.42,
    speedMultiplier: 1.18,
    contractBonus: 1250,
    allowedHazards: ['boulder', 'service_truck']
  },
  {
    id: 'abyssal_stope',
    name: 'Sector 03: Abyssal Fault Stope (-980m)',
    depthMeters: 980,
    targetRunDistance: 3200,
    ambientDustDensity: 0.72,
    speedMultiplier: 1.35,
    contractBonus: 2600,
    allowedHazards: ['boulder', 'service_truck']
  }
];
