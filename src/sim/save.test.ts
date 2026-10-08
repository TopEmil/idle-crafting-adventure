import { describe, expect, it } from 'vitest';
import { createInitialState } from './createState';
import { deserializeState, migrateState, serializeState } from './save';

describe('save migration', () => {
  it('defaults missing station.enabled to true', () => {
    const state = createInitialState();
    const legacy = structuredClone(state) as unknown as {
      stations: Record<string, { unlocked: boolean; level: number; enabled?: boolean }>;
    };
    delete legacy.stations.smelter.enabled;
    delete legacy.stations.anvil.enabled;
    delete legacy.stations.enchanter.enabled;

    const migrated = migrateState(legacy as typeof state);
    expect(migrated.stations.smelter.enabled).toBe(true);
    expect(migrated.stations.anvil.enabled).toBe(true);
    expect(migrated.stations.enchanter.enabled).toBe(true);
  });

  it('defaults missing station.runLevel to owned level', () => {
    const state = createInitialState();
    const legacy = structuredClone(state) as unknown as {
      stations: Record<string, { unlocked: boolean; level: number; runLevel?: number; enabled: boolean }>;
    };
    legacy.stations.smelter = { unlocked: true, level: 5, enabled: true };
    delete legacy.stations.smelter.runLevel;

    const migrated = migrateState(legacy as typeof state);
    expect(migrated.stations.smelter.runLevel).toBe(5);
  });

  it('defaults missing talents, lastPrestigeAt, and mine shaft fields', () => {
    const state = createInitialState();
    const legacy = structuredClone(state) as unknown as {
      talents?: typeof state.talents;
      lastPrestigeAt?: number;
      mineDepth?: number;
      mineFaceDamage?: number[];
      mineDigAcc?: number;
    };
    delete legacy.talents;
    delete legacy.lastPrestigeAt;
    delete legacy.mineDepth;
    delete legacy.mineFaceDamage;
    delete legacy.mineDigAcc;

    const migrated = migrateState(legacy as typeof state);
    expect(migrated.talents.vein_attunement).toBe(0);
    expect(migrated.talents.hearth_kindling).toBe(0);
    expect(migrated.lastPrestigeAt).toBe(0);
    expect(migrated.mineDepth).toBe(0);
    expect(migrated.mineFaceDamage).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(migrated.mineDigAcc).toBe(0);
  });

  it('migrates legacy mineFaceHits into mineFaceDamage', () => {
    const state = createInitialState();
    const legacy = structuredClone(state) as unknown as {
      mineFaceDamage?: number[];
      mineFaceHits?: number;
    };
    delete legacy.mineFaceDamage;
    legacy.mineFaceHits = 4;
    const migrated = migrateState(legacy as typeof state);
    expect(migrated.mineFaceDamage.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('defaults missing achievements and lifetimeClicks', () => {
    const state = createInitialState();
    const legacy = structuredClone(state) as unknown as {
      claimedAchievements?: typeof state.claimedAchievements;
      unlockedAchievements?: string[];
      lifetimeClicks?: number;
    };
    delete legacy.claimedAchievements;
    delete legacy.unlockedAchievements;
    delete legacy.lifetimeClicks;

    const migrated = migrateState(legacy as typeof state);
    expect(migrated.claimedAchievements).toEqual({});
    expect(migrated.lifetimeClicks).toBe(0);
  });

  it('migrates legacy unlockedAchievements into claimed tier 1', () => {
    const state = createInitialState();
    const legacy = structuredClone(state) as unknown as {
      claimedAchievements?: typeof state.claimedAchievements;
      unlockedAchievements?: string[];
    };
    delete legacy.claimedAchievements;
    legacy.unlockedAchievements = ['first_strike', 'vein_warmup', 'bogus'];

    const migrated = migrateState(legacy as typeof state);
    expect(migrated.claimedAchievements.first_strike).toBe(1);
    expect(migrated.claimedAchievements.vein_warmup).toBe(1);
    expect((migrated as { unlockedAchievements?: unknown }).unlockedAchievements).toBeUndefined();
  });

  it('seeds allTimeOre from legacy run totals and starts a clean season', () => {
    const state = createInitialState();
    state.lifetimeOre = 250;
    state.totalOreProduced = 300;
    const legacy = structuredClone(state) as unknown as {
      allTimeOre?: number;
      seasonOre?: number;
      seasonStartedAt?: number;
      lastLeaderboardScore?: number;
      lastLeaderboardSubmitAt?: number;
    };
    delete legacy.allTimeOre;
    delete legacy.seasonOre;
    delete legacy.seasonStartedAt;
    delete legacy.lastLeaderboardScore;
    delete legacy.lastLeaderboardSubmitAt;

    const migrated = migrateState(legacy as typeof state);
    expect(migrated.allTimeOre).toBe(300);
    expect(migrated.seasonOre).toBe(0);
    expect(migrated.seasonStartedAt).toBeGreaterThan(0);
    expect(migrated.lastLeaderboardScore).toBe(0);
  });

  it('round-trips enabled and runLevel through serialize/deserialize', () => {
    const state = createInitialState();
    state.stations.smelter = { unlocked: true, level: 5, runLevel: 2, enabled: false };
    state.talents.scout_instinct = 3;
    state.lastPrestigeAt = 42;
    state.claimedAchievements = { first_strike: 1, vein_warmup: 1, hearth_lit: 2 };
    state.lifetimeClicks = 120;
    state.extraSquadSlots = 2;
    state.resources.nightiron = 4;
    state.resources.starshard = 1;
    const raw = serializeState(state);
    const parsed = deserializeState(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.stations.smelter.enabled).toBe(false);
    expect(parsed?.stations.smelter.level).toBe(5);
    expect(parsed?.stations.smelter.runLevel).toBe(2);
    expect(parsed?.talents.scout_instinct).toBe(3);
    expect(parsed?.lastPrestigeAt).toBe(42);
    expect(parsed?.claimedAchievements).toEqual({
      first_strike: 1,
      vein_warmup: 1,
      hearth_lit: 2,
    });
    expect(parsed?.lifetimeClicks).toBe(120);
    expect(parsed?.extraSquadSlots).toBe(2);
    expect(parsed?.resources.nightiron).toBe(4);
    expect(parsed?.resources.starshard).toBe(1);
  });

  it('migrates legacy activeExpedition and missing late resources', () => {
    const state = createInitialState();
    const legacy = structuredClone(state) as unknown as {
      activeExpeditions?: typeof state.activeExpeditions;
      activeExpedition?: {
        id: string;
        startedAt: number;
        endsAt: number;
        claimed: boolean;
        doublePending: boolean;
      } | null;
      extraSquadSlots?: number;
      resources: Record<string, number>;
    };
    delete legacy.activeExpeditions;
    delete legacy.extraSquadSlots;
    delete legacy.resources.nightiron;
    delete legacy.resources.starshard;
    delete legacy.resources.verdiglass;
    delete legacy.resources.aetherite;
    legacy.activeExpedition = {
      id: 'glow_shalllows',
      startedAt: 1,
      endsAt: 2,
      claimed: false,
      doublePending: false,
    };

    const migrated = migrateState(legacy as typeof state);
    expect(migrated.activeExpeditions).toHaveLength(1);
    expect(migrated.activeExpeditions[0]?.id).toBe('glow_shalllows');
    expect(migrated.extraSquadSlots).toBe(0);
    expect(migrated.resources.nightiron).toBe(0);
    expect(migrated.resources.starshard).toBe(0);
    expect(migrated.resources.verdiglass).toBe(0);
    expect(migrated.resources.aetherite).toBe(0);
  });

  it('defaults missing resource-offer ad fields', () => {
    const state = createInitialState();
    const legacy = structuredClone(state) as unknown as {
      ads: {
        midgameReadyAfter: number;
        rewardedCooldownUntil: number;
        resourceOfferReadyAfter?: number;
        resourceOffersClaimed?: number;
      };
    };
    delete legacy.ads.resourceOfferReadyAfter;
    delete legacy.ads.resourceOffersClaimed;

    const migrated = migrateState(legacy as typeof state);
    expect(migrated.ads.resourceOfferReadyAfter).toBeGreaterThan(0);
    expect(migrated.ads.resourceOffersClaimed).toBe(0);
  });

  it('fills missing late stations and dwarf/stratum fields', () => {
    const state = createInitialState();
    const legacy = structuredClone(state) as unknown as {
      stations: Record<string, unknown>;
      lastMineHitCol?: number;
      discoveredStrata?: string[];
    };
    delete legacy.stations.crucible;
    delete legacy.stations.gemcutter;
    delete legacy.stations.aetherforge;
    delete legacy.lastMineHitCol;
    delete legacy.discoveredStrata;
    legacy.stations = {
      smelter: legacy.stations.smelter,
      anvil: legacy.stations.anvil,
      enchanter: legacy.stations.enchanter,
    };

    const migrated = migrateState(legacy as typeof state);
    expect(migrated.stations.crucible.unlocked).toBe(false);
    expect(migrated.stations.gemcutter.level).toBe(0);
    expect(migrated.stations.aetherforge.enabled).toBe(true);
    expect(migrated.lastMineHitCol).toBe(0);
    expect(migrated.discoveredStrata).toContain('glow_shallows');
  });
});
