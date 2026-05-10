/**
 * Campaign slice — root campaign CRUD and schema migrations.
 *
 * Migrations run automatically on load whenever a campaign from an older
 * schema version is detected. Each migration function is idempotent:
 * running it on an already-migrated campaign is a no-op.
 */
import { makeDefaultTileTypes } from '../../models/map.js'
import { SCHEMA_VERSION }       from '../../models/campaign.js'

// ── Migration passes ──────────────────────────────────────────────

/** v1 → v1.1: add tileTypes when missing (biome-only campaigns) */
function migrateTileTypes(campaign) {
  if (campaign.tileTypes !== undefined) return campaign
  return { ...campaign, tileTypes: makeDefaultTileTypes() }
}

/** v1 → v1.2: add statuses/effects collections and actor trait/status fields */
function migrateEffectSystem(campaign) {
  const patched = { statuses: {}, effects: {}, ...campaign }
  const characters = Object.fromEntries(
    Object.entries(patched.characters || {}).map(([id, c]) => [
      id, { traits: [], activeStatuses: [], ...c },
    ])
  )
  return { ...patched, characters }
}

/** v1 → v2: unify characters + creatures into actors collection */
function migrateToActors(campaign) {
  if (campaign.schemaVersion >= 2 || campaign.actors !== undefined) return campaign

  const actors = {}

  // Migrate characters
  Object.entries(campaign.characters || {}).forEach(([id, c]) => {
    actors[id] = {
      id,
      actorType: c.type || 'npc',   // 'player' | 'npc' | 'monster'
      name: c.name || 'Unnamed',
      emoji: c.emoji ?? null,
      portrait: c.portrait ?? null,
      attachments: c.attachments || [],
      // Flatten stats: characters already had a flat stats object
      stats: {
        hp:         c.stats?.hp         ?? 10,
        maxHp:      c.stats?.maxHp      ?? 10,
        ac:         c.stats?.ac         ?? 10,
        speed:      c.stats?.speed      ?? 30,
        initiative: c.stats?.initiative ?? 0,
        str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, // safe defaults
      },
      species: '',
      traits: c.traits || [],
      activeStatuses: c.activeStatuses || [],
      abilities: c.abilities || [],
      inventory: c.inventory || [],
      // Convert legacy numeric currency to object form
      currency: typeof c.currency === 'number'
        ? { gp: c.currency, sp: 0, cp: 0 }
        : (c.currency || { gp: 0 }),
      notes: c.notes || '',
      publicNotes: c.publicNotes || '',
      description: c.description || '',
      biography: c.biography || '',
      ownedBy: null,
      assignedPlayer: null,
      isKey: c.isKey ?? false,
      revealedToPlayers: c.revealedToPlayers ?? false,
      currentMapId: c.currentMapId ?? null,
      currentTile: c.currentTile ?? null,
      customFields: {},
      createdAt: c.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })

  // Migrate creatures
  Object.entries(campaign.creatures || {}).forEach(([id, c]) => {
    // creature.traits was [{id,name,description}] — move to customFields
    const passiveAbilities = Array.isArray(c.traits)
      ? c.traits.filter(t => typeof t === 'object')
      : []
    const stringTraits = Array.isArray(c.traits)
      ? c.traits.filter(t => typeof t === 'string')
      : []

    actors[id] = {
      id,
      actorType: c.type || 'wild',  // 'wild' | 'pet' | 'mount' | 'companion' | 'enemy'
      name: c.name || 'Unnamed Creature',
      emoji: c.emoji ?? '🐾',
      portrait: c.portrait ?? null,
      attachments: [],
      stats: {
        hp:         c.statBlock?.hp         ?? 10,
        maxHp:      c.statBlock?.maxHp      ?? 10,
        ac:         c.statBlock?.ac         ?? 10,
        speed:      c.statBlock?.speed      ?? 30,
        initiative: 0,
        str: c.statBlock?.str ?? 10,
        dex: c.statBlock?.dex ?? 10,
        con: c.statBlock?.con ?? 10,
        int: c.statBlock?.int ?? 10,
        wis: c.statBlock?.wis ?? 10,
        cha: c.statBlock?.cha ?? 10,
        cr:   c.statBlock?.cr   ?? '—',
        size: c.statBlock?.size ?? 'medium',
      },
      species: c.species || '',
      traits: stringTraits,
      activeStatuses: [],
      abilities: c.abilities?.filter(a => a.templateId) || [],
      inventory: c.inventory || [],
      currency: { gp: 0 },
      notes: c.notes || '',
      publicNotes: '',
      description: '',
      biography: '',
      ownedBy: c.ownedBy ?? null,
      assignedPlayer: null,
      isKey: c.isKey ?? false,
      revealedToPlayers: c.revealedToPlayers ?? false,
      currentMapId: c.currentMapId ?? null,
      currentTile: c.currentTile ?? null,
      customFields: passiveAbilities.length > 0
        ? { passiveAbilities }
        : {},
      createdAt: c.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })

  const { characters: _c, creatures: _cr, ...rest } = campaign
  return {
    ...rest,
    actors,
    gameSystemId: campaign.gameSystemId || 'dnd5e',
    schemaVersion: SCHEMA_VERSION,
  }
}

/** v2+: add gameSystemId if somehow missing */
function migrateGameSystem(campaign) {
  if (campaign.gameSystemId) return campaign
  return { ...campaign, gameSystemId: 'dnd5e' }
}

/** add joinScreenBg if missing */
function migrateJoinScreen(campaign) {
  if (campaign.joinScreenBg !== undefined) return campaign
  return { ...campaign, joinScreenBg: null }
}

// Run all migrations in sequence. Safe to call on any schema version.
export function migrateCampaign(campaign) {
  if (!campaign) return campaign
  let c = campaign
  c = migrateTileTypes(c)
  c = migrateEffectSystem(c)
  c = migrateToActors(c)
  c = migrateGameSystem(c)
  c = migrateJoinScreen(c)
  return c
}

// ── Slice ─────────────────────────────────────────────────────────
export const createCampaignSlice = (set, _get) => ({
  campaign: null,

  setCampaign(campaign) {
    if (!campaign) { set({ campaign: null, effectMode: null }); return }
    set({ campaign: migrateCampaign(campaign), effectMode: null })
  },

  updateCampaign(partial) {
    set(s => ({
      campaign: { ...s.campaign, ...partial, updatedAt: new Date().toISOString() },
    }))
  },
})
