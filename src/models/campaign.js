/**
 * Campaign model factory.
 *
 * A campaign is the root document for everything: maps, actors, item/ability/
 * effect libraries, storyboards, story entries, and the game system that
 * defines the rules in play.
 *
 * See docs/data-models.md for the full schema reference.
 */
import { newId }              from './id.js'
import { makeMap, makeDefaultTileTypes } from './map.js'

export const SCHEMA_VERSION = 2

export function makeCampaign(gameSystemId = 'dnd5e', overrides = {}) {
  const firstMap = makeMap({
    name: overrides.firstMapName || 'World Map',
    cols: overrides.defaultCols  || 18,
    rows: overrides.defaultRows  || 14,
    defaultBiome: overrides.defaultBiome || 'grassland',
  })

  return {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    name: 'Untitled Campaign',
    description: '',

    // ── Game system ───────────────────────────────────────────────
    // Stores the system ID. The full definition is resolved at runtime
    // via getSystem(campaign.gameSystemId).
    gameSystemId,

    // ── Campaign settings ─────────────────────────────────────────
    settings: {
      defaultBiome: overrides.defaultBiome || 'grassland',
      defaultCols:  overrides.defaultCols  || 18,
      defaultRows:  overrides.defaultRows  || 14,
    },

    // ── Tile types (biomes) ───────────────────────────────────────
    tileTypes: makeDefaultTileTypes(),

    // ── Maps ──────────────────────────────────────────────────────
    maps: { [firstMap.id]: firstMap },
    activeMapId: firstMap.id,

    // ── Actors ────────────────────────────────────────────────────
    // Unified collection: replaces the old split between `characters`
    // and `creatures`. Every token on the map is an actor.
    actors: {},

    // ── Libraries ─────────────────────────────────────────────────
    items: {},          // ItemTemplate library
    abilities: {},      // AbilityTemplate library
    statuses: {},       // Status template library
    effects: {},        // Effect template library
    containers: {},     // Map containers (chests, barrels, altars, etc.)
    storyboards: {},
    story: {},

    // ── Campaign-level attachments ────────────────────────────────
    attachments: [],
    coverImage: null,   // base64 cover art

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    ...overrides,

    // These must always be derived, not overridden by caller
    settings: {
      defaultBiome: overrides.defaultBiome || 'grassland',
      defaultCols:  overrides.defaultCols  || 18,
      defaultRows:  overrides.defaultRows  || 14,
    },
    tileTypes: makeDefaultTileTypes(),
    maps: { [firstMap.id]: firstMap },
    activeMapId: firstMap.id,
  }
}
