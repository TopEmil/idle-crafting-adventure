import type { RecipeDef } from '../data/recipes';
import { RESOURCES, type ResourceId } from '../data/resources';
import type { StationDef } from '../data/stations';
import type { TalentDef } from '../data/talents';
import { formatNumber } from './format';

function resourceName(id: ResourceId): string {
  return RESOURCES.find((r) => r.id === id)?.short ?? id;
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
