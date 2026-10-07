export type SceneView = 'mine' | 'forge';

/** Fixed forge-hall pedestal anchors (fractions of canvas). */
export const FORGE_STATION_SLOTS = {
  smelter: { x: 0.22, y: 0.64 },
  anvil: { x: 0.5, y: 0.66 },
  enchanter: { x: 0.78, y: 0.64 },
} as const;
