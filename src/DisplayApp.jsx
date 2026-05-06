import React, { useState, useRef, useEffect, useCallback } from 'react'
import { tokenColor, tokenDisplay } from './components/CharacterSheet/CharacterSheet'
import useGameSocket from './utils/useGameSocket'
import { hexToPixel, hexCorners, gridBounds, HEX_SIZE, squareToPixel, squareCorners, squareGridBounds, SQUARE_SIZE } from './utils/hexMath'
import { getTileType } from './utils/biomes'
import { loadImage } from './utils/imageStorage'
import { useImage } from './utils/useImage'
import './styles/global.css'
import styles from './DisplayApp.module.css'

// ── Display App ───────────────────────────────────────────────
// A browser window the organizer screenshares. Shows the live
// player map OR a storyboard, controlled by the organizer.

export default function DisplayApp() {
  const [mode, setMode] = useState('connecting')
  const [session, setSession] = useState(null)
  const [campaign, setCampaign] = useState(null)
  const [storyboard, setStoryboard] = useState(null)
  const [tileBgOverlay, setTileBgOverlay] = useState(null) // { q, r, mapId }
  const [diceRolls, setDiceRolls] = useState([])

  const { send, wsRef } = useGameSocket(useCallback((msg) => {
    switch (msg.type) {
      case 'CONNECTED':
        setMode('idle')
        break
      case 'SESSION_STATE':
        setSession(msg.session)
        if (msg.campaign) setCampaign(msg.campaign)
        if (msg.session?.status === 'active' || msg.session?.status === 'paused') {
          setMode(prev => prev === 'storyboard' ? prev : 'map')
        }
        break
      case 'CAMPAIGN_UPDATED':
        if (msg.campaign) setCampaign(msg.campaign)
        break
      case 'DISPLAY_STORYBOARD':
        setStoryboard(msg.storyboard)
        setMode('storyboard')
        setTileBgOverlay(null)
        break
      case 'DISPLAY_MAP':
        setMode('map')
        setStoryboard(null)
        if (msg.mapId) setSession(s => s ? { ...s, activeMapId: msg.mapId } : s)
        break
      case 'SHOW_TILE_BACKGROUND':
        setTileBgOverlay({ q: msg.q, r: msg.r, mapId: msg.mapId })
        break
      case 'HIDE_TILE_BACKGROUND':
        setTileBgOverlay(null)
        break
      case 'DICE_ROLL_BROADCAST':
        setDiceRolls(prev => [msg.roll, ...prev].slice(0, 10))
        break
      case 'DICE_LOG_CLEARED':
        setDiceRolls([])
        break
      case 'DICE_LOG_STATE':
        setDiceRolls(msg.rolls || [])
        break
      case 'SESSION_ENDED':
        setMode('idle')
        setSession(null)
        setCampaign(null)
        setTileBgOverlay(null)
        setDiceRolls([])
        break
    }
  }, []))

  // Register as display client once the socket is open
  useEffect(() => {
    let registered = false
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN && !registered) {
        send({ type: 'JOIN_DISPLAY' })
        registered = true
        clearInterval(interval)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [send, wsRef])

  const activeMapId = session?.activeMapId || campaign?.activeMapId
  const activeMap = campaign?.maps?.[activeMapId]

  return (
    <div className={styles.display} style={{ background: '#0a0a0c', width: '100vw', height: '100vh' }}>

      {/* Idle / connecting */}
      {(mode === 'idle' || mode === 'connecting') && (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, color: 'rgba(255,255,255,0.4)',
          fontFamily: 'sans-serif',
        }}>
          <div style={{ fontSize: 80 }}>⬡</div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            TileStories Display
          </div>
          <div style={{ fontSize: 14 }}>
            {mode === 'connecting' ? 'Connecting to session…' : 'Waiting for organizer to start a session'}
          </div>
        </div>
      )}

      {/* Live map */}
      {mode === 'map' && activeMap && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <DisplayMapView map={activeMap} campaign={campaign} session={session} />
          </div>
          {session && <DisplayTurnSidebar session={session} campaign={campaign} />}
        </div>
      )}

      {/* Storyboard */}
      {mode === 'storyboard' && storyboard && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <StoryboardDisplay storyboard={storyboard} />
        </div>
      )}

      {/* Tile background overlay — sits on top of everything, click to dismiss */}
      {tileBgOverlay && (
        <TileBgOverlay
          overlay={tileBgOverlay}
          campaign={campaign}
          onDismiss={() => setTileBgOverlay(null)}
        />
      )}

      {/* Dice roll log — bottom-left floating panel */}
      {diceRolls.length > 0 && (
        <DiceRollPanel rolls={diceRolls} />
      )}
    </div>
  )
}


