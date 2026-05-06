/**
 * Map and tile-type model factories.
 *
 * Maps hold the hex/square grid. Tile types (biomes) define how
 * each cell looks and behaves. Both are per-campaign.
 */
import { newId } from './id.js'

// ── Default tile types ────────────────────────────────────────────
// These are the built-in biomes every new campaign starts with.
// Organizers can add, edit, or delete them freely.
const DEFAULT_TILE_TYPE_DATA = [
  { key: 'grassland', name: 'Grassland', color: '#4a7c59', border: '#3a6045', icon: '🌿', textColor: '#d4f0da', walkable: true  },
  { key: 'plains',    name: 'Plains',    color: '#8a9a4a', border: '#6a7830', icon: '🌾', textColor: '#eef0cc', walkable: true  },
  { key: 'forest',    name: 'Forest',    color: '#2d5a3a', border: '#1e3e28', icon: '🌲', textColor: '#a8d4b0', walkable: true  },
  { key: 'water',     name: 'Water',     color: '#2a5a8a', border: '#1a4070', icon: '🌊', textColor: '#b8d8f8', walkable: false },
  { key: 'ocean',     name: 'Ocean',     color: '#1a3a6a', border: '#102850', icon: '🌊', textColor: '#90c0f0', walkable: false },
  { key: 'mountain',  name: 'Mountain',  color: '#6a6a6a', border: '#4a4a4a', icon: '⛰️',  textColor: '#e8e8e8', walkable: false },
  { key: 'desert',    name: 'Desert',    color: '#a88040', border: '#806020', icon: '🏜️', textColor: '#f8e8b0', walkable: true  },
  { key: 'swamp',     name: 'Swamp',     color: '#4a6a3a', border: '#2a4a20', icon: '🍄', textColor: '#c0d8a0', walkable: true  },
  { key: 'snow',      name: 'Snow',      color: '#8090b0', border: '#607090', icon: '❄️',  textColor: '#e8eef8', walkable: true  },
  { key: 'lava',      name: 'Lava',      color: '#9a3010', border: '#701800', icon: '🌋', textColor: '#ffc8a0', walkable: false },
  { key: 'path',      name: 'Path',      color: '#907060', border: '#705040', icon: '🛤️', textColor: '#f0e0d0', walkable: true  },
  { key: 'town',      name: 'Town',      color: '#806080', border: '#604060', icon: '🏘️', textColor: '#f0d8f0', walkable: true  },
  { key: 'dungeon',   name: 'Dungeon',   color: '#303050', border: '#181830', icon: '🗝️', textColor: '#c0c0e0', walkable: true  },
  { key: 'ruins',     name: 'Ruins',     color: '#706050', border: '#504030', icon: '🏛️', textColor: '#e0d0b0', walkable: true  },
  { key: 'cave',      name: 'Cave',      color: '#404050', border: '#202030', icon: '🕳️', textColor: '#b0b0c8', walkable: true  },
  { key: 'field',     name: 'Field',     color: '#7a9030', border: '#5a7010', icon: '🌻', textColor: '#e8f0a0', walkable: true  },
]

export function makeDefaultTileTypes() {
  return Object.fromEntries(
    DEFAULT_TILE_TYPE_DATA.map(({ key, name, color, border, icon, textColor, walkable }) => [
      key,
      {
        id: key,
        name,
        color,
        border,
        textColor,
        icon,
        walkable,
        traits: [],
        statusEffects: [],
        displayBackground: null,
        overlay: false,
        overlayOpacity: 0.5,
        createdAt: new Date().toISOString(),
      },
    ])
  )
}

export function makeTileType(overrides = {}) {
  return {
    id: newId(),
    name: 'New Tile Type',
    color: '#4a7c59',
    border: '#3a6045',
    textColor: '#d4f0da',
    icon: '',
    walkable: true,
    traits: [],
    statusEffects: [],
    displayBackground: null,
    overlay: false,
    overlayOpacity: 0.5,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Map factory ───────────────────────────────────────────────────
export function makeMap(overrides = {}) {
  return {
    id: newId(),
    name: 'New Map',
    description: '',
    cols: 18,
    rows: 14,
    defaultBiome: 'grassland',
    parentMapId: null,          // for nested/sub-maps
    tileStyle: 'hex',           // 'hex' | 'square'
    backgroundImage: null,      // base64 image — rendered behind the tile grid
    bgImgWidth: null,           // natural pixel width of backgroundImage (for aspect ratio)
    bgImgHeight: null,          // natural pixel height of backgroundImage
    bgCols: null,               // how many tile-columns the image spans (null = map.cols)
    bgOffsetX: 0,               // horizontal shift in tile units (can be fractional)
    bgOffsetY: 0,               // vertical shift in tile units (can be fractional)
    tiles: {},                  // { 'q,r': Tile }
    firedEvents: {},            // { 'q,r': { color, label, firedAt } } — active visual overlays
    eventLog: [],               // [{ id, eventId, eventName, sourceTile, firedAt }]
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Tile helper ───────────────────────────────────────────────────
// Creates an empty tile with default values. Used internally when
// a tile key doesn't exist in map.tiles yet.
export function makeTile(biome = 'grassland') {
  return {
    biome,
    label: '',
    notes: '',        // organizer only
    tokens: [],       // actorIds present on this tile
    events: [],       // [Event]
    activeStatuses: [], // [{ statusId, appliedAt, originalWalkable? }]
  }
}
