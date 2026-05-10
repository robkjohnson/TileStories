// TileStories Game Server
// Handles WebSocket connections, session state, and player sync
// Runs on port 3001 alongside Vite (5173)

const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const path = require('path')
const fs = require('fs')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

app.use(express.json())

// CORS — allow the Vite dev server (organizer) to call our REST endpoints
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

app.use(express.static(path.join(__dirname, 'player-dist')))

// ── Session state (in-memory) ─────────────────────────────────
let session = null          // null = no active session
let campaign = null         // full campaign object from organizer
let diceRolls = []          // ephemeral roll log, max 20 entries
let joinScreenVisible = false  // whether the join screen is shown on the display
let connectedClients = new Map()  // socketId → { ws, role, playerId, characterId, deviceId }

function makeSession(campaignData) {
  return {
    id: Math.random().toString(36).slice(2, 10),
    status: 'lobby',          // lobby | active | paused | ended
    campaignId: campaignData.id,
    campaignName: campaignData.name,
    activeMapId: campaignData.activeMapId,
    players: {},              // { deviceId: { deviceId, name, character, ready, assignedTile } }
    turnOrder: [],            // [{ type: 'character'|'creature', id, name, entityId }]
    currentTurnIndex: -1,
    turnMode: 'organizer',    // 'organizer' | 'party' | 'turn'
    cutscene: null,           // { type, title, content, imageUrl } or null
    fogReveal: {},            // { mapId: { tileKey: true } } tiles revealed to all
    startedAt: null,
    musicState: {
      track: null,
      playing: false,
      volume: 0.7,
      targetDevices: 'all',  // 'all' or [deviceId, ...]
    },
  }
}

// ── Broadcast helpers ─────────────────────────────────────────
function broadcast(msg, excludeId = null) {
  const data = JSON.stringify(msg)
  connectedClients.forEach((client, id) => {
    if (id !== excludeId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data)
    }
  })
}

function sendTo(socketId, msg) {
  const client = connectedClients.get(socketId)
  if (client?.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(msg))
  }
}

function broadcastToPlayers(msg) {
  connectedClients.forEach(client => {
    if ((client.role === 'player' || client.role === 'display') && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(msg))
    }
  })
}

function sendSessionState(socketId) {
  sendTo(socketId, {
    type: 'SESSION_STATE',
    session,
    campaign: sanitizeCampaignForPlayer(campaign),
  })
}

function broadcastSessionState() {
  // Send full state to organizer
  connectedClients.forEach((client, id) => {
    if (client.role === 'organizer') {
      sendTo(id, { type: 'SESSION_STATE', session, campaign })
    } else if (client.role === 'player') {
      sendTo(id, {
        type: 'SESSION_STATE',
        session,
        campaign: sanitizeCampaignForPlayer(campaign),
      })
    }
  })
}

// Strip organizer-only content from campaign before sending to players
function sanitizeCampaignForPlayer(camp) {
  if (!camp) return null
  return {
    ...camp,
    maps: Object.fromEntries(
      Object.entries(camp.maps || {}).map(([id, map]) => [id, {
        ...map,
        tiles: Object.fromEntries(
          Object.entries(map.tiles || {}).map(([key, tile]) => [key, {
            ...tile,
            notes: undefined,  // hide organizer notes
            events: (tile.events || []).filter(e => e.visibility !== 'none'),
          }])
        ),
      }])
    ),
    story: Object.fromEntries(
      Object.entries(camp.story || {})
        .filter(([, e]) => e.visibleToPlayers)
    ),
    actors: Object.fromEntries(
      Object.entries(camp.actors || {}).map(([id, a]) => [id, {
        ...a,
        notes: undefined,  // hide organizer notes
      }])
    ),
  }
}

function getConnectedPlayerList() {
  const players = []
  connectedClients.forEach((client, id) => {
    if (client.role === 'player') {
      players.push({
        socketId: id,
        deviceId: client.deviceId,
        name: client.name || 'Unknown',
        characterId: client.characterId,
        character: client.character,
        ready: client.ready || false,
      })
    }
  })
  return players
}

