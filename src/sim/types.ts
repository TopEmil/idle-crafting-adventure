import type { ExpeditionId } from '../data/expeditions';
import type { RecipeId } from '../data/recipes';
import type { ResourceId } from '../data/resources';
import type { StationId } from '../data/stations';
import type { TalentId } from '../data/talents';

export interface ActiveExpedition {
  id: ExpeditionId;
  startedAt: number;
  endsAt: number;
  claimed: boolean;
  doublePending: boolean;
}

export interface GameState {
  version: 1;
  resources: Record<ResourceId, number>;
  stations: Record<StationId, { unlocked: boolean; level: number; enabled: boolean }>;
  ownedRecipes: RecipeId[];
  /** Permanent talent levels — persist across Reforge. */
  talents: Record<TalentId, number>;
  activeExpedition: ActiveExpedition | null;
  pendingLoot: Partial<Record<ResourceId, number>> | null;
  totalOreProduced: number;
  lifetimeOre: number;
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
  };
}

export type GameEvent =
  | { type: 'click_vein'; amount: number }
  | { type: 'craft'; recipeId: RecipeId }
  | { type: 'unlock_station'; stationId: StationId }
  | { type: 'upgrade_station'; stationId: StationId }
  | { type: 'start_expedition'; expeditionId: ExpeditionId }
  | { type: 'expedition_ready'; expeditionId: ExpeditionId }
  | { type: 'claim_expedition'; doubled: boolean }
  | { type: 'prestige' }
  | { type: 'buy_talent'; talentId: TalentId }
  | { type: 'offline_summary'; seconds: number; gains: Partial<Record<ResourceId, number>> }
  | { type: 'milestone'; id: string }
  | { type: 'time_warp'; seconds: number };
