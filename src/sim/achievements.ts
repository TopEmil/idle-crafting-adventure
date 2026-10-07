import {
  ACHIEVEMENTS,
  getAchievement,
  type AchievementCondition,
  type AchievementDef,
  type AchievementId,
  type AchievementRewards,
} from '../data/achievements';
import type { ResourceId } from '../data/resources';
import { recordOreMined } from './oreScore';
import type { GameState } from './types';

export function isAchievementUnlocked(state: GameState, id: AchievementId): boolean {
  return state.unlockedAchievements.includes(id);
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

/** Sum permanent bonuses from unlocked achievements. */
export function aggregateAchievementRewards(
  unlocked: readonly AchievementId[],
): Required<Pick<AchievementRewards, 'clickPower' | 'stationOutput' | 'autoMine'>> {
  let clickPower = 1;
  let stationOutput = 1;
  let autoMine = 0;
  for (const id of unlocked) {
    const rewards = getAchievement(id).rewards;
    if (rewards.clickPower) clickPower *= rewards.clickPower;
    if (rewards.stationOutput) stationOutput *= rewards.stationOutput;
    if (rewards.autoMine) autoMine += rewards.autoMine;
  }
  return { clickPower, stationOutput, autoMine };
}

/**
 * Unlock any newly completed achievements and grant their rewards once.
 * Permanent power bonuses are applied via aggregateEffects; resources are granted here.
 */
export function syncAchievements(state: GameState): {
  state: GameState;
  unlocked: AchievementDef[];
} {
  const newly: AchievementDef[] = [];
  let next = state;

  for (const def of ACHIEVEMENTS) {
    if (isAchievementUnlocked(next, def.id)) continue;
    if (!achievementConditionMet(next, def.condition)) continue;

    if (next === state) {
      next = structuredClone(state);
    }
    next.unlockedAchievements.push(def.id);
    if (def.rewards.resources) {
      grantResources(next.resources, def.rewards.resources);
      const oreGain = def.rewards.resources.ore ?? 0;
      if (oreGain > 0) {
        recordOreMined(next, oreGain);
      }
    }
    newly.push(def);
  }

  return { state: next, unlocked: newly };
}
