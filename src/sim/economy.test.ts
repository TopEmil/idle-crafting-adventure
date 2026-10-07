import { describe, expect, it } from 'vitest';
import { BALANCE, relicsFromReforge, stationUpgradeCost } from '../data/balance';
import { getTalent, talentUpgradeCost } from '../data/talents';
import { createInitialState } from './createState';
import {
  adjustStationRunLevel,
  applyOfflineProgress,
  buySquadSlot,
  buyTalent,
  canPrestige,
  claimExpedition,
  clickVein,
  completeExpeditionIfReady,
  craftRecipe,
  expeditionSlotCount,
  getAutoMineRate,
  getClickPower,
  prestige,
  prestigeCooldownRemaining,
  rushExpedition,
  simulateSeconds,
  startExpedition,
  tickProduction,
  toggleStation,
  unlockStation,
  upgradeStation,
} from './economy';

describe('balance helpers', () => {
  it('grows station costs monotonically', () => {
    const a = stationUpgradeCost(40, 1.18, 0);
    const b = stationUpgradeCost(40, 1.18, 5);
    const c = stationUpgradeCost(40, 1.18, 10);
    expect(a).toBe(40);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('grows talent costs monotonically', () => {
    const def = getTalent('vein_attunement');
    const a = talentUpgradeCost(def, 0);
    const b = talentUpgradeCost(def, 3);
    const c = talentUpgradeCost(def, 8);
    expect(a).toBe(1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('grants at least one relic on reforge', () => {
    expect(relicsFromReforge(0, 0)).toBeGreaterThanOrEqual(1);
    expect(relicsFromReforge(10_000, 2)).toBeGreaterThan(relicsFromReforge(100, 0));
  });
});

describe('click & craft', () => {
  it('awards ore on vein click', () => {
    const state = createInitialState();
    const { state: next, event } = clickVein(state);
    expect(event.type).toBe('click_vein');
    expect(event.type === 'click_vein' && event.amount).toBe(getClickPower(next));
    expect(next.resources.ore).toBe(getClickPower(next));
    expect(next.totalOreProduced).toBe(next.resources.ore);
    expect(next.allTimeOre).toBe(next.resources.ore);
    expect(next.seasonOre).toBe(next.resources.ore);
    expect(next.mineFaceDamage.some((d) => d > 0)).toBe(true);
  });

  it('grants active-only find loot when a rare tile shatters', () => {
    let state = createInitialState();
    let found = false;
    for (let i = 0; i < 400; i++) {
      // Sweep columns so we eventually crack rares on the face
      const { state: next, event } = clickVein(state, { col: i % 8, mode: 'player' });
      state = next;
      if (event.type === 'click_vein' && event.find) {
        found = true;
        expect(event.find.amount).toBeGreaterThan(0);
        expect(state.resources[event.find.resource]).toBeGreaterThan(0);
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('advances mine depth when the dig face is cleared', () => {
    let state = createInitialState();
    // Enough taps to clear several rows of the shaft face
    for (let i = 0; i < 80; i++) {
      state = clickVein(state).state;
    }
    expect(state.mineDepth).toBeGreaterThan(0);
    expect(getClickPower(state)).toBeGreaterThan(BALANCE.baseClickOre);
  });

  it('crafts copper pick within early ore budget', () => {
    let state = createInitialState();
    for (let i = 0; i < 20; i++) {
      state = clickVein(state).state;
    }
    const result = craftRecipe(state, 'copper_pick');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.ownedRecipes).toContain('copper_pick');
      expect(getClickPower(result.state)).toBeGreaterThan(getClickPower(state));
    }
  });

  it('rejects craft without resources', () => {
    const result = craftRecipe(createInitialState(), 'copper_pick');
    expect(result.ok).toBe(false);
  });

  it('starts dwarf auto-mine after copper pick', () => {
    let state = createInitialState();
    expect(getAutoMineRate(state)).toBe(0);
    state.resources.ore = 20;
    const crafted = craftRecipe(state, 'copper_pick');
    expect(crafted.ok).toBe(true);
    if (!crafted.ok) return;
    state = crafted.state;
    const rate = getAutoMineRate(state);
    expect(rate).toBeCloseTo(getClickPower(state) * 0.25);
    const before = state.resources.ore;
    state = tickProduction(state, 2);
    expect(state.resources.ore).toBeGreaterThan(before);
    expect(state.totalOreProduced).toBeGreaterThan(0);
  });
});

describe('stations', () => {
  it('unlocks smelter and produces emberglass', () => {
    let state = createInitialState();
    state.resources.ore = 100;
    const unlocked = unlockStation(state, 'smelter');
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;
    state = unlocked.state;
    state.resources.ore = 50;
    state = tickProduction(state, 2);
    expect(state.resources.emberglass).toBeGreaterThan(0);
    expect(state.resources.ore).toBeLessThan(50);
  });

  it('upgrades increase level', () => {
    const state = createInitialState();
    state.stations.smelter = { unlocked: true, level: 1, runLevel: 1, enabled: true };
    state.resources.ore = 10_000;
    const up = upgradeStation(state, 'smelter');
    expect(up.ok).toBe(true);
    if (up.ok) {
      expect(up.state.stations.smelter.level).toBe(2);
      expect(up.state.stations.smelter.runLevel).toBe(2);
    }
  });

  it('keeps throttled runLevel when upgrading', () => {
    const state = createInitialState();
    state.stations.smelter = { unlocked: true, level: 3, runLevel: 1, enabled: true };
    state.resources.ore = 10_000;
    const up = upgradeStation(state, 'smelter');
    expect(up.ok).toBe(true);
    if (up.ok) {
      expect(up.state.stations.smelter.level).toBe(4);
      expect(up.state.stations.smelter.runLevel).toBe(1);
    }
  });

  it('can throttle station speed below owned level', () => {
    const base = createInitialState();
    base.stations.smelter = { unlocked: true, level: 4, runLevel: 4, enabled: true };
    base.resources.ore = 100;

    const slow = adjustStationRunLevel(base, 'smelter', -3);
    expect(slow.ok).toBe(true);
    if (!slow.ok) return;
    expect(slow.state.stations.smelter.runLevel).toBe(1);
    expect(slow.state.stations.smelter.level).toBe(4);

    const fullState = structuredClone(base);
    fullState.resources.ore = 100;
    const throttledState = structuredClone(slow.state);
    throttledState.resources.ore = 100;

    const full = tickProduction(fullState, 2);
    const throttled = tickProduction(throttledState, 2);
    expect(throttled.resources.emberglass).toBeGreaterThan(0);
    expect(throttled.resources.emberglass).toBeLessThan(full.resources.emberglass);
    expect(100 - throttled.resources.ore).toBeLessThan(100 - full.resources.ore);
  });

  it('can turn stations off and on', () => {
    let state = createInitialState();
    state.resources.ore = 100;
    const unlocked = unlockStation(state, 'smelter');
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;
    state = unlocked.state;
    expect(state.stations.smelter.enabled).toBe(true);

    const off = toggleStation(state, 'smelter');
    expect(off.ok).toBe(true);
    if (!off.ok) return;
    state = off.state;
    expect(state.stations.smelter.enabled).toBe(false);

    state.resources.ore = 50;
    const paused = tickProduction(state, 2);
    expect(paused.resources.emberglass).toBe(0);
    expect(paused.resources.ore).toBe(50);

    const on = toggleStation(state, 'smelter');
    expect(on.ok).toBe(true);
    if (!on.ok) return;
    state = on.state;
    state.resources.ore = 50;
    state = tickProduction(state, 2);
    expect(state.resources.emberglass).toBeGreaterThan(0);
  });
});

describe('expeditions', () => {
  it('starts, completes, and claims loot', () => {
    let state = createInitialState();
    state.totalOreProduced = 100;
    state.resources.ore = 50;
    const now = 1_000_000;
    const started = startExpedition(state, 'glow_shalllows', now);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    state = started.state;

    const { state: after } = simulateSeconds(state, 50, now + 50_000, () => 0.99);
    expect(after.pendingLoot).not.toBeNull();
    expect(after.activeExpeditions.some((e) => e.claimed)).toBe(true);

    const claimed = claimExpedition(after, false);
    expect(claimed.ok).toBe(true);
    if (claimed.ok) {
      expect(claimed.state.pendingLoot).toBeNull();
      expect(claimed.state.activeExpeditions).toHaveLength(0);
      expect(claimed.state.milestones.firstExpeditionClaimed).toBe(true);
      expect(claimed.state.resources.glowdust).toBeGreaterThan(0);
    }
  });

  it('claims pending loot even if activeExpeditions were lost', () => {
    const state = createInitialState();
    state.pendingLoot = { glowdust: 18, ore: 12 };
    state.activeExpeditions = [];
    const claimed = claimExpedition(state, false);
    expect(claimed.ok).toBe(true);
    if (claimed.ok) {
      expect(claimed.state.pendingLoot).toBeNull();
      expect(claimed.state.resources.glowdust).toBe(18);
      expect(claimed.state.milestones.firstExpeditionClaimed).toBe(true);
    }
  });

  it('doubles loot when rewarded', () => {
    const state = createInitialState();
    state.pendingLoot = { glowdust: 10, ore: 5 };
    state.pendingLootExpeditionId = 'glow_shalllows';
    state.activeExpeditions = [
      {
        id: 'glow_shalllows',
        startedAt: 0,
        endsAt: 0,
        claimed: true,
        doublePending: true,
      },
    ];
    const single = claimExpedition(structuredClone(state), false);
    const doubled = claimExpedition(structuredClone(state), true);
    expect(single.ok && doubled.ok).toBe(true);
    if (single.ok && doubled.ok) {
      expect(doubled.state.resources.glowdust).toBe(single.state.resources.glowdust * 2);
    }
  });

  it('rushes an en-route squad to completion', () => {
    let state = createInitialState();
    state.totalOreProduced = 100;
    state.resources.ore = 50;
    const now = 1_000_000;
    const started = startExpedition(state, 'glow_shalllows', now);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    state = started.state;

    const rushed = rushExpedition(state, 'glow_shalllows', now + 5_000);
    expect(rushed.ok).toBe(true);
    if (!rushed.ok) return;
    const ready = completeExpeditionIfReady(rushed.state, now + 5_000, () => 0.99);
    expect(ready.event?.type).toBe('expedition_ready');
    expect(ready.state.pendingLoot).not.toBeNull();
  });

  it('buys an extra squad slot for Relics and allows parallel sends', () => {
    let state = createInitialState();
    state.totalOreProduced = 250;
    state.resources.ore = 200;
    state.resources.glowdust = 50;
    state.resources.relics = BALANCE.extraSquadRelicCost;
    expect(expeditionSlotCount(state)).toBe(BALANCE.baseExpeditionSlots);

    const bought = buySquadSlot(state);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    state = bought.state;
    expect(state.extraSquadSlots).toBe(1);
    expect(state.resources.relics).toBe(0);
    expect(expeditionSlotCount(state)).toBe(BALANCE.baseExpeditionSlots + 1);

    const now = 2_000_000;
    const first = startExpedition(state, 'glow_shalllows', now);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.state;
    const second = startExpedition(state, 'crystal_fault', now);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.state.activeExpeditions).toHaveLength(2);
    }
  });

  it('keeps bought squad slots across Reforge', () => {
    const state = createInitialState(1_000_000);
    state.lifetimeOre = 2000;
    state.extraSquadSlots = 2;
    state.resources.relics = 1;
    const result = prestige(state, 1_000_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.extraSquadSlots).toBe(2);
    expect(expeditionSlotCount(result.state)).toBe(BALANCE.baseExpeditionSlots + 2);
  });
});

describe('offline & prestige', () => {
  it('caps offline progress', () => {
    const state = createInitialState(0);
    state.stations.smelter = { unlocked: true, level: 3, runLevel: 3, enabled: true };
    state.resources.ore = 10_000;
    state.lastTickAt = 0;
    const farFuture = BALANCE.offlineCapSeconds * 1000 * 3;
    const { event } = applyOfflineProgress(state, farFuture);
    expect(event).not.toBeNull();
    if (event && event.type === 'offline_summary') {
      expect(event.seconds).toBeLessThanOrEqual(BALANCE.offlineCapSeconds);
    }
  });

  it('prestige resets production but keeps talents, relics, and ore ranks', () => {
    const state = createInitialState(1_000_000);
    state.lifetimeOre = 2000;
    state.allTimeOre = 5000;
    state.seasonOre = 800;
    state.seasonStartedAt = 42;
    state.resources.ore = 500;
    state.resources.relics = 3;
    state.talents.vein_attunement = 2;
    state.stations.smelter = { unlocked: true, level: 4, runLevel: 4, enabled: true };
    const result = prestige(state, 1_000_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.resources.ore).toBe(0);
    expect(result.state.lifetimeOre).toBe(0);
    expect(result.state.allTimeOre).toBe(5000);
    expect(result.state.seasonOre).toBe(800);
    expect(result.state.seasonStartedAt).toBe(42);
    expect(result.state.stations.smelter.unlocked).toBe(false);
    expect(result.state.totalRelicsEarned).toBeGreaterThan(0);
    expect(result.state.resources.relics).toBeGreaterThan(3);
    expect(result.state.talents.vein_attunement).toBe(2);
    expect(result.state.lastPrestigeAt).toBe(1_000_000);
    expect(result.state.unlockedAchievements).toContain('first_reforge');
    // Talent ×2 (+20%) and First Reforge achievement (+10%).
    expect(getClickPower(result.state)).toBeCloseTo(BALANCE.baseClickOre * (1 + 0.1 * 2) * 1.1);
  });

  it('blocks prestige during 10-minute cooldown', () => {
    const now = 5_000_000;
    const state = createInitialState(now);
    state.lifetimeOre = 2000;
    state.lastPrestigeAt = now - 60_000;
    expect(canPrestige(state, now)).toBe(false);
    expect(prestigeCooldownRemaining(state, now)).toBeGreaterThan(500);
    expect(prestige(state, now).ok).toBe(false);

    const readyAt = now + BALANCE.prestigeCooldownSec * 1000;
    expect(canPrestige(state, readyAt)).toBe(true);
    expect(prestige(state, readyAt).ok).toBe(true);
  });
});

describe('talents', () => {
  it('spends relics to raise talent levels and boost click power', () => {
    let state = createInitialState();
    state.resources.relics = 5;
    const base = getClickPower(state);
    const bought = buyTalent(state, 'vein_attunement');
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    state = bought.state;
    expect(state.talents.vein_attunement).toBe(1);
    expect(state.resources.relics).toBe(4);
    expect(getClickPower(state)).toBeGreaterThan(base);
  });

  it('rejects buy when out of relics or maxed', () => {
    const poor = createInitialState();
    expect(buyTalent(poor, 'hearth_kindling').ok).toBe(false);

    const maxed = createInitialState();
    maxed.resources.relics = 9999;
    maxed.talents.deep_slumber = getTalent('deep_slumber').maxLevel;
    expect(buyTalent(maxed, 'deep_slumber').ok).toBe(false);
  });

  it('boosts station output via hearth kindling', () => {
    const state = createInitialState();
    state.stations.smelter = { unlocked: true, level: 1, runLevel: 1, enabled: true };
    state.resources.ore = 100;
    const plain = tickProduction(structuredClone(state), 1);
    state.talents.hearth_kindling = 5;
    const buffed = tickProduction(structuredClone(state), 1);
    expect(buffed.resources.emberglass).toBeGreaterThan(plain.resources.emberglass);
  });
});

describe('fixed timestep independence', () => {
  it('produces similar totals across step sizes for equal duration', () => {
    const base = createInitialState();
    base.stations.smelter = { unlocked: true, level: 2, runLevel: 2, enabled: true };
    base.resources.ore = 1_000;

    const a = simulateSeconds(structuredClone(base), 10, 10_000).state;
    let coarse = structuredClone(base);
    for (let i = 0; i < 10; i++) {
      coarse = tickProduction(coarse, 1);
    }
    expect(a.resources.emberglass).toBeCloseTo(coarse.resources.emberglass, 4);
  });
});
