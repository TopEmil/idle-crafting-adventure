import { describe, expect, it } from 'vitest';
import { depthOreMult, stratumAtDepth, STRATA } from './strata';

describe('strata', () => {
  it('picks deeper strata by depth thresholds', () => {
    expect(stratumAtDepth(0).id).toBe('glow_shallows');
    expect(stratumAtDepth(6).id).toBe('moss_gallery');
    expect(stratumAtDepth(12).id).toBe('crystal_fault');
    expect(stratumAtDepth(20).id).toBe('slag_vents');
    expect(stratumAtDepth(30).id).toBe('ember_rift');
    expect(stratumAtDepth(42).id).toBe('frost_seam');
    expect(stratumAtDepth(55).id).toBe('abyss_vein');
    expect(stratumAtDepth(90).id).toBe('deep_dark');
    expect(stratumAtDepth(120).id).toBe('starfall_hollow');
    expect(stratumAtDepth(175).id).toBe('aether_core');
  });

  it('doubles the early content ladder with ten strata', () => {
    expect(STRATA).toHaveLength(10);
  });

  it('caps depth ore multiplier', () => {
    expect(depthOreMult(0)).toBe(1);
    expect(depthOreMult(20)).toBeCloseTo(1.07);
    expect(depthOreMult(200)).toBe(1.45);
  });
});
