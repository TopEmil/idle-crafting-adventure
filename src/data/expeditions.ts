import type { ResourceId } from './resources';

export type ExpeditionId =
  | 'glow_shalllows'
  | 'crystal_fault'
  | 'ember_rift'
  | 'abyss_vein'
  | 'deep_dark';

export interface ExpeditionDef {
  id: ExpeditionId;
  name: string;
  description: string;
  /** Duration in seconds */
  durationSec: number;
  unlockAtOreProduced: number;
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
];

export function getExpedition(id: ExpeditionId): ExpeditionDef {
  const expedition = EXPEDITIONS.find((e) => e.id === id);
  if (!expedition) {
    throw new Error(`Unknown expedition: ${id}`);
  }
  return expedition;
}
