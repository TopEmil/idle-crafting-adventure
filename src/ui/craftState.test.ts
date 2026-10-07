import { describe, expect, it } from 'vitest';
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
    state.ownedRecipes = [
      'copper_pick',
      'ember_tongs',
      'vein_lantern',
      'glow_chisel',
      'alloy_hammer',
      'scout_kit',
      'hearth_bellows',
      'cyan_lens',
      'deep_gauntlets',
      'resonance_core',
      'forge_crown',
      'mythic_crucible',
      'nightiron_pick',
      'starshard_lens',
    ];
    const craft = getCraftQuickState(state);
    expect(craft.recipe).toBeNull();
    expect(craft.affordable).toBe(false);
    expect(craft.label).toBe('Crafted out');
    expect(craft.needDetail).toBeNull();
  });
});

describe('formatCostProgress', () => {
  it('tracks the scarcest resource across multi-costs', () => {
    const result = formatCostProgress(
      { ore: 40, emberglass: 10 },
      {
        ore: 40,
        emberglass: 5,
        glowdust: 0,
        alloy: 0,
        nightiron: 0,
        starshard: 0,
        relics: 0,
      },
    );
    expect(result.affordable).toBe(false);
    expect(result.progress).toBeCloseTo(0.5);
    expect(result.detail).toContain('5/10');
  });
});
