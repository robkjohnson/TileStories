/**
 * Main Zustand store.
 *
 * Combines eight domain slices into a single store. The public API is
 * identical to the previous monolithic version so all existing components
 * continue to work without changes.
 *
 * Domain logic lives in src/store/slices/:
 *   campaignSlice  — campaign root CRUD + schema migrations
 *   mapSlice       — maps, tiles, tile types, overlays
 *   actorSlice     — unified actor CRUD, token placement, status/damage
 *   itemSlice      — item library, actor inventories, containers
 *   abilitySlice   — ability library, actor ability instances
 *   effectSlice    — status/effect library, status application, effect execution
 *   eventSlice     — tile events, storyboards, story entries
 *   uiSlice        — ephemeral UI state (tool, camera, effect mode, etc.)
 *
 * Data models live in src/models/.
 * Game system definitions live in src/systems/.
 */
import { create } from 'zustand'

import { createCampaignSlice } from './slices/campaignSlice.js'
import { createMapSlice }      from './slices/mapSlice.js'
import { createActorSlice }    from './slices/actorSlice.js'
import { createItemSlice }     from './slices/itemSlice.js'
import { createAbilitySlice }  from './slices/abilitySlice.js'
import { createEffectSlice }   from './slices/effectSlice.js'
import { createEventSlice }    from './slices/eventSlice.js'
import { createUiSlice }       from './slices/uiSlice.js'

export const useStore = create((set, get) => ({
  ...createCampaignSlice(set, get),
  ...createMapSlice(set, get),
  ...createActorSlice(set, get),
  ...createItemSlice(set, get),
  ...createAbilitySlice(set, get),
  ...createEffectSlice(set, get),
  ...createEventSlice(set, get),
  ...createUiSlice(set, get),
}))

// ── Re-exports for backward compatibility ─────────────────────────
// These names were previously exported directly from useStore.js.
// Code that imports them by name continues to work unchanged.

// ── Model + system re-exports ─────────────────────────────────────
// All of these were previously defined inline in this file.
// Import them from here or directly from their canonical location.

export { newId }                               from '../models/id.js'
export { rotateAoePattern }                    from '../models/effect.js'
export { makeDefaultTileTypes, makeTileType,
         makeMap }                             from '../models/map.js'
export { makeActor }                           from '../models/actor.js'
export { makeItemTemplate, makeItemInstance,
         makeContainer,
         CONTAINER_TYPES }                     from '../models/item.js'
export { makeAbilityTemplate, makeAbilityInstance,
         ABILITY_CATEGORIES,
         ACTION_COSTS, RANGE_TYPES }           from '../models/ability.js'
export { makeStatus, makeEffect,
         makeEffectAction as makeAction }      from '../models/effect.js'
export { makeEvent, makeStep,
         STEP_TYPES, EVENT_TYPES,
         VISIBILITY_OPTIONS }                  from '../models/event.js'
export { makeStoryboard, makeStoryEntry }      from '../models/storyboard.js'
export { makeCampaign }                        from '../models/campaign.js'
export { DND5E, GENERIC, SYSTEMS, getSystem, getCampaignSystem }  from '../systems/index.js'

// ── Backward-compat factory wrappers ──────────────────────────────
// The old makeCharacter/makeCreature took a single `overrides` object.
// They now delegate to makeActor with a default D&D 5e system so that
// any code still calling them by the old names continues to work.
import { makeActor as _makeActor } from '../models/actor.js'

export function makeCharacter(overrides = {}) {
  return _makeActor('dnd5e', overrides.type || 'npc', overrides)
}
export function makeCreature(overrides = {}) {
  return _makeActor('dnd5e', overrides.type || 'wild', overrides)
}

// ── D&D 5e constants (backward compat) ───────────────────────────
// Previously defined inline. Now sourced from the game system but
// mirrored here so existing component imports keep working.
export const DAMAGE_TYPES = [
  'acid','bludgeoning','cold','fire','force','lightning',
  'necrotic','piercing','poison','psychic','radiant','slashing','thunder','none',
]
export const SAVE_STATS = ['STR','DEX','CON','INT','WIS','CHA']

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
