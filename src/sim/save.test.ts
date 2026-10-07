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

  it('defaults missing talents and lastPrestigeAt', () => {
    const state = createInitialState();
    const legacy = structuredClone(state) as unknown as {
      talents?: typeof state.talents;
      lastPrestigeAt?: number;
    };
    delete legacy.talents;
    delete legacy.lastPrestigeAt;

    const migrated = migrateState(legacy as typeof state);
    expect(migrated.talents.vein_attunement).toBe(0);
    expect(migrated.talents.hearth_kindling).toBe(0);
    expect(migrated.lastPrestigeAt).toBe(0);
  });

  it('defaults missing achievements and lifetimeClicks', () => {
    const state = createInitialState();
    const legacy = structuredClone(state) as unknown as {
      unlockedAchievements?: typeof state.unlockedAchievements;
      lifetimeClicks?: number;
    };
    delete legacy.unlockedAchievements;
    delete legacy.lifetimeClicks;

    const migrated = migrateState(legacy as typeof state);
    expect(migrated.unlockedAchievements).toEqual([]);
    expect(migrated.lifetimeClicks).toBe(0);
  });

  it('round-trips enabled and runLevel through serialize/deserialize', () => {
    const state = createInitialState();
    state.stations.smelter = { unlocked: true, level: 5, runLevel: 2, enabled: false };
    state.talents.scout_instinct = 3;
    state.lastPrestigeAt = 42;
    state.unlockedAchievements = ['first_strike', 'vein_warmup'];
    state.lifetimeClicks = 120;
    const raw = serializeState(state);
    const parsed = deserializeState(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.stations.smelter.enabled).toBe(false);
    expect(parsed?.stations.smelter.level).toBe(5);
    expect(parsed?.stations.smelter.runLevel).toBe(2);
    expect(parsed?.talents.scout_instinct).toBe(3);
    expect(parsed?.lastPrestigeAt).toBe(42);
    expect(parsed?.unlockedAchievements).toEqual(['first_strike', 'vein_warmup']);
    expect(parsed?.lifetimeClicks).toBe(120);
  });
});
