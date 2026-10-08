import { emptyUnlockedAchievements } from '../data/achievements';
import { emptyWallet } from '../data/resources';
import { emptyStations } from '../data/stations';
import { emptyTalents } from '../data/talents';
import { currentSeasonStartMs } from './oreScore';
import type { GameState } from './types';

export function createInitialState(now = Date.now()): GameState {
  return {
    version: 1,
    resources: emptyWallet(),
    stations: emptyStations(),
    ownedRecipes: [],
    talents: emptyTalents(),
    unlockedAchievements: emptyUnlockedAchievements(),
    lifetimeClicks: 0,
    activeExpeditions: [],
    extraSquadSlots: 0,
    pendingLoot: null,
    pendingLootExpeditionId: null,
    totalOreProduced: 0,
    lifetimeOre: 0,
    allTimeOre: 0,
    seasonOre: 0,
    seasonStartedAt: currentSeasonStartMs(now),
    lastLeaderboardScore: 0,
    lastLeaderboardSubmitAt: 0,
    mineDepth: 0,
    mineFaceDamage: [0, 0, 0, 0, 0, 0, 0, 0],
    mineDigAcc: 0,
    lastMineHitCol: 0,
    discoveredStrata: ['glow_shallows'],
    playTimeSec: 0,
    prestigeCount: 0,
    totalRelicsEarned: 0,
    lastPrestigeAt: 0,
    unlockedCosmetics: ['default'],
    activeCosmetic: 'default',
    onboardingStep: 0,
    onboardingDone: false,
    milestones: {
      firstExpeditionClaimed: false,
      firstPrestige: false,
      firstStation: false,
    },
    lastSaveAt: now,
    lastTickAt: now,
    ads: {
      midgameReadyAfter: now + 180_000,
      rewardedCooldownUntil: 0,
      resourceOfferReadyAfter: now + 180_000,
      resourceOffersClaimed: 0,
    },
  };
}
