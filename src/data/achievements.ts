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
  | 'abyss_ready'
  | 'moss_touched'
  | 'crucible_lit'
  | 'starfall_sight'
  | 'aether_bound';

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
  | { type: 'station_level'; stationId: StationId; level: number }
  | { type: 'recipe_owned'; recipeId: RecipeId }
  | { type: 'expedition_claimed' }
  | { type: 'resource_at_least'; resource: ResourceId; amount: number }
  | { type: 'recipes_owned_count'; amount: number }
  | { type: 'prestige_count'; amount: number };

export interface AchievementTier {
  /** Tier index starting at 1 — claim in order. */
  level: number;
  name: string;
  description: string;
  condition: AchievementCondition;
  rewards: AchievementRewards;
}

export interface AchievementDef {
  id: AchievementId;
  /** Family title shown on the Achievements page. */
  name: string;
  tiers: AchievementTier[];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_strike',
    name: 'First Strike',
    tiers: [
      {
        level: 1,
        name: 'First Strike',
        description: 'Tap the vein 50 times.',
        condition: { type: 'lifetime_clicks', amount: 50 },
        rewards: { resources: { ore: 50 } },
      },
      {
        level: 2,
        name: 'Steady Hands',
        description: 'Tap the vein 500 times.',
        condition: { type: 'lifetime_clicks', amount: 500 },
        rewards: { clickPower: 1.04 },
      },
      {
        level: 3,
        name: 'Vein Drummer',
        description: 'Tap the vein 2,500 times.',
        condition: { type: 'lifetime_clicks', amount: 2500 },
        rewards: { autoMine: 0.04 },
      },
    ],
  },
  {
    id: 'vein_warmup',
    name: 'Vein Warmup',
    tiers: [
      {
        level: 1,
        name: 'Vein Warmup',
        description: 'Produce 100 ore in a run.',
        condition: { type: 'lifetime_ore', amount: 100 },
        rewards: { clickPower: 1.05 },
      },
    ],
  },
  {
    id: 'hearth_lit',
    name: 'Smelter',
    tiers: [
      {
        level: 1,
        name: 'Hearth Lit',
        description: 'Unlock the Smelter.',
        condition: { type: 'station_unlocked', stationId: 'smelter' },
        rewards: { resources: { ore: 25, emberglass: 10 } },
      },
      {
        level: 2,
        name: 'Smelter Lv 3',
        description: 'Raise the Smelter to level 3.',
        condition: { type: 'station_level', stationId: 'smelter', level: 3 },
        rewards: { stationOutput: 1.04, resources: { emberglass: 20 } },
      },
      {
        level: 3,
        name: 'Smelter Lv 5',
        description: 'Raise the Smelter to level 5.',
        condition: { type: 'station_level', stationId: 'smelter', level: 5 },
        rewards: { stationOutput: 1.06, resources: { ore: 80 } },
      },
      {
        level: 4,
        name: 'Smelter Lv 10',
        description: 'Raise the Smelter to level 10.',
        condition: { type: 'station_level', stationId: 'smelter', level: 10 },
        rewards: { stationOutput: 1.1, autoMine: 0.05 },
      },
    ],
  },
  {
    id: 'copper_bound',
    name: 'Copper Bound',
    tiers: [
      {
        level: 1,
        name: 'Copper Bound',
        description: 'Craft the Copper Pick.',
        condition: { type: 'recipe_owned', recipeId: 'copper_pick' },
        rewards: { autoMine: 0.05 },
      },
    ],
  },
  {
    id: 'scouts_return',
    name: "Scout's Return",
    tiers: [
      {
        level: 1,
        name: "Scout's Return",
        description: 'Claim your first expedition.',
        condition: { type: 'expedition_claimed' },
        rewards: { resources: { glowdust: 20 } },
      },
    ],
  },
  {
    id: 'glass_river',
    name: 'Glass River',
    tiers: [
      {
        level: 1,
        name: 'Glass River',
        description: 'Hold 100 Emberglass at once.',
        condition: { type: 'resource_at_least', resource: 'emberglass', amount: 100 },
        rewards: { stationOutput: 1.08 },
      },
    ],
  },
  {
    id: 'alloy_ring',
    name: 'Anvil',
    tiers: [
      {
        level: 1,
        name: 'Alloy Ring',
        description: 'Unlock the Anvil.',
        condition: { type: 'station_unlocked', stationId: 'anvil' },
        rewards: { resources: { alloy: 15 }, stationOutput: 1.05 },
      },
      {
        level: 2,
        name: 'Anvil Lv 3',
        description: 'Raise the Anvil to level 3.',
        condition: { type: 'station_level', stationId: 'anvil', level: 3 },
        rewards: { stationOutput: 1.04, resources: { alloy: 20 } },
      },
      {
        level: 3,
        name: 'Anvil Lv 5',
        description: 'Raise the Anvil to level 5.',
        condition: { type: 'station_level', stationId: 'anvil', level: 5 },
        rewards: { stationOutput: 1.06, resources: { emberglass: 60 } },
      },
      {
        level: 4,
        name: 'Anvil Lv 10',
        description: 'Raise the Anvil to level 10.',
        condition: { type: 'station_level', stationId: 'anvil', level: 10 },
        rewards: { stationOutput: 1.1, clickPower: 1.05 },
      },
    ],
  },
  {
    id: 'deep_diggers',
    name: 'Deep Diggers',
    tiers: [
      {
        level: 1,
        name: 'Deep Diggers',
        description: 'Produce 10,000 ore in a run.',
        condition: { type: 'lifetime_ore', amount: 10_000 },
        rewards: { clickPower: 1.1, autoMine: 0.05 },
      },
      {
        level: 2,
        name: 'Ore Cascade',
        description: 'Produce 100,000 ore in a run.',
        condition: { type: 'lifetime_ore', amount: 100_000 },
        rewards: { clickPower: 1.08, autoMine: 0.05 },
      },
    ],
  },
  {
    id: 'enchanters_oath',
    name: 'Enchanter',
    tiers: [
      {
        level: 1,
        name: "Enchanter's Oath",
        description: 'Unlock the Enchanter.',
        condition: { type: 'station_unlocked', stationId: 'enchanter' },
        rewards: { resources: { glowdust: 30 }, stationOutput: 1.1 },
      },
      {
        level: 2,
        name: 'Enchanter Lv 3',
        description: 'Raise the Enchanter to level 3.',
        condition: { type: 'station_level', stationId: 'enchanter', level: 3 },
        rewards: { stationOutput: 1.05, resources: { glowdust: 40 } },
      },
      {
        level: 3,
        name: 'Enchanter Lv 5',
        description: 'Raise the Enchanter to level 5.',
        condition: { type: 'station_level', stationId: 'enchanter', level: 5 },
        rewards: { stationOutput: 1.08 },
      },
      {
        level: 4,
        name: 'Enchanter Lv 10',
        description: 'Raise the Enchanter to level 10.',
        condition: { type: 'station_level', stationId: 'enchanter', level: 10 },
        rewards: { stationOutput: 1.12, autoMine: 0.05 },
      },
    ],
  },
  {
    id: 'full_pantry',
    name: 'Full Pantry',
    tiers: [
      {
        level: 1,
        name: 'Full Pantry',
        description: 'Own 6 recipes.',
        condition: { type: 'recipes_owned_count', amount: 6 },
        rewards: { resources: { ore: 50 }, clickPower: 1.08 },
      },
    ],
  },
  {
    id: 'first_reforge',
    name: 'First Reforge',
    tiers: [
      {
        level: 1,
        name: 'First Reforge',
        description: 'Reforge the forge once.',
        condition: { type: 'prestige_count', amount: 1 },
        rewards: { clickPower: 1.1, autoMine: 0.1 },
      },
    ],
  },
  {
    id: 'abyss_ready',
    name: 'Abyss Ready',
    tiers: [
      {
        level: 1,
        name: 'Abyss Ready',
        description: 'Produce 2,000 ore to open Abyss Vein.',
        condition: { type: 'total_ore_produced', amount: 2000 },
        rewards: { resources: { relics: 1 }, stationOutput: 1.12 },
      },
    ],
  },
  {
    id: 'moss_touched',
    name: 'Moss Touched',
    tiers: [
      {
        level: 1,
        name: 'Moss Touched',
        description: 'Hold 10 Verdiglass at once.',
        condition: { type: 'resource_at_least', resource: 'verdiglass', amount: 10 },
        rewards: { resources: { glowdust: 25 }, autoMine: 0.04 },
      },
    ],
  },
  {
    id: 'crucible_lit',
    name: 'Verdant Crucible',
    tiers: [
      {
        level: 1,
        name: 'Crucible Lit',
        description: 'Unlock the Verdant Crucible.',
        condition: { type: 'station_unlocked', stationId: 'crucible' },
        rewards: { resources: { verdiglass: 15 }, stationOutput: 1.06 },
      },
      {
        level: 2,
        name: 'Crucible Lv 3',
        description: 'Raise the Verdant Crucible to level 3.',
        condition: { type: 'station_level', stationId: 'crucible', level: 3 },
        rewards: { stationOutput: 1.04, resources: { verdiglass: 20 } },
      },
      {
        level: 3,
        name: 'Crucible Lv 5',
        description: 'Raise the Verdant Crucible to level 5.',
        condition: { type: 'station_level', stationId: 'crucible', level: 5 },
        rewards: { stationOutput: 1.06 },
      },
      {
        level: 4,
        name: 'Crucible Lv 10',
        description: 'Raise the Verdant Crucible to level 10.',
        condition: { type: 'station_level', stationId: 'crucible', level: 10 },
        rewards: { stationOutput: 1.1, clickPower: 1.05 },
      },
    ],
  },
  {
    id: 'starfall_sight',
    name: 'Starfall Sight',
    tiers: [
      {
        level: 1,
        name: 'Starfall Sight',
        description: 'Hold 15 Starshard at once.',
        condition: { type: 'resource_at_least', resource: 'starshard', amount: 15 },
        rewards: { clickPower: 1.08, resources: { nightiron: 10 } },
      },
    ],
  },
  {
    id: 'aether_bound',
    name: 'Aetherforge',
    tiers: [
      {
        level: 1,
        name: 'Aether Bound',
        description: 'Unlock the Aetherforge.',
        condition: { type: 'station_unlocked', stationId: 'aetherforge' },
        rewards: { resources: { aetherite: 4, relics: 2 }, stationOutput: 1.15 },
      },
      {
        level: 2,
        name: 'Aetherforge Lv 3',
        description: 'Raise the Aetherforge to level 3.',
        condition: { type: 'station_level', stationId: 'aetherforge', level: 3 },
        rewards: { stationOutput: 1.06, resources: { aetherite: 3 } },
      },
      {
        level: 3,
        name: 'Aetherforge Lv 5',
        description: 'Raise the Aetherforge to level 5.',
        condition: { type: 'station_level', stationId: 'aetherforge', level: 5 },
        rewards: { stationOutput: 1.08 },
      },
      {
        level: 4,
        name: 'Aetherforge Lv 10',
        description: 'Raise the Aetherforge to level 10.',
        condition: { type: 'station_level', stationId: 'aetherforge', level: 10 },
        rewards: { stationOutput: 1.12, clickPower: 1.08 },
      },
    ],
  },
];

const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id: AchievementId): AchievementDef {
  const def = ACHIEVEMENT_BY_ID.get(id);
  if (!def) {
    throw new Error(`Unknown achievement: ${id}`);
  }
  return def;
}

export function getAchievementTier(id: AchievementId, level: number): AchievementTier | undefined {
  return getAchievement(id).tiers.find((t) => t.level === level);
}

export function emptyClaimedAchievements(): Partial<Record<AchievementId, number>> {
  return {};
}

/** @deprecated Prefer emptyClaimedAchievements — kept for migrate helpers. */
export function emptyUnlockedAchievements(): AchievementId[] {
  return [];
}

export function totalAchievementTiers(): number {
  return ACHIEVEMENTS.reduce((sum, def) => sum + def.tiers.length, 0);
}

export function claimedAchievementTierCount(
  claimed: Partial<Record<AchievementId, number>> | undefined,
): number {
  let sum = 0;
  for (const def of ACHIEVEMENTS) {
    const level = Math.max(0, Math.floor(claimed?.[def.id] ?? 0));
    sum += Math.min(level, def.tiers.length);
  }
  return sum;
}