// ── WebSocket message handler ─────────────────────────────────
wss.on('connection', (ws) => {
  const socketId = Math.random().toString(36).slice(2, 10)
  connectedClients.set(socketId, { ws, role: null, deviceId: null })

  console.log(`[+] Client connected: ${socketId} (${connectedClients.size} total)`)

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    const client = connectedClients.get(socketId)

    switch (msg.type) {

      // ── Organizer: start/host a session ──────────────────────
      case 'HOST_SESSION': {
        campaign = msg.campaign
        session = makeSession(campaign)
        connectedClients.set(socketId, { ...client, role: 'organizer', deviceId: 'organizer' })
        console.log(`[SESSION] Started: ${session.id} — ${campaign.name}`)
        sendTo(socketId, { type: 'SESSION_HOSTED', session })
        break
      }

      // ── Organizer: update campaign data (live sync) ───────────
      case 'SYNC_CAMPAIGN': {
        if (client.role !== 'organizer') break
        campaign = msg.campaign
        const sanitized = sanitizeCampaignForPlayer(campaign)
        broadcastToPlayers({ type: 'CAMPAIGN_UPDATED', campaign: sanitized })
        break
      }

      // ── Organizer: session controls ───────────────────────────
      case 'START_GAME': {
        if (client.role !== 'organizer' || !session) break
        session.status = 'active'
        session.startedAt = new Date().toISOString()
        // Place players at assigned tiles — update both character position and tile tokens
        Object.entries(session.players).forEach(([deviceId, p]) => {
          if (p.assignedTile && p.characterId && campaign) {
            if (!campaign.actors[p.characterId]) {
              campaign.actors[p.characterId] = p.character
            }
            const mapId = p.assignedMapId || session.activeMapId
            campaign.actors[p.characterId].currentMapId = mapId
            campaign.actors[p.characterId].currentTile = p.assignedTile

            // Also place token in tile so it appears on the map
            const map = campaign.maps[mapId]
            if (map) {
              const key = `${p.assignedTile.q},${p.assignedTile.r}`
              const tile = map.tiles[key] ?? { biome: map.defaultBiome, label: '', notes: '', tokens: [], events: [] }
              map.tiles[key] = { ...tile, tokens: [...(tile.tokens || []).filter(id => id !== p.characterId), p.characterId] }
            }
          }
        })
        broadcastSessionState()
        console.log('[SESSION] Game started')
        break
      }

      case 'PAUSE_GAME': {
        if (client.role !== 'organizer' || !session) break
        session.status = session.status === 'paused' ? 'active' : 'paused'
        broadcastSessionState()
        break
      }

      case 'END_SESSION': {
        if (client.role !== 'organizer') break
        session = null
        campaign = null
        diceRolls = []
        joinScreenVisible = false
        broadcast({ type: 'SESSION_ENDED' })
        console.log('[SESSION] Ended')
        break
      }

      // ── Dice rolls ────────────────────────────────────────────
      case 'DICE_ROLL': {
        if (client.role !== 'organizer') break
        const orgBonus = msg.bonus != null ? msg.bonus : null
        const orgTotal = orgBonus != null ? msg.value + orgBonus : msg.value
        const roll = {
          id: Math.random().toString(36).slice(2, 9),
          characterId: msg.characterId || null,
          characterName: msg.characterName || 'Unknown',
          diceType: msg.diceType || 'd20',
          value: msg.value,
          bonus: orgBonus,
          total: orgBonus != null ? orgTotal : null,
          statId: msg.statId || null,
          statLabel: msg.statLabel || null,
          description: msg.description || null,
          threshold: msg.threshold || null,
          success: msg.threshold ? orgTotal >= msg.threshold : null,
          rolledBy: 'organizer',
          rolledAt: new Date().toISOString(),
        }
        diceRolls.push(roll)
        if (diceRolls.length > 20) diceRolls.shift()
        broadcast({ type: 'DICE_ROLL_BROADCAST', roll })
        break
      }

      case 'PLAYER_DICE_ROLL': {
        if (client.role !== 'player' || !session) break
        const threshold = msg.threshold || null
        const playerTotal = msg.total != null ? msg.total : msg.value
        const roll = {
          id: Math.random().toString(36).slice(2, 9),
          characterId: msg.characterId || null,
          characterName: msg.characterName || client.name || 'Unknown',
          diceType: msg.diceType || 'd20',
          value: msg.value,
          bonus: msg.bonus != null ? msg.bonus : null,
          total: msg.total != null ? msg.total : null,
          statId: msg.statId || null,
          statLabel: msg.statLabel || null,
          description: msg.description || null,
          threshold,
          success: threshold ? playerTotal >= threshold : null,
          rolledBy: 'player',
          rolledAt: new Date().toISOString(),
        }
        diceRolls.push(roll)
        if (diceRolls.length > 20) diceRolls.shift()
        broadcast({ type: 'DICE_ROLL_BROADCAST', roll })
        sendTo(socketId, { type: 'DICE_ROLL_RESULT', roll })
        break
      }

      case 'SEND_ROLL_REQUEST': {
        if (client.role !== 'organizer' || !session) break
        // deviceIds can be a single string or an array
        const targetIds = Array.isArray(msg.deviceIds) ? msg.deviceIds
          : msg.deviceId ? [msg.deviceId] : []
        targetIds.forEach(deviceId => {
          const requestId = Math.random().toString(36).slice(2, 9)
          connectedClients.forEach((c) => {
            if (c.role === 'player' && c.deviceId === deviceId && c.ws.readyState === WebSocket.OPEN) {
              c.ws.send(JSON.stringify({
                type: 'ROLL_REQUEST',
                requestId,
                characterId: msg.characterId || null,
                characterName: msg.characterName || null,
                diceType: msg.diceType || 'd20',
                threshold: msg.threshold || null,
                description: msg.description || null,
                statId: msg.statId || null,
              }))
            }
          })
        })
        break
      }

      case 'CLEAR_DICE_LOG': {
        if (client.role !== 'organizer') break
        diceRolls = []
        broadcast({ type: 'DICE_LOG_CLEARED' })
        break
      }

      case 'SET_JOIN_SCREEN': {
        if (client.role !== 'organizer') break
        joinScreenVisible = !!msg.visible
        connectedClients.forEach(c => {
          if (c.role === 'display' && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type: 'JOIN_SCREEN_STATE', visible: joinScreenVisible }))
          }
        })
        break
      }

      // ── Organizer: change active map for all players ──────────
      case 'CHANGE_MAP': {
        if (client.role !== 'organizer' || !session) break
        session.activeMapId = msg.mapId
        broadcastToPlayers({ type: 'MAP_CHANGED', mapId: msg.mapId })
        sendTo(socketId, { type: 'SESSION_STATE', session, campaign })
        break
      }

      // ── Organizer: assign player to starting tile ─────────────
      case 'ASSIGN_START': {
        if (client.role !== 'organizer' || !session) break
        const { deviceId, tileKey, mapId } = msg
        if (session.players[deviceId]) {
          session.players[deviceId].assignedTile = { q: parseInt(tileKey.split(',')[0]), r: parseInt(tileKey.split(',')[1]) }
          session.players[deviceId].assignedMapId = mapId || session.activeMapId
        }
        broadcastSessionState()
        break
      }

      // ── Organizer: turn management ────────────────────────────
      case 'SET_TURN_ORDER': {
        if (client.role !== 'organizer' || !session) break
        session.turnOrder = msg.turnOrder || []
        session.currentTurnIndex = 0
        broadcastSessionState()
        break
      }

      case 'SET_TURN_MODE': {
        if (client.role !== 'organizer' || !session) break
        // 'organizer' | 'party' | 'turn'
        session.turnMode = msg.mode
        if (msg.mode === 'turn' && session.currentTurnIndex < 0) session.currentTurnIndex = 0
        broadcastSessionState()
        break
      }

      case 'NEXT_TURN': {
        if (client.role !== 'organizer' || !session) break
        if (session.turnOrder.length === 0) break
        // Move current token to bottom
        const current = session.turnOrder[session.currentTurnIndex]
        if (current) {
          const rest = session.turnOrder.filter((_, i) => i !== session.currentTurnIndex)
          session.turnOrder = [...rest, current]
          session.currentTurnIndex = 0
        }
        // Reset remainingMovement for the new active player
        const nextEntry = session.turnOrder[0]
        if (nextEntry && campaign) {
          const nextChar = campaign.actors[nextEntry.id]
          const speed = nextChar?.stats?.speed ?? 3
          Object.values(session.players).forEach(p => {
            if (p.characterId === nextEntry.id) p.remainingMovement = speed
          })
        }
        broadcastSessionState()
        break
      }

      case 'PREV_TURN': {
        if (client.role !== 'organizer' || !session) break
        // Pop last item back to front
        if (session.turnOrder.length > 0) {
          const last = session.turnOrder[session.turnOrder.length - 1]
          session.turnOrder = [last, ...session.turnOrder.slice(0, -1)]
          session.currentTurnIndex = 0
        }
        broadcastSessionState()
        break
      }

      case 'REMOVE_FROM_TURN': {
        if (client.role !== 'organizer' || !session) break
        session.turnOrder = session.turnOrder.filter(t => t.id !== msg.id)
        session.currentTurnIndex = 0
        broadcastSessionState()
        break
      }

      case 'REORDER_TURN': {
        if (client.role !== 'organizer' || !session) break
        session.turnOrder = msg.turnOrder
        session.currentTurnIndex = 0
        broadcastSessionState()
        break
      }

      // ── Organizer: cutscene ───────────────────────────────────
      case 'SHOW_CUTSCENE': {
        if (client.role !== 'organizer' || !session) break
        const cs = msg.cutscene

        // Apply rewards immediately (items + currency) to target characters
        if (cs.rewards && campaign) {
          const targets = cs.targets === 'all'
            ? Object.values(session.players)
            : Object.values(session.players).filter(p => cs.targets?.includes(p.deviceId))

          targets.forEach(player => {
            const charId = player.characterId
            if (!charId || !campaign.actors[charId]) return
            const char = campaign.actors[charId]

            // Grant currency (currency is now an object { gp, sp, ... })
            if (cs.rewards.currency) {
              const cur = char.currency || {}
              campaign.actors[charId] = {
                ...char,
                currency: { ...cur, gp: (cur.gp || 0) + cs.rewards.currency },
              }
            }

            // Grant items
            if (cs.rewards.items?.length) {
              const inventory = [...(char.inventory || [])]
              cs.rewards.items.forEach(({ templateId, quantity }) => {
                const existing = inventory.find(i => i.templateId === templateId)
                if (existing) {
                  existing.quantity = (existing.quantity || 1) + quantity
                } else {
                  inventory.push({
                    id: Math.random().toString(36).slice(2, 9),
                    templateId,
                    quantity,
                    notes: '',
                    identified: true,
                  })
                }
              })
              campaign.actors[charId] = { ...campaign.actors[charId], inventory }
            }
          })
          // Push updated campaign to everyone
          broadcastToPlayers({ type: 'CAMPAIGN_UPDATED', campaign: sanitizeCampaignForPlayer(campaign) })
          connectedClients.forEach((c, id) => {
            if (c.role === 'organizer') sendTo(id, { type: 'PLAYER_JOINED', campaign, session })
          })
        }

        // Store cutscene and send to targets
        session.cutscene = { ...cs, shownAt: new Date().toISOString() }

        if (!cs.targets || cs.targets === 'all') {
          broadcastSessionState()
        } else {
          // Only send SESSION_STATE to targeted players + organizer
          connectedClients.forEach((c, id) => {
            if (c.role === 'organizer') {
              sendTo(id, { type: 'SESSION_STATE', session, campaign })
            } else if (c.role === 'player' && cs.targets.includes(c.deviceId)) {
              sendTo(id, { type: 'SESSION_STATE', session, campaign: sanitizeCampaignForPlayer(campaign) })
            }
          })
        }
        break
      }

      case 'DISMISS_CUTSCENE': {
        if (client.role !== 'organizer' || !session) break
        session.cutscene = null
        broadcastSessionState()
        break
      }

      // ── Organizer: move a token ───────────────────────────────
      case 'MOVE_TOKEN': {
        if (client.role !== 'organizer' || !session || !campaign) break
        const { entityId, tileKey: moveTileKey, mapId: moveMapId } = msg
        const [moveQ, moveR] = moveTileKey.split(',').map(Number)
        const entity = campaign.actors?.[entityId]
        if (!entity) break

        // Remove token from old tile
        if (entity.currentTile && entity.currentMapId) {
          const oldMap = campaign.maps[entity.currentMapId]
          const oldKey = `${entity.currentTile.q},${entity.currentTile.r}`
          if (oldMap?.tiles?.[oldKey]) {
            oldMap.tiles[oldKey] = { ...oldMap.tiles[oldKey], tokens: (oldMap.tiles[oldKey].tokens || []).filter(id => id !== entityId) }
          }
        }

        const resolvedMapId = moveMapId || session.activeMapId
        const destMap = campaign.maps[resolvedMapId]

        // Add token to new tile
        if (destMap) {
          const destKey = `${moveQ},${moveR}`
          const destTile = destMap.tiles[destKey] ?? { biome: destMap.defaultBiome, label: '', notes: '', tokens: [], events: [] }
          destMap.tiles[destKey] = { ...destTile, tokens: [...(destTile.tokens || []).filter(id => id !== entityId), entityId] }
        }

        campaign.actors[entityId] = { ...entity, currentTile: { q: moveQ, r: moveR }, currentMapId: resolvedMapId }
        broadcastSessionState()
        break
      }

      // ── Organizer: music control ──────────────────────────────
      case 'MUSIC_CONTROL': {
        if (client.role !== 'organizer' || !session) break
        session.musicState = { ...session.musicState, ...msg.musicState }
        broadcastToPlayers({ type: 'MUSIC_STATE', musicState: session.musicState })
        break
      }

      // ── Player: join session ──────────────────────────────────
      case 'JOIN_SESSION': {
        if (!session || session.status === 'ended') {
          sendTo(socketId, { type: 'ERROR', message: 'No active session' })
          break
        }
        const { deviceId, playerName, character } = msg

        // If picking an existing campaign character, fetch it from campaign
        let resolvedChar = character
        if (character?.id && campaign?.actors?.[character.id]) {
          // Player selected a campaign actor — use full campaign version
          resolvedChar = { ...campaign.actors[character.id], ...character }
        } else if (character && campaign) {
          // New actor from player device — add to campaign immediately
          campaign.actors[character.id] = {
            ...character,
            addedByPlayer: deviceId,
            addedAt: new Date().toISOString(),
          }
        }

        connectedClients.set(socketId, {
          ...client,
          role: 'player',
          deviceId,
          name: playerName,
          characterId: resolvedChar?.id || null,
          character: resolvedChar,
          ready: false,
        })

        // Register in session
        session.players[deviceId] = {
          deviceId,
          name: playerName,
          characterId: resolvedChar?.id || null,
          character: resolvedChar,
          ready: false,
          assignedTile: null,
          socketId,
        }

        console.log(`[PLAYER] ${playerName} joined with "${resolvedChar?.name}" (${deviceId})`)

        // Notify organizer of both the player join AND the updated campaign
        connectedClients.forEach((c, id) => {
          if (c.role === 'organizer') {
            sendTo(id, {
              type: 'PLAYER_JOINED',
              players: getConnectedPlayerList(),
              session,
              campaign,  // send updated campaign so organizer sees new character immediately
            })
          }
        })

        // Send full state to new player (with their character included)
        sendSessionState(socketId)
        break
      }

      case 'PLAYER_READY': {
        if (client.role !== 'player' || !session) break
        if (session.players[client.deviceId]) {
          session.players[client.deviceId].ready = msg.ready
          connectedClients.set(socketId, { ...client, ready: msg.ready })
        }
        connectedClients.forEach((c, id) => {
          if (c.role === 'organizer') {
            sendTo(id, { type: 'PLAYER_READY', deviceId: client.deviceId, ready: msg.ready, players: getConnectedPlayerList() })
          }
        })
        break
      }

      // ── Player: request move ──────────────────────────────────
      case 'REQUEST_MOVE': {
        if (client.role !== 'player' || !session) break
        const [destQ, destR] = msg.tileKey.split(',').map(Number)
        const turnMode = session.turnMode || 'organizer'
        const charId = client.characterId || session.players[client.deviceId]?.characterId

        const isParty = turnMode === 'party'
        const currentEntry = (session.turnOrder || [])[session.currentTurnIndex ?? 0]
        const isMyTurn = turnMode === 'turn' && currentEntry?.id === charId

        console.log(`[MOVE] ${client.name} → ${msg.tileKey} | mode=${turnMode} party=${isParty} myTurn=${isMyTurn} charId=${charId}`)

        if ((isParty || isMyTurn) && campaign && charId) {
          const mapId = session.activeMapId || campaign.activeMapId
          const map = campaign.maps[mapId]
          if (!map) { console.log('[MOVE] No map found:', mapId); break }

          const char = campaign.actors[charId]
          console.log(`[MOVE] char currentTile:`, char?.currentTile, 'currentMapId:', char?.currentMapId)

          // Speed check for turn mode
          if (turnMode === 'turn' && char?.currentTile) {
            const speed = char?.stats?.speed ?? 3
            const player = session.players[client.deviceId]
            const remaining = player?.remainingMovement ?? speed

            // Hex distance — even-q flat-top offset to axial conversion (matches hexMath.js)
            function offsetToAxial(q, r) {
              return { q, r: r - (q - (q & 1)) / 2 }
            }
            const a = offsetToAxial(char.currentTile.q, char.currentTile.r)
            const b = offsetToAxial(destQ, destR)
            const dist = (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2

            if (dist > remaining) {
              console.log(`[MOVE] Out of remaining movement: need ${dist}, have ${remaining}`)
              break
            }

            if (player) player.remainingMovement = remaining - dist
          }

          // Walkable check — players cannot self-move to non-walkable tiles
          const destTileData = map.tiles[`${destQ},${destR}`]
          const destTileTypeId = destTileData?.biome ?? map.defaultTileTypeId ?? map.defaultBiome ?? 'grassland'
          const destTileType = campaign.tileTypes?.[destTileTypeId]
          if (destTileType && destTileType.walkable === false) {
            console.log(`[MOVE] Blocked — tile ${destQ},${destR} (${destTileTypeId}) is not walkable`)
            sendTo(socketId, { type: 'ERROR', message: 'That tile is not walkable.' })
            break
          }

          // Save old position before mutating (for MOVE_APPLIED message)
          const fromTile = char?.currentTile ? { ...char.currentTile } : null

          // Remove from old tile
          if (char?.currentTile && char?.currentMapId) {
            const oldMap = campaign.maps[char.currentMapId]
            const oldKey = `${char.currentTile.q},${char.currentTile.r}`
            if (oldMap?.tiles?.[oldKey]) {
              oldMap.tiles[oldKey] = { ...oldMap.tiles[oldKey], tokens: (oldMap.tiles[oldKey].tokens || []).filter(id => id !== charId) }
            }
          }

          // Add to destination tile
          const destKey = `${destQ},${destR}`
          const destTile = map.tiles[destKey] ?? { biome: map.defaultBiome, label: '', notes: '', tokens: [], events: [] }
          map.tiles[destKey] = { ...destTile, tokens: [...(destTile.tokens || []).filter(id => id !== charId), charId] }

          // Update actor position
          campaign.actors[charId] = { ...campaign.actors[charId], currentMapId: mapId, currentTile: { q: destQ, r: destR } }

          const sanitized = sanitizeCampaignForPlayer(campaign)

          // Broadcast updated campaign to all other players and display
          connectedClients.forEach((c, id) => {
            if (id !== socketId && (c.role === 'player' || c.role === 'display') && c.ws.readyState === WebSocket.OPEN) {
              c.ws.send(JSON.stringify({ type: 'CAMPAIGN_UPDATED', campaign: sanitized }))
            }
          })

          // Send updated session state back to the moving player (includes updated remainingMovement)
          sendTo(socketId, { type: 'SESSION_STATE', session, campaign: sanitized })

          // Tell organizer about the move — includes full campaign so organizer store stays in sync
          connectedClients.forEach((c, id) => {
            if (c.role === 'organizer') {
              sendTo(id, { type: 'MOVE_APPLIED', charId, fromTile, toTile: { q: destQ, r: destR }, mapId, campaign })
            }
          })
        } else {
          console.log(`[MOVE] Blocked — forwarding to organizer for approval`)
          connectedClients.forEach((c, id) => {
            if (c.role === 'organizer') {
              sendTo(id, {
                type: 'MOVE_REQUEST',
                deviceId: client.deviceId,
                playerName: client.name,
                characterId: charId,
                tileKey: msg.tileKey,
              })
            }
          })
        }
        break
      }

      // ── Player: dismiss cutscene ──────────────────────────────
      case 'PLAYER_DISMISS_CUTSCENE': {
        if (client.role !== 'player' || !session) break
        if (session.players[client.deviceId]) {
          session.players[client.deviceId].cutsceneDismissed = true
        }
        break
      }

      // ── Display screen control ───────────────────────────────
      case 'SHOW_STORYBOARD': {
        if (client.role !== 'organizer') break
        connectedClients.forEach((c, id) => {
          if (c.role === 'display' && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type: 'DISPLAY_STORYBOARD', storyboard: msg.storyboard }))
          }
        })
        break
      }

      case 'SHOW_STORYBOARD_TO_PLAYER': {
        // Send to players who triggered the event (all players on that tile, or specific deviceId)
        const storyMsg = { type: 'PLAYER_STORYBOARD', storyboard: msg.storyboard }
        if (msg.deviceId) {
          // Send to specific player
          connectedClients.forEach((c, id) => {
            if (c.role === 'player' && c.deviceId === msg.deviceId && c.ws.readyState === WebSocket.OPEN) {
              c.ws.send(JSON.stringify(storyMsg))
            }
          })
        } else {
          // Send to all players on the triggering tile
          if (session && msg.tileKey) {
            Object.values(session.players).forEach(player => {
              const char = campaign?.actors?.[player.characterId]
              if (char && char.currentTile && `${char.currentTile.q},${char.currentTile.r}` === msg.tileKey) {
                connectedClients.forEach((c, id) => {
                  if (c.role === 'player' && c.deviceId === player.deviceId && c.ws.readyState === WebSocket.OPEN) {
                    c.ws.send(JSON.stringify(storyMsg))
                  }
                })
              }
            })
          }
        }
        break
      }

      case 'PLAYER_UPDATE_PORTRAIT': {
        if (client.role !== 'player' || !session) break
        const { characterId, portrait } = msg
        if (!characterId || !portrait) break
        connectedClients.forEach((c) => {
          if (c.role === 'organizer' && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type: 'UPDATE_CHARACTER_PORTRAIT', characterId, portrait }))
          }
        })
        break
      }

      case 'PLAYER_TAKE_ITEM': {
        if (client.role !== 'player' || !session) break
        const { containerId, itemId, characterId } = msg
        if (!containerId || !itemId) break
        connectedClients.forEach((c) => {
          if (c.role === 'organizer' && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type: 'TAKE_ITEM_REQUEST', containerId, itemId, characterId }))
          }
        })
        break
      }

      case 'PLAYER_FIRE_EVENT': {
        if (client.role !== 'player' || !session || !campaign) break
        const { tileKey, eventId } = msg
        if (!tileKey || !eventId) break

        const mapId = session.activeMapId || campaign.activeMapId
        const map = campaign.maps[mapId]
        if (!map) break

        const tile = map.tiles[tileKey]
        if (!tile) break

        const ev = tile.events?.find(e => e.id === eventId)
        if (!ev) break

        const [tileQ, tileR] = tileKey.split(',').map(Number)
        const firedAt = new Date().toISOString()
        const steps = ev.steps || []

        const OVERLAY_COLORS = { fire: '#c25a4a', flood: '#2a5a8a', collapse: '#6a6a6a', reveal: '#c8a96e' }
        const newFiredEvents = { ...(map.firedEvents || {}) }

        steps.forEach(step => {
          const affected = step.includeSelf !== false
            ? [{ q: tileQ, r: tileR }, ...(step.affectedTiles || [])]
            : (step.affectedTiles || [])

          switch (step.type) {
            case 'fire':
            case 'flood':
            case 'reveal': {
              const color = OVERLAY_COLORS[step.type]
              affected.forEach(({ q, r }) => {
                newFiredEvents[`${q},${r}`] = { color, label: ev.name, type: step.type, firedAt }
              })
              break
            }
            case 'collapse': {
              affected.forEach(({ q, r }) => {
                newFiredEvents[`${q},${r}`] = { color: '#6a6a6a', label: ev.name, type: 'collapse', blocked: true, firedAt }
              })
              break
            }
            case 'portal': {
              if (step.targetMapId && step.targetTile) {
                const charId = client.characterId || session.players[client.deviceId]?.characterId
                if (charId) {
                  // Move the player's token to destination
                  const srcKey = tileKey
                  const destKey = `${step.targetTile.q},${step.targetTile.r}`
                  const destMap = campaign.maps[step.targetMapId]
                  if (destMap) {
                    // Remove from source
                    if (map.tiles[srcKey]) {
                      map.tiles[srcKey] = { ...map.tiles[srcKey], tokens: (map.tiles[srcKey].tokens || []).filter(id => id !== charId) }
                    }
                    // Add to dest
                    const destTile = destMap.tiles[destKey] ?? { biome: destMap.defaultBiome, label: '', notes: '', tokens: [], events: [] }
                    destMap.tiles[destKey] = { ...destTile, tokens: [...(destTile.tokens || []).filter(id => id !== charId), charId] }
                    // Update character position
                    if (campaign.actors[charId]) {
                      campaign.actors[charId] = { ...campaign.actors[charId], currentMapId: step.targetMapId, currentTile: step.targetTile }
                    }
                  }
                }
              }
              break
            }
            case 'message': {
              if (step.text) {
                broadcastToPlayers({ type: 'SHOW_CUTSCENE', cutscene: {
                  title: ev.name, content: step.text, type: 'text', targets: 'all'
                }})
              }
              break
            }
            case 'storyboard': {
              // Tell organizer to resolve images (they're in organizer's IndexedDB)
              // and broadcast to the appropriate targets
              connectedClients.forEach((c, id) => {
                if (c.role === 'organizer') {
                  sendTo(id, {
                    type: 'RESOLVE_AND_BROADCAST_STORYBOARD',
                    storyboardId: step.storyboardId,
                    storyboardTarget: step.storyboardTarget || 'player',
                    triggeringPlayerDeviceId: client.deviceId,
                    tileKey,
                  })
                }
              })
              break
            }
          }
        })

        // Mark event as fired
        const updatedEvents = tile.events.map(e => e.id === eventId ? { ...e, firedAt } : e)
        map.firedEvents = newFiredEvents
        map.tiles[tileKey] = { ...tile, events: updatedEvents }

        // Broadcast to everyone
        broadcastToPlayers({ type: 'CAMPAIGN_UPDATED', campaign: sanitizeCampaignForPlayer(campaign) })
        connectedClients.forEach((c, id) => {
          if (c.role === 'organizer') sendTo(id, { type: 'MOVE_APPLIED', campaign })
        })
        break
      }

      case 'DISMISS_PLAYER_STORYBOARD': {
        // Player dismissed their storyboard — switch display back to map if needed
        if (msg.showMapAfter && session) {
          connectedClients.forEach((c, id) => {
            if (c.role === 'display' && c.ws.readyState === WebSocket.OPEN) {
              c.ws.send(JSON.stringify({ type: 'DISPLAY_MAP', mapId: session.activeMapId }))
            }
          })
        }
        break
      }

      case 'SHOW_DISPLAY_MAP': {
        if (client.role !== 'organizer') break
        const displayMapId = msg.mapId || session?.activeMapId
        connectedClients.forEach((c, id) => {
          if (c.role === 'display' && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type: 'DISPLAY_MAP', mapId: displayMapId }))
          }
        })
        break
      }

      case 'SHOW_TILE': {
        if (client.role !== 'organizer') break
        const showMapId = msg.mapId || session?.activeMapId
        connectedClients.forEach((c) => {
          if (c.role === 'display' && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type: 'SHOW_TILE_BACKGROUND', q: msg.q, r: msg.r, mapId: showMapId }))
          }
        })
        break
      }

      case 'HIDE_TILE': {
        if (client.role !== 'organizer') break
        connectedClients.forEach((c) => {
          if (c.role === 'display' && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type: 'HIDE_TILE_BACKGROUND' }))
          }
        })
        break
      }

      case 'JOIN_DISPLAY': {
        connectedClients.set(socketId, { ...client, role: 'display' })
        if (session && campaign) {
          sendTo(socketId, { type: 'SESSION_STATE', session, campaign: sanitizeCampaignForPlayer(campaign) })
        }
        if (diceRolls.length > 0) {
          sendTo(socketId, { type: 'DICE_LOG_STATE', rolls: diceRolls })
        }
        sendTo(socketId, { type: 'JOIN_SCREEN_STATE', visible: joinScreenVisible })
        break
      }

      // ── Ping/pong ─────────────────────────────────────────────
      case 'PING':
        sendTo(socketId, { type: 'PONG' })
        break
    }
  })

  ws.on('close', () => {
    const client = connectedClients.get(socketId)
    if (client?.role === 'player' && session?.players[client.deviceId]) {
      delete session.players[client.deviceId]
      console.log(`[-] Player disconnected: ${client.name}`)
      connectedClients.forEach((c, id) => {
        if (c.role === 'organizer') {
          sendTo(id, { type: 'PLAYER_LEFT', deviceId: client.deviceId, players: getConnectedPlayerList() })
        }
      })
    } else if (client?.role === 'organizer') {
      console.log('[-] Organizer disconnected')
    }
    connectedClients.delete(socketId)
  })

  // Send initial state
  ws.send(JSON.stringify({
    type: 'CONNECTED',
    socketId,
    hasSession: !!session,
    sessionStatus: session?.status || null,
  }))
})

