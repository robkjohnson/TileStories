/**
 * Tile event and event step model factories.
 *
 * Events are attached to map tiles and execute in sequence when fired.
 * Each event is a named list of Steps. Steps are the atomic units of
 * what actually happens: show a storyboard, run an effect, teleport
 * actors, or display a message.
 */
import { newId } from './id.js'

// ── Step type metadata ────────────────────────────────────────────
// Consumed by the EventEditor UI to build the step picker.
export const STEP_TYPES = {
  storyboard: { label: 'Storyboard', icon: '🎬', color: '#c8709a', description: 'Show a storyboard scene to players or display' },
  effect:     { label: 'Effect',     icon: '⚡', color: '#c8a96e', description: 'Execute a campaign effect on selected tiles or actors' },
  portal:     { label: 'Portal',     icon: '🌀', color: '#7a5ab5', description: 'Teleport tokens to another tile or map' },
  message:    { label: 'Message',    icon: '💬', color: '#7bc47f', description: 'Show a text message to players' },
}

// ── Visibility options ────────────────────────────────────────────
export const VISIBILITY_OPTIONS = [
  { value: 'all',    label: 'Everyone',       icon: '👁',  description: 'All players see this event and its effects' },
  { value: 'none',   label: 'Organizer only', icon: '🔒', description: 'Completely hidden from players — organizer eyes only' },
  { value: 'traits', label: 'Trait-gated',    icon: '✨', description: 'Only players whose actor has a matching trait can perceive this event' },
]

// ── Step factory ──────────────────────────────────────────────────
export function makeStep(type = 'message', overrides = {}) {
  const base = { id: newId(), type }
  switch (type) {
    case 'storyboard':
      return { ...base, storyboardId: null, storyboardTarget: 'player', ...overrides }
    case 'effect':
      return { ...base, effectId: null, selectedTiles: [], selectedChars: [], aoeRotation: 0, ...overrides }
    case 'portal':
      return { ...base, targetMapId: null, targetTile: null, ...overrides }
    case 'message':
      return { ...base, text: '', ...overrides }
    default:
      return { ...base, ...overrides }
  }
}

// ── Event factory ─────────────────────────────────────────────────
export function makeEvent(overrides = {}) {
  return {
    id: newId(),
    name: '',
    description: '',
    steps: [],              // Step[] — executed in order when the event fires

    // Who can perceive this event (see VISIBILITY_OPTIONS)
    visibility: 'all',      // 'all' | 'none' | 'traits'
    requiredTraits: [],     // trait strings — only used when visibility = 'traits'

    firedAt: null,          // ISO string of last fire time, or null
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// Legacy constant — kept so existing imports don't break.
// New code should use STEP_TYPES instead.
export const EVENT_TYPES = {
  fire:       { label: 'Fire',       color: '#c25a4a', biome: 'lava',     description: 'Sets tiles ablaze' },
  flood:      { label: 'Flood',      color: '#2a5a8a', biome: 'water',    description: 'Floods tiles with water' },
  collapse:   { label: 'Collapse',   color: '#6a6a6a', biome: 'mountain', description: 'Collapses structure' },
  portal:     { label: 'Portal',     color: '#7a5ab5', biome: null,       description: 'Transports tokens' },
  storyboard: { label: 'Storyboard', color: '#c8709a', biome: null,       description: 'Displays a storyboard' },
  reveal:     { label: 'Reveal',     color: '#c8a96e', biome: null,       description: 'Reveals hidden content' },
  custom:     { label: 'Custom',     color: '#7bc47f', biome: null,       description: 'Custom event' },
  message:    { label: 'Message',    color: '#7bc47f', biome: null,       description: 'Shows a message' },
}
