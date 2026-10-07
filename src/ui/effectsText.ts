import type { RecipeDef } from '../data/recipes';
import { RESOURCES, type ResourceId } from '../data/resources';
import type { StationDef } from '../data/stations';
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
