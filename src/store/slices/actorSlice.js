/**
 * Actor slice — unified actor CRUD, token placement, status/damage application.
 *
 * All tokens on all maps are actors (campaign.actors). The old separation
 * between `characters` and `creatures` is gone; they are distinguished by
 * their `actorType` field, which maps to the campaign's game system.
 *
 * Backward-compat aliases (addCharacter, updateCharacter, etc.) are provided
 * at the bottom so existing component code continues to work unchanged during
 * the UI migration phase.
 */
import { makeActor }          from '../../models/actor.js'
import { makeTile }           from '../../models/map.js'
import { getSystem, getCampaignSystem } from '../../systems/index.js'

export const createActorSlice = (set, get) => ({

  // ── Actor CRUD ────────────────────────────────────────────────
  addActor(data = {}) {
    const { campaign } = get()
    const sys = getCampaignSystem(campaign)
    const actor = makeActor(sys, data.actorType || 'npc', data)
    set(s => ({
      campaign: {
        ...s.campaign,
        actors: { ...s.campaign.actors, [actor.id]: actor },
        updatedAt: new Date().toISOString(),
      },
    }))
    return actor.id
  },

  updateActor(actorId, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        actors: {
          ...s.campaign.actors,
          [actorId]: { ...s.campaign.actors[actorId], ...partial, updatedAt: new Date().toISOString() },
        },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  deleteActor(actorId) {
    const { campaign } = get()
    if (!campaign) return
    const actors = { ...campaign.actors }
    delete actors[actorId]
    // Remove this actor's token from every tile on every map
    const maps = Object.fromEntries(
      Object.entries(campaign.maps || {}).map(([mapId, map]) => [
        mapId,
        {
          ...map,
          tiles: Object.fromEntries(
            Object.entries(map.tiles || {}).map(([key, tile]) => [
              key,
              tile.tokens?.includes(actorId)
                ? { ...tile, tokens: tile.tokens.filter(id => id !== actorId) }
                : tile,
            ])
          ),
        },
      ])
    )
    set(s => ({
      campaign: { ...s.campaign, actors, maps, updatedAt: new Date().toISOString() },
    }))
  },

  // ── Token placement ───────────────────────────────────────────
  // Moves an actor's token to a destination tile, handling:
  //   • removing the token from the old tile (same map)
  //   • removing the token from any other map it appeared on
  //   • updating the actor's currentMapId and currentTile
  //   • auto-applying/removing tile-sourced statuses
  placeToken(actorId, destQ, destR, destMapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = destMapId ?? campaign.activeMapId
    const destMap = campaign.maps[mid]
    if (!destMap) return

    const actor = campaign.actors?.[actorId]
    if (!actor) return

    const oldTileKey = (actor.currentMapId === mid && actor.currentTile)
      ? `${actor.currentTile.q},${actor.currentTile.r}`
      : null

    // Strip this actor's token from the destination map's tiles
    const updatedTiles = Object.fromEntries(
      Object.entries(destMap.tiles || {}).map(([key, tile]) => [
        key,
        tile.tokens?.includes(actorId)
          ? { ...tile, tokens: tile.tokens.filter(id => id !== actorId) }
          : tile,
      ])
    )

    // Also strip from any other map
    const updatedMaps = { ...campaign.maps }
    Object.entries(campaign.maps).forEach(([mapId, map]) => {
      if (mapId === mid) return
      const hasThere = Object.values(map.tiles || {}).some(t => t.tokens?.includes(actorId))
      if (hasThere) {
        updatedMaps[mapId] = {
          ...map,
          tiles: Object.fromEntries(
            Object.entries(map.tiles || {}).map(([k, t]) => [
              k,
              t.tokens?.includes(actorId) ? { ...t, tokens: t.tokens.filter(id => id !== actorId) } : t,
            ])
          ),
        }
      }
    })

    // Place on destination tile
    const destKey = `${destQ},${destR}`
    const destTile = updatedTiles[destKey] ?? makeTile(destMap.defaultBiome)
    updatedTiles[destKey] = {
      ...destTile,
      tokens: [...(destTile.tokens || []).filter(id => id !== actorId), actorId],
    }
    updatedMaps[mid] = { ...destMap, tiles: updatedTiles }

    set(s => ({
      campaign: {
        ...s.campaign,
        maps: updatedMaps,
        actors: {
          ...s.campaign.actors,
          [actorId]: { ...actor, currentMapId: mid, currentTile: { q: destQ, r: destR }, updatedAt: new Date().toISOString() },
        },
        updatedAt: new Date().toISOString(),
      },
    }))

    // Tile-status transitions
    const { campaign: c2 } = get()

    // Remove non-lingering statuses applied by the old tile
    if (oldTileKey && oldTileKey !== destKey) {
      const actor2 = c2.actors?.[actorId]
      const tileSourced = (actor2?.activeStatuses || []).filter(
        s => s.sourceTile?.mapId === mid && s.sourceTile?.tileKey === oldTileKey && !s.sourceTile?.lingering
      )
      for (const entry of tileSourced) {
        get().removeStatusFromActor(actorId, entry.statusId)
      }
    }

    // Apply statuses from the new tile
    const newTile = c2.maps[mid]?.tiles[destKey]
    for (const tileEntry of (newTile?.activeStatuses || [])) {
      const tileStatus = c2.statuses?.[tileEntry.statusId]
      if (!tileStatus) continue
      for (const mod of (tileStatus.modifiers || []).filter(m => m.type === 'applyToCharacters')) {
        get().applyStatusToActor(actorId, mod.statusId, { mapId: mid, tileKey: destKey, lingering: mod.lingering ?? false })
      }
    }
  },

  removeToken(actorId) {
    const { campaign } = get()
    if (!campaign) return
    const actor = campaign.actors?.[actorId]
    if (!actor?.currentMapId) return

    const maps = Object.fromEntries(
      Object.entries(campaign.maps || {}).map(([mapId, map]) => [
        mapId,
        {
          ...map,
          tiles: Object.fromEntries(
            Object.entries(map.tiles || {}).map(([key, tile]) => [
              key,
              tile.tokens?.includes(actorId)
                ? { ...tile, tokens: tile.tokens.filter(id => id !== actorId) }
                : tile,
            ])
          ),
        },
      ])
    )

    set(s => ({
      campaign: {
        ...s.campaign,
        maps,
        actors: {
          ...s.campaign.actors,
          [actorId]: { ...actor, currentMapId: null, currentTile: null },
        },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  // ── Status application ────────────────────────────────────────
  applyStatusToActor(actorId, statusId, sourceTile = null) {
    const { campaign } = get()
    if (!campaign) return
    const actor = campaign.actors?.[actorId]
    const status = campaign.statuses?.[statusId]
    if (!actor || !status) return

    const traits = actor.traits || []
    if (status.negatingTraits?.some(t => traits.includes(t))) return
    const activeStatuses = actor.activeStatuses || []
    if (activeStatuses.some(s => s.statusId === statusId)) return
    if (activeStatuses.some(s => (campaign.statuses?.[s.statusId]?.blocks || []).includes(statusId))) return

    // Apply stat modifiers — hp changes are immediate/permanent, others are tracked for reversal
    const statModifiers = (status.modifiers || []).filter(m => m.type === 'stat')
    let updatedStats = { ...actor.stats }
    const appliedModifiers = []
    for (const mod of statModifiers) {
      updatedStats[mod.stat] = (updatedStats[mod.stat] ?? 0) + mod.value
      if (mod.stat !== 'hp') appliedModifiers.push({ stat: mod.stat, value: mod.value })
    }

    // Clamp hp to maxHp
    const hpKey = campaign.gameSystemId ? 'hp' : 'hp'
    const maxHpKey = 'maxHp'
    if (updatedStats[hpKey] !== undefined && updatedStats[maxHpKey] !== undefined) {
      updatedStats[hpKey] = Math.min(updatedStats[hpKey], updatedStats[maxHpKey])
    }

    const entry = { statusId, appliedAt: new Date().toISOString() }
    if (appliedModifiers.length > 0) entry.appliedModifiers = appliedModifiers
    if (sourceTile) entry.sourceTile = sourceTile
    if (status.duration) {
      entry.remainingRounds = status.duration.rounds
      entry.expireOn = status.duration.expireOn
    }

    set(st => ({
      campaign: {
        ...st.campaign,
        actors: {
          ...st.campaign.actors,
          [actorId]: { ...actor, stats: updatedStats, activeStatuses: [...activeStatuses, entry] },
        },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  removeStatusFromActor(actorId, statusId) {
    const { campaign } = get()
    const actor = campaign?.actors?.[actorId]
    if (!actor) return

    const entry = (actor.activeStatuses || []).find(s => s.statusId === statusId)
    let updatedStats = { ...actor.stats }
    // Reverse tracked modifiers (hp changes are intentionally permanent)
    if (entry?.appliedModifiers?.length > 0) {
      for (const mod of entry.appliedModifiers) {
        updatedStats[mod.stat] = (updatedStats[mod.stat] ?? 0) - mod.value
      }
      if (updatedStats.hp !== undefined && updatedStats.maxHp !== undefined) {
        updatedStats.hp = Math.min(updatedStats.hp, updatedStats.maxHp)
      }
    }

    set(st => ({
      campaign: {
        ...st.campaign,
        actors: {
          ...st.campaign.actors,
          [actorId]: {
            ...actor,
            stats: updatedStats,
            activeStatuses: (actor.activeStatuses || []).filter(s => s.statusId !== statusId),
          },
        },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  applyDamageToActor(actorId, amount) {
    const { campaign } = get()
    const actor = campaign?.actors?.[actorId]
    if (!actor) return
    const hpKey = 'hp'
    const newHp = Math.max(0, (actor.stats?.[hpKey] ?? 0) - amount)
    set(st => ({
      campaign: {
        ...st.campaign,
        actors: {
          ...st.campaign.actors,
          [actorId]: { ...actor, stats: { ...actor.stats, [hpKey]: newHp } },
        },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  restActor(actorId, restType = 'long') {
    const { campaign } = get()
    if (!campaign) return
    const actor = campaign.actors?.[actorId]
    if (!actor) return
    const abilities = (actor.abilities || []).map(a => {
      const tmpl = campaign.abilities?.[a.templateId]
      if (!tmpl?.usesPerRest) return a
      if (restType === 'short' && tmpl.restType !== 'short') return a
      return { ...a, usesRemaining: tmpl.usesPerRest }
    })
    set(s => ({
      campaign: {
        ...s.campaign,
        actors: { ...s.campaign.actors, [actorId]: { ...actor, abilities } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  giveCurrency(actorId, currencyId, amount) {
    const { campaign } = get()
    const actor = campaign?.actors?.[actorId]
    if (!actor) return
    const current = actor.currency?.[currencyId] ?? 0
    set(s => ({
      campaign: {
        ...s.campaign,
        actors: {
          ...s.campaign.actors,
          [actorId]: { ...actor, currency: { ...(actor.currency || {}), [currencyId]: Math.max(0, current + amount) } },
        },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  // ── Backward-compat aliases ───────────────────────────────────
  // These keep existing component code working while the UI migrates
  // to the unified actor API. New code should call addActor/updateActor/
  // deleteActor directly.

  addCharacter(data = {}) {
    return get().addActor({ actorType: data.type || 'npc', ...data })
  },
  updateCharacter(id, partial) { get().updateActor(id, partial) },
  deleteCharacter(id)          { get().deleteActor(id) },

  addCreature(data = {}) {
    return get().addActor({ actorType: data.type || 'wild', ...data })
  },
  updateCreature(id, partial)  { get().updateActor(id, partial) },
  deleteCreature(id)           { get().deleteActor(id) },

  // Legacy status aliases
  applyStatusToCharacter(actorId, statusId, sourceTile) {
    get().applyStatusToActor(actorId, statusId, sourceTile)
  },
  removeStatusFromCharacter(actorId, statusId) {
    get().removeStatusFromActor(actorId, statusId)
  },
  applyDamageToCharacter(actorId, amount) {
    get().applyDamageToActor(actorId, amount)
  },
  restCharacter(actorId, restType) {
    get().restActor(actorId, restType)
  },
})
