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

  it('round-trips enabled through serialize/deserialize', () => {
    const state = createInitialState();
    state.stations.smelter = { unlocked: true, level: 2, enabled: false };
    state.talents.scout_instinct = 3;
    state.lastPrestigeAt = 42;
    const raw = serializeState(state);
    const parsed = deserializeState(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.stations.smelter.enabled).toBe(false);
    expect(parsed?.stations.smelter.level).toBe(2);
    expect(parsed?.talents.scout_instinct).toBe(3);
    expect(parsed?.lastPrestigeAt).toBe(42);
  });
});
