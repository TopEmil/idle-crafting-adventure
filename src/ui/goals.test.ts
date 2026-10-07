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

  it('prioritizes claiming pending expedition loot', () => {
    const state = createInitialState();
    state.ownedRecipes = ['copper_pick', 'ember_tongs'];
    state.pendingLoot = { glowdust: 18, ore: 12 };
    state.activeExpedition = {
      id: 'glow_shalllows',
      startedAt: 0,
      endsAt: 0,
      claimed: false,
      doublePending: false,
    };
    const goal = nextGoal(state);
    expect(goal.id).toBe('exp-claim');
    expect(goal.ready).toBe(true);
  });

  it('points at Glow Shallows when a recipe needs Glowdust', () => {
    const state = createInitialState();
    state.ownedRecipes = ['copper_pick', 'ember_tongs'];
    state.totalOreProduced = 80;
    state.resources.ore = 30;
    state.resources.glowdust = 0;
    const goal = nextGoal(state);
    expect(goal.id).toBe('exp-dust:glow_shalllows');
    expect(goal.ready).toBe(true);
  });
});
