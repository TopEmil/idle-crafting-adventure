import { BALANCE } from '../data/balance';
import type { ExpeditionDef } from '../data/expeditions';
import {
  activeSquadCount,
  canAfford,
  expeditionSlotCount,
} from '../sim/economy';
import { expeditionCost, expeditionOreGate } from '../sim/pricing';
import type { GameState } from '../sim/types';
import { formatCostProgress } from './craftState';
import { formatCost, formatCostHtml, formatDuration, formatNumber } from './format';

export type ExpeditionRowKind =
  | 'locked'
  | 'busy'
  | 'claim_first'
  | 'need_cost'
  | 'ready'
  | 'active'
  | 'returning';

/** Stable action slot mode used to avoid rebuilding buttons every frame. */
export type ExpeditionActionMode =
  | 'locked'
  | 'busy'
  | 'claim_first'
  | 'need_cost'
  | 'send'
  | 'progress'
  | 'claim';

export interface ExpeditionRowState {
  kind: ExpeditionRowKind;
  mode: ExpeditionActionMode;
  /** Primary cost / unlock / timer line (may include HTML resource icons) */
  status: string;
  /** Explicit requirements the player must meet (may include HTML resource icons) */
  requirements: string;
  /** Plain-text tooltip for the action button (no HTML) */
  actionTitle: string;
  /** Send / Locked / Need more / Scout busy / Claim button label */
  actionLabel: string;
  canSend: boolean;
  blocked: boolean;
  /** Progress 0..1 toward unlock or active timer */
  progress: number;
  /** When active: fill percent for the progress bar */
  activePct: number | null;
  /** True while this destination has a living (unclaimed) party out. */
  canRush: boolean;
}

