import {
  BALANCE,
  relicsFromReforge,
  stationUpgradeCost,
  SIM_DT,
} from '../data/balance';
import {
  EXPEDITIONS,
  expeditionUnlocked,
  getExpedition,
  type ExpeditionId,
} from '../data/expeditions';
import { getRecipe, RECIPES, type RecipeId } from '../data/recipes';
import type { ResourceId } from '../data/resources';
import { getStation, STATIONS, type StationId } from '../data/stations';
import {
  getTalent,
  talentUpgradeCost,
  type TalentId,
} from '../data/talents';
import { stratumAtDepth, STRATA, type StratumId } from '../data/strata';
import {
  digShaft,
  emptyFaceDamage,
  normalizeProgress,
  type DigMode,
} from './mineShaft';
import { aggregateEffects } from './effects';
import { createInitialState } from './createState';
import { recordOreMined } from './oreScore';
import type { GameEvent, GameState, StationProgress } from './types';

/** Clamped production multiplier from the player's chosen run speed. */
export function stationRunMult(st: Pick<StationProgress, 'level' | 'runLevel'>): number {
  if (st.level <= 0) return 0;
  return Math.max(1, Math.min(Math.floor(st.runLevel), st.level));
}

function effectsFor(state: GameState) {
  return aggregateEffects(
    state.ownedRecipes,
    state.talents,
    state.claimedAchievements ?? {},
  );
}

function shaftProgress(state: GameState) {
  return normalizeProgress({
    depth: state.mineDepth ?? 0,
    faceDamage: state.mineFaceDamage ?? emptyFaceDamage(),
  });
}

function applyShaftProgress(
  state: GameState,
  depth: number,
  faceDamage: number[],
): void {
  const next = normalizeProgress({ depth, faceDamage });
  state.mineDepth = next.depth;
  state.mineFaceDamage = next.faceDamage;
  applyStratumDiscoveries(state);
}

/** First time a stratum is reached this run — grant discovery bonus. */
export function applyStratumDiscoveries(state: GameState): StratumId[] {
  const discovered = new Set(state.discoveredStrata ?? ['glow_shallows']);
  const newly: StratumId[] = [];
  const depth = state.mineDepth ?? 0;
  for (const stratum of STRATA) {
    if (depth < stratum.startDepth) continue;
    if (discovered.has(stratum.id)) continue;
    discovered.add(stratum.id);
    newly.push(stratum.id);
    if (stratum.discoveryBonus) {
      grant(state.resources, stratum.discoveryBonus);
    }
  }
  state.discoveredStrata = [...discovered];
  return newly;
}

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

/** Dig damage per strike from recipes / talents / achievements. */
export function getDigDamage(state: GameState): number {
  const effects = effectsFor(state);
  return Math.max(1, effects.clickPower);
}

/** @deprecated Prefer getDigDamage — same value (dig damage, not ore/tap). */
export function getClickPower(state: GameState): number {
  return getDigDamage(state);
}

/** Base dwarf dig strikes per second when autoMine is unlocked. */
export const AUTO_DIG_STRIKES_PER_SEC = 0.8;

/**
 * Dwarf dig strike rate (strikes/sec). Scales with autoMine so pick/dwarf
 * upgrades still speed shaft progress; ore only arrives on shatter.
 */
export function getAutoMineRate(state: GameState): number {
  const effects = effectsFor(state);
  if (effects.autoMine <= 0) return 0;
  return AUTO_DIG_STRIKES_PER_SEC * (1 + effects.autoMine);
}

export function clickVein(
  state: GameState,
  opts?: { col?: number; mode?: DigMode },
): { state: GameState; event: GameEvent } {
  const next = structuredClone(state);
  const mode: DigMode = opts?.mode ?? 'player';
  const damage = getDigDamage(next);
  const dig = digShaft(shaftProgress(next), damage, { col: opts?.col, mode });
  applyShaftProgress(next, dig.progress.depth, dig.progress.faceDamage);
  next.lastMineHitCol = dig.hitCol;
  const amount = dig.oreYield;
  if (amount > 0) {
    next.resources.ore += amount;
    recordOreMined(next, amount);
  }
  next.lifetimeClicks = (next.lifetimeClicks ?? 0) + 1;
  if (dig.loot) {
    next.resources[dig.loot.resource] =
      (next.resources[dig.loot.resource] ?? 0) + dig.loot.amount;
    return {
      state: next,
      event: {
        type: 'click_vein',
        amount,
        find: {
          resource: dig.loot.resource,
          amount: dig.loot.amount,
          label: dig.loot.label,
        },
      },
    };
  }
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
  if (station.unlockAtDepth != null && (state.mineDepth ?? 0) < station.unlockAtDepth) {
    return {
      ok: false,
      reason: `Dig to depth ${station.unlockAtDepth} (${stratumAtDepth(station.unlockAtDepth).name})`,
    };
  }
  if (!canAfford(state.resources, station.unlockCost)) {
    return { ok: false, reason: 'Not enough resources' };
  }
  const next = structuredClone(state);
  pay(next.resources, station.unlockCost);
  next.stations[stationId].unlocked = true;
  next.stations[stationId].level = 1;
  next.stations[stationId].runLevel = 1;
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
  const wasAtMaxSpeed = stationRunMult(current) >= current.level;
  next.stations[stationId].level += 1;
  if (wasAtMaxSpeed) {
    next.stations[stationId].runLevel = next.stations[stationId].level;
  } else {
    next.stations[stationId].runLevel = stationRunMult(current);
  }
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

/** Raise or lower how fast a station runs (1…owned level), without changing upgrades. */
export function adjustStationRunLevel(
  state: GameState,
  stationId: StationId,
  delta: number,
): { ok: true; state: GameState } | { ok: false; reason: string } {
  const current = state.stations[stationId];
  if (!current.unlocked || current.level <= 0) {
    return { ok: false, reason: 'Locked' };
  }
  const step = Math.trunc(delta);
  if (step === 0) return { ok: false, reason: 'No change' };
  const from = stationRunMult(current);
  const nextLevel = Math.max(1, Math.min(current.level, from + step));
  if (nextLevel === from) {
    return { ok: false, reason: step > 0 ? 'Already at max speed' : 'Already at min speed' };
  }
  const next = structuredClone(state);
  next.stations[stationId].runLevel = nextLevel;
  return { ok: true, state: next };
}

export function expeditionSlotCount(state: GameState): number {
  const extras = Math.max(0, Math.floor(state.extraSquadSlots ?? 0));
  return BALANCE.baseExpeditionSlots + Math.min(BALANCE.maxExtraSquadSlots, extras);
}

/** Parties still out (not yet claimed into pending loot). */
export function activeSquadCount(state: GameState): number {
  return (state.activeExpeditions ?? []).filter((e) => !e.claimed).length;
}

export function canBuySquadSlot(state: GameState): { ok: true } | { ok: false; reason: string } {
  const extras = Math.max(0, Math.floor(state.extraSquadSlots ?? 0));
  if (extras >= BALANCE.maxExtraSquadSlots) {
    return { ok: false, reason: 'Squad roster is full' };
  }
  if ((state.resources.relics ?? 0) < BALANCE.extraSquadRelicCost) {
    return { ok: false, reason: `Need ${BALANCE.extraSquadRelicCost} Relics` };
  }
  return { ok: true };
}

export function buySquadSlot(
  state: GameState,
): { ok: true; state: GameState; event: GameEvent } | { ok: false; reason: string } {
  const gate = canBuySquadSlot(state);
  if (!gate.ok) return gate;
  const next = structuredClone(state);
  next.resources.relics -= BALANCE.extraSquadRelicCost;
  next.extraSquadSlots = Math.max(0, Math.floor(next.extraSquadSlots ?? 0)) + 1;
  return { ok: true, state: next, event: { type: 'buy_squad_slot' } };
}

export function startExpedition(
  state: GameState,
  expeditionId: ExpeditionId,
  now = Date.now(),
): { ok: true; state: GameState; event: GameEvent } | { ok: false; reason: string } {
  const active = state.activeExpeditions ?? [];
  if (active.some((e) => e.id === expeditionId && !e.claimed)) {
    return { ok: false, reason: 'That destination is already out' };
  }
  if (activeSquadCount(state) >= expeditionSlotCount(state)) {
    return { ok: false, reason: 'All squads are busy' };
  }
  if (state.pendingLoot) {
    return { ok: false, reason: 'Claim pending loot before sending again' };
  }
  const def = getExpedition(expeditionId);
  if (!expeditionUnlocked(def, state.totalOreProduced, state.mineDepth ?? 0)) {
    if (state.totalOreProduced < def.unlockAtOreProduced) {
      return {
        ok: false,
        reason: `Need ${def.unlockAtOreProduced} lifetime ore (have ${Math.floor(state.totalOreProduced)})`,
      };
    }
    return {
      ok: false,
      reason: `Dig to depth ${def.unlockAtDepth} first`,
    };
  }
  if (!canAfford(state.resources, def.cost)) {
    return { ok: false, reason: 'Not enough resources for this expedition' };
  }
  const next = structuredClone(state);
  pay(next.resources, def.cost);
  const durationSec = def.durationSec * effectsFor(next).expeditionDuration;
  next.activeExpeditions = [
    ...(next.activeExpeditions ?? []),
    {
      id: expeditionId,
      startedAt: now,
      endsAt: now + durationSec * 1000,
      claimed: false,
      doublePending: false,
    },
  ];
  return { ok: true, state: next, event: { type: 'start_expedition', expeditionId } };
}

/** Instantly finish a running expedition timer (rewarded-ad rush). */
export function rushExpedition(
  state: GameState,
  expeditionId: ExpeditionId,
  now = Date.now(),
): { ok: true; state: GameState; event: GameEvent } | { ok: false; reason: string } {
  const active = state.activeExpeditions ?? [];
  const idx = active.findIndex((e) => e.id === expeditionId && !e.claimed);
  if (idx < 0) {
    return { ok: false, reason: 'No squad en route there' };
  }
  if (now >= active[idx].endsAt) {
    return { ok: false, reason: 'Squad already returning' };
  }
  const next = structuredClone(state);
  next.activeExpeditions = (next.activeExpeditions ?? []).map((e, i) =>
    i === idx ? { ...e, endsAt: now } : e,
  );
  return { ok: true, state: next, event: { type: 'rush_expedition', expeditionId } };
}

export function rollExpeditionLoot(
  state: GameState,
  expeditionId: ExpeditionId,
  rng: () => number = Math.random,
): Partial<Record<ResourceId, number>> {
  const def = getExpedition(expeditionId);
  const effects = effectsFor(state);
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
  if (state.pendingLoot) {
    return { state, event: null };
  }
  const active = state.activeExpeditions ?? [];
  const readyIdx = active.findIndex((e) => !e.claimed && now >= e.endsAt);
  if (readyIdx < 0) {
    return { state, event: null };
  }
  const ready = active[readyIdx];
  const next = structuredClone(state);
  next.pendingLoot = rollExpeditionLoot(next, ready.id, rng);
  next.pendingLootExpeditionId = ready.id;
  next.activeExpeditions = (next.activeExpeditions ?? []).map((e, i) =>
    i === readyIdx ? { ...e, claimed: true } : e,
  );
  return {
    state: next,
    event: { type: 'expedition_ready', expeditionId: ready.id },
  };
}

export function claimExpedition(
  state: GameState,
  doubled: boolean,
): { ok: true; state: GameState; event: GameEvent } | { ok: false; reason: string } {
  // Only pendingLoot is required — older saves / edge paths can drop active parties
  // while loot is still waiting, and that must not soft-lock the player.
  if (!state.pendingLoot) {
    return { ok: false, reason: 'Nothing to claim' };
  }
  const loot = state.pendingLoot;
  const lootId = state.pendingLootExpeditionId;
  const next = structuredClone(state);
  const mult = doubled ? 2 : 1;
  grant(next.resources, loot, mult);
  if (loot.ore) {
    recordOreMined(next, loot.ore * mult);
  }
  next.pendingLoot = null;
  next.pendingLootExpeditionId = null;
  // Drop the claimed party that produced this loot (or any claimed stubs).
  next.activeExpeditions = (next.activeExpeditions ?? []).filter((e) => {
    if (lootId && e.id === lootId && e.claimed) return false;
    if (!lootId && e.claimed) return false;
    return true;
  });
  if (!next.milestones.firstExpeditionClaimed) {
    next.milestones.firstExpeditionClaimed = true;
  }
  return { ok: true, state: next, event: { type: 'claim_expedition', doubled } };
}

/** Per-station outputs produced during a single production tick. */
export type StationTickGain = {
  stationId: StationId;
  outputs: Partial<Record<ResourceId, number>>;
};

export function tickProduction(state: GameState, dt: number): GameState {
  return tickProductionDetailed(state, dt).state;
}

/** Same as tickProduction, but also reports station output deltas for VFX. */
export function tickProductionDetailed(
  state: GameState,
  dt: number,
): { state: GameState; stationGains: StationTickGain[]; autoOreGained: number } {
  if (dt <= 0) return { state, stationGains: [], autoOreGained: 0 };
  const next = structuredClone(state);
  const effects = effectsFor(next);
  const pMult = effects.stationOutput;
  const stationGains: StationTickGain[] = [];
  let autoOreGained = 0;

  const autoRate = getAutoMineRate(next);
  if (autoRate > 0) {
    next.mineDigAcc = (next.mineDigAcc ?? 0) + dt * autoRate;
    const digHits = Math.floor(next.mineDigAcc);
    if (digHits > 0) {
      next.mineDigAcc -= digHits;
      const damage = getDigDamage(next);
      const dig = digShaft(shaftProgress(next), damage, {
        mode: 'auto',
        strikes: digHits,
      });
      applyShaftProgress(next, dig.progress.depth, dig.progress.faceDamage);
      next.lastMineHitCol = dig.hitCol;
      if (dig.oreYield > 0) {
        next.resources.ore += dig.oreYield;
        recordOreMined(next, dig.oreYield);
        autoOreGained += dig.oreYield;
      }
    }
  }

  for (const def of STATIONS) {
    const st = next.stations[def.id];
    if (!st.unlocked || st.level <= 0 || !st.enabled) continue;

    const levelMult = stationRunMult(st);
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

    const outputs: Partial<Record<ResourceId, number>> = {};
    for (const [key, rate] of Object.entries(def.outputs) as [ResourceId, number][]) {
      const gained = rate * levelMult * pMult * dt;
      next.resources[key] += gained;
      outputs[key] = (outputs[key] ?? 0) + gained;
      if (key === 'ore') {
        recordOreMined(next, gained);
      }
    }
    if (Object.keys(outputs).length > 0) {
      stationGains.push({ stationId: def.id, outputs });
    }
  }

  next.playTimeSec += dt;
  return { state: next, stationGains, autoOreGained };
}

/**
 * Fold fractional station gains into whole-unit floaters (e.g. +1 Glass).
 * Leftover fractions stay in `pending` until the next call.
 */
export function drainStationGainFloaters(
  pending: Partial<Record<StationId, Partial<Record<ResourceId, number>>>>,
  gains: StationTickGain[],
): {
  pending: Partial<Record<StationId, Partial<Record<ResourceId, number>>>>;
  floaters: { stationId: StationId; resource: ResourceId; amount: number }[];
} {
  const nextPending: Partial<Record<StationId, Partial<Record<ResourceId, number>>>> = {
    ...pending,
  };
  const floaters: { stationId: StationId; resource: ResourceId; amount: number }[] = [];

  for (const gain of gains) {
    const bag = { ...(nextPending[gain.stationId] ?? {}) };
    for (const [key, amount] of Object.entries(gain.outputs) as [ResourceId, number][]) {
      if (!(amount > 0)) continue;
      const total = (bag[key] ?? 0) + amount;
      const whole = Math.floor(total);
      bag[key] = total - whole;
      if (whole >= 1) {
        floaters.push({ stationId: gain.stationId, resource: key, amount: whole });
      }
    }
    nextPending[gain.stationId] = bag;
  }

  return { pending: nextPending, floaters };
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
  const effects = effectsFor(state);
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

/** Seconds remaining before Reforge is allowed again. */
export function prestigeCooldownRemaining(state: GameState, now = Date.now()): number {
  if (state.lastPrestigeAt <= 0) return 0;
  const elapsed = (now - state.lastPrestigeAt) / 1000;
  return Math.max(0, BALANCE.prestigeCooldownSec - elapsed);
}

export function canPrestige(state: GameState, now = Date.now()): boolean {
  const unlocked =
    state.lifetimeOre >= BALANCE.prestigeMinLifetimeOre || state.stations.smelter.unlocked;
  if (!unlocked) return false;
  return prestigeCooldownRemaining(state, now) <= 0;
}

export function prestige(
  state: GameState,
  now = Date.now(),
): { ok: true; state: GameState; event: GameEvent; relics: number } | { ok: false; reason: string } {
  const unlocked =
    state.lifetimeOre >= BALANCE.prestigeMinLifetimeOre || state.stations.smelter.unlocked;
  if (!unlocked) {
    return { ok: false, reason: 'Keep forging a little longer' };
  }
  const coolLeft = prestigeCooldownRemaining(state, now);
  if (coolLeft > 0) {
    const mins = Math.ceil(coolLeft / 60);
    return {
      ok: false,
      reason: `Reforge cools for ${mins} more minute${mins === 1 ? '' : 's'}`,
    };
  }
  const relicMult = effectsFor(state).relicGain;
  const relics = Math.max(
    1,
    Math.floor(relicsFromReforge(state.lifetimeOre, state.prestigeCount) * relicMult),
  );
  const next = createInitialState(now);
  next.resources.relics = state.resources.relics + relics;
  next.totalRelicsEarned = state.totalRelicsEarned + relics;
  next.prestigeCount = state.prestigeCount + 1;
  next.lastPrestigeAt = now;
  next.talents = structuredClone(state.talents);
  next.extraSquadSlots = Math.max(0, Math.floor(state.extraSquadSlots ?? 0));
  next.claimedAchievements = { ...(state.claimedAchievements ?? {}) };
  next.lifetimeClicks = state.lifetimeClicks ?? 0;
  next.allTimeOre = state.allTimeOre ?? 0;
  next.seasonOre = state.seasonOre ?? 0;
  next.seasonStartedAt = state.seasonStartedAt ?? 0;
  next.lastLeaderboardScore = state.lastLeaderboardScore ?? 0;
  next.lastLeaderboardSubmitAt = state.lastLeaderboardSubmitAt ?? 0;
  next.unlockedCosmetics = [...new Set([...state.unlockedCosmetics, cosmeticForPrestige(state.prestigeCount + 1)])];
  next.activeCosmetic = cosmeticForPrestige(state.prestigeCount + 1);
  next.onboardingDone = true;
  next.milestones.firstPrestige = true;
  next.milestones.firstExpeditionClaimed = state.milestones.firstExpeditionClaimed;
  next.milestones.firstStation = false;
  next.ads = state.ads;
  next.playTimeSec = state.playTimeSec;

  // First Reforge becomes claimable after prestige — rewards stay until the player claims.

  return {
    ok: true,
    state: next,
    event: { type: 'prestige' },
    relics,
  };
}

export function buyTalent(
  state: GameState,
  talentId: TalentId,
): { ok: true; state: GameState; event: GameEvent } | { ok: false; reason: string } {
  const def = getTalent(talentId);
  const level = state.talents[talentId] ?? 0;
  if (level >= def.maxLevel) {
    return { ok: false, reason: 'Talent maxed' };
  }
  const cost = talentUpgradeCost(def, level);
  if ((state.resources.relics ?? 0) < cost) {
    return { ok: false, reason: 'Not enough Relics' };
  }
  const next = structuredClone(state);
  next.resources.relics -= cost;
  next.talents[talentId] = level + 1;
  return { ok: true, state: next, event: { type: 'buy_talent', talentId } };
}

function cosmeticForPrestige(count: number): string {
  if (count >= 3) return 'abyss_crown';
  if (count >= 2) return 'cyan_hearth';
  return 'ember_crest';
}

export function availableExpeditions(state: GameState) {
  return EXPEDITIONS.filter((e) =>
    expeditionUnlocked(e, state.totalOreProduced, state.mineDepth ?? 0),
  );
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
