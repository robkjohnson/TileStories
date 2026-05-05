// ImageStorage — stores large base64 images in IndexedDB
// Campaign JSON in localStorage stays lean; images live here keyed by hash
// Falls back to localStorage if IndexedDB unavailable

const DB_NAME = 'tilestories_images'
const DB_VERSION = 1
const STORE = 'images'

let db = null

async function getDb() {
  if (db) return db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE, { keyPath: 'hash' })
    }
    req.onsuccess = e => {
      db = e.target.result
      db.onclose = () => { db = null }  // reset if browser closes the connection
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
}

// Simple hash for deduplication — just length+first/last chars (fast, good enough)
function quickHash(dataUrl) {
  if (!dataUrl) return null
  const s = dataUrl
  return `img_${s.length}_${s.slice(20, 30)}_${s.slice(-10)}`
}

export async function storeImage(dataUrl) {
  if (!dataUrl) return null
  const hash = quickHash(dataUrl)
  try {
    const database = await getDb()
    return new Promise((resolve) => {
      try {
        const tx = database.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put({ hash, data: dataUrl })
        tx.oncomplete = () => resolve(hash)
        tx.onerror = () => resolve(dataUrl)
      } catch { resolve(dataUrl) }  // fallback if transaction can't be created
    })
  } catch { db = null; return dataUrl }
}

export async function loadImage(hashOrDataUrl) {
  if (!hashOrDataUrl) return null
  // If it's already a full dataUrl (old data), return as-is
  if (hashOrDataUrl.startsWith('data:')) return hashOrDataUrl
  try {
    const database = await getDb()
    return new Promise((resolve) => {
      try {
        const tx = database.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(hashOrDataUrl)
        req.onsuccess = () => resolve(req.result?.data || null)
        req.onerror = () => resolve(null)
      } catch { resolve(null) }
    })
  } catch { db = null; return null }
}

export async function deleteImage(hash) {
  if (!hash || hash.startsWith('data:')) return
  try {
    const database = await getDb()
    return new Promise((resolve) => {
      const tx = database.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(hash)
      tx.oncomplete = resolve
    })
  } catch {}
}

// Estimate IndexedDB usage
export async function estimateUsage() {
  if (navigator.storage?.estimate) {
    const { usage, quota } = await navigator.storage.estimate()
    return { usage, quota, percent: Math.round((usage / quota) * 100) }
  }
  return null
}

// Resolve all image hashes in a storyboard to full dataUrls
// so it can be sent over WebSocket to other browsers
// Resolve all image references in a storyboard to raw dataUrls
// Handles both: hash keys (from IndexedDB) and legacy inline dataUrls
export async function resolveStoryboardImages(sb) {
  if (!sb) return sb

  async function resolve(val) {
    if (!val) return val
    if (val.startsWith('data:')) return val   // already a dataUrl
    const fromDb = await loadImage(val)
    return fromDb || null                      // null if not found — never send a bare hash to remote clients
  }

  return {
    ...sb,
    backgroundImage: await resolve(sb.backgroundImage),
    layers: sb.layers?.length
      ? await Promise.all(sb.layers.map(async l => ({ ...l, src: await resolve(l.src) })))
      : sb.layers,
  }
}