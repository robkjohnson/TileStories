/**
 * Event slice — tile events, storyboards, and story entries.
 *
 * Events live inside tiles (map.tiles['q,r'].events[]). Firing an event
 * executes its steps in order: running effects, teleporting tokens, logging
 * the result. Storyboard/message steps are signalled to the caller (EventEditor)
 * via the return value — they are delivered over WebSocket by the UI layer.
 */
import { makeEvent, makeStep } from '../../models/event.js'
import { makeStoryboard, makeStoryEntry } from '../../models/storyboard.js'
import { makeTile }            from '../../models/map.js'
import { newId }               from '../../models/id.js'
import { rotateAoePattern }    from '../../models/effect.js'
import { rollDiceExpr }        from '../../utils/dice.js'

export const createEventSlice = (set, get) => ({

  // ── Tile events ───────────────────────────────────────────────
  addEvent(tileQ, tileR, eventData = {}, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const key = `${tileQ},${tileR}`
    const tile = map.tiles[key] ?? makeTile(map.defaultBiome)
    const ev = makeEvent({ ...eventData, sourceTile: { q: tileQ, r: tileR } })
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: {
          ...s.campaign.maps,
          [mid]: { ...map, tiles: { ...map.tiles, [key]: { ...tile, events: [...(tile.events || []), ev] } } },
        },
        updatedAt: new Date().toISOString(),
      },
    }))
    return ev.id
  },

  updateEvent(tileQ, tileR, eventId, partial, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const key = `${tileQ},${tileR}`
    const tile = map.tiles[key]
    if (!tile) return
    const events = tile.events.map(e => e.id === eventId ? { ...e, ...partial } : e)
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: { ...s.campaign.maps, [mid]: { ...map, tiles: { ...map.tiles, [key]: { ...tile, events } } } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  deleteEvent(tileQ, tileR, eventId, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const key = `${tileQ},${tileR}`
    const tile = map.tiles[key]
    if (!tile) return
    const events = tile.events.filter(e => e.id !== eventId)
    set(s => ({
      campaign: {
        ...s.campaign,
        maps: { ...s.campaign.maps, [mid]: { ...map, tiles: { ...map.tiles, [key]: { ...tile, events } } } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  fireEvent(tileQ, tileR, eventId, mapId) {
    const { campaign } = get()
    if (!campaign) return
    const mid = mapId ?? campaign.activeMapId
    const map = campaign.maps[mid]
    if (!map) return
    const key = `${tileQ},${tileR}`
    const tile = map.tiles[key]
    if (!tile) return
    const ev = tile.events.find(e => e.id === eventId)
    if (!ev) return

    const firedAt = new Date().toISOString()
    const steps = ev.steps || []

    let updatedMaps  = { ...campaign.maps }
    let updatedActors = { ...campaign.actors }
    let didSwitchMap = false
    let switchToMap  = null

    steps.forEach(step => {
      switch (step.type) {
        case 'effect': {
          const eff = campaign.effects?.[step.effectId]
          if (!eff) break
          const isSquare = map.tileStyle === 'square'
          const { selectedTiles = [], selectedChars = [], aoeRotation = 0 } = step
          let affTiles = []
          if (eff.targetType === 'single_tile') {
            affTiles = selectedTiles.slice(0, 1)
          } else if (eff.targetType === 'tile_aoe' && selectedTiles.length > 0) {
            const root = selectedTiles[0]
            const rotated = rotateAoePattern(eff.aoePattern || [], aoeRotation, isSquare)
            affTiles = [root, ...rotated.map(({ dq, dr }) => ({ q: root.q + dq, r: root.r + dr }))]
              .filter(t => t.q >= 0 && t.q < map.cols && t.r >= 0 && t.r < map.rows)
          } else if (eff.targetType === 'tile_select') {
            affTiles = selectedTiles
          }
          let affActorIds = [...selectedChars]
          if (eff.targetType !== 'char_select') {
            affTiles.forEach(({ q, r }) => {
              const t = (updatedMaps[mid]?.tiles || {})[`${q},${r}`]
              if (t?.tokens) affActorIds = [...affActorIds, ...t.tokens]
            })
          }
          affActorIds = [...new Set(affActorIds)]
          const now2 = new Date().toISOString();
          (eff.actions || []).forEach(action => {
            if (action.type === 'damage') {
              const total = (action.diceExpr ? rollDiceExpr(action.diceExpr) : 0) + (action.flatAmount || 0)
              if (total <= 0) return
              affActorIds.forEach(aid => {
                const actor = updatedActors[aid]
                if (!actor) return
                updatedActors[aid] = { ...actor, stats: { ...actor.stats, hp: Math.max(0, (actor.stats?.hp ?? 0) - total) } }
              })
            } else if (action.type === 'apply_status') {
              const status = campaign.statuses?.[action.statusId]
              if (!status) return
              affActorIds.forEach(aid => {
                const actor = updatedActors[aid]
                if (!actor) return
                const actives = actor.activeStatuses || []
                if (actives.some(s => s.statusId === action.statusId)) return
                updatedActors[aid] = { ...actor, activeStatuses: [...actives, { statusId: action.statusId, appliedAt: now2 }] }
              })
              affTiles.forEach(({ q, r }) => {
                const k2 = `${q},${r}`
                const curMap2 = updatedMaps[mid]
                const tile2 = curMap2?.tiles?.[k2] ?? { biome: map.defaultBiome }
                const actives = tile2.activeStatuses || []
                if (actives.some(s => s.statusId === action.statusId)) return
                updatedMaps = {
                  ...updatedMaps,
                  [mid]: { ...updatedMaps[mid], tiles: { ...updatedMaps[mid].tiles, [k2]: { ...tile2, activeStatuses: [...actives, { statusId: action.statusId, appliedAt: now2 }] } } },
                }
              })
            }
          })
          break
        }
        case 'portal': {
          if (step.targetMapId && step.targetTile) {
            const tokensToMove = [...(tile.tokens || [])]
            tokensToMove.forEach(aid => {
              get().placeToken(aid, step.targetTile.q, step.targetTile.r, step.targetMapId)
            })
            switchToMap  = step.targetMapId
            didSwitchMap = true
          }
          break
        }
        // 'storyboard' and 'message' are handled by the caller (EventEditor) over WebSocket
        default: break
      }
    })

    const logEntry = {
      id: newId(),
      eventId,
      eventName: ev.name,
      steps: steps.map(s => s.type),
      sourceTile: { q: tileQ, r: tileR },
      firedAt,
    }

    const updatedEvents = tile.events.map(e => e.id === eventId ? { ...e, firedAt } : e)

    // Re-read latest state — placeToken calls above may have mutated it
    const latestCampaign = get().campaign
    const latestMap = latestCampaign.maps[mid]

    set(s => ({
      campaign: {
        ...s.campaign,
        activeMapId: didSwitchMap ? switchToMap : s.campaign.activeMapId,
        actors: updatedActors,
        maps: {
          ...s.campaign.maps,
          [mid]: {
            ...latestMap,
            firedEvents: latestMap.firedEvents || {},
            eventLog: [...(latestMap.eventLog || []), logEntry],
            tiles: {
              ...latestMap.tiles,
              ...(updatedMaps[mid]?.tiles || {}),
              [key]: {
                ...(updatedMaps[mid]?.tiles?.[key] || latestMap.tiles[key]),
                events: updatedEvents,
              },
            },
          },
        },
        updatedAt: firedAt,
      },
    }))
  },

  // ── Storyboards ───────────────────────────────────────────────
  addStoryboard(data = {}) {
    const sb = makeStoryboard(data)
    set(s => ({
      campaign: {
        ...s.campaign,
        storyboards: { ...s.campaign.storyboards, [sb.id]: sb },
        updatedAt: new Date().toISOString(),
      },
    }))
    return sb.id
  },

  updateStoryboard(id, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        storyboards: { ...s.campaign.storyboards, [id]: { ...s.campaign.storyboards[id], ...partial } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  deleteStoryboard(id) {
    const storyboards = { ...get().campaign?.storyboards }
    delete storyboards[id]
    set(s => ({ campaign: { ...s.campaign, storyboards, updatedAt: new Date().toISOString() } }))
  },

  // ── Story entries ─────────────────────────────────────────────
  addStoryEntry(data = {}) {
    const entry = makeStoryEntry(data)
    set(s => ({
      campaign: {
        ...s.campaign,
        story: { ...s.campaign.story, [entry.id]: entry },
        updatedAt: new Date().toISOString(),
      },
    }))
    return entry.id
  },

  updateStoryEntry(entryId, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        story: { ...s.campaign.story, [entryId]: { ...s.campaign.story[entryId], ...partial } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  deleteStoryEntry(entryId) {
    const story = { ...get().campaign?.story }
    delete story[entryId]
    set(s => ({ campaign: { ...s.campaign, story, updatedAt: new Date().toISOString() } }))
  },
})
