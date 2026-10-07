/** Vertical mine strata — deeper rows unlock richer stone and labels. */

export type StratumId =
  | 'glow_shallows'
  | 'crystal_fault'
  | 'ember_rift'
  | 'abyss_vein'
  | 'deep_dark';

export interface StratumDef {
  id: StratumId;
  name: string;
  /** First cleared-row depth where this stratum applies */
  startDepth: number;
  /** Base rock HP per cell at this depth */
  hardness: number;
  tint: number;
  fleck: number;
  wall: number;
}

export const STRATA: StratumDef[] = [
  {
    id: 'glow_shallows',
    name: 'Glow Shallows',
    startDepth: 0,
    hardness: 2,
    tint: 0x3a4a52,
    fleck: 0x2ec4b6,
    wall: 0x1a3340,
  },
  {
    id: 'crystal_fault',
    name: 'Crystal Fault',
    startDepth: 12,
    hardness: 3,
    tint: 0x3d5568,
    fleck: 0x7ec8e3,
    wall: 0x152a38,
  },
  {
    id: 'ember_rift',
    name: 'Ember Rift',
    startDepth: 30,
    hardness: 4,
    tint: 0x4a3a36,
    fleck: 0xe85d04,
    wall: 0x1c1814,
  },
  {
    id: 'abyss_vein',
    name: 'Abyss Vein',
    startDepth: 55,
    hardness: 5,
    tint: 0x2a3348,
    fleck: 0x9b87f5,
    wall: 0x0c1018,
  },
  {
    id: 'deep_dark',
    name: 'Deep Dark',
    startDepth: 90,
    hardness: 6,
    tint: 0x243038,
    fleck: 0xf48c06,
    wall: 0x080e12,
  },
];

export function stratumAtDepth(depth: number): StratumDef {
  let best = STRATA[0];
  for (const s of STRATA) {
    if (depth >= s.startDepth) best = s;
  }
  return best;
}

/** Small ore flavor from depth — caps so idle balance stays intact. */
export function depthOreMult(depth: number): number {
  return 1 + Math.min(0.35, depth * 0.004);
}
