import { describe, expect, it } from 'vitest';
import { createInitialState } from '../sim/createState';
import { createAdGate } from './ads';

describe('ad gate', () => {
  it('blocks midgame before min playtime unless expedition claim gated by ready time', () => {
    const gate = createAdGate();
    const state = createInitialState(0);
    state.playTimeSec = 30;
    state.ads.midgameReadyAfter = 0;
    expect(gate.canShowMidgame(state, 'milestone', 1000)).toBe(false);
    state.milestones.firstExpeditionClaimed = true;
    state.playTimeSec = 200;
    expect(gate.canShowMidgame(state, 'expedition_claim', 1000)).toBe(true);
  });

  it('enforces rewarded cooldown', () => {
    const gate = createAdGate();
    let state = createInitialState(0);
    expect(gate.canShowRewarded(state, 1000).ok).toBe(true);
    state = gate.markRewardedUsed(state, 1000);
    expect(gate.canShowRewarded(state, 2000).ok).toBe(false);
    expect(gate.canShowRewarded(state, 200_000).ok).toBe(true);
  });
});
