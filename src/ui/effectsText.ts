import type {
  AchievementDef,
  AchievementRewards,
  AchievementTier,
} from '../data/achievements';
import type { RecipeDef } from '../data/recipes';
import { resourceLabel, type ResourceId } from '../data/resources';
import type { StationDef } from '../data/stations';
import type { TalentDef } from '../data/talents';
import { formatNumber, formatResourceInline } from './format';

function resourceName(id: ResourceId): string {
  return resourceLabel(id);
}

/** Plain-text rewards for toasts / titles. */
export function formatAchievementRewards(rewards: AchievementRewards): string {
  const parts: string[] = [];
  if (rewards.resources) {
    for (const [id, amount] of Object.entries(rewards.resources) as [ResourceId, number][]) {
      parts.push(`+${formatNumber(amount)} ${resourceName(id)}`);
    }
  }
  if (rewards.clickPower) {
    parts.push(`+${Math.round((rewards.clickPower - 1) * 100)}% dig damage`);
  }
  if (rewards.stationOutput) {
    parts.push(`+${Math.round((rewards.stationOutput - 1) * 100)}% stations`);
  }
  if (rewards.autoMine) {
    parts.push(`Dwarf dig +${Math.round(rewards.autoMine * 100)}% rate`);
  }
  return parts.join(' · ') || '—';
}

export function formatAchievementRewardLine(tier: AchievementTier | AchievementDef): string {
  const rewards = 'tiers' in tier ? tier.tiers[0]?.rewards : tier.rewards;
  return rewards ? formatAchievementRewards(rewards) : '—';
}

/** Sheet line with ore icons instead of resource names. */
export function formatAchievementRewardsHtml(rewards: AchievementRewards): string {
  const parts: string[] = [];
  if (rewards.resources) {
    for (const [id, amount] of Object.entries(rewards.resources) as [ResourceId, number][]) {
      parts.push(formatResourceInline(id, `+${formatNumber(amount)}`));
    }
  }
  if (rewards.clickPower) {
    parts.push(`+${Math.round((rewards.clickPower - 1) * 100)}% dig damage`);
  }
  if (rewards.stationOutput) {
    parts.push(`+${Math.round((rewards.stationOutput - 1) * 100)}% stations`);
  }
  if (rewards.autoMine) {
    parts.push(`Dwarf dig +${Math.round(rewards.autoMine * 100)}% rate`);
  }
  return parts.join('<span class="res-sep"> · </span>') || '—';
}

export function formatAchievementRewardLineHtml(
  tier: AchievementTier | AchievementDef,
): string {
  const rewards = 'tiers' in tier ? tier.tiers[0]?.rewards : tier.rewards;
  return rewards ? formatAchievementRewardsHtml(rewards) : '—';
}

export function formatRecipeEffects(recipe: RecipeDef): string {
  const parts: string[] = [];
  const e = recipe.effects;
  if (e.clickPower) parts.push(`Dig damage ×${e.clickPower}`);
  if (e.autoMine) parts.push(`Dwarf dig +${Math.round(e.autoMine * 100)}% rate`);
  if (e.stationOutput) parts.push(`Station output ×${e.stationOutput}`);
  if (e.expeditionLoot) parts.push(`Expedition loot ×${e.expeditionLoot}`);
  if (e.offlineRate) parts.push(`Offline rate ×${e.offlineRate}`);
  return parts.join(' · ') || 'Cosmetic / story unlock';
}

/** Describe the bonus from one talent level (or current total if level > 0). */
export function formatTalentEffects(talent: TalentDef, level: number): string {
  const parts: string[] = [];
  const e = talent.effects;
  const n = Math.max(1, level);
  if (e.clickPowerPerLevel) {
    parts.push(`Dig damage ×${(1 + e.clickPowerPerLevel * n).toFixed(2)}`);
  }
  if (e.stationOutputPerLevel) {
    parts.push(`Station output ×${(1 + e.stationOutputPerLevel * n).toFixed(2)}`);
  }
  if (e.expeditionLootPerLevel) {
    parts.push(`Expedition loot ×${(1 + e.expeditionLootPerLevel * n).toFixed(2)}`);
  }
  if (e.offlineRatePerLevel) {
    parts.push(`Offline rate ×${(1 + e.offlineRatePerLevel * n).toFixed(2)}`);
  }
  if (e.autoMinePerLevel) {
    parts.push(`Dwarf dig +${Math.round(e.autoMinePerLevel * n * 100)}% rate`);
  }
  if (e.expeditionSpeedPerLevel) {
    parts.push(`Expeditions ${Math.round(e.expeditionSpeedPerLevel * n * 100)}% faster`);
  }
  if (e.relicGainPerLevel) {
    parts.push(`Reforge Relics ×${(1 + e.relicGainPerLevel * n).toFixed(2)}`);
  }
  return parts.join(' · ');
}

export function formatTalentPerLevel(talent: TalentDef): string {
  const parts: string[] = [];
  const e = talent.effects;
  if (e.clickPowerPerLevel) {
    parts.push(`+${Math.round(e.clickPowerPerLevel * 100)}% dig / lvl`);
  }
  if (e.stationOutputPerLevel) {
    parts.push(`+${Math.round(e.stationOutputPerLevel * 100)}% stations / lvl`);
  }
  if (e.expeditionLootPerLevel) {
    parts.push(`+${Math.round(e.expeditionLootPerLevel * 100)}% loot / lvl`);
  }
  if (e.offlineRatePerLevel) {
    parts.push(`+${Math.round(e.offlineRatePerLevel * 100)}% offline / lvl`);
  }
  if (e.autoMinePerLevel) {
    parts.push(`+${Math.round(e.autoMinePerLevel * 100)}% dwarf dig / lvl`);
  }
  if (e.expeditionSpeedPerLevel) {
    parts.push(`+${Math.round(e.expeditionSpeedPerLevel * 100)}% scout speed / lvl`);
  }
  if (e.relicGainPerLevel) {
    parts.push(`+${Math.round(e.relicGainPerLevel * 100)}% Relics / lvl`);
  }
  return parts.join(' · ');
}

/** Station input/output rates with ore icons (HTML for sheet rows). */
export function formatStationIO(station: StationDef, level = 1): string {
  const inParts = (Object.entries(station.inputs ?? {}) as [ResourceId, number][]).map(
    ([id, rate]) => formatResourceInline(id, `-${formatNumber(rate * level)}/s`),
  );
  const outParts = (Object.entries(station.outputs) as [ResourceId, number][]).map(
    ([id, rate]) => formatResourceInline(id, `+${formatNumber(rate * level)}/s`),
  );
  const arrow = '<span class="res-sep"> → </span>';
  const flow = [...inParts, ...outParts].join(arrow);
  return `${flow}<span class="res-sep"> · </span>auto while fueled`;
}

export function formatStationUpgradeHint(level: number): string {
  return `Lv ${level} → Lv ${level + 1}: +100% this station’s rates`;
}

export function formatStationSpeedHint(runLevel: number, ownedLevel: number): string {
  if (runLevel >= ownedLevel) {
    return `Speed ${runLevel}/${ownedLevel} — full rate`;
  }
  return `Speed ${runLevel}/${ownedLevel} — throttled to save inputs`;
}
