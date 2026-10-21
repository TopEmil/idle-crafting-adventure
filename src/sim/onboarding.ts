/** Guided first-run loop: dig → craft → smelter → first Reforge (rebirth). */

import { getRecipe } from '../data/recipes';
import { recipeCost } from './pricing';
import type { GameState } from './types';

export type OnboardingHighlight =
  | 'vein'
  | 'craft'
  | 'stations'
  | 'reforge'
  | 'none';

export interface OnboardingStepDef {
  id: string;
  title: string;
  body: string;
  highlight: OnboardingHighlight;
  preferredView: 'mine' | 'forge';
  preferredPanel: 'forge' | 'reforge' | null;
}

/** Four beats that teach the core loop and climax on the first rebirth. */
export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  {
    id: 'dig',
    title: 'Dig the shaft',
    body: 'Tap the dig face or Mine to gather Vein Ore. Fill enough for a Copper Pick.',
    highlight: 'vein',
    preferredView: 'mine',
    preferredPanel: null,
  },
  {
    id: 'craft',
    title: 'Craft your first tool',
    body: 'Spend ore on a Copper Pick. A forge dwarf joins and keeps mining while you craft.',
    highlight: 'craft',
    preferredView: 'mine',
    preferredPanel: null,
  },
  {
    id: 'smelter',
    title: 'Light the Smelter',
    body: 'Open Stations and unlock the Smelter — machines sit on the hall pedestals and keep producing.',
    highlight: 'stations',
    preferredView: 'forge',
    preferredPanel: 'forge',
  },
  {
    id: 'reforge',
    title: 'Reforge the forge',
    body: 'Open Reforge and rebirth the forge for Relics. Spend them on Talents for permanent power.',
    highlight: 'reforge',
    preferredView: 'forge',
    preferredPanel: 'reforge',
  },
] as const;

export const ONBOARDING_LAST_STEP = ONBOARDING_STEPS.length - 1;

export function getOnboardingStep(step: number): OnboardingStepDef {
  const index = Math.max(0, Math.min(ONBOARDING_LAST_STEP, Math.floor(step)));
  return ONBOARDING_STEPS[index]!;
}

/** Ore needed before the craft beat (Copper Pick cost). */
export function onboardingCraftOreGate(): number {
  const cost = recipeCost(getRecipe('copper_pick'));
  return Math.max(1, Math.ceil(cost.ore ?? 15));
}

/**
 * Resolve the highest step the player has earned.
 * Steps are sticky forward — never regress mid-run.
 */
export function resolveOnboardingStep(state: GameState): number {
  if (state.onboardingDone) return ONBOARDING_LAST_STEP;
  let step = Math.max(0, Math.floor(state.onboardingStep));

  if (state.prestigeCount > 0) {
    return ONBOARDING_LAST_STEP;
  }
  if (state.stations.smelter.unlocked) {
    step = Math.max(step, 3);
  } else if (state.ownedRecipes.includes('copper_pick')) {
    step = Math.max(step, 2);
  } else if (state.resources.ore >= onboardingCraftOreGate()) {
    step = Math.max(step, 1);
  }

  return Math.min(ONBOARDING_LAST_STEP, step);
}

/** True when the guided run should finish (first Reforge completed). */
export function shouldFinishOnboarding(state: GameState): boolean {
  return state.prestigeCount > 0;
}
