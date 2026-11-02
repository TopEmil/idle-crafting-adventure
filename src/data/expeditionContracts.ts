/** Send-time route stances — trade duration / cost / loot without new destinations. */

export type ExpeditionContractId = 'steady' | 'swift' | 'laden';

export interface ExpeditionContractDef {
  id: ExpeditionContractId;
  name: string;
  /** One-line tradeoff shown in the Expeditions sheet. */
  blurb: string;
  durationMult: number;
  costMult: number;
  lootMult: number;
  /** Added to the destination bonusChance, then clamped 0..1. */
  bonusChanceDelta: number;
}

export const EXPEDITION_CONTRACTS: ExpeditionContractDef[] = [
  {
    id: 'steady',
    name: 'Steady',
    blurb: 'Balanced run — standard cost, time, and haul.',
    durationMult: 1,
    costMult: 1,
    lootMult: 1,
    bonusChanceDelta: 0,
  },
  {
    id: 'swift',
    name: 'Swift',
    blurb: 'Faster return, slightly leaner haul, a bit more cost.',
    durationMult: 0.65,
    costMult: 1.15,
    lootMult: 0.85,
    bonusChanceDelta: -0.05,
  },
  {
    id: 'laden',
    name: 'Laden',
    blurb: 'Heavier packs — slower and pricier, richer loot.',
    durationMult: 1.35,
    costMult: 1.25,
    lootMult: 1.35,
    bonusChanceDelta: 0.1,
  },
];

export const DEFAULT_EXPEDITION_CONTRACT: ExpeditionContractId = 'steady';

export function getExpeditionContract(id: ExpeditionContractId): ExpeditionContractDef {
  const def = EXPEDITION_CONTRACTS.find((c) => c.id === id);
  if (!def) {
    throw new Error(`Unknown expedition contract: ${id}`);
  }
  return def;
}

export function isExpeditionContractId(value: unknown): value is ExpeditionContractId {
  return value === 'steady' || value === 'swift' || value === 'laden';
}
