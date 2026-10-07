import { describe, expect, it } from 'vitest';
import { depthOreMult, stratumAtDepth } from './strata';

describe('strata', () => {
  it('picks deeper strata by depth thresholds', () => {
    expect(stratumAtDepth(0).id).toBe('glow_shallows');
    expect(stratumAtDepth(12).id).toBe('crystal_fault');
    expect(stratumAtDepth(30).id).toBe('ember_rift');
    expect(stratumAtDepth(55).id).toBe('abyss_vein');
    expect(stratumAtDepth(90).id).toBe('deep_dark');
  });

  it('caps depth ore multiplier', () => {
    expect(depthOreMult(0)).toBe(1);
    expect(depthOreMult(20)).toBeCloseTo(1.08);
    expect(depthOreMult(200)).toBe(1.35);
  });
});
