import { describe, expect, it } from 'vitest';
import { createInitialState } from '../sim/createState';
import { formatScoutTimeLeft, getScoutIdleHint, getScoutPartyRows } from './scoutStatus';

describe('getScoutPartyRows', () => {
  it('returns empty when no scouts are out', () => {
    const state = createInitialState();
    expect(getScoutPartyRows(state)).toEqual([]);
  });

  it('lists parties in send order with time left', () => {
    const now = 1_000_000;
    const state = createInitialState();
    state.activeExpeditions = [
      {
        id: 'glow_shalllows',
        startedAt: now - 10_000,
        endsAt: now + 20_000,
        claimed: false,
        doublePending: false,
      },
      {
        id: 'moss_crawl',
        startedAt: now - 5_000,
        endsAt: now + 5_000,
        claimed: false,
        doublePending: false,
      },
    ];

    const rows = getScoutPartyRows(state, now);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      partyIndex: 1,
      expeditionId: 'glow_shalllows',
      expeditionName: 'Glow Shallows',
      ready: false,
    });
    expect(rows[0].timeLeftSec).toBeCloseTo(20, 5);
    expect(rows[1]).toMatchObject({
      partyIndex: 2,
      expeditionId: 'moss_crawl',
      expeditionName: 'Moss Crawl',
    });
    expect(formatScoutTimeLeft(rows[0])).toBe('20s');
  });

  it('marks claimed / pending loot parties as ready', () => {
    const now = 1_000_000;
    const state = createInitialState();
    state.pendingLoot = { glowdust: 10 };
    state.pendingLootExpeditionId = 'glow_shalllows';
    state.activeExpeditions = [
      {
        id: 'glow_shalllows',
        startedAt: now - 60_000,
        endsAt: now - 1_000,
        claimed: true,
        doublePending: false,
      },
    ];

    const rows = getScoutPartyRows(state, now);
    expect(rows).toHaveLength(1);
    expect(rows[0].ready).toBe(true);
    expect(formatScoutTimeLeft(rows[0])).toBe('Ready');
    expect(rows[0].progress).toBe(1);
  });
});

describe('getScoutIdleHint', () => {
  it('is null before expeditions unlock', () => {
    const state = createInitialState();
    state.totalOreProduced = 10;
    expect(getScoutIdleHint(state)).toBeNull();
  });

  it('nudges the first unlocked route when scouts are idle', () => {
    const state = createInitialState();
    state.totalOreProduced = 80;
    state.activeExpeditions = [];
    const hint = getScoutIdleHint(state);
    expect(hint).toMatchObject({
      title: 'Scouts ready',
      detail: 'Send Glow Shallows',
      expeditionId: 'glow_shalllows',
    });
  });

  it('stays quiet while a party is already out', () => {
    const state = createInitialState();
    state.totalOreProduced = 80;
    state.activeExpeditions = [
      {
        id: 'glow_shalllows',
        startedAt: 1,
        endsAt: 99_999,
        claimed: false,
        doublePending: false,
      },
    ];
    expect(getScoutIdleHint(state)).toBeNull();
  });
});
