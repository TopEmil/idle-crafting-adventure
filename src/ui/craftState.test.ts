import { describe, expect, it } from 'vitest';
import { RECIPES } from '../data/recipes';
import { emptyWallet } from '../data/resources';
import { createInitialState } from '../sim/createState';
import { formatCostProgress, getCraftQuickState } from './craftState';

describe('getCraftQuickState', () => {
  it('disables craft when the next recipe is unaffordable', () => {
    const state = createInitialState();
    state.resources.ore = 4;
    const craft = getCraftQuickState(state);
    expect(craft.recipe?.id).toBe('copper_pick');
    expect(craft.affordable).toBe(false);
    expect(craft.needDetail).toContain('4/15');
    expect(craft.progress).toBeCloseTo(4 / 15);
  });

  it('enables craft when resources cover the cost', () => {
    const state = createInitialState();
    state.resources.ore = 15;
    const craft = getCraftQuickState(state);
    expect(craft.affordable).toBe(true);
    expect(craft.label).toBe('Craft Copper Pick');
    expect(craft.needDetail).toMatch(/^Ready/);
    expect(craft.progress).toBe(1);
  });

  it('reports crafted out when every recipe is owned', () => {
    const state = createInitialState();
    state.ownedRecipes = RECIPES.map((r) => r.id);
    const craft = getCraftQuickState(state);
    expect(craft.recipe).toBeNull();
    expect(craft.affordable).toBe(false);
    expect(craft.label).toBe('Crafted out');
    expect(craft.needDetail).toBeNull();
  });
});

describe('formatCostProgress', () => {
  it('tracks the scarcest resource across multi-costs', () => {
    const wallet = emptyWallet();
    wallet.ore = 40;
    wallet.emberglass = 5;
    const result = formatCostProgress({ ore: 40, emberglass: 10 }, wallet);
    expect(result.affordable).toBe(false);
    expect(result.progress).toBeCloseTo(0.5);
    expect(result.detail).toContain('5/10');
  });
});
