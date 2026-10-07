import { EXPEDITIONS } from '../data/expeditions';
import { getRecipe } from '../data/recipes';
import { STATIONS } from '../data/stations';
import { availableExpeditions, availableRecipes, canAfford, canPrestige } from '../sim/economy';
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
  // Pending expedition loot always wins — otherwise players get stuck without Dust.
  if (state.pendingLoot) {
    return {
      id: 'exp-claim',
      title: 'Claim expedition loot',
      detail: 'Your scouts are back at the forge',
      progress: 1,
      ready: true,
    };
  }

  if (state.activeExpedition) {
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

  const nextRecipe = availableRecipes(state)[0];
  if (nextRecipe) {
    const dustNeed = nextRecipe.cost.glowdust ?? 0;
    if (dustNeed > 0 && state.resources.glowdust < dustNeed) {
      const firstDustRun = availableExpeditions(state).find((e) => (e.baseLoot.glowdust ?? 0) > 0);
      if (firstDustRun && canAfford(state.resources, firstDustRun.cost)) {
        return {
          id: `exp-dust:${firstDustRun.id}`,
          title: `Send ${firstDustRun.name}`,
          detail: `Earn Glowdust for ${nextRecipe.name}`,
          progress: Math.min(1, state.resources.glowdust / dustNeed),
          ready: true,
        };
      }
      if (firstDustRun) {
        return {
          id: `exp-dust-cost:${firstDustRun.id}`,
          title: `Gather for ${firstDustRun.name}`,
          detail: `Need Glowdust — expeditions are the source`,
          progress: Math.min(1, state.resources.glowdust / dustNeed),
          ready: false,
        };
      }
      const gate = EXPEDITIONS.find((e) => (e.baseLoot.glowdust ?? 0) > 0);
      if (gate && state.totalOreProduced < gate.unlockAtOreProduced) {
        return {
          id: `exp:${gate.id}`,
          title: `Unlock ${gate.name}`,
          detail: `${formatNumber(state.totalOreProduced)} / ${formatNumber(gate.unlockAtOreProduced)} lifetime ore → Glowdust`,
          progress: Math.min(1, state.totalOreProduced / gate.unlockAtOreProduced),
          ready: false,
        };
      }
    }

    let ratio = 1;
    const parts: string[] = [];
    for (const [key, amount] of Object.entries(nextRecipe.cost)) {
      const owned = state.resources[key as keyof typeof state.resources] ?? 0;
      const r = amount > 0 ? Math.min(1, owned / amount) : 1;
      ratio = Math.min(ratio, r);
      parts.push(`${formatNumber(owned)}/${formatNumber(amount)}`);
    }
    return {
      id: `recipe:${nextRecipe.id}`,
      title: `Craft ${nextRecipe.name}`,
      detail: parts.join(' · '),
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

  if (canPrestige(state) && state.lifetimeOre >= 800) {
    return {
      id: 'prestige',
      title: 'Reforge the forge',
      detail: 'Earn Relics for permanent Talents',
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
