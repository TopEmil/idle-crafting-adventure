/** Breakable ore rocks + dwarf miner helpers for the forge scene. */

export interface OreRock {
  id: number;
  /** Offset from vein center */
  ox: number;
  oy: number;
  w: number;
  h: number;
  rot: number;
  hp: number;
  maxHp: number;
  /** Countdown while shattered; ≤0 means visible */
  respawn: number;
  seed: number;
  tint: number;
}

export function createOreRocks(count = 10): OreRock[] {
  const rocks: OreRock[] = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + (i % 3) * 0.17;
    const dist = 28 + (i % 5) * 14 + (i % 2) * 8;
    const maxHp = 2 + (i % 3);
    rocks.push({
      id: i,
      ox: Math.cos(ang) * dist * 0.95,
      oy: Math.sin(ang) * dist * 0.62 - 4,
      w: 28 + (i % 4) * 8,
      h: 22 + (i % 3) * 6,
      rot: (i * 0.7) % 1.2 - 0.6,
      hp: maxHp,
      maxHp,
      respawn: 0,
      seed: 1.1 + i * 0.37,
      // Cool stone tones that sit on the timber-framed shaft backdrop
      tint: i % 3 === 0 ? 0x3a4a52 : i % 3 === 1 ? 0x2c383f : 0x46565e,
    });
  }
  return rocks;
}

export function rockWorldPos(
  rock: OreRock,
  cx: number,
  cy: number,
): { x: number; y: number } {
  return { x: cx + rock.ox, y: cy + rock.oy };
}

export function findNearestLivingRock(
  rocks: OreRock[],
  cx: number,
  cy: number,
  px: number,
  py: number,
  maxDist: number,
): OreRock | null {
  let best: OreRock | null = null;
  let bestD = maxDist * maxDist;
  for (const rock of rocks) {
    if (rock.respawn > 0) continue;
    const { x, y } = rockWorldPos(rock, cx, cy);
    const dx = px - x;
    const dy = py - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = rock;
    }
  }
  return best;
}

export function pickLivingRock(rocks: OreRock[], preferId?: number): OreRock | null {
  const living = rocks.filter((r) => r.respawn <= 0);
  if (!living.length) return null;
  if (preferId != null) {
    const preferred = living.find((r) => r.id === preferId);
    if (preferred) return preferred;
  }
  return living[Math.floor(Math.random() * living.length)] ?? null;
}

/** Returns true if the rock shattered this hit. */
export function damageRock(rock: OreRock, amount = 1): boolean {
  if (rock.respawn > 0) return false;
  rock.hp -= amount;
  if (rock.hp <= 0) {
    rock.respawn = 1.1 + Math.random() * 0.7;
    rock.hp = rock.maxHp;
    return true;
  }
  return false;
}

export function tickRockRespawns(rocks: OreRock[], dt: number): void {
  for (const rock of rocks) {
    if (rock.respawn > 0) {
      rock.respawn = Math.max(0, rock.respawn - dt);
    }
  }
}
