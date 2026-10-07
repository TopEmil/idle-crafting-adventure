import { BALANCE } from '../data/balance';
import type { ExpeditionDef } from '../data/expeditions';
import {
  activeSquadCount,
  canAfford,
  expeditionSlotCount,
} from '../sim/economy';
import type { GameState } from '../sim/types';
import { formatCostProgress } from './craftState';
import { formatCost, formatDuration, formatNumber } from './format';

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
  /** Primary cost / unlock / timer line */
  status: string;
  /** Explicit requirements the player must meet */
  requirements: string;
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
      actionLabel: 'En route',
      canSend: false,
      blocked: false,
      progress: pct / 100,
      activePct: pct,
      canRush: true,
    };
  }

  const unlocked = state.totalOreProduced >= expedition.unlockAtOreProduced;
  if (!unlocked) {
    const have = state.totalOreProduced;
    const need = expedition.unlockAtOreProduced;
    const progress = need > 0 ? Math.min(1, have / need) : 1;
    return {
      kind: 'locked',
      mode: 'locked',
      status: `${formatNumber(have)} / ${formatNumber(need)} lifetime ore`,
      requirements: `Unlock at ${formatNumber(need)} lifetime ore produced`,
      actionLabel: 'Locked',
      canSend: false,
      blocked: true,
      progress,
      activePct: null,
      canRush: false,
    };
  }

  if (state.pendingLoot) {
    return {
      kind: 'claim_first',
      mode: 'claim_first',
      status: `${formatCost(expedition.cost)} · ${formatDuration(expedition.durationSec)}`,
      requirements: 'Claim pending loot before sending again',
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
    return {
      kind: 'busy',
      mode: 'busy',
      status: `${formatCost(expedition.cost)} · ${formatDuration(expedition.durationSec)}`,
      requirements:
        slots <= BALANCE.baseExpeditionSlots
          ? 'All squads busy — buy an extra squad with Relics, or rush with an ad'
          : 'All squads busy — rush one with an ad or wait',
      actionLabel: 'Squads busy',
      canSend: false,
      blocked: true,
      progress: 1,
      activePct: null,
      canRush: false,
    };
  }

  const costProgress = formatCostProgress(expedition.cost, state.resources);
  const affordable = canAfford(state.resources, expedition.cost);
  if (!affordable) {
    return {
      kind: 'need_cost',
      mode: 'need_cost',
      status: costProgress.detail,
      requirements: `Needs ${formatCost(expedition.cost)} to send · ${formatDuration(expedition.durationSec)}`,
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
    status: `Ready · ${costProgress.detail} · ${formatDuration(expedition.durationSec)}`,
    requirements: `Spend ${formatCost(expedition.cost)} · returns in ${formatDuration(expedition.durationSec)}`,
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
      return `<button class="btn btn-secondary" data-exp="${expeditionId}" type="button" ${row.canSend ? '' : 'disabled'} title="${row.requirements}">${row.actionLabel}</button>`;
    default: {
      const _exhaustive: never = row.mode;
      return _exhaustive;
    }
  }
}
