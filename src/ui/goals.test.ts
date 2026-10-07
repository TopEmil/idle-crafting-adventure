import { describe, expect, it } from 'vitest';
import { createInitialState } from '../sim/createState';
import { nextGoal } from './goals';

describe('nextGoal', () => {
  it('points at copper pick early', () => {
    const state = createInitialState();
    state.resources.ore = 8;
    const goal = nextGoal(state);
    expect(goal.id).toBe('recipe:copper_pick');
    expect(goal.progress).toBeGreaterThan(0);
    expect(goal.ready).toBe(false);
  });

  it('marks craft ready when affordable', () => {
    const state = createInitialState();
    state.resources.ore = 20;
    const goal = nextGoal(state);
    expect(goal.ready).toBe(true);
  });
});
