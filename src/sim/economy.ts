import {
  BALANCE,
  prestigeMult,
  relicsFromReforge,
  stationUpgradeCost,
  SIM_DT,
} from '../data/balance';
import { EXPEDITIONS, getExpedition, type ExpeditionId } from '../data/expeditions';
import { getRecipe, RECIPES, type RecipeId } from '../data/recipes';
import type { ResourceId } from '../data/resources';
import { getStation, STATIONS, type StationId } from '../data/stations';
import { aggregateEffects } from './effects';
import { createInitialState } from './createState';
import type { GameEvent, GameState } from './types';

function canAfford(
  wallet: Record<ResourceId, number>,
  cost: Partial<Record<ResourceId, number>>,
): boolean {
  for (const [key, amount] of Object.entries(cost) as [ResourceId, number][]) {
    if ((wallet[key] ?? 0) < amount) return false;
  }
  return true;
}

function pay(
  wallet: Record<ResourceId, number>,
  cost: Partial<Record<ResourceId, number>>,
): void {
  for (const [key, amount] of Object.entries(cost) as [ResourceId, number][]) {
    wallet[key] -= amount;
  }
}

function grant(
  wallet: Record<ResourceId, number>,
  loot: Partial<Record<ResourceId, number>>,
  mult = 1,
): Partial<Record<ResourceId, number>> {
  const gained: Partial<Record<ResourceId, number>> = {};
  for (const [key, amount] of Object.entries(loot) as [ResourceId, number][]) {
    const value = amount * mult;
    wallet[key] = (wallet[key] ?? 0) + value;
    gained[key] = (gained[key] ?? 0) + value;
  }
  return gained;
}

function scaleLoot(
  loot: Partial<Record<ResourceId, number>>,
  mult: number,
): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {};
  for (const [key, amount] of Object.entries(loot) as [ResourceId, number][]) {
    out[key] = Math.floor(amount * mult);
  }
  return out;
}

export function getClickPower(state: GameState): number {
  const effects = aggregateEffects(state.ownedRecipes);
  return BALANCE.baseClickOre * effects.clickPower * prestigeMult(state.totalRelicsEarned);
}

/** Ore/sec from the dwarf miner when autoMine recipes are owned. */
export function getAutoMineRate(state: GameState): number {
  const effects = aggregateEffects(state.ownedRecipes);
  if (effects.autoMine <= 0) return 0;
  return getClickPower(state) * effects.autoMine;
}

export function clickVein(state: GameState): { state: GameState; event: GameEvent } {
  const amount = getClickPower(state);
  const next = structuredClone(state);
  next.resources.ore += amount;
  next.totalOreProduced += amount;
  next.lifetimeOre += amount;
  return { state: next, event: { type: 'click_vein', amount } };
}

export function craftRecipe(
  state: GameState,
  recipeId: RecipeId,
): { ok: true; state: GameState; event: GameEvent } | { ok: false; reason: string } {
  if (state.ownedRecipes.includes(recipeId)) {
    return { ok: false, reason: 'Already owned' };
  }
  const recipe = getRecipe(recipeId);
  if (recipe.requires) {
    for (const req of recipe.requires) {
      if (!state.ownedRecipes.includes(req)) {
        return { ok: false, reason: `Requires ${getRecipe(req).name}` };
      }
    }
  }
  if (!canAfford(state.resources, recipe.cost)) {
    return { ok: false, reason: 'Not enough resources' };
  }
  const next = structuredClone(state);
  pay(next.resources, recipe.cost);
  next.ownedRecipes.push(recipeId);
  return { ok: true, state: next, event: { type: 'craft', recipeId } };
}

export function unlockStation(
  state: GameState,
  stationId: StationId,
): { ok: true; state: GameState; event: GameEvent } | { ok: false; reason: string } {
  const station = getStation(stationId);
  if (state.stations[stationId].unlocked) {
    return { ok: false, reason: 'Already unlocked' };
  }
  if (station.unlockRequires && !state.stations[station.unlockRequires].unlocked) {
    return { ok: false, reason: `Unlock ${getStation(station.unlockRequires).name} first` };
  }
  if (!canAfford(state.resources, station.unlockCost)) {
    return { ok: false, reason: 'Not enough resources' };
  }
  const next = structuredClone(state);
  pay(next.resources, station.unlockCost);
  next.stations[stationId].unlocked = true;
  next.stations[stationId].level = 1;
  next.stations[stationId].enabled = true;
  const events: GameEvent = { type: 'unlock_station', stationId };
  if (!next.milestones.firstStation) {
    next.milestones.firstStation = true;
  }
  return { ok: true, state: next, event: events };
}

