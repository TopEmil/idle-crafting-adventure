import {
  ACHIEVEMENTS,
  emptyClaimedAchievements,
  type AchievementId,
} from '../data/achievements';
import { BALANCE } from '../data/balance';
import { RESOURCE_IDS, emptyWallet } from '../data/resources';
import { emptyStationProgress, STATIONS } from '../data/stations';
import { STRATA, type StratumId } from '../data/strata';
import { emptyTalents, TALENTS } from '../data/talents';
import { createInitialState } from './createState';
import { emptyFaceDamage, faceHitsToDamage, SHAFT_COLS } from './mineShaft';
import { currentSeasonStartMs, ensureSeasonWindow } from './oreScore';
import type { ActiveExpedition, GameState } from './types';

export const SAVE_KEY = 'embervein.save.v1';

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

/** Fill missing fields from older saves (toggle, runLevel, talents, achievements). */
export function migrateState(state: GameState): GameState {
  const next = structuredClone(state);
  if (!next.stations) next.stations = {} as GameState['stations'];
  for (const def of STATIONS) {
    let st = next.stations[def.id];
    if (!st) {
      st = emptyStationProgress();
      next.stations[def.id] = st;
    }
    if (typeof st.enabled !== 'boolean') st.enabled = true;
    const level = Math.max(0, Math.floor(st.level ?? 0));
    st.level = level;
    if (typeof st.unlocked !== 'boolean') st.unlocked = level > 0;
    if (typeof st.runLevel !== 'number' || !Number.isFinite(st.runLevel)) {
      st.runLevel = level;
    } else {
      const run = Math.floor(st.runLevel);
      st.runLevel = level <= 0 ? 0 : Math.max(1, Math.min(run, level));
    }
  }
  if (!next.talents) {
    next.talents = emptyTalents();
  } else {
    const filled = emptyTalents();
    for (const def of TALENTS) {
      filled[def.id] = Math.max(0, Math.floor(next.talents[def.id] ?? 0));
    }
    next.talents = filled;
  }
  if (typeof next.lastPrestigeAt !== 'number') {
    next.lastPrestigeAt = 0;
  }
  if (typeof next.mineDepth !== 'number' || next.mineDepth < 0) {
    next.mineDepth = 0;
  } else {
    next.mineDepth = Math.floor(next.mineDepth);
  }
  if (!Array.isArray(next.mineFaceDamage) || next.mineFaceDamage.length !== SHAFT_COLS) {
    const legacy = next as GameState & { mineFaceHits?: number };
    if (typeof legacy.mineFaceHits === 'number' && legacy.mineFaceHits > 0) {
      next.mineFaceDamage = faceHitsToDamage(next.mineDepth, legacy.mineFaceHits);
    } else {
      next.mineFaceDamage = emptyFaceDamage();
    }
  } else {
    next.mineFaceDamage = next.mineFaceDamage.map((n) => Math.max(0, Number(n) || 0));
  }
  delete (next as GameState & { mineFaceHits?: number }).mineFaceHits;
  if (typeof next.mineDigAcc !== 'number' || next.mineDigAcc < 0) {
    next.mineDigAcc = 0;
  }
  if (typeof next.lastMineHitCol !== 'number' || !Number.isFinite(next.lastMineHitCol)) {
    next.lastMineHitCol = 0;
  } else {
    next.lastMineHitCol = Math.max(0, Math.min(SHAFT_COLS - 1, Math.floor(next.lastMineHitCol)));
  }
  if (!Array.isArray(next.discoveredStrata)) {
    next.discoveredStrata = ['glow_shallows'];
    const depth = next.mineDepth ?? 0;
    for (const s of STRATA) {
      if (depth >= s.startDepth && !next.discoveredStrata.includes(s.id)) {
        next.discoveredStrata.push(s.id);
      }
    }
  } else {
    const known = new Set(STRATA.map((s) => s.id));
    const cleaned: StratumId[] = [];
    const seen = new Set<StratumId>();
    for (const id of next.discoveredStrata) {
      if (!known.has(id) || seen.has(id)) continue;
      seen.add(id);
      cleaned.push(id);
    }
    if (!cleaned.includes('glow_shallows')) cleaned.unshift('glow_shallows');
    next.discoveredStrata = cleaned;
  }
  if (typeof next.lifetimeClicks !== 'number' || !Number.isFinite(next.lifetimeClicks)) {
    next.lifetimeClicks = 0;
  } else {
    next.lifetimeClicks = Math.max(0, Math.floor(next.lifetimeClicks));
  }
  // Claimed tiers (new) — migrate legacy unlockedAchievements[] → claimed level 1.
  const legacyAchievements = next as GameState & {
    unlockedAchievements?: AchievementId[];
  };
  const knownIds = new Set(ACHIEVEMENTS.map((a) => a.id));
  const maxTier = new Map(ACHIEVEMENTS.map((a) => [a.id, a.tiers.length] as const));
  const claimed: Partial<Record<AchievementId, number>> = emptyClaimedAchievements();

  if (next.claimedAchievements && typeof next.claimedAchievements === 'object') {
    for (const [rawId, rawLevel] of Object.entries(next.claimedAchievements)) {
      const id = rawId as AchievementId;
      if (!knownIds.has(id)) continue;
      const level = Math.max(0, Math.floor(Number(rawLevel) || 0));
      if (level <= 0) continue;
      claimed[id] = Math.min(level, maxTier.get(id) ?? level);
    }
  }

  if (Array.isArray(legacyAchievements.unlockedAchievements)) {
    for (const id of legacyAchievements.unlockedAchievements) {
      if (!knownIds.has(id)) continue;
      claimed[id] = Math.max(claimed[id] ?? 0, 1);
    }
  }

  next.claimedAchievements = claimed;
  delete legacyAchievements.unlockedAchievements;

  // Fill newly added resource keys on older saves.
  const wallet = emptyWallet();
  for (const id of RESOURCE_IDS) {
    const value = next.resources?.[id];
    wallet[id] = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  next.resources = wallet;

  // Migrate legacy single activeExpedition → activeExpeditions[].
  const legacy = next as GameState & { activeExpedition?: ActiveExpedition | null };
  if (!Array.isArray(next.activeExpeditions)) {
    next.activeExpeditions = legacy.activeExpedition ? [legacy.activeExpedition] : [];
  }
  delete legacy.activeExpedition;

  if (typeof next.extraSquadSlots !== 'number' || !Number.isFinite(next.extraSquadSlots)) {
    next.extraSquadSlots = 0;
  } else {
    next.extraSquadSlots = Math.max(
      0,
      Math.min(BALANCE.maxExtraSquadSlots, Math.floor(next.extraSquadSlots)),
    );
  }

  if (next.pendingLootExpeditionId === undefined) {
    next.pendingLootExpeditionId = null;
  }

  if (typeof next.allTimeOre !== 'number' || !Number.isFinite(next.allTimeOre)) {
    // Older saves only tracked run ore — seed all-time from the best known total.
    next.allTimeOre = Math.max(0, next.lifetimeOre ?? 0, next.totalOreProduced ?? 0);
  } else {
    next.allTimeOre = Math.max(0, next.allTimeOre);
  }

  if (typeof next.seasonStartedAt !== 'number' || !Number.isFinite(next.seasonStartedAt)) {
    next.seasonStartedAt = currentSeasonStartMs();
  }
  if (typeof next.seasonOre !== 'number' || !Number.isFinite(next.seasonOre)) {
    // Weekly board starts clean; only ore mined after this update counts for the season.
    next.seasonOre = 0;
  } else {
    next.seasonOre = Math.max(0, next.seasonOre);
  }
  if (typeof next.lastLeaderboardScore !== 'number' || !Number.isFinite(next.lastLeaderboardScore)) {
    next.lastLeaderboardScore = 0;
  }
  if (
    typeof next.lastLeaderboardSubmitAt !== 'number' ||
    !Number.isFinite(next.lastLeaderboardSubmitAt)
  ) {
    next.lastLeaderboardSubmitAt = 0;
  }
  ensureSeasonWindow(next);

  if (!next.ads) {
    next.ads = {
      midgameReadyAfter: 0,
      rewardedCooldownUntil: 0,
      resourceOfferReadyAfter: Date.now() + BALANCE.resourceOfferIntervalMs,
      resourceOffersClaimed: 0,
    };
  } else {
    if (typeof next.ads.resourceOfferReadyAfter !== 'number') {
      next.ads.resourceOfferReadyAfter = Date.now() + BALANCE.resourceOfferIntervalMs;
    }
    if (typeof next.ads.resourceOffersClaimed !== 'number' || !Number.isFinite(next.ads.resourceOffersClaimed)) {
      next.ads.resourceOffersClaimed = 0;
    } else {
      next.ads.resourceOffersClaimed = Math.max(0, Math.floor(next.ads.resourceOffersClaimed));
    }
  }

  return next;
}

export function deserializeState(raw: string): GameState | null {
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || parsed.version !== 1 || !parsed.resources) return null;
    return migrateState(parsed);
  } catch {
    return null;
  }
}

export function loadLocalState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialState();
    return deserializeState(raw) ?? createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveLocalState(state: GameState): void {
  try {
    const stamped = { ...state, lastSaveAt: Date.now() };
    localStorage.setItem(SAVE_KEY, serializeState(stamped));
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearLocalState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
