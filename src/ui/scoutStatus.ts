import { EXPEDITIONS, type ExpeditionId } from '../data/expeditions';
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

export function formatScoutTimeLeft(row: ScoutPartyRow): string {
  if (row.ready) return 'Ready';
  return formatDuration(row.timeLeftSec);
}
