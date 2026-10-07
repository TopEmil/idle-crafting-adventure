import type { ResourceId } from '../data/resources';
import { RESOURCES } from '../data/resources';

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs < 1000) return (Math.floor(n * 10) / 10).toString().replace(/\.0$/, '');
  if (abs < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
}

export function formatCost(cost: Partial<Record<ResourceId, number>>): string {
  return (Object.entries(cost) as [ResourceId, number][])
    .map(([id, amount]) => {
      const def = RESOURCES.find((r) => r.id === id);
      return `${formatNumber(amount)} ${def?.short ?? id}`;
    })
    .join(' · ');
}

/** Human-readable missing pieces when a cost is not yet affordable. */
export function formatMissingCost(
  cost: Partial<Record<ResourceId, number>>,
  wallet: Record<ResourceId, number>,
): string {
  const missing = (Object.entries(cost) as [ResourceId, number][])
    .map(([id, amount]) => {
      const have = wallet[id] ?? 0;
      const shortfall = amount - have;
      if (shortfall <= 0) return null;
      const def = RESOURCES.find((r) => r.id === id);
      return `${formatNumber(shortfall)} ${def?.short ?? id}`;
    })
    .filter(Boolean);
  return missing.length ? `Need ${missing.join(' · ')}` : '';
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${m.toString().padStart(2, '0')}m`;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r.toString().padStart(2, '0')}s`;
}
