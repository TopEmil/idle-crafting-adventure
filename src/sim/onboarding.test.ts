import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { createInitialState } from './createState';
import {
  ONBOARDING_LAST_STEP,
  ONBOARDING_STEPS,
  coachPresentation,
  formatOnboardingCountdown,
  getOnboardingStep,
  onboardingCraftOreGate,
  onboardingDigProgress,
  onboardingSmelterOreGate,
  resolveOnboardingStep,
  shouldFinishOnboarding,
} from './onboarding';

describe('onboarding', () => {
  it('defines dig → craft → smelter → reforge with clear first-step copy', () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual([
      'dig',
      'craft',
      'smelter',
      'reforge',
    ]);
    expect(ONBOARDING_LAST_STEP).toBe(3);
    expect(getOnboardingStep(99).id).toBe('reforge');
    expect(getOnboardingStep(0).stepLabel).toMatch(/Step 1/i);
    expect(getOnboardingStep(0).action).toMatch(/Mine/i);
  });

  it('shows dig ore progress toward the Copper Pick', () => {
    const state = createInitialState();
    state.resources.ore = 4;
    expect(onboardingDigProgress(state)).toBe(
      `Ore 4 / ${onboardingCraftOreGate()} toward Copper Pick`,
    );
    state.resources.ore = onboardingCraftOreGate();
    expect(onboardingDigProgress(state)).toBeNull();
  });

  it('keeps Step 3 on Mine until Smelter is affordable', () => {
    const state = createInitialState();
    state.ownedRecipes.push('copper_pick');
    state.resources.ore = 5;
    const gathering = coachPresentation(state);
    expect(gathering.preferredPanel).toBeNull();
    expect(gathering.highlight).toBe('vein');
    expect(onboardingDigProgress(state)).toContain('toward Smelter');

    state.resources.ore = onboardingSmelterOreGate();
    const ready = coachPresentation(state);
    expect(ready.preferredPanel).toBe('forge');
    expect(ready.highlight).toBe('stations');
    expect(ready.action).toMatch(/Unlock Smelter/i);
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

  it('keeps Step 4 on Mine with countdown until playtime gate clears', () => {
    const state = createInitialState();
    state.ownedRecipes.push('copper_pick');
    state.stations.smelter.unlocked = true;
    state.stations.smelter.level = 1;
    state.playTimeSec = BALANCE.prestigeMinPlaySec - 90;
    const waiting = coachPresentation(state);
    expect(waiting.preferredPanel).toBeNull();
    expect(waiting.highlight).toBe('vein');
    expect(waiting.action).toContain(
      `Reforge in ${formatOnboardingCountdown(90)}`,
    );
    expect(waiting.body).toMatch(/10 min/i);

    state.playTimeSec = BALANCE.prestigeMinPlaySec;
    const ready = coachPresentation(state);
    expect(ready.preferredPanel).toBe('reforge');
    expect(ready.highlight).toBe('reforge');
    expect(ready.action).toMatch(/Tap Reforge/i);
  });

  it('hints at expeditions once Glow Shallows is unlocked during Reforge wait', () => {
    const state = createInitialState();
    state.ownedRecipes.push('copper_pick');
    state.stations.smelter.unlocked = true;
    state.playTimeSec = 30;
    state.totalOreProduced = 50;
    const tip = coachPresentation(state);
    expect(tip.body).toMatch(/expedition/i);
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
