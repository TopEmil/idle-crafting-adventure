/** Guided first-run loop: dig → craft → smelter → first Reforge (rebirth). */

import { BALANCE } from '../data/balance';
import { getRecipe } from '../data/recipes';
import { getStation } from '../data/stations';
import { canPrestige, prestigeMinPlayRemaining } from './economy';
import { recipeCost, stationUnlockCost } from './pricing';
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
    body: 'Gather ore, then unlock the Smelter so the forge converts Ore into Emberglass.',
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

/** Ore needed to unlock the Smelter during Step 3. */
export function onboardingSmelterOreGate(): number {
  const cost = stationUnlockCost(getStation('smelter'));
  return Math.max(1, Math.ceil(cost.ore ?? 25));
}

export function onboardingCanAffordSmelter(state: GameState): boolean {
  const cost = stationUnlockCost(getStation('smelter'));
  for (const [id, amount] of Object.entries(cost)) {
    if ((state.resources[id as keyof typeof state.resources] ?? 0) < (amount ?? 0)) {
      return false;
    }
  }
  return true;
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

/** Format a short M:SS / Mm SSs countdown for coach copy. */
export function formatOnboardingCountdown(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r.toString().padStart(2, '0')}s`;
}

/**
 * Live coach copy for the current step. Step 3 stays on Mine until Smelter
 * is affordable, then opens Stations — avoids a dead unlock button.
 * Step 4 waits on playtime before steering to Reforge.
 */
export function coachPresentation(state: GameState): OnboardingStepDef {
  const step = resolveOnboardingStep(state);
  const base = getOnboardingStep(step);
  if (step === 2 && !state.stations.smelter.unlocked && !onboardingCanAffordSmelter(state)) {
    const need = onboardingSmelterOreGate();
    return {
      ...base,
      title: 'Stock ore for the Smelter',
      body: `The Smelter costs ${need} ore. Keep mining, then unlock it on Stations.`,
      action: 'Tap Mine until you can afford the Smelter',
      highlight: 'vein',
      preferredView: 'mine',
      preferredPanel: null,
    };
  }
  if (step === 3 && !canPrestige(state)) {
    const playLeft = prestigeMinPlayRemaining(state);
    if (playLeft > 0) {
      const tip =
        (state.totalOreProduced ?? 0) >= 50
          ? 'Send a Glow Shallows expedition, craft tools, or keep mining.'
          : 'Keep mining and let the Smelter run while you wait.';
      return {
        ...base,
        title: 'Forge until Reforge opens',
        body: `First Reforge opens after ${BALANCE.prestigeMinPlaySec / 60} min of play. ${tip}`,
        action: `Keep forging — Reforge in ${formatOnboardingCountdown(playLeft)}`,
        highlight: 'vein',
        preferredView: 'mine',
        preferredPanel: null,
      };
    }
  }
  return base;
}

/** True when the guided run should finish (first Reforge completed). */
export function shouldFinishOnboarding(state: GameState): boolean {
  return state.prestigeCount > 0;
}

/** Progress line for dig beats — Copper Pick or Smelter ore gates. */
export function onboardingDigProgress(state: GameState): string | null {
  if (state.onboardingDone) return null;
  const step = resolveOnboardingStep(state);
  if (step === 0) {
    const need = onboardingCraftOreGate();
    const have = Math.min(need, Math.floor(state.resources.ore));
    return `Ore ${have} / ${need} toward Copper Pick`;
  }
  if (step === 2 && !state.stations.smelter.unlocked && !onboardingCanAffordSmelter(state)) {
    const need = onboardingSmelterOreGate();
    const have = Math.min(need, Math.floor(state.resources.ore));
    return `Ore ${have} / ${need} toward Smelter`;
  }
  return null;
}
