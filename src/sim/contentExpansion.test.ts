import { describe, expect, it } from 'vitest';
import { EXPEDITIONS } from '../data/expeditions';
import { RECIPES } from '../data/recipes';
import { RESOURCES } from '../data/resources';
import { STATIONS } from '../data/stations';
import { STRATA } from '../data/strata';
import { TALENTS } from '../data/talents';
import { createInitialState } from './createState';
import {
  applyStratumDiscoveries,
  clickVein,
  startExpedition,
  tickProduction,
  unlockStation,
} from './economy';
import { digShaft, pickAutoCol, pickLivingFaceCell, buildShaftCells } from './mineShaft';

describe('content expansion', () => {
  it('roughly doubles strata, stations, expeditions, talents, and recipes', () => {
    expect(STRATA.length).toBeGreaterThanOrEqual(10);
    expect(STATIONS.length).toBeGreaterThanOrEqual(6);
    expect(EXPEDITIONS.length).toBeGreaterThanOrEqual(10);
    expect(TALENTS.length).toBeGreaterThanOrEqual(8);
    expect(RECIPES.length).toBeGreaterThanOrEqual(28);
    expect(RESOURCES.some((r) => r.id === 'verdiglass')).toBe(true);
    expect(RESOURCES.some((r) => r.id === 'aetherite')).toBe(true);
  });

  it('tracks lastMineHitCol for dwarf follow sync', () => {
    let state = createInitialState();
    state.ownedRecipes = ['copper_pick'];
    const clicked = clickVein(state, { col: 3, mode: 'player' });
    expect(clicked.state.lastMineHitCol).toBe(3);

    state = clicked.state;
    state = tickProduction(state, 2);
    expect(state.lastMineHitCol).toBeGreaterThanOrEqual(0);
    expect(state.lastMineHitCol).toBeLessThan(8);
  });

  it('keeps visual pickLivingFaceCell aligned with auto dig column', () => {
    const progress = { depth: 0, faceDamage: [0, 0, 0, 0, 0, 0, 0, 0] };
    const col = pickAutoCol(progress.depth, progress.faceDamage);
    const cells = buildShaftCells(progress);
    const living = pickLivingFaceCell(cells);
    expect(living?.col).toBe(col);
  });

  it('gates moss crawl and crucible on depth + new ore', () => {
    let state = createInitialState();
    state.totalOreProduced = 500;
    state.resources.ore = 200;
    state.resources.glowdust = 40;
    state.stations.anvil.unlocked = true;
    state.stations.anvil.level = 1;
    state.stations.anvil.runLevel = 1;

    const blocked = startExpedition(state, 'moss_crawl', 1_000);
    expect(blocked.ok).toBe(false);

    state.mineDepth = 6;
    state.discoveredStrata = ['glow_shallows', 'moss_gallery'];
    const opened = startExpedition(state, 'moss_crawl', 1_000);
    expect(opened.ok).toBe(true);

    state.resources.verdiglass = 8;
    const crucibleBlocked = unlockStation(state, 'crucible');
    // depth already 6 — should unlock if funded
    expect(crucibleBlocked.ok).toBe(true);
  });

  it('grants discovery bonus once when entering a new stratum', () => {
    const state = createInitialState();
    state.mineDepth = 6;
    state.discoveredStrata = ['glow_shallows'];
    const before = state.resources.verdiglass;
    const newly = applyStratumDiscoveries(state);
    expect(newly).toContain('moss_gallery');
    expect(state.resources.verdiglass).toBeGreaterThan(before);
    const again = applyStratumDiscoveries(state);
    expect(again).toHaveLength(0);
  });

  it('auto dig advances depth without rare loot', () => {
    const result = digShaft({ depth: 0, faceDamage: [0, 0, 0, 0, 0, 0, 0, 0] }, 40, {
      mode: 'auto',
    });
    expect(result.loot).toBeNull();
    expect(result.progress.depth).toBeGreaterThan(0);
  });
});
