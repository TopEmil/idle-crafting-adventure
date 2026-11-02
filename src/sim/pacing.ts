/**
 * Optimal-player pacing harness — asserts early-game design beats (±20%).
 * Sim bot at 4 clicks/sec via clickVein + tickProduction (not UI/Playwright).
 */

import { BALANCE } from '../data/balance';
import { createInitialState } from './createState';
import {
  canPrestige,
  claimExpedition,
  clickVein,
  completeExpeditionIfReady,
  craftRecipe,
  startExpedition,
  tickProduction,
  unlockStation,
} from './economy';
import type { GameState } from './types';

/** Optimal tap rate used for wall-clock estimates (clicks per second). */
export const PACING_CPS = 4;
export const CLICK_DT = 1 / PACING_CPS;

const START_NOW = 1_700_000_000_000;
const MAX_SIM_SEC = 900;
const FIXED_RNG = (): number => 0.5;

export interface BeatWindow {
  id: string;
  label: string;
  /** Design-bible midpoint (seconds). */
  targetSec: number;
  minSec: number;
  maxSec: number;
}

/** ±tolerance around a point target (rounded to 0.1s). */
export function band(targetSec: number, tolerance = 0.2): { minSec: number; maxSec: number } {
  const round = (n: number): number => Math.round(n * 10) / 10;
  return {
    minSec: round(targetSec * (1 - tolerance)),
    maxSec: round(targetSec * (1 + tolerance)),
  };
}

/**
 * Early-game beats for the optimal 4 CPS sim bot.
 *
 * Design bible (docs/design.md) targets casual play (Smelter ~1–2 min,
 * expedition claim ~3–5 min). An optimal digger finishes earlier — windows
 * here are ±20% around measured optimal baselines, capped by design ceilings
 * so the harness catches both "too fast" and "too slow" balance drift.
 *
 * Design ceilings: Copper Pick &lt;30s, Smelter ≤120s, expedition ≤300s,
 * Reforge ready ≈ prestigeMinPlaySec (±20%).
 */
export const BEATS: Record<string, BeatWindow> = {
  copperPick: {
    id: 'copperPick',
    label: 'First purchase (Copper Pick)',
    // Optimal ~5s; design ceiling &lt;30s.
    targetSec: 5,
    minSec: band(5).minSec,
    maxSec: 30,
  },
  smelter: {
    id: 'smelter',
    label: 'Smelter unlock',
    // Optimal ~30s; design ceiling 2 min.
    targetSec: 30,
    minSec: band(30).minSec,
    maxSec: Math.min(band(30).maxSec, 120),
  },
  expeditionClaim: {
    id: 'expeditionClaim',
    label: 'First expedition claim',
    // Optimal ~57s (dig + 45s Glow Shallows trip); design ceiling 5 min.
    targetSec: 57,
    minSec: band(57).minSec,
    maxSec: Math.min(band(57).maxSec, 300),
  },
  reforgeReady: {
    id: 'reforgeReady',
    label: 'First Reforge ready (tutorial climax)',
    targetSec: BALANCE.prestigeMinPlaySec,
    ...band(BALANCE.prestigeMinPlaySec),
  },
};

export interface PacingTimestamps {
  copperPickSec: number | null;
  smelterSec: number | null;
  expeditionClaimSec: number | null;
  reforgeReadySec: number | null;
}

export interface PacingResult {
  timestamps: PacingTimestamps;
  playTimeSec: number;
  clicks: number;
  ok: boolean;
  failures: string[];
  report: string;
}

function tryCraftPick(state: GameState): GameState {
  if (state.ownedRecipes.includes('copper_pick')) return state;
  const crafted = craftRecipe(state, 'copper_pick');
  return crafted.ok ? crafted.state : state;
}

function tryUnlockSmelter(state: GameState): GameState {
  if (state.stations.smelter.unlocked) return state;
  const unlocked = unlockStation(state, 'smelter');
  return unlocked.ok ? unlocked.state : state;
}

function tryStartFirstExpedition(state: GameState, now: number): GameState {
  if ((state.activeExpeditions ?? []).length > 0) return state;
  if (state.pendingLoot) return state;
  if (state.milestones.firstExpeditionClaimed) return state;
  const started = startExpedition(state, 'glow_shalllows', now);
  return started.ok ? started.state : state;
}

function tryClaimLoot(state: GameState): GameState {
  if (!state.pendingLoot) return state;
  const claimed = claimExpedition(state, false);
  return claimed.ok ? claimed.state : state;
}

function advanceClick(state: GameState, now: number): { state: GameState; now: number } {
  let next = clickVein(state).state;
  next = tickProduction(next, CLICK_DT);
  const t = now + CLICK_DT * 1000;
  const ready = completeExpeditionIfReady(next, t, FIXED_RNG);
  return { state: ready.state, now: t };
}

