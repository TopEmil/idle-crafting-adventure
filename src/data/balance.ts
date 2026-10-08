/** Global economy & progression knobs — tuned for design bible targets. */

export const SIM_HZ = 10;
export const SIM_DT = 1 / SIM_HZ;

export const BALANCE = {
  /** Ore granted when a shaft cell shatters (scaled by hardness × depth). */
  baseVeinOre: 1,
  /** @deprecated Use baseVeinOre — kept as alias for older references. */
  baseClickOre: 1,
  clickGrowthPerLevel: 0,
  offlineCapHours: 8,
  offlineCapSeconds: 8 * 3600,
  /** Minimum real time between Reforges (seconds) */
  prestigeCooldownSec: 600,
  /** Lifetime ore needed to unlock Reforge (or unlock Smelter) */
  prestigeMinLifetimeOre: 500,
  /** Base relics from reforge before scaling */
  prestigeBaseRelics: 1,
  prestigeRelicScale: 0.015,
  /** Playtime before midgame ads are allowed (seconds) */
  midgameMinPlaySec: 180,
  /** First purchase should be reachable under 30s of tapping */
  earlyOrePerTap: 1,
  stationLevelCap: 50,
  /** Ore cost for optional 2× expedition loot when ads are unavailable. */
  rewardBoostOreCost: 120,
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
      lifetimeOre * BALANCE.prestigeRelicScale +
      prestigeCount * 0.5,
  );
  return Math.max(1, scaled);
}
