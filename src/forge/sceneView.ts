export type SceneView = 'mine' | 'forge';

/**
 * Fixed forge-hall pedestal anchors (fractions of canvas).
 * Kept in the mid band so machines sit above the bottom HUD dock.
 */
export const FORGE_STATION_SLOTS = {
  smelter: { x: 0.23, y: 0.585 },
  anvil: { x: 0.5, y: 0.605 },
  enchanter: { x: 0.77, y: 0.585 },
} as const;