// ── REST: unassigned campaign characters (for join screen) ───
app.get('/api/campaign-characters', (req, res) => {
  if (!campaign || !session) return res.json({ characters: [] })
  // Return characters not currently claimed by a connected player
  const claimedIds = new Set(
    Object.values(session.players || {}).map(p => p.characterId).filter(Boolean)
  )
  const unassigned = Object.values(campaign.actors || {})
    .filter(a => !claimedIds.has(a.id))
    .map(a => ({ id: a.id, name: a.name, actorType: a.actorType, emoji: a.emoji, portrait: a.portrait,
                 stats: a.stats, publicNotes: a.publicNotes }))
  res.json({ characters: unassigned, campaignName: campaign.name })
})

// ── REST: get local IP for QR code ───────────────────────────
app.get('/api/server-info', (req, res) => {
  const { networkInterfaces } = require('os')
  const nets = networkInterfaces()
  const allIps = []
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) allIps.push(net.address)
    }
  }
  // Prefer routable LAN addresses; skip link-local (169.254.x.x)
  const isLan = addr => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(addr)
  const ips = [...allIps.filter(isLan), ...allIps.filter(a => !isLan(a))]
  res.json({ ip: ips[0] || 'localhost', port: PORT, ips })
})

// ── Fallback: serve player app ────────────────────────────────
app.get('*', (req, res) => {
  const playerIndex = path.join(__dirname, 'player-dist', 'index.html')
  if (fs.existsSync(playerIndex)) {
    res.sendFile(playerIndex)
  } else {
    res.send(`
      <html><body style="background:#1a1c1e;color:#e8e6e1;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px">
        <div style="font-size:48px">⬡</div>
        <h2>TileStories Player</h2>
        <p style="color:#9a9790">Run <code>npm run build:player</code> to build the player app</p>
      </body></html>
    `)
  }
})

const PORT = process.env.PORT || 3001
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n⬡  TileStories server running`)
  console.log(`   Organizer: http://localhost:5173`)
  console.log(`   Players:   http://[your-ip]:${PORT}\n`)
})