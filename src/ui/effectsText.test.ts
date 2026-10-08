import { describe, expect, it } from 'vitest';
import { getAchievement } from '../data/achievements';
import { getRecipe } from '../data/recipes';
import { getStation } from '../data/stations';
import { getTalent } from '../data/talents';
import {
  formatAchievementRewards,
  formatRecipeEffects,
  formatStationIO,
  formatStationSpeedHint,
  formatStationUpgradeHint,
  formatTalentEffects,
  formatTalentPerLevel,
} from './effectsText';

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

  it('explains throttled station speed', () => {
    expect(formatStationSpeedHint(5, 5)).toContain('full rate');
    expect(formatStationSpeedHint(2, 5)).toContain('throttled');
    expect(formatStationSpeedHint(2, 5)).toContain('2/5');
  });

  it('explains talent bonuses', () => {
    const talent = getTalent('vein_attunement');
    expect(formatTalentPerLevel(talent)).toContain('+10% tap');
    expect(formatTalentEffects(talent, 3)).toContain('Tap power ×1.30');
  });

  it('explains achievement rewards', () => {
    expect(formatAchievementRewards(getAchievement('first_strike').tiers[0]!.rewards)).toContain('Ore');
    expect(formatAchievementRewards(getAchievement('vein_warmup').tiers[0]!.rewards)).toContain('+5% tap');
    expect(formatAchievementRewards(getAchievement('copper_bound').tiers[0]!.rewards)).toContain('Dwarf mine');
  });
});
