#!/usr/bin/env node
/**
 * TileStories Campaign Migration Tool
 *
 * Converts a campaign exported from the old schema (v1 — separate `characters`
 * and `creatures` collections) to the new schema (v2 — unified `actors`
 * collection, per-campaign `gameSystemId`, structured currency).
 *
 * Usage:
 *   node scripts/migrate-campaign.js <input.tilestories.json> [output.tilestories.json]
 *
 * If no output path is given, the migrated file is written to:
 *   <input-name>-migrated.tilestories.json
 *
 * The original file is never modified.
 *
 * Safe to run on already-migrated campaigns — all migrations are idempotent.
 */

const fs   = require('fs')
const path = require('path')

// ── Helpers ───────────────────────────────────────────────────────

function newId() {
  return Math.random().toString(36).slice(2, 10)
}

function iso() {
  return new Date().toISOString()
}

// ── Migration passes ──────────────────────────────────────────────

/**
 * Pass 1: Add tileTypes if missing (oldest campaigns used biome strings only).
 */
function migrateTileTypes(campaign, log) {
  if (campaign.tileTypes !== undefined) return campaign
  log('  + Added default tileTypes (biome-only campaign detected)')
  const DEFAULT_TILE_TYPES = [
    { key: 'grassland', name: 'Grassland', color: '#4a7c59', border: '#3a6045', icon: '🌿', textColor: '#d4f0da', walkable: true  },
    { key: 'plains',    name: 'Plains',    color: '#8a9a4a', border: '#6a7830', icon: '🌾', textColor: '#eef0cc', walkable: true  },
    { key: 'forest',    name: 'Forest',    color: '#2d5a3a', border: '#1e3e28', icon: '🌲', textColor: '#a8d4b0', walkable: true  },
    { key: 'water',     name: 'Water',     color: '#2a5a8a', border: '#1a4070', icon: '🌊', textColor: '#b8d8f8', walkable: false },
    { key: 'ocean',     name: 'Ocean',     color: '#1a3a6a', border: '#102850', icon: '🌊', textColor: '#90c0f0', walkable: false },
    { key: 'mountain',  name: 'Mountain',  color: '#6a6a6a', border: '#4a4a4a', icon: '⛰️',  textColor: '#e8e8e8', walkable: false },
    { key: 'desert',    name: 'Desert',    color: '#a88040', border: '#806020', icon: '🏜️', textColor: '#f8e8b0', walkable: true  },
    { key: 'swamp',     name: 'Swamp',     color: '#4a6a3a', border: '#2a4a20', icon: '🍄', textColor: '#c0d8a0', walkable: true  },
    { key: 'snow',      name: 'Snow',      color: '#8090b0', border: '#607090', icon: '❄️',  textColor: '#e8eef8', walkable: true  },
    { key: 'lava',      name: 'Lava',      color: '#9a3010', border: '#701800', icon: '🌋', textColor: '#ffc8a0', walkable: false },
    { key: 'path',      name: 'Path',      color: '#907060', border: '#705040', icon: '🛤️', textColor: '#f0e0d0', walkable: true  },
    { key: 'town',      name: 'Town',      color: '#806080', border: '#604060', icon: '🏘️', textColor: '#f0d8f0', walkable: true  },
    { key: 'dungeon',   name: 'Dungeon',   color: '#303050', border: '#181830', icon: '🗝️', textColor: '#c0c0e0', walkable: true  },
    { key: 'ruins',     name: 'Ruins',     color: '#706050', border: '#504030', icon: '🏛️', textColor: '#e0d0b0', walkable: true  },
    { key: 'cave',      name: 'Cave',      color: '#404050', border: '#202030', icon: '🕳️', textColor: '#b0b0c8', walkable: true  },
    { key: 'field',     name: 'Field',     color: '#7a9030', border: '#5a7010', icon: '🌻', textColor: '#e8f0a0', walkable: true  },
  ]
  const tileTypes = Object.fromEntries(
    DEFAULT_TILE_TYPES.map(({ key, name, color, border, icon, textColor, walkable }) => [
      key, { id: key, name, color, border, textColor, icon, walkable, traits: [], statusEffects: [], displayBackground: null, createdAt: iso() }
    ])
  )
  return { ...campaign, tileTypes }
}

