import {
  ACHIEVEMENTS,
  getAchievement,
  type AchievementCondition,
  type AchievementDef,
  type AchievementId,
  type AchievementRewards,
  type AchievementTier,
} from '../data/achievements';
import type { ResourceId } from '../data/resources';
import { recordOreMined } from './oreScore';
import type { GameState } from './types';

export interface ReadyAchievement {
  def: AchievementDef;
  tier: AchievementTier;
}

export function claimedLevel(
  state: GameState,
  id: AchievementId,
): number {
  return Math.max(0, Math.floor(state.claimedAchievements?.[id] ?? 0));
}

export function isAchievementFullyClaimed(state: GameState, id: AchievementId): boolean {
  const def = getAchievement(id);
  return claimedLevel(state, id) >= def.tiers.length;
}

/** Next tier that can be claimed (previous claimed + condition met). */
export function nextClaimableTier(state: GameState, id: AchievementId): AchievementTier | null {
  const def = getAchievement(id);
  const claimed = claimedLevel(state, id);
  const next = def.tiers.find((t) => t.level === claimed + 1);
  if (!next) return null;
  if (!achievementConditionMet(state, next.condition)) return null;
  return next;
}

/** Active tier shown for progress: next unclaimed, or last if fully claimed. */
export function activeTier(state: GameState, id: AchievementId): AchievementTier {
  const def = getAchievement(id);
  const claimed = claimedLevel(state, id);
  return def.tiers.find((t) => t.level === claimed + 1) ?? def.tiers[def.tiers.length - 1]!;
}

export function listReadyAchievements(state: GameState): ReadyAchievement[] {
  const ready: ReadyAchievement[] = [];
  for (const def of ACHIEVEMENTS) {
    const tier = nextClaimableTier(state, def.id);
    if (tier) ready.push({ def, tier });
  }
  return ready;
}

export function achievementConditionMet(
  state: GameState,
  condition: AchievementCondition,
): boolean {
  switch (condition.type) {
    case 'lifetime_clicks':
      return state.lifetimeClicks >= condition.amount;
    case 'lifetime_ore':
      return state.lifetimeOre >= condition.amount;
    case 'total_ore_produced':
      return state.totalOreProduced >= condition.amount;
    case 'station_unlocked':
      return state.stations[condition.stationId]?.unlocked === true;
    case 'station_level':
      return (state.stations[condition.stationId]?.level ?? 0) >= condition.level;
    case 'recipe_owned':
      return state.ownedRecipes.includes(condition.recipeId);
    case 'expedition_claimed':
      return state.milestones.firstExpeditionClaimed;
    case 'resource_at_least':
      return (state.resources[condition.resource] ?? 0) >= condition.amount;
    case 'recipes_owned_count':
      return state.ownedRecipes.length >= condition.amount;
    case 'prestige_count':
      return state.prestigeCount >= condition.amount;
    default: {
      const _exhaustive: never = condition;
      return _exhaustive;
    }
  }
}

export function achievementProgress(
  state: GameState,
  condition: AchievementCondition,
): { current: number; target: number } {
  switch (condition.type) {
    case 'lifetime_clicks':
      return { current: state.lifetimeClicks, target: condition.amount };
    case 'lifetime_ore':
      return { current: state.lifetimeOre, target: condition.amount };
    case 'total_ore_produced':
      return { current: state.totalOreProduced, target: condition.amount };
    case 'station_unlocked':
      return {
        current: state.stations[condition.stationId]?.unlocked ? 1 : 0,
        target: 1,
      };
    case 'station_level':
      return {
        current: state.stations[condition.stationId]?.level ?? 0,
        target: condition.level,
      };
    case 'recipe_owned':
      return {
        current: state.ownedRecipes.includes(condition.recipeId) ? 1 : 0,
        target: 1,
      };
    case 'expedition_claimed':
      return {
        current: state.milestones.firstExpeditionClaimed ? 1 : 0,
        target: 1,
      };
    case 'resource_at_least':
      return {
        current: state.resources[condition.resource] ?? 0,
        target: condition.amount,
      };
    case 'recipes_owned_count':
      return { current: state.ownedRecipes.length, target: condition.amount };
    case 'prestige_count':
      return { current: state.prestigeCount, target: condition.amount };
    default: {
      const _exhaustive: never = condition;
      return _exhaustive;
    }
  }
}

function grantResources(
  wallet: Record<ResourceId, number>,
  loot: Partial<Record<ResourceId, number>>,
): void {
  for (const [key, amount] of Object.entries(loot) as [ResourceId, number][]) {
    wallet[key] = (wallet[key] ?? 0) + amount;
  }
}

/** Sum permanent bonuses from all claimed achievement tiers. */
export function aggregateAchievementRewards(
  claimed: Partial<Record<AchievementId, number>> = {},
): Required<Pick<AchievementRewards, 'clickPower' | 'stationOutput' | 'autoMine'>> {
  let clickPower = 1;
  let stationOutput = 1;
  let autoMine = 0;

  for (const def of ACHIEVEMENTS) {
    const level = Math.max(0, Math.floor(claimed[def.id] ?? 0));
    if (level <= 0) continue;
    for (const tier of def.tiers) {
      if (tier.level > level) break;
      if (tier.rewards.clickPower) clickPower *= tier.rewards.clickPower;
      if (tier.rewards.stationOutput) stationOutput *= tier.rewards.stationOutput;
      if (tier.rewards.autoMine) autoMine += tier.rewards.autoMine;
    }
  }
  return { clickPower, stationOutput, autoMine };
}

/**
 * Claim the next ready tier for an achievement and grant its rewards once.
 */
export function claimAchievement(
  state: GameState,
  id: AchievementId,
):
  | { ok: true; state: GameState; def: AchievementDef; tier: AchievementTier }
  | { ok: false; reason: string } {
  const tier = nextClaimableTier(state, id);
  if (!tier) {
    return { ok: false, reason: 'Nothing to claim' };
  }

  const next = structuredClone(state);
  if (!next.claimedAchievements) next.claimedAchievements = {};
  next.claimedAchievements[id] = tier.level;

  if (tier.rewards.resources) {
    grantResources(next.resources, tier.rewards.resources);
    const oreGain = tier.rewards.resources.ore ?? 0;
    if (oreGain > 0) {
      recordOreMined(next, oreGain);
    }
  }

  return { ok: true, state: next, def: getAchievement(id), tier };
}

/**
 * @deprecated Achievements are no longer auto-claimed. Use listReadyAchievements + claimAchievement.
 * Kept as a no-op state pass-through so older call sites compile during migration.
 */
export function syncAchievements(state: GameState): {
  state: GameState;
  unlocked: AchievementDef[];
  ready: ReadyAchievement[];
} {
  return { state, unlocked: [], ready: listReadyAchievements(state) };
}
