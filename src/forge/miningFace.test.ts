import { describe, expect, it } from 'vitest';
import {
  createOreRocks,
  damageRock,
  findNearestLivingRock,
  pickLivingRock,
  tickRockRespawns,
} from './miningFace';

describe('mining face', () => {
  it('creates a cluster of living rocks', () => {
    const rocks = createOreRocks(8);
    expect(rocks).toHaveLength(8);
    expect(rocks.every((r) => r.respawn <= 0 && r.hp === r.maxHp)).toBe(true);
  });

  it('cracks then shatters a rock and respawns it', () => {
    const rocks = createOreRocks(1);
    const rock = rocks[0];
    const hitsToBreak = rock.maxHp;
    for (let i = 0; i < hitsToBreak - 1; i++) {
      expect(damageRock(rock)).toBe(false);
      expect(rock.respawn).toBe(0);
    }
    expect(damageRock(rock)).toBe(true);
    expect(rock.respawn).toBeGreaterThan(0);
    tickRockRespawns(rocks, 5);
    expect(rock.respawn).toBe(0);
    expect(rock.hp).toBe(rock.maxHp);
  });

  it('finds nearest living rock and skips shattered ones', () => {
    const rocks = createOreRocks(4);
    const cx = 100;
    const cy = 100;
    const near = findNearestLivingRock(rocks, cx, cy, cx + rocks[0].ox, cy + rocks[0].oy, 80);
    expect(near?.id).toBe(rocks[0].id);
    rocks[0].respawn = 1;
    const next = pickLivingRock(rocks);
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe(rocks[0].id);
  });
});
