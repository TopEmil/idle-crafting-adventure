import { describe, expect, it } from 'vitest';
import { createInitialState } from './createState';
import {
  ONBOARDING_LAST_STEP,
  ONBOARDING_STEPS,
  getOnboardingStep,
  onboardingCraftOreGate,
  resolveOnboardingStep,
  shouldFinishOnboarding,
} from './onboarding';

describe('onboarding', () => {
  it('defines dig → craft → smelter → reforge', () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual([
      'dig',
      'craft',
      'smelter',
      'reforge',
    ]);
    expect(ONBOARDING_LAST_STEP).toBe(3);
    expect(getOnboardingStep(99).id).toBe('reforge');
  });

  it('advances dig → craft when ore covers the Copper Pick', () => {
    const state = createInitialState();
    expect(resolveOnboardingStep(state)).toBe(0);

    state.resources.ore = onboardingCraftOreGate();
    expect(resolveOnboardingStep(state)).toBe(1);
  });

  it('advances craft → smelter after Copper Pick', () => {
    const state = createInitialState();
    state.ownedRecipes.push('copper_pick');
    expect(resolveOnboardingStep(state)).toBe(2);
  });

  it('advances smelter → reforge after Smelter unlock', () => {
    const state = createInitialState();
    state.ownedRecipes.push('copper_pick');
    state.stations.smelter.unlocked = true;
    state.stations.smelter.level = 1;
    expect(resolveOnboardingStep(state)).toBe(3);
    expect(getOnboardingStep(3).preferredPanel).toBe('reforge');
  });

  it('finishes only after the first Reforge', () => {
    const state = createInitialState();
    state.stations.smelter.unlocked = true;
    expect(shouldFinishOnboarding(state)).toBe(false);

    state.prestigeCount = 1;
    expect(shouldFinishOnboarding(state)).toBe(true);
    expect(resolveOnboardingStep(state)).toBe(ONBOARDING_LAST_STEP);
  });

  it('never regresses a sticky step', () => {
    const state = createInitialState();
    state.onboardingStep = 2;
    state.resources.ore = 0;
    expect(resolveOnboardingStep(state)).toBe(2);
  });
});
