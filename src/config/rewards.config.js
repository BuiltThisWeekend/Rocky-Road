export const GATE_POOLS = [
  {
    id: 'gate_range_boost',
    label: 'ARRAY GAIN +25%',
    op: 'multiply',
    targetStat: 'rangeBonusMultiplier',
    value: 1.25,
    isPositive: true,
    color: '#00ff66'
  },
  {
    id: 'gate_edge_ai',
    label: 'BANDWIDTH x1.3',
    op: 'multiply',
    targetStat: 'resolutionMultiplier',
    value: 1.3,
    isPositive: true,
    color: '#00f0ff'
  },
  {
    id: 'gate_optic_clean',
    label: 'AUTO-PURGE +40%',
    op: 'add',
    targetStat: 'opticClarity',
    value: 0.4,
    isPositive: true,
    color: '#00ff66'
  },
  {
    id: 'gate_emi_spike',
    label: 'EMI DRIFT -25%',
    op: 'multiply',
    targetStat: 'rangeBonusMultiplier',
    value: 0.75,
    isPositive: false,
    color: '#ff3344'
  },
  {
    id: 'gate_mud_spray',
    label: 'SLURRY SPRAY -35%',
    op: 'add',
    targetStat: 'opticClarity',
    value: -0.35,
    isPositive: false,
    color: '#ff3344'
  }
];

export const ORE_TYPES = [
  {
    id: 'chalcopyrite',
    label: 'COPPER ORE +45t',
    tonnage: 45,
    creditValuePerTon: 6,
    isHighGrade: true,
    color: '#ffaa00'
  },
  {
    id: 'palladium_vein',
    label: 'PGM HIGH-GRADE +80t',
    tonnage: 80,
    creditValuePerTon: 11,
    isHighGrade: true,
    color: '#00f0ff'
  },
  {
    id: 'waste_slag',
    label: 'WASTE ROCK +50t',
    tonnage: 50,
    creditValuePerTon: 1,
    isHighGrade: false,
    color: '#778899'
  }
];