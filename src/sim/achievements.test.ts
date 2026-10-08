import { describe, expect, it } from 'vitest';
import { createInitialState } from './createState';
import {
  clickVein,
  craftRecipe,
  getAutoMineRate,
  getClickPower,
  prestige,
  unlockStation,
  upgradeStation,
} from './economy';
import {
  claimAchievement,
  listReadyAchievements,
  nextClaimableTier,
  syncAchievements,
} from './achievements';

describe('achievements', () => {
  it('marks First Strike ready after 50 taps without auto-claiming', () => {
    let state = createInitialState();
    for (let i = 0; i < 49; i++) {
      state = clickVein(state).state;
    }
    expect(listReadyAchievements(state).map((r) => r.def.id)).not.toContain('first_strike');

    state = clickVein(state).state;
    const ready = listReadyAchievements(state);
    expect(ready.map((r) => r.def.id)).toContain('first_strike');
    expect(state.claimedAchievements.first_strike ?? 0).toBe(0);
    expect(syncAchievements(state).unlocked).toHaveLength(0);
  });

  it('grants ore only when First Strike is claimed', () => {
    let state = createInitialState();
    for (let i = 0; i < 50; i++) {
      state = clickVein(state).state;
    }
    const oreBefore = state.resources.ore;
    const claimed = claimAchievement(state, 'first_strike');
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.state.claimedAchievements.first_strike).toBe(1);
    expect(claimed.state.resources.ore).toBeGreaterThan(oreBefore);
  });

  it('applies permanent tap bonus from Vein Warmup only after claim', () => {
    let state = createInitialState();
    state.lifetimeOre = 100;
    state.totalOreProduced = 100;
    const before = getClickPower(state);
    expect(nextClaimableTier(state, 'vein_warmup')?.name).toBe('Vein Warmup');

    const claimed = claimAchievement(state, 'vein_warmup');
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(getClickPower(claimed.state)).toBeCloseTo(before * 1.05, 5);
  });

  it('adds idle dwarf power from Copper Bound after claim', () => {
    let state = createInitialState();
    for (let i = 0; i < 40; i++) state = clickVein(state).state;
    const crafted = craftRecipe(state, 'copper_pick');
    expect(crafted.ok).toBe(true);
    if (!crafted.ok) return;

    const rateBefore = getAutoMineRate(crafted.state);
    const claimed = claimAchievement(crafted.state, 'copper_bound');
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(getAutoMineRate(claimed.state)).toBeGreaterThan(rateBefore);
  });

  it('supports multi-level Smelter path: unlock → Lv3 → Lv5 → Lv10', () => {
    let state = createInitialState();
    state.resources.ore = 10_000;
    state.resources.emberglass = 5_000;

    const unlocked = unlockStation(state, 'smelter');
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;
    state = unlocked.state;

    let claim = claimAchievement(state, 'hearth_lit');
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.tier.name).toBe('Hearth Lit');
    expect(claim.state.resources.emberglass).toBeGreaterThanOrEqual(10);
    state = claim.state;
    expect(nextClaimableTier(state, 'hearth_lit')).toBeNull();

    while (state.stations.smelter.level < 3) {
      const up = upgradeStation(state, 'smelter');
      expect(up.ok).toBe(true);
      if (!up.ok) return;
      state = up.state;
    }
    claim = claimAchievement(state, 'hearth_lit');
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.tier.name).toBe('Smelter Lv 3');
    expect(claim.state.claimedAchievements.hearth_lit).toBe(2);
    state = claim.state;

    while (state.stations.smelter.level < 5) {
      const up = upgradeStation(state, 'smelter');
      expect(up.ok).toBe(true);
      if (!up.ok) return;
      state = up.state;
    }
    claim = claimAchievement(state, 'hearth_lit');
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.tier.name).toBe('Smelter Lv 5');
    state = claim.state;

    while (state.stations.smelter.level < 10) {
      const up = upgradeStation(state, 'smelter');
      expect(up.ok).toBe(true);
      if (!up.ok) return;
      state = up.state;
    }
    claim = claimAchievement(state, 'hearth_lit');
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.tier.name).toBe('Smelter Lv 10');
    expect(claim.state.claimedAchievements.hearth_lit).toBe(4);
    expect(nextClaimableTier(claim.state, 'hearth_lit')).toBeNull();
  });

  it('keeps claimed achievements and permanent bonuses across Reforge', () => {
    let state = createInitialState();
    state.lifetimeOre = 100;
    state.totalOreProduced = 100;
    state.lifetimeClicks = 50;
    const first = claimAchievement(state, 'first_strike');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.state;
    const vein = claimAchievement(state, 'vein_warmup');
    expect(vein.ok).toBe(true);
    if (!vein.ok) return;
    state = vein.state;
    expect(state.claimedAchievements.vein_warmup).toBe(1);
    expect(state.claimedAchievements.first_strike).toBe(1);

    state.stations.smelter.unlocked = true;
    state.stations.smelter.level = 1;
    state.stations.smelter.runLevel = 1;
    state.lastPrestigeAt = 0;

    const result = prestige(state, Date.now() + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.claimedAchievements.vein_warmup).toBe(1);
    expect(result.state.claimedAchievements.first_strike).toBe(1);
    // First Reforge is ready but not auto-claimed.
    expect(result.state.claimedAchievements.first_reforge ?? 0).toBe(0);
    expect(nextClaimableTier(result.state, 'first_reforge')?.name).toBe('First Reforge');
    expect(result.state.lifetimeClicks).toBe(50);
    expect(getClickPower(result.state)).toBeGreaterThan(1);

    const reforgeClaim = claimAchievement(result.state, 'first_reforge');
    expect(reforgeClaim.ok).toBe(true);
    if (!reforgeClaim.ok) return;
    expect(reforgeClaim.state.claimedAchievements.first_reforge).toBe(1);
    expect(getClickPower(reforgeClaim.state)).toBeGreaterThan(getClickPower(result.state));
  });

  it('does not grant reward twice', () => {
    let state = createInitialState();
    state.lifetimeOre = 100;
    const first = claimAchievement(state, 'vein_warmup');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.state;
    const oreAfterFirst = state.resources.ore;
    const second = claimAchievement(state, 'vein_warmup');
    expect(second.ok).toBe(false);
    expect(state.resources.ore).toBe(oreAfterFirst);
  });
});
