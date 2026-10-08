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
  | 'mythic_crucible'
  | 'nightiron_pick'
  | 'starshard_lens'
  | 'moss_wedge'
  | 'verdant_pan'
  | 'slag_mitts'
  | 'frost_spike'
  | 'abyss_brace'
  | 'starfall_compass'
  | 'aether_pick'
  | 'core_sigil'
  | 'caravan_banner'
  | 'echo_anvil'
  | 'living_bellows'
  | 'void_lens'
  | 'relic_censer'
  | 'crown_of_depths';

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
    /** Fraction of click power granted as ore/sec by the dwarf miner (sums across recipes). */
    autoMine?: number;
  };
  category: 'tool' | 'gear' | 'forge';
}

export const RECIPES: RecipeDef[] = [
  {
    id: 'copper_pick',
    name: 'Copper Pick',
    description: 'Heavier swings — a forge dwarf joins the dig.',
    cost: { ore: 15 },
    effects: { clickPower: 1.5, autoMine: 0.25 },
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
    id: 'moss_wedge',
    name: 'Moss Wedge',
    description: 'Pries Verdiglass beads from damp galleries.',
    cost: { ore: 80, glowdust: 20, verdiglass: 6 },
    requires: ['vein_lantern'],
    effects: { clickPower: 1.2, autoMine: 0.1 },
    category: 'tool',
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
    id: 'verdant_pan',
    name: 'Verdant Pan',
    description: 'Washes Glowdust clean for the Crucible.',
    cost: { verdiglass: 15, glowdust: 40, ore: 60 },
    requires: ['moss_wedge'],
    effects: { stationOutput: 1.15, offlineRate: 1.08 },
    category: 'forge',
  },
  {
    id: 'alloy_hammer',
    name: 'Alloy Hammer',
    description: 'Heavy strikes for faster forging — and harder dwarf swings.',
    cost: { alloy: 20, emberglass: 60 },
    requires: ['glow_chisel'],
    effects: { clickPower: 1.4, stationOutput: 1.1, autoMine: 0.15 },
    category: 'tool',
  },
  {
    id: 'slag_mitts',
    name: 'Slag Mitts',
    description: 'Handles vent heat without blistering the forge.',
    cost: { emberglass: 80, verdiglass: 12, alloy: 10 },
    requires: ['alloy_hammer'],
    effects: { stationOutput: 1.18, clickPower: 1.1 },
    category: 'gear',
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
    id: 'caravan_banner',
    name: 'Caravan Banner',
    description: 'Marks routes so squads return heavier.',
    cost: { verdiglass: 18, glowdust: 50, alloy: 20 },
    requires: ['scout_kit', 'verdant_pan'],
    effects: { expeditionLoot: 1.2, offlineRate: 1.05 },
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
    id: 'frost_spike',
    name: 'Frost Spike',
    description: 'Splits Frost Seam stone for the dwarf.',
    cost: { verdiglass: 30, alloy: 40, glowdust: 60 },
    requires: ['slag_mitts', 'cyan_lens'],
    effects: { clickPower: 1.3, autoMine: 0.12 },
    category: 'tool',
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
    id: 'echo_anvil',
    name: 'Echo Anvil',
    description: 'Rings stations into a shared tempo.',
    cost: { alloy: 70, verdiglass: 25, emberglass: 100 },
    requires: ['deep_gauntlets', 'frost_spike'],
    effects: { stationOutput: 1.22, offlineRate: 1.1 },
    category: 'forge',
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
    id: 'abyss_brace',
    name: 'Abyss Brace',
    description: 'Steadies picks against Nightiron pockets.',
    cost: { nightiron: 12, alloy: 50, verdiglass: 20 },
    requires: ['frost_spike'],
    effects: { clickPower: 1.25, autoMine: 0.1 },
    category: 'gear',
  },
  {
    id: 'nightiron_pick',
    name: 'Nightiron Pick',
    description: 'Cuts Abyss stone — and wakes a tireless dwarf.',
    cost: { nightiron: 25, alloy: 80, ore: 200 },
    requires: ['alloy_hammer'],
    effects: { clickPower: 1.45, autoMine: 0.2 },
    category: 'tool',
  },
  {
    id: 'starshard_lens',
    name: 'Starshard Lens',
    description: 'Reads Deep Dark seams for richer scout packs.',
    cost: { starshard: 15, nightiron: 20, glowdust: 100 },
    requires: ['cyan_lens', 'nightiron_pick'],
    effects: { expeditionLoot: 1.35, clickPower: 1.2, offlineRate: 1.1 },
    category: 'gear',
  },
  {
    id: 'starfall_compass',
    name: 'Starfall Compass',
    description: 'Points squads toward Starfall Hollow.',
    cost: { starshard: 20, nightiron: 25, verdiglass: 30 },
    requires: ['starshard_lens', 'caravan_banner'],
    effects: { expeditionLoot: 1.28, clickPower: 1.12 },
    category: 'gear',
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
    id: 'living_bellows',
    name: 'Living Bellows',
    description: 'Breath that never cools — even offline.',
    cost: { starshard: 18, alloy: 100, emberglass: 200 },
    requires: ['echo_anvil', 'hearth_bellows'],
    effects: { offlineRate: 1.35, stationOutput: 1.15 },
    category: 'forge',
  },
  {
    id: 'aether_pick',
    name: 'Aether Pick',
    description: 'Cuts the Core — the dwarf never rests.',
    cost: { aetherite: 8, starshard: 25, nightiron: 30 },
    requires: ['nightiron_pick', 'abyss_brace'],
    effects: { clickPower: 1.55, autoMine: 0.25 },
    category: 'tool',
  },
  {
    id: 'void_lens',
    name: 'Void Lens',
    description: 'Sees Aether seams through starlit dust.',
    cost: { aetherite: 6, starshard: 30, glowdust: 120 },
    requires: ['starfall_compass', 'aether_pick'],
    effects: { expeditionLoot: 1.4, clickPower: 1.18 },
    category: 'gear',
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
  {
    id: 'core_sigil',
    name: 'Core Sigil',
    description: 'Brands the Aetherforge with living light.',
    cost: { aetherite: 12, starshard: 40, relics: 3 },
    requires: ['aether_pick', 'living_bellows'],
    effects: { stationOutput: 1.35, offlineRate: 1.2 },
    category: 'forge',
  },
  {
    id: 'relic_censer',
    name: 'Relic Censer',
    description: 'Burns memory into every Reforge.',
    cost: { aetherite: 10, relics: 4, nightiron: 40 },
    requires: ['mythic_crucible', 'void_lens'],
    effects: { clickPower: 1.3, expeditionLoot: 1.25, offlineRate: 1.15 },
    category: 'forge',
  },
  {
    id: 'crown_of_depths',
    name: 'Crown of Depths',
    description: 'The last mark a forge-master earns.',
    cost: { aetherite: 20, starshard: 60, alloy: 400, relics: 8 },
    requires: ['core_sigil', 'relic_censer'],
    effects: { clickPower: 1.6, stationOutput: 1.35, expeditionLoot: 1.3, autoMine: 0.15 },
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
