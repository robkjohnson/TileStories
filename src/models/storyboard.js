/**
 * Storyboard and story entry model factories.
 *
 * Storyboards are visual scenes (images, video, text overlays) broadcast
 * to the display screen or players during events or cutscenes.
 *
 * Story entries are campaign lore/journal records stored in campaign.story.
 */
import { newId } from './id.js'

export function makeStoryboard(overrides = {}) {
  return {
    id: newId(),
    name: 'New Storyboard',
    backgroundImage: null,      // base64 data URL
    backgroundColor: '#1a1c1e',

    // Visual layers: images and videos positioned on the canvas
    layers: [],
    // { id, type: 'image'|'video', src: base64, x, y, width, height,
    //   rotation, flipX, flipY, opacity: 0-1, label }

    // Text blocks positioned on the canvas
    textBlocks: [],
    // { id, text, x, y, fontSize, color, bold, align: 'left'|'center'|'right' }

    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makeStoryEntry(overrides = {}) {
  return {
    id: newId(),
    title: 'Untitled',
    type: 'lore',               // 'lore' | 'secret' | 'session'
    content: '',
    visibleToPlayers: false,
    sessionDate: null,          // ISO string — for session recap entries
    linkedMapIds: [],
    linkedActorIds: [],         // replaces old linkedCharacterIds
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}
