// Persistent device identity for players
// Each browser on each device gets a unique ID stored in localStorage

const DEVICE_KEY = 'tilestories_device_id'
const CHAR_KEY = 'tilestories_player_character'

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function savePlayerCharacter(character) {
  localStorage.setItem(CHAR_KEY, JSON.stringify(character))
}

export function loadPlayerCharacter() {
  try {
    const raw = localStorage.getItem(CHAR_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearPlayerCharacter() {
  localStorage.removeItem(CHAR_KEY)
}