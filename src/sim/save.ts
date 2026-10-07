import { STATIONS } from '../data/stations';
import { emptyTalents, TALENTS } from '../data/talents';
import { createInitialState } from './createState';
import type { GameState } from './types';

export const SAVE_KEY = 'embervein.save.v1';

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

/** Fill missing fields from older saves (toggle, talents, prestige cooldown). */
export function migrateState(state: GameState): GameState {
  const next = structuredClone(state);
  for (const def of STATIONS) {
    const st = next.stations[def.id];
    if (!st) continue;
    if (typeof st.enabled !== 'boolean') st.enabled = true;
  }
  if (!next.talents) {
    next.talents = emptyTalents();
  } else {
    const filled = emptyTalents();
    for (const def of TALENTS) {
      filled[def.id] = Math.max(0, Math.floor(next.talents[def.id] ?? 0));
    }
    next.talents = filled;
  }
  if (typeof next.lastPrestigeAt !== 'number') {
    next.lastPrestigeAt = 0;
  }
  if (typeof next.mineDepth !== 'number' || next.mineDepth < 0) {
    next.mineDepth = 0;
  } else {
    next.mineDepth = Math.floor(next.mineDepth);
  }
  if (typeof next.mineFaceHits !== 'number' || next.mineFaceHits < 0) {
    next.mineFaceHits = 0;
  } else {
    next.mineFaceHits = Math.floor(next.mineFaceHits);
  }
  if (typeof next.mineDigAcc !== 'number' || next.mineDigAcc < 0) {
    next.mineDigAcc = 0;
  }
  return next;
}

export function deserializeState(raw: string): GameState | null {
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || parsed.version !== 1 || !parsed.resources) return null;
    return migrateState(parsed);
  } catch {
    return null;
  }
}

export function loadLocalState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialState();
    return deserializeState(raw) ?? createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveLocalState(state: GameState): void {
  try {
    const stamped = { ...state, lastSaveAt: Date.now() };
    localStorage.setItem(SAVE_KEY, serializeState(stamped));
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearLocalState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
