import { describe, expect, it } from 'vitest';
import { createInitialState } from './createState';
import {
  claimExpedition,
  clickVein,
  craftRecipe,
  simulateSeconds,
  startExpedition,
  unlockStation,
  upgradeStation,
} from './economy';
import { nextGoal } from '../ui/goals';
import { formatRecipeEffects, formatStationIO } from '../ui/effectsText';
import { getRecipe } from '../data/recipes';
import { getStation } from '../data/stations';

describe('progression walkthrough (sim)', () => {
  it('walks gather → craft → smelter → expedition claim', () => {
    let state = createInitialState(1_000_000);

    // Gather enough for copper pick
    for (let i = 0; i < 20; i++) state = clickVein(state).state;
    expect(nextGoal(state).id).toBe('recipe:copper_pick');
    expect(nextGoal(state).ready).toBe(true);

    const pick = craftRecipe(state, 'copper_pick');
    expect(pick.ok).toBe(true);
    if (!pick.ok) return;
    state = pick.state;
    expect(formatRecipeEffects(getRecipe('copper_pick'))).toContain('Tap power');

    // Fund and unlock smelter
    state.resources.ore = 200;
    const smelter = unlockStation(state, 'smelter');
    expect(smelter.ok).toBe(true);
    if (!smelter.ok) return;
    state = smelter.state;
    expect(state.stations.smelter.unlocked).toBe(true);
    expect(formatStationIO(getStation('smelter'), 1)).toMatch(/Ore.*Glass|Glass.*Ore/);

    // Smelter produces while fueled
    state.resources.ore = 50;
    const before = state.resources.emberglass;
    state = simulateSeconds(state, 5, 1_000_000 + 5_000).state;
    expect(state.resources.emberglass).toBeGreaterThan(before);

    state.resources.ore = 500; // fund upgrade after production spent ore
    const up = upgradeStation(state, 'smelter');
    expect(up.ok).toBe(true);
    if (up.ok) expect(up.state.stations.smelter.level).toBe(2);

    // Expedition unlock + claim
    state = up.ok ? up.state : state;
    state.totalOreProduced = 80;
    state.resources.ore = 40;
    const now = 2_000_000;
    const started = startExpedition(state, 'glow_shalllows', now);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    state = started.state;
    const done = simulateSeconds(state, 50, now + 50_000, () => 0.99).state;
    expect(done.pendingLoot).not.toBeNull();
    const claimed = claimExpedition(done, false);
    expect(claimed.ok).toBe(true);
    if (claimed.ok) {
      expect(claimed.state.milestones.firstExpeditionClaimed).toBe(true);
      expect(claimed.state.resources.glowdust).toBeGreaterThan(0);
    }
  });
});
