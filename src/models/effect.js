/**
 * Effect and status model factories.
 *
 * Effects are executable game actions (deal damage, apply statuses) that can
 * be triggered by tile events or actor abilities.
 *
 * Statuses are reusable condition templates (Poisoned, On Fire, Blessed)
 * stored in the campaign library and applied to actors or tiles.
 */
import { newId } from './id.js'

// ── AoE rotation helper ───────────────────────────────────────────
// Rotates an AoE pattern by `rotation` steps of 45° each (8 per full circle).
// Uses 2D trig on the axial offsets — accurate enough for hex and square grids.
export function rotateAoePattern(pattern, rotation, _isSquare) {
  if (!rotation || !pattern?.length) return pattern || []
  const angle = rotation * (Math.PI / 4)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return pattern.map(({ dq, dr }) => ({
    dq: Math.round(dq * cos - dr * sin),
    dr: Math.round(dq * sin + dr * cos),
  }))
}

// ── Effect factory ────────────────────────────────────────────────
export function makeEffect(overrides = {}) {
  return {
    id: newId(),
    name: 'New Effect',
    description: '',

    // How targets are selected when this effect fires
    targetType: 'single_tile',  // 'single_tile' | 'tile_aoe' | 'tile_select' | 'char_select'
    targetCount: 1,             // for 'tile_select' and 'char_select' modes

    // AoE pattern: offsets from the root tile. Rotated at fire time.
    aoePattern: [],             // [{ dq, dr }]

    // Whether the effect persists after it fires
    durationType: 'one_time',   // 'one_time' | 'lingering'

    // Ordered list of things that happen when this effect executes
    actions: [],                // EffectAction[]

    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makeEffectAction(overrides = {}) {
  return {
    id: newId(),
    type: 'damage',             // 'damage' | 'apply_status'
    diceExpr: '',               // e.g. '2d6+3' — for 'damage' type
    flatAmount: 0,              // flat damage added on top of dice roll
    damageType: null,           // string key from system.damageTypes, or null = untyped
    save: null,                 // null | { stat, dc, onSave: 'half'|'none' }
    statusId: null,             // for 'apply_status' type
    ...overrides,
  }
}

// ── Status factory ────────────────────────────────────────────────
export function makeStatus(overrides = {}) {
  return {
    id: newId(),
    name: 'New Status',
    description: '',
    color: '#c25a4a',
    icon: '⚠️',

    // Traits that completely prevent this status from being applied
    negatingTraits: [],         // string[]

    // Other status IDs that this status blocks (can't coexist)
    blocks: [],                 // statusId[]

    // Whether this status can be applied to actors, tiles, or both
    eligibleTargets: 'characters', // 'characters' | 'tiles'

    // What this status actually does when applied
    modifiers: [],              // StatusModifier[]

    // How long this status lasts once applied. null = permanent.
    // { rounds: number, expireOn: 'start' | 'end' }
    // expireOn controls whether it ticks at the start or end of the affected actor's turn.
    duration: null,

    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Status modifier factory ───────────────────────────────────────
// A single mechanical change that a status applies.
//
// type: 'stat'              — add `value` to actor stat `stat`
//       'setWalkable'       — set tile walkability to `value` (boolean as 0/1)
//       'applyToCharacters' — auto-apply status `statusId` to actors on affected tile
export function makeStatusModifier(overrides = {}) {
  return {
    id: newId(),
    type: 'stat',
    stat: 'hp',       // stat ID from the game system, used for 'stat' type
    value: 0,
    statusId: null,   // for 'applyToCharacters' type
    lingering: false, // if true, the effect persists when the actor leaves the tile
    ...overrides,
  }
}
