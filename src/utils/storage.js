// Campaign persistence — localStorage + JSON file import/export

const INDEX_KEY = 'tilestories_index'   // list of saved campaign IDs + names
const DATA_PREFIX = 'tilestories_camp_' // per-campaign data key

// ── Index (list of campaigns) ─────────────────────────────────

function readIndex() {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]') } catch { return [] }
}

function writeIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

// ── Save ──────────────────────────────────────────────────────

export function saveCampaign(campaign) {
  const key = DATA_PREFIX + campaign.id
  const updated = { ...campaign, updatedAt: new Date().toISOString() }

  try {
    localStorage.setItem(key, JSON.stringify(updated))
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // Images should be in IndexedDB — if we're still hitting quota,
      // strip any remaining inline base64 that snuck through
      const slim = stripInlineImages(updated)
      try {
        localStorage.setItem(key, JSON.stringify(slim))
        console.warn('[Storage] Saved without some inline images. Ensure images are stored via imageStorage.js')
      } catch (e2) {
        console.error('[Storage] Cannot save campaign:', e2)
        return updated
      }
    } else {
      throw e
    }
  }

  const index = readIndex()
  const existing = index.findIndex(e => e.id === campaign.id)
  const entry = {
    id: campaign.id,
    name: campaign.name,
    updatedAt: updated.updatedAt,
    mapCount: Object.keys(campaign.maps || {}).length,
  }
  if (existing >= 0) index[existing] = entry
  else index.push(entry)
  try { writeIndex(index) } catch {}

  return updated
}

// Only strip images still stored as raw base64 (not yet migrated to IndexedDB hashes)
function stripInlineImages(campaign) {
  const isRaw = v => typeof v === 'string' && v.startsWith('data:')
  return {
    ...campaign,
    coverImage: isRaw(campaign.coverImage) ? null : campaign.coverImage,
    characters: Object.fromEntries(
      Object.entries(campaign.characters || {}).map(([id, c]) => [
        id, { ...c, portrait: isRaw(c.portrait) ? null : c.portrait }
      ])
    ),
    creatures: Object.fromEntries(
      Object.entries(campaign.creatures || {}).map(([id, c]) => [
        id, { ...c, portrait: isRaw(c.portrait) ? null : c.portrait }
      ])
    ),
    storyboards: Object.fromEntries(
      Object.entries(campaign.storyboards || {}).map(([id, sb]) => [id, {
        ...sb,
        backgroundImage: isRaw(sb.backgroundImage) ? null : sb.backgroundImage,
        layers: (sb.layers || []).map(l => ({ ...l, src: isRaw(l.src) ? null : l.src })),
      }])
    ),
    attachments: (campaign.attachments || []).filter(a => !isRaw(a.dataUrl)),
  }
}

// ── Load one ──────────────────────────────────────────────────

export function loadCampaign(id) {
  try {
    const raw = localStorage.getItem(DATA_PREFIX + id)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

// ── List all ──────────────────────────────────────────────────

export function listCampaigns() {
  return readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

// ── Delete ────────────────────────────────────────────────────

export function deleteCampaign(id) {
  localStorage.removeItem(DATA_PREFIX + id)
  writeIndex(readIndex().filter(e => e.id !== id))
}

// ── Export to .json file ──────────────────────────────────────

export function exportCampaign(campaign) {
  const data = JSON.stringify(campaign, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${campaign.name.replace(/\s+/g, '_')}.tilestories.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Import from .json file ────────────────────────────────────

export function importCampaign(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result)
        if (!data.id || !data.maps) throw new Error('Not a valid TileStories campaign file')
        resolve(data)
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}