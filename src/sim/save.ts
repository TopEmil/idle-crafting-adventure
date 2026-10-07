import { createInitialState } from './createState';
import type { GameState } from './types';

export const SAVE_KEY = 'embervein.save.v1';

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(raw: string): GameState | null {
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || parsed.version !== 1 || !parsed.resources) return null;
    return parsed;
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
