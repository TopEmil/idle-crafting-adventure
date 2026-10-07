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

  it('round-trips enabled through serialize/deserialize', () => {
    const state = createInitialState();
    state.stations.smelter = { unlocked: true, level: 2, enabled: false };
    const raw = serializeState(state);
    const parsed = deserializeState(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.stations.smelter.enabled).toBe(false);
    expect(parsed?.stations.smelter.level).toBe(2);
  });
});
