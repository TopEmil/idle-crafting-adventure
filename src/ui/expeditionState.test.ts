import { describe, expect, it } from 'vitest';
import { getExpedition } from '../data/expeditions';
import { createInitialState } from '../sim/createState';
import { getExpeditionRowState } from './expeditionState';

const glow = getExpedition('glow_shalllows');

describe('getExpeditionRowState', () => {
  it('shows lifetime ore unlock progress while locked', () => {
    const state = createInitialState();
    state.totalOreProduced = 20;
    const row = getExpeditionRowState(state, glow);
    expect(row.kind).toBe('locked');
    expect(row.actionLabel).toBe('Locked');
    expect(row.canSend).toBe(false);
    expect(row.blocked).toBe(true);
    expect(row.status).toContain('20 / 50');
    expect(row.requirements).toContain('50');
    expect(row.progress).toBeCloseTo(0.4);
  });

  it('shows missing send cost once unlocked', () => {
    const state = createInitialState();
    state.totalOreProduced = 50;
    state.resources.ore = 5;
    const row = getExpeditionRowState(state, glow);
    expect(row.kind).toBe('need_cost');
    expect(row.actionLabel).toBe('Need more');
    expect(row.canSend).toBe(false);
    expect(row.status).toContain('5/20');
    expect(row.requirements).toMatch(/20 Ore/i);
  });

  it('allows send when unlocked and cost is covered', () => {
    const state = createInitialState();
    state.totalOreProduced = 50;
    state.resources.ore = 20;
    const row = getExpeditionRowState(state, glow);
    expect(row.kind).toBe('ready');
    expect(row.actionLabel).toBe('Send');
    expect(row.canSend).toBe(true);
    expect(row.blocked).toBe(false);
    expect(row.requirements).toMatch(/Spend/i);
  });

  it('blocks other destinations while a scout party is out', () => {
    const state = createInitialState();
    state.totalOreProduced = 250;
    state.resources.ore = 100;
    state.resources.glowdust = 50;
    state.activeExpedition = {
      id: 'glow_shalllows',
      startedAt: 1_000,
      endsAt: 46_000,
      claimed: false,
      doublePending: false,
    };
    const other = getExpedition('crystal_fault');
    const row = getExpeditionRowState(state, other, 10_000);
    expect(row.kind).toBe('busy');
    expect(row.actionLabel).toBe('Scout busy');
    expect(row.requirements).toMatch(/one scout/i);
    expect(row.canSend).toBe(false);
  });

  it('shows active timer for the dispatched expedition', () => {
    const state = createInitialState();
    state.totalOreProduced = 50;
    state.activeExpedition = {
      id: 'glow_shalllows',
      startedAt: 1_000,
      endsAt: 46_000,
      claimed: false,
      doublePending: false,
    };
    const row = getExpeditionRowState(state, glow, 10_000);
    expect(row.kind).toBe('active');
    expect(row.mode).toBe('progress');
    expect(row.status).toMatch(/Returning in/);
    expect(row.activePct).not.toBeNull();
    expect(row.canSend).toBe(false);
  });

  it('offers Claim when the active expedition is ready', () => {
    const state = createInitialState();
    state.totalOreProduced = 50;
    state.pendingLoot = { glowdust: 10 };
    state.activeExpedition = {
      id: 'glow_shalllows',
      startedAt: 1,
      endsAt: 2,
      claimed: false,
      doublePending: false,
    };
    const row = getExpeditionRowState(state, glow, 10_000);
    expect(row.kind).toBe('returning');
    expect(row.mode).toBe('claim');
    expect(row.actionLabel).toBe('Claim');
    expect(row.status).toMatch(/Loot ready/i);
  });

  it('requires claiming pending loot before another send', () => {
    const state = createInitialState();
    state.totalOreProduced = 50;
    state.resources.ore = 40;
    state.pendingLoot = { glowdust: 10 };
    state.activeExpedition = {
      id: 'glow_shalllows',
      startedAt: 1,
      endsAt: 2,
      claimed: false,
      doublePending: false,
    };
    const crystal = getExpedition('crystal_fault');
    state.totalOreProduced = 200;
    const row = getExpeditionRowState(state, crystal);
    expect(row.kind).toBe('claim_first');
    expect(row.mode).toBe('claim_first');
    expect(row.actionLabel).toBe('Claim first');
    expect(row.requirements).toMatch(/Claim pending loot/i);
  });
});
