/**
 * Map slice — maps, tiles, tile types, and overlay management.
 */
import { makeMap, makeTile, makeTileType } from '../../models/map.js'

export const createMapSlice = (set, get) => ({

  // ── Active map helpers ────────────────────────────────────────
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
      campaign: { ...s.campaign, activeMapId: mapId, updatedAt: new Date().toISOString() },
    }))
  },

  // ── Map CRUD ──────────────────────────────────────────────────
  addMap(mapData = {}) {
    const newMap = makeMap(mapData)
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: { ...s.campaign.maps, [newMap.id]: newMap },
        activeMapId: newMap.id,
        updatedAt: new Date().toISOString(),
      },
    }))
    return newMap.id
  },

  updateMap(mapId, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: { ...s.campaign.maps, [mapId]: { ...s.campaign.maps[mapId], ...partial } },
        updatedAt: new Date().toISOString(),
      },
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
        maps: { ...s.campaign.maps, [mapId]: { ...map, cols: newCols, rows: newRows, tiles } },
        updatedAt: new Date().toISOString(),
      },
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
      campaign: { ...s.campaign, maps, activeMapId, updatedAt: new Date().toISOString() },
    }))
  },

  // ── Tile operations ───────────────────────────────────────────
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
          [mid]: { ...map, tiles: { ...map.tiles, [key]: { ...existing, biome } } },
        },
        updatedAt: new Date().toISOString(),
      },
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
          [mid]: { ...map, tiles: { ...map.tiles, [key]: { ...existing, [field]: value } } },
        },
        updatedAt: new Date().toISOString(),
      },
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
      },
    }))
  },

  // ── Tile types (biomes) ───────────────────────────────────────
  addTileType(data = {}) {
    const tt = makeTileType(data)
    set(s => ({
      campaign: {
        ...s.campaign,
        tileTypes: { ...s.campaign.tileTypes, [tt.id]: tt },
        updatedAt: new Date().toISOString(),
      },
    }))
    return tt.id
  },

  updateTileType(id, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        tileTypes: { ...s.campaign.tileTypes, [id]: { ...s.campaign.tileTypes[id], ...partial } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  deleteTileType(id) {
    const tileTypes = { ...get().campaign?.tileTypes }
    delete tileTypes[id]
    set(s => ({ campaign: { ...s.campaign, tileTypes, updatedAt: new Date().toISOString() } }))
  },

  // ── Event overlays ────────────────────────────────────────────
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
      },
    }))
  },

  makeOverlayPermanent(tileKey, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const overlay = (map.firedEvents || {})[tileKey]
    if (!overlay) return
    const biomemap = { fire: 'lava', flood: 'water', collapse: 'mountain', reveal: null, portal: null, custom: null }
    const newBiome = biomemap[overlay.type]
    if (!newBiome) return
    const tile = map.tiles[tileKey] ?? makeTile(map.defaultBiome)
    const firedEvents = { ...(map.firedEvents || {}) }
    delete firedEvents[tileKey]
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: {
          ...s.campaign.maps,
          [mid]: { ...map, firedEvents, tiles: { ...map.tiles, [tileKey]: { ...tile, biome: newBiome } } },
        },
        updatedAt: new Date().toISOString(),
      },
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
      },
    }))
  },
})
