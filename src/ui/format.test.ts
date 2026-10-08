import { describe, expect, it } from 'vitest';
import { formatCost, formatLoot, formatLootHtml } from './format';

describe('format resource strings', () => {
  it('formats costs with the same labels as inventory', () => {
    expect(formatCost({ ore: 20, glowdust: 15 })).toBe('20 Ore · 15 Glowdust');
  });

  it('formats expedition loot with the same labels as inventory', () => {
    expect(formatLoot({ glowdust: 18, ore: 12 })).toBe('+18 Glowdust · +12 Ore');
  });

  it('embeds ore icons in loot HTML', () => {
    const html = formatLootHtml({ emberglass: 8 });
    expect(html).toContain('art/ores/emberglass.png');
    expect(html).toContain('Emberglass');
    expect(html).toContain('+8');
  });
});
