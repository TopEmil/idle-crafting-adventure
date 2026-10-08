import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { RECIPES } from '../data/recipes';
import { RESOURCE_IDS } from '../data/resources';
import { STATIONS } from '../data/stations';
import { createInitialState } from './createState';
import {
  applyResourceOffer,
  canSuggestResourceOffer,
  markResourceOfferShown,
  nextResourceOffer,
  progressiveOfferAmount,
} from './resourceOffer';

describe('resourceOffer', () => {
  it('offers the scarcest recipe resource', () => {
    const state = createInitialState();
    state.ownedRecipes = ['copper_pick'];
    state.resources.ore = 40;
    state.resources.emberglass = 0;
    const offer = nextResourceOffer(state);
    expect(offer).not.toBeNull();
    expect(offer!.resource).toBe('emberglass');
    expect(offer!.reason).toContain('Ember Tongs');
    expect(offer!.amount).toBeGreaterThan(0);
    expect(offer!.amount).toBeLessThanOrEqual(offer!.shortfall);
  });

  it('prefers the next recipe over a station with a worse ore shortfall', () => {
    const state = createInitialState();
    state.resources.ore = 5;
    const offer = nextResourceOffer(state);
    expect(offer).not.toBeNull();
    expect(offer!.resource).toBe('ore');
    expect(offer!.reason).toContain('Copper Pick');
  });

  it('returns null when goals are already affordable', () => {
    const state = createInitialState();
    for (const id of RESOURCE_IDS) {
      if (id === 'relics') continue;
      state.resources[id] = 50_000;
    }
    state.ownedRecipes = RECIPES.map((r) => r.id);
    state.mineDepth = 999;
    for (const station of STATIONS) {
      state.stations[station.id] = {
        unlocked: true,
        level: BALANCE.stationLevelCap,
        runLevel: BALANCE.stationLevelCap,
        enabled: true,
      };
    }
    expect(nextResourceOffer(state)).toBeNull();
  });

  it('scales amount progressively with prior claims', () => {
    const early = progressiveOfferAmount(100, 0, 2);
    const later = progressiveOfferAmount(100, 6, 2);
    expect(later).toBeGreaterThan(early);
    expect(later).toBeLessThanOrEqual(100);
  });

  it('gates suggestions on playtime and interval', () => {
    const state = createInitialState(1000);
    state.onboardingDone = true;
    state.playTimeSec = 30;
    state.resources.ore = 0;
    expect(canSuggestResourceOffer(state, 1000)).toBe(false);

    state.playTimeSec = BALANCE.resourceOfferMinPlaySec + 1;
    state.ads.resourceOfferReadyAfter = 5000;
    expect(canSuggestResourceOffer(state, 1000)).toBe(false);
    expect(canSuggestResourceOffer(state, 6000)).toBe(true);
  });

  it('applies grant and bumps claim counter', () => {
    const state = createInitialState();
    state.resources.glowdust = 2;
    const offer = {
      resource: 'glowdust' as const,
      amount: 12,
      reason: 'craft Vein Lantern',
      shortfall: 13,
    };
    const result = applyResourceOffer(state, offer);
    expect(result.state.resources.glowdust).toBe(14);
    expect(result.state.ads.resourceOffersClaimed).toBe(1);
    expect(result.event.type).toBe('resource_offer');
  });

  it('schedules the next suggestion ~5 minutes out', () => {
    const state = createInitialState(0);
    const next = markResourceOfferShown(state, 10_000);
    expect(next.ads.resourceOfferReadyAfter).toBe(10_000 + BALANCE.resourceOfferIntervalMs);
  });
});
