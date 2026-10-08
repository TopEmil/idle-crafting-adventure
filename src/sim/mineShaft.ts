import { BALANCE } from '../data/balance';
import { resourceLabel, type ResourceId } from '../data/resources';
import { depthOreMult, stratumAtDepth, type StratumDef } from '../data/strata';

export const SHAFT_COLS = 8;
export const SHAFT_LOOKAHEAD = 5;
export const SHAFT_LOOKBEHIND = 3;

export type TileKind =
  | 'stone'
  | 'glow'
  | 'verdant'
  | 'ember'
  | 'geode'
  | 'night'
  | 'star'
  | 'aether';

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
    faceDamage: dmg.map((n) => Math.max(0, Number(n) || 0)),
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
  const rareBoost = Math.min(0.07, row * 0.0007);
  if (roll < 0.065 + rareBoost) return 'glow';
  if (roll < 0.095 + rareBoost * 1.2 && stratum.startDepth >= 6) return 'verdant';
  if (roll < 0.125 + rareBoost * 1.4 && stratum.startDepth >= 12) return 'ember';
  if (roll < 0.15 + rareBoost * 1.7 && stratum.startDepth >= 30) return 'geode';
  if (roll < 0.17 + rareBoost * 2 && stratum.startDepth >= 55) return 'night';
  if (roll < 0.188 + rareBoost * 2.1 && stratum.startDepth >= 90) return 'star';
  if (roll < 0.205 + rareBoost * 2.3 && stratum.startDepth >= 175) return 'aether';
  // Early glow pockets even in shallows
  if (stratum.id === 'glow_shallows' && roll < 0.09) return 'glow';
  if (stratum.id === 'moss_gallery' && roll < 0.11) return 'verdant';
  return 'stone';
}

function cellMaxHp(row: number, col: number): number {
  const stratum = stratumAtDepth(row);
  const kind = tileKindAt(row, col);
  const h = stratum.hardness;
  // Rare pockets stay meaningfully tougher as hardness doubles each stratum.
  let kindMult = 0;
  switch (kind) {
    case 'stone':
      kindMult = 0;
      break;
    case 'glow':
    case 'verdant':
    case 'ember':
      kindMult = 0.25;
      break;
    case 'geode':
    case 'night':
      kindMult = 0.5;
      break;
    case 'star':
    case 'aether':
      kindMult = 0.75;
      break;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
  const jitter = ((row * 3 + col * 7) % 2) * Math.max(1, Math.round(h * 0.1));
  return Math.max(1, Math.round(h * (1 + kindMult)) + jitter);
}

function cellTint(stratum: StratumDef, row: number, col: number, kind: TileKind): number {
  if (kind === 'glow') return 0x2a5a58;
  if (kind === 'verdant') return 0x2a4a32;
  if (kind === 'ember') return 0x5a3a28;
  if (kind === 'geode') return 0x3a3a5a;
  if (kind === 'night') return 0x2a2a48;
  if (kind === 'star') return 0x4a4530;
  if (kind === 'aether') return 0x2a4850;
  const shift = ((row + col) % 3) * 0x060808;
  return (stratum.tint + shift) & 0xffffff;
}

function cellFleck(stratum: StratumDef, kind: TileKind): number {
  if (kind === 'glow') return 0x2ec4b6;
  if (kind === 'verdant') return 0x6bbf59;
  if (kind === 'ember') return 0xe85d04;
  if (kind === 'geode') return 0xa8c8e8;
  if (kind === 'night') return 0x7b8cde;
  if (kind === 'star') return 0xe8d5a3;
  if (kind === 'aether') return 0x9ed8e0;
  return stratum.fleck;
}

export function faceCellHp(depth: number, faceDamage: number[], col: number): number {
  const max = cellMaxHp(depth, col);
  const dmg = faceDamage[col] ?? 0;
  return Math.max(0, max - dmg);
}

/**
 * Fixed ore payout when a face cell shatters.
 * Uses stratum veinOre × depth flavor — not dig damage or raw hardness.
 */
export function oreYieldAtDepth(depth: number): number {
  const stratum = stratumAtDepth(depth);
  return Math.max(
    1,
    Math.round(BALANCE.baseVeinOre * stratum.veinOre * depthOreMult(depth)),
  );
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
  // Keep fractional damage so dig-damage multipliers (e.g. ×1.05) accumulate.
  faceDamage = faceDamage.slice(0, SHAFT_COLS).map((n) => Math.max(0, Number(n) || 0));

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
      return { resource: 'glowdust', amount: 2, label: resourceLabel('glowdust') };
    case 'verdant':
      return { resource: 'verdiglass', amount: 1, label: resourceLabel('verdiglass') };
    case 'ember':
      return { resource: 'emberglass', amount: 1, label: resourceLabel('emberglass') };
    case 'geode':
      return { resource: 'alloy', amount: 1, label: resourceLabel('alloy') };
    case 'night':
      return { resource: 'nightiron', amount: 1, label: resourceLabel('nightiron') };
    case 'star':
      return { resource: 'starshard', amount: 1, label: resourceLabel('starshard') };
    case 'aether':
      return { resource: 'aetherite', amount: 1, label: resourceLabel('aetherite') };
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
  /** Ore granted from shattered cells this call (0 if nothing broke). */
  oreYield: number;
  /** Active-only rare loot (null for stone or auto digs) */
  loot: TileLoot | null;
}

/** Prefer ordinary stone so rares wait for the player; leftmost living otherwise. */
export function pickAutoCol(depth: number, faceDamage: number[]): number {
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

/**
 * Apply dig strikes. Each strike deals `damage` to one face cell;
 * overkill does not spill to the next cell (max one shatter per strike).
 * Player can target a column; auto prefers stone.
 */
export function digShaft(
  progress: MineShaftProgress,
  damage = 1,
  opts?: { col?: number; mode?: DigMode; strikes?: number },
): DigResult {
  const mode: DigMode = opts?.mode ?? 'player';
  const strikeDamage = Math.max(0, damage);
  let strikesLeft = Math.max(1, Math.floor(opts?.strikes ?? 1));
  let { depth, faceDamage } = normalizeProgress(progress);
  faceDamage = [...faceDamage];

  let shattered = false;
  let rowsCleared = 0;
  let hitCol = 0;
  let hitKind: TileKind = 'stone';
  let oreYield = 0;
  let loot: TileLoot | null = null;

  while (strikesLeft > 0) {
    strikesLeft -= 1;

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
      continue;
    }

    hitCol = targetCol;
    hitKind = tileKindAt(depth, targetCol);
    const hpBefore = faceCellHp(depth, faceDamage, targetCol);
    if (hpBefore <= 0 || strikeDamage <= 0) continue;

    // Cap applied damage at remaining HP — overkill is wasted (no spillover).
    const applied = Math.min(strikeDamage, hpBefore);
    faceDamage[targetCol] = (faceDamage[targetCol] ?? 0) + applied;

    if (faceCellHp(depth, faceDamage, targetCol) <= 0) {
      shattered = true;
      oreYield += oreYieldAtDepth(depth);
      if (mode === 'player') {
        const found = lootForTile(hitKind);
        if (found) loot = found;
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
    oreYield,
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

/** Visual twin of pickAutoCol — prefers living stone on the dig face. */
export function pickLivingFaceCell(cells: ShaftCell[]): ShaftCell | null {
  const living = cells.filter((c) => c.role === 'face' && !c.cleared);
  if (!living.length) return null;
  const stone = living.find((c) => c.kind === 'stone');
  return stone ?? living[0] ?? null;
}

export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}