export function getExpeditionRowState(
  state: GameState,
  expedition: ExpeditionDef,
  now = Date.now(),
): ExpeditionRowState {
  const parties = state.activeExpeditions ?? [];
  const active = parties.find((e) => e.id === expedition.id);

  if (active) {
    const left = Math.max(0, (active.endsAt - now) / 1000);
    const pct = Math.min(100, ((expedition.durationSec - left) / expedition.durationSec) * 100);
    const thisPending = pendingFor(state, expedition.id);
    const ready = left <= 0 || active.claimed;
    if (thisPending || (ready && !state.pendingLoot)) {
      return {
        kind: 'returning',
        mode: 'claim',
        status: 'Loot ready — claim it',
        requirements: 'Tap Claim to collect loot',
        actionTitle: 'Tap Claim to collect loot',
        actionLabel: 'Claim',
        canSend: false,
        blocked: false,
        progress: 1,
        activePct: 100,
        canRush: false,
      };
    }
    if (ready && state.pendingLoot) {
      return {
        kind: 'returning',
        mode: 'claim_first',
        status: 'Back at camp — waiting in line',
        requirements: 'Claim the other squad’s loot first',
        actionTitle: 'Claim the other squad’s loot first',
        actionLabel: 'Wait',
        canSend: false,
        blocked: true,
        progress: 1,
        activePct: 100,
        canRush: false,
      };
    }
    return {
      kind: 'active',
      mode: 'progress',
      status: `Returning in ${formatDuration(left)}`,
      requirements: `Cost paid · ${formatDuration(expedition.durationSec)} run · watch an ad to rush`,
      actionTitle: `Cost paid · ${formatDuration(expedition.durationSec)} run · watch an ad to rush`,
      actionLabel: 'En route',
      canSend: false,
      blocked: false,
      progress: pct / 100,
      activePct: pct,
      canRush: true,
    };
  }

  const oreNeed = expeditionOreGate(expedition);
  const oreOk = state.totalOreProduced >= oreNeed;
  const depthNeed = expedition.unlockAtDepth ?? 0;
  const depthOk = (state.mineDepth ?? 0) >= depthNeed;
  if (!oreOk || !depthOk) {
    const have = state.totalOreProduced;
    const depthHave = state.mineDepth ?? 0;
    const oreProgress = oreNeed > 0 ? Math.min(1, have / oreNeed) : 1;
    const depthProgress = depthNeed > 0 ? Math.min(1, depthHave / depthNeed) : 1;
    const progress = Math.min(oreProgress, depthProgress);
    const parts: string[] = [];
    if (!oreOk) parts.push(`${formatNumber(have)} / ${formatNumber(oreNeed)} lifetime ore`);
    if (!depthOk) parts.push(`Depth ${depthHave} / ${depthNeed}`);
    const requirements = !oreOk
      ? `Unlock at ${formatNumber(oreNeed)} lifetime ore produced`
      : `Dig to depth ${depthNeed} to open this route`;
    return {
      kind: 'locked',
      mode: 'locked',
      status: parts.join(' · '),
      requirements,
      actionTitle: requirements,
      actionLabel: 'Locked',
      canSend: false,
      blocked: true,
      progress,
      activePct: null,
      canRush: false,
    };
  }

  const priced = expeditionCost(expedition);
  const costPlain = formatCost(priced);
  const costHtml = formatCostHtml(priced);
  const duration = formatDuration(expedition.durationSec);

  if (state.pendingLoot) {
    return {
      kind: 'claim_first',
      mode: 'claim_first',
      status: `${costHtml}<span class="res-sep"> · </span>${duration}`,
      requirements: 'Claim pending loot before sending again',
      actionTitle: 'Claim pending loot before sending again',
      actionLabel: 'Claim first',
      canSend: false,
      blocked: true,
      progress: 1,
      activePct: null,
      canRush: false,
    };
  }

  const slots = expeditionSlotCount(state);
  const busy = activeSquadCount(state);
  if (busy >= slots) {
    const requirements =
      slots <= BALANCE.baseExpeditionSlots
        ? 'All squads busy — buy an extra squad with Relics, or rush with an ad'
        : 'All squads busy — rush one with an ad or wait';
    return {
      kind: 'busy',
      mode: 'busy',
      status: `${costHtml}<span class="res-sep"> · </span>${duration}`,
      requirements,
      actionTitle: requirements,
      actionLabel: 'Squads busy',
      canSend: false,
      blocked: true,
      progress: 1,
      activePct: null,
      canRush: false,
    };
  }

  const costProgress = formatCostProgress(priced, state.resources);
  const affordable = canAfford(state.resources, priced);
  if (!affordable) {
    return {
      kind: 'need_cost',
      mode: 'need_cost',
      status: costProgress.detail,
      requirements: `Needs ${costHtml} to send · ${duration}`,
      actionTitle: `Needs ${costPlain} to send · ${duration}`,
      actionLabel: 'Need more',
      canSend: false,
      blocked: true,
      progress: costProgress.progress,
      activePct: null,
      canRush: false,
    };
  }

  return {
    kind: 'ready',
    mode: 'send',
    status: `Ready · ${costProgress.detail} · ${duration}`,
    requirements: `Spend ${costHtml} · returns in ${duration}`,
    actionTitle: `Spend ${costPlain} · returns in ${duration}`,
    actionLabel: 'Send',
    canSend: true,
    blocked: false,
    progress: 1,
    activePct: null,
    canRush: false,
  };
}

function pendingFor(state: GameState, expeditionId: string): boolean {
  if (!state.pendingLoot) return false;
  if (state.pendingLootExpeditionId) {
    return state.pendingLootExpeditionId === expeditionId;
  }
  // Legacy: any pending loot blocks claim on the living party.
  return true;
}

export function expeditionActionHtml(row: ExpeditionRowState, expeditionId: string): string {
  switch (row.mode) {
    case 'claim':
      return `<button class="btn btn-primary" id="exp-claim" type="button">${row.actionLabel}</button>`;
    case 'progress':
      return `<div class="exp-progress-actions">
        <div class="progress-bar" style="width:72px" title="${row.status}"><span data-exp-bar style="width:${row.activePct ?? 0}%"></span></div>
        <button class="btn btn-secondary btn-rush" data-exp-rush="${expeditionId}" type="button" title="Watch a rewarded ad to finish this squad now">▶ Rush</button>
      </div>`;
    case 'locked':
    case 'busy':
    case 'claim_first':
    case 'need_cost':
    case 'send':
      return `<button class="btn btn-secondary" data-exp="${expeditionId}" type="button" ${row.canSend ? '' : 'disabled'} title="${row.actionTitle}">${row.actionLabel}</button>`;
    default: {
      const _exhaustive: never = row.mode;
      return _exhaustive;
    }
  }
}
