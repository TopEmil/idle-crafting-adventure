import { describe, expect, it } from 'vitest';
import { getRecipe } from '../data/recipes';
import { getStation } from '../data/stations';
import { formatRecipeEffects, formatStationIO, formatStationUpgradeHint } from './effectsText';

describe('effects text', () => {
  it('explains recipe multipliers', () => {
    expect(formatRecipeEffects(getRecipe('copper_pick'))).toContain('Tap power ×1.5');
    expect(formatRecipeEffects(getRecipe('copper_pick'))).toContain('Dwarf mine');
    expect(formatRecipeEffects(getRecipe('scout_kit'))).toContain('Expedition loot');
  });

  it('explains station IO rates', () => {
    const text = formatStationIO(getStation('smelter'), 2);
    expect(text).toContain('/s');
    expect(text).toContain('auto');
    expect(formatStationUpgradeHint(2)).toContain('Lv 2 → Lv 3');
  });
});
