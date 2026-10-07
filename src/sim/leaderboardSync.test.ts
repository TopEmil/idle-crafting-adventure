import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from './createState';
import { maybeSubmitLeaderboardScore } from './leaderboardSync';
import { LEADERBOARD_SUBMIT_COOLDOWN_MS, recordOreMined } from './oreScore';

describe('leaderboardSync', () => {
  it('submits when season ore increased past last submitted score', async () => {
    const state = createInitialState(1_000);
    recordOreMined(state, 40, 1_000);
    const submit = vi.fn(async (score: number) => ({ status: 'submitted' as const, score }));
    const result = await maybeSubmitLeaderboardScore(state, submit, 1_000);
    expect(result.submitted).toBe(true);
    expect(submit).toHaveBeenCalledWith(40);
    expect(result.state.lastLeaderboardScore).toBe(40);
  });

  it('respects cooldown between submits', async () => {
    let state = createInitialState(1_000);
    recordOreMined(state, 20, 1_000);
    const submit = vi.fn(async (score: number) => ({ status: 'submitted' as const, score }));
    const first = await maybeSubmitLeaderboardScore(state, submit, 1_000);
    state = first.state;
    recordOreMined(state, 10, 1_000 + 1_000);
    const second = await maybeSubmitLeaderboardScore(
      state,
      submit,
      1_000 + LEADERBOARD_SUBMIT_COOLDOWN_MS - 1,
    );
    expect(second.submitted).toBe(false);
    expect(second.reason).toBe('cooldown');
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('skips when score has not increased', async () => {
    const state = createInitialState(1_000);
    recordOreMined(state, 15, 1_000);
    state.lastLeaderboardScore = 15;
    const submit = vi.fn(async (score: number) => ({ status: 'submitted' as const, score }));
    const result = await maybeSubmitLeaderboardScore(
      state,
      submit,
      1_000 + LEADERBOARD_SUBMIT_COOLDOWN_MS,
    );
    expect(result.submitted).toBe(false);
    expect(result.reason).toBe('unchanged');
    expect(submit).not.toHaveBeenCalled();
  });
});
