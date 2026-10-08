import { describe, expect, it } from 'vitest';
import { RESOURCE_IDS, resourceIconSrc, resourceLabel, RESOURCES } from './resources';

describe('resources display', () => {
  it('keeps inventory labels identical to the shared resource labels', () => {
    for (const id of RESOURCE_IDS) {
      expect(resourceLabel(id)).toBe(RESOURCES.find((r) => r.id === id)?.short);
    }
  });

  it('uses full ore names (not abbreviations) for HUD and expeditions', () => {
    expect(resourceLabel('ore')).toBe('Ore');
    expect(resourceLabel('emberglass')).toBe('Emberglass');
    expect(resourceLabel('glowdust')).toBe('Glowdust');
    expect(resourceLabel('alloy')).toBe('Alloy');
    expect(resourceLabel('nightiron')).toBe('Nightiron');
    expect(resourceLabel('starshard')).toBe('Starshard');
    expect(resourceLabel('relics')).toBe('Relics');
  });

  it('points each resource at a matching ore icon asset', () => {
    for (const id of RESOURCE_IDS) {
      expect(resourceIconSrc(id)).toMatch(new RegExp(`/art/ores/${id}\\.png$`));
    }
  });
});
