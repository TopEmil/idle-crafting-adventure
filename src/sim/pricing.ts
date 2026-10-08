/** Runtime economy pricing — authored costs × hardness tier. */

import {
  scaleEconomyCost,
  scaleOreGate,
  stationUpgradeCost,
} from '../data/balance';
import type { ExpeditionDef } from '../data/expeditions';
import type { RecipeDef } from '../data/recipes';
import type { ResourceId } from '../data/resources';
import type { StationDef } from '../data/stations';

const DEFAULT_HARDNESS = 2;

export function recipeCost(recipe: RecipeDef): Partial<Record<ResourceId, number>> {
  return scaleEconomyCost(recipe.cost, recipe.costHardness ?? DEFAULT_HARDNESS);
}

export function stationUnlockCost(
  station: StationDef,
): Partial<Record<ResourceId, number>> {
  return scaleEconomyCost(station.unlockCost, station.costHardness ?? DEFAULT_HARDNESS);
}

export function stationLevelCost(
  station: StationDef,
  level: number,
): Partial<Record<ResourceId, number>> {
  const scaled = scaleEconomyCost(
    station.baseCost,
    station.costHardness ?? DEFAULT_HARDNESS,
  );
  const cost: Partial<Record<ResourceId, number>> = {};
  for (const [key, base] of Object.entries(scaled) as [ResourceId, number][]) {
    cost[key] = stationUpgradeCost(base, station.costGrowth, level);
  }
  return cost;
}

export function expeditionCost(
  expedition: ExpeditionDef,
): Partial<Record<ResourceId, number>> {
  return scaleEconomyCost(
    expedition.cost,
    expedition.costHardness ?? DEFAULT_HARDNESS,
  );
}

export function expeditionOreGate(expedition: ExpeditionDef): number {
  return scaleOreGate(
    expedition.unlockAtOreProduced,
    expedition.costHardness ?? DEFAULT_HARDNESS,
  );
}

/** Scale expedition loot ore so returns feel big alongside costs. */
export function expeditionLoot(
  loot: Partial<Record<ResourceId, number>>,
  costHardness: number,
): Partial<Record<ResourceId, number>> {
  return scaleEconomyCost(loot, costHardness);
}
