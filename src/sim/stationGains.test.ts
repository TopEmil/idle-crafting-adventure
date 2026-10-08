import { describe, expect, it } from 'vitest';
import { createInitialState } from './createState';
import {
  drainStationGainFloaters,
  tickProductionDetailed,
  unlockStation,
} from './economy';

describe('station production gain VFX', () => {
  it('reports emberglass gained from a fueled smelter tick', () => {
    let state = createInitialState();
    state.resources.ore = 100;
    const unlocked = unlockStation(state, 'smelter');
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;
    state = unlocked.state;
    state.resources.ore = 50;

    const { state: next, stationGains } = tickProductionDetailed(state, 1);
    expect(next.resources.emberglass).toBeGreaterThan(0);
    const smelter = stationGains.find((g) => g.stationId === 'smelter');
    expect(smelter?.outputs.emberglass).toBeGreaterThan(0);
  });

  it('emits whole-unit floaters and keeps fractional remainder', () => {
    const first = drainStationGainFloaters({}, [
      { stationId: 'smelter', outputs: { emberglass: 0.7 } },
    ]);
    expect(first.floaters).toEqual([]);
    expect(first.pending.smelter?.emberglass).toBeCloseTo(0.7);

    const second = drainStationGainFloaters(first.pending, [
      { stationId: 'smelter', outputs: { emberglass: 0.5 } },
    ]);
    expect(second.floaters).toEqual([
      { stationId: 'smelter', resource: 'emberglass', amount: 1 },
    ]);
    expect(second.pending.smelter?.emberglass).toBeCloseTo(0.2);
  });
});
