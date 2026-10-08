import type { AchievementDef, AchievementRewards } from '../data/achievements';
import type { RecipeDef } from '../data/recipes';
import { RESOURCES, type ResourceId } from '../data/resources';
import type { StationDef } from '../data/stations';
import type { TalentDef } from '../data/talents';
import { formatNumber } from './format';

function resourceName(id: ResourceId): string {
  return RESOURCES.find((r) => r.id === id)?.short ?? id;
}

export function formatAchievementRewards(rewards: AchievementRewards): string {
  const parts: string[] = [];
  if (rewards.resources) {
    for (const [id, amount] of Object.entries(rewards.resources) as [ResourceId, number][]) {
      parts.push(`+${formatNumber(amount)} ${resourceName(id)}`);
    }
  }
  if (rewards.clickPower) {
    parts.push(`+${Math.round((rewards.clickPower - 1) * 100)}% tap`);
  }
  if (rewards.stationOutput) {
    parts.push(`+${Math.round((rewards.stationOutput - 1) * 100)}% stations`);
  }
  if (rewards.autoMine) {
    parts.push(`Dwarf mine +${Math.round(rewards.autoMine * 100)}% tap/s`);
  }
  return parts.join(' · ') || '—';
}

export function formatAchievementRewardLine(def: AchievementDef): string {
  return formatAchievementRewards(def.rewards);
}

export function formatRecipeEffects(recipe: RecipeDef): string {
  const parts: string[] = [];
  const e = recipe.effects;
  if (e.clickPower) parts.push(`Tap power ×${e.clickPower}`);
  if (e.autoMine) parts.push(`Dwarf mine +${Math.round(e.autoMine * 100)}% tap/s`);
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
    parts.push(`Tap power ×${(1 + e.clickPowerPerLevel * n).toFixed(2)}`);
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
    parts.push(`Dwarf mine +${Math.round(e.autoMinePerLevel * n * 100)}% tap/s`);
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
    parts.push(`+${Math.round(e.clickPowerPerLevel * 100)}% tap / lvl`);
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
    parts.push(`+${Math.round(e.autoMinePerLevel * 100)}% dwarf / lvl`);
  }
  if (e.expeditionSpeedPerLevel) {
    parts.push(`+${Math.round(e.expeditionSpeedPerLevel * 100)}% scout speed / lvl`);
  }
  if (e.relicGainPerLevel) {
    parts.push(`+${Math.round(e.relicGainPerLevel * 100)}% Relics / lvl`);
  }
  return parts.join(' · ');
}

export function formatStationIO(station: StationDef, level = 1): string {
  const inParts = (Object.entries(station.inputs ?? {}) as [ResourceId, number][]).map(
    ([id, rate]) => `-${formatNumber(rate * level)}/s ${resourceName(id)}`,
  );
  const outParts = (Object.entries(station.outputs) as [ResourceId, number][]).map(
    ([id, rate]) => `+${formatNumber(rate * level)}/s ${resourceName(id)}`,
  );
  const flow = [...inParts, ...outParts].join(' → ');
  return `${flow} · auto while fueled`;
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
