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
  /** Short step label shown above the title, e.g. "Step 1 · Dig". */
  stepLabel: string;
  title: string;
  body: string;
  /** One-line action the player should take right now. */
  action: string;
  highlight: OnboardingHighlight;
  preferredView: 'mine' | 'forge';
  preferredPanel: 'forge' | 'reforge' | null;
}

/** Four beats that teach the core loop and climax on the first rebirth. */
export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  {
    id: 'dig',
    stepLabel: 'Step 1 · Dig',
    title: 'Gather Vein Ore',
    body: 'Your first goal is a Copper Pick. Keep tapping until you have enough ore.',
    action: 'Tap the glowing Mine button (or the dig face)',
    highlight: 'vein',
    preferredView: 'mine',
    preferredPanel: null,
  },
  {
    id: 'craft',
    stepLabel: 'Step 2 · Craft',
    title: 'Craft a Copper Pick',
    body: 'Spend your ore on a Copper Pick. A forge dwarf joins and keeps mining for you.',
    action: 'Tap Craft Copper Pick',
    highlight: 'craft',
    preferredView: 'mine',
    preferredPanel: null,
  },
  {
    id: 'smelter',
    stepLabel: 'Step 3 · Stations',
    title: 'Light the Smelter',
    body: 'Unlock the Smelter so the forge converts Ore into Emberglass automatically.',
    action: 'Unlock Smelter on the Stations sheet',
    highlight: 'stations',
    preferredView: 'forge',
    preferredPanel: 'forge',
  },
  {
    id: 'reforge',
    stepLabel: 'Step 4 · Reforge',
    title: 'Your first rebirth',
    body: 'Reforge resets this run for Relics — permanent power you spend on Talents.',
    action: 'Tap Reforge, then confirm',
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

/** Progress line for the dig beat — e.g. "Ore 4 / 15 toward Copper Pick". */
export function onboardingDigProgress(state: GameState): string | null {
  if (state.onboardingDone || resolveOnboardingStep(state) !== 0) return null;
  const need = onboardingCraftOreGate();
  const have = Math.min(need, Math.floor(state.resources.ore));
  return `Ore ${have} / ${need} toward Copper Pick`;
}
