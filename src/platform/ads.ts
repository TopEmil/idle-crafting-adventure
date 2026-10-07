import { BALANCE } from '../data/balance';
import type { GameState } from '../sim/types';
import type { AdKind, AdRequestResult, PlatformBridge } from './crazygames';

export type MidgameTrigger = 'expedition_claim' | 'prestige' | 'milestone';

export interface AdGate {
  canShowMidgame(state: GameState, trigger: MidgameTrigger, now?: number): boolean;
  markMidgameShown(state: GameState, now?: number): GameState;
  canShowRewarded(state: GameState, now?: number): { ok: boolean; reason?: string };
  markRewardedUsed(state: GameState, now?: number): GameState;
  runAd(
    platform: PlatformBridge,
    kind: AdKind,
    hooks: { onStarted?: () => void; onEnded?: () => void },
  ): Promise<AdRequestResult>;
}

const MIDGAME_COOLDOWN_MS = 180_000;
const REWARDED_COOLDOWN_MS = 120_000;

export function createAdGate(): AdGate {
  return {
    canShowMidgame(state, trigger, now = Date.now()) {
      if (now < state.ads.midgameReadyAfter) return false;
      if (state.playTimeSec < BALANCE.midgameMinPlaySec) {
        // Allow first real expedition claim as exception
        if (trigger === 'expedition_claim' && state.milestones.firstExpeditionClaimed) {
          return now >= state.ads.midgameReadyAfter;
        }
        if (trigger !== 'expedition_claim') return false;
      }
      return true;
    },

    markMidgameShown(state, now = Date.now()) {
      const next = structuredClone(state);
      next.ads.midgameReadyAfter = now + MIDGAME_COOLDOWN_MS;
      return next;
    },

    canShowRewarded(state, now = Date.now()) {
      if (now < state.ads.rewardedCooldownUntil) {
        return { ok: false, reason: 'cooldown' };
      }
      return { ok: true };
    },

    markRewardedUsed(state, now = Date.now()) {
      const next = structuredClone(state);
      next.ads.rewardedCooldownUntil = now + REWARDED_COOLDOWN_MS;
      return next;
    },

    async runAd(platform, kind, hooks) {
      if (!platform.adsEnabled) {
        return { status: 'disabled' };
      }
      if (platform.adblock && kind === 'rewarded') {
        return { status: 'blocked', reason: 'adblock' };
      }

      hooks.onStarted?.();
      const result = await platform.requestAd(kind);
      hooks.onEnded?.();
      return result;
    },
  };
}
