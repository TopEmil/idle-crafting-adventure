import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { createInitialState } from './createState';
import {
  buyCosmetic,
  equipCosmetic,
  prestige,
} from './economy';
import { deserializeState, migrateState, serializeState } from './save';

function readyForPrestige(now = 1_000_000) {
  const state = createInitialState(now);
  state.lifetimeOre = BALANCE.prestigeMinLifetimeOre;
  state.playTimeSec = BALANCE.prestigeMinPlaySec;
  state.stations.smelter = { unlocked: true, level: 1, runLevel: 1, enabled: true };
  return state;
}

describe('forge cosmetics', () => {
  it('unlocks and auto-equips prestige skins until the player picks manually', () => {
    let state = readyForPrestige();
    const first = prestige(state, 1_000_000);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.unlockedCosmetics).toContain('ember_crest');
    expect(first.state.activeCosmetic).toBe('ember_crest');
    expect(first.state.cosmeticPicked).toBe(false);

    state = first.state;
    state.lifetimeOre = BALANCE.prestigeMinLifetimeOre;
    state.playTimeSec = BALANCE.prestigeMinPlaySec;
    state.stations.smelter = { unlocked: true, level: 1, runLevel: 1, enabled: true };
    const secondAt = 1_000_000 + BALANCE.prestigeCooldownSec * 1000;
    const second = prestige(state, secondAt);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.unlockedCosmetics).toEqual(
      expect.arrayContaining(['default', 'ember_crest', 'cyan_hearth']),
    );
    expect(second.state.activeCosmetic).toBe('cyan_hearth');
  });

  it('keeps a manually equipped skin across Reforge', () => {
    let state = readyForPrestige();
    const first = prestige(state, 1_000_000);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const equipped = equipCosmetic(first.state, 'ember_crest');
    expect(equipped.ok).toBe(true);
    if (!equipped.ok) return;
    expect(equipped.state.cosmeticPicked).toBe(true);

    state = equipped.state;
    state.lifetimeOre = BALANCE.prestigeMinLifetimeOre;
    state.playTimeSec = BALANCE.prestigeMinPlaySec;
    state.stations.smelter = { unlocked: true, level: 1, runLevel: 1, enabled: true };
    const secondAt = 1_000_000 + BALANCE.prestigeCooldownSec * 1000;
    const second = prestige(state, secondAt);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.unlockedCosmetics).toContain('cyan_hearth');
    expect(second.state.activeCosmetic).toBe('ember_crest');
    expect(second.state.cosmeticPicked).toBe(true);
  });

  it('buys Relic skins and equips them', () => {
    const state = createInitialState();
    state.resources.relics = 4;
    const bought = buyCosmetic(state, 'verdant_mantle');
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.state.resources.relics).toBe(0);
    expect(bought.state.unlockedCosmetics).toContain('verdant_mantle');
    expect(bought.state.activeCosmetic).toBe('verdant_mantle');
    expect(bought.state.cosmeticPicked).toBe(true);

    const again = buyCosmetic(bought.state, 'verdant_mantle');
    expect(again.ok).toBe(false);

    const prestigeOnly = buyCosmetic(createInitialState(), 'ember_crest');
    expect(prestigeOnly.ok).toBe(false);
  });

  it('blocks equipping locked skins and no-ops already equipped picks', () => {
    const state = createInitialState();
    expect(equipCosmetic(state, 'abyss_crown').ok).toBe(false);

    const equipped = equipCosmetic(state, 'default');
    expect(equipped.ok).toBe(true);
    if (!equipped.ok) return;
    expect(equipCosmetic(equipped.state, 'default').ok).toBe(false);
  });

  it('migrates legacy cosmetics and backfills prestige unlocks', () => {
    const raw = createInitialState();
    raw.prestigeCount = 2;
    raw.unlockedCosmetics = ['default', 'ember_crest'] as typeof raw.unlockedCosmetics;
    raw.activeCosmetic = 'ember_crest';
    delete (raw as { cosmeticPicked?: boolean }).cosmeticPicked;

    const migrated = migrateState(raw);
    expect(migrated.cosmeticPicked).toBe(false);
    expect(migrated.unlockedCosmetics).toEqual(
      expect.arrayContaining(['default', 'ember_crest', 'cyan_hearth']),
    );
    expect(migrated.activeCosmetic).toBe('ember_crest');

    const roundTrip = deserializeState(serializeState(migrated));
    expect(roundTrip?.unlockedCosmetics).toContain('cyan_hearth');
  });
});
