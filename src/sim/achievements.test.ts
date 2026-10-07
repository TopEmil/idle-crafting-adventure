import { describe, expect, it } from 'vitest';
import { createInitialState } from './createState';
import {
  clickVein,
  craftRecipe,
  getAutoMineRate,
  getClickPower,
  prestige,
  unlockStation,
} from './economy';
import { syncAchievements } from './achievements';

describe('achievements', () => {
  it('grants ore for First Strike after 50 taps', () => {
    let state = createInitialState();
    for (let i = 0; i < 49; i++) {
      state = clickVein(state).state;
    }
    let synced = syncAchievements(state);
    expect(synced.unlocked.map((a) => a.id)).not.toContain('first_strike');

    state = clickVein(synced.state).state;
    synced = syncAchievements(state);
    expect(synced.unlocked.map((a) => a.id)).toContain('first_strike');
    expect(synced.state.unlockedAchievements).toContain('first_strike');
    expect(synced.state.resources.ore).toBeGreaterThan(state.resources.ore);
  });

  it('applies permanent tap bonus from Vein Warmup', () => {
    let state = createInitialState();
    state.lifetimeOre = 100;
    state.totalOreProduced = 100;
    const before = getClickPower(state);
    const synced = syncAchievements(state);
    expect(synced.unlocked.map((a) => a.id)).toContain('vein_warmup');
    expect(getClickPower(synced.state)).toBeCloseTo(before * 1.05, 5);
  });

  it('adds idle dwarf power from Copper Bound', () => {
    let state = createInitialState();
    for (let i = 0; i < 20; i++) state = clickVein(state).state;
    const crafted = craftRecipe(state, 'copper_pick');
    expect(crafted.ok).toBe(true);
    if (!crafted.ok) return;

    const rateBeforeSync = getAutoMineRate(crafted.state);
    const synced = syncAchievements(crafted.state);
    expect(synced.unlocked.map((a) => a.id)).toContain('copper_bound');
    expect(getAutoMineRate(synced.state)).toBeGreaterThan(rateBeforeSync);
  });

  it('grants station unlock rewards for Hearth Lit', () => {
    let state = createInitialState();
    state.resources.ore = 25;
    const unlocked = unlockStation(state, 'smelter');
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;

    const synced = syncAchievements(unlocked.state);
    expect(synced.unlocked.map((a) => a.id)).toContain('hearth_lit');
    expect(synced.state.resources.emberglass).toBeGreaterThanOrEqual(10);
  });

  it('keeps unlocked achievements and permanent bonuses across Reforge', () => {
    let state = createInitialState();
    state.lifetimeOre = 100;
    state.totalOreProduced = 100;
    state.lifetimeClicks = 50;
    state = syncAchievements(state).state;
    expect(state.unlockedAchievements).toContain('vein_warmup');
    expect(state.unlockedAchievements).toContain('first_strike');

    state.stations.smelter.unlocked = true;
    state.stations.smelter.level = 1;
    state.stations.smelter.runLevel = 1;
    state.lastPrestigeAt = 0;

    const result = prestige(state, Date.now() + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.unlockedAchievements).toContain('vein_warmup');
    expect(result.state.unlockedAchievements).toContain('first_strike');
    expect(result.state.unlockedAchievements).toContain('first_reforge');
    expect(result.state.lifetimeClicks).toBe(50);
    expect(getClickPower(result.state)).toBeGreaterThan(1);
  });

  it('does not grant reward twice', () => {
    let state = createInitialState();
    state.lifetimeOre = 100;
    state = syncAchievements(state).state;
    const oreAfterFirst = state.resources.ore;
    const second = syncAchievements(state);
    expect(second.unlocked).toHaveLength(0);
    expect(second.state.resources.ore).toBe(oreAfterFirst);
  });
});
