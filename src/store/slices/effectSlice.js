/**
 * Effect slice — status/effect template libraries, status application to
 * tiles, and effect execution (the damage/status engine).
 */
import { makeStatus, makeEffect, rotateAoePattern } from '../../models/effect.js'
import { makeTile }                                  from '../../models/map.js'
import { rollDiceExpr }                              from '../../utils/dice.js'
import { getSystem }                                 from '../../systems/index.js'

// Returns the save roll bonus for a given stat on an actor.
// For 'attribute'-type stats (D&D ability scores) converts the raw score to a modifier.
// Other systems store modifiers directly, so the raw value is used as-is.
function getSaveBonus(actor, system, statId) {
  const statDef = system?.stats?.find(s => s.id === statId)
  const raw = actor.stats?.[statId] ?? 0
  return statDef?.type === 'attribute' ? Math.floor((raw - 10) / 2) : raw
}

export const createEffectSlice = (set, get) => ({

  // ── Status template library ───────────────────────────────────
  addStatus(data = {}) {
    const s = makeStatus(data)
    set(st => ({
      campaign: {
        ...st.campaign,
        statuses: { ...st.campaign.statuses, [s.id]: s },
        updatedAt: new Date().toISOString(),
      },
    }))
    return s.id
  },

  updateStatus(id, partial) {
    set(st => ({
      campaign: {
        ...st.campaign,
        statuses: { ...st.campaign.statuses, [id]: { ...st.campaign.statuses[id], ...partial } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  deleteStatus(id) {
    const { campaign } = get()
    if (!campaign) return
    const statuses = { ...campaign.statuses }
    delete statuses[id]

    // Remove from actor activeStatuses
    const actors = Object.fromEntries(
      Object.entries(campaign.actors || {}).map(([aid, a]) => [
        aid, { ...a, activeStatuses: (a.activeStatuses || []).filter(s => s.statusId !== id) },
      ])
    )

    // Remove from tile activeStatuses across all maps
    const maps = Object.fromEntries(
      Object.entries(campaign.maps || {}).map(([mapId, map]) => [
        mapId, {
          ...map,
          tiles: Object.fromEntries(
            Object.entries(map.tiles || {}).map(([key, tile]) => [
              key, { ...tile, activeStatuses: (tile.activeStatuses || []).filter(s => s.statusId !== id) },
            ])
          ),
        },
      ])
    )

    // Remove from effect actions
    const effects = Object.fromEntries(
      Object.entries(campaign.effects || {}).map(([eid, e]) => [
        eid, { ...e, actions: (e.actions || []).filter(a => a.statusId !== id) },
      ])
    )

    // Remove from other statuses' blocks lists
    const patchedStatuses = Object.fromEntries(
      Object.entries(statuses).map(([sid, s]) => [
        sid, { ...s, blocks: (s.blocks || []).filter(bid => bid !== id) },
      ])
    )

    set(st => ({
      campaign: {
        ...st.campaign,
        statuses: patchedStatuses,
        effects,
        actors,
        maps,
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  // ── Effect template library ───────────────────────────────────
  addEffect(data = {}) {
    const e = makeEffect(data)
    set(st => ({
      campaign: {
        ...st.campaign,
        effects: { ...st.campaign.effects, [e.id]: e },
        updatedAt: new Date().toISOString(),
      },
    }))
    return e.id
  },

  updateEffect(id, partial) {
    set(st => ({
      campaign: {
        ...st.campaign,
        effects: { ...st.campaign.effects, [id]: { ...st.campaign.effects[id], ...partial } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  deleteEffect(id) {
    const effects = { ...get().campaign?.effects }
    delete effects[id]
    set(st => ({ campaign: { ...st.campaign, effects, updatedAt: new Date().toISOString() } }))
  },

  // ── Status application to tiles ───────────────────────────────
  applyStatusToTile(mapId, tileKey, statusId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const tile = map.tiles[tileKey] ?? makeTile(map.defaultBiome)
    const status = campaign.statuses?.[statusId]
    if (!status) return

    const tileTraits = campaign.tileTypes?.[tile.biome]?.traits || []
    if (status.negatingTraits?.some(t => tileTraits.includes(t))) return
    const activeStatuses = tile.activeStatuses || []
    if (activeStatuses.some(s => s.statusId === statusId)) return

    const walkableMod = (status.modifiers || []).find(m => m.type === 'setWalkable')
    let updatedTile = { ...tile }
    const entry = { statusId, appliedAt: new Date().toISOString() }
    if (walkableMod !== undefined) {
      const tileType = campaign.tileTypes?.[tile.biome]
      const effective = tile.walkable !== undefined ? tile.walkable : (tileType?.walkable ?? true)
      entry.originalWalkable = effective
      updatedTile.walkable = walkableMod.value
    }

    set(st => ({
      campaign: {
        ...st.campaign,
        maps: {
          ...st.campaign.maps,
          [mid]: {
            ...map,
            tiles: { ...map.tiles, [tileKey]: { ...updatedTile, activeStatuses: [...activeStatuses, entry] } },
          },
        },
        updatedAt: new Date().toISOString(),
      },
    }))

    // Auto-apply to actors already on this tile
    const applyToActorMods = (status.modifiers || []).filter(m => m.type === 'applyToCharacters')
    if (applyToActorMods.length > 0) {
      const { campaign: updated } = get()
      const actorsOnTile = (updated.maps[mid]?.tiles[tileKey]?.tokens || [])
        .filter(id => updated.actors?.[id])
      for (const aid of actorsOnTile) {
        for (const mod of applyToActorMods) {
          get().applyStatusToActor(aid, mod.statusId, { mapId: mid, tileKey, lingering: mod.lingering ?? false })
        }
      }
    }
  },

  removeStatusFromTile(mapId, tileKey, statusId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const tile = map.tiles[tileKey]
    if (!tile) return

    // Remove tile-sourced statuses from actors standing on the tile
    const status = campaign.statuses?.[statusId]
    const applyToActorMods = (status?.modifiers || []).filter(m => m.type === 'applyToCharacters')
    if (applyToActorMods.length > 0) {
      const actorsOnTile = (tile.tokens || []).filter(id => campaign.actors?.[id])
      for (const aid of actorsOnTile) {
        const actor = campaign.actors[aid]
        for (const mod of applyToActorMods) {
          const hasTileEntry = (actor.activeStatuses || []).some(
            s => s.statusId === mod.statusId && s.sourceTile?.tileKey === tileKey && s.sourceTile?.mapId === mid
          )
          if (hasTileEntry && !mod.lingering) get().removeStatusFromActor(aid, mod.statusId)
        }
      }
    }

    const entry = (tile.activeStatuses || []).find(s => s.statusId === statusId)
    let updatedTile = { ...tile }
    if (entry && 'originalWalkable' in entry) updatedTile.walkable = entry.originalWalkable

    set(st => ({
      campaign: {
        ...st.campaign,
        maps: {
          ...st.campaign.maps,
          [mid]: {
            ...map,
            tiles: {
              ...map.tiles,
              [tileKey]: { ...updatedTile, activeStatuses: (tile.activeStatuses || []).filter(s => s.statusId !== statusId) },
            },
          },
        },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  // ── Effect execution ──────────────────────────────────────────
  // Shared logic for resolving affected tiles/actors and applying actions.
  _resolveAndExecute(effect, selectedTiles, selectedChars, aoeRotation, mapId) {
    const { campaign } = get()
    if (!campaign) return { updatedActors: {}, updatedMaps: {}, results: [] }
    const mid = mapId ?? campaign.activeMapId
    const activeMap = campaign.maps[mid]
    const now = new Date().toISOString()
    const isSquare = activeMap?.tileStyle === 'square'
    const results = []
    const system = getSystem(campaign.gameSystemId)

    // Resolve affected tiles
    let affectedTiles = []
    if (effect.targetType === 'single_tile') {
      affectedTiles = selectedTiles.slice(0, 1)
    } else if (effect.targetType === 'tile_aoe' && selectedTiles.length > 0) {
      const root = selectedTiles[0]
      const rotated = rotateAoePattern(effect.aoePattern, aoeRotation, isSquare)
      affectedTiles = [root, ...rotated.map(({ dq, dr }) => ({ q: root.q + dq, r: root.r + dr }))]
        .filter(t => t.q >= 0 && t.q < activeMap.cols && t.r >= 0 && t.r < activeMap.rows)
    } else if (effect.targetType === 'tile_select') {
      affectedTiles = selectedTiles
    }

    // Collect actor IDs from tiles + explicit char selection
    let affectedActorIds = [...selectedChars]
    if (effect.targetType !== 'char_select') {
      affectedTiles.forEach(({ q, r }) => {
        const tile = activeMap?.tiles?.[`${q},${r}`]
        if (tile?.tokens) affectedActorIds = [...affectedActorIds, ...tile.tokens]
      })
    }
    affectedActorIds = [...new Set(affectedActorIds)]

    let updatedActors = { ...campaign.actors }
    let updatedMaps   = { ...campaign.maps }

    effect.actions.forEach(action => {
      if (action.type === 'damage') {
        const rolled = action.diceExpr ? rollDiceExpr(action.diceExpr) : 0
        const baseDamage = rolled + (action.flatAmount || 0)
        if (baseDamage <= 0) return
        const dmgType = action.damageType || null

        affectedActorIds.forEach(aid => {
          const actor = updatedActors[aid]
          if (!actor) return

          // Immunity — target takes no damage
          if (dmgType && (actor.immunities || []).includes(dmgType)) {
            results.push({ actorId: aid, name: actor.name, damage: 0, newHp: actor.stats?.hp ?? 0, immune: true, damageType: dmgType })
            return
          }

          let finalDamage = baseDamage
          let saveResult = null

          // Saving throw
          if (action.save?.stat && action.save?.dc > 0) {
            const bonus = getSaveBonus(actor, system, action.save.stat)
            const roll = Math.floor(Math.random() * 20) + 1
            const total = roll + bonus
            const succeeded = total >= action.save.dc
            saveResult = { roll, bonus, total, succeeded, dc: action.save.dc, stat: action.save.stat }
            if (succeeded) {
              if (action.save.onSave === 'none') {
                results.push({ actorId: aid, name: actor.name, damage: 0, newHp: actor.stats?.hp ?? 0, saved: true, saveResult, damageType: dmgType })
                return
              }
              if (action.save.onSave === 'half') finalDamage = Math.floor(finalDamage / 2)
            }
          }

          // Resistance (half) then vulnerability (double) — both active cancels out
          if (dmgType) {
            if ((actor.resistances || []).includes(dmgType)) finalDamage = Math.floor(finalDamage / 2)
            if ((actor.vulnerabilities || []).includes(dmgType)) finalDamage = finalDamage * 2
          }

          const newHp = Math.max(0, (actor.stats?.hp ?? 0) - finalDamage)
          updatedActors[aid] = { ...actor, stats: { ...actor.stats, hp: newHp } }
          results.push({ actorId: aid, name: actor.name, damage: finalDamage, newHp, saved: saveResult?.succeeded ?? false, saveResult, damageType: dmgType })
        })

      } else if (action.type === 'apply_status') {
        const status = campaign.statuses?.[action.statusId]
        if (!status) return

        affectedActorIds.forEach(aid => {
          const actor = updatedActors[aid]
          if (!actor) return
          const traits = actor.traits || []
          if (status.negatingTraits?.some(t => traits.includes(t))) return
          const actives = actor.activeStatuses || []
          if (actives.some(s => s.statusId === action.statusId)) return
          if (actives.some(s => (campaign.statuses?.[s.statusId]?.blocks || []).includes(action.statusId))) return
          const sEntry = { statusId: action.statusId, appliedAt: now }
          if (status.duration) {
            sEntry.remainingRounds = status.duration.rounds
            sEntry.expireOn = status.duration.expireOn
          }
          updatedActors[aid] = { ...actor, activeStatuses: [...actives, sEntry] }
        })

        affectedTiles.forEach(({ q, r }) => {
          const key = `${q},${r}`
          const curMap = updatedMaps[mid]
          const tile = curMap?.tiles?.[key] ?? makeTile(curMap?.defaultBiome || 'grassland')
          const tileTraits = campaign.tileTypes?.[tile.biome]?.traits || []
          if (status.negatingTraits?.some(t => tileTraits.includes(t))) return
          const actives = tile.activeStatuses || []
          if (actives.some(s => s.statusId === action.statusId)) return
          updatedMaps = {
            ...updatedMaps,
            [mid]: {
              ...updatedMaps[mid],
              tiles: { ...updatedMaps[mid].tiles, [key]: { ...tile, activeStatuses: [...actives, { statusId: action.statusId, appliedAt: now }] } },
            },
          }
        })
      }
    })

    return { updatedActors, updatedMaps, results }
  },

  // Organizer fires an effect from the effectMode UI state
  executeEffect() {
    const { campaign, effectMode } = get()
    if (!effectMode || !campaign) return
    const effect = campaign.effects?.[effectMode.effectId]
    if (!effect) { set({ effectMode: null }); return }
    const { selectedTiles, selectedChars, aoeRotation = 0 } = effectMode
    const { updatedActors, updatedMaps, results } = get()._resolveAndExecute(
      effect, selectedTiles, selectedChars, aoeRotation, campaign.activeMapId
    )
    set(st => ({
      campaign: { ...st.campaign, actors: updatedActors, maps: updatedMaps, updatedAt: new Date().toISOString() },
      effectMode: null,
      lastEffectResults: results.length > 0 ? results : null,
    }))
  },

  // Player fires an effect via WebSocket (from an ability use)
  executeEffectFromPlayer({ actorId, effectId, sourceType, sourceId, selectedTiles = [], selectedChars = [], aoeRotation = 0 }) {
    const { campaign } = get()
    if (!campaign) return
    const effect = campaign.effects?.[effectId]
    if (!effect) return

    let updatedActors = { ...campaign.actors }

    // Deduct ability uses from the source actor
    if (actorId && sourceType === 'ability' && sourceId) {
      const sourceActor = updatedActors[actorId]
      if (sourceActor) {
        const newAbilities = (sourceActor.abilities || []).map(a => {
          if (a.templateId !== sourceId) return a
          const tmpl = campaign.abilities?.[a.templateId]
          if (!tmpl?.usesPerRest) return a
          const cur = a.usesRemaining ?? tmpl.usesPerRest
          return { ...a, usesRemaining: Math.max(0, cur - 1) }
        })
        updatedActors[actorId] = { ...sourceActor, abilities: newAbilities }
      }
    }

    const { updatedActors: ua, updatedMaps, results } = get()._resolveAndExecute(
      effect, selectedTiles, selectedChars, aoeRotation, campaign.activeMapId
    )
    // Merge ability-deduction changes into the resolved actors
    const merged = { ...ua }
    if (actorId && updatedActors[actorId]) merged[actorId] = { ...ua[actorId], abilities: updatedActors[actorId].abilities }

    set(st => ({
      campaign: { ...st.campaign, actors: merged, maps: updatedMaps, updatedAt: new Date().toISOString() },
      lastEffectResults: results.length > 0 ? results : null,
    }))
  },

  // ── Status duration ticking ───────────────────────────────────
  // Called by TurnTracker when the active turn changes.
  // phase: 'start' | 'end'  — which part of the actor's turn this is.
  // Decrements remainingRounds for matching entries and removes those that hit 0.
  // Returns an array of statusIds that expired (for optional UI notification).
  tickStatusDurations(actorId, phase) {
    const { campaign } = get()
    const actor = campaign?.actors?.[actorId]
    if (!actor?.activeStatuses?.length) return []

    const toExpire = []
    const toDecrement = []

    for (const entry of actor.activeStatuses) {
      if (entry.remainingRounds == null || entry.expireOn !== phase) continue
      if (entry.remainingRounds <= 1) toExpire.push(entry.statusId)
      else toDecrement.push(entry.statusId)
    }

    // Remove expired statuses (reverses tracked modifiers via removeStatusFromActor)
    for (const sid of toExpire) get().removeStatusFromActor(actorId, sid)

    // Decrement surviving timed statuses
    if (toDecrement.length > 0) {
      const fresh = get().campaign?.actors?.[actorId]
      if (fresh) {
        const newActives = (fresh.activeStatuses || []).map(e =>
          toDecrement.includes(e.statusId) && e.expireOn === phase
            ? { ...e, remainingRounds: e.remainingRounds - 1 }
            : e
        )
        set(st => ({
          campaign: {
            ...st.campaign,
            actors: { ...st.campaign.actors, [actorId]: { ...fresh, activeStatuses: newActives } },
            updatedAt: new Date().toISOString(),
          },
        }))
      }
    }

    return toExpire
  },
})