/**
 * Pass 2: Add statuses/effects collections and trait/status fields to characters.
 */
function migrateEffectSystem(campaign, log) {
  let changed = false
  if (campaign.statuses === undefined || campaign.effects === undefined) {
    changed = true
    log('  + Added statuses/effects collections')
  }
  const patched = { statuses: {}, effects: {}, ...campaign }
  const characters = Object.fromEntries(
    Object.entries(patched.characters || {}).map(([id, c]) => {
      if (!c.traits || !c.activeStatuses) changed = true
      return [id, { traits: [], activeStatuses: [], ...c }]
    })
  )
  if (changed) log('  + Ensured trait/activeStatuses fields on characters')
  return { ...patched, characters }
}

/**
 * Pass 3: Unify characters + creatures into a single actors collection.
 *
 * Key transformations:
 *   character.type           → actor.actorType
 *   creature.type            → actor.actorType
 *   creature.statBlock.*     → actor.stats.* (flattened)
 *   creature.traits (objects)→ actor.customFields.passiveAbilities
 *   character.currency (num) → actor.currency { gp: num }
 *   actor.currency (missing) → actor.currency { gp: 0 }
 */
function migrateToActors(campaign, log) {
  if (campaign.schemaVersion >= 2 || campaign.actors !== undefined) return campaign

  const actors = {}
  let charCount = 0
  let creatureCount = 0

  // ── Characters ────────────────────────────────────────────────
  Object.entries(campaign.characters || {}).forEach(([id, c]) => {
    charCount++
    actors[id] = {
      id,
      actorType: c.type || 'npc',
      name: c.name || 'Unnamed',
      emoji: c.emoji ?? null,
      portrait: c.portrait ?? null,
      attachments: c.attachments || [],
      stats: {
        hp:         c.stats?.hp         ?? 10,
        maxHp:      c.stats?.maxHp      ?? 10,
        ac:         c.stats?.ac         ?? 10,
        speed:      c.stats?.speed      ?? 30,
        initiative: c.stats?.initiative ?? 0,
        str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
      },
      species: '',
      traits: Array.isArray(c.traits) ? c.traits.filter(t => typeof t === 'string') : [],
      activeStatuses: c.activeStatuses || [],
      abilities: c.abilities || [],
      inventory: c.inventory || [],
      currency: typeof c.currency === 'number'
        ? { gp: c.currency, sp: 0, cp: 0 }
        : (c.currency && typeof c.currency === 'object' ? c.currency : { gp: 0 }),
      notes:       c.notes       || '',
      publicNotes: c.publicNotes || '',
      description: c.description || '',
      biography:   c.biography   || '',
      ownedBy: null,
      assignedPlayer: null,
      isKey:               c.isKey             ?? false,
      revealedToPlayers:   c.revealedToPlayers ?? false,
      currentMapId: c.currentMapId ?? null,
      currentTile:  c.currentTile  ?? null,
      customFields: {},
      createdAt:   c.createdAt   || iso(),
      updatedAt:   iso(),
    }
  })

  // ── Creatures ─────────────────────────────────────────────────
  Object.entries(campaign.creatures || {}).forEach(([id, c]) => {
    creatureCount++

    // Separate descriptive trait objects from string trait tags
    const passiveAbilities = Array.isArray(c.traits)
      ? c.traits.filter(t => typeof t === 'object' && t !== null)
      : []
    const stringTraits = Array.isArray(c.traits)
      ? c.traits.filter(t => typeof t === 'string')
      : []

    // Creature abilities may be descriptive objects, not template instances
    const templateAbilities  = (c.abilities || []).filter(a => a.templateId)
    const legacyAbilities    = (c.abilities || []).filter(a => !a.templateId)

    actors[id] = {
      id,
      actorType: c.type || 'wild',
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
      abilities: templateAbilities,
      inventory: c.inventory || [],
      currency: { gp: 0 },
      notes:       c.notes || '',
      publicNotes: '',
      description: '',
      biography:   '',
      ownedBy:           c.ownedBy           ?? null,
      assignedPlayer:    null,
      isKey:             c.isKey             ?? false,
      revealedToPlayers: c.revealedToPlayers ?? false,
      currentMapId: c.currentMapId ?? null,
      currentTile:  c.currentTile  ?? null,
      customFields: {
        ...(passiveAbilities.length > 0 ? { passiveAbilities } : {}),
        ...(legacyAbilities.length > 0  ? { legacyAbilities }  : {}),
      },
      createdAt: c.createdAt || iso(),
      updatedAt: iso(),
    }
  })

  log(`  + Unified ${charCount} character(s) and ${creatureCount} creature(s) into actors`)

  // Remove old collections, add actors + gameSystemId + schemaVersion
  const { characters: _c, creatures: _cr, ...rest } = campaign
  return {
    ...rest,
    actors,
    gameSystemId: campaign.gameSystemId || 'dnd5e',
    schemaVersion: 2,
  }
}

