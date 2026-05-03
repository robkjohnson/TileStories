import { create } from 'zustand'

// ── ID generator ──────────────────────────────────────────────
export function newId() {
  return Math.random().toString(36).slice(2, 10)
}

// ── Default tile type definitions (used for migration + new campaigns) ─────
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

// ── Tile Types ────────────────────────────────────────────────
export function makeTileType(overrides = {}) {
  return {
    id: newId(),
    name: 'New Tile Type',
    color: '#4a7c59',
    border: '#3a6045',
    textColor: '#d4f0da',
    icon: '',
    walkable: true,
    statusEffects: [],
    displayBackground: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makeDefaultTileTypes() {
  return Object.fromEntries(
    DEFAULT_TILE_TYPE_DATA.map(({ key, ...d }) => [
      key,
      { id: key, name: d.name, color: d.color, border: d.border, textColor: d.textColor,
        icon: d.icon, walkable: d.walkable, statusEffects: [], displayBackground: null,
        createdAt: new Date().toISOString() },
    ])
  )
}

// Converts old biome-based campaigns to the tileTypes system.
// Only runs when campaign.tileTypes is undefined (old format).
function migrateCampaignTileTypes(campaign) {
  if (campaign.tileTypes !== undefined) return campaign
  return { ...campaign, tileTypes: makeDefaultTileTypes() }
}

// ── Default factories ─────────────────────────────────────────
export function makeMap(overrides = {}) {
  return {
    id: newId(),
    name: 'New Map',
    description: '',
    cols: 18,
    rows: 14,
    defaultBiome: 'grassland',
    parentMapId: null,
    tileStyle: 'hex',
    tiles: {},
    firedEvents: {},   // { "q,r": { color, label, firedAt } } — active overlays
    eventLog: [],      // [{ id, eventName, tileKey, firedAt, type }]
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Event definitions ─────────────────────────────────────────
export const STEP_TYPES = {
  storyboard: { label: 'Storyboard',  icon: '🎬', color: '#c8709a', description: 'Show a storyboard scene' },
  fire:       { label: 'Fire',        icon: '🔥', color: '#c25a4a', description: 'Set tiles on fire (overlay)' },
  flood:      { label: 'Flood',       icon: '🌊', color: '#2a5a8a', description: 'Flood tiles with water (overlay)' },
  collapse:   { label: 'Collapse',    icon: '⛰',  color: '#6a6a6a', description: 'Collapse structure (overlay, blocks movement)' },
  reveal:     { label: 'Reveal',      icon: '👁',  color: '#c8a96e', description: 'Reveal hidden content' },
  portal:     { label: 'Portal',      icon: '🌀', color: '#7a5ab5', description: 'Teleport tokens to another tile/map' },
  message:    { label: 'Message',     icon: '💬', color: '#7bc47f', description: 'Show a message to players' },
}

// A step within an event
export function makeStep(type = 'message', overrides = {}) {
  const base = { id: newId(), type }
  switch (type) {
    case 'storyboard': return { ...base, storyboardId: null, storyboardTarget: 'player', ...overrides }
    case 'fire':
    case 'flood':
    case 'collapse':
    case 'reveal':     return { ...base, affectedTiles: [], includeSelf: true, ...overrides }
    case 'portal':     return { ...base, targetMapId: null, targetTile: null, ...overrides }
    case 'message':    return { ...base, text: '', ...overrides }
    default:           return { ...base, ...overrides }
  }
}

export function makeEvent(overrides = {}) {
  return {
    id: newId(),
    name: '',
    description: '',
    steps: [],           // [Step] — executed in order when fired

    // ── Visibility ──────────────────────────────────────────
    visibility: 'all',   // 'all' | 'none' | 'traits'
    requiredTraits: [],

    firedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// Keep EVENT_TYPES as alias so any existing code doesn't break
export const EVENT_TYPES = {
  fire:       { label: 'Fire',     color: '#c25a4a', biome: 'lava',     description: 'Sets tiles ablaze' },
  flood:      { label: 'Flood',    color: '#2a5a8a', biome: 'water',    description: 'Floods tiles with water' },
  collapse:   { label: 'Collapse', color: '#6a6a6a', biome: 'mountain', description: 'Collapses structure' },
  portal:     { label: 'Portal',   color: '#7a5ab5', biome: null,       description: 'Transports tokens' },
  storyboard: { label: 'Storyboard', color: '#c8709a', biome: null,     description: 'Displays a storyboard' },
  reveal:     { label: 'Reveal',   color: '#c8a96e', biome: null,       description: 'Reveals hidden content' },
  custom:     { label: 'Custom',   color: '#7bc47f', biome: null,       description: 'Custom event' },
  message:    { label: 'Message',  color: '#7bc47f', biome: null,       description: 'Shows a message' },
}

// ── Visibility options (for UI) ───────────────────────────────
export const VISIBILITY_OPTIONS = [
  {
    value: 'all',
    label: 'Everyone',
    icon: '👁',
    description: 'All players see this event and its effects',
  },
  {
    value: 'none',
    label: 'Organizer only',
    icon: '🔒',
    description: 'Completely hidden from players — organizer eyes only',
  },
  {
    value: 'traits',
    label: 'Trait-gated',
    icon: '✨',
    description: 'Only players with a matching trait can perceive this event',
  },
]

export function makeCharacter(overrides = {}) {
  return {
    id: newId(),
    name: 'Unnamed',
    type: 'npc',           // 'player' | 'npc' | 'monster'
    emoji: null,           // emoji icon override
    portrait: null,        // base64 data URL
    attachments: [],       // [{ id, name, type, size, dataUrl, uploadedAt }]
    stats: {
      hp: 10,
      maxHp: 10,
      ac: 10,
      speed: 30,
      initiative: 0,
    },
    notes: '',             // organizer only
    publicNotes: '',       // visible to players (legacy — keep for compat)
    description: '',       // public character description — visible to all players
    biography: '',         // private backstory — only visible to owning player + organizer
    currency: 0,           // player wallet ($)
    isKey: false,          // key NPCs show full token on all maps
    revealedToPlayers: false, // organizer can reveal any token to players
    currentMapId: null,
    currentTile: null,     // { q, r }
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makeCreature(overrides = {}) {
  return {
    id: newId(),
    name: 'Unnamed Creature',
    species: '',
    type: 'wild',          // 'pet' | 'mount' | 'companion' | 'wild' | 'enemy'
    emoji: '🐾',
    portrait: null,
    ownedBy: null,         // characterId or null

    statBlock: {
      hp: 10,
      maxHp: 10,
      ac: 10,
      speed: 30,
      size: 'medium',      // tiny/small/medium/large/huge/gargantuan
      cr: '1/4',
      str: 10, dex: 10, con: 10,
      int: 3,  wis: 10, cha: 5,
    },

    traits: [],            // [{ id, name, description }]
    abilities: [],         // [{ id, name, description, uses, maxUses }] — Phase next
    inventory: [],         // [{ id, name, quantity, description, weight }]

    notes: '',
    isKey: false,
    revealedToPlayers: false,
    currentMapId: null,
    currentTile: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Item system ──────────────────────────────────────────────

export const ITEM_CATEGORIES = {
  weapon:     { label: 'Weapon',     icon: '⚔️',  color: '#c25a4a' },
  armor:      { label: 'Armor',      icon: '🛡️',  color: '#5b9bd5' },
  consumable: { label: 'Consumable', icon: '🧪',  color: '#7bc47f' },
  tool:       { label: 'Tool',       icon: '🔧',  color: '#c8a96e' },
  key:        { label: 'Key',        icon: '🗝️',  color: '#9b7bc4' },
  quest:      { label: 'Quest',      icon: '📜',  color: '#c8a96e' },
  container:  { label: 'Container',  icon: '📦',  color: '#8a7060' },
  misc:       { label: 'Misc',       icon: '✨',  color: '#9a9790' },
}

export const ITEM_RARITIES = [
  { id: 'common',    label: 'Common',    color: '#9a9790' },
  { id: 'uncommon',  label: 'Uncommon',  color: '#7bc47f' },
  { id: 'rare',      label: 'Rare',      color: '#5b9bd5' },
  { id: 'very_rare', label: 'Very Rare', color: '#9b7bc4' },
  { id: 'legendary', label: 'Legendary', color: '#c8a96e' },
]

export const CONTAINER_TYPES = [
  { id: 'chest',  label: 'Chest',  emoji: '📦' },
  { id: 'bag',    label: 'Bag',    emoji: '👜' },
  { id: 'barrel', label: 'Barrel', emoji: '🪣' },
  { id: 'crate',  label: 'Crate',  emoji: '📫' },
  { id: 'pouch',  label: 'Pouch',  emoji: '💰' },
  { id: 'altar',  label: 'Altar',  emoji: '🏛️' },
  { id: 'hidden', label: 'Hidden', emoji: '🕳️' },
]

export function makeItemTemplate(overrides = {}) {
  return {
    id: newId(),
    name: 'New Item',
    description: '',
    category: 'misc',
    rarity: 'common',
    weight: 0,
    value: 0,            // in gp
    tags: [],
    grantedTraits: [],   // [{ id, name, description }]
    abilityIds: [],      // templateIds from ability library
    customFields: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makeItemInstance(templateId, overrides = {}) {
  return {
    id: newId(),
    templateId,
    quantity: 1,
    notes: '',
    identified: true,    // false = players see "Unknown Item"
    ...overrides,
  }
}

export function makeContainer(overrides = {}) {
  return {
    id: newId(),
    name: 'Chest',
    type: 'chest',
    description: '',
    mapId: null,
    tileKey: null,       // "q,r"
    locked: false,
    lockDC: 15,
    discovered: true,    // false = hidden until organizer reveals
    items: [],           // ItemInstance[]
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Ability system ───────────────────────────────────────────

export const ABILITY_CATEGORIES = {
  attack:   { label: 'Attack',   color: '#c25a4a', icon: '⚔️' },
  defense:  { label: 'Defense',  color: '#5b9bd5', icon: '🛡️' },
  utility:  { label: 'Utility',  color: '#c8a96e', icon: '🔧' },
  passive:  { label: 'Passive',  color: '#7bc47f', icon: '✨' },
  reaction: { label: 'Reaction', color: '#9b7bc4', icon: '⚡' },
}

export const DAMAGE_TYPES = [
  'acid','bludgeoning','cold','fire','force','lightning',
  'necrotic','piercing','poison','psychic','radiant','slashing','thunder','none'
]

export const ACTION_COSTS = [
  { id: 'action',   label: 'Action' },
  { id: 'bonus',    label: 'Bonus Action' },
  { id: 'reaction', label: 'Reaction' },
  { id: 'free',     label: 'Free' },
  { id: 'passive',  label: 'Passive' },
]

export const RANGE_TYPES = [
  { id: 'melee',   label: 'Melee' },
  { id: 'ranged',  label: 'Ranged' },
  { id: 'self',    label: 'Self' },
  { id: 'touch',   label: 'Touch' },
  { id: 'aoe',     label: 'Area of Effect' },
]

export const SAVE_STATS = ['STR','DEX','CON','INT','WIS','CHA']

export function makeAbilityTemplate(overrides = {}) {
  return {
    id: newId(),
    name: 'New Ability',
    description: '',
    category: 'attack',
    actionCost: 'action',
    range: 'melee',
    rangeDistance: null,       // ft, for ranged

    // Damage
    damageDice: '',            // e.g. '2d6'
    damageType: 'none',
    damageBonus: 0,            // flat bonus on top of dice

    // Secondary damage (e.g. ongoing)
    secondaryDamageDice: '',
    secondaryDamageType: 'none',
    secondaryDamageDesc: '',   // e.g. "on fire, takes this each turn"

    // AoE
    aoeShape: 'cone',          // cone | line | sphere | cube
    aoeSize: 15,               // ft

    // Saving throw
    saveStat: null,            // 'STR','DEX' etc or null
    saveDC: 13,

    // Uses
    usesPerRest: null,         // null = unlimited
    restType: 'long',          // 'short' | 'long'

    // Conditions applied on hit
    conditions: [],            // ['poisoned','frightened'] etc

    // Flavor
    tags: [],                  // free-form string tags
    customFields: {},          // { key: value } organizer extras

    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// An instance of an ability assigned to a creature or character
export function makeAbilityInstance(templateId, overrides = {}) {
  return {
    templateId,
    usesRemaining: null,       // null = use template default; set on rest reset
    overrides: {},             // per-entity tweaks { dc, damageDice, etc }
    ...overrides,
  }
}

export function makeStoryEntry(overrides = {}) {
  return {
    id: newId(),
    title: 'Untitled',
    type: 'lore',          // 'lore' | 'secret' | 'session'
    content: '',
    visibleToPlayers: false,
    sessionDate: null,     // ISO string, for session recaps
    linkedMapIds: [],
    linkedCharacterIds: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makeCampaign(overrides = {}) {
  const firstMap = makeMap({
    name: overrides.firstMapName || 'World Map',
    cols: overrides.defaultCols || 18,
    rows: overrides.defaultRows || 14,
    defaultBiome: overrides.defaultBiome || 'grassland',
  })
  return {
    id: newId(),
    name: 'Untitled Campaign',
    description: '',
    settings: {
      defaultBiome: 'grassland',
      defaultCols: 18,
      defaultRows: 14,
    },
    tileTypes: makeDefaultTileTypes(),
    maps: { [firstMap.id]: firstMap },
    characters: {},
    creatures: {},
    abilities: {},             // template library
    items: {},                 // item template library
    containers: {},            // map containers (chests etc)
    storyboards: {},           // { id: Storyboard }
    story: {},
    attachments: [],    // campaign-level file attachments
    coverImage: null,   // base64 cover image
    activeMapId: firstMap.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
    // Prevent overrides from clobbering nested objects incorrectly
    settings: {
      defaultBiome: overrides.defaultBiome || 'grassland',
      defaultCols: overrides.defaultCols || 18,
      defaultRows: overrides.defaultRows || 14,
    },
    tileTypes: makeDefaultTileTypes(),
    maps: { [firstMap.id]: firstMap },
    activeMapId: firstMap.id,
  }
}

// ── Tile helper ───────────────────────────────────────────────
function makeTile(biome) {
  return { biome, label: '', notes: '', tokens: [], events: [] }
}

// ── Store ─────────────────────────────────────────────────────
export const useStore = create((set, get) => ({

  // ── Campaign ────────────────────────────────────────────────
  campaign: null,

  setCampaign(campaign) {
    set({ campaign: campaign ? migrateCampaignTileTypes(campaign) : campaign })
  },

  updateCampaign(partial) {
    set(s => ({
      campaign: { ...s.campaign, ...partial, updatedAt: new Date().toISOString() }
    }))
  },

  // ── Maps ────────────────────────────────────────────────────
  activeMapId() {
    return get().campaign?.activeMapId ?? null
  },

  activeMap() {
    const { campaign } = get()
    if (!campaign) return null
    return campaign.maps[campaign.activeMapId] ?? null
  },

  setActiveMap(mapId) {
    set(s => ({
      campaign: { ...s.campaign, activeMapId: mapId, updatedAt: new Date().toISOString() }
    }))
  },

  addMap(mapData = {}) {
    const newMap = makeMap(mapData)
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: { ...s.campaign.maps, [newMap.id]: newMap },
        activeMapId: newMap.id,
        updatedAt: new Date().toISOString(),
      }
    }))
    return newMap.id
  },

  updateMap(mapId, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: {
          ...s.campaign.maps,
          [mapId]: { ...s.campaign.maps[mapId], ...partial },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  resizeMap(mapId, newCols, newRows) {
    const { campaign } = get()
    const map = campaign?.maps[mapId]
    if (!map) return
    const tiles = Object.fromEntries(
      Object.entries(map.tiles || {}).filter(([key]) => {
        const [q, r] = key.split(',').map(Number)
        return q < newCols && r < newRows
      })
    )
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: {
          ...s.campaign.maps,
          [mapId]: { ...s.campaign.maps[mapId], cols: newCols, rows: newRows, tiles },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  deleteMap(mapId) {
    const { campaign } = get()
    if (!campaign) return
    const maps = { ...campaign.maps }
    delete maps[mapId]
    const remaining = Object.keys(maps)
    if (remaining.length === 0) return // always keep at least one map
    const activeMapId = campaign.activeMapId === mapId ? remaining[0] : campaign.activeMapId
    set(s => ({
      campaign: { ...s.campaign, maps, activeMapId, updatedAt: new Date().toISOString() }
    }))
  },

  // ── Tiles ───────────────────────────────────────────────────
  getTile(q, r, mapId) {
    const { campaign } = get()
    if (!campaign) return makeTile('grassland')
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return makeTile('grassland')
    return map.tiles[`${q},${r}`] ?? makeTile(map.defaultBiome)
  },

  setTileBiome(q, r, biome, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const key = `${q},${r}`
    const existing = map.tiles[key] ?? makeTile(map.defaultBiome)
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: {
          ...s.campaign.maps,
          [mid]: {
            ...map,
            tiles: { ...map.tiles, [key]: { ...existing, biome } }
          }
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  // Move/place a character token atomically — removes from old tile on same map, places on new
  placeToken(charId, destQ, destR, destMapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = destMapId ?? campaign.activeMapId
    const destMap = campaign.maps[mid]
    if (!destMap) return

    const char = campaign.characters[charId] || campaign.creatures?.[charId]
    if (!char) return

    // Build updated tiles for this map — scan every tile and remove this charId
    const updatedTiles = Object.fromEntries(
      Object.entries(destMap.tiles || {}).map(([key, tile]) => [
        key,
        tile.tokens?.includes(charId)
          ? { ...tile, tokens: tile.tokens.filter(id => id !== charId) }
          : tile,
      ])
    )

    // Also clear from other maps this char is on (keep other-map tokens intact)
    const updatedMaps = { ...campaign.maps }
    Object.entries(campaign.maps).forEach(([mapId, map]) => {
      if (mapId === mid) return // handled below
      const hasThere = Object.values(map.tiles || {}).some(t => t.tokens?.includes(charId))
      if (hasThere) {
        updatedMaps[mapId] = {
          ...map,
          tiles: Object.fromEntries(
            Object.entries(map.tiles || {}).map(([k, t]) => [
              k,
              t.tokens?.includes(charId) ? { ...t, tokens: t.tokens.filter(id => id !== charId) } : t,
            ])
          ),
        }
      }
    })

    // Add to destination tile
    const destKey = `${destQ},${destR}`
    const destTile = updatedTiles[destKey] ?? makeTile(destMap.defaultBiome)
    updatedTiles[destKey] = {
      ...destTile,
      tokens: [...(destTile.tokens || []).filter(id => id !== charId), charId],
    }
    updatedMaps[mid] = { ...destMap, tiles: updatedTiles }

    // Update character's currentMapId and currentTile
    const isCreature = !!campaign.creatures?.[charId]
    const entityKey = isCreature ? 'creatures' : 'characters'

    set(s => ({
      campaign: {
        ...s.campaign,
        maps: updatedMaps,
        [entityKey]: {
          ...s.campaign[entityKey],
          [charId]: { ...s.campaign[entityKey][charId], currentMapId: mid, currentTile: { q: destQ, r: destR } },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  setTileField(q, r, field, value, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const key = `${q},${r}`
    const existing = map.tiles[key] ?? makeTile(map.defaultBiome)
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: {
          ...s.campaign.maps,
          [mid]: {
            ...map,
            tiles: { ...map.tiles, [key]: { ...existing, [field]: value } }
          }
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  eraseTile(q, r, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const tiles = { ...map.tiles }
    delete tiles[`${q},${r}`]
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: { ...s.campaign.maps, [mid]: { ...map, tiles } },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  // ── Tile Types ──────────────────────────────────────────────
  addTileType(data = {}) {
    const tt = makeTileType(data)
    set(s => ({
      campaign: {
        ...s.campaign,
        tileTypes: { ...s.campaign.tileTypes, [tt.id]: tt },
        updatedAt: new Date().toISOString(),
      }
    }))
    return tt.id
  },

  updateTileType(id, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        tileTypes: {
          ...s.campaign.tileTypes,
          [id]: { ...s.campaign.tileTypes[id], ...partial },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  deleteTileType(id) {
    const tileTypes = { ...get().campaign?.tileTypes }
    delete tileTypes[id]
    set(s => ({ campaign: { ...s.campaign, tileTypes, updatedAt: new Date().toISOString() } }))
  },

  // ── Characters ──────────────────────────────────────────────
  addCharacter(data = {}) {
    const char = makeCharacter(data)
    set(s => ({
      campaign: {
        ...s.campaign,
        characters: { ...s.campaign.characters, [char.id]: char },
        updatedAt: new Date().toISOString(),
      }
    }))
    return char.id
  },

  updateCharacter(charId, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        characters: {
          ...s.campaign.characters,
          [charId]: { ...s.campaign.characters[charId], ...partial },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  deleteCharacter(charId) {
    const campaign = get().campaign
    if (!campaign) return
    const chars = { ...campaign.characters }
    delete chars[charId]
    // Remove token from every tile in every map
    const maps = Object.fromEntries(
      Object.entries(campaign.maps || {}).map(([mapId, map]) => [
        mapId,
        {
          ...map,
          tiles: Object.fromEntries(
            Object.entries(map.tiles || {}).map(([key, tile]) => [
              key,
              tile.tokens?.includes(charId)
                ? { ...tile, tokens: tile.tokens.filter(id => id !== charId) }
                : tile,
            ])
          ),
        },
      ])
    )
    // Clear selectedTile if it was showing this character
    set(s => ({
      campaign: { ...s.campaign, characters: chars, maps, updatedAt: new Date().toISOString() },
    }))
  },

  // ── Ability templates ────────────────────────────────────────
  addAbilityTemplate(data = {}) {
    const tmpl = makeAbilityTemplate(data)
    set(s => ({
      campaign: {
        ...s.campaign,
        abilities: { ...s.campaign.abilities, [tmpl.id]: tmpl },
        updatedAt: new Date().toISOString(),
      }
    }))
    return tmpl.id
  },

  updateAbilityTemplate(id, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        abilities: {
          ...s.campaign.abilities,
          [id]: { ...s.campaign.abilities[id], ...partial },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  deleteAbilityTemplate(id) {
    const abilities = { ...get().campaign?.abilities }
    delete abilities[id]
    // Also remove instances from all creatures and characters
    const campaign = get().campaign
    const characters = Object.fromEntries(
      Object.entries(campaign.characters || {}).map(([cid, c]) => [
        cid, { ...c, abilities: (c.abilities || []).filter(a => a.templateId !== id) }
      ])
    )
    const creatures = Object.fromEntries(
      Object.entries(campaign.creatures || {}).map(([cid, c]) => [
        cid, { ...c, abilities: (c.abilities || []).filter(a => a.templateId !== id) }
      ])
    )
    set(s => ({
      campaign: { ...s.campaign, abilities, characters, creatures, updatedAt: new Date().toISOString() }
    }))
  },

  // Assign ability instance to a creature or character
  assignAbility(entityType, entityId, templateId) {
    // entityType: 'characters' | 'creatures'
    const campaign = get().campaign
    const entity = campaign[entityType]?.[entityId]
    if (!entity) return
    // Don't add duplicates
    if ((entity.abilities || []).find(a => a.templateId === templateId)) return
    const tmpl = campaign.abilities[templateId]
    const instance = makeAbilityInstance(templateId, {
      usesRemaining: tmpl?.usesPerRest ?? null,
    })
    set(s => ({
      campaign: {
        ...s.campaign,
        [entityType]: {
          ...s.campaign[entityType],
          [entityId]: {
            ...entity,
            abilities: [...(entity.abilities || []), instance],
          },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  removeAbility(entityType, entityId, templateId) {
    const campaign = get().campaign
    const entity = campaign[entityType]?.[entityId]
    if (!entity) return
    set(s => ({
      campaign: {
        ...s.campaign,
        [entityType]: {
          ...s.campaign[entityType],
          [entityId]: {
            ...entity,
            abilities: (entity.abilities || []).filter(a => a.templateId !== templateId),
          },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  updateAbilityInstance(entityType, entityId, templateId, partial) {
    const campaign = get().campaign
    const entity = campaign[entityType]?.[entityId]
    if (!entity) return
    set(s => ({
      campaign: {
        ...s.campaign,
        [entityType]: {
          ...s.campaign[entityType],
          [entityId]: {
            ...entity,
            abilities: (entity.abilities || []).map(a =>
              a.templateId === templateId ? { ...a, ...partial } : a
            ),
          },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  // ── Creatures ────────────────────────────────────────────────
  addCreature(data = {}) {
    const creature = makeCreature(data)
    set(s => ({
      campaign: {
        ...s.campaign,
        creatures: { ...s.campaign.creatures, [creature.id]: creature },
        updatedAt: new Date().toISOString(),
      }
    }))
    return creature.id
  },

  updateCreature(creatureId, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        creatures: {
          ...s.campaign.creatures,
          [creatureId]: { ...s.campaign.creatures[creatureId], ...partial },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  deleteCreature(creatureId) {
    const campaign = get().campaign
    if (!campaign) return
    const creatures = { ...campaign.creatures }
    delete creatures[creatureId]
    // Remove from tile tokens
    const maps = Object.fromEntries(
      Object.entries(campaign.maps || {}).map(([mapId, map]) => [
        mapId,
        {
          ...map,
          tiles: Object.fromEntries(
            Object.entries(map.tiles || {}).map(([key, tile]) => [
              key,
              tile.tokens?.includes(creatureId)
                ? { ...tile, tokens: tile.tokens.filter(id => id !== creatureId) }
                : tile,
            ])
          ),
        },
      ])
    )
    set(s => ({
      campaign: { ...s.campaign, creatures, maps, updatedAt: new Date().toISOString() }
    }))
  },

  // ── Currency ──────────────────────────────────────────────────
  giveCurrency(entityType, entityId, amount) {
    const campaign = get().campaign
    const entity = campaign[entityType]?.[entityId]
    if (!entity) return
    const current = entity.currency || 0
    set(s => ({
      campaign: {
        ...s.campaign,
        [entityType]: {
          ...s.campaign[entityType],
          [entityId]: { ...entity, currency: Math.max(0, current + amount) },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  // ── Item templates ───────────────────────────────────────────
  addItemTemplate(data = {}) {
    const tmpl = makeItemTemplate(data)
    set(s => ({ campaign: { ...s.campaign, items: { ...s.campaign.items, [tmpl.id]: tmpl }, updatedAt: new Date().toISOString() } }))
    return tmpl.id
  },

  updateItemTemplate(id, partial) {
    set(s => ({ campaign: { ...s.campaign, items: { ...s.campaign.items, [id]: { ...s.campaign.items[id], ...partial } }, updatedAt: new Date().toISOString() } }))
  },

  deleteItemTemplate(id) {
    const items = { ...get().campaign?.items }
    delete items[id]
    // Remove instances from all character/creature inventories
    const campaign = get().campaign
    const patch = (entities) => Object.fromEntries(
      Object.entries(entities || {}).map(([eid, e]) => [
        eid, { ...e, inventory: (e.inventory || []).filter(i => i.templateId !== id) }
      ])
    )
    // Remove from containers too
    const containers = Object.fromEntries(
      Object.entries(campaign.containers || {}).map(([cid, c]) => [
        cid, { ...c, items: (c.items || []).filter(i => i.templateId !== id) }
      ])
    )
    set(s => ({ campaign: { ...s.campaign, items, characters: patch(campaign.characters), creatures: patch(campaign.creatures), containers, updatedAt: new Date().toISOString() } }))
  },

  // Give item to a character or creature
  giveItem(entityType, entityId, templateId, quantity = 1) {
    const campaign = get().campaign
    const entity = campaign[entityType]?.[entityId]
    if (!entity) return
    const existing = (entity.inventory || []).find(i => i.templateId === templateId)
    let inventory
    if (existing) {
      inventory = entity.inventory.map(i => i.templateId === templateId ? { ...i, quantity: i.quantity + quantity } : i)
    } else {
      inventory = [...(entity.inventory || []), makeItemInstance(templateId, { quantity })]
    }
    set(s => ({ campaign: { ...s.campaign, [entityType]: { ...s.campaign[entityType], [entityId]: { ...entity, inventory } }, updatedAt: new Date().toISOString() } }))
  },

  removeItemFromEntity(entityType, entityId, instanceId, quantity = null) {
    const campaign = get().campaign
    const entity = campaign[entityType]?.[entityId]
    if (!entity) return
    let inventory
    if (quantity === null) {
      inventory = (entity.inventory || []).filter(i => i.id !== instanceId)
    } else {
      inventory = (entity.inventory || []).map(i => i.id === instanceId
        ? { ...i, quantity: Math.max(0, i.quantity - quantity) }
        : i
      ).filter(i => i.quantity > 0)
    }
    set(s => ({ campaign: { ...s.campaign, [entityType]: { ...s.campaign[entityType], [entityId]: { ...entity, inventory } }, updatedAt: new Date().toISOString() } }))
  },

  updateItemInstance(entityType, entityId, instanceId, partial) {
    const campaign = get().campaign
    const entity = campaign[entityType]?.[entityId]
    if (!entity) return
    const inventory = (entity.inventory || []).map(i => i.id === instanceId ? { ...i, ...partial } : i)
    set(s => ({ campaign: { ...s.campaign, [entityType]: { ...s.campaign[entityType], [entityId]: { ...entity, inventory } }, updatedAt: new Date().toISOString() } }))
  },

  // ── Containers ────────────────────────────────────────────────
  addContainer(data = {}) {
    const c = makeContainer(data)
    set(s => ({ campaign: { ...s.campaign, containers: { ...s.campaign.containers, [c.id]: c }, updatedAt: new Date().toISOString() } }))
    return c.id
  },

  updateContainer(id, partial) {
    set(s => ({ campaign: { ...s.campaign, containers: { ...s.campaign.containers, [id]: { ...s.campaign.containers[id], ...partial } }, updatedAt: new Date().toISOString() } }))
  },

  deleteContainer(id) {
    const containers = { ...get().campaign?.containers }
    delete containers[id]
    set(s => ({ campaign: { ...s.campaign, containers, updatedAt: new Date().toISOString() } }))
  },

  addItemToContainer(containerId, templateId, quantity = 1) {
    const campaign = get().campaign
    const container = campaign.containers?.[containerId]
    if (!container) return
    const existing = container.items.find(i => i.templateId === templateId)
    let items
    if (existing) {
      items = container.items.map(i => i.templateId === templateId ? { ...i, quantity: i.quantity + quantity } : i)
    } else {
      items = [...container.items, makeItemInstance(templateId, { quantity })]
    }
    set(s => ({ campaign: { ...s.campaign, containers: { ...s.campaign.containers, [containerId]: { ...container, items } }, updatedAt: new Date().toISOString() } }))
  },

  removeItemFromContainer(containerId, instanceId, quantity = null) {
    const campaign = get().campaign
    const container = campaign.containers?.[containerId]
    if (!container) return
    let items
    if (quantity === null) {
      items = container.items.filter(i => i.id !== instanceId)
    } else {
      items = container.items.map(i => i.id === instanceId
        ? { ...i, quantity: Math.max(0, i.quantity - quantity) }
        : i
      ).filter(i => i.quantity > 0)
    }
    set(s => ({ campaign: { ...s.campaign, containers: { ...s.campaign.containers, [containerId]: { ...container, items } }, updatedAt: new Date().toISOString() } }))
  },

  // Transfer item from container to entity inventory
  transferFromContainer(containerId, instanceId, entityType, entityId, quantity = null) {
    const campaign = get().campaign
    const container = campaign.containers?.[containerId]
    const instance = container?.items?.find(i => i.id === instanceId)
    if (!instance) return
    const qty = quantity ?? instance.quantity
    get().giveItem(entityType, entityId, instance.templateId, qty)
    get().removeItemFromContainer(containerId, instanceId, qty)
  },

  // Transfer item from entity to container
  transferToContainer(entityType, entityId, instanceId, containerId, quantity = null) {
    const campaign = get().campaign
    const entity = campaign[entityType]?.[entityId]
    const instance = entity?.inventory?.find(i => i.id === instanceId)
    if (!instance) return
    const qty = quantity ?? instance.quantity
    get().addItemToContainer(containerId, instance.templateId, qty)
    get().removeItemFromEntity(entityType, entityId, instanceId, qty)
  },

  // ── Storyboards ──────────────────────────────────────────────
  addStoryboard(data = {}) {
    const sb = makeStoryboard(data)
    set(s => ({ campaign: { ...s.campaign, storyboards: { ...s.campaign.storyboards, [sb.id]: sb }, updatedAt: new Date().toISOString() } }))
    return sb.id
  },
  updateStoryboard(id, partial) {
    set(s => ({ campaign: { ...s.campaign, storyboards: { ...s.campaign.storyboards, [id]: { ...s.campaign.storyboards[id], ...partial } }, updatedAt: new Date().toISOString() } }))
  },
  deleteStoryboard(id) {
    const storyboards = { ...get().campaign?.storyboards }
    delete storyboards[id]
    set(s => ({ campaign: { ...s.campaign, storyboards, updatedAt: new Date().toISOString() } }))
  },

  // ── Story ───────────────────────────────────────────────────
  addStoryEntry(data = {}) {
    const entry = makeStoryEntry(data)
    set(s => ({
      campaign: {
        ...s.campaign,
        story: { ...s.campaign.story, [entry.id]: entry },
        updatedAt: new Date().toISOString(),
      }
    }))
    return entry.id
  },

  updateStoryEntry(entryId, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        story: {
          ...s.campaign.story,
          [entryId]: { ...s.campaign.story[entryId], ...partial },
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  deleteStoryEntry(entryId) {
    const story = { ...get().campaign?.story }
    delete story[entryId]
    set(s => ({
      campaign: { ...s.campaign, story, updatedAt: new Date().toISOString() }
    }))
  },

  // ── Events ─────────────────────────────────────────────────
  addEvent(tileQ, tileR, eventData = {}, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const key = `${tileQ},${tileR}`
    const tile = map.tiles[key] ?? { biome: map.defaultBiome, label: '', notes: '', tokens: [], events: [] }
    const ev = makeEvent({ ...eventData, sourceTile: { q: tileQ, r: tileR } })
    const newTile = { ...tile, events: [...(tile.events || []), ev] }
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: { ...s.campaign.maps, [mid]: { ...map, tiles: { ...map.tiles, [key]: newTile } } },
        updatedAt: new Date().toISOString(),
      }
    }))
    return ev.id
  },

  updateEvent(tileQ, tileR, eventId, partial, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const key = `${tileQ},${tileR}`
    const tile = map.tiles[key]
    if (!tile) return
    const events = tile.events.map(e => e.id === eventId ? { ...e, ...partial } : e)
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: { ...s.campaign.maps, [mid]: { ...map, tiles: { ...map.tiles, [key]: { ...tile, events } } } },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  deleteEvent(tileQ, tileR, eventId, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const key = `${tileQ},${tileR}`
    const tile = map.tiles[key]
    if (!tile) return
    const events = tile.events.filter(e => e.id !== eventId)
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: { ...s.campaign.maps, [mid]: { ...map, tiles: { ...map.tiles, [key]: { ...tile, events } } } },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  fireEvent(tileQ, tileR, eventId, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const key = `${tileQ},${tileR}`
    const tile = map.tiles[key]
    if (!tile) return
    const ev = tile.events.find(e => e.id === eventId)
    if (!ev) return

    const firedAt = new Date().toISOString()
    const steps = ev.steps || []

    // Build updated map state — process all tile-affecting steps
    const newFiredEvents = { ...(map.firedEvents || {}) }
    let updatedMaps = { ...campaign.maps }
    let updatedChars = { ...campaign.characters }
    let didSwitchMap = false
    let switchToMap = null

    const OVERLAY_COLORS = { fire: '#c25a4a', flood: '#2a5a8a', collapse: '#6a6a6a', reveal: '#c8a96e' }

    steps.forEach(step => {
      const affected = step.includeSelf !== false
        ? [{ q: tileQ, r: tileR }, ...(step.affectedTiles || [])]
        : (step.affectedTiles || [])

      switch (step.type) {
        case 'fire':
        case 'flood':
        case 'reveal': {
          const color = OVERLAY_COLORS[step.type]
          affected.forEach(({ q, r }) => {
            newFiredEvents[`${q},${r}`] = { color, label: ev.name, type: step.type, firedAt }
          })
          break
        }
        case 'collapse': {
          affected.forEach(({ q, r }) => {
            newFiredEvents[`${q},${r}`] = { color: '#6a6a6a', label: ev.name, type: 'collapse', blocked: true, firedAt }
          })
          break
        }
        case 'portal': {
          if (step.targetMapId && step.targetTile) {
            const tokensToMove = [...(tile.tokens || [])]
            tokensToMove.forEach(charId => {
              get().placeToken(charId, step.targetTile.q, step.targetTile.r, step.targetMapId)
            })
            switchToMap = step.targetMapId
            didSwitchMap = true
          }
          break
        }
        // storyboard and message are handled by the caller (EventEditor) via WS
        default: break
      }
    })

    // Log entry
    const logEntry = {
      id: newId(),
      eventId,
      eventName: ev.name,
      steps: steps.map(s => s.type),
      sourceTile: { q: tileQ, r: tileR },
      firedAt,
    }

    const updatedEvents = tile.events.map(e => e.id === eventId ? { ...e, firedAt } : e)

    // Re-read latest state (placeToken may have mutated it)
    const latestCampaign = get().campaign
    const latestMap = latestCampaign.maps[mid]

    set(s => ({
      campaign: {
        ...s.campaign,
        activeMapId: didSwitchMap ? switchToMap : s.campaign.activeMapId,
        maps: {
          ...s.campaign.maps,
          [mid]: {
            ...latestMap,
            firedEvents: newFiredEvents,
            eventLog: [...(latestMap.eventLog || []), logEntry],
            tiles: { ...latestMap.tiles, [key]: { ...latestMap.tiles[key], events: updatedEvents } },
          }
        },
        updatedAt: firedAt,
      }
    }))
  },

  clearOverlay(tileKey, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const firedEvents = { ...(map.firedEvents || {}) }
    delete firedEvents[tileKey]
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: { ...s.campaign.maps, [mid]: { ...map, firedEvents } },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  makeOverlayPermanent(tileKey, mapId) {
    // Promotes the fired event overlay to an actual biome change
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const overlay = (map.firedEvents || {})[tileKey]
    if (!overlay) return
    const biomemap = { fire: 'lava', flood: 'water', collapse: 'mountain', reveal: null, portal: null, custom: null }
    const newBiome = biomemap[overlay.type]
    if (!newBiome) return  // reveal/portal/custom don't change biome

    const [q, r] = tileKey.split(',').map(Number)
    const tile = map.tiles[tileKey] ?? { biome: map.defaultBiome, label: '', notes: '', tokens: [], events: [] }
    const firedEvents = { ...(map.firedEvents || {}) }
    delete firedEvents[tileKey]

    set(s => ({
      campaign: {
        ...s.campaign,
        maps: {
          ...s.campaign.maps,
          [mid]: {
            ...map,
            firedEvents,
            tiles: { ...map.tiles, [tileKey]: { ...tile, biome: newBiome } },
          }
        },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  clearAllOverlays(mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: { ...s.campaign.maps, [mid]: { ...map, firedEvents: {} } },
        updatedAt: new Date().toISOString(),
      }
    }))
  },

  // ── UI state (not persisted) ─────────────────────────────────
  selectedTile: null,
  tool: 'select',
  activeBiome: 'grassland',
  showGrid: true,
  showCoords: false,
  showAllLabels: false,   // organizer global toggle — show all tile labels at once
  labelSize: parseFloat(localStorage.getItem('tilestories_labelSize') || '1'),
  displayLabelSize: parseFloat(localStorage.getItem('tilestories_displayLabelSize') || '1'),
  inspectorOpen: true,
  // Tile selection mode — when active, map clicks toggle tiles in a list
  tileSelectionMode: null,
  portalPickMode: null,  // { originMapId, onPick: fn(tile) } — for portal destination picking

  // Viewer context — who is currently looking at the map
  // 'organizer' sees everything; 'player' is filtered by visibility + traits
  viewerMode: 'organizer',   // 'organizer' | 'player'
  viewerTraits: [],          // traits the current viewer has (for trait-gated events)
  camera: { x: 0, y: 0, zoom: 1 },

  setSelectedTile: (tile) => set({ selectedTile: tile }),
  setTool: (tool) => set({ tool }),
  setActiveBiome: (b) => set({ activeBiome: b }),
  toggleGrid: () => set(s => ({ showGrid: !s.showGrid })),
  toggleCoords: () => set(s => ({ showCoords: !s.showCoords })),
  toggleAllLabels: () => set(s => ({ showAllLabels: !s.showAllLabels })),
  setLabelSize: (v) => { localStorage.setItem('tilestories_labelSize', v); set({ labelSize: v }) },
  setDisplayLabelSize: (v) => { localStorage.setItem('tilestories_displayLabelSize', v); set({ displayLabelSize: v }) },
  setInspectorOpen: (v) => set({ inspectorOpen: v }),
  setViewerMode: (mode) => set({ viewerMode: mode }),
  setViewerTraits: (traits) => set({ viewerTraits: traits }),

  // Start tile selection mode with an initial set of tiles
  startTileSelection: (initialTiles = []) => set({ tileSelectionMode: { tiles: initialTiles } }),

  startPortalPick: (originMapId, onPick) => set({ portalPickMode: { originMapId, onPick } }),
  endPortalPick: () => set({ portalPickMode: null }),

  // Toggle a tile in the current selection
  toggleSelectedTile: (q, r) => set(s => {
    if (!s.tileSelectionMode) return {}
    const tiles = s.tileSelectionMode.tiles
    const exists = tiles.find(t => t.q === q && t.r === r)
    return {
      tileSelectionMode: {
        ...s.tileSelectionMode,
        tiles: exists ? tiles.filter(t => !(t.q === q && t.r === r)) : [...tiles, { q, r }]
      }
    }
  }),

  // End tile selection mode and return selected tiles
  endTileSelection: () => {
    const tiles = useStore.getState().tileSelectionMode?.tiles || []
    set({ tileSelectionMode: null })
    return tiles
  },
  setCamera: (cam) => set({ camera: cam }),
  updateCamera: (partial) => set(s => ({ camera: { ...s.camera, ...partial } })),
}))

// ── Storyboard model ──────────────────────────────────────────
export function makeStoryboard(overrides = {}) {
  return {
    id: newId(),
    name: 'New Storyboard',
    backgroundImage: null,     // base64
    backgroundColor: '#1a1c1e',
    layers: [],                // [{ id, type, src, x, y, width, height, rotation, flipX, flipY, opacity, label }]
    textBlocks: [],            // [{ id, text, x, y, fontSize, color, bold, align }]
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}