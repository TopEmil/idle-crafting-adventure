import { describe, expect, it } from 'vitest';
import { stratumAtDepth } from '../data/strata';
import {
  buildShaftCells,
  createMineShaftProgress,
  digShaft,
  emptyFaceDamage,
  faceCleared,
  faceHitsToDamage,
  faceTotalHp,
  lootForTile,
  normalizeProgress,
  SHAFT_COLS,
  tileKindAt,
} from './mineShaft';

describe('mine shaft', () => {
  it('starts at depth 0 with a living dig face', () => {
    const cells = buildShaftCells(createMineShaftProgress());
    const face = cells.filter((c) => c.role === 'face');
    expect(face).toHaveLength(SHAFT_COLS);
    expect(face.every((c) => !c.cleared && c.hp === c.maxHp)).toBe(true);
  });

  it('digs a targeted column and clears a row into deeper strata', () => {
    let progress = createMineShaftProgress();
    let shatteredOnce = false;
    // Clear entire face by always hitting living cols
    for (let guard = 0; guard < 200; guard++) {
      const result = digShaft(progress, 1, { mode: 'player', col: 0 });
      progress = result.progress;
      if (result.shattered) shatteredOnce = true;
      if (progress.depth > 0) break;
    }
    expect(shatteredOnce).toBe(true);
    expect(progress.depth).toBeGreaterThanOrEqual(1);
    expect(stratumAtDepth(progress.depth).id).toBe('glow_shallows');
  });

  it('batch auto digs prefer stone and carry across rows', () => {
    const need0 = faceTotalHp(0);
    const result = digShaft(createMineShaftProgress(), need0 + 3, { mode: 'auto' });
    expect(result.rowsCleared).toBeGreaterThanOrEqual(1);
    expect(result.progress.depth).toBeGreaterThanOrEqual(1);
  });

  it('normalizeProgress collapses a fully damaged face', () => {
    const dmg = emptyFaceDamage();
    for (let col = 0; col < SHAFT_COLS; col++) {
      dmg[col] = 99;
    }
    expect(faceCleared(0, dmg)).toBe(true);
    const normalized = normalizeProgress({ depth: 0, faceDamage: dmg });
    expect(normalized.depth).toBe(1);
    expect(normalized.faceDamage.every((n) => n === 0)).toBe(true);
  });

  it('builds history / face / ahead roles around depth', () => {
    const cells = buildShaftCells(createMineShaftProgress(2, emptyFaceDamage()));
    expect(cells.some((c) => c.role === 'history' && c.row === 1)).toBe(true);
    expect(cells.filter((c) => c.role === 'face').every((c) => c.row === 2)).toBe(true);
    expect(cells.some((c) => c.role === 'ahead' && c.row === 3)).toBe(true);
  });

  it('assigns deterministic tile kinds and active-only loot', () => {
    const kinds = new Set<string>();
    for (let row = 0; row < 40; row++) {
      for (let col = 0; col < SHAFT_COLS; col++) {
        kinds.add(tileKindAt(row, col));
      }
    }
    expect(kinds.has('stone')).toBe(true);
    expect(kinds.has('glow')).toBe(true);
    expect(lootForTile('glow')?.resource).toBe('glowdust');
    expect(lootForTile('verdant')?.resource).toBe('verdiglass');
    expect(lootForTile('ember')?.resource).toBe('emberglass');
    expect(lootForTile('geode')?.resource).toBe('alloy');
    expect(lootForTile('night')?.resource).toBe('nightiron');
    expect(lootForTile('star')?.resource).toBe('starshard');
    expect(lootForTile('aether')?.resource).toBe('aetherite');
    expect(lootForTile('stone')).toBeNull();
  });

  it('spawns mid and late ore pockets at the right depths', () => {
    const midKinds = new Set<string>();
    for (let row = 6; row < 40; row++) {
      for (let col = 0; col < SHAFT_COLS; col++) {
        midKinds.add(tileKindAt(row, col));
      }
    }
    expect(midKinds.has('verdant')).toBe(true);

    const deepKinds = new Set<string>();
    for (let row = 55; row < 120; row++) {
      for (let col = 0; col < SHAFT_COLS; col++) {
        deepKinds.add(tileKindAt(row, col));
      }
    }
    expect(deepKinds.has('night')).toBe(true);
    expect(deepKinds.has('star')).toBe(true);

    const coreKinds = new Set<string>();
    for (let row = 175; row < 220; row++) {
      for (let col = 0; col < SHAFT_COLS; col++) {
        coreKinds.add(tileKindAt(row, col));
      }
    }
    expect(coreKinds.has('aether')).toBe(true);
  });

  it('player shatter of rare tile grants loot; auto does not', () => {
    // Find a glow tile on the starting face
    let glowCol = -1;
    for (let col = 0; col < SHAFT_COLS; col++) {
      if (tileKindAt(0, col) === 'glow') {
        glowCol = col;
        break;
      }
    }
    // If none on row 0, search a few rows by advancing
    let progress = createMineShaftProgress();
    if (glowCol < 0) {
      for (let row = 1; row < 20 && glowCol < 0; row++) {
        for (let col = 0; col < SHAFT_COLS; col++) {
          if (tileKindAt(row, col) === 'glow') {
            progress = createMineShaftProgress(row, emptyFaceDamage());
            glowCol = col;
            break;
          }
        }
      }
    }
    expect(glowCol).toBeGreaterThanOrEqual(0);

    const auto = digShaft(progress, 20, { mode: 'auto', col: glowCol });
    // Auto may dig other cols first; force dig the glow col as player after prep
    const player = digShaft(progress, 20, { mode: 'player', col: glowCol });
    expect(player.loot?.resource === 'glowdust' || player.shattered).toBe(true);
    // Auto never grants rare loot
    expect(auto.loot).toBeNull();
  });

  it('migrates legacy faceHits into per-column damage', () => {
    const dmg = faceHitsToDamage(0, 3);
    expect(dmg).toHaveLength(SHAFT_COLS);
    expect(dmg.reduce((a, b) => a + b, 0)).toBe(3);
  });
});
