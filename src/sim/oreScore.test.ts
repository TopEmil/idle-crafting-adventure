import { describe, expect, it } from 'vitest';
import { createInitialState } from './createState';
import {
  currentSeasonStartMs,
  ensureSeasonWindow,
  leaderboardScore,
  recordOreMined,
  SEASON_RESET_UTC_HOUR,
} from './oreScore';

describe('oreScore seasons', () => {
  it('anchors season start to Monday 09:00 UTC', () => {
    // Wednesday 2026-04-08 12:00 UTC → season started Monday 2026-04-06 09:00 UTC
    const wed = Date.UTC(2026, 3, 8, 12, 0, 0);
    const start = currentSeasonStartMs(wed);
    const d = new Date(start);
    expect(d.getUTCDay()).toBe(1);
    expect(d.getUTCHours()).toBe(SEASON_RESET_UTC_HOUR);
    expect(d.getUTCDate()).toBe(6);
  });

  it('stays on previous week before Monday 09:00 UTC', () => {
    const mondayMorning = Date.UTC(2026, 3, 6, 8, 59, 0);
    const start = currentSeasonStartMs(mondayMorning);
    expect(start).toBe(Date.UTC(2026, 2, 30, SEASON_RESET_UTC_HOUR, 0, 0, 0));
  });

  it('resets seasonOre when the week rolls', () => {
    const state = createInitialState(Date.UTC(2026, 3, 6, 10, 0, 0));
    recordOreMined(state, 100, Date.UTC(2026, 3, 6, 10, 0, 0));
    expect(state.seasonOre).toBe(100);
    expect(state.allTimeOre).toBe(100);

    ensureSeasonWindow(state, Date.UTC(2026, 3, 13, 10, 0, 0));
    expect(state.seasonOre).toBe(0);
    expect(state.allTimeOre).toBe(100);
    expect(leaderboardScore(state, Date.UTC(2026, 3, 13, 10, 0, 0))).toBe(0);
  });

  it('floors fractional ore for the leaderboard score', () => {
    const state = createInitialState();
    recordOreMined(state, 12.7);
    expect(leaderboardScore(state)).toBe(12);
  });
});