/**
 * Pass 4: Ensure gameSystemId is present.
 */
function migrateGameSystem(campaign, log) {
  if (campaign.gameSystemId) return campaign
  log('  + Added gameSystemId: dnd5e (default)')
  return { ...campaign, gameSystemId: 'dnd5e' }
}

/**
 * Pass 5: Normalise story entry linkedCharacterIds → linkedActorIds.
 */
function migrateStoryEntries(campaign, log) {
  if (!campaign.story) return campaign
  const hasOldField = Object.values(campaign.story).some(e => e.linkedCharacterIds !== undefined)
  if (!hasOldField) return campaign
  log('  + Renamed linkedCharacterIds → linkedActorIds in story entries')
  const story = Object.fromEntries(
    Object.entries(campaign.story).map(([id, e]) => {
      if (e.linkedCharacterIds === undefined) return [id, e]
      const { linkedCharacterIds, ...rest } = e
      return [id, { ...rest, linkedActorIds: linkedCharacterIds }]
    })
  )
  return { ...campaign, story }
}

// ── Run all migrations ────────────────────────────────────────────

function migrate(campaign) {
  const log = (msg) => console.log(msg)
  let c = campaign
  c = migrateTileTypes(c, log)
  c = migrateEffectSystem(c, log)
  c = migrateToActors(c, log)
  c = migrateGameSystem(c, log)
  c = migrateStoryEntries(c, log)
  c.updatedAt = iso()
  return c
}

// ── CLI entry point ───────────────────────────────────────────────

function main() {
  const [,, inputPath, outputArg] = process.argv

  if (!inputPath) {
    console.error('Usage: node scripts/migrate-campaign.js <input.tilestories.json> [output.tilestories.json]')
    process.exit(1)
  }

  const resolved = path.resolve(inputPath)
  if (!fs.existsSync(resolved)) {
    console.error(`Error: File not found — ${resolved}`)
    process.exit(1)
  }

  let raw
  try {
    raw = fs.readFileSync(resolved, 'utf8')
  } catch (e) {
    console.error(`Error reading file: ${e.message}`)
    process.exit(1)
  }

  let campaign
  try {
    campaign = JSON.parse(raw)
  } catch (e) {
    console.error(`Error parsing JSON: ${e.message}`)
    process.exit(1)
  }

  console.log(`\nMigrating: ${campaign.name || '(unnamed)'} (schema v${campaign.schemaVersion ?? 1})`)
  console.log('─'.repeat(50))

  const migrated = migrate(campaign)

  const outputPath = outputArg
    ? path.resolve(outputArg)
    : resolved.replace(/\.tilestories\.json$/, '-migrated.tilestories.json')

  try {
    fs.writeFileSync(outputPath, JSON.stringify(migrated, null, 2), 'utf8')
  } catch (e) {
    console.error(`Error writing output: ${e.message}`)
    process.exit(1)
  }

  const inputBytes  = Buffer.byteLength(raw, 'utf8')
  const outputBytes = Buffer.byteLength(JSON.stringify(migrated), 'utf8')

  console.log('─'.repeat(50))
  console.log(`\n✓  Migration complete`)
  console.log(`   Input:   ${inputPath} (${(inputBytes / 1024).toFixed(1)} KB)`)
  console.log(`   Output:  ${outputPath} (${(outputBytes / 1024).toFixed(1)} KB)`)
  console.log(`   Schema:  v${campaign.schemaVersion ?? 1} → v${migrated.schemaVersion}`)
  console.log(`   Actors:  ${Object.keys(migrated.actors || {}).length} total\n`)
}

main()
