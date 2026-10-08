import type { ResourceId } from './resources';

export type ExpeditionId =
  | 'glow_shalllows'
  | 'moss_crawl'
  | 'crystal_fault'
  | 'slag_run'
  | 'ember_rift'
  | 'frost_descent'
  | 'abyss_vein'
  | 'deep_dark'
  | 'starfall_raid'
  | 'aether_breach';

export interface ExpeditionDef {
  id: ExpeditionId;
  name: string;
  description: string;
  /** Duration in seconds */
  durationSec: number;
  unlockAtOreProduced: number;
  /** Optional dig-depth gate (mineDepth). */
  unlockAtDepth?: number;
  cost: Partial<Record<ResourceId, number>>;
  baseLoot: Partial<Record<ResourceId, number>>;
  /** Extra random loot range */
  bonusChance: number;
  bonusLoot: Partial<Record<ResourceId, number>>;
}

export const EXPEDITIONS: ExpeditionDef[] = [
  {
    id: 'glow_shalllows',
    name: 'Glow Shallows',
    description: 'Scouts skim the cyan shallows for Glowdust.',
    durationSec: 45,
    unlockAtOreProduced: 50,
    cost: { ore: 20 },
    baseLoot: { glowdust: 18, ore: 12 },
    bonusChance: 0.35,
    bonusLoot: { emberglass: 8 },
  },
  {
    id: 'moss_crawl',
    name: 'Moss Crawl',
    description: 'Damp galleries where Verdiglass beads on the stone.',
    durationSec: 70,
    unlockAtOreProduced: 120,
    unlockAtDepth: 6,
    cost: { ore: 30, glowdust: 10 },
    baseLoot: { verdiglass: 10, glowdust: 16, ore: 15 },
    bonusChance: 0.32,
    bonusLoot: { verdiglass: 6 },
  },
  {
    id: 'crystal_fault',
    name: 'Crystal Fault',
    description: 'A fractured wall glittering with Emberglass.',
    durationSec: 90,
    unlockAtOreProduced: 200,
    cost: { ore: 40, glowdust: 15 },
    baseLoot: { emberglass: 28, glowdust: 20 },
    bonusChance: 0.3,
    bonusLoot: { alloy: 6 },
  },
  {
    id: 'slag_run',
    name: 'Slag Run',
    description: 'Heat vents spit Emberglass and half-forged Alloy.',
    durationSec: 140,
    unlockAtOreProduced: 400,
    unlockAtDepth: 20,
    cost: { emberglass: 25, verdiglass: 8 },
    baseLoot: { emberglass: 40, alloy: 12, verdiglass: 8 },
    bonusChance: 0.28,
    bonusLoot: { alloy: 8 },
  },
  {
    id: 'ember_rift',
    name: 'Ember Rift',
    description: 'Heat shimmer and rare Alloy seams.',
    durationSec: 180,
    unlockAtOreProduced: 600,
    cost: { emberglass: 40, glowdust: 25 },
    baseLoot: { alloy: 22, emberglass: 35, glowdust: 15 },
    bonusChance: 0.25,
    bonusLoot: { relics: 1 },
  },
  {
    id: 'frost_descent',
    name: 'Frost Descent',
    description: 'Cold seams that crack Verdiglass into sharper dust.',
    durationSec: 240,
    unlockAtOreProduced: 1200,
    unlockAtDepth: 42,
    cost: { verdiglass: 20, alloy: 15, glowdust: 30 },
    baseLoot: { verdiglass: 28, glowdust: 40, alloy: 18 },
    bonusChance: 0.3,
    bonusLoot: { nightiron: 3 },
  },
  {
    id: 'abyss_vein',
    name: 'Abyss Vein',
    description: 'Deep dark. High risk. Legendary returns.',
    durationSec: 360,
    unlockAtOreProduced: 2000,
    cost: { alloy: 30, glowdust: 40, emberglass: 50 },
    baseLoot: { alloy: 50, glowdust: 45, emberglass: 60, nightiron: 8 },
    bonusChance: 0.4,
    bonusLoot: { relics: 2, nightiron: 4 },
  },
  {
    id: 'deep_dark',
    name: 'Deep Dark',
    description: 'Where Nightiron cools and Starshards wake.',
    durationSec: 480,
    unlockAtOreProduced: 5000,
    cost: { nightiron: 12, alloy: 40, glowdust: 60 },
    baseLoot: { nightiron: 20, starshard: 10, alloy: 40 },
    bonusChance: 0.35,
    bonusLoot: { starshard: 6, relics: 2 },
  },
  {
    id: 'starfall_raid',
    name: 'Starfall Raid',
    description: 'Hollows lit by fallen Starshards — scouts haul bright metal.',
    durationSec: 600,
    unlockAtOreProduced: 9000,
    unlockAtDepth: 120,
    cost: { starshard: 12, nightiron: 20, verdiglass: 25 },
    baseLoot: { starshard: 22, nightiron: 18, alloy: 55, aetherite: 2 },
    bonusChance: 0.32,
    bonusLoot: { aetherite: 3, relics: 2 },
  },
  {
    id: 'aether_breach',
    name: 'Aether Breach',
    description: 'The Core thrums. Only Aetherite parties return.',
    durationSec: 780,
    unlockAtOreProduced: 16_000,
    unlockAtDepth: 175,
    cost: { aetherite: 8, starshard: 25, nightiron: 30 },
    baseLoot: { aetherite: 14, starshard: 30, nightiron: 25, alloy: 70 },
    bonusChance: 0.4,
    bonusLoot: { aetherite: 6, relics: 3 },
  },
];

export function getExpedition(id: ExpeditionId): ExpeditionDef {
  const expedition = EXPEDITIONS.find((e) => e.id === id);
  if (!expedition) {
    throw new Error(`Unknown expedition: ${id}`);
  }
  return expedition;
}

export function expeditionUnlocked(
  expedition: ExpeditionDef,
  totalOreProduced: number,
  mineDepth: number,
): boolean {
  if (totalOreProduced < expedition.unlockAtOreProduced) return false;
  if (expedition.unlockAtDepth != null && mineDepth < expedition.unlockAtDepth) {
    return false;
  }
  return true;
}
