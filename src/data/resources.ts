export type ResourceId =
  | 'ore'
  | 'emberglass'
  | 'glowdust'
  | 'alloy'
  | 'nightiron'
  | 'starshard'
  | 'relics';

export interface ResourceDef {
  id: ResourceId;
  name: string;
  /** HUD / expedition / cost label — keep identical everywhere players see the resource. */
  short: string;
  color: string;
  starting: number;
  /** Hide from the resource strip until the player has some (or earned relics). */
  hideUntilOwned?: boolean;
}

export const RESOURCES: ResourceDef[] = [
  { id: 'ore', name: 'Vein Ore', short: 'Ore', color: '#8FA8B0', starting: 0 },
  { id: 'emberglass', name: 'Emberglass', short: 'Emberglass', color: '#E85D04', starting: 0 },
  { id: 'glowdust', name: 'Glowdust', short: 'Glowdust', color: '#2EC4B6', starting: 0 },
  { id: 'alloy', name: 'Deep Alloy', short: 'Alloy', color: '#F48C06', starting: 0 },
  {
    id: 'nightiron',
    name: 'Nightiron',
    short: 'Nightiron',
    color: '#7B8CDE',
    starting: 0,
    hideUntilOwned: true,
  },
  {
    id: 'starshard',
    name: 'Starshard',
    short: 'Starshard',
    color: '#E8D5A3',
    starting: 0,
    hideUntilOwned: true,
  },
  { id: 'relics', name: 'Reforge Relics', short: 'Relics', color: '#E8F1F2', starting: 0 },
];

export const RESOURCE_IDS = RESOURCES.map((r) => r.id);

export function emptyWallet(): Record<ResourceId, number> {
  return {
    ore: 0,
    emberglass: 0,
    glowdust: 0,
    alloy: 0,
    nightiron: 0,
    starshard: 0,
    relics: 0,
  };
}

export function getResource(id: ResourceId): ResourceDef {
  const def = RESOURCES.find((r) => r.id === id);
  if (!def) {
    throw new Error(`Unknown resource: ${id}`);
  }
  return def;
}

/** Shared display name for inventory strip, expedition costs/loot, and floating mine labels. */
export function resourceLabel(id: ResourceId): string {
  return getResource(id).short;
}

export function resourceIconSrc(id: ResourceId): string {
  return `${import.meta.env.BASE_URL}art/ores/${id}.png`;
}
