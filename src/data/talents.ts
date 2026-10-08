/** Prestige talent tree — spend Relics for permanent bonuses (persists across Reforge). */

export type TalentId =
  | 'vein_attunement'
  | 'hearth_kindling'
  | 'scout_instinct'
  | 'deep_slumber'
  | 'pick_mastery'
  | 'seam_sense'
  | 'caravan_pact'
  | 'relic_lore';

export interface TalentDef {
  id: TalentId;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  /** Additive mult contribution per level (level 1 → 1 + rate). */
  effects: {
    clickPowerPerLevel?: number;
    stationOutputPerLevel?: number;
    expeditionLootPerLevel?: number;
    offlineRatePerLevel?: number;
    /** Additive dwarf autoMine fraction of tap power → ore/sec per level. */
    autoMinePerLevel?: number;
    /** Fraction shorter expedition duration per level (0.05 = 5% faster). */
    expeditionSpeedPerLevel?: number;
    /** Extra Relics fraction from Reforge per level. */
    relicGainPerLevel?: number;
  };
}

export const TALENTS: TalentDef[] = [
  {
    id: 'vein_attunement',
    name: 'Vein Attunement',
    description: 'Stronger taps on the mineral face.',
    maxLevel: 20,
    baseCost: 1,
    costGrowth: 1.35,
    effects: { clickPowerPerLevel: 0.1 },
  },
  {
    id: 'hearth_kindling',
    name: 'Hearth Kindling',
    description: 'Stations smelt and forge faster.',
    maxLevel: 20,
    baseCost: 1,
    costGrowth: 1.35,
    effects: { stationOutputPerLevel: 0.1 },
  },
  {
    id: 'scout_instinct',
    name: 'Scout Instinct',
    description: 'Expeditions bring richer packs.',
    maxLevel: 15,
    baseCost: 1,
    costGrowth: 1.4,
    effects: { expeditionLootPerLevel: 0.08 },
  },
  {
    id: 'deep_slumber',
    name: 'Deep Slumber',
    description: 'The forge keeps working while you rest.',
    maxLevel: 15,
    baseCost: 1,
    costGrowth: 1.4,
    effects: { offlineRatePerLevel: 0.1 },
  },
  {
    id: 'pick_mastery',
    name: 'Pick Mastery',
    description: 'Your dwarf strikes harder between taps.',
    maxLevel: 15,
    baseCost: 2,
    costGrowth: 1.4,
    effects: { autoMinePerLevel: 0.04 },
  },
  {
    id: 'seam_sense',
    name: 'Seam Sense',
    description: 'Reads deeper seams for stronger taps.',
    maxLevel: 15,
    baseCost: 2,
    costGrowth: 1.4,
    effects: { clickPowerPerLevel: 0.06, offlineRatePerLevel: 0.04 },
  },
  {
    id: 'caravan_pact',
    name: 'Caravan Pact',
    description: 'Scout parties march home sooner.',
    maxLevel: 12,
    baseCost: 2,
    costGrowth: 1.45,
    effects: { expeditionSpeedPerLevel: 0.04, expeditionLootPerLevel: 0.03 },
  },
  {
    id: 'relic_lore',
    name: 'Relic Lore',
    description: 'Reforge yields more permanent Relics.',
    maxLevel: 10,
    baseCost: 3,
    costGrowth: 1.5,
    effects: { relicGainPerLevel: 0.08 },
  },
];

export function getTalent(id: TalentId): TalentDef {
  const talent = TALENTS.find((t) => t.id === id);
  if (!talent) {
    throw new Error(`Unknown talent: ${id}`);
  }
  return talent;
}

export function emptyTalents(): Record<TalentId, number> {
  return {
    vein_attunement: 0,
    hearth_kindling: 0,
    scout_instinct: 0,
    deep_slumber: 0,
    pick_mastery: 0,
    seam_sense: 0,
    caravan_pact: 0,
    relic_lore: 0,
  };
}

export function talentUpgradeCost(def: TalentDef, level: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, level));
}
