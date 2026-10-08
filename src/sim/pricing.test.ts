import { describe, expect, it } from 'vitest';
import { getExpedition } from '../data/expeditions';
import { getRecipe } from '../data/recipes';
import { getStation } from '../data/stations';
import {
  expeditionCost,
  expeditionOreGate,
  recipeCost,
  stationUnlockCost,
} from './pricing';

describe('economy pricing', () => {
  it('leaves early copper pick at authored ore cost', () => {
    expect(recipeCost(getRecipe('copper_pick'))).toEqual({ ore: 15 });
  });

  it('scales late recipe costs with hardness tier', () => {
    const cost = recipeCost(getRecipe('aether_pick'));
    // Authored aetherite 8 × (1024/2) = 4096
    expect(cost.aetherite).toBe(4096);
    expect(cost.starshard).toBe(12_800);
  });

  it('scales station unlock and expedition gates', () => {
    expect(stationUnlockCost(getStation('smelter'))).toEqual({ ore: 25 });
    expect(stationUnlockCost(getStation('aetherforge')).aetherite).toBe(6 * 512);
    expect(expeditionOreGate(getExpedition('glow_shalllows'))).toBe(50);
    expect(expeditionOreGate(getExpedition('aether_breach'))).toBe(16_000 * 512);
    expect(expeditionCost(getExpedition('aether_breach')).aetherite).toBe(8 * 512);
  });
});
