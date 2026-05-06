/**
 * Ability model factories.
 *
 * Abilities exist in two forms:
 *   AbilityTemplate — the definition in the campaign ability library (campaign.abilities)
 *   AbilityInstance — assigned to a specific actor, tracking remaining uses
 *                     and optional per-actor overrides
 */
import { newId } from './id.js'

export function makeAbilityTemplate(overrides = {}) {
  return {
    id: newId(),
    name: 'New Ability',
    description: '',

    // ── Classification ────────────────────────────────────────────
    category: 'attack',       // key from gameSystem.abilityCategories
    actionCost: 'action',     // id from gameSystem.actionCosts
    range: 'melee',           // id from gameSystem.rangeTypes
    rangeDistance: null,      // distance in map units, for 'ranged' type

    // ── Primary damage ────────────────────────────────────────────
    damageDice: '',            // e.g. '2d6' — empty = no damage roll
    damageType: 'none',        // value from gameSystem.damageTypes
    damageBonus: 0,            // flat bonus added after dice roll

    // ── Secondary damage ─────────────────────────────────────────
    // Used for ongoing/lingering effects ("on fire — takes 1d4 each turn")
    secondaryDamageDice: '',
    secondaryDamageType: 'none',
    secondaryDamageDesc: '',

    // ── Area of effect ────────────────────────────────────────────
    aoeShape: 'cone',          // 'cone' | 'line' | 'sphere' | 'cube'
    aoeSize: 15,               // in map units (feet for D&D 5e)

    // ── Saving throw ─────────────────────────────────────────────
    saveStat: null,            // stat ID from gameSystem.savingThrowStats, or null
    saveDC: 13,

    // ── Uses per rest ─────────────────────────────────────────────
    usesPerRest: null,         // null = unlimited
    restType: 'long',          // 'short' | 'long'

    // ── Metadata ─────────────────────────────────────────────────
    conditions: [],            // condition name strings applied on hit
    tags: [],
    customFields: {},
    effectId: null,            // linked Effect from the effect library

    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── D&D 5e ability metadata ───────────────────────────────────────
// Kept here for backward compat — new code should read from the game system.
export const ABILITY_CATEGORIES = {
  attack:   { label: 'Attack',   color: '#c25a4a', icon: '⚔️' },
  defense:  { label: 'Defense',  color: '#5b9bd5', icon: '🛡️' },
  utility:  { label: 'Utility',  color: '#c8a96e', icon: '🔧' },
  passive:  { label: 'Passive',  color: '#7bc47f', icon: '✨' },
  reaction: { label: 'Reaction', color: '#9b7bc4', icon: '⚡' },
}

export const ACTION_COSTS = [
  { id: 'action',   label: 'Action' },
  { id: 'bonus',    label: 'Bonus Action' },
  { id: 'reaction', label: 'Reaction' },
  { id: 'free',     label: 'Free' },
  { id: 'passive',  label: 'Passive' },
]

export const RANGE_TYPES = [
  { id: 'melee',  label: 'Melee' },
  { id: 'ranged', label: 'Ranged' },
  { id: 'self',   label: 'Self' },
  { id: 'touch',  label: 'Touch' },
  { id: 'aoe',    label: 'Area of Effect' },
]

export function makeAbilityInstance(templateId, overrides = {}) {
  return {
    templateId,
    usesRemaining: null,      // null = defer to template's usesPerRest; set explicitly after rests
    overrides: {},            // per-actor overrides: { saveDC, damageDice, etc. }
    ...overrides,
  }
}
