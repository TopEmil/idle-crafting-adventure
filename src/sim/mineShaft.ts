import { stratumAtDepth, type StratumDef } from '../data/strata';
import type { ResourceId } from '../data/resources';

export const SHAFT_COLS = 8;
export const SHAFT_LOOKAHEAD = 5;
export const SHAFT_LOOKBEHIND = 3;

export type TileKind = 'stone' | 'glow' | 'ember' | 'geode';

export interface TileLoot {
  resource: ResourceId;
  amount: number;
  label: string;
}

export interface ShaftCell {
  row: number;
  col: number;
  kind: TileKind;
  hp: number;
  maxHp: number;
  tint: number;
  fleck: number;
  seed: number;
  cleared: boolean;
  role: 'history' | 'face' | 'ahead';
  /** True for rare pockets that only burst loot on player digs */
  rare: boolean;
}

/** Persisted dig progress — regenerates the shaft deterministically. */
export interface MineShaftProgress {
  depth: number;
  /** Damage dealt to each column on the current dig face */
  faceDamage: number[];
}

export function emptyFaceDamage(): number[] {
  return Array.from({ length: SHAFT_COLS }, () => 0);
}

export function createMineShaftProgress(depth = 0, faceDamage?: number[]): MineShaftProgress {
  const dmg = faceDamage ? faceDamage.slice(0, SHAFT_COLS) : emptyFaceDamage();
  while (dmg.length < SHAFT_COLS) dmg.push(0);
  return {
    depth: Math.max(0, Math.floor(depth)),
    faceDamage: dmg.map((n) => Math.max(0, Math.floor(n))),
  };
}

/** Migrate legacy left-to-right faceHits into per-column damage. */
export function faceHitsToDamage(depth: number, faceHits: number): number[] {
  const dmg = emptyFaceDamage();
  let remaining = Math.max(0, Math.floor(faceHits));
  for (let col = 0; col < SHAFT_COLS && remaining > 0; col++) {
    const max = cellMaxHp(depth, col);
    const take = Math.min(max, remaining);
    dmg[col] = take;
    remaining -= take;
  }
  return dmg;
}

function cellSeed(row: number, col: number): number {
  return 1.1 + row * 0.37 + col * 0.19;
}

/** Deterministic hash → [0, 1) */
function cellRoll(row: number, col: number): number {
  const x = Math.sin(row * 12.9898 + col * 78.233 + 41.17) * 43758.5453;
  return x - Math.floor(x);
}

export function tileKindAt(row: number, col: number): TileKind {
  const stratum = stratumAtDepth(row);
  const roll = cellRoll(row, col);
  // Rares get slightly more common deeper, but stay sparse
  const rareBoost = Math.min(0.06, row * 0.0008);
  if (roll < 0.07 + rareBoost) return 'glow';
  if (roll < 0.11 + rareBoost * 1.4 && stratum.startDepth >= 12) return 'ember';
  if (roll < 0.14 + rareBoost * 1.8 && stratum.startDepth >= 30) return 'geode';
  // Early glow pockets even in shallows
  if (stratum.id === 'glow_shallows' && roll < 0.09) return 'glow';
  return 'stone';
}

function cellMaxHp(row: number, col: number): number {
  const stratum = stratumAtDepth(row);
  const kind = tileKindAt(row, col);
  const kindBonus = kind === 'stone' ? 0 : kind === 'glow' ? 1 : kind === 'ember' ? 1 : 2;
  return stratum.hardness + ((row * 3 + col * 7) % 2) + kindBonus;
}

function cellTint(stratum: StratumDef, row: number, col: number, kind: TileKind): number {
  if (kind === 'glow') return 0x2a5a58;
  if (kind === 'ember') return 0x5a3a28;
  if (kind === 'geode') return 0x3a3a5a;
  const shift = ((row + col) % 3) * 0x060808;
  return (stratum.tint + shift) & 0xffffff;
}

function cellFleck(stratum: StratumDef, kind: TileKind): number {
  if (kind === 'glow') return 0x2ec4b6;
  if (kind === 'ember') return 0xe85d04;
  if (kind === 'geode') return 0xa8c8e8;
  return stratum.fleck;
}

export function faceCellHp(depth: number, faceDamage: number[], col: number): number {
  const max = cellMaxHp(depth, col);
  const dmg = faceDamage[col] ?? 0;
  return Math.max(0, max - dmg);
}

export function faceTotalHp(depth: number): number {
  let total = 0;
  for (let col = 0; col < SHAFT_COLS; col++) {
    total += cellMaxHp(depth, col);
  }
  return total;
}

export function faceDamageSum(faceDamage: number[]): number {
  return faceDamage.reduce((a, b) => a + b, 0);
}

export function faceCleared(depth: number, faceDamage: number[]): boolean {
  for (let col = 0; col < SHAFT_COLS; col++) {
    if (faceCellHp(depth, faceDamage, col) > 0) return false;
  }
  return true;
}

export function normalizeProgress(progress: MineShaftProgress): MineShaftProgress {
  let depth = Math.max(0, Math.floor(progress.depth));
  let faceDamage = [...(progress.faceDamage ?? emptyFaceDamage())];
  while (faceDamage.length < SHAFT_COLS) faceDamage.push(0);
  faceDamage = faceDamage.slice(0, SHAFT_COLS).map((n) => Math.max(0, Math.floor(n)));

  for (let guard = 0; guard < 10_000; guard++) {
    if (!faceCleared(depth, faceDamage)) break;
    depth += 1;
    faceDamage = emptyFaceDamage();
  }
  return { depth, faceDamage };
}

