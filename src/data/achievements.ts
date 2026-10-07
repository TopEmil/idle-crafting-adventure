import type { RecipeId } from './recipes';
import type { ResourceId } from './resources';
import type { StationId } from './stations';

export type AchievementId =
  | 'first_strike'
  | 'vein_warmup'
  | 'hearth_lit'
  | 'copper_bound'
  | 'scouts_return'
  | 'glass_river'
  | 'alloy_ring'
  | 'deep_diggers'
  | 'enchanters_oath'
  | 'full_pantry'
  | 'first_reforge'
  | 'abyss_ready';

/** Instant resource grants (temporary) + permanent power bonuses that survive Reforge. */
export interface AchievementRewards {
  resources?: Partial<Record<ResourceId, number>>;
  /** Multiplicative tap bonus, e.g. 1.05 = +5%. */
  clickPower?: number;
  /** Multiplicative station output, e.g. 1.08 = +8%. */
  stationOutput?: number;
  /** Additive dwarf autoMine fraction of tap power → ore/sec. */
  autoMine?: number;
}

export type AchievementCondition =
  | { type: 'lifetime_clicks'; amount: number }
  | { type: 'lifetime_ore'; amount: number }
  | { type: 'total_ore_produced'; amount: number }
  | { type: 'station_unlocked'; stationId: StationId }
  | { type: 'recipe_owned'; recipeId: RecipeId }
  | { type: 'expedition_claimed' }
  | { type: 'resource_at_least'; resource: ResourceId; amount: number }
  | { type: 'recipes_owned_count'; amount: number }
  | { type: 'prestige_count'; amount: number };

export interface AchievementDef {
  id: AchievementId;
  name: string;
  description: string;
  condition: AchievementCondition;
  rewards: AchievementRewards;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_strike',
    name: 'First Strike',
    description: 'Tap the vein 50 times.',
    condition: { type: 'lifetime_clicks', amount: 50 },
    rewards: { resources: { ore: 50 } },
  },
  {
    id: 'vein_warmup',
    name: 'Vein Warmup',
    description: 'Produce 100 ore in a run.',
    condition: { type: 'lifetime_ore', amount: 100 },
    rewards: { clickPower: 1.05 },
  },
  {
    id: 'hearth_lit',
    name: 'Hearth Lit',
    description: 'Unlock the Smelter.',
    condition: { type: 'station_unlocked', stationId: 'smelter' },
    rewards: { resources: { ore: 25, emberglass: 10 } },
  },
  {
    id: 'copper_bound',
    name: 'Copper Bound',
    description: 'Craft the Copper Pick.',
    condition: { type: 'recipe_owned', recipeId: 'copper_pick' },
    rewards: { autoMine: 0.05 },
  },
  {
    id: 'scouts_return',
    name: "Scout's Return",
    description: 'Claim your first expedition.',
    condition: { type: 'expedition_claimed' },
    rewards: { resources: { glowdust: 20 } },
  },
  {
    id: 'glass_river',
    name: 'Glass River',
    description: 'Hold 100 Emberglass at once.',
    condition: { type: 'resource_at_least', resource: 'emberglass', amount: 100 },
    rewards: { stationOutput: 1.08 },
  },
  {
    id: 'alloy_ring',
    name: 'Alloy Ring',
    description: 'Unlock the Anvil.',
    condition: { type: 'station_unlocked', stationId: 'anvil' },
    rewards: { resources: { alloy: 15 }, stationOutput: 1.05 },
  },
  {
    id: 'deep_diggers',
    name: 'Deep Diggers',
    description: 'Produce 10,000 ore in a run.',
    condition: { type: 'lifetime_ore', amount: 10_000 },
    rewards: { clickPower: 1.1, autoMine: 0.05 },
  },
  {
    id: 'enchanters_oath',
    name: "Enchanter's Oath",
    description: 'Unlock the Enchanter.',
    condition: { type: 'station_unlocked', stationId: 'enchanter' },
    rewards: { resources: { glowdust: 30 }, stationOutput: 1.1 },
  },
  {
    id: 'full_pantry',
    name: 'Full Pantry',
    description: 'Own 6 recipes.',
    condition: { type: 'recipes_owned_count', amount: 6 },
    rewards: { resources: { ore: 50 }, clickPower: 1.08 },
  },
  {
    id: 'first_reforge',
    name: 'First Reforge',
    description: 'Reforge the forge once.',
    condition: { type: 'prestige_count', amount: 1 },
    rewards: { clickPower: 1.1, autoMine: 0.1 },
  },
  {
    id: 'abyss_ready',
    name: 'Abyss Ready',
    description: 'Produce 2,000 ore to open Abyss Vein.',
    condition: { type: 'total_ore_produced', amount: 2000 },
    rewards: { resources: { relics: 1 }, stationOutput: 1.12 },
  },
];

export function getAchievement(id: AchievementId): AchievementDef {
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) {
    throw new Error(`Unknown achievement: ${id}`);
  }
  return def;
}

export function emptyUnlockedAchievements(): AchievementId[] {
  return [];
}
