import type { AchievementId } from '../data/achievements';
import type { ExpeditionId } from '../data/expeditions';
import type { RecipeId } from '../data/recipes';
import type { ResourceId } from '../data/resources';
import type { StationId } from '../data/stations';
import type { StratumId } from '../data/strata';
import type { TalentId } from '../data/talents';

export interface ActiveExpedition {
  id: ExpeditionId;
  startedAt: number;
  endsAt: number;
  claimed: boolean;
  doublePending: boolean;
}

/** Per-station progress. `runLevel` throttles rate independently of owned `level`. */
export interface StationProgress {
  unlocked: boolean;
  level: number;
  /** Effective speed tier (1…level). Can stay lower after upgrades. */
  runLevel: number;
  enabled: boolean;
}

export interface GameState {
  version: 1;
  resources: Record<ResourceId, number>;
  stations: Record<StationId, StationProgress>;
  ownedRecipes: RecipeId[];
  /** Permanent talent levels — persist across Reforge. */
  talents: Record<TalentId, number>;
  /**
   * Highest claimed achievement tier per id — persist across Reforge.
   * Rewards are granted only when the player claims a ready tier.
   */
  claimedAchievements: Partial<Record<AchievementId, number>>;
  /** Lifetime vein taps — persist across Reforge (achievement progress). */
  lifetimeClicks: number;
  /** Concurrent scout parties currently out (or waiting to claim). */
  activeExpeditions: ActiveExpedition[];
  /**
   * Bought extra concurrent squad slots (on top of BALANCE.baseExpeditionSlots).
   * Persists across Reforge.
   */
  extraSquadSlots: number;
  pendingLoot: Partial<Record<ResourceId, number>> | null;
  /** Which expedition the pending loot belongs to (optional for legacy saves). */
  pendingLootExpeditionId: ExpeditionId | null;
  totalOreProduced: number;
  /** Ore mined this run (resets on Reforge). */
  lifetimeOre: number;
  /** Ore mined across all runs — persists across Reforge. */
  allTimeOre: number;
  /** Ore mined in the current CrazyGames weekly season (Mon 09:00 UTC). */
  seasonOre: number;
  /** UTC ms of the current season start; used to roll seasonOre. */
  seasonStartedAt: number;
  /** Last successful leaderboard submit score (season ore). */
  lastLeaderboardScore: number;
  /** Timestamp of last leaderboard submit attempt (ms). */
  lastLeaderboardSubmitAt: number;
  /** Fully cleared mine-shaft rows this run (resets on Reforge). */
  mineDepth: number;
  /** Per-column damage on the current dig face. */
  mineFaceDamage: number[];
  /** Fractional auto-mine dig accumulator (hits/sec). */
  mineDigAcc: number;
  /** Last column the miner (player or dwarf) struck — drives dwarf follow VFX. */
  lastMineHitCol: number;
  /** Strata discovered this run (resets on Reforge); gates discovery bonuses. */
  discoveredStrata: StratumId[];
  playTimeSec: number;
  prestigeCount: number;
  totalRelicsEarned: number;
  /** Timestamp of last successful Reforge (ms). 0 = never. */
  lastPrestigeAt: number;
  unlockedCosmetics: string[];
  activeCosmetic: string;
  onboardingStep: number;
  onboardingDone: boolean;
  milestones: {
    firstExpeditionClaimed: boolean;
    firstPrestige: boolean;
    firstStation: boolean;
  };
  lastSaveAt: number;
  lastTickAt: number;
  ads: {
    midgameReadyAfter: number;
    rewardedCooldownUntil: number;
    /** Next time a progressive resource ad suggestion may appear (ms). */
    resourceOfferReadyAfter: number;
    /** Successful resource-offer claims — scales reward amounts. */
    resourceOffersClaimed: number;
  };
}

export type GameEvent =
  | {
      type: 'click_vein';
      amount: number;
      find?: { resource: ResourceId; amount: number; label: string };
    }
  | { type: 'craft'; recipeId: RecipeId }
  | { type: 'unlock_station'; stationId: StationId }
  | { type: 'upgrade_station'; stationId: StationId }
  | { type: 'start_expedition'; expeditionId: ExpeditionId }
  | { type: 'expedition_ready'; expeditionId: ExpeditionId }
  | { type: 'rush_expedition'; expeditionId: ExpeditionId }
  | { type: 'claim_expedition'; doubled: boolean }
  | { type: 'buy_squad_slot' }
  | { type: 'prestige' }
  | { type: 'buy_talent'; talentId: TalentId }
  | { type: 'offline_summary'; seconds: number; gains: Partial<Record<ResourceId, number>> }
  | { type: 'milestone'; id: string }
  | { type: 'resource_offer'; resource: ResourceId; amount: number }
  | { type: 'achievement'; id: AchievementId; level: number };
