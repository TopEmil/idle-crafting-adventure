import { describe, expect, it } from 'vitest';
import {
  COSMETICS,
  cosmeticGrantedByPrestige,
  cosmeticsForPrestigeCount,
  getCosmetic,
  isCosmeticId,
} from './cosmetics';

describe('cosmetics catalog', () => {
  it('keeps default plus three prestige skins and two Relic sinks', () => {
    expect(COSMETICS.some((c) => c.id === 'default')).toBe(true);
    expect(cosmeticsForPrestigeCount(1)).toEqual(['ember_crest']);
    expect(cosmeticsForPrestigeCount(2)).toEqual(['ember_crest', 'cyan_hearth']);
    expect(cosmeticsForPrestigeCount(3)).toEqual([
      'ember_crest',
      'cyan_hearth',
      'abyss_crown',
    ]);
    expect(COSMETICS.filter((c) => c.relicCost > 0).map((c) => c.id)).toEqual([
      'verdant_mantle',
      'starlit_kiln',
    ]);
  });

  it('maps each prestige count to a granted skin', () => {
    expect(cosmeticGrantedByPrestige(1)).toBe('ember_crest');
    expect(cosmeticGrantedByPrestige(2)).toBe('cyan_hearth');
    expect(cosmeticGrantedByPrestige(3)).toBe('abyss_crown');
    expect(cosmeticGrantedByPrestige(4)).toBeNull();
  });

  it('falls back to default for unknown ids', () => {
    expect(isCosmeticId('cyan_hearth')).toBe(true);
    expect(isCosmeticId('nope')).toBe(false);
    expect(getCosmetic('nope').id).toBe('default');
  });
});
