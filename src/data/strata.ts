/** Vertical mine strata — deeper rows unlock richer stone and labels. */

import type { ResourceId } from './resources';

export type StratumId =
  | 'glow_shallows'
  | 'moss_gallery'
  | 'crystal_fault'
  | 'slag_vents'
  | 'ember_rift'
  | 'frost_seam'
  | 'abyss_vein'
  | 'deep_dark'
  | 'starfall_hollow'
  | 'aether_core';

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
  /** Flavor grant the first time this stratum is reached in a run. */
  discoveryBonus?: Partial<Record<ResourceId, number>>;
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
    id: 'moss_gallery',
    name: 'Moss Gallery',
    startDepth: 6,
    hardness: 2,
    tint: 0x354a3e,
    fleck: 0x6bbf59,
    wall: 0x142820,
    discoveryBonus: { glowdust: 4, verdiglass: 1 },
  },
  {
    id: 'crystal_fault',
    name: 'Crystal Fault',
    startDepth: 12,
    hardness: 3,
    tint: 0x3d5568,
    fleck: 0x7ec8e3,
    wall: 0x152a38,
    discoveryBonus: { emberglass: 3 },
  },
  {
    id: 'slag_vents',
    name: 'Slag Vents',
    startDepth: 20,
    hardness: 3,
    tint: 0x4a4038,
    fleck: 0xc45c26,
    wall: 0x1a1410,
    discoveryBonus: { emberglass: 6, ore: 20 },
  },
  {
    id: 'ember_rift',
    name: 'Ember Rift',
    startDepth: 30,
    hardness: 4,
    tint: 0x4a3a36,
    fleck: 0xe85d04,
    wall: 0x1c1814,
    discoveryBonus: { alloy: 2 },
  },
  {
    id: 'frost_seam',
    name: 'Frost Seam',
    startDepth: 42,
    hardness: 4,
    tint: 0x3a4858,
    fleck: 0xa8d4e8,
    wall: 0x121820,
    discoveryBonus: { glowdust: 12, verdiglass: 4 },
  },
  {
    id: 'abyss_vein',
    name: 'Abyss Vein',
    startDepth: 55,
    hardness: 5,
    tint: 0x2a3348,
    fleck: 0x9b87f5,
    wall: 0x0c1018,
    discoveryBonus: { nightiron: 2 },
  },
  {
    id: 'deep_dark',
    name: 'Deep Dark',
    startDepth: 90,
    hardness: 6,
    tint: 0x243038,
    fleck: 0xf48c06,
    wall: 0x080e12,
    discoveryBonus: { starshard: 2, nightiron: 3 },
  },
  {
    id: 'starfall_hollow',
    name: 'Starfall Hollow',
    startDepth: 120,
    hardness: 7,
    tint: 0x2e3040,
    fleck: 0xe8d5a3,
    wall: 0x0a0c14,
    discoveryBonus: { starshard: 5, alloy: 10 },
  },
  {
    id: 'aether_core',
    name: 'Aether Core',
    startDepth: 175,
    hardness: 8,
    tint: 0x2a4048,
    fleck: 0x9ed8e0,
    wall: 0x081418,
    discoveryBonus: { aetherite: 2, starshard: 4 },
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
  return 1 + Math.min(0.45, depth * 0.0035);
}
