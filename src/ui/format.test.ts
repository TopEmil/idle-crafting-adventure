import { describe, expect, it } from 'vitest';
import {
  formatCost,
  formatCostHtml,
  formatLoot,
  formatLootHtml,
  formatMissingCostHtml,
  formatResourceInline,
} from './format';
import { emptyWallet } from '../data/resources';

describe('format resource strings', () => {
  it('formats plain costs with names for titles/toasts', () => {
    expect(formatCost({ ore: 20, glowdust: 15 })).toBe('20 Ore · 15 Glowdust');
  });

  it('formats expedition loot with the same labels as inventory', () => {
    expect(formatLoot({ glowdust: 18, ore: 12 })).toBe('+18 Glowdust · +12 Ore');
  });

  it('embeds ore icons without writing the resource name', () => {
    const html = formatLootHtml({ emberglass: 8 });
    expect(html).toContain('art/ores/emberglass.png');
    expect(html).toContain('+8');
    expect(html).toContain('title="Emberglass"');
    expect(html).not.toMatch(/>\s*Emberglass</);
    expect(html).not.toContain('+8 Emberglass');
  });

  it('formats costs as amount + icon', () => {
    const html = formatCostHtml({ ore: 20 });
    expect(html).toContain('art/ores/ore.png');
    expect(html).toContain('>20 <');
    expect(html).toContain('title="Ore"');
    expect(html).not.toContain('20 Ore');
  });

  it('formats missing costs with icons', () => {
    const wallet = emptyWallet();
    wallet.ore = 5;
    const html = formatMissingCostHtml({ ore: 20 }, wallet);
    expect(html).toContain('Need');
    expect(html).toContain('art/ores/ore.png');
    expect(html).toContain('>15 <');
    expect(html).not.toContain('15 Ore');
  });

  it('places amount before the icon', () => {
    const html = formatResourceInline('glowdust', '7.2');
    const amountAt = html.indexOf('>7.2 <');
    const iconAt = html.indexOf('art/ores/glowdust.png');
    expect(amountAt).toBeGreaterThan(-1);
    expect(iconAt).toBeGreaterThan(amountAt);
  });
});
