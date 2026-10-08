/** Global economy & progression knobs — tuned for design bible targets. */

import type { ResourceId } from './resources';

export const SIM_HZ = 10;
export const SIM_DT = 1 / SIM_HZ;

/** Hardness of Glow Shallows — costHardness tiers are multiples of this. */
export const BASE_HARDNESS = 2;

export const BALANCE = {
  /**
   * Ore granted when a shaft cell shatters.
   * Final yield ≈ baseVeinOre × stratum.hardness × depthOreMult (high late numbers).
   */
  baseVeinOre: 1,
  /** @deprecated Use baseVeinOre — kept as alias for older references. */
  baseClickOre: 1,
  clickGrowthPerLevel: 0,
  offlineCapHours: 8,
  offlineCapSeconds: 8 * 3600,
  /** Minimum real time between Reforges (seconds) */
  prestigeCooldownSec: 600,
  /** Lifetime ore needed to unlock Reforge (or unlock Smelter) */
  prestigeMinLifetimeOre: 2_000,
  /** Base relics from reforge before scaling */
  prestigeBaseRelics: 1,
  /**
   * Relics ≈ base + sqrt(lifetimeOre) × scale — sqrt so hardness-doubling ore
   * income does not explode prestige payouts.
   */
  prestigeRelicScale: 0.4,
  /** Playtime before midgame ads are allowed (seconds) */
  midgameMinPlaySec: 180,
  /** First purchase should be reachable under 30s of tapping */
  earlyOrePerTap: 1,
  stationLevelCap: 50,
  /** Ore cost for optional 2× expedition loot when ads are unavailable. */
  rewardBoostOreCost: 1_000,
  /** Wall-clock gap between progressive resource ad suggestions (ms). */
  resourceOfferIntervalMs: 300_000,
  /** Min playtime before the first resource ad suggestion (seconds). */
  resourceOfferMinPlaySec: 180,
  /** Starting concurrent scout parties (squads). */
  baseExpeditionSlots: 1,
  /** Relic cost to unlock one extra concurrent squad. */
  extraSquadRelicCost: 100,
  /** Cap on bought extra slots (total slots = base + extras). */
  maxExtraSquadSlots: 3,
} as const;

/** costHardness / BASE_HARDNESS — 1 early, 512 at Aether Core. */
export function economyMult(costHardness: number): number {
  return Math.max(1, costHardness / BASE_HARDNESS);
}

/**
 * Scale authored costs up with hardness-doubling ore income.
 * Relics stay unscaled (prestige sink).
 */
export function scaleEconomyCost(
  cost: Partial<Record<ResourceId, number>>,
  costHardness: number,
): Partial<Record<ResourceId, number>> {
  const mult = economyMult(costHardness);
  if (mult === 1) return { ...cost };
  const out: Partial<Record<ResourceId, number>> = {};
  for (const [key, amount] of Object.entries(cost) as [ResourceId, number][]) {
    if (key === 'relics') {
      out[key] = amount;
    } else {
      out[key] = Math.max(1, Math.round(amount * mult));
    }
  }
  return out;
}

/** Scale an ore gate / lifetime threshold with the same hardness curve. */
export function scaleOreGate(amount: number, costHardness: number): number {
  return Math.max(1, Math.round(amount * economyMult(costHardness)));
}

export function stationUpgradeCost(
  base: number,
  growth: number,
  level: number,
): number {
  return Math.ceil(base * Math.pow(growth, level));
}

export function relicsFromReforge(lifetimeOre: number, prestigeCount: number): number {
  const scaled = Math.floor(
    BALANCE.prestigeBaseRelics +
      Math.sqrt(Math.max(0, lifetimeOre)) * BALANCE.prestigeRelicScale +
      prestigeCount * 0.5,
  );
  return Math.max(1, scaled);
}