function recordMilestones(
  state: GameState,
  stamps: PacingTimestamps,
  wallNow: number,
): void {
  if (stamps.copperPickSec == null && state.ownedRecipes.includes('copper_pick')) {
    stamps.copperPickSec = state.playTimeSec;
  }
  if (stamps.smelterSec == null && state.stations.smelter.unlocked) {
    stamps.smelterSec = state.playTimeSec;
  }
  if (
    stamps.expeditionClaimSec == null &&
    state.milestones.firstExpeditionClaimed
  ) {
    stamps.expeditionClaimSec = state.playTimeSec;
  }
  if (stamps.reforgeReadySec == null && canPrestige(state, wallNow)) {
    stamps.reforgeReadySec = state.playTimeSec;
  }
}

function allBeatsReached(stamps: PacingTimestamps): boolean {
  return (
    stamps.copperPickSec != null &&
    stamps.smelterSec != null &&
    stamps.expeditionClaimSec != null &&
    stamps.reforgeReadySec != null
  );
}

/**
 * Drive a fresh save with an optimal 4 CPS digger through early-game milestones.
 */
export function runOptimalPacing(now = START_NOW): PacingResult {
  let state = createInitialState(now);
  let wallNow = now;
  const stamps: PacingTimestamps = {
    copperPickSec: null,
    smelterSec: null,
    expeditionClaimSec: null,
    reforgeReadySec: null,
  };

  const maxSteps = Math.ceil(MAX_SIM_SEC / CLICK_DT);

  for (let step = 0; step < maxSteps; step++) {
    state = tryCraftPick(state);
    state = tryUnlockSmelter(state);
    state = tryStartFirstExpedition(state, wallNow);

    const ready = completeExpeditionIfReady(state, wallNow, FIXED_RNG);
    state = ready.state;
    state = tryClaimLoot(state);
    recordMilestones(state, stamps, wallNow);

    if (allBeatsReached(stamps)) break;

    const advanced = advanceClick(state, wallNow);
    state = advanced.state;
    wallNow = advanced.now;
    recordMilestones(state, stamps, wallNow);

    if (allBeatsReached(stamps)) break;
  }

  const failures = assertBeats(stamps);
  const report = formatPacingReport(stamps, failures);

  return {
    timestamps: stamps,
    playTimeSec: state.playTimeSec,
    clicks: state.lifetimeClicks,
    ok: failures.length === 0,
    failures,
    report,
  };
}

export function assertBeats(stamps: PacingTimestamps): string[] {
  const failures: string[] = [];
  const checks: [keyof PacingTimestamps, BeatWindow][] = [
    ['copperPickSec', BEATS.copperPick],
    ['smelterSec', BEATS.smelter],
    ['expeditionClaimSec', BEATS.expeditionClaim],
    ['reforgeReadySec', BEATS.reforgeReady],
  ];

  for (const [key, beat] of checks) {
    const value = stamps[key];
    if (value == null) {
      failures.push(`${beat.label}: not reached within ${MAX_SIM_SEC}s sim cap`);
      continue;
    }
    if (value < beat.minSec || value > beat.maxSec) {
      failures.push(
        `${beat.label}: ${value.toFixed(1)}s outside [${beat.minSec}, ${beat.maxSec}]s (target ~${beat.targetSec}s)`,
      );
    }
  }
  return failures;
}

export function formatPacingReport(
  stamps: PacingTimestamps,
  failures: string[] = assertBeats(stamps),
): string {
  const lines: string[] = ['Embervein pacing report (optimal 4 CPS bot)', ''];
  const rows: [keyof PacingTimestamps, BeatWindow][] = [
    ['copperPickSec', BEATS.copperPick],
    ['smelterSec', BEATS.smelter],
    ['expeditionClaimSec', BEATS.expeditionClaim],
    ['reforgeReadySec', BEATS.reforgeReady],
  ];
  for (const [key, beat] of rows) {
    const value = stamps[key];
    const status =
      value == null
        ? 'MISS'
        : value < beat.minSec || value > beat.maxSec
          ? 'FAIL'
          : 'OK';
    const shown = value == null ? '—' : `${value.toFixed(1)}s`;
    lines.push(
      `[${status}] ${beat.label}: ${shown} (window ${beat.minSec}–${beat.maxSec}s, target ~${beat.targetSec}s)`,
    );
  }
  if (failures.length > 0) {
    lines.push('', 'Failures:');
    for (const f of failures) lines.push(`  - ${f}`);
  } else {
    lines.push('', 'All early-game beats within design windows.');
  }
  return lines.join('\n');
}
