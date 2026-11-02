import { EXPEDITIONS, type ExpeditionId } from '../data/expeditions';
import { availableExpeditions } from '../sim/economy';
import type { GameState } from '../sim/types';
import { formatDuration } from './format';

export interface ScoutPartyRow {
  partyIndex: number;
  expeditionId: ExpeditionId;
  expeditionName: string;
  /** Seconds remaining until return; 0 when ready to claim. */
  timeLeftSec: number;
  ready: boolean;
  /** 0..1 journey progress. */
  progress: number;
}

export interface ScoutIdleHint {
  title: string;
  detail: string;
  expeditionId: ExpeditionId;
}

/** Active scout parties in send order, for the HUD status strip. */
export function getScoutPartyRows(state: GameState, now = Date.now()): ScoutPartyRow[] {
  const parties = [...(state.activeExpeditions ?? [])].sort(
    (a, b) => a.startedAt - b.startedAt || a.endsAt - b.endsAt,
  );

  return parties.map((party, index) => {
    const def = EXPEDITIONS.find((e) => e.id === party.id);
    const timeLeftSec = Math.max(0, (party.endsAt - now) / 1000);
    const pendingHere = state.pendingLootExpeditionId === party.id;
    const ready = party.claimed || pendingHere || timeLeftSec <= 0;
    const span = Math.max(1, party.endsAt - party.startedAt);
    const progress = ready ? 1 : Math.min(1, Math.max(0, (now - party.startedAt) / span));

    return {
      partyIndex: index + 1,
      expeditionId: party.id,
      expeditionName: def?.name ?? party.id,
      timeLeftSec,
      ready,
      progress,
    };
  });
}

/**
 * When expeditions are unlocked but no party is out, nudge the next send.
 * Keeps post-tutorial pacing from going quiet after the craft loop.
 */
export function getScoutIdleHint(state: GameState): ScoutIdleHint | null {
  if ((state.activeExpeditions?.length ?? 0) > 0) return null;
  if (state.pendingLoot) return null;
  const unlocked = availableExpeditions(state);
  if (unlocked.length === 0) return null;
  const next = unlocked[0]!;
  return {
    title: 'Scouts ready',
    detail: `Send ${next.name}`,
    expeditionId: next.id,
  };
}

export function formatScoutTimeLeft(row: ScoutPartyRow): string {
  if (row.ready) return 'Ready';
  return formatDuration(row.timeLeftSec);
}
