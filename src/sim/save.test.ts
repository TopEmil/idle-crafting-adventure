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
