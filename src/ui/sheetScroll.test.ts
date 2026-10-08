import { describe, expect, it } from 'vitest';
import { sheetScrollAfterRebuild } from './sheetScroll';

describe('sheetScrollAfterRebuild', () => {
  it('keeps scroll when rebuilding the same panel', () => {
    expect(sheetScrollAfterRebuild('talents', 'talents', 240)).toBe(240);
  });

  it('resets scroll when switching panels', () => {
    expect(sheetScrollAfterRebuild('recipes', 'talents', 240)).toBe(0);
  });

  it('resets scroll on first open', () => {
    expect(sheetScrollAfterRebuild(null, 'talents', 0)).toBe(0);
  });
});
