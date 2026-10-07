import { describe, expect, it } from 'vitest';
import { FORGE_STATION_SLOTS } from './sceneView';

describe('FORGE_STATION_SLOTS', () => {
  it('anchors three stations on separate pedestals', () => {
    const ids = Object.keys(FORGE_STATION_SLOTS);
    expect(ids).toEqual(['smelter', 'anvil', 'enchanter']);
    const xs = Object.values(FORGE_STATION_SLOTS).map((s) => s.x);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
    for (const slot of Object.values(FORGE_STATION_SLOTS)) {
      expect(slot.y).toBeGreaterThan(0.55);
      expect(slot.y).toBeLessThan(0.75);
    }
  });
});
