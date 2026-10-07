import { stratumAtDepth, type StratumDef } from '../data/strata';

export const SHAFT_COLS = 5;
export const SHAFT_LOOKAHEAD = 4;
export const SHAFT_LOOKBEHIND = 2;

export interface ShaftCell {
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  tint: number;
  fleck: number;
  seed: number;
  /** True when this cell is fully excavated */
  cleared: boolean;
  /** Dig face = current depth row; others are preview / history */
  role: 'history' | 'face' | 'ahead';
}

/** Persisted dig progress — regenerates the shaft deterministically. */
export interface MineShaftProgress {
  /** Rows fully cleared */
  depth: number;
  /** Hits applied to the current dig face (left-to-right across cells) */
  faceHits: number;
}

export function createMineShaftProgress(depth = 0, faceHits = 0): MineShaftProgress {
  return {
    depth: Math.max(0, Math.floor(depth)),
    faceHits: Math.max(0, Math.floor(faceHits)),
  };
}

function cellMaxHp(row: number, col: number): number {
  const stratum = stratumAtDepth(row);
  // Slight column variance so the face doesn't shatter as a flat bar
  return stratum.hardness + ((row * 3 + col * 7) % 2);
}

function cellSeed(row: number, col: number): number {
  return 1.1 + row * 0.37 + col * 0.19;
}

function cellTint(stratum: StratumDef, row: number, col: number): number {
  const shift = ((row + col) % 3) * 0x060808;
  return (stratum.tint + shift) & 0xffffff;
}

export function faceTotalHp(depth: number): number {
  let total = 0;
  for (let col = 0; col < SHAFT_COLS; col++) {
    total += cellMaxHp(depth, col);
  }
  return total;
}

/** Distribute faceHits across dig-row cells left → right. */
export function faceCellHp(depth: number, faceHits: number, col: number): number {
  let remaining = faceHits;
  for (let c = 0; c < SHAFT_COLS; c++) {
    const max = cellMaxHp(depth, c);
    if (c === col) {
      return Math.max(0, max - remaining);
    }
    remaining = Math.max(0, remaining - max);
  }
  return 0;
}

export function normalizeProgress(progress: MineShaftProgress): MineShaftProgress {
  let depth = Math.max(0, Math.floor(progress.depth));
  let faceHits = Math.max(0, Math.floor(progress.faceHits));
  // Carry overflow hits into deeper rows (offline / large dig batches)
  for (let guard = 0; guard < 10_000; guard++) {
    const need = faceTotalHp(depth);
    if (faceHits < need) break;
    faceHits -= need;
    depth += 1;
  }
  return { depth, faceHits };
}

export interface DigResult {
  progress: MineShaftProgress;
  /** A face cell shattered this dig */
  shattered: boolean;
  /** One or more full rows cleared */
  rowsCleared: number;
  /** Depth after dig */
  depth: number;
  stratum: StratumDef;
}

/** Apply dig hits to the shaft face. Pure; returns new progress. */
export function digShaft(progress: MineShaftProgress, hits = 1): DigResult {
  const before = normalizeProgress(progress);
  let depth = before.depth;
  let faceHits = before.faceHits;
  let shattered = false;
  let rowsCleared = 0;

  let remaining = Math.max(0, Math.floor(hits));
  while (remaining > 0) {
    const colHpBefore: number[] = [];
    for (let col = 0; col < SHAFT_COLS; col++) {
      colHpBefore.push(faceCellHp(depth, faceHits, col));
    }
    // Hit the leftmost living cell (feels like mining across the face)
    let targetCol = colHpBefore.findIndex((hp) => hp > 0);
    if (targetCol < 0) {
      // Face already clear — normalize will advance
      const advanced = normalizeProgress({ depth, faceHits: faceHits + 1 });
      if (advanced.depth > depth) {
        rowsCleared += advanced.depth - depth;
        depth = advanced.depth;
        faceHits = advanced.faceHits;
        shattered = true;
      }
      remaining -= 1;
      continue;
    }

    faceHits += 1;
    remaining -= 1;
    const hpAfter = faceCellHp(depth, faceHits, targetCol);
    if (colHpBefore[targetCol]! > 0 && hpAfter <= 0) {
      shattered = true;
    }

    const need = faceTotalHp(depth);
    if (faceHits >= need) {
      faceHits -= need;
      depth += 1;
      rowsCleared += 1;
    }
  }

  const progressOut = normalizeProgress({ depth, faceHits });
  return {
    progress: progressOut,
    shattered,
    rowsCleared,
    depth: progressOut.depth,
    stratum: stratumAtDepth(progressOut.depth),
  };
}

/** Build visible cells around the dig face for rendering. */
export function buildShaftCells(progress: MineShaftProgress): ShaftCell[] {
  const { depth, faceHits } = normalizeProgress(progress);
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
      const maxHp = cellMaxHp(row, col);
      let hp: number;
      let cleared: boolean;
      if (role === 'history') {
        hp = 0;
        cleared = true;
      } else if (role === 'face') {
        hp = faceCellHp(depth, faceHits, col);
        cleared = hp <= 0;
      } else {
        hp = maxHp;
        cleared = false;
      }
      cells.push({
        row,
        col,
        hp,
        maxHp,
        tint: cellTint(stratum, row, col),
        fleck: stratum.fleck,
        seed: cellSeed(row, col),
        cleared,
        role,
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
  return living[0] ?? null;
}

export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}
