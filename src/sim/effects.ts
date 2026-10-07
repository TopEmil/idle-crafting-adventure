import { getRecipe, type RecipeId } from '../data/recipes';

export interface AggregatedEffects {
  clickPower: number;
  stationOutput: number;
  expeditionLoot: number;
  offlineRate: number;
}

export function aggregateEffects(ownedRecipes: RecipeId[]): AggregatedEffects {
  let clickPower = 1;
  let stationOutput = 1;
  let expeditionLoot = 1;
  let offlineRate = 1;

  for (const id of ownedRecipes) {
    const effects = getRecipe(id).effects;
    if (effects.clickPower) clickPower *= effects.clickPower;
    if (effects.stationOutput) stationOutput *= effects.stationOutput;
    if (effects.expeditionLoot) expeditionLoot *= effects.expeditionLoot;
    if (effects.offlineRate) offlineRate *= effects.offlineRate;
  }

  return { clickPower, stationOutput, expeditionLoot, offlineRate };
}
