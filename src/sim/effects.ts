import { getRecipe, type RecipeId } from '../data/recipes';
import { emptyTalents, getTalent, type TalentId } from '../data/talents';

export interface AggregatedEffects {
  clickPower: number;
  stationOutput: number;
  expeditionLoot: number;
  offlineRate: number;
  /** Summed fraction of click power → ore/sec for the dwarf miner. */
  autoMine: number;
}

export function aggregateEffects(
  ownedRecipes: RecipeId[],
  talents: Record<TalentId, number> = emptyTalents(),
): AggregatedEffects {
  let clickPower = 1;
  let stationOutput = 1;
  let expeditionLoot = 1;
  let offlineRate = 1;
  let autoMine = 0;

  for (const id of ownedRecipes) {
    const effects = getRecipe(id).effects;
    if (effects.clickPower) clickPower *= effects.clickPower;
    if (effects.stationOutput) stationOutput *= effects.stationOutput;
    if (effects.expeditionLoot) expeditionLoot *= effects.expeditionLoot;
    if (effects.offlineRate) offlineRate *= effects.offlineRate;
    if (effects.autoMine) autoMine += effects.autoMine;
  }

  for (const [id, level] of Object.entries(talents) as [TalentId, number][]) {
    if (level <= 0) continue;
    const def = getTalent(id);
    const e = def.effects;
    if (e.clickPowerPerLevel) clickPower *= 1 + e.clickPowerPerLevel * level;
    if (e.stationOutputPerLevel) stationOutput *= 1 + e.stationOutputPerLevel * level;
    if (e.expeditionLootPerLevel) expeditionLoot *= 1 + e.expeditionLootPerLevel * level;
    if (e.offlineRatePerLevel) offlineRate *= 1 + e.offlineRatePerLevel * level;
  }

  return { clickPower, stationOutput, expeditionLoot, offlineRate, autoMine };
}
