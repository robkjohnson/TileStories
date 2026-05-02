// Player annotations — stored locally on each player's device
// Key: "campaignId:mapId:q,r"
// Never synced to organizer

const PREFIX = 'tilestories_annotations_'

function storageKey(campaignId) {
  return PREFIX + campaignId
}

function loadAll(campaignId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(campaignId)) || '{}')
  } catch { return {} }
}

function saveAll(campaignId, data) {
  localStorage.setItem(storageKey(campaignId), JSON.stringify(data))
}

export function tileAnnotationKey(mapId, q, r) {
  return `${mapId}:${q},${r}`
}

export function getAnnotation(campaignId, mapId, q, r) {
  const all = loadAll(campaignId)
  return all[tileAnnotationKey(mapId, q, r)] ?? null
}

export function setAnnotation(campaignId, mapId, q, r, data) {
  const all = loadAll(campaignId)
  const key = tileAnnotationKey(mapId, q, r)
  if (!data || (!data.label && !data.color)) {
    delete all[key]
  } else {
    all[key] = { ...data, updatedAt: new Date().toISOString() }
  }
  saveAll(campaignId, all)
}

export function getAllAnnotationsForMap(campaignId, mapId) {
  const all = loadAll(campaignId)
  const result = {}
  Object.entries(all).forEach(([key, val]) => {
    if (key.startsWith(mapId + ':')) {
      const tileKey = key.slice(mapId.length + 1)
      result[tileKey] = val
    }
  })
  return result
}

export function clearAnnotation(campaignId, mapId, q, r) {
  const all = loadAll(campaignId)
  delete all[tileAnnotationKey(mapId, q, r)]
  saveAll(campaignId, all)
}

// Available pin colors for player annotations
export const PIN_COLORS = [
  { id: 'red',    label: 'Red',    color: '#c25a4a' },
  { id: 'gold',   label: 'Gold',   color: '#c8a96e' },
  { id: 'blue',   label: 'Blue',   color: '#5b9bd5' },
  { id: 'green',  label: 'Green',  color: '#7bc47f' },
  { id: 'purple', label: 'Purple', color: '#9b7bc4' },
  { id: 'white',  label: 'White',  color: '#e8e6e1' },
]