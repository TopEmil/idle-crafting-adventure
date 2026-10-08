import { resourceLabel, type ResourceId } from '../data/resources';
import type { RecipeDef } from '../data/recipes';
import { availableRecipes, canAfford } from '../sim/economy';
import type { GameState } from '../sim/types';
import { formatNumber } from './format';

export interface CraftQuickState {
  recipe: RecipeDef | null;
  affordable: boolean;
  /** Primary button label */
  label: string;
  /** Secondary cost/progress line under the button; null when crafted out */
  needDetail: string | null;
  /** 0..1 cheapest resource ratio toward the next craft */
  progress: number;
}

export function formatCostProgress(
  cost: Partial<Record<ResourceId, number>>,
  wallet: Record<ResourceId, number>,
): { detail: string; progress: number; affordable: boolean } {
  let progress = 1;
  const parts: string[] = [];
  for (const [key, amount] of Object.entries(cost) as [ResourceId, number][]) {
    const owned = wallet[key] ?? 0;
    const ratio = amount > 0 ? Math.min(1, owned / amount) : 1;
    progress = Math.min(progress, ratio);
    parts.push(`${formatNumber(owned)}/${formatNumber(amount)} ${resourceLabel(key)}`);
  }
  return {
    detail: parts.join(' · '),
    progress,
    affordable: canAfford(wallet, cost),
  };
}

export function getCraftQuickState(state: GameState): CraftQuickState {
  const recipe = availableRecipes(state)[0] ?? null;
  if (!recipe) {
    return {
      recipe: null,
      affordable: false,
      label: 'Crafted out',
      needDetail: null,
      progress: 1,
    };
  }
  const { detail, progress, affordable } = formatCostProgress(recipe.cost, state.resources);
  return {
    recipe,
    affordable,
    label: `Craft ${recipe.name}`,
    needDetail: affordable ? `Ready · ${detail}` : detail,
    progress,
  };
}