// ── Dice roll panel ────────────────────────────────────────────
function DiceRollPanel({ rolls }) {
  const recent = rolls.slice(0, 5)
  return (
    <div style={{
      position: 'absolute', bottom: 20, left: 20, zIndex: 200,
      display: 'flex', flexDirection: 'column-reverse', gap: 6,
      pointerEvents: 'none',
    }}>
      {recent.map((roll, i) => {
        const isSuccess = roll.success === true
        const isFail = roll.success === false
        const borderColor = isSuccess ? '#7bc47f' : isFail ? '#c25a4a' : 'rgba(255,255,255,0.15)'
        const glowColor = isSuccess ? 'rgba(123,196,127,0.25)' : isFail ? 'rgba(194,90,74,0.25)' : 'transparent'
        const isBig = i === 0
        return (
          <div key={roll.id || i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: isBig ? '10px 14px' : '7px 12px',
            borderRadius: 10,
            background: `rgba(10,10,12,0.88)`,
            border: `1.5px solid ${borderColor}`,
            boxShadow: `0 0 12px ${glowColor}`,
            backdropFilter: 'blur(6px)',
            opacity: i === 0 ? 1 : Math.max(0.45, 1 - i * 0.15),
            transition: 'all 0.3s',
          }}>
            {/* Dice face */}
            <div style={{
              width: isBig ? 44 : 34,
              height: isBig ? 44 : 34,
              borderRadius: 8,
              background: borderColor === 'rgba(255,255,255,0.15)' ? 'rgba(255,255,255,0.08)' : glowColor,
              border: `2px solid ${borderColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isBig ? 22 : 17,
              fontWeight: 900,
              color: isSuccess ? '#7bc47f' : isFail ? '#c25a4a' : '#fff',
              flexShrink: 0,
            }}>
              {roll.value}
            </div>
            {/* Label */}
            <div>
              <div style={{ fontSize: isBig ? 14 : 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                {roll.characterName}
              </div>
              {roll.description && (
                <div style={{ fontSize: isBig ? 11 : 9, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', marginTop: 1 }}>
                  {roll.description}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {roll.diceType?.toUpperCase() || 'D20'}
                </span>
                {roll.threshold != null && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                    DC {roll.threshold}
                  </span>
                )}
                {isSuccess && <span style={{ fontSize: 10, fontWeight: 700, color: '#7bc47f' }}>✓ SUCCESS</span>}
                {isFail && <span style={{ fontSize: 10, fontWeight: 700, color: '#c25a4a' }}>✗ FAIL</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tile background overlay ───────────────────────────────────
function TileBgOverlay({ overlay, campaign, onDismiss }) {
  const map = campaign?.maps?.[overlay.mapId]
  const tile = map?.tiles?.[`${overlay.q},${overlay.r}`]
  const tileType = getTileType(tile?.biome || map?.defaultBiome || 'grassland', campaign?.tileTypes)
  const bgImage = tile?.displayBackground || tileType?.displayBackground || null
  const bgColor = tileType?.color || '#1a1a1a'

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'absolute', inset: 0, zIndex: 300,
        background: bgColor,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {bgImage && (
        <img
          src={bgImage}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
        />
      )}
      {/* Tile type name watermark */}
      {tileType && (
        <div style={{
          position: 'absolute', top: 20, left: 20,
          display: 'flex', alignItems: 'center', gap: 10,
          pointerEvents: 'none',
        }}>
          {tileType.icon && <span style={{ fontSize: 32 }}>{tileType.icon}</span>}
          <span style={{ fontSize: 22, fontWeight: 700, color: tileType.textColor || '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.8)', letterSpacing: '0.05em' }}>
            {tileType.name}
          </span>
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 20, right: 24,
        fontSize: 12, color: 'rgba(255,255,255,0.35)',
        pointerEvents: 'none', userSelect: 'none',
      }}>
        Click to dismiss
      </div>
    </div>
  )
}

const _displayPortraitCache = {}

function drawTileTokens(ctx, sx, sy, tileR, tile, characters, isOrganizer) {
  const tokenIds = tile.tokens || []
  if (!tokenIds.length || tileR < 12) return

  const fullTokens = []
  const dotTokens  = []

  tokenIds.forEach(charId => {
    const char = characters[charId]
    if (!char) return
    if (char.actorType === 'player' || char.isKey || char.revealedToPlayers) {
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
    const tc   = tokenColor(char)
    const ring = char.isKey ? '#c8a96e' : tc.ring
    const bg   = tc.bg

    ctx.beginPath()
    ctx.arc(tx, ty, tokenR, 0, Math.PI * 2)
    ctx.fillStyle = bg; ctx.fill()
    ctx.strokeStyle = ring
    ctx.lineWidth = char.actorType === 'player' ? Math.max(2, tokenR * 0.2) : Math.max(1.5, tokenR * 0.15)
    ctx.stroke()

    if (tileR > 20) {
      if (char.portrait) {
        const img = new Image(); img.src = char.portrait
        if (img.complete && img.naturalWidth > 0) {
          ctx.save(); ctx.beginPath(); ctx.arc(tx, ty, tokenR-1, 0, Math.PI*2); ctx.clip()
          ctx.drawImage(img, tx-tokenR+1, ty-tokenR+1, (tokenR-1)*2, (tokenR-1)*2)
          ctx.restore()
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

    if (tileR > 28 && (char.actorType === 'player' || char.isKey)) {
      const nameY = ty + tokenR + 2
      const nfs = Math.max(7, Math.min(10, tileR*0.17))
      ctx.font = `600 ${nfs}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      const nw = ctx.measureText(char.name).width
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillRect(tx - nw/2 - 3, nameY, nw+6, nfs+3)
      ctx.fillStyle = char.actorType === 'player' ? '#5b9bd5' : '#c8a96e'
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
    const dotColor = dotTokens.some(c => c.actorType === 'monster') ? '#c25a4a' : '#c8a96e'
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

// ── Display map view ──────────────────────────────────────────
function DisplayMapView({ map, campaign, session }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 })
  const fittedRef = useRef(null)
  const dragging = useRef(false)
  const dragOrigin = useRef(null)
  const drawRef = useRef(null)

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
    const displayLabelSize = parseFloat(localStorage.getItem('tilestories_displayLabelSize') || '1')

    ctx.fillStyle = '#141618'
    ctx.fillRect(0, 0, W, H)

    const characters = campaign?.actors || {}
    const containers = Object.values(campaign?.containers || {})
      .filter(c => c.mapId === map.id && c.discovered)

    const pendingLabels = []

    for (let q = 0; q < map.cols; q++) {
      for (let r = 0; r < map.rows; r++) {
        const key = `${q},${r}`
        const tile = (map.tiles || {})[key] ?? { biome: map.defaultBiome || 'grassland' }
        const biome = getTileType(tile.biome, campaign?.tileTypes)
        const wp = isSquare ? squareToPixel(q, r, BASE_SIZE) : hexToPixel(q, r, HEX_SIZE)
        const sx = wp.x * zoom + cx
        const sy = wp.y * zoom + cy
        if (sx + tileR < 0 || sx - tileR > W || sy + tileR < 0 || sy - tileR > H) continue

        const pts = isSquare ? squareCorners(sx, sy, sz) : hexCorners(sx, sy, sz)
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.closePath()
        ctx.fillStyle = biome.color
        ctx.fill()
        ctx.strokeStyle = biome.border
        ctx.lineWidth = 0.8
        ctx.stroke()

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
          ctx.lineWidth = 2.5
          ctx.stroke()
        }

        // Tokens — display shows same as players (player/key/revealed only, no organizer dots)
        drawTileTokens(ctx, sx, sy, tileR, tile, characters, false)

        // Collect label for second pass so it renders above all tile bodies
        if (tile.label && tile.showLabel && tileR > 18) {
          pendingLabels.push({ sx, sy, label: tile.label, textColor: biome.textColor })
        }
      }
    }

    // ── Second pass: draw all labels above every tile ─────────────
    for (const { sx, sy, label, textColor } of pendingLabels) {
      const fontSize = Math.min(13 * displayLabelSize, tileR * 0.22 * displayLabelSize)
      ctx.font = `600 ${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const tw = ctx.measureText(label).width
      const padX = 4, padY = 2
      const pillX = sx - tw / 2 - padX
      const pillY = sy - tileR * 0.62
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.fillRect(pillX, pillY, tw + padX * 2, fontSize + padY * 2)
      ctx.fillStyle = textColor
      ctx.fillText(label, sx, pillY + padY)
    }

    // Map name watermark
    ctx.font = '600 14px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(map.name, 14, 14)
  }

  function fitMap(W, H) {
    if (!map || !W || !H) return
    const isSquare = map.tileStyle === 'square'
    const bounds = isSquare
      ? squareGridBounds(map.cols, map.rows, SQUARE_SIZE)
      : gridBounds(map.cols, map.rows, HEX_SIZE)
    const pad = 40
    const zoom = Math.min((W - pad*2) / bounds.width, (H - pad*2) / bounds.height, 3)
    cameraRef.current = {
      zoom,
      x: (W - bounds.width*zoom)/2 - bounds.minX*zoom,
      y: (H - bounds.height*zoom)/2 - bounds.minY*zoom,
    }
    fittedRef.current = map.id
  }

  drawRef.current = draw

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight
      if (fittedRef.current !== map?.id) fitMap(canvas.width, canvas.height)
      drawRef.current()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [map?.id])

  useEffect(() => { draw() })

  function onWheel(e) {
    e.preventDefault()
    const { x, y, zoom } = cameraRef.current
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.12 : 0.89
    const nz = Math.min(8, Math.max(0.1, zoom * factor))
    cameraRef.current = { zoom: nz, x: mx - (mx - x) * (nz / zoom), y: my - (my - y) * (nz / zoom) }
    draw()
  }

  function onMouseDown(e) {
    dragging.current = true
    dragOrigin.current = { x: e.clientX - cameraRef.current.x, y: e.clientY - cameraRef.current.y }
  }

  function onMouseMove(e) {
    if (!dragging.current) return
    cameraRef.current = { ...cameraRef.current, x: e.clientX - dragOrigin.current.x, y: e.clientY - dragOrigin.current.y }
    draw()
  }

  function onMouseUp() { dragging.current = false }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [map?.id])

  // Double-click to reset zoom
  function onDblClick() {
    const canvas = canvasRef.current
    if (!canvas) return
    fittedRef.current = null
    fitMap(canvas.width, canvas.height)
    draw()
  }

  return (
    <div ref={containerRef} className={styles.mapContainer}>
      <canvas ref={canvasRef}
        style={{ display:'block', width:'100%', height:'100%', cursor: dragging.current ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={onDblClick}
      />
      <div style={{ position:'absolute', bottom:12, right:12, display:'flex', gap:6 }}>
        <button onClick={() => { const c = cameraRef.current; const nz = Math.min(8, c.zoom * 1.2); cameraRef.current = { ...c, zoom: nz }; draw() }}
          style={{ width:32, height:32, borderRadius:6, background:'rgba(0,0,0,0.5)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', fontSize:16, cursor:'pointer' }}>+</button>
        <button onClick={() => { const c = cameraRef.current; const nz = Math.max(0.1, c.zoom * 0.8); cameraRef.current = { ...c, zoom: nz }; draw() }}
          style={{ width:32, height:32, borderRadius:6, background:'rgba(0,0,0,0.5)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', fontSize:16, cursor:'pointer' }}>−</button>
        <button onClick={onDblClick}
          style={{ width:32, height:32, borderRadius:6, background:'rgba(0,0,0,0.5)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', fontSize:12, cursor:'pointer' }}>⊡</button>
      </div>
    </div>
  )
}

function ResolvedLayerImg({ src, style }) {
  const resolved = useImage(src)
  if (!resolved) return null
  return <img src={resolved} alt="" draggable={false} style={style} />
}

// ── Storyboard display ────────────────────────────────────────
function StoryboardDisplay({ storyboard: sb }) {
  const CANVAS_W = 1280, CANVAS_H = 720
  const bgSrc = useImage(sb.backgroundImage)

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        position: 'relative',
        width: 'min(100vw, calc(100vh * 16 / 9))',
        height: 'min(100vh, calc(100vw * 9 / 16))',
        containerType: 'size',
        backgroundColor: sb.backgroundColor || '#1a1c1e',
        overflow: 'hidden',
      }}>
        {bgSrc && (
          <img src={bgSrc} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', pointerEvents:'none' }} />
        )}
        {sb.layers?.map(layer => (
          <div key={layer.id} style={{
            position: 'absolute',
            left: `${(layer.x / CANVAS_W) * 100}%`,
            top: `${(layer.y / CANVAS_H) * 100}%`,
            width: `${(layer.width / CANVAS_W) * 100}%`,
            height: `${(layer.height / CANVAS_H) * 100}%`,
            transform: `rotate(${layer.rotation || 0}deg) scaleX(${layer.flipX ? -1 : 1}) scaleY(${layer.flipY ? -1 : 1})`,
            opacity: layer.opacity ?? 1,
            pointerEvents: 'none',
            zIndex: 1,
          }}>
            <ResolvedLayerImg src={layer.src} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
          </div>
        ))}
        {sb.textBlocks?.map(tb => (
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
            zIndex: 2,
          }}>
            {tb.text}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Display turn sidebar ──────────────────────────────────────
function DisplayTurnSidebar({ session, campaign }) {
  const turnMode = session.turnMode || 'organizer'
  const turnOrder = session.turnOrder || []
  const currentIdx = session.currentTurnIndex ?? 0
  const current = turnOrder[currentIdx]

  const MODE_DEF = {
    organizer: { label: 'Organizer Mode', icon: '🎲', color: '#c8a96e', desc: 'Organizer is in control' },
    party:     { label: 'Party Mode',     icon: '🎉', color: '#7bc47f', desc: 'All players act freely' },
    turn:      { label: 'Turn Order',     icon: '⚔️', color: '#c25a4a', desc: current ? `${current.name}'s turn` : 'Awaiting turn' },
  }
  const def = MODE_DEF[turnMode] || MODE_DEF.organizer

  const RING = {
    player:'#5b9bd5', npc:'#7bc47f', monster:'#c25a4a',
    pet:'#7bc47f', wild:'#9a9790', enemy:'#c25a4a', companion:'#5b9bd5', mount:'#c8a96e'
  }

  // Only show sidebar if there's something worth showing
  if (turnMode === 'organizer' && turnOrder.length === 0) return null

  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      background: 'rgba(10,10,12,0.85)',
      backdropFilter: 'blur(8px)',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 0',
      gap: 0,
      overflowY: 'auto',
    }}>
      {/* Mode badge */}
      <div style={{
        margin: '0 12px 12px',
        padding: '10px 12px',
        borderRadius: 8,
        background: def.color + '18',
        border: `1px solid ${def.color}44`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{def.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: def.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {def.label}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{def.desc}</div>
      </div>

      {/* Turn order */}
      {turnOrder.length > 0 && (<>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', padding: '0 12px 6px' }}>
          Turn order
        </div>
        {turnOrder.map((entry, idx) => {
          const ring = RING[entry.type] || '#9a9790'
          const isActive = turnMode === 'turn' && idx === currentIdx
          return (
            <div key={entry.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: isActive ? ring + '20' : 'transparent',
              borderLeft: `3px solid ${isActive ? ring : 'transparent'}`,
              transition: 'all 0.2s',
            }}>
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: ring + '22',
                border: `2px solid ${isActive ? ring : ring + '55'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>
                {entry.emoji || '👤'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: isActive ? 14 : 12,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {entry.name}
                </div>
                {isActive && (
                  <div style={{ fontSize: 10, color: ring, fontWeight: 600 }}>← Active turn</div>
                )}
              </div>
              {isActive && <span style={{ fontSize: 14 }}>👑</span>}
            </div>
          )
        })}
      </>)}
    </div>
  )
}