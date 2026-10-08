import { BALANCE } from '../data/balance';
import { RESOURCES, type ResourceId } from '../data/resources';
import { STATIONS } from '../data/stations';
import { availableRecipes, stationUpgradeCostMap } from './economy';
import type { GameState } from './types';

/** Resources that can appear in progressive ad offers (not prestige Relics). */
const OFFERABLE: ReadonlySet<ResourceId> = new Set([
  'ore',
  'emberglass',
  'glowdust',
  'alloy',
  'verdiglass',
  'nightiron',
  'starshard',
  'aetherite',
]);

export interface ResourceOffer {
  resource: ResourceId;
  amount: number;
  /** Why the player needs this (recipe / station / upgrade). */
  reason: string;
  shortfall: number;
}

interface NeedCandidate {
  resource: ResourceId;
  needed: number;
  owned: number;
  shortfall: number;
  ratio: number;
  reason: string;
  /** Lower = more aligned with the live goal strip (recipes first). */
  priority: number;
}

function pushNeeds(
  out: NeedCandidate[],
  cost: Partial<Record<ResourceId, number>>,
  owned: Record<ResourceId, number>,
  reason: string,
  priority: number,
) {
  for (const [key, raw] of Object.entries(cost) as [ResourceId, number][]) {
    if (!OFFERABLE.has(key)) continue;
    const needed = Math.max(0, Math.ceil(raw));
    if (needed <= 0) continue;
    const have = owned[key] ?? 0;
    if (have >= needed) continue;
    out.push({
      resource: key,
      needed,
      owned: have,
      shortfall: needed - have,
      ratio: have / needed,
      reason,
      priority,
    });
  }
}

/** Collect bottleneck resources for the player's nearest goals. */
export function collectResourceNeeds(state: GameState): NeedCandidate[] {
  const needs: NeedCandidate[] = [];

  const nextRecipe = availableRecipes(state)[0];
  if (nextRecipe) {
    pushNeeds(needs, nextRecipe.cost, state.resources, `craft ${nextRecipe.name}`, 0);
  }

  for (const station of STATIONS) {
    const st = state.stations[station.id];
    if (!st.unlocked) {
      if (station.unlockRequires && !state.stations[station.unlockRequires].unlocked) continue;
      if (station.unlockAtDepth !== undefined && state.mineDepth < station.unlockAtDepth) continue;
      pushNeeds(needs, station.unlockCost, state.resources, `unlock ${station.name}`, 1);
      break;
    }
    if (st.level > 0 && st.level < BALANCE.stationLevelCap) {
      const cost = stationUpgradeCostMap(station.id, st.level);
      pushNeeds(needs, cost, state.resources, `upgrade ${station.name}`, 2);
    }
  }

  return needs;
}

/**
 * Progressive grant size: fills a useful slice of the shortfall and grows with
 * prior accepted offers + soft progression (recipes / stations / prestige).
 */
export function progressiveOfferAmount(
  shortfall: number,
  claimed: number,
  progressionTier: number,
): number {
  const claimBoost = Math.pow(1.18, Math.min(12, Math.max(0, claimed)));
  const tierBoost = 1 + Math.min(2.5, progressionTier * 0.12);
  const slice = Math.max(3, Math.ceil(shortfall * 0.28 * claimBoost * tierBoost));
  return Math.max(1, Math.min(shortfall, slice));
}

export function progressionTier(state: GameState): number {
  const stations = STATIONS.filter((s) => state.stations[s.id].unlocked).length;
  const recipes = state.ownedRecipes.length;
  return stations + recipes + state.prestigeCount * 3;
}

/**
 * Pick the scarcest needed resource and a progressive ad reward for it.
 * Returns null when the player is not short on anything offerable.
 */
export function nextResourceOffer(state: GameState): ResourceOffer | null {
  const needs = collectResourceNeeds(state);
  if (needs.length === 0) return null;

  needs.sort(
    (a, b) => a.priority - b.priority || a.ratio - b.ratio || b.shortfall - a.shortfall,
  );
  const top = needs[0];
  const amount = progressiveOfferAmount(
    top.shortfall,
    state.ads.resourceOffersClaimed ?? 0,
    progressionTier(state),
  );
  if (amount <= 0) return null;

  return {
    resource: top.resource,
    amount,
    reason: top.reason,
    shortfall: top.shortfall,
  };
}

export function resourceLabel(id: ResourceId): string {
  return RESOURCES.find((r) => r.id === id)?.name ?? id;
}

export function canSuggestResourceOffer(
  state: GameState,
  now = Date.now(),
): boolean {
  if (!state.onboardingDone) return false;
  if (state.playTimeSec < BALANCE.resourceOfferMinPlaySec) return false;
  if (now < (state.ads.resourceOfferReadyAfter ?? 0)) return false;
  if (state.pendingLoot) return false;
  return nextResourceOffer(state) !== null;
}

export function markResourceOfferShown(state: GameState, now = Date.now()): GameState {
  const next = structuredClone(state);
  next.ads.resourceOfferReadyAfter = now + BALANCE.resourceOfferIntervalMs;
  return next;
}

export function applyResourceOffer(
  state: GameState,
  offer: ResourceOffer,
): { state: GameState; event: { type: 'resource_offer'; resource: ResourceId; amount: number } } {
  const next = structuredClone(state);
  next.resources[offer.resource] += offer.amount;
  next.ads.resourceOffersClaimed = (next.ads.resourceOffersClaimed ?? 0) + 1;
  return {
    state: next,
    event: { type: 'resource_offer', resource: offer.resource, amount: offer.amount },
  };
}
