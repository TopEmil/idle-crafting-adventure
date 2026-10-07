import type { ResourceId } from './resources';

export type StationId =
  | 'smelter'
  | 'anvil'
  | 'enchanter'
  | 'crucible'
  | 'gemcutter'
  | 'aetherforge';

export interface StationDef {
  id: StationId;
  name: string;
  description: string;
  unlockCost: Partial<Record<ResourceId, number>>;
  unlockRequires?: StationId;
  /** Optional dig-depth gate before the station can be unlocked. */
  unlockAtDepth?: number;
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
  {
    id: 'crucible',
    name: 'Verdant Crucible',
    description: 'Cooks Glowdust and Ore into Verdiglass — opens Moss & Slag routes.',
    unlockCost: { verdiglass: 8, glowdust: 40, ore: 120 },
    unlockRequires: 'anvil',
    unlockAtDepth: 6,
    outputs: { verdiglass: 0.22 },
    inputs: { ore: 0.35, glowdust: 0.18 },
    baseCost: { verdiglass: 20, glowdust: 35, ore: 80 },
    costGrowth: 1.22,
    visualTint: 0x6bbf59,
  },
  {
    id: 'gemcutter',
    name: 'Gemcutter',
    description: 'Facet Nightiron into Starshards for deep expeditions.',
    unlockCost: { nightiron: 10, alloy: 50, glowdust: 60 },
    unlockRequires: 'enchanter',
    unlockAtDepth: 55,
    outputs: { starshard: 0.08, nightiron: 0.05 },
    inputs: { alloy: 0.15, nightiron: 0.06 },
    baseCost: { nightiron: 18, alloy: 55, glowdust: 50 },
    costGrowth: 1.24,
    visualTint: 0x7b8cde,
  },
  {
    id: 'aetherforge',
    name: 'Aetherforge',
    description: 'Binds Aetherite into living metal — the deepest forge rite.',
    unlockCost: { aetherite: 6, starshard: 20, nightiron: 25 },
    unlockRequires: 'gemcutter',
    unlockAtDepth: 175,
    outputs: { aetherite: 0.04, alloy: 0.2, glowdust: 0.15 },
    inputs: { starshard: 0.05, nightiron: 0.08 },
    baseCost: { aetherite: 12, starshard: 30, nightiron: 35 },
    costGrowth: 1.26,
    visualTint: 0x9ed8e0,
  },
];

export function getStation(id: StationId): StationDef {
  const station = STATIONS.find((s) => s.id === id);
  if (!station) {
    throw new Error(`Unknown station: ${id}`);
  }
  return station;
}

export function emptyStationProgress(): {
  unlocked: boolean;
  level: number;
  runLevel: number;
  enabled: boolean;
} {
  return { unlocked: false, level: 0, runLevel: 0, enabled: true };
}

export function emptyStations(): Record<
  StationId,
  { unlocked: boolean; level: number; runLevel: number; enabled: boolean }
> {
  return {
    smelter: emptyStationProgress(),
    anvil: emptyStationProgress(),
    enchanter: emptyStationProgress(),
    crucible: emptyStationProgress(),
    gemcutter: emptyStationProgress(),
    aetherforge: emptyStationProgress(),
  };
}
