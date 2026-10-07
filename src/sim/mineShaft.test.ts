import { describe, expect, it } from 'vitest';
import { stratumAtDepth } from '../data/strata';
import {
  buildShaftCells,
  createMineShaftProgress,
  digShaft,
  faceTotalHp,
  normalizeProgress,
  SHAFT_COLS,
} from './mineShaft';

describe('mine shaft', () => {
  it('starts at depth 0 with a living dig face', () => {
    const cells = buildShaftCells(createMineShaftProgress());
    const face = cells.filter((c) => c.role === 'face');
    expect(face).toHaveLength(SHAFT_COLS);
    expect(face.every((c) => !c.cleared && c.hp === c.maxHp)).toBe(true);
  });

  it('digs left-to-right and clears a row into deeper strata', () => {
    let progress = createMineShaftProgress();
    const need = faceTotalHp(0);
    let shatteredOnce = false;
    for (let i = 0; i < need; i++) {
      const result = digShaft(progress, 1);
      progress = result.progress;
      if (result.shattered) shatteredOnce = true;
    }
    expect(shatteredOnce).toBe(true);
    expect(progress.depth).toBe(1);
    expect(progress.faceHits).toBe(0);
    expect(stratumAtDepth(progress.depth).id).toBe('glow_shallows');
  });

  it('batch digs carry overflow across multiple rows', () => {
    const need0 = faceTotalHp(0);
    const need1 = faceTotalHp(1);
    const result = digShaft(createMineShaftProgress(), need0 + need1 + 3);
    expect(result.rowsCleared).toBe(2);
    expect(result.progress.depth).toBe(2);
    expect(result.progress.faceHits).toBe(3);
  });

  it('normalizeProgress collapses overfilled faces', () => {
    const need = faceTotalHp(0);
    const normalized = normalizeProgress({ depth: 0, faceHits: need + 2 });
    expect(normalized.depth).toBe(1);
    expect(normalized.faceHits).toBe(2);
  });

  it('builds history / face / ahead roles around depth', () => {
    const cells = buildShaftCells(createMineShaftProgress(2, 0));
    expect(cells.some((c) => c.role === 'history' && c.row === 1)).toBe(true);
    expect(cells.filter((c) => c.role === 'face').every((c) => c.row === 2)).toBe(true);
    expect(cells.some((c) => c.role === 'ahead' && c.row === 3)).toBe(true);
  });

  it('face damage marks left cells cleared first', () => {
    const cells = buildShaftCells(createMineShaftProgress(0, 3));
    const face = cells.filter((c) => c.role === 'face').sort((a, b) => a.col - b.col);
    expect(face[0]!.cleared || face[0]!.hp < face[0]!.maxHp).toBe(true);
  });
});
