import type { ResourceId } from '../data/resources';
import { resourceIconSrc, resourceLabel } from '../data/resources';

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs < 1000) return (Math.floor(n * 10) / 10).toString().replace(/\.0$/, '');
  if (abs < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
}

/** Plain-text cost for titles / toasts (names, no icons). */
export function formatCost(cost: Partial<Record<ResourceId, number>>): string {
  return (Object.entries(cost) as [ResourceId, number][])
    .map(([id, amount]) => `${formatNumber(amount)} ${resourceLabel(id)}`)
    .join(' · ');
}

/** Expedition loot line using the same labels as the inventory strip. */
export function formatLoot(loot: Partial<Record<ResourceId, number>>): string {
  return (Object.entries(loot) as [ResourceId, number][])
    .map(([id, amount]) => `+${formatNumber(amount)} ${resourceLabel(id)}`)
    .join(' · ');
}

export type ResourceInlineOpts = {
  /** Show short resource name next to the icon (used on Expeditions). */
  showLabel?: boolean;
};

/**
 * Inline amount + ore icon for HUD / sheets.
 * Name stays in title/alt by default; pass `showLabel` to render it visibly.
 */
export function formatResourceInline(
  id: ResourceId,
  amountText?: string,
  opts?: ResourceInlineOpts,
): string {
  const label = resourceLabel(id);
  const amount = amountText ? `${amountText} ` : '';
  const name = opts?.showLabel
    ? `<span class="res-label">${label}</span>`
    : '';
  return `<span class="res-inline" title="${label}"><span class="res-amt">${amount}</span><img class="res-icon" src="${resourceIconSrc(id)}" alt="${label}" width="16" height="16" decoding="async" />${name}</span>`;
}

export function formatCostHtml(
  cost: Partial<Record<ResourceId, number>>,
  opts?: ResourceInlineOpts,
): string {
  return (Object.entries(cost) as [ResourceId, number][])
    .map(([id, amount]) => formatResourceInline(id, formatNumber(amount), opts))
    .join('<span class="res-sep"> · </span>');
}

export function formatLootHtml(
  loot: Partial<Record<ResourceId, number>>,
  opts?: ResourceInlineOpts,
): string {
  return (Object.entries(loot) as [ResourceId, number][])
    .map(([id, amount]) => formatResourceInline(id, `+${formatNumber(amount)}`, opts))
    .join('<span class="res-sep"> · </span>');
}

/** Human-readable missing pieces when a cost is not yet affordable (plain text). */
export function formatMissingCost(
  cost: Partial<Record<ResourceId, number>>,
  wallet: Record<ResourceId, number>,
): string {
  const missing = (Object.entries(cost) as [ResourceId, number][])
    .map(([id, amount]) => {
      const have = wallet[id] ?? 0;
      const shortfall = amount - have;
      if (shortfall <= 0) return null;
      return `${formatNumber(shortfall)} ${resourceLabel(id)}`;
    })
    .filter(Boolean);
  return missing.length ? `Need ${missing.join(' · ')}` : '';
}

/** Missing cost with icons for sheet rows. */
export function formatMissingCostHtml(
  cost: Partial<Record<ResourceId, number>>,
  wallet: Record<ResourceId, number>,
  opts?: ResourceInlineOpts,
): string {
  const missing = (Object.entries(cost) as [ResourceId, number][])
    .map(([id, amount]) => {
      const have = wallet[id] ?? 0;
      const shortfall = amount - have;
      if (shortfall <= 0) return null;
      return formatResourceInline(id, formatNumber(shortfall), opts);
    })
    .filter(Boolean);
  if (!missing.length) return '';
  return `Need ${missing.join('<span class="res-sep"> · </span>')}`;
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
