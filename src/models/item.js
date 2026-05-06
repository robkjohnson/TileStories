/**
 * Item and container model factories.
 *
 * Items exist in two forms:
 *   ItemTemplate  — the definition in the campaign item library (campaign.items)
 *   ItemInstance  — a copy living in an actor's inventory or a container
 *
 * Containers are physical objects on the map (chests, barrels, altars) that
 * hold ItemInstances and can be locked.
 */
import { newId } from './id.js'

export function makeItemTemplate(overrides = {}) {
  return {
    id: newId(),
    name: 'New Item',
    description: '',
    category: 'misc',         // key from gameSystem.itemCategories
    rarity: 'common',         // id from gameSystem.rarities
    weight: 0,
    value: 0,                 // in base currency (gp for D&D 5e)
    tags: [],                 // free-form string tags for searching/filtering
    grantedTraits: [],        // [{ id, name, description }] — traits added to bearer
    abilityIds: [],           // AbilityTemplate IDs unlocked when this item is held
    effectId: null,           // linked Effect from the effect library
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
    identified: true,         // false = players see "Unknown Item" instead of the real name
    ...overrides,
  }
}

// ── Container types ───────────────────────────────────────────────
export const CONTAINER_TYPES = [
  { id: 'chest',  label: 'Chest',  emoji: '📦' },
  { id: 'bag',    label: 'Bag',    emoji: '👜' },
  { id: 'barrel', label: 'Barrel', emoji: '🪣' },
  { id: 'crate',  label: 'Crate',  emoji: '📫' },
  { id: 'pouch',  label: 'Pouch',  emoji: '💰' },
  { id: 'altar',  label: 'Altar',  emoji: '🏛️' },
  { id: 'hidden', label: 'Hidden', emoji: '🕳️' },
]

export function makeContainer(overrides = {}) {
  return {
    id: newId(),
    name: 'Chest',
    type: 'chest',            // id from CONTAINER_TYPES
    description: '',
    mapId: null,
    tileKey: null,            // 'q,r' string
    locked: false,
    lockDC: 15,
    discovered: true,         // false = hidden until organizer reveals
    items: [],                // ItemInstance[]
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}
