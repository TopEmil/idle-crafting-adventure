import type { ResourceId } from './resources';

export type RecipeId =
  | 'copper_pick'
  | 'ember_tongs'
  | 'vein_lantern'
  | 'glow_chisel'
  | 'alloy_hammer'
  | 'scout_kit'
  | 'hearth_bellows'
  | 'cyan_lens'
  | 'deep_gauntlets'
  | 'resonance_core'
  | 'forge_crown'
  | 'mythic_crucible';

export interface RecipeDef {
  id: RecipeId;
  name: string;
  description: string;
  cost: Partial<Record<ResourceId, number>>;
  requires?: RecipeId[];
  /** Multipliers applied once owned */
  effects: {
    clickPower?: number;
    stationOutput?: number;
    expeditionLoot?: number;
    offlineRate?: number;
  };
  category: 'tool' | 'gear' | 'forge';
}

export const RECIPES: RecipeDef[] = [
  {
    id: 'copper_pick',
    name: 'Copper Pick',
    description: 'Sharper taps on the ore vein.',
    cost: { ore: 15 },
    effects: { clickPower: 1.5 },
    category: 'tool',
  },
  {
    id: 'ember_tongs',
    name: 'Ember Tongs',
    description: 'Safer handling of hot glass.',
    cost: { ore: 40, emberglass: 10 },
    requires: ['copper_pick'],
    effects: { stationOutput: 1.15 },
    category: 'tool',
  },
  {
    id: 'vein_lantern',
    name: 'Vein Lantern',
    description: 'Reveals richer ore seams.',
    cost: { emberglass: 25, glowdust: 15 },
    requires: ['ember_tongs'],
    effects: { clickPower: 1.35, offlineRate: 1.1 },
    category: 'gear',
  },
  {
    id: 'glow_chisel',
    name: 'Glow Chisel',
    description: 'Precision cuts for Alloy work.',
    cost: { ore: 120, glowdust: 30 },
    requires: ['vein_lantern'],
    effects: { stationOutput: 1.2 },
    category: 'tool',
  },
  {
    id: 'alloy_hammer',
    name: 'Alloy Hammer',
    description: 'Heavy strikes for faster forging.',
    cost: { alloy: 20, emberglass: 60 },
    requires: ['glow_chisel'],
    effects: { clickPower: 1.4, stationOutput: 1.1 },
    category: 'tool',
  },
  {
    id: 'scout_kit',
    name: 'Scout Kit',
    description: 'Better packs for expedition loot.',
    cost: { alloy: 15, glowdust: 40, ore: 100 },
    requires: ['vein_lantern'],
    effects: { expeditionLoot: 1.25 },
    category: 'gear',
  },
  {
    id: 'hearth_bellows',
    name: 'Hearth Bellows',
    description: 'Keeps the forge roaring offline.',
    cost: { emberglass: 100, alloy: 25 },
    requires: ['alloy_hammer'],
    effects: { offlineRate: 1.25, stationOutput: 1.12 },
    category: 'forge',
  },
  {
    id: 'cyan_lens',
    name: 'Cyan Lens',
    description: 'Reads mineral veins from afar.',
    cost: { glowdust: 80, alloy: 35 },
    requires: ['scout_kit'],
    effects: { expeditionLoot: 1.3, clickPower: 1.15 },
    category: 'gear',
  },
  {
    id: 'deep_gauntlets',
    name: 'Deep Gauntlets',
    description: 'Grip molten work without flinching.',
    cost: { alloy: 60, emberglass: 150 },
    requires: ['hearth_bellows'],
    effects: { stationOutput: 1.25 },
    category: 'gear',
  },
  {
    id: 'resonance_core',
    name: 'Resonance Core',
    description: 'Harmonizes station rhythms.',
    cost: { glowdust: 120, alloy: 80, emberglass: 80 },
    requires: ['cyan_lens', 'deep_gauntlets'],
    effects: { stationOutput: 1.3, offlineRate: 1.15 },
    category: 'forge',
  },
  {
    id: 'forge_crown',
    name: 'Forge Crown',
    description: 'Marks a master smith.',
    cost: { alloy: 150, glowdust: 150, relics: 2 },
    requires: ['resonance_core'],
    effects: { clickPower: 1.5, expeditionLoot: 1.2 },
    category: 'forge',
  },
  {
    id: 'mythic_crucible',
    name: 'Mythic Crucible',
    description: 'The forge remembers every Reforge.',
    cost: { alloy: 300, glowdust: 250, emberglass: 400, relics: 5 },
    requires: ['forge_crown'],
    effects: { stationOutput: 1.4, offlineRate: 1.3, clickPower: 1.25 },
    category: 'forge',
  },
];

export function getRecipe(id: RecipeId): RecipeDef {
  const recipe = RECIPES.find((r) => r.id === id);
  if (!recipe) {
    throw new Error(`Unknown recipe: ${id}`);
  }
  return recipe;
}
