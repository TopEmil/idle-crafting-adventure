import { LEADERBOARD_SUBMIT_COOLDOWN_MS, leaderboardScore } from './oreScore';
import type { GameState } from './types';

export type LeaderboardSubmitFn = (score: number) => Promise<{
  status: 'submitted' | 'skipped' | 'error';
  score?: number;
  reason?: string;
}>;

/**
 * Submit season ore when it increased and the local cooldown has elapsed.
 * Returns updated state when a submit was recorded; otherwise the same reference.
 */
export async function maybeSubmitLeaderboardScore(
  state: GameState,
  submit: LeaderboardSubmitFn,
  nowMs = Date.now(),
): Promise<{ state: GameState; submitted: boolean; reason?: string }> {
  const score = leaderboardScore(state, nowMs);
  if (score <= 0) {
    return { state, submitted: false, reason: 'no_score' };
  }
  if (score <= (state.lastLeaderboardScore ?? 0)) {
    return { state, submitted: false, reason: 'unchanged' };
  }
  const lastAt = state.lastLeaderboardSubmitAt ?? 0;
  if (lastAt > 0 && nowMs - lastAt < LEADERBOARD_SUBMIT_COOLDOWN_MS) {
    return { state, submitted: false, reason: 'cooldown' };
  }

  const result = await submit(score);
  const next = structuredClone(state);
  next.lastLeaderboardSubmitAt = nowMs;
  if (result.status === 'submitted') {
    next.lastLeaderboardScore = score;
    return { state: next, submitted: true };
  }
  // Still stamp attempt time to avoid hammering a broken SDK path.
  return { state: next, submitted: false, reason: result.reason ?? result.status };
}
