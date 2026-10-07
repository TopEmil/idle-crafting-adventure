import type { GameState } from './types';

/** CrazyGames weekly seasons end Monday 09:00 UTC. */
export const SEASON_RESET_UTC_HOUR = 9;

/** Local minimum gap between score submits (portal cooldown is often ~10–60s). */
export const LEADERBOARD_SUBMIT_COOLDOWN_MS = 60_000;

/**
 * Start of the CrazyGames leaderboard week containing `nowMs`
 * (Monday 09:00 UTC → next Monday 09:00 UTC).
 */
export function currentSeasonStartMs(nowMs = Date.now()): number {
  const d = new Date(nowMs);
  const day = d.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  let start = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - daysSinceMonday,
    SEASON_RESET_UTC_HOUR,
    0,
    0,
    0,
  );
  if (nowMs < start) {
    start -= 7 * 24 * 60 * 60 * 1000;
  }
  return start;
}

/** Roll seasonOre when the weekly boundary has passed. Mutates `state`. */
export function ensureSeasonWindow(state: GameState, nowMs = Date.now()): void {
  const seasonStart = currentSeasonStartMs(nowMs);
  if (state.seasonStartedAt !== seasonStart) {
    state.seasonStartedAt = seasonStart;
    state.seasonOre = 0;
  }
}

/**
 * Credit mined ore to run totals, all-time total, and weekly season score.
 * Mutates `state` (caller owns cloning).
 */
export function recordOreMined(state: GameState, amount: number, nowMs = Date.now()): void {
  if (!(amount > 0)) return;
  ensureSeasonWindow(state, nowMs);
  state.totalOreProduced += amount;
  state.lifetimeOre += amount;
  state.allTimeOre = (state.allTimeOre ?? 0) + amount;
  state.seasonOre = (state.seasonOre ?? 0) + amount;
}

/** Integer score submitted to CrazyGames (ore mined this weekly season). */
export function leaderboardScore(state: GameState, nowMs = Date.now()): number {
  ensureSeasonWindow(state, nowMs);
  return Math.max(0, Math.floor(state.seasonOre ?? 0));
}

export function msUntilSeasonEnd(nowMs = Date.now()): number {
  const start = currentSeasonStartMs(nowMs);
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, end - nowMs);
}
