import { describe, expect, it } from 'vitest';
import {
  FORGE_STATION_UV,
  MINE_VEIN_UV,
  forgeHallScale,
  playBandCenterY,
  playSafeInsets,
} from './layout';

describe('playSafeInsets', () => {
  it('reserves more bottom space on portrait phones', () => {
    const phone = playSafeInsets(390, 844);
    const desktop = playSafeInsets(1280, 720);
    expect(phone.bottom).toBeGreaterThan(desktop.bottom);
    expect(phone.top + phone.bottom).toBeLessThan(0.55);
  });

  it('keeps the play band centered between chrome', () => {
    const insets = playSafeInsets(1100, 720);
    const y = playBandCenterY(insets);
    expect(y).toBeGreaterThan(insets.top);
    expect(y).toBeLessThan(1 - insets.bottom);
  });
});

describe('art anchors', () => {
  it('keeps forge stations spaced across the hall', () => {
    expect(FORGE_STATION_UV.smelter.x).toBeLessThan(FORGE_STATION_UV.anvil.x);
    expect(FORGE_STATION_UV.anvil.x).toBeLessThan(FORGE_STATION_UV.enchanter.x);
    expect(FORGE_STATION_UV.enchanter.x).toBeLessThan(FORGE_STATION_UV.crucible.x);
    expect(FORGE_STATION_UV.crucible.x).toBeLessThan(FORGE_STATION_UV.gemcutter.x);
    expect(Object.keys(FORGE_STATION_UV)).toHaveLength(6);
  });

  it('places the dig face in the timber-framed shaft opening', () => {
    expect(MINE_VEIN_UV.x).toBeGreaterThan(0.4);
    expect(MINE_VEIN_UV.x).toBeLessThan(0.6);
    expect(MINE_VEIN_UV.y).toBeGreaterThan(0.4);
    expect(MINE_VEIN_UV.y).toBeLessThan(0.6);
  });
});

describe('forgeHallScale', () => {
  it('shrinks on narrow portrait so side pedestals remain in frame', () => {
    const uvs = Object.values(FORGE_STATION_UV);
    const phone = forgeHallScale(1280, 720, 390, 844, uvs, 1);
    const desktop = forgeHallScale(1280, 720, 1280, 720, uvs, 1.06);
    expect(phone).toBeLessThan(desktop);

    const span = (FORGE_STATION_UV.enchanter.x - FORGE_STATION_UV.smelter.x) * 1280;
    const drawnSpan = span * phone;
    expect(drawnSpan).toBeLessThanOrEqual(390 - 8);
  });
});
