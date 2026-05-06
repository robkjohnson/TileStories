/**
 * Actor model factory.
 *
 * "Actor" is the unified entity that replaces the old split between
 * `characters` (player/npc/monster) and `creatures` (wild/pet/mount/…).
 * Both are now a single collection: campaign.actors.
 *
 * An actor's stats object is intentionally flexible — it stores whatever
 * keys the campaign's game system defines, so the same schema works for
 * D&D 5e, a custom system, or anything in between.
 *
 * See docs/data-models.md for the full field reference.
 */
import { newId } from './id.js'
import { defaultStatsForSystem, defaultCurrencyForSystem } from '../systems/index.js'

/**
 * Create a new actor with sensible defaults.
 *
 * @param {string|object} gameSystem  - System ID string or full system object.
 * @param {string}        actorType   - One of the IDs from gameSystem.actorTypes.
 * @param {object}        overrides   - Any fields to override on the default.
 */
export function makeActor(gameSystem, actorType = 'npc', overrides = {}) {
  return {
    id: newId(),
    actorType,                    // maps to gameSystem.actorTypes[x].id

    // ── Display ──────────────────────────────────────────────────
    name: 'Unnamed',
    emoji: null,                  // emoji string or null
    portrait: null,               // base64 data URL or null
    attachments: [],              // [{ id, name, type, size, dataUrl, uploadedAt }]

    // ── Stats ────────────────────────────────────────────────────
    // Keyed by gameSystem.stats[x].id. Holds any mix of numbers and text.
    stats: defaultStatsForSystem(gameSystem),

    // ── Creature metadata (D&D 5e specific but generic-safe) ─────
    species: '',                  // free-form species/race string

    // ── Game systems ─────────────────────────────────────────────
    traits: [],                   // string[] — tags used for event gating and status negation
    activeStatuses: [],           // [{ statusId, appliedAt, remainingRounds?, expireOn?, appliedModifiers?, sourceTile? }]
    resistances: [],              // damage type IDs — actor takes half damage from these
    vulnerabilities: [],          // damage type IDs — actor takes double damage from these
    immunities: [],               // damage type IDs — actor takes no damage from these
    abilities: [],                // [{ templateId, usesRemaining, overrides }]
    inventory: [],                // [{ id, templateId, quantity, notes, identified }]
    currency: defaultCurrencyForSystem(gameSystem), // { gp: 0, sp: 0, ... }

    // ── Notes (multi-audience) ───────────────────────────────────
    notes: '',                    // organizer only — never sent to players
    publicNotes: '',              // legacy compat field — visible to players
    description: '',              // public character lore — shown to all players
    biography: '',                // private backstory — shown only to owning player + organizer

    // ── Ownership & assignment ───────────────────────────────────
    ownedBy: null,                // actorId — for pets/mounts owned by another actor
    assignedPlayer: null,         // player device ID — which player controls this actor

    // ── Visibility ───────────────────────────────────────────────
    isKey: false,                 // key actors are visible on all maps simultaneously
    revealedToPlayers: false,     // organizer can make any actor visible to players

    // ── Map position ─────────────────────────────────────────────
    currentMapId: null,
    currentTile: null,            // { q, r }

    // ── Extensibility ────────────────────────────────────────────
    // Organizers can store arbitrary extra data here without touching
    // the schema. UI components can render customFields generically.
    customFields: {},

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    ...overrides,
  }
}
