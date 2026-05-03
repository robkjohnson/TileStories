import React, { useState, useEffect, useRef, useCallback } from 'react'
import { TOKEN_EMOJIS } from './utils/tokenEmojis'
import useGameSocket from './utils/useGameSocket'
import { getDeviceId, savePlayerCharacter, loadPlayerCharacter } from './utils/playerDevice'
import { hexToPixel, hexCorners, pixelToHex, gridBounds, HEX_SIZE, hexDistance, squareToPixel, squareCorners, pixelToSquare, squareGridBounds, SQUARE_SIZE, squareDistance } from './utils/hexMath'
import { getTileType } from './utils/biomes'
import { getAllAnnotationsForMap, PIN_COLORS, setAnnotation, clearAnnotation } from './utils/playerAnnotations'
import { loadImage } from './utils/imageStorage'
import { useImage } from './utils/useImage'
import { rollDice } from './utils/dice'
import styles from './PlayerApp.module.css'

const deviceId = getDeviceId()

export default function PlayerApp() {
  const [screen, setScreen] = useState('join')   // join | lobby | game | cutscene
  const [session, setSession] = useState(null)
  const [campaign, setCampaign] = useState(null)
  const [playerStoryboard, setPlayerStoryboard] = useState(null)
  const [playerName, setPlayerName] = useState(localStorage.getItem('tilestories_player_name') || '')
  const [character, setCharacter] = useState(loadPlayerCharacter())
  const [activeTab, setActiveTab] = useState('map')  // map | character | inventory
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const [rollRequest, setRollRequest] = useState(null)   // { requestId, threshold, diceType, characterName }
  const [diceResult, setDiceResult] = useState(null)     // { value, success } — auto-dismiss toast
  const diceResultTimer = useRef(null)

  const { send } = useGameSocket(useCallback((msg) => {
    switch (msg.type) {
      case 'CONNECTED':
        setConnected(true)
        if (msg.hasSession) setError(null)
        else setError('No active session — ask your organizer to start one')
        break

      case 'SESSION_STATE':
        setSession(msg.session)
        if (msg.campaign) setCampaign(msg.campaign)
        // Sync resolved character from server — organizer may have assigned abilities/fields
        if (msg.session && msg.campaign) {
          const myPlayerData = msg.session.players?.[deviceId]
          if (myPlayerData?.characterId) {
            const resolvedChar = msg.campaign.characters?.[myPlayerData.characterId]
            if (resolvedChar) {
              setCharacter(resolvedChar)
              savePlayerCharacter(resolvedChar)
            }
          }
        }
        if (msg.session?.status === 'active' || msg.session?.status === 'paused') {
          setScreen(msg.session?.cutscene ? 'cutscene' : 'game')
        } else if (msg.session?.status === 'lobby') {
          setScreen('lobby')
        }
        break

      case 'PLAYER_STORYBOARD':
        setPlayerStoryboard(msg.storyboard)
        break

      case 'CAMPAIGN_UPDATED':
        if (msg.campaign) {
          setCampaign(msg.campaign)
          // Also re-sync our character in case organizer added abilities/fields
          setCharacter(prev => {
            if (!prev?.id) return prev
            const updated = msg.campaign.characters?.[prev.id]
            if (updated) { savePlayerCharacter(updated); return updated }
            return prev
          })
          setSession(s => s ? { ...s, _t: Date.now() } : s)
        }
        break

      case 'MAP_CHANGED':
        setSession(s => s ? { ...s, activeMapId: msg.mapId } : s)
        break

      case 'ROLL_REQUEST':
        setRollRequest({
          requestId: msg.requestId,
          threshold: msg.threshold || null,
          diceType: msg.diceType || 'd20',
          characterName: msg.characterName || null,
          description: msg.description || null,
        })
        break

      case 'DICE_ROLL_RESULT':
        setDiceResult({ value: msg.roll.value, success: msg.roll.success, threshold: msg.roll.threshold })
        clearTimeout(diceResultTimer.current)
        diceResultTimer.current = setTimeout(() => setDiceResult(null), 4000)
        break

      case 'SESSION_ENDED':
        setScreen('join')
        setSession(null)
        setCampaign(null)
        setError('Session ended by organizer')
        setRollRequest(null)
        setDiceResult(null)
        break

      case 'ERROR':
        setError(msg.message)
        break
    }
  }, []))

  function handleRequestMove(tileKey) {
    const [q, r] = tileKey.split(',').map(Number)
    const charId = character?.id

    setCharacter(prev => {
      if (!prev) return prev
      const updated = { ...prev, currentTile: { q, r } }
      savePlayerCharacter(updated)
      return updated
    })

    // Optimistic update — move token in tile.tokens so it renders immediately,
    // and update character.currentTile for interaction checks
    setCampaign(prev => {
      if (!prev || !charId) return prev
      const mapId = session?.activeMapId || prev.activeMapId
      const map = prev.maps?.[mapId]
      if (!map) return prev

      const char = prev.characters[charId]
      const tiles = { ...map.tiles }

      // Remove from old tile
      if (char?.currentTile) {
        const oldKey = `${char.currentTile.q},${char.currentTile.r}`
        if (tiles[oldKey]) {
          tiles[oldKey] = { ...tiles[oldKey], tokens: (tiles[oldKey].tokens || []).filter(id => id !== charId) }
        }
      }

      // Add to new tile
      const defaultTile = { biome: map.defaultBiome, label: '', notes: '', tokens: [], events: [] }
      const newKey = `${q},${r}`
      tiles[newKey] = { ...(tiles[newKey] || defaultTile), tokens: [...((tiles[newKey]?.tokens || []).filter(id => id !== charId)), charId] }

      return {
        ...prev,
        maps: { ...prev.maps, [mapId]: { ...map, tiles } },
        characters: { ...prev.characters, [charId]: { ...(char || character), currentTile: { q, r } } },
      }
    })

    send({ type: 'REQUEST_MOVE', tileKey })
  }

  function handlePlayerRoll(diceType = 'd20', threshold = null, requestId = null, description = null) {
    const value = rollDice(diceType)
    const myChar = (character?.id && campaign?.characters?.[character.id]) || character
    send({
      type: 'PLAYER_DICE_ROLL',
      characterId: myChar?.id || null,
      characterName: myChar?.name || 'Unknown',
      diceType,
      value,
      threshold,
      description,
      requestId,
    })
    if (requestId) setRollRequest(null)
  }

  function handleJoin() {
    if (!playerName.trim() || !character) return
    localStorage.setItem('tilestories_player_name', playerName.trim())
    savePlayerCharacter(character)
    send({
      type: 'JOIN_SESSION',
      deviceId,
      playerName: playerName.trim(),
      character,
    })
  }

  function handleReady() {
    send({ type: 'PLAYER_READY', ready: true })
  }

  // ── Join screen ───────────────────────────────────────────────
  if (screen === 'join') {
    return (
      <div className={styles.joinScreen}>
        <div className={styles.joinCard}>
          <div className={styles.joinHex}>⬡</div>
          <h1 className={styles.joinTitle}>TileStories</h1>
          <p className={styles.joinSubtitle}>Player</p>

          {error && <div className={styles.joinError}>{error}</div>}
          {!connected && <div className={styles.connecting}>Connecting to server…</div>}

          <div className={styles.joinField}>
            <label>Your name</label>
            <input type="text" value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="Enter your name…"
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
          </div>

          {/* Character */}
          <div className={styles.joinField}>
            <label>Your character</label>
            <CharacterSelector
              selected={character}
              onSelect={c => { setCharacter(c); savePlayerCharacter(c) }}
            />
          </div>

          <button
            className={styles.joinBtn}
            onClick={handleJoin}
            disabled={!connected || !playerName.trim() || !character}
          >
            Join session
          </button>
        </div>
      </div>
    )
  }

  // ── Lobby screen ──────────────────────────────────────────────
  if (screen === 'lobby') {
    const me = session?.players?.[deviceId]
    return (
      <div className={styles.lobbyScreen}>
        <div className={styles.lobbyCard}>
          <div className={styles.lobbyHex}>⬡</div>
          <h2 className={styles.lobbyTitle}>{session?.campaignName || 'Waiting…'}</h2>
          <p className={styles.lobbyHint}>Waiting for the organizer to start the game</p>

          <div className={styles.lobbyInfo}>
            <div className={styles.lobbyRow}>
              <span>You</span>
              <span>{playerName}</span>
            </div>
            <div className={styles.lobbyRow}>
              <span>Character</span>
              <span>{character?.name}</span>
            </div>
            {me?.assignedTile && (
              <div className={styles.lobbyRow}>
                <span>Starting tile</span>
                <span>({me.assignedTile.q}, {me.assignedTile.r})</span>
              </div>
            )}
          </div>

          <div className={styles.playerCount}>
            {Object.keys(session?.players || {}).length} player{Object.keys(session?.players || {}).length !== 1 ? 's' : ''} in lobby
          </div>

          <button
            className={`${styles.readyBtn} ${me?.ready ? styles.readyBtnOn : ''}`}
            onClick={handleReady}
          >
            {me?.ready ? '✓ Ready!' : 'Mark as ready'}
          </button>
        </div>
      </div>
    )
  }

  // ── Cutscene screen ───────────────────────────────────────────
  // Player-specific storyboard overlay (from event trigger)
  if (playerStoryboard) {
    return (
      <PlayerStoryboardOverlay
        storyboard={playerStoryboard}
        onDismiss={() => {
          setPlayerStoryboard(null)
          send({ type: 'DISMISS_PLAYER_STORYBOARD', showMapAfter: true })
        }}
      />
    )
  }

  if (screen === 'cutscene' && session?.cutscene) {
    const cs = session.cutscene
    const isTargeted = !cs.targets || cs.targets === 'all' || cs.targets?.includes(deviceId)
    const hasRewards = isTargeted && cs.rewards && (cs.rewards.currency || cs.rewards.items?.length)

    return (
      <div className={styles.cutsceneScreen}>
        {cs.imageUrl && <img src={cs.imageUrl} alt="" className={styles.cutsceneImage} />}
        <div className={styles.cutsceneContent}>
          {cs.title && <h2 className={styles.cutsceneTitle}>{cs.title}</h2>}
          {cs.content && <p className={styles.cutsceneText}>{cs.content}</p>}

          {/* Rewards panel */}
          {hasRewards && (
            <div className={styles.rewardsPanel}>
              <div className={styles.rewardsTitle}>✨ You received</div>
              {cs.rewards.currency != null && cs.rewards.currency !== 0 && (
                <div className={styles.rewardItem}>
                  <span className={styles.rewardCurrencyIcon}>$</span>
                  <span className={styles.rewardCurrencyAmount}>{cs.rewards.currency > 0 ? '+' : ''}{cs.rewards.currency}</span>
                  <span className={styles.rewardCurrencyLabel}>currency</span>
                </div>
              )}
              {(cs.rewards.items || []).map((ri, i) => {
                const tmpl = campaign?.items?.[ri.templateId]
                if (!tmpl) return null
                const rarityColors = { common:'#9a9790', uncommon:'#7bc47f', rare:'#5b9bd5', epic:'#9b7bc4', legendary:'#c8a96e' }
                const color = rarityColors[tmpl.rarity] || '#9a9790'
                return (
                  <div key={i} className={styles.rewardItem} style={{ borderLeftColor: color }}>
                    <span className={styles.rewardItemName} style={{ color }}>{tmpl.name}</span>
                    {ri.quantity > 1 && <span className={styles.rewardItemQty}>×{ri.quantity}</span>}
                    {tmpl.rarity && <span className={styles.rewardItemRarity} style={{ color }}>{tmpl.rarity}</span>}
                    {tmpl.description && <span className={styles.rewardItemDesc}>{tmpl.description}</span>}
                  </div>
                )
              })}
            </div>
          )}

          <button className={styles.cutsceneDismiss}
            onClick={() => { send({ type: 'PLAYER_DISMISS_CUTSCENE' }); setScreen('game') }}>
            {hasRewards ? 'Collect & Continue' : 'Continue'}
          </button>
        </div>
      </div>
    )
  }

  // ── Game screen ───────────────────────────────────────────────
  if (screen === 'game') {
    const activeMapId = session?.activeMapId || campaign?.activeMapId
    const activeMap = campaign?.maps?.[activeMapId]
    // character state is kept in sync with campaign via SESSION_STATE/CAMPAIGN_UPDATED
    // always prefer the campaign version (has abilities, new fields etc)
    const myChar = (character?.id && campaign?.characters?.[character.id]) || character
    const currentTurnEntry = session?.turnOrder?.[session?.currentTurnIndex ?? 0]
    const turnMode = session?.turnMode || 'organizer'
    // Turn order entries use 'id' (the character/creature id directly)
    const isMyTurn = turnMode === 'party' ||
      (turnMode === 'turn' && !!(currentTurnEntry?.id && (currentTurnEntry.id === myChar?.id || currentTurnEntry.id === character?.id)))

    return (
      <div className={styles.gameScreen}>
        {/* Top bar */}
        <div className={styles.gameTopBar}>
          <span className={styles.gameMapName}>{activeMap?.name || 'Map'}</span>
          {session && (() => {
            const mode = session.turnMode || 'organizer'
            if (mode === 'party') return <span className={styles.modeChip} style={{ background:'rgba(123,196,127,0.2)', color:'#7bc47f' }}>🎉 Party Mode</span>
            if (mode === 'organizer') return <span className={styles.modeChip} style={{ background:'rgba(200,169,110,0.15)', color:'#c8a96e' }}>🎲 Organizer</span>
            if (mode === 'turn') {
              return <span className={styles.modeChip} style={{ background: isMyTurn ? 'rgba(200,169,110,0.25)' : 'rgba(0,0,0,0.3)', color: isMyTurn ? '#c8a96e' : 'rgba(255,255,255,0.6)', fontWeight: isMyTurn ? 700 : 400 }}>
                {isMyTurn ? '⚡ Your turn!' : currentTurnEntry ? `⚔️ ${currentTurnEntry.name}'s turn` : '⚔️ Turn mode'}
              </span>
            }
            return null
          })()}
          {session?.status === 'paused' && <span className={styles.pausedBadge}>⏸ Paused</span>}
        </div>

        {/* Tab bar */}
        <div className={styles.gameTabBar}>
          {[['map','🗺 Map'],['character','👤 Char'],['inventory','🎒 Items'],['party','👥 Party'],['notes','📝 Notes']].map(([id, label]) => (
            <button key={id}
              className={`${styles.gameTab} ${activeTab === id ? styles.gameTabActive : ''}`}
              onClick={() => setActiveTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {/* Roll request banner — full-screen prompt */}
        {rollRequest && (
          <RollRequestBanner
            request={rollRequest}
            onRoll={() => handlePlayerRoll(rollRequest.diceType, rollRequest.threshold, rollRequest.requestId, rollRequest.description)}
            onDismiss={() => setRollRequest(null)}
          />
        )}

        {/* Dice result toast — auto-dismiss */}
        {diceResult && (
          <RollResultToast result={diceResult} onDismiss={() => setDiceResult(null)} />
        )}

        {/* Content */}
        <div className={styles.gameContent}>
          {activeTab === 'map' && (
            <PlayerMapView
              map={campaign?.maps?.[activeMapId]}
              campaign={campaign}
              session={session}
              character={myChar}
              send={send}
              isMyTurn={isMyTurn}
              onMove={handleRequestMove}
              onStoryboard={sb => setPlayerStoryboard(sb)}
            />
          )}
          {activeTab === 'character' && (
            <PlayerCharacterView character={myChar} campaign={campaign} localCharacter={character} send={send} onRoll={handlePlayerRoll} />
          )}
          {activeTab === 'inventory' && (
            <PlayerInventoryView character={myChar} campaign={campaign} />
          )}
          {activeTab === 'party' && (
            <PlayerPartyView campaign={campaign} character={myChar} />
          )}
          {activeTab === 'notes' && (
            <PlayerNotesView />
          )}
        </div>
      </div>
    )
  }

  return null
}


// Portrait cache — persists across draws
const _portraitCache = {}

// Draw tokens on a tile with tiered visibility
function drawTileTokens(ctx, sx, sy, tileR, tile, characters, isOrganizer) {
  const tokenIds = tile.tokens || []
  if (!tokenIds.length || tileR < 12) return

  const fullTokens = []
  const dotTokens  = []

  tokenIds.forEach(charId => {
    const char = characters[charId]
    if (!char) return
    if (char.type === 'player' || char.isKey || char.revealedToPlayers) {
      fullTokens.push(char)
    } else if (isOrganizer) {
      dotTokens.push(char)
    }
    // players see nothing for non-revealed non-key NPCs
  })

  const tokenR = Math.max(7, tileR * 0.24)
  const tokenBaseY = sy + tileR * 0.28
  const count = fullTokens.length
  const fullOffsets = count === 0 ? []
    : count === 1 ? [{ x:0, y:0 }]
    : count === 2 ? [{ x:-tokenR*1.1, y:0 }, { x:tokenR*1.1, y:0 }]
    : [{ x:0, y:-tokenR*0.9 }, { x:-tokenR*1.1, y:tokenR*0.7 }, { x:tokenR*1.1, y:tokenR*0.7 }]

  fullTokens.slice(0, 3).forEach((char, ti) => {
    const off = fullOffsets[ti] || { x:0, y:0 }
    const tx = sx + off.x, ty = tokenBaseY + off.y
    const ringColors = { player:'#5b9bd5', npc:'#7bc47f', monster:'#c25a4a' }
    const bgColors   = { player:'#1a3050', npc:'#1a3020', monster:'#301a1a' }
    const ring = char.isKey ? '#c8a96e' : (ringColors[char.type] || '#9a9790')
    const bg   = bgColors[char.type] || '#2a2e34'

    ctx.beginPath()
    ctx.arc(tx, ty, tokenR, 0, Math.PI * 2)
    ctx.fillStyle = bg; ctx.fill()
    ctx.strokeStyle = ring
    ctx.lineWidth = char.type === 'player' ? Math.max(2, tokenR * 0.2) : Math.max(1.5, tokenR * 0.15)
    ctx.stroke()

    if (tileR > 20) {
      if (char.portrait) {
        const _resolved = _portraitCache[char.portrait]
        if (_resolved) {
          const img = new Image(); img.src = _resolved
          if (img.complete && img.naturalWidth > 0) {
            ctx.save(); ctx.beginPath(); ctx.arc(tx, ty, tokenR-1, 0, Math.PI*2); ctx.clip()
            ctx.drawImage(img, tx-tokenR+1, ty-tokenR+1, (tokenR-1)*2, (tokenR-1)*2)
            ctx.restore()
          } else { img.onload = () => {} }
        } else if (!_portraitCache['_loading_' + char.portrait]) {
          _portraitCache['_loading_' + char.portrait] = true
          loadImage(char.portrait).then(url => { if (url) _portraitCache[char.portrait] = url })
          ctx.font = `600 ${Math.max(7, tokenR*0.7)}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillStyle = ring; ctx.fillText((char.name||'?')[0].toUpperCase(), tx, ty)
        } else {
          ctx.font = `600 ${Math.max(7, tokenR*0.7)}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillStyle = ring; ctx.fillText((char.name||'?')[0].toUpperCase(), tx, ty)
        }
      } else if (char.emoji) {
        ctx.font = `${tokenR*1.05}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(char.emoji, tx, ty + tokenR*0.05)
      } else {
        ctx.font = `600 ${Math.max(7, tokenR*0.7)}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = ring; ctx.fillText((char.name||'?')[0].toUpperCase(), tx, ty)
      }
    }

    if (tileR > 28 && (char.type === 'player' || char.isKey)) {
      const nameY = ty + tokenR + 2
      const nfs = Math.max(7, Math.min(10, tileR*0.17))
      ctx.font = `600 ${nfs}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      const nw = ctx.measureText(char.name).width
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillRect(tx - nw/2 - 3, nameY, nw+6, nfs+3)
      ctx.fillStyle = char.type === 'player' ? '#5b9bd5' : '#c8a96e'
      ctx.fillText(char.name, tx, nameY+1)
    }
  })

  if (fullTokens.length > 3) {
    ctx.beginPath()
    ctx.arc(sx + tileR*0.4, tokenBaseY - tileR*0.3, Math.max(5, tileR*0.13), 0, Math.PI*2)
    ctx.fillStyle = '#c8a96e'; ctx.fill()
    ctx.font = `700 ${Math.max(6, tileR*0.12)}px sans-serif`
    ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`+${fullTokens.length-3}`, sx + tileR*0.4, tokenBaseY - tileR*0.3)
  }

  if (dotTokens.length > 0 && tileR > 10) {
    const dotR = Math.max(4, tileR*0.1)
    const dotX = sx + tileR*0.5, dotY = sy + tileR*0.5
    const dotColor = dotTokens.some(c => c.type === 'monster') ? '#c25a4a' : '#c8a96e'
    ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI*2)
    ctx.fillStyle = dotColor; ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke()
    if (dotTokens.length > 1 && tileR > 20) {
      ctx.font = `700 ${Math.max(6, dotR*1.1)}px sans-serif`
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(dotTokens.length, dotX, dotY)
    }
  }
}

// ── Player map view ───────────────────────────────────────────
function PlayerMapView({ map, campaign, session, character, send, isMyTurn, onMove, onStoryboard }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [selectedTile, setSelectedTile] = useState(null)
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 })
  const [annotations, setAnnotations] = useState({})
  const [labelSize, setLabelSize] = useState(() => parseFloat(localStorage.getItem('tilestories_playerLabelSize') || '1'))
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const labelSizeRef = useRef(labelSize)
  labelSizeRef.current = labelSize
  const fittedMap = useRef(null)
  const drawRef = useRef(null)

  const campaignId = campaign?.id
  const mapId = map?.id

  useEffect(() => {
    if (campaignId && mapId) {
      setAnnotations(getAllAnnotationsForMap(campaignId, mapId))
    }
  }, [campaignId, mapId])

  function fitMap(W, H) {
    if (!map || !W || !H) return
    const isSquare = map.tileStyle === 'square'
    const bounds = isSquare
      ? squareGridBounds(map.cols, map.rows, SQUARE_SIZE)
      : gridBounds(map.cols, map.rows, HEX_SIZE)
    const pad = 40
    const zoom = Math.min((W - pad * 2) / bounds.width, (H - pad * 2) / bounds.height, 2.5)
    setCamera({ zoom, x: (W - bounds.width * zoom) / 2 - bounds.minX * zoom, y: (H - bounds.height * zoom) / 2 - bounds.minY * zoom })
    fittedMap.current = map?.id
  }

  function draw() {
    const canvas = canvasRef.current
    if (!canvas || !map) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const { x: cx, y: cy, zoom } = cameraRef.current
    const isSquare = map.tileStyle === 'square'
    const BASE_SIZE = isSquare ? SQUARE_SIZE : HEX_SIZE
    const sz = BASE_SIZE * zoom
    const tileR = isSquare ? sz / 2 : sz

    ctx.fillStyle = '#141618'
    ctx.fillRect(0, 0, W, H)

    for (let q = 0; q < map.cols; q++) {
      for (let r = 0; r < map.rows; r++) {
        const key = `${q},${r}`
        const tile = (map.tiles || {})[key] ?? { biome: map.defaultBiome }
        const biome = getTileType(tile.biome, campaign?.tileTypes)
        const wp = isSquare ? squareToPixel(q, r, BASE_SIZE) : hexToPixel(q, r, HEX_SIZE)
        const sx = wp.x * zoom + cx, sy = wp.y * zoom + cy
        if (sx + tileR < 0 || sx - tileR > W || sy + tileR < 0 || sy - tileR > H) continue

        const pts = isSquare ? squareCorners(sx, sy, sz) : hexCorners(sx, sy, sz)
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.closePath()
        ctx.fillStyle = biome.color
        ctx.fill()
        ctx.strokeStyle = biome.border
        ctx.lineWidth = 0.75
        ctx.stroke()

        if (selectedTile?.q === q && selectedTile?.r === r) {
          ctx.strokeStyle = '#c8a96e'
          ctx.lineWidth = 2.5
          ctx.stroke()
          ctx.fillStyle = 'rgba(200,169,110,0.15)'
          ctx.fill()
        }

        // Fired event overlays
        const firedEvents = map.firedEvents || {}
        const overlay = firedEvents[key]
        if (overlay) {
          ctx.fillStyle = overlay.color + '55'
          ctx.beginPath()
          ctx.moveTo(pts[0].x, pts[0].y)
          for (let oi = 1; oi < pts.length; oi++) ctx.lineTo(pts[oi].x, pts[oi].y)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = overlay.color
          ctx.lineWidth = 2
          ctx.stroke()
          if (tileR > 20 && overlay.label) {
            ctx.fillStyle = overlay.color
            ctx.font = `600 ${Math.max(7, tileR * 0.17)}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(overlay.label, sx, sy - tileR * 0.55)
          }
        }

        // Draw tokens (tiered by visibility)
        drawTileTokens(ctx, sx, sy, tileR, tile, campaign?.characters || {}, false)

        // Character tokens handled by drawTileTokens above

        // Annotation pin
        const ann = annotations[key]
        if (ann && tileR > 14) {
          const pinColors = { red: '#c25a4a', gold: '#c8a96e', blue: '#5b9bd5', green: '#7bc47f', purple: '#9b7bc4', white: '#e8e6e1' }
          const pinColor = pinColors[ann.color] || '#c8a96e'
          const pinSize = Math.max(6, tileR * 0.2)
          const px2 = sx, py2 = sy - tileR * 0.55 - pinSize
          ctx.fillStyle = pinColor
          ctx.beginPath()
          ctx.arc(px2, py2 - pinSize * 0.3, pinSize * 0.55, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(px2 - pinSize * 0.25, py2 - pinSize * 0.3)
          ctx.lineTo(px2 + pinSize * 0.25, py2 - pinSize * 0.3)
          ctx.lineTo(px2, py2 + pinSize * 0.5)
          ctx.closePath()
          ctx.fill()
        }

        // Label — drawn last so it sits above tokens and pins
        if (tile.label && tile.showLabel && tileR > 18) {
          const ls = labelSizeRef.current
          const fontSize = Math.min(11 * ls, tileR * 0.2 * ls)
          ctx.font = `500 ${fontSize}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          const textW = ctx.measureText(tile.label).width
          const padX = 4, padY = 2
          const pillX = sx - textW / 2 - padX
          const pillY = sy - tileR * 0.62
          ctx.fillStyle = 'rgba(0,0,0,0.72)'
          ctx.fillRect(pillX, pillY, textW + padX * 2, fontSize + padY * 2)
          ctx.fillStyle = biome.textColor
          ctx.fillText(tile.label, sx, pillY + padY)
        }
      }
    }
  }

  drawRef.current = draw  // always points to the latest draw closure

  useEffect(() => { draw() }) // run on every render to catch firedEvents/overlay changes

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const ro = new ResizeObserver(() => {
      const W = container.clientWidth
      const H = container.clientHeight
      canvas.width = W
      canvas.height = H
      if (fittedMap.current !== map?.id) fitMap(W, H)
      drawRef.current()  // always use latest draw — avoids stale closure when tile panel resizes canvas
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [map?.id])

  const dragging = useRef(false)
  const dragOrigin = useRef(null)

  function getHex(clientX, clientY) {
    if (!canvasRef.current || !map) return null
    const rect = canvasRef.current.getBoundingClientRect()
    const { x, y, zoom } = cameraRef.current
    const wx = (clientX - rect.left - x) / zoom
    const wy = (clientY - rect.top - y) / zoom
    const { q, r } = map.tileStyle === 'square' ? pixelToSquare(wx, wy) : pixelToHex(wx, wy)
    if (q >= 0 && q < map.cols && r >= 0 && r < map.rows) return { q, r }
    return null
  }

  const touchStartPos = useRef(null)
  const touchMoved = useRef(false)
  const pinching = useRef(false)
  const pinchPrev = useRef({ dist: 0, midX: 0, midY: 0 })

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      pinching.current = true
      dragging.current = false
      touchMoved.current = true // suppress tap on lift
      const t0 = e.touches[0], t1 = e.touches[1]
      pinchPrev.current = {
        dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        midX: (t0.clientX + t1.clientX) / 2,
        midY: (t0.clientY + t1.clientY) / 2,
      }
    } else if (e.touches.length === 1) {
      pinching.current = false
      dragging.current = true
      touchMoved.current = false
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      dragOrigin.current = { x: e.touches[0].clientX - cameraRef.current.x, y: e.touches[0].clientY - cameraRef.current.y }
    }
  }

  function onTouchMove(e) {
    e.preventDefault()
    if (e.touches.length === 2) {
      const t0 = e.touches[0], t1 = e.touches[1]
      const curDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      const curMidX = (t0.clientX + t1.clientX) / 2
      const curMidY = (t0.clientY + t1.clientY) / 2
      const { dist: prevDist, midX: prevMidX, midY: prevMidY } = pinchPrev.current
      const { x, y, zoom } = cameraRef.current
      const factor = prevDist > 0 ? curDist / prevDist : 1
      const nz = Math.min(5, Math.max(0.15, zoom * factor))
      const ratio = nz / zoom
      setCamera({ zoom: nz, x: curMidX - (prevMidX - x) * ratio, y: curMidY - (prevMidY - y) * ratio })
      pinchPrev.current = { dist: curDist, midX: curMidX, midY: curMidY }
    } else if (e.touches.length === 1 && dragging.current) {
      const dx = e.touches[0].clientX - touchStartPos.current.x
      const dy = e.touches[0].clientY - touchStartPos.current.y
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) touchMoved.current = true
      if (touchMoved.current) {
        setCamera(c => ({ ...c, x: e.touches[0].clientX - dragOrigin.current.x, y: e.touches[0].clientY - dragOrigin.current.y }))
      }
    }
  }

  function onTouchEnd(e) {
    if (pinching.current && e.touches.length < 2) {
      pinching.current = false
      // If one finger remains, restart pan from it without risking a tap
      if (e.touches.length === 1) {
        dragging.current = true
        touchMoved.current = true
        touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        dragOrigin.current = { x: e.touches[0].clientX - cameraRef.current.x, y: e.touches[0].clientY - cameraRef.current.y }
      }
      return
    }
    const wasDrag = touchMoved.current
    dragging.current = false
    touchMoved.current = false
    // Only select tile if this was a tap (not a pan)
    if (!wasDrag && e.changedTouches.length === 1) {
      const hex = getHex(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
      if (hex) setSelectedTile(prev => prev?.q === hex.q && prev?.r === hex.r ? null : hex)
    }
  }

  function onWheel(e) {
    e.preventDefault()
    const { x, y, zoom } = cameraRef.current
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.12 : 0.89
    const nz = Math.min(5, Math.max(0.15, zoom * factor))
    setCamera({ zoom: nz, x: mx - (mx - x) * (nz / zoom), y: my - (my - y) * (nz / zoom) })
  }

  // Mouse panning (desktop)
  const mouseDragging = useRef(false)
  const mouseDragOrigin = useRef(null)
  const mouseMoved = useRef(false)

  function onMouseDown(e) {
    if (e.button === 1 || e.button === 2 || e.altKey) {
      mouseDragging.current = true
      mouseMoved.current = false
      mouseDragOrigin.current = { x: e.clientX - cameraRef.current.x, y: e.clientY - cameraRef.current.y }
      e.preventDefault()
      return
    }
    if (e.button === 0) {
      mouseDragging.current = true
      mouseMoved.current = false
      mouseDragOrigin.current = { x: e.clientX - cameraRef.current.x, y: e.clientY - cameraRef.current.y }
    }
  }

  function onMouseMove(e) {
    if (mouseDragging.current && mouseDragOrigin.current) {
      const dx = e.clientX - (mouseDragOrigin.current.x + cameraRef.current.x)
      const dy = e.clientY - (mouseDragOrigin.current.y + cameraRef.current.y)
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) mouseMoved.current = true
      if (mouseMoved.current) {
        setCamera(c => ({ ...c, x: e.clientX - mouseDragOrigin.current.x, y: e.clientY - mouseDragOrigin.current.y }))
      }
    }
  }

  function onMouseUp(e) {
    const wasDrag = mouseMoved.current
    mouseDragging.current = false
    mouseMoved.current = false
    if (!wasDrag && e.button === 0) {
      const hex = getHex(e.clientX, e.clientY)
      if (hex) setSelectedTile(prev => prev?.q === hex.q && prev?.r === hex.r ? null : hex)
    }
  }

  function onMouseLeave() {
    mouseDragging.current = false
    mouseMoved.current = false
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  const selectedTileData = selectedTile ? (map?.tiles?.[`${selectedTile.q},${selectedTile.r}`] ?? { biome: map?.defaultBiome }) : null

  return (
    <div className={styles.mapWrap}>
      <div ref={containerRef} className={styles.mapCanvas}>
        <canvas ref={canvasRef}
          style={{ display: 'block', cursor: mouseDragging.current ? 'grabbing' : 'default', touchAction: 'none' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onContextMenu={e => e.preventDefault()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
        {/* Label size control */}
        <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(20,22,24,0.78)', borderRadius: 6, padding: '3px 8px', pointerEvents: 'auto' }}>
          <span style={{ fontSize: 10, color: 'rgba(200,200,200,0.55)', userSelect: 'none' }}>A</span>
          <input type="range" min={0.5} max={2} step={0.1} value={labelSize}
            onChange={e => {
              const v = parseFloat(e.target.value)
              localStorage.setItem('tilestories_playerLabelSize', v)
              setLabelSize(v)
            }}
            style={{ width: 60, accentColor: '#c8a96e' }}
          />
          <span style={{ fontSize: 13, color: 'rgba(200,200,200,0.55)', userSelect: 'none' }}>A</span>
        </div>
      </div>

      {/* Tile info panel */}
      {selectedTile && selectedTileData && (
        <PlayerTilePanel
          tile={selectedTileData}
          tileKey={`${selectedTile.q},${selectedTile.r}`}
          q={selectedTile.q}
          r={selectedTile.r}
          campaign={campaign}
          mapId={mapId}
          campaignId={campaignId}
          character={character}
          annotations={annotations}
          isMyTurn={isMyTurn}
          session={session}
          send={send}
          onMove={onMove}
          onAnnotationChange={() => setAnnotations(getAllAnnotationsForMap(campaignId, mapId))}
          onStoryboard={onStoryboard}
        />
      )}
    </div>
  )
}

function AnnotationEditor({ campaignId, mapId, q, r, current, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ label: current?.label || '', color: current?.color || 'gold' })

  function save() {
    setAnnotation(campaignId, mapId, q, r, draft)
    onChange()
    setEditing(false)
  }

  function clear() {
    clearAnnotation(campaignId, mapId, q, r)
    onChange()
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className={styles.annRow}>
        {current
          ? <><span className={styles.annPin}>📍</span><span className={styles.annLabel}>{current.label || 'My pin'}</span><button className={styles.annEdit} onClick={() => setEditing(true)}>Edit</button><button className={styles.annClear} onClick={clear}>×</button></>
          : <button className={styles.addAnn} onClick={() => setEditing(true)}>+ Add my note</button>
        }
      </div>
    )
  }

  return (
    <div className={styles.annEdit2}>
      <input type="text" value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} placeholder="Note…" />
      <div className={styles.colorRow}>
        {PIN_COLORS.map(p => (
          <button key={p.id} style={{ width: 20, height: 20, borderRadius: '50%', background: p.color, border: draft.color === p.id ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }}
            onClick={() => setDraft(d => ({ ...d, color: p.id }))} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className={styles.annSave} onClick={save}>Save</button>
        <button className={styles.annCancel} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  )
}

// ── Player character view ─────────────────────────────────────
const CAT_COLORS = { attack:'#c25a4a', defense:'#5b9bd5', utility:'#c8a96e', passive:'#7bc47f', reaction:'#9b7bc4' }
const CAT_ICONS  = { attack:'⚔️', defense:'🛡️', utility:'🔧', passive:'✨', reaction:'⚡' }

async function compressImage(file, maxDim = 300, quality = 0.78) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = url
  })
}

function PlayerCharacterView({ character, campaign, localCharacter, send, onRoll }) {
  const [tab, setTab] = useState('info')
  const portraitInputRef = useRef(null)
  const abilities = character?.abilities || []
  const isOwnChar = localCharacter?.id === character?.id

  if (!character) return <div className={styles.emptyView}>No character loaded</div>

  const sb = character.stats || {}

  async function handlePortraitUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await compressImage(file)
    e.target.value = ''
    // Save locally
    try {
      const raw = localStorage.getItem('tilestories_all_characters')
      const chars = raw ? JSON.parse(raw) : []
      localStorage.setItem('tilestories_all_characters', JSON.stringify(chars.map(c => c.id === character.id ? { ...c, portrait: dataUrl } : c)))
      const curr = JSON.parse(localStorage.getItem('tilestories_player_character') || 'null')
      if (curr?.id === character.id) localStorage.setItem('tilestories_player_character', JSON.stringify({ ...curr, portrait: dataUrl }))
    } catch {}
    // Sync to organizer
    send?.({ type: 'PLAYER_UPDATE_PORTRAIT', characterId: character.id, portrait: dataUrl })
  }

  return (
    <div className={styles.charView}>
      {/* Header */}
      <div className={styles.charViewHeader}>
        <div
          className={styles.charViewAvatarWrap}
          onClick={isOwnChar ? () => portraitInputRef.current?.click() : undefined}
          title={isOwnChar ? 'Upload portrait' : undefined}
        >
          {character.portrait
            ? <img src={character.portrait} alt="" className={styles.charViewPortrait} />
            : <span className={styles.charViewEmoji}>{character.emoji || '👤'}</span>
          }
          {isOwnChar && <span className={styles.charViewPortraitHint}>📷</span>}
          {isOwnChar && <input ref={portraitInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePortraitUpload} />}
        </div>
        <div>
          <div className={styles.charViewName}>{character.name}</div>
          <div className={styles.charViewType}>{character.type}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.charViewTabs}>
        {[
          ['info', 'Info'],
          ['abilities', `Abilities${abilities.length ? ` (${abilities.length})` : ''}`],
          ['story', 'Story'],
        ].map(([id, label]) => (
          <button key={id}
            className={`${styles.charViewTab} ${tab === id ? styles.charViewTabActive : ''}`}
            onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Info tab ── */}
      {tab === 'info' && (
        <div className={styles.charViewContent}>
          {/* HP — prominent row */}
          <div className={styles.hpRow}>
            <span className={styles.hpLabel}>HP</span>
            <span className={styles.hpCurrentValue}>{sb.hp ?? '?'}</span>
            <span className={styles.hpSep}>/</span>
            <span className={styles.hpMaxValue}>{sb.maxHp ?? '?'}</span>
            <div className={styles.hpBarWrap}>
              <div className={styles.hpBarFill} style={{
                width: sb.maxHp ? `${Math.min(100, (sb.hp/sb.maxHp)*100)}%` : '0%',
                background: sb.maxHp && (sb.hp/sb.maxHp) < 0.3 ? '#c25a4a' : sb.maxHp && (sb.hp/sb.maxHp) < 0.6 ? '#c8a96e' : '#7bc47f'
              }} />
            </div>
          </div>
          <div className={styles.statGrid}>
            {[
              ['Speed', `${sb.speed ?? 3} tiles`],
            ].map(([l, v]) => (
              <div key={l} className={styles.statBox}>
                <div className={styles.statLabel}>{l}</div>
                <div className={styles.statValue}>{v}</div>
              </div>
            ))}
          </div>
          {/* Currency wallet */}
          <div className={styles.walletRow}>
            <span className={styles.walletIcon}>$</span>
            <span className={styles.walletAmount}>{(character.currency ?? 0).toLocaleString()}</span>
            <span className={styles.walletLabel}>currency</span>
          </div>
          {character.description && (
            <div className={styles.charDesc}>{character.description}</div>
          )}
          {character.publicNotes && (
            <div className={styles.publicNotes}>{character.publicNotes}</div>
          )}
          {onRoll && (
            <button className={styles.rollDiceBtn} onClick={() => onRoll('d20')}>
              🎲 Roll D20
            </button>
          )}
        </div>
      )}

      {/* ── Abilities tab ── */}
      {tab === 'abilities' && (
        <div className={styles.charViewContent}>
          {abilities.length === 0 ? (
            <div className={styles.emptySection}>
              No abilities assigned yet.{'\n'}The organizer can assign abilities to your character.
            </div>
          ) : abilities.map(inst => {
            const tmpl = campaign?.abilities?.[inst.templateId]
            if (!tmpl) return null
            const color = CAT_COLORS[tmpl.category] || '#9a9790'
            const usesRemaining = inst.usesRemaining ?? tmpl.usesPerRest
            return (
              <div key={inst.templateId} className={styles.abilityCard} style={{ borderLeftColor: color }}>
                <div className={styles.abilityCardHeader}>
                  <span>{CAT_ICONS[tmpl.category] || '✨'}</span>
                  <span className={styles.abilityName}>{tmpl.name}</span>
                  <span className={styles.abilityAction} style={{ color }}>
                    {tmpl.actionCost?.replace('_', ' ')}
                  </span>
                  {tmpl.usesPerRest != null
                    ? <span className={styles.abilityUses} style={{ color: usesRemaining > 0 ? color : '#5a5855' }}>
                        {usesRemaining}/{tmpl.usesPerRest}
                      </span>
                    : <span className={styles.abilityUses} style={{ color }}>∞</span>
                  }
                </div>
                {tmpl.description && <div className={styles.abilityDesc}>{tmpl.description}</div>}
                <div className={styles.abilityStats}>
                  {tmpl.damageDice && (
                    <span className={styles.abilityStat}>
                      💥 {tmpl.damageDice}{tmpl.damageBonus > 0 ? `+${tmpl.damageBonus}` : ''}{tmpl.damageType !== 'none' ? ` ${tmpl.damageType}` : ''}
                    </span>
                  )}
                  {tmpl.saveStat && <span className={styles.abilityStat}>🎯 DC {tmpl.saveDC} {tmpl.saveStat}</span>}
                  {tmpl.range === 'ranged' && tmpl.rangeDistance && <span className={styles.abilityStat}>🏹 {tmpl.rangeDistance}ft</span>}
                  {tmpl.range === 'aoe' && <span className={styles.abilityStat}>📐 {tmpl.aoeSize}ft {tmpl.aoeShape}</span>}
                  {tmpl.conditions?.length > 0 && <span className={styles.abilityStat}>⚠️ {tmpl.conditions.join(', ')}</span>}
                  {tmpl.usesPerRest && <span className={styles.abilityStat}>🔁 {tmpl.restType} rest</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Story tab ── */}
      {tab === 'story' && (
        <PlayerStoryTab character={character} localCharacter={localCharacter} />
      )}
    </div>
  )
}

function PlayerStoryTab({ character, localCharacter }) {
  const isOwnChar = localCharacter?.id === character?.id
  const [description, setDescription] = useState(character?.description || '')
  const [biography, setBiography]     = useState(character?.biography   || '')

  useEffect(() => {
    setDescription(character?.description || '')
    setBiography(character?.biography   || '')
  }, [character?.description, character?.biography])

  function persist(field, value) {
    try {
      const raw = localStorage.getItem('tilestories_all_characters')
      const chars = raw ? JSON.parse(raw) : []
      localStorage.setItem('tilestories_all_characters',
        JSON.stringify(chars.map(c => c.id === character.id ? { ...c, [field]: value } : c)))
      const curr = JSON.parse(localStorage.getItem('tilestories_player_character') || 'null')
      if (curr?.id === character.id)
        localStorage.setItem('tilestories_player_character', JSON.stringify({ ...curr, [field]: value }))
    } catch {}
  }

  return (
    <div className={styles.charViewContent}>
      <div className={styles.storyFieldLabel}>
        Description
        <span className={styles.storyFieldHint}>visible to all players</span>
      </div>
      {isOwnChar ? (
        <textarea className={styles.storyTextarea} rows={4}
          placeholder="How the world sees your character…"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={e => persist('description', e.target.value)} />
      ) : (
        <div className={styles.storyReadOnly}>{character?.description || <em>No description</em>}</div>
      )}

      <div className={styles.storyFieldLabel} style={{ marginTop: 12 }}>
        Biography
        <span className={styles.storyFieldHint}>🔒 private — only you see this</span>
      </div>
      {isOwnChar ? (
        <textarea className={styles.storyTextarea} rows={5}
          placeholder="Your character's backstory, motivations, secrets…"
          value={biography}
          onChange={e => setBiography(e.target.value)}
          onBlur={e => persist('biography', e.target.value)} />
      ) : (
        <div className={styles.storyReadOnly} style={{ fontStyle:'italic', color:'var(--text-muted)' }}>
          (private)
        </div>
      )}
    </div>
  )
}

// ── Player inventory view ─────────────────────────────────────
const RARITY_COLORS = { common:'#9a9790', uncommon:'#7bc47f', rare:'#5b9bd5', epic:'#9b7bc4', legendary:'#c8a96e' }
const RARITY_LABELS = { common:'Common', uncommon:'Uncommon', rare:'Rare', epic:'Epic', legendary:'Legendary' }

function PlayerInventoryView({ character, campaign }) {
  const [detail, setDetail] = useState(null)

  if (!character) return <div className={styles.emptyView}>No character</div>
  const inventory = character.inventory || []
  const allItems = campaign?.items || {}

  if (inventory.length === 0) return <div className={styles.emptyView}>Your inventory is empty</div>

  const totalWeight = inventory.reduce((s, i) => s + (allItems[i.templateId]?.weight || 0) * (i.quantity || 1), 0)

  return (
    <div className={styles.inventoryView}>
      <div className={styles.inventoryHeader}>
        <span className={styles.inventoryTitle}>Inventory</span>
        {totalWeight > 0 && <span className={styles.inventoryWeight}>⚖️ {totalWeight.toFixed(1)}lb</span>}
      </div>
      {inventory.map(inst => {
        const tmpl = allItems[inst.templateId]
        if (!tmpl) return null
        const unidentified = inst.identified === false
        const displayName = unidentified ? 'Unknown Item' : tmpl.name
        const rarityColor = RARITY_COLORS[tmpl.rarity] || RARITY_COLORS.common
        return (
          <div key={inst.id} className={styles.itemRow} style={{ borderLeftColor: rarityColor }} onClick={() => setDetail({ inst, tmpl })}>
            <span className={styles.itemIcon}>📦</span>
            <div className={styles.itemInfo}>
              <span className={styles.itemName} style={{ color: rarityColor }}>{displayName}</span>
              {(inst.quantity || 1) > 1 && <span className={styles.itemQty}>×{inst.quantity}</span>}
              {inst.notes && <span className={styles.itemNotes}>{inst.notes}</span>}
            </div>
            {tmpl.value > 0 && <span className={styles.itemValue}>{tmpl.value}gp</span>}
          </div>
        )
      })}

      {detail && (
        <div className={styles.charDetailOverlay} onClick={() => setDetail(null)}>
          <div className={styles.charDetailSheet} onClick={e => e.stopPropagation()}>
            <button className={styles.charDetailClose} onClick={() => setDetail(null)}>×</button>
            {(() => {
              const { inst, tmpl } = detail
              const unidentified = inst.identified === false
              const rarityColor = RARITY_COLORS[tmpl.rarity] || RARITY_COLORS.common
              return <>
                <div className={styles.charDetailAvatar}>
                  <span style={{ fontSize: 48 }}>📦</span>
                </div>
                <div className={styles.charDetailName} style={{ color: rarityColor }}>
                  {unidentified ? 'Unknown Item' : tmpl.name}
                </div>
                <div className={styles.charDetailType}>
                  {RARITY_LABELS[tmpl.rarity] || 'Common'} · {tmpl.category || 'misc'}
                </div>
                {(inst.quantity || 1) > 1 && (
                  <div className={styles.charDetailHpRow}>
                    <span className={styles.charDetailHpLabel}>Qty</span>
                    <span className={styles.charDetailHpVal}>×{inst.quantity}</span>
                  </div>
                )}
                {!unidentified && tmpl.description && (
                  <div className={styles.charDetailSection}>
                    <div className={styles.charDetailSectionLabel}>Description</div>
                    <div className={styles.charDetailText}>{tmpl.description}</div>
                  </div>
                )}
                <div className={styles.charDetailMetaRow}>
                  {tmpl.weight > 0 && <span className={styles.charDetailMeta}>⚖️ {tmpl.weight}lb</span>}
                  {tmpl.value > 0 && <span className={styles.charDetailMeta}>💰 {tmpl.value}gp</span>}
                </div>
                {inst.notes && (
                  <div className={styles.charDetailSection}>
                    <div className={styles.charDetailSectionLabel}>Notes</div>
                    <div className={styles.charDetailText}>{inst.notes}</div>
                  </div>
                )}
              </>
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

// Re-export shared emoji list under the local alias used below
const PLAYER_EMOJIS = TOKEN_EMOJIS

// ── Character selector ───────────────────────────────────────
function CharacterSelector({ selected, onSelect }) {
  const [mode, setMode] = useState(selected ? 'selected' : 'list') // list | create | selected
  const [savedChars, setSavedChars] = useState([])
  const [campaignChars, setCampaignChars] = useState([])
  const [campaignName, setCampaignName] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('tilestories_all_characters')
      const parsed = raw ? JSON.parse(raw) : []
      const last = loadPlayerCharacter()
      if (last && !parsed.find(c => c.id === last.id)) parsed.unshift(last)
      setSavedChars(parsed)
    } catch { setSavedChars([]) }

    const base = `http://${window.location.hostname}:3001`
    fetch(`${base}/api/campaign-characters`)
      .then(r => r.json())
      .then(data => {
        setCampaignChars((data.characters || []).filter(c => c.type === 'player'))
        if (data.campaignName) setCampaignName(data.campaignName)
      })
      .catch(() => {})
  }, [])

  function saveChar(c) {
    // Save to "all characters" list
    setSavedChars(prev => {
      const existing = prev.find(p => p.id === c.id)
      const updated = existing ? prev.map(p => p.id === c.id ? c : p) : [...prev, c]
      localStorage.setItem('tilestories_all_characters', JSON.stringify(updated))
      return updated
    })
    onSelect(c)
    setMode('selected')
  }

  function deleteChar(id) {
    setSavedChars(prev => {
      const updated = prev.filter(c => c.id !== id)
      localStorage.setItem('tilestories_all_characters', JSON.stringify(updated))
      return updated
    })
    if (selected?.id === id) onSelect(null)
  }

  if (mode === 'selected' && selected) {
    return (
      <div className={styles.charPreview}>
        <span className={styles.charEmoji}>{selected.emoji || '👤'}</span>
        <div style={{ flex: 1 }}>
          <div className={styles.charName}>{selected.name}</div>
          <div className={styles.charType}>{selected.type}</div>
        </div>
        <button className={styles.changeCharBtn} onClick={() => setMode('list')}>Change</button>
      </div>
    )
  }

  // Characters available from campaign that aren't already saved locally
  const localIds = new Set(savedChars.map(c => c.id))
  const campaignOnly = campaignChars.filter(c => !localIds.has(c.id))

  return (
    <div className={styles.charSelector}>

      {/* My saved characters */}
      {savedChars.length > 0 && (
        <>
          <div className={styles.charSectionLabel}>My characters</div>
          <div className={styles.savedCharList}>
            {savedChars.map(c => (
              <div key={c.id}
                className={`${styles.savedCharRow} ${selected?.id === c.id ? styles.savedCharSelected : ''}`}
                onClick={() => { onSelect(c); setMode('selected') }}>
                <span className={styles.savedCharEmoji}>{c.emoji || '👤'}</span>
                <div className={styles.savedCharInfo}>
                  <span className={styles.savedCharName}>{c.name}</span>
                  <span className={styles.savedCharType}>{c.type}</span>
                </div>
                {selected?.id === c.id && <span className={styles.selectedCheck}>✓</span>}
                <button className={styles.deleteCharBtn}
                  onClick={e => { e.stopPropagation(); deleteChar(c.id) }}>🗑</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Campaign characters (unassigned) */}
      {campaignOnly.length > 0 && (
        <>
          <div className={styles.charSectionLabel}>
            {campaignName ? `From campaign: ${campaignName}` : 'Campaign characters'}
            <span className={styles.charSectionHint}> — not yet assigned to anyone</span>
          </div>
          <div className={styles.savedCharList}>
            {campaignOnly.map(c => (
              <div key={c.id}
                className={`${styles.savedCharRow} ${styles.campaignCharRow} ${selected?.id === c.id ? styles.savedCharSelected : ''}`}
                onClick={() => { onSelect(c); setMode('selected') }}>
                <span className={styles.savedCharEmoji}>{c.emoji || '👤'}</span>
                <div className={styles.savedCharInfo}>
                  <span className={styles.savedCharName}>{c.name}</span>
                  <span className={styles.savedCharType}>{c.type}</span>
                </div>
                {selected?.id === c.id && <span className={styles.selectedCheck}>✓</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create new — opens full-screen */}
      <button className={styles.createNewBtn} onClick={() => setMode('create')}>+ Create new character</button>

      {/* Full-screen create overlay */}
      {mode === 'create' && (
        <CreateCharacterScreen
          onSave={saveChar}
          onCancel={() => setMode('list')}
        />
      )}
    </div>
  )
}

// ── Create character — full screen overlay ────────────────────
function CreateCharacterScreen({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🧙')

  function handleSave() {
    if (!name.trim()) return
    onSave({
      id: Math.random().toString(36).slice(2, 10),
      name: name.trim(),
      type: 'player',
      emoji,
      stats: { hp: 10, maxHp: 10, speed: 3 },
      inventory: [],
      abilities: [],
      publicNotes: '',
    })
  }

  return (
    <div className={styles.createScreen}>
      <div className={styles.createScreenCard}>
        <div className={styles.createScreenHeader}>
          <button className={styles.createBackBtn} onClick={onCancel}>← Back</button>
          <h2 className={styles.createScreenTitle}>New character</h2>
        </div>

        {/* Emoji preview */}
        <div className={styles.createEmojiPreview}>{emoji}</div>

        {/* Name */}
        <div className={styles.createField}>
          <label className={styles.createLabel}>Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your character's name…"
            className={styles.createNameInput}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>

        {/* Emoji picker */}
        <div className={styles.createField}>
          <label className={styles.createLabel}>Avatar</label>
          <div className={styles.createEmojiGrid}>
            {PLAYER_EMOJIS.map((e, i) => (
              <button key={i}
                className={`${styles.createEmojiBtn} ${emoji === e ? styles.createEmojiBtnActive : ''}`}
                onClick={() => setEmoji(e)}>{e}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <button
          className={styles.createSaveBtn}
          onClick={handleSave}
          disabled={!name.trim()}
        >
          Create character
        </button>
      </div>
    </div>
  )
}

// ── Roll request banner ───────────────────────────────────────
function RollRequestBanner({ request, onRoll, onDismiss }) {
  return (
    <div className={styles.rollRequestOverlay}>
      <div className={styles.rollRequestCard}>
        <div className={styles.rollRequestTitle}>🎲 Roll Requested</div>
        {request.description && (
          <div className={styles.rollRequestDesc}>{request.description}</div>
        )}
        {request.characterName && (
          <div className={styles.rollRequestChar}>For: {request.characterName}</div>
        )}
        <div className={styles.rollRequestDice}>{request.diceType?.toUpperCase() || 'D20'}</div>
        {request.threshold != null && (
          <div className={styles.rollRequestDC}>DC {request.threshold} — need {request.threshold} or higher</div>
        )}
        <button className={styles.rollBigBtn} onClick={onRoll}>
          🎲 Roll Now
        </button>
        <button className={styles.rollDismissBtn} onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  )
}

// ── Roll result toast ─────────────────────────────────────────
function RollResultToast({ result, onDismiss }) {
  const isSuccess = result.success === true
  const isFail = result.success === false
  return (
    <div
      className={styles.rollResultToast}
      style={{ borderColor: isSuccess ? '#7bc47f' : isFail ? '#c25a4a' : 'var(--border-strong)' }}
      onClick={onDismiss}
    >
      <div className={styles.rollResultValue}
        style={{ color: isSuccess ? '#7bc47f' : isFail ? '#c25a4a' : 'var(--text-primary)' }}>
        {result.value}
      </div>
      <div className={styles.rollResultLabel}>
        {result.threshold != null
          ? `DC ${result.threshold} — ${isSuccess ? '✓ Success!' : '✗ Fail'}`
          : 'You rolled'}
      </div>
    </div>
  )
}

// ── Resolved image helper ────────────────────────────────────
function ResolvedImg({ src, style, alt }) {
  const resolved = useImage(src)
  if (!resolved) return null
  return <img src={resolved} alt={alt || ''} style={style} />
}

// ── Player storyboard overlay ─────────────────────────────────
function PlayerStoryboardOverlay({ storyboard: sb, onDismiss }) {
  const CANVAS_W = 1280, CANVAS_H = 720
  const bgSrc = useImage(sb.backgroundImage)
  const [zoom, setZoom] = useState(1)
  const outerRef = useRef(null)
  const pinchRef = useRef(null)

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    function onWheel(e) {
      e.preventDefault()
      setZoom(z => Math.max(0.5, Math.min(5, z * (e.deltaY < 0 ? 1.1 : 0.9))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      pinchRef.current = { startDist: d, startZoom: zoom }
    }
  }

  function onTouchMove(e) {
    if (e.touches.length === 2 && pinchRef.current) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      setZoom(Math.max(0.5, Math.min(5, pinchRef.current.startZoom * (d / pinchRef.current.startDist))))
    }
  }

  const ctrlBtn = {
    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
    background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff', fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div
      ref={outerRef}
      style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, touchAction: 'none' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => { pinchRef.current = null }}
    >
      {/* Letterbox canvas — 16:9, centered, with black bars */}
      <div style={{
        position: 'relative',
        width: 'min(100vw, calc(100vh * 16 / 9))',
        height: 'min(100vh, calc(100vw * 9 / 16))',
        containerType: 'size',
        backgroundColor: sb.backgroundColor || '#1a1c1e',
        overflow: 'hidden',
        transform: `scale(${zoom})`,
        transformOrigin: 'center',
      }}>
        {bgSrc && (
          <img src={bgSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        )}

        {(sb.layers || []).map(layer => (
          <div key={layer.id} style={{
            position: 'absolute',
            left: `${(layer.x / CANVAS_W) * 100}%`,
            top: `${(layer.y / CANVAS_H) * 100}%`,
            width: `${(layer.width / CANVAS_W) * 100}%`,
            height: `${(layer.height / CANVAS_H) * 100}%`,
            transform: `rotate(${layer.rotation || 0}deg) scaleX(${layer.flipX ? -1 : 1}) scaleY(${layer.flipY ? -1 : 1})`,
            opacity: layer.opacity ?? 1,
            pointerEvents: 'none',
          }}>
            <ResolvedImg src={layer.src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        ))}

        {(sb.textBlocks || []).map(tb => (
          <div key={tb.id} style={{
            position: 'absolute',
            left: `${(tb.x / CANVAS_W) * 100}%`,
            top: `${(tb.y / CANVAS_H) * 100}%`,
            fontSize: `${(tb.fontSize / CANVAS_H) * 100}cqh`,
            color: tb.color || '#fff',
            fontWeight: tb.bold ? 700 : 400,
            fontStyle: tb.italic ? 'italic' : 'normal',
            textAlign: tb.align || 'left',
            opacity: tb.opacity ?? 1,
            maxWidth: tb.maxWidth ? `${(tb.maxWidth / CANVAS_W) * 100}%` : '100%',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            textShadow: '0 2px 12px rgba(0,0,0,0.9)',
            transform: `rotate(${tb.rotation || 0}deg)`,
            pointerEvents: 'none',
          }}>
            {tb.text}
          </div>
        ))}
      </div>

      {/* Zoom + dismiss controls */}
      <div style={{ position: 'absolute', bottom: 24, right: 24, display: 'flex', gap: 8, zIndex: 10 }}>
        <button style={ctrlBtn} onClick={() => setZoom(z => Math.min(5, z * 1.2))}>+</button>
        <button style={ctrlBtn} onClick={() => setZoom(z => Math.max(0.5, z * 0.8))}>−</button>
        <button style={ctrlBtn} onClick={() => setZoom(1)} title="Reset zoom">⊡</button>
        <button onClick={onDismiss} style={{ ...ctrlBtn, width: 'auto', padding: '0 16px', fontSize: 14 }}>
          Continue →
        </button>
      </div>
    </div>
  )
}

// ── Player Tile Panel ─────────────────────────────────────────
function PlayerTilePanel({ tile, tileKey, q, r, campaign, mapId, campaignId, character, annotations, isMyTurn, session, send, onMove, onAnnotationChange, onStoryboard }) {
  const biome = getTileType(tile.biome, campaign?.tileTypes)
  const map = campaign?.maps?.[mapId]
  const turnMode = session?.turnMode || 'organizer'

  // Only allow interaction on the tile the player is standing on
  const myTileKey = character?.currentTile ? `${character.currentTile.q},${character.currentTile.r}` : null
  const isMyTile = myTileKey === tileKey || !character?.currentTile

  // Movement range check — use remaining movement from session in turn mode
  const speed = character?.stats?.speed ?? 3
  // Find this character's player data (has remainingMovement)
  const myPlayerData = Object.values(session?.players || {}).find(p => p.characterId === character?.id)
  const remainingMovement = turnMode === 'turn'
    ? (myPlayerData?.remainingMovement ?? speed)
    : speed
  const distToTile = character?.currentTile
    ? (map?.tileStyle === 'square' ? squareDistance(character.currentTile, { q, r }) : hexDistance(character.currentTile, { q, r }))
    : 0
  const inRange = turnMode === 'party' || distToTile <= remainingMovement

  // Visible events for this player
  const visibleEvents = (tile.events || []).filter(ev => {
    if (ev.visibility === 'none') return false
    if (ev.visibility === 'traits' && ev.requiredTraits?.length) {
      const charTraits = character?.traits || []
      return ev.requiredTraits.some(t => charTraits.includes(t))
    }
    return true
  })

  // Visible containers on this tile
  const visibleContainers = Object.values(campaign?.containers || {})
    .filter(c => c.mapId === mapId && c.tileKey === tileKey && c.discovered)

  function handleFireEvent(ev) {
    // Send to server — server will handle storyboard resolution via organizer
    send({ type: 'PLAYER_FIRE_EVENT', tileKey, eventId: ev.id })
  }

  const [firedEvent, setFiredEvent] = useState(null)  // feedback
  const [pendingEvent, setPendingEvent] = useState(null) // confirmation

  function handleFireWithFeedback(ev) {
    setPendingEvent(ev)
  }

  function confirmFire() {
    if (!pendingEvent) return
    const ev = pendingEvent
    setPendingEvent(null)
    handleFireEvent(ev)
    setFiredEvent(ev.name || 'Event')
    setTimeout(() => setFiredEvent(null), 3000)
  }

  return (
    <div className={styles.tileInfo}>
      {/* Header */}
      <div className={styles.tileInfoHeader}>
        <span>{biome.icon} {tile.label || biome.name}</span>
        <span className={styles.tileCoords}>({q}, {r})</span>
      </div>

      {/* Move here button */}
      {(isMyTurn || turnMode === 'party') && !isMyTile && (
        inRange
          ? <button className={styles.moveHereBtn}
              onClick={() => onMove(tileKey)}>
              🚶 Move here {turnMode === 'turn' && character?.currentTile ? `(${distToTile} tiles, ${remainingMovement} remaining)` : ''}
            </button>
          : <div className={styles.outOfRange}>
              🚫 Out of movement ({distToTile} needed, {remainingMovement} remaining)
            </div>
      )}

      {/* Can interact? Requires: on your tile + (your turn or party mode) */}
      {(() => {
        const canAct = isMyTile && (isMyTurn || turnMode === 'party')
        const notYourTile = !isMyTile
        const notYourTurn = isMyTile && !isMyTurn && turnMode === 'turn'
        const orgMode = turnMode === 'organizer'

        return <>
          {/* Event confirmation dialog */}
      {pendingEvent && (
        <div className={styles.eventConfirmDialog}>
          <div className={styles.eventConfirmTitle}>Trigger event?</div>
          <div className={styles.eventConfirmName}>{pendingEvent.name}</div>
          {pendingEvent.description && (
            <div className={styles.eventConfirmDesc}>{pendingEvent.description}</div>
          )}
          {pendingEvent.steps?.length > 0 && (
            <div className={styles.eventConfirmSteps}>
              {pendingEvent.steps.map((s, i) => {
                const icons = { storyboard:'🎬', fire:'🔥', flood:'🌊', collapse:'⛰', portal:'🌀', reveal:'👁', message:'💬' }
                const labels = { storyboard:'Storyboard', fire:'Fire', flood:'Flood', collapse:'Collapse', portal:'Portal', reveal:'Reveal', message:'Message' }
                return (
                  <span key={i} className={styles.eventConfirmStep}>
                    {icons[s.type] || '⚡'} {labels[s.type] || s.type}
                  </span>
                )
              })}
            </div>
          )}
          <div className={styles.eventConfirmBtns}>
            <button className={styles.eventConfirmCancel} onClick={() => setPendingEvent(null)}>Cancel</button>
            <button className={styles.eventConfirmFire} onClick={confirmFire}>⚡ Trigger</button>
          </div>
        </div>
      )}

      {/* Event fired feedback */}
          {firedEvent && (
            <div className={styles.eventFeedback}>
              ⚡ {firedEvent}
            </div>
          )}

          {/* Not your turn message */}
          {(notYourTurn || orgMode) && isMyTile && (visibleEvents.length > 0 || visibleContainers.length > 0) && (
            <div className={styles.waitingMsg}>
              {orgMode ? '🎲 Organizer mode — no active turns' : '⏳ Wait for your turn to interact'}
            </div>
          )}

          {/* Events */}
          {visibleEvents.length > 0 && (
            <div className={styles.tileSectionLabel}>
              Events {notYourTile && '(move here to interact)'}
            </div>
          )}
          {visibleEvents.map(ev => {
            const STEP_COLORS = { storyboard:'#c8709a', fire:'#c25a4a', flood:'#2a5a8a', collapse:'#6a6a6a', portal:'#7a5ab5', reveal:'#c8a96e', message:'#7bc47f' }
            const firstStep = ev.steps?.[0]
            const color = firstStep ? (STEP_COLORS[firstStep.type] || '#7bc47f') : '#7bc47f'
            const icons = (ev.steps || []).map(s => ({ storyboard:'🎬',fire:'🔥',flood:'🌊',collapse:'⛰',portal:'🌀',reveal:'👁',message:'💬' })[s.type] || '⚡').join(' ')
            return (
              <div key={ev.id} className={styles.playerEventCard}
                style={{ borderLeftColor: color, opacity: (notYourTile || !canAct) ? 0.55 : 1 }}>
                <span style={{ fontSize:14 }}>{icons || '⚡'}</span>
                <div className={styles.playerEventInfo}>
                  <div className={styles.playerEventName}>{ev.name || 'Event'}</div>
                  {ev.description && <div className={styles.playerEventDesc}>{ev.description}</div>}
                </div>
                {canAct && (
                  <button className={styles.playerEventBtn} style={{ background: color }}
                    onClick={() => handleFireWithFeedback(ev)}>
                    Trigger
                  </button>
                )}
              </div>
            )
          })}

          {/* Containers */}
          {visibleContainers.length > 0 && (
            <div className={styles.tileSectionLabel}>
              Containers {notYourTile && '(move here to open)'}
            </div>
          )}
          {visibleContainers.map(container => (
            <PlayerContainerPanel key={container.id} container={container} campaign={campaign} character={character} canInteract={canAct} send={send} />
          ))}
        </>
      })()}

      {/* Annotation */}
      <AnnotationEditor
        campaignId={campaignId}
        mapId={mapId}
        q={q}
        r={r}
        current={annotations[tileKey]}
        onChange={onAnnotationChange}
      />
    </div>
  )
}

// ── Player Container Panel ─────────────────────────────────────
function PlayerContainerPanel({ container, campaign, character, canInteract = true, send }) {
  const [open, setOpen] = useState(false)

  const items = container.items || []
  const containerItems = items.map(ci => ({
    ...ci,
    template: campaign?.items?.[ci.templateId],
  })).filter(ci => ci.template)

  function takeItem(itemId) {
    if (!character || !send) return
    send({ type: 'PLAYER_TAKE_ITEM', containerId: container.id, itemId, characterId: character.id })
  }

  const RARITY_COLORS = { common:'#9a9790', uncommon:'#7bc47f', rare:'#5b9bd5', epic:'#9b7bc4', legendary:'#c8a96e' }

  return (
    <div className={styles.playerContainer}>
      <div className={styles.playerContainerHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.playerContainerIcon}>{container.type === 'chest' ? '📦' : container.type === 'bag' ? '🎒' : '🗄'}</span>
        <span className={styles.playerContainerName}>{container.name}</span>
        {container.locked && <span className={styles.lockIcon}>🔒</span>}
        <span className={styles.playerContainerCount}>{containerItems.length} item{containerItems.length !== 1 ? 's' : ''}</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className={styles.playerContainerItems}>
          {containerItems.length === 0
            ? <div className={styles.playerContainerEmpty}>Empty</div>
            : containerItems.map(ci => {
              const color = RARITY_COLORS[ci.template?.rarity] || '#9a9790'
              return (
                <div key={ci.id} className={styles.playerContainerItem} style={{ borderLeftColor: color }}>
                  <div className={styles.playerContainerItemInfo}>
                    <span className={styles.playerContainerItemName} style={{ color }}>{ci.template.name}</span>
                    {ci.quantity > 1 && <span className={styles.playerContainerItemQty}>×{ci.quantity}</span>}
                    {ci.template.description && <span className={styles.playerContainerItemDesc}>{ci.template.description}</span>}
                  </div>
                  {canInteract && <button className={styles.takeBtn} onClick={() => takeItem(ci.id)}>Take</button>}
                </div>
              )
            })
          }
        </div>
      )}
    </div>
  )
}

// ── Party view ─────────────────────────────────────────────────
function PlayerPartyView({ campaign, character }) {
  const [detail, setDetail] = useState(null)
  const allChars = Object.values(campaign?.characters || {})
  const players  = allChars.filter(c => c.type === 'player')
  const revealed = allChars.filter(c => c.type !== 'player' && (c.isKey || c.revealedToPlayers))

  function CharCard({ char }) {
    const isMe = char.id === character?.id
    const hp = char.stats?.hp ?? null
    const maxHp = char.stats?.maxHp ?? null
    const pct = maxHp ? Math.min(100, ((hp ?? 0) / maxHp) * 100) : 0
    const hpColor = !maxHp ? '#7bc47f' : pct < 30 ? '#c25a4a' : pct < 60 ? '#c8a96e' : '#7bc47f'
    return (
      <div className={styles.partyCard} onClick={() => setDetail(char)}>
        <div className={styles.partyCardAvatar}>
          {char.portrait
            ? <img src={char.portrait} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : <span style={{ fontSize: 22 }}>{char.emoji || (char.type === 'player' ? '👤' : '🧙')}</span>
          }
        </div>
        <div className={styles.partyCardBody}>
          <div className={styles.partyCardRow}>
            <span className={styles.partyCardName}>{char.name}</span>
            {isMe && <span className={styles.partyMeTag}>you</span>}
            <span className={styles.partyCardType}>{char.type}</span>
          </div>
          {maxHp !== null && (
            <div className={styles.partyHpRow}>
              <div className={styles.partyHpBar}>
                <div className={styles.partyHpFill} style={{ width: `${pct}%`, background: hpColor }} />
              </div>
              <span className={styles.partyHpText}>{hp ?? '?'}/{maxHp}</span>
            </div>
          )}
          {char.publicNotes && (
            <div className={styles.partyPublicNotes}>{char.publicNotes}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.partyView}>
      {players.length > 0 && <>
        <div className={styles.partySectionLabel}>Players</div>
        {players.map(c => <CharCard key={c.id} char={c} />)}
      </>}
      {revealed.length > 0 && <>
        <div className={styles.partySectionLabel}>Revealed</div>
        {revealed.map(c => <CharCard key={c.id} char={c} />)}
      </>}
      {players.length === 0 && revealed.length === 0 && (
        <div className={styles.partyEmpty}>No characters visible yet.</div>
      )}

      {detail && (
        <div className={styles.charDetailOverlay} onClick={() => setDetail(null)}>
          <div className={styles.charDetailSheet} onClick={e => e.stopPropagation()}>
            <button className={styles.charDetailClose} onClick={() => setDetail(null)}>×</button>
            <div className={styles.charDetailAvatar}>
              {detail.portrait
                ? <img src={detail.portrait} alt="" className={styles.charDetailPortraitImg} />
                : <span style={{ fontSize: 48 }}>{detail.emoji || (detail.type === 'player' ? '👤' : '🧙')}</span>
              }
            </div>
            <div className={styles.charDetailName}>{detail.name}</div>
            <div className={styles.charDetailType}>{detail.type}</div>
            {(detail.stats?.hp !== undefined) && (
              <div className={styles.charDetailHpRow}>
                <span className={styles.charDetailHpLabel}>HP</span>
                <span className={styles.charDetailHpVal}>{detail.stats.hp}/{detail.stats.maxHp ?? '?'}</span>
              </div>
            )}
            {detail.description && (
              <div className={styles.charDetailSection}>
                <div className={styles.charDetailSectionLabel}>Description</div>
                <div className={styles.charDetailText}>{detail.description}</div>
              </div>
            )}
            {detail.publicNotes && (
              <div className={styles.charDetailSection}>
                <div className={styles.charDetailSectionLabel}>Notes</div>
                <div className={styles.charDetailText}>{detail.publicNotes}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Notes view ─────────────────────────────────────────────────
const NOTES_KEY = 'tilestories_player_notes'

function PlayerNotesView() {
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]') } catch { return [] }
  })
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)

  function persist(updated) {
    setNotes(updated)
    localStorage.setItem(NOTES_KEY, JSON.stringify(updated))
  }

  function createNote() {
    const note = { id: Math.random().toString(36).slice(2, 9), title: '', text: '', updatedAt: new Date().toISOString() }
    persist([note, ...notes])
    setEditingId(note.id)
  }

  function updateNote(id, field, value) {
    persist(notes.map(n => n.id === id ? { ...n, [field]: value, updatedAt: new Date().toISOString() } : n))
  }

  function deleteNote(id) {
    persist(notes.filter(n => n.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const term = search.trim().toLowerCase()
  const filtered = term
    ? notes.filter(n => n.title.toLowerCase().includes(term) || n.text.toLowerCase().includes(term))
    : notes

  const editing = notes.find(n => n.id === editingId) ?? null

  return (
    <div className={styles.notesView}>
      <div className={styles.notesTopRow}>
        <input
          className={styles.notesSearch}
          placeholder="Search notes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className={styles.newNoteBtn} onClick={createNote}>+ New</button>
      </div>

      {editing && (
        <div className={styles.noteEditor}>
          <div className={styles.noteEditorBar}>
            <input
              className={styles.noteTitleInput}
              placeholder="Title…"
              value={editing.title}
              onChange={e => updateNote(editing.id, 'title', e.target.value)}
              autoFocus
            />
            <button className={styles.noteDoneBtn} onClick={() => setEditingId(null)}>Done</button>
            <button className={styles.noteDeleteBtn} onClick={() => deleteNote(editing.id)} title="Delete note">🗑</button>
          </div>
          <textarea
            className={styles.noteTextarea}
            placeholder="Write your note here…"
            value={editing.text}
            onChange={e => updateNote(editing.id, 'text', e.target.value)}
          />
        </div>
      )}

      <div className={styles.notesList}>
        {filtered.length === 0 && (
          <div className={styles.notesEmpty}>
            {term ? 'No notes match your search.' : 'No notes yet — tap + New to start.'}
          </div>
        )}
        {filtered.map(note => (
          <div
            key={note.id}
            className={`${styles.noteCard} ${note.id === editingId ? styles.noteCardActive : ''}`}
            onClick={() => setEditingId(note.id === editingId ? null : note.id)}
          >
            <div className={styles.noteCardTitle}>{note.title || <em>Untitled</em>}</div>
            {note.text && <div className={styles.noteCardPreview}>{note.text.slice(0, 90)}{note.text.length > 90 ? '…' : ''}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}