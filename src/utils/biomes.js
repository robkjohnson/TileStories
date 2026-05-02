// Fallback used when a tile type ID can't be resolved from campaign.tileTypes
const FALLBACK_TILE_TYPE = {
  id: 'grassland',
  name: 'Grassland',
  color: '#4a7c59',
  border: '#3a6045',
  textColor: '#d4f0da',
  icon: '🌿',
  walkable: true,
  statusEffects: [],
}

// Looks up a tile type from campaign.tileTypes.
// Falls back to a hardcoded grassland default so the renderer never crashes.
export function getTileType(key, tileTypes) {
  if (key && tileTypes && tileTypes[key]) return tileTypes[key]
  // Unknown key: try to return any type so the tile is at least renderable
  if (tileTypes) {
    const fallback = tileTypes['grassland'] || Object.values(tileTypes)[0]
    if (fallback) return fallback
  }
  return FALLBACK_TILE_TYPE
}