export function upgradeStation(
  state: GameState,
  stationId: StationId,
): { ok: true; state: GameState; event: GameEvent } | { ok: false; reason: string } {
  const station = getStation(stationId);
  const current = state.stations[stationId];
  if (!current.unlocked) return { ok: false, reason: 'Locked' };
  if (current.level >= BALANCE.stationLevelCap) return { ok: false, reason: 'Max level' };

  const cost: Partial<Record<ResourceId, number>> = {};
  for (const [key, base] of Object.entries(station.baseCost) as [ResourceId, number][]) {
    cost[key] = stationUpgradeCost(base, station.costGrowth, current.level);
  }
  if (!canAfford(state.resources, cost)) {
    return { ok: false, reason: 'Not enough resources' };
  }
  const next = structuredClone(state);
  pay(next.resources, cost);
  next.stations[stationId].level += 1;
  return { ok: true, state: next, event: { type: 'upgrade_station', stationId } };
}

export function toggleStation(
  state: GameState,
  stationId: StationId,
): { ok: true; state: GameState } | { ok: false; reason: string } {
  const current = state.stations[stationId];
  if (!current.unlocked || current.level <= 0) {
    return { ok: false, reason: 'Locked' };
  }
  const next = structuredClone(state);
  next.stations[stationId].enabled = !current.enabled;
  return { ok: true, state: next };
}

export function startExpedition(
  state: GameState,
  expeditionId: ExpeditionId,
  now = Date.now(),
): { ok: true; state: GameState; event: GameEvent } | { ok: false; reason: string } {
  if (state.activeExpedition && !state.activeExpedition.claimed) {
    return { ok: false, reason: 'Expedition already active' };
  }
  if (state.pendingLoot) {
    return { ok: false, reason: 'Claim pending loot first' };
  }
  const def = getExpedition(expeditionId);
  if (state.totalOreProduced < def.unlockAtOreProduced) {
    return { ok: false, reason: 'Not unlocked yet' };
  }
  if (!canAfford(state.resources, def.cost)) {
    return { ok: false, reason: 'Not enough resources' };
  }
  const next = structuredClone(state);
  pay(next.resources, def.cost);
  next.activeExpedition = {
    id: expeditionId,
    startedAt: now,
    endsAt: now + def.durationSec * 1000,
    claimed: false,
    doublePending: false,
  };
  return { ok: true, state: next, event: { type: 'start_expedition', expeditionId } };
}

export function rollExpeditionLoot(
  state: GameState,
  expeditionId: ExpeditionId,
  rng: () => number = Math.random,
): Partial<Record<ResourceId, number>> {
  const def = getExpedition(expeditionId);
  const effects = aggregateEffects(state.ownedRecipes);
  const loot = scaleLoot(def.baseLoot, effects.expeditionLoot);
  if (rng() < def.bonusChance) {
    const bonus = scaleLoot(def.bonusLoot, effects.expeditionLoot);
    for (const [key, amount] of Object.entries(bonus) as [ResourceId, number][]) {
      loot[key] = (loot[key] ?? 0) + amount;
    }
  }
  return loot;
}

export function completeExpeditionIfReady(
  state: GameState,
  now = Date.now(),
  rng: () => number = Math.random,
): { state: GameState; event: GameEvent | null } {
  const active = state.activeExpedition;
  if (!active || active.claimed || state.pendingLoot) {
    return { state, event: null };
  }
  if (now < active.endsAt) {
    return { state, event: null };
  }
  const next = structuredClone(state);
  next.pendingLoot = rollExpeditionLoot(next, active.id, rng);
  next.activeExpedition = { ...active, claimed: true };
  return {
    state: next,
    event: { type: 'expedition_ready', expeditionId: active.id },
  };
}

export function claimExpedition(
  state: GameState,
  doubled: boolean,
): { ok: true; state: GameState; event: GameEvent } | { ok: false; reason: string } {
  // Only pendingLoot is required — older saves / edge paths can drop activeExpedition
  // while loot is still waiting, and that must not soft-lock the player.
  if (!state.pendingLoot) {
    return { ok: false, reason: 'Nothing to claim' };
  }
  const loot = state.pendingLoot;
  const next = structuredClone(state);
  const mult = doubled ? 2 : 1;
  grant(next.resources, loot, mult);
  if (loot.ore) {
    next.totalOreProduced += loot.ore * mult;
    next.lifetimeOre += loot.ore * mult;
  }
  next.pendingLoot = null;
  next.activeExpedition = null;
  if (!next.milestones.firstExpeditionClaimed) {
    next.milestones.firstExpeditionClaimed = true;
  }
  return { ok: true, state: next, event: { type: 'claim_expedition', doubled } };
}

export function tickProduction(state: GameState, dt: number): GameState {
  if (dt <= 0) return state;
  const next = structuredClone(state);
  const effects = aggregateEffects(next.ownedRecipes);
  const pMult = prestigeMult(next.totalRelicsEarned) * effects.stationOutput;

  const autoOre = getAutoMineRate(next) * dt;
  if (autoOre > 0) {
    next.resources.ore += autoOre;
    next.totalOreProduced += autoOre;
    next.lifetimeOre += autoOre;
  }

  for (const def of STATIONS) {
    const st = next.stations[def.id];
    if (!st.unlocked || st.level <= 0 || !st.enabled) continue;

    const levelMult = st.level;
    if (def.inputs) {
      let canRun = true;
      for (const [key, rate] of Object.entries(def.inputs) as [ResourceId, number][]) {
        const need = rate * levelMult * dt;
        if (next.resources[key] < need) {
          canRun = false;
          break;
        }
      }
      if (!canRun) continue;
      for (const [key, rate] of Object.entries(def.inputs) as [ResourceId, number][]) {
        next.resources[key] -= rate * levelMult * dt;
      }
    }

    for (const [key, rate] of Object.entries(def.outputs) as [ResourceId, number][]) {
      const gained = rate * levelMult * pMult * dt;
      next.resources[key] += gained;
      if (key === 'ore') {
        next.totalOreProduced += gained;
        next.lifetimeOre += gained;
      }
    }
  }

  next.playTimeSec += dt;
  return next;
}

