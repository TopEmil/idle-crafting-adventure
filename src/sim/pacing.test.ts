import { describe, expect, it } from 'vitest';
import {
  BEATS,
  band,
  formatPacingReport,
  runOptimalPacing,
} from './pacing';

describe('pacing harness', () => {
  it('band applies ±20% around a point target', () => {
    expect(band(600)).toEqual({ minSec: 480, maxSec: 720 });
    expect(band(100, 0.1)).toEqual({ minSec: 90, maxSec: 110 });
    expect(band(57)).toEqual({ minSec: 45.6, maxSec: 68.4 });
  });

  it('optimal 4 CPS bot hits design beats within windows', () => {
    const result = runOptimalPacing();
    // Surface the report in vitest output on failure.
    expect(result.failures, result.report).toEqual([]);
    expect(result.ok).toBe(true);

    const { timestamps: t } = result;
    expect(t.copperPickSec).toBeGreaterThanOrEqual(BEATS.copperPick.minSec);
    expect(t.copperPickSec).toBeLessThanOrEqual(BEATS.copperPick.maxSec);

    expect(t.smelterSec).toBeGreaterThanOrEqual(BEATS.smelter.minSec);
    expect(t.smelterSec).toBeLessThanOrEqual(BEATS.smelter.maxSec);

    expect(t.expeditionClaimSec).toBeGreaterThanOrEqual(BEATS.expeditionClaim.minSec);
    expect(t.expeditionClaimSec).toBeLessThanOrEqual(BEATS.expeditionClaim.maxSec);

    expect(t.reforgeReadySec).toBeGreaterThanOrEqual(BEATS.reforgeReady.minSec);
    expect(t.reforgeReadySec).toBeLessThanOrEqual(BEATS.reforgeReady.maxSec);
  });

  it('prints a readable pacing report', () => {
    const result = runOptimalPacing();
    const report = formatPacingReport(result.timestamps, result.failures);
    expect(report).toContain('Embervein pacing report');
    expect(report).toMatch(/Copper Pick/);
    expect(report).toMatch(/Smelter unlock/);
    expect(report).toMatch(/expedition claim/i);
    expect(report).toMatch(/Reforge ready/);
    // Always log once so `npm run test:pacing` shows timings.
    console.log(`\n${report}\n`);
  });
});
