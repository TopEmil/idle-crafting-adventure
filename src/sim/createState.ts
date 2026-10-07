import { emptyUnlockedAchievements } from '../data/achievements';
import { emptyWallet } from '../data/resources';
import { emptyTalents } from '../data/talents';
import type { GameState } from './types';

export function createInitialState(now = Date.now()): GameState {
  return {
    version: 1,
    resources: emptyWallet(),
    stations: {
      smelter: { unlocked: false, level: 0, runLevel: 0, enabled: true },
      anvil: { unlocked: false, level: 0, runLevel: 0, enabled: true },
      enchanter: { unlocked: false, level: 0, runLevel: 0, enabled: true },
    },
    ownedRecipes: [],
    talents: emptyTalents(),
    unlockedAchievements: emptyUnlockedAchievements(),
    lifetimeClicks: 0,
    activeExpedition: null,
    pendingLoot: null,
    totalOreProduced: 0,
    lifetimeOre: 0,
    mineDepth: 0,
    mineFaceDamage: [0, 0, 0, 0, 0, 0, 0, 0],
    mineDigAcc: 0,
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
    },
  };
}
