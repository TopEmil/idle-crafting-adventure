/** Forge hall skins — prestige unlocks + Relic purchases. */

export type CosmeticId =
  | 'default'
  | 'ember_crest'
  | 'cyan_hearth'
  | 'abyss_crown'
  | 'verdant_mantle'
  | 'starlit_kiln';

export interface CosmeticVisuals {
  /** Primary hearth / forge-fire glow. */
  hearth: number;
  /** Mine-shaft wash tint. */
  shaft: number;
  /** Spark / highlight accent. */
  accent: number;
  /** Soft hall wash over the forge pedestals. */
  hallWash: number;
  hallAlpha: number;
  shaftAlpha: number;
}

export interface CosmeticDef {
  id: CosmeticId;
  name: string;
  blurb: string;
  /**
   * Prestige count that unlocks this skin for free (0 = never via prestige).
   * `default` is always owned.
   */
  prestigeUnlock: number;
  /** Relic cost to buy when not unlocked via prestige. 0 = not Relic-buyable. */
  relicCost: number;
  visuals: CosmeticVisuals;
}

const DEFAULT_VISUALS: CosmeticVisuals = {
  hearth: 0xe85d04,
  shaft: 0x2ec4b6,
  accent: 0xf48c06,
  hallWash: 0xe85d04,
  hallAlpha: 0.04,
  shaftAlpha: 0.045,
};

export const COSMETICS: CosmeticDef[] = [
  {
    id: 'default',
    name: 'Plain Hearth',
    blurb: 'The forge as you found it — ember orange and cyan vein-light.',
    prestigeUnlock: 0,
    relicCost: 0,
    visuals: DEFAULT_VISUALS,
  },
  {
    id: 'ember_crest',
    name: 'Ember Crest',
    blurb: 'First Reforge marks the hall with a hotter crest of flame.',
    prestigeUnlock: 1,
    relicCost: 0,
    visuals: {
      hearth: 0xe85d04,
      shaft: 0xf48c06,
      accent: 0xffb347,
      hallWash: 0xe85d04,
      hallAlpha: 0.1,
      shaftAlpha: 0.09,
    },
  },
  {
    id: 'cyan_hearth',
    name: 'Cyan Hearth',
    blurb: 'Vein-light floods the kiln — cool mineral fire.',
    prestigeUnlock: 2,
    relicCost: 0,
    visuals: {
      hearth: 0x2ec4b6,
      shaft: 0x2ec4b6,
      accent: 0x7ec8e3,
      hallWash: 0x2ec4b6,
      hallAlpha: 0.11,
      shaftAlpha: 0.1,
    },
  },
  {
    id: 'abyss_crown',
    name: 'Abyss Crown',
    blurb: 'Deep-dark amber crowns the forge after three Reforges.',
    prestigeUnlock: 3,
    relicCost: 0,
    visuals: {
      hearth: 0xf48c06,
      shaft: 0x7b8cde,
      accent: 0xe85d04,
      hallWash: 0x7b8cde,
      hallAlpha: 0.12,
      shaftAlpha: 0.1,
    },
  },
  {
    id: 'verdant_mantle',
    name: 'Verdant Mantle',
    blurb: 'Moss-gallery green drapes the hall pedestals. Spend Relics to claim it.',
    prestigeUnlock: 0,
    relicCost: 4,
    visuals: {
      hearth: 0x6bbf59,
      shaft: 0x6bbf59,
      accent: 0xa8e06c,
      hallWash: 0x6bbf59,
      hallAlpha: 0.11,
      shaftAlpha: 0.09,
    },
  },
  {
    id: 'starlit_kiln',
    name: 'Starlit Kiln',
    blurb: 'Starfall hush on the forge — a late Relic sink for hall vanity.',
    prestigeUnlock: 0,
    relicCost: 8,
    visuals: {
      hearth: 0xc9b6ff,
      shaft: 0x7b8cde,
      accent: 0xe8f1f2,
      hallWash: 0x9b8cff,
      hallAlpha: 0.13,
      shaftAlpha: 0.1,
    },
  },
];

const BY_ID = Object.fromEntries(COSMETICS.map((c) => [c.id, c])) as Record<
  CosmeticId,
  CosmeticDef
>;

export function getCosmetic(id: string): CosmeticDef {
  return BY_ID[id as CosmeticId] ?? BY_ID.default;
}

export function isCosmeticId(id: string): id is CosmeticId {
  return id in BY_ID;
}

/** Prestige skins unlocked once the player reaches this prestige count. */
export function cosmeticsForPrestigeCount(prestigeCount: number): CosmeticId[] {
  return COSMETICS.filter(
    (c) => c.prestigeUnlock > 0 && prestigeCount >= c.prestigeUnlock,
  ).map((c) => c.id);
}

/** Skin granted specifically by completing this prestige (1-based count after Reforge). */
export function cosmeticGrantedByPrestige(prestigeCount: number): CosmeticId | null {
  const match = COSMETICS.find((c) => c.prestigeUnlock === prestigeCount);
  return match?.id ?? null;
}

export function cosmeticVisuals(id: string): CosmeticVisuals {
  return getCosmetic(id).visuals;
}
