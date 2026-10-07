/** Global economy & progression knobs — tuned for design bible targets. */

export const SIM_HZ = 10;
export const SIM_DT = 1 / SIM_HZ;

export const BALANCE = {
  baseClickOre: 1,
  clickGrowthPerLevel: 0,
  offlineCapHours: 8,
  offlineCapSeconds: 8 * 3600,
  /** Soft production mult per prestige relic spent historically */
  prestigeMultPerRelic: 0.08,
  /** Base relics from reforge before scaling */
  prestigeBaseRelics: 1,
  prestigeRelicScale: 0.015,
  /** Playtime before midgame ads are allowed (seconds) */
  midgameMinPlaySec: 180,
  /** First purchase should be reachable under 30s of tapping */
  earlyOrePerTap: 1,
  stationLevelCap: 50,
  timeWarpSeconds: 300,
  timeWarpCoinCost: 120,
} as const;

export function stationUpgradeCost(
  base: number,
  growth: number,
  level: number,
): number {
  return Math.ceil(base * Math.pow(growth, level));
}

export function prestigeMult(totalRelicsEarned: number): number {
  return 1 + totalRelicsEarned * BALANCE.prestigeMultPerRelic;
}

export function relicsFromReforge(lifetimeOre: number, prestigeCount: number): number {
  const scaled = Math.floor(
    BALANCE.prestigeBaseRelics +
      lifetimeOre * BALANCE.prestigeRelicScale +
      prestigeCount * 0.5,
  );
  return Math.max(1, scaled);
}