/**
 * Advance simulation by real seconds.
 * Uses fixed SIM_DT for short spans; larger stable steps for offline catch-up
 * so multi-hour progress stays framerate-safe on the main thread.
 */
export function simulateSeconds(
  state: GameState,
  seconds: number,
  now = Date.now(),
  rng: () => number = Math.random,
): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const capped = Math.min(seconds, BALANCE.offlineCapSeconds);
  let remaining = capped;
  const stepSize = capped > 60 ? 1 : SIM_DT;

  while (remaining > 0) {
    const step = Math.min(stepSize, remaining);
    current = tickProduction(current, step);
    const ready = completeExpeditionIfReady(current, now - (remaining - step) * 1000, rng);
    current = ready.state;
    if (ready.event) events.push(ready.event);
    remaining -= step;
  }

  current.lastTickAt = now;
  return { state: current, events };
}

export function applyOfflineProgress(
  state: GameState,
  now = Date.now(),
): { state: GameState; event: GameEvent | null } {
  const elapsedSec = Math.max(0, (now - state.lastTickAt) / 1000);
  if (elapsedSec < 2) {
    return { state: { ...state, lastTickAt: now }, event: null };
  }

  const before = structuredClone(state.resources);
  const effects = aggregateEffects(state.ownedRecipes);
  const capped = Math.min(elapsedSec, BALANCE.offlineCapSeconds);
  const adjusted = capped * effects.offlineRate;
  const { state: after } = simulateSeconds(state, adjusted, now);

  const gains: Partial<Record<ResourceId, number>> = {};
  (Object.keys(after.resources) as ResourceId[]).forEach((key) => {
    const delta = after.resources[key] - before[key];
    if (delta > 0.01) gains[key] = delta;
  });

  return {
    state: after,
    event: { type: 'offline_summary', seconds: capped, gains },
  };
}

export function canPrestige(state: GameState): boolean {
  return state.lifetimeOre >= 500 || state.stations.smelter.unlocked;
}

export function prestige(
  state: GameState,
): { ok: true; state: GameState; event: GameEvent; relics: number } | { ok: false; reason: string } {
  if (!canPrestige(state)) {
    return { ok: false, reason: 'Keep forging a little longer' };
  }
  const relics = relicsFromReforge(state.lifetimeOre, state.prestigeCount);
  const next = createInitialState(Date.now());
  next.resources.relics = state.resources.relics + relics;
  next.totalRelicsEarned = state.totalRelicsEarned + relics;
  next.prestigeCount = state.prestigeCount + 1;
  next.unlockedCosmetics = [...new Set([...state.unlockedCosmetics, cosmeticForPrestige(state.prestigeCount + 1)])];
  next.activeCosmetic = cosmeticForPrestige(state.prestigeCount + 1);
  next.onboardingDone = true;
  next.milestones.firstPrestige = true;
  next.milestones.firstExpeditionClaimed = state.milestones.firstExpeditionClaimed;
  next.milestones.firstStation = false;
  next.ads = state.ads;
  next.playTimeSec = state.playTimeSec;

  return {
    ok: true,
    state: next,
    event: { type: 'prestige' },
    relics,
  };
}

function cosmeticForPrestige(count: number): string {
  if (count >= 3) return 'abyss_crown';
  if (count >= 2) return 'cyan_hearth';
  return 'ember_crest';
}

export function applyTimeWarp(
  state: GameState,
  seconds: number,
  now = Date.now(),
): { state: GameState; event: GameEvent } {
  const { state: next } = simulateSeconds(state, seconds, now);
  return { state: next, event: { type: 'time_warp', seconds } };
}

export function availableExpeditions(state: GameState) {
  return EXPEDITIONS.filter((e) => state.totalOreProduced >= e.unlockAtOreProduced);
}

export function availableRecipes(state: GameState) {
  return RECIPES.filter((r) => {
    if (state.ownedRecipes.includes(r.id)) return false;
    if (!r.requires) return true;
    return r.requires.every((req) => state.ownedRecipes.includes(req));
  });
}

export function stationUpgradeCostMap(
  stationId: StationId,
  level: number,
): Partial<Record<ResourceId, number>> {
  const station = getStation(stationId);
  const cost: Partial<Record<ResourceId, number>> = {};
  for (const [key, base] of Object.entries(station.baseCost) as [ResourceId, number][]) {
    cost[key] = stationUpgradeCost(base, station.costGrowth, level);
  }
  return cost;
}

export { canAfford, SIM_DT };