export function lootForTile(kind: TileKind): TileLoot | null {
  switch (kind) {
    case 'glow':
      return { resource: 'glowdust', amount: 2, label: 'Glowdust' };
    case 'ember':
      return { resource: 'emberglass', amount: 1, label: 'Emberglass' };
    case 'geode':
      return { resource: 'alloy', amount: 1, label: 'Alloy' };
    case 'stone':
      return null;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export type DigMode = 'player' | 'auto';

export interface DigResult {
  progress: MineShaftProgress;
  shattered: boolean;
  rowsCleared: number;
  depth: number;
  stratum: StratumDef;
  hitCol: number;
  hitKind: TileKind;
  /** Active-only rare loot (null for stone or auto digs) */
  loot: TileLoot | null;
}

function pickAutoCol(depth: number, faceDamage: number[]): number {
  // Prefer ordinary stone so rares wait for the player
  let stoneCol = -1;
  let anyCol = -1;
  for (let col = 0; col < SHAFT_COLS; col++) {
    if (faceCellHp(depth, faceDamage, col) <= 0) continue;
    if (anyCol < 0) anyCol = col;
    if (tileKindAt(depth, col) === 'stone') {
      stoneCol = col;
      break;
    }
  }
  return stoneCol >= 0 ? stoneCol : anyCol;
}

/** Apply dig hits. Player can target a column; auto prefers stone. */
export function digShaft(
  progress: MineShaftProgress,
  hits = 1,
  opts?: { col?: number; mode?: DigMode },
): DigResult {
  const mode: DigMode = opts?.mode ?? 'player';
  let { depth, faceDamage } = normalizeProgress(progress);
  faceDamage = [...faceDamage];

  let shattered = false;
  let rowsCleared = 0;
  let hitCol = 0;
  let hitKind: TileKind = 'stone';
  let loot: TileLoot | null = null;

  let remaining = Math.max(0, Math.floor(hits));
  while (remaining > 0) {
    let targetCol =
      mode === 'player' && opts?.col != null && opts.col >= 0 && opts.col < SHAFT_COLS
        ? opts.col
        : pickAutoCol(depth, faceDamage);

    if (targetCol < 0 || faceCellHp(depth, faceDamage, targetCol) <= 0) {
      targetCol = pickAutoCol(depth, faceDamage);
    }
    if (targetCol < 0) {
      // Face somehow clear
      const advanced = normalizeProgress({ depth, faceDamage });
      depth = advanced.depth;
      faceDamage = [...advanced.faceDamage];
      remaining -= 1;
      continue;
    }

    hitCol = targetCol;
    hitKind = tileKindAt(depth, targetCol);
    const hpBefore = faceCellHp(depth, faceDamage, targetCol);
    faceDamage[targetCol] = (faceDamage[targetCol] ?? 0) + 1;
    remaining -= 1;

    if (hpBefore > 0 && faceCellHp(depth, faceDamage, targetCol) <= 0) {
      shattered = true;
      if (mode === 'player') {
        loot = lootForTile(hitKind);
      }
    }

    if (faceCleared(depth, faceDamage)) {
      depth += 1;
      faceDamage = emptyFaceDamage();
      rowsCleared += 1;
    }
  }

  const progressOut = normalizeProgress({ depth, faceDamage });
  return {
    progress: progressOut,
    shattered,
    rowsCleared,
    depth: progressOut.depth,
    stratum: stratumAtDepth(progressOut.depth),
    hitCol,
    hitKind,
    loot,
  };
}

export function buildShaftCells(progress: MineShaftProgress): ShaftCell[] {
  const { depth, faceDamage } = normalizeProgress(progress);
  const cells: ShaftCell[] = [];
  const startRow = Math.max(0, depth - SHAFT_LOOKBEHIND);
  const endRow = depth + SHAFT_LOOKAHEAD;

  for (let row = startRow; row <= endRow; row++) {
    const stratum = stratumAtDepth(row);
    let role: ShaftCell['role'];
    if (row < depth) role = 'history';
    else if (row === depth) role = 'face';
    else role = 'ahead';

    for (let col = 0; col < SHAFT_COLS; col++) {
      const kind = tileKindAt(row, col);
      const maxHp = cellMaxHp(row, col);
      let hp: number;
      let cleared: boolean;
      if (role === 'history') {
        hp = 0;
        cleared = true;
      } else if (role === 'face') {
        hp = faceCellHp(depth, faceDamage, col);
        cleared = hp <= 0;
      } else {
        hp = maxHp;
        cleared = false;
      }
      cells.push({
        row,
        col,
        kind,
        hp,
        maxHp,
        tint: cellTint(stratum, row, col, kind),
        fleck: cellFleck(stratum, kind),
        seed: cellSeed(row, col),
        cleared,
        role,
        rare: kind !== 'stone',
      });
    }
  }
  return cells;
}

export function findNearestFaceCell(
  cells: ShaftCell[],
  positions: Map<string, { x: number; y: number }>,
  px: number,
  py: number,
  maxDist: number,
  opts?: { includeCleared?: boolean },
): ShaftCell | null {
  let best: ShaftCell | null = null;
  let bestD = maxDist * maxDist;
  const includeCleared = opts?.includeCleared === true;
  for (const cell of cells) {
    if (cell.role !== 'face') continue;
    if (cell.cleared && !includeCleared) continue;
    const pos = positions.get(`${cell.row}:${cell.col}`);
    if (!pos) continue;
    const dx = px - pos.x;
    const dy = py - pos.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = cell;
    }
  }
  return best;
}

export function pickLivingFaceCell(cells: ShaftCell[]): ShaftCell | null {
  const living = cells.filter((c) => c.role === 'face' && !c.cleared);
  if (!living.length) return null;
  const stone = living.find((c) => c.kind === 'stone');
  return stone ?? living[0] ?? null;
}

export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}
