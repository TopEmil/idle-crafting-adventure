import type { ResourceId } from './resources';

export type StationId = 'smelter' | 'anvil' | 'enchanter';

export interface StationDef {
  id: StationId;
  name: string;
  description: string;
  unlockCost: Partial<Record<ResourceId, number>>;
  unlockRequires?: StationId;
  /** Base output per second before multipliers */
  outputs: Partial<Record<ResourceId, number>>;
  /** Inputs consumed per second when running */
  inputs?: Partial<Record<ResourceId, number>>;
  baseCost: Partial<Record<ResourceId, number>>;
  costGrowth: number;
  visualTint: number;
}

export const STATIONS: StationDef[] = [
  {
    id: 'smelter',
    name: 'Smelter',
    description: 'Melts Vein Ore into Emberglass.',
    unlockCost: { ore: 25 },
    outputs: { emberglass: 0.35 },
    inputs: { ore: 0.6 },
    baseCost: { ore: 40 },
    costGrowth: 1.18,
    visualTint: 0xe85d04,
  },
  {
    id: 'anvil',
    name: 'Anvil',
    description: 'Forges Emberglass into Deep Alloy.',
    unlockCost: { emberglass: 40, ore: 80 },
    unlockRequires: 'smelter',
    outputs: { alloy: 0.18 },
    inputs: { emberglass: 0.4 },
    baseCost: { emberglass: 55, ore: 60 },
    costGrowth: 1.2,
    visualTint: 0xf48c06,
  },
  {
    id: 'enchanter',
    name: 'Enchanter',
    description: 'Infuses Alloy with Glowdust for ritual power.',
    unlockCost: { alloy: 30, glowdust: 50 },
    unlockRequires: 'anvil',
    outputs: { glowdust: 0.25, emberglass: 0.1 },
    inputs: { alloy: 0.12 },
    baseCost: { alloy: 45, glowdust: 40 },
    costGrowth: 1.22,
    visualTint: 0x2ec4b6,
  },
];

export function getStation(id: StationId): StationDef {
  const station = STATIONS.find((s) => s.id === id);
  if (!station) {
    throw new Error(`Unknown station: ${id}`);
  }
  return station;
}
