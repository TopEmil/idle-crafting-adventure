import type { Sprite } from 'pixi.js';
import type { StationId } from '../data/stations';

/** Normalized position inside a background texture (0..1). */
export interface UvPoint {
  x: number;
  y: number;
}

/**
 * Focal points painted into the art — used both for cover framing
 * and for converting UV → screen so props track the image when cropped.
 */
/** Center of the timber-framed dig shaft painted into mine-cavern-bg. */
export const MINE_FOCUS: UvPoint = { x: 0.5, y: 0.48 };
export const MINE_VEIN_UV: UvPoint = { x: 0.5, y: 0.5 };

export const FORGE_FOCUS: UvPoint = { x: 0.5, y: 0.56 };
/** Pedestal anchors across the forge hall — six stations in two bands. */
export const FORGE_STATION_UV: Record<StationId, UvPoint> = {
  smelter: { x: 0.14, y: 0.5 },
  anvil: { x: 0.32, y: 0.54 },
  enchanter: { x: 0.5, y: 0.5 },
  crucible: { x: 0.68, y: 0.54 },
  gemcutter: { x: 0.86, y: 0.5 },
  aetherforge: { x: 0.5, y: 0.72 },
};

export interface PlaySafeInsets {
  /** Fraction of canvas height reserved for top chrome (brand/resources). */
  top: number;
  /** Fraction of canvas height reserved for bottom dock. */
  bottom: number;
}

/** Estimate HUD chrome from aspect — portrait docks eat more vertical space. */
export function playSafeInsets(width: number, height: number): PlaySafeInsets {
  const portrait = height > width * 1.05;
  const narrow = width < 520;
  if (portrait || narrow) {
    return { top: 0.12, bottom: 0.34 };
  }
  if (width < 900) {
    return { top: 0.1, bottom: 0.28 };
  }
  return { top: 0.09, bottom: 0.24 };
}

export function playBandCenterY(insets: PlaySafeInsets): number {
  return insets.top + (1 - insets.top - insets.bottom) * 0.55;
}

/**
 * Cover-fit a background so `focusUv` lands on `targetScreen` (canvas fractions).
 * Keeps key art (vein / pedestals) inside the playable band across aspect ratios.
 */
export function layoutFocusedCover(
  sprite: Sprite,
  canvasW: number,
  canvasH: number,
  focusUv: UvPoint,
  targetScreen: UvPoint,
  zoom = 1,
): void {
  const tex = sprite.texture;
  const cover = Math.max(canvasW / tex.width, canvasH / tex.height) * zoom;
  applySpriteTransform(sprite, canvasW, canvasH, cover, focusUv, targetScreen);
}

/** Pick a scale that cover-fits the canvas but keeps station pedestals on-screen. */
export function forgeHallScale(
  texW: number,
  texH: number,
  canvasW: number,
  canvasH: number,
  stationUvs: UvPoint[],
  baseZoom = 1,
): number {
  const cover = Math.max(canvasW / texW, canvasH / texH);
  const margin = Math.min(36, canvasW * 0.06);
  const xs = stationUvs.map((uv) => uv.x * texW);
  const span = Math.max(1, Math.max(...xs) - Math.min(...xs));
  const maxScaleForStations = (canvasW - margin * 2) / span;
  return Math.min(cover * baseZoom, maxScaleForStations);
}

/**
 * Frame the forge hall so every station UV stays inside the horizontal safe margins.
 * Portrait phones otherwise crop the side pedestals away.
 */
export function layoutForgeHall(
  sprite: Sprite,
  canvasW: number,
  canvasH: number,
  focusUv: UvPoint,
  targetScreen: UvPoint,
  stationUvs: UvPoint[],
  baseZoom = 1,
): void {
  const tex = sprite.texture;
  const scale = forgeHallScale(tex.width, tex.height, canvasW, canvasH, stationUvs, baseZoom);
  applySpriteTransform(sprite, canvasW, canvasH, scale, focusUv, targetScreen);
}

function applySpriteTransform(
  sprite: Sprite,
  canvasW: number,
  canvasH: number,
  scale: number,
  focusUv: UvPoint,
  targetScreen: UvPoint,
): void {
  const tex = sprite.texture;
  sprite.scale.set(scale);

  const focusX = focusUv.x * tex.width * scale;
  const focusY = focusUv.y * tex.height * scale;
  sprite.x = targetScreen.x * canvasW - focusX;
  sprite.y = targetScreen.y * canvasH - focusY;

  const drawW = tex.width * scale;
  const drawH = tex.height * scale;
  if (drawW >= canvasW) {
    sprite.x = clamp(sprite.x, canvasW - drawW, 0);
  } else {
    sprite.x = (canvasW - drawW) / 2;
  }
  if (drawH >= canvasH) {
    sprite.y = clamp(sprite.y, canvasH - drawH, 0);
  } else {
    sprite.y = (canvasH - drawH) / 2;
  }
}

/** Map a texture UV through the current sprite transform into canvas pixels. */
export function uvToScreen(sprite: Sprite, uv: UvPoint): { x: number; y: number } {
  return {
    x: sprite.x + uv.x * sprite.texture.width * sprite.scale.x,
    y: sprite.y + uv.y * sprite.texture.height * sprite.scale.y,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
