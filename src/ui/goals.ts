import { EXPEDITIONS } from '../data/expeditions';
import { getRecipe } from '../data/recipes';
import { STATIONS } from '../data/stations';
import { availableRecipes, canPrestige } from '../sim/economy';
import type { GameState } from '../sim/types';
import { formatNumber } from './format';

export interface GoalInfo {
  id: string;
  title: string;
  detail: string;
  progress: number; // 0..1
  ready: boolean;
}

export function nextGoal(state: GameState): GoalInfo {
  const nextRecipe = availableRecipes(state)[0];
  if (nextRecipe) {
    const need = nextRecipe.cost.ore ?? 0;
    const have = state.resources.ore;
    // Multi-resource: use worst ratio
    let ratio = 1;
    let parts: string[] = [];
    for (const [key, amount] of Object.entries(nextRecipe.cost)) {
      const owned = state.resources[key as keyof typeof state.resources] ?? 0;
      const r = amount > 0 ? Math.min(1, owned / amount) : 1;
      ratio = Math.min(ratio, r);
      parts.push(`${formatNumber(owned)}/${formatNumber(amount)}`);
    }
    return {
      id: `recipe:${nextRecipe.id}`,
      title: `Craft ${nextRecipe.name}`,
      detail: parts.join(' · ') || `${formatNumber(have)}/${formatNumber(need)}`,
      progress: ratio,
      ready: ratio >= 1,
    };
  }

  for (const station of STATIONS) {
    const st = state.stations[station.id];
    if (st.unlocked) continue;
    if (station.unlockRequires && !state.stations[station.unlockRequires].unlocked) continue;
    let ratio = 1;
    const parts: string[] = [];
    for (const [key, amount] of Object.entries(station.unlockCost)) {
      const owned = state.resources[key as keyof typeof state.resources] ?? 0;
      const r = amount > 0 ? Math.min(1, owned / amount) : 1;
      ratio = Math.min(ratio, r);
      parts.push(`${formatNumber(owned)}/${formatNumber(amount)}`);
    }
    return {
      id: `station:${station.id}`,
      title: `Unlock ${station.name}`,
      detail: parts.join(' · '),
      progress: ratio,
      ready: ratio >= 1,
    };
  }

  const nextExp = EXPEDITIONS.find((e) => state.totalOreProduced < e.unlockAtOreProduced);
  if (nextExp) {
    const p = Math.min(1, state.totalOreProduced / nextExp.unlockAtOreProduced);
    return {
      id: `exp:${nextExp.id}`,
      title: `Open ${nextExp.name}`,
      detail: `${formatNumber(state.totalOreProduced)} / ${formatNumber(nextExp.unlockAtOreProduced)} lifetime ore`,
      progress: p,
      ready: false,
    };
  }

  if (state.activeExpedition && !state.pendingLoot) {
    const left = Math.max(0, state.activeExpedition.endsAt - Date.now());
    const def = EXPEDITIONS.find((e) => e.id === state.activeExpedition!.id);
    const dur = (def?.durationSec ?? 60) * 1000;
    const p = 1 - Math.min(1, left / dur);
    return {
      id: 'exp-active',
      title: 'Scouts en route',
      detail: left > 0 ? 'Await their return…' : 'Loot ready — open Expeditions',
      progress: p,
      ready: left <= 0,
    };
  }

  if (state.pendingLoot) {
    return {
      id: 'exp-claim',
      title: 'Claim expedition loot',
      detail: 'Your scouts are back at the forge',
      progress: 1,
      ready: true,
    };
  }

  if (canPrestige(state) && state.lifetimeOre >= 800) {
    return {
      id: 'prestige',
      title: 'Reforge the forge',
      detail: 'Permanent power awaits in Forge',
      progress: 1,
      ready: true,
    };
  }

  const owned = state.ownedRecipes[state.ownedRecipes.length - 1];
  return {
    id: 'grow',
    title: owned ? `${getRecipe(owned).name} equipped` : 'Keep tapping the vein',
    detail: 'Upgrade stations · send expeditions',
    progress: Math.min(1, state.totalOreProduced / 5000),
    ready: false,
  };
}
