import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXPEDITION_CONTRACT,
  EXPEDITION_CONTRACTS,
  getExpeditionContract,
  isExpeditionContractId,
} from './expeditionContracts';

describe('expeditionContracts', () => {
  it('includes Steady, Swift, and Laden with distinct tradeoffs', () => {
    expect(EXPEDITION_CONTRACTS.map((c) => c.id)).toEqual(['steady', 'swift', 'laden']);
    const steady = getExpeditionContract('steady');
    const swift = getExpeditionContract('swift');
    const laden = getExpeditionContract('laden');
    expect(swift.durationMult).toBeLessThan(steady.durationMult);
    expect(swift.lootMult).toBeLessThan(steady.lootMult);
    expect(laden.lootMult).toBeGreaterThan(steady.lootMult);
    expect(laden.durationMult).toBeGreaterThan(steady.durationMult);
    expect(DEFAULT_EXPEDITION_CONTRACT).toBe('steady');
  });

  it('type-guards contract ids', () => {
    expect(isExpeditionContractId('swift')).toBe(true);
    expect(isExpeditionContractId('rush')).toBe(false);
  });
});
