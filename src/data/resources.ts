export type ResourceId =
  | 'ore'
  | 'emberglass'
  | 'glowdust'
  | 'alloy'
  | 'verdiglass'
  | 'nightiron'
  | 'starshard'
  | 'aetherite'
  | 'relics';

export interface ResourceDef {
  id: ResourceId;
  name: string;
  short: string;
  color: string;
  starting: number;
  /** Hide from the resource strip until the player has some (or earned relics). */
  hideUntilOwned?: boolean;
}

export const RESOURCES: ResourceDef[] = [
  { id: 'ore', name: 'Vein Ore', short: 'Ore', color: '#8FA8B0', starting: 0 },
  { id: 'emberglass', name: 'Emberglass', short: 'Glass', color: '#E85D04', starting: 0 },
  { id: 'glowdust', name: 'Glowdust', short: 'Dust', color: '#2EC4B6', starting: 0 },
  { id: 'alloy', name: 'Deep Alloy', short: 'Alloy', color: '#F48C06', starting: 0 },
  {
    id: 'verdiglass',
    name: 'Verdiglass',
    short: 'Verd',
    color: '#6BBF59',
    starting: 0,
    hideUntilOwned: true,
  },
  {
    id: 'nightiron',
    name: 'Nightiron',
    short: 'Night',
    color: '#7B8CDE',
    starting: 0,
    hideUntilOwned: true,
  },
  {
    id: 'starshard',
    name: 'Starshard',
    short: 'Shard',
    color: '#E8D5A3',
    starting: 0,
    hideUntilOwned: true,
  },
  {
    id: 'aetherite',
    name: 'Aetherite',
    short: 'Aether',
    color: '#9ED8E0',
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
    verdiglass: 0,
    nightiron: 0,
    starshard: 0,
    aetherite: 0,
    relics: 0,
  };
}
