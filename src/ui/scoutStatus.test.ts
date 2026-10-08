import { describe, expect, it } from 'vitest';
import { createInitialState } from '../sim/createState';
import { formatScoutTimeLeft, getScoutPartyRows } from './scoutStatus';

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
