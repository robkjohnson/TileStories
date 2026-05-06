import React, { useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { tokenColor, tokenDisplay } from '../CharacterSheet/CharacterSheet'
import { hexToPixel, hexCorners, pixelToHex, gridBounds, HEX_SIZE, squareToPixel, squareCorners, pixelToSquare, squareGridBounds, SQUARE_SIZE } from '../../utils/hexMath'
import { rotateAoePattern } from '../../store/useStore'
import { getTileType } from '../../utils/biomes'
import { shouldShowEventDot, shouldShowOverlay } from '../../utils/visibility'
import { loadImage } from '../../utils/imageStorage'
import { getAllAnnotationsForMap, PIN_COLORS } from '../../utils/playerAnnotations'

export default function HexGrid() {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const hoveredTile = useRef(null)
  const dragging = useRef(false)
  const dragOrigin = useRef(null)
  const painting = useRef(false)
  const portraitCache = useRef({})
  const dropTargetHex = useRef(null)
  const pendingSelect = useRef(undefined)   // undefined = no pending; null/{q,r} = has pending
  const mouseDownPos = useRef(null)

  const store = useStore()
  const storeRef = useRef(store)
  storeRef.current = store

  // ── Draw ──────────────────────────────────────────────────────
  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    if (!W || !H) return

    const { campaign, camera, showGrid, showCoords, showAllLabels, labelSize, statusIconSize, selectedTile, portalPickMode } = storeRef.current

    // Load player annotations for this map (from localStorage)
    const playerAnnotations = campaign
      ? getAllAnnotationsForMap(campaign.id, campaign.activeMapId)
      : {}

    ctx.fillStyle = '#141618'
    ctx.fillRect(0, 0, W, H)

    if (!campaign) return

    const activeMap = campaign.maps[campaign.activeMapId]
    if (!activeMap) return

    const { x: camX, y: camY, zoom } = camera
    const isSquare = activeMap.tileStyle === 'square'
    const BASE_SIZE = isSquare ? SQUARE_SIZE : HEX_SIZE
    const sz = BASE_SIZE * zoom
    const tileR = isSquare ? sz / 2 : sz

    const pendingLabels = []

    for (let q = 0; q < activeMap.cols; q++) {
      for (let r = 0; r < activeMap.rows; r++) {
        const key = `${q},${r}`
        const tile = (activeMap.tiles || {})[key] ?? { biome: activeMap.defaultBiome, label: '', tokens: [], events: [] }
        const biome = getTileType(tile.biome, storeRef.current.campaign?.tileTypes)

        const wp = isSquare ? squareToPixel(q, r, BASE_SIZE) : hexToPixel(q, r, HEX_SIZE)
        const sx = wp.x * zoom + camX
        const sy = wp.y * zoom + camY

        if (sx + tileR < 0 || sx - tileR > W || sy + tileR < 0 || sy - tileR > H) continue

        const pts = isSquare ? squareCorners(sx, sy, sz) : hexCorners(sx, sy, sz)
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.closePath()

        ctx.fillStyle = biome.color
        ctx.fill()

        const isSelected = selectedTile?.q === q && selectedTile?.r === r
        const isHovered = hoveredTile.current?.q === q && hoveredTile.current?.r === r

        if (isHovered && !isSelected) {
          ctx.fillStyle = 'rgba(255,255,255,0.12)'
          ctx.fill()
        }

        if (showGrid) {
          ctx.strokeStyle = biome.border
          ctx.lineWidth = 0.75
          ctx.stroke()
        }

        if (isSelected) {
          ctx.strokeStyle = '#c8a96e'
          ctx.lineWidth = 2.5
          ctx.stroke()
          ctx.fillStyle = 'rgba(200,169,110,0.15)'
          ctx.fill()
        }

        // Tile selection mode highlight
        const selMode = storeRef.current.tileSelectionMode
        if (selMode) {
          const isSelSource = storeRef.current.selectedTile?.q === q && storeRef.current.selectedTile?.r === r
          const isInSelection = selMode.tiles.find(t => t.q === q && t.r === r)
          if (isInSelection) {
            ctx.fillStyle = 'rgba(200,169,110,0.35)'
            ctx.beginPath()
            ctx.moveTo(pts[0].x, pts[0].y)
            for (let si = 1; si < pts.length; si++) ctx.lineTo(pts[si].x, pts[si].y)
            ctx.closePath()
            ctx.fill()
            ctx.strokeStyle = '#c8a96e'
            ctx.lineWidth = 2
            ctx.stroke()
          }
        }

        // Fired event overlay — check viewer can see it
        const activeMapData = storeRef.current.campaign?.maps[storeRef.current.campaign?.activeMapId]
        const overlay = (activeMapData?.firedEvents || {})[key]
        if (overlay && shouldShowOverlay(overlay, storeRef.current.viewerMode, storeRef.current.viewerTraits)) {
          ctx.fillStyle = overlay.color + '55'
          ctx.beginPath()
          ctx.moveTo(pts[0].x, pts[0].y)
          for (let oi = 1; oi < pts.length; oi++) ctx.lineTo(pts[oi].x, pts[oi].y)
          ctx.closePath()
          ctx.fill()
          // Pulsing border
          ctx.strokeStyle = overlay.color
          ctx.lineWidth = 2
          ctx.stroke()
          // Label
          if (tileR > 20) {
            ctx.fillStyle = overlay.color
            ctx.font = `600 ${Math.max(7, tileR * 0.18)}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(overlay.label || overlay.type, sx, sy - tileR * 0.55)
          }
        }

        if (showCoords && tileR > 22) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)'
          ctx.font = `${Math.max(8, tileR * 0.2)}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(`${q},${r}`, sx, sy)
        }

        // Label drawn after tokens — see below

        // Player annotation pin
        const annotation = playerAnnotations[key]
        if (annotation && tileR > 14) {
          const pinColors = { red: '#c25a4a', gold: '#c8a96e', blue: '#5b9bd5', green: '#7bc47f', purple: '#9b7bc4', white: '#e8e6e1' }
          const pinColor = pinColors[annotation.color] || '#c8a96e'
          const pinSize = Math.max(8, tileR * 0.22)
          const pinX = sx
          const pinY = sy - tileR * 0.6 - pinSize

          // Pin body (teardrop: circle + triangle)
          ctx.fillStyle = pinColor
          ctx.beginPath()
          ctx.arc(pinX, pinY - pinSize * 0.3, pinSize * 0.6, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(pinX - pinSize * 0.3, pinY - pinSize * 0.3)
          ctx.lineTo(pinX + pinSize * 0.3, pinY - pinSize * 0.3)
          ctx.lineTo(pinX, pinY + pinSize * 0.5)
          ctx.closePath()
          ctx.fill()

          // Inner dot
          ctx.fillStyle = 'rgba(0,0,0,0.35)'
          ctx.beginPath()
          ctx.arc(pinX, pinY - pinSize * 0.3, pinSize * 0.25, 0, Math.PI * 2)
          ctx.fill()

          // Annotation label
          if (annotation.label && tileR > 24) {
            const fontSize = Math.max(8, Math.min(10, tileR * 0.18))
            ctx.font = `500 ${fontSize}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            const labelY = pinY + pinSize * 0.6
            const textW = ctx.measureText(annotation.label).width
            ctx.fillStyle = 'rgba(0,0,0,0.6)'
            ctx.fillRect(pinX - textW / 2 - 3, labelY - 1, textW + 6, fontSize + 4)
            ctx.fillStyle = pinColor
            ctx.fillText(annotation.label, pinX, labelY + 1)
          }
        }

        // ── Token rendering ───────────────────────────────────────
        // Tier 1: player characters + key NPCs → full emoji token + name
        // Tier 2: other NPCs/creatures → colored dot (organizer only, unless revealed)
        // Labels always drawn AFTER tokens so they sit on top
        const tokenIds = tile.tokens || []
        if (tokenIds.length > 0 && tileR > 12) {
          const characters = storeRef.current.campaign?.actors || {}
          const isOrganizer = storeRef.current.viewerMode !== 'player'

          // Separate tokens into tiers
          const fullTokens = [] // player type OR isKey OR revealedToPlayers
          const dotTokens  = [] // everything else (organizer sees dot, players see nothing)

          tokenIds.forEach(charId => {
            const char = characters[charId]
            if (!char) return
            const isPlayer   = char.actorType === 'player'
            const isKey      = char.isKey
            const isRevealed = char.revealedToPlayers
            if (isPlayer || isKey || isRevealed) {
              fullTokens.push(char)
            } else if (isOrganizer) {
              // Only organizer sees non-revealed non-key tokens (as dots)
              dotTokens.push(char)
            }
          })

          // --- Draw full tokens ---
          const tokenR = Math.max(7, tileR * 0.24)
          // Position tokens in lower half of tile so label at center stays clear
          const tokenBaseY = sy + tileR * 0.28

          const count = fullTokens.length
          const fullOffsets = count === 0 ? []
            : count === 1 ? [{ x: 0, y: 0 }]
            : count === 2 ? [{ x: -tokenR * 1.1, y: 0 }, { x: tokenR * 1.1, y: 0 }]
            : [{ x: 0, y: -tokenR * 0.9 }, { x: -tokenR * 1.1, y: tokenR * 0.7 }, { x: tokenR * 1.1, y: tokenR * 0.7 }]

          fullTokens.slice(0, 3).forEach((char, ti) => {
            const off = fullOffsets[ti] || { x: 0, y: 0 }
            const tx = sx + off.x
            const ty = tokenBaseY + off.y

            const tc   = tokenColor(char)
            const ring = tc.ring
            const bg   = tc.bg

            // Key NPC gets a gold ring
            const ringColor = char.isKey ? '#c8a96e' : ring

            ctx.beginPath()
            ctx.arc(tx, ty, tokenR, 0, Math.PI * 2)
            ctx.fillStyle = bg
            ctx.fill()
            ctx.strokeStyle = ringColor
            ctx.lineWidth = char.actorType === 'player' ? Math.max(2, tokenR * 0.2) : Math.max(1.5, tokenR * 0.15)
            ctx.stroke()

            if (tileR > 20) {
              if (char.portrait) {
                const cache = portraitCache.current
                const resolved = cache[char.portrait]
                if (resolved) {
                  const img = new Image()
                  img.src = resolved
                  if (img.complete && img.naturalWidth > 0) {
                    ctx.save()
                    ctx.beginPath()
                    ctx.arc(tx, ty, tokenR - 1, 0, Math.PI * 2)
                    ctx.clip()
                    const d = (tokenR - 1) * 2
                    ctx.drawImage(img, tx - tokenR + 1, ty - tokenR + 1, d, d)
                    ctx.restore()
                  } else { img.onload = () => draw() }
                } else if (!cache['_loading_' + char.portrait]) {
                  cache['_loading_' + char.portrait] = true
                  loadImage(char.portrait).then(url => {
                    if (url) { cache[char.portrait] = url; draw() }
                  })
                  ctx.font = `600 ${Math.max(7, tokenR * 0.7)}px sans-serif`
                  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
                  ctx.fillStyle = ringColor
                  ctx.fillText((char.name || '?')[0].toUpperCase(), tx, ty)
                } else {
                  ctx.font = `600 ${Math.max(7, tokenR * 0.7)}px sans-serif`
                  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
                  ctx.fillStyle = ringColor
                  ctx.fillText((char.name || '?')[0].toUpperCase(), tx, ty)
                }
              } else {
                ctx.font = `${tokenR * 1.05}px sans-serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillText(tokenDisplay(char), tx, ty + tokenR * 0.05)
              }
            }

            // Name label below token (players always get name)
            if (tileR > 28 && (char.actorType === 'player' || char.isKey)) {
              const nameY = ty + tokenR + 2
              const nameFontSize = Math.max(7, Math.min(10, tileR * 0.17))
              ctx.font = `600 ${nameFontSize}px sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              const nw = ctx.measureText(char.name).width
              ctx.fillStyle = 'rgba(0,0,0,0.65)'
              ctx.fillRect(tx - nw/2 - 3, nameY, nw + 6, nameFontSize + 3)
              ctx.fillStyle = char.actorType === 'player' ? '#5b9bd5' : '#c8a96e'
              ctx.fillText(char.name, tx, nameY + 1)
            }
          })

          // Overflow badge for full tokens
          if (fullTokens.length > 3) {
            ctx.beginPath()
            ctx.arc(sx + tileR * 0.4, tokenBaseY - tileR * 0.3, Math.max(5, tileR * 0.13), 0, Math.PI * 2)
            ctx.fillStyle = '#c8a96e'
            ctx.fill()
            ctx.font = `700 ${Math.max(6, tileR * 0.12)}px sans-serif`
            ctx.fillStyle = '#1a1a1a'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(`+${fullTokens.length - 3}`, sx + tileR * 0.4, tokenBaseY - tileR * 0.3)
          }

          // --- Draw dot tokens (organizer only) ---
          if (dotTokens.length > 0 && tileR > 10) {
            const dotR = Math.max(4, tileR * 0.1)
            // Single dot in lower-right corner of tile
            const dotX = sx + tileR * 0.5
            const dotY = sy + tileR * 0.5

            // Color by dominant type
            const hasMonster = dotTokens.some(c => c.actorType === 'monster')
            const dotColor = hasMonster ? '#c25a4a' : '#c8a96e'

            ctx.beginPath()
            ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
            ctx.fillStyle = dotColor
            ctx.fill()
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'
            ctx.lineWidth = 1
            ctx.stroke()

            // Count badge if more than 1
            if (dotTokens.length > 1 && tileR > 20) {
              ctx.font = `700 ${Math.max(6, dotR * 1.1)}px sans-serif`
              ctx.fillStyle = '#fff'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(dotTokens.length, dotX, dotY)
            }
          }
        }

        // Container token — show chest/bag icon if any containers are on this tile
        const mapContainers = Object.values(storeRef.current.campaign?.containers || {})
          .filter(c => c.mapId === storeRef.current.campaign?.activeMapId &&
                       c.tileKey === key &&
                       c.discovered)
        if (mapContainers.length > 0 && tileR > 14) {
          const containerTypeEmojis = { chest: '📦', bag: '👜', barrel: '🪣', crate: '📫', pouch: '💰', altar: '🏛️', hidden: '🕳️' }
          const c = mapContainers[0]
          const emoji = containerTypeEmojis[c.type] || '📦'
          const pinSize = Math.max(8, tileR * 0.22)
          const cx2 = sx + tileR * 0.3
          const cy2 = sy + tileR * 0.5

          // Background circle
          ctx.beginPath()
          ctx.arc(cx2, cy2, pinSize * 0.75, 0, Math.PI * 2)
          ctx.fillStyle = '#8a7060'
          ctx.fill()
          ctx.strokeStyle = '#c8a96e'
          ctx.lineWidth = 1.5
          ctx.stroke()

          // Emoji
          ctx.font = `${pinSize * 0.9}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(emoji, cx2, cy2 + pinSize * 0.05)

          // Count badge
          if (mapContainers.length > 1) {
            ctx.fillStyle = '#c8a96e'
            ctx.beginPath()
            ctx.arc(cx2 + pinSize * 0.6, cy2 - pinSize * 0.6, Math.max(4, pinSize * 0.4), 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#1a1a1a'
            ctx.font = `600 ${Math.max(6, pinSize * 0.35)}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(mapContainers.length, cx2 + pinSize * 0.6, cy2 - pinSize * 0.6)
          }
        }

        // Status icons — small emoji cluster at top-right of tile
        const tileStatuses = tile.activeStatuses || []
        if (tileStatuses.length > 0 && tileR > 10) {
          const sis = statusIconSize ?? 1
          const iconSize = Math.max(7, tileR * 0.2 * sis)
          ctx.font = `${iconSize}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const count = Math.min(tileStatuses.length, 3)
          const startX = sx + tileR * 0.55 - (count - 1) * iconSize * 0.55
          const iconY = sy - tileR * 0.62
          tileStatuses.slice(0, 3).forEach((s, i) => {
            const status = campaign?.statuses?.[s.statusId]
            if (status?.icon) ctx.fillText(status.icon, startX + i * iconSize * 1.1, iconY)
          })
          if (tileStatuses.length > 3) {
            ctx.font = `600 ${Math.max(6, iconSize * 0.7)}px sans-serif`
            ctx.fillStyle = 'rgba(200,169,110,0.9)'
            ctx.fillText(`+${tileStatuses.length - 3}`, startX + 3 * iconSize * 1.1, iconY)
          }
        }

        // Event dot — only show if viewer can see at least one event on this tile
        const { viewerMode, viewerTraits } = storeRef.current
        if (shouldShowEventDot(tile, viewerMode, viewerTraits)) {
          ctx.fillStyle = '#c25a4a'
          ctx.beginPath()
          ctx.arc(sx - tileR * 0.38, sy - tileR * 0.38, Math.max(3, tileR * 0.1), 0, Math.PI * 2)
          ctx.fill()
        }

        // Collect label for second pass so it renders above all tile bodies
        if (tile.label && (tile.showLabel || showAllLabels) && tileR > 18) {
          pendingLabels.push({ sx, sy, label: tile.label, textColor: biome.textColor })
        }
      }
    }

    // ── Second pass: draw all labels above every tile ─────────────
    for (const { sx, sy, label, textColor } of pendingLabels) {
      const fontSize = Math.min(11 * labelSize, tileR * 0.2 * labelSize)
      ctx.font = `500 ${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const textW = ctx.measureText(label).width
      const padX = 4, padY = 2
      const pillX = sx - textW / 2 - padX
      const pillY = sy - tileR * 0.62
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.fillRect(pillX, pillY, textW + padX * 2, fontSize + padY * 2)
      ctx.fillStyle = textColor
      ctx.fillText(label, sx, pillY + padY)
    }

    // Effect mode — highlight selected tiles and AoE preview
    const { effectMode } = storeRef.current
    if (effectMode) {
      const effect = storeRef.current.campaign?.effects?.[effectMode.effectId]
      const { selectedTiles } = effectMode

      for (const { q: eq, r: er } of selectedTiles) {
        const ewp = isSquare ? squareToPixel(eq, er, BASE_SIZE) : hexToPixel(eq, er, HEX_SIZE)
        const esx = ewp.x * zoom + camX
        const esy = ewp.y * zoom + camY
        const ePts = isSquare ? squareCorners(esx, esy, sz) : hexCorners(esx, esy, sz)
        ctx.beginPath()
        ctx.moveTo(ePts[0].x, ePts[0].y)
        for (let i = 1; i < ePts.length; i++) ctx.lineTo(ePts[i].x, ePts[i].y)
        ctx.closePath()
        ctx.fillStyle = 'rgba(91,155,213,0.30)'
        ctx.fill()
        ctx.strokeStyle = '#5b9bd5'
        ctx.lineWidth = 2.5
        ctx.stroke()
      }

      if (effect?.targetType === 'tile_aoe' && selectedTiles.length > 0 && effect.aoePattern?.length > 0) {
        const root = selectedTiles[0]
        const rotated = rotateAoePattern(effect.aoePattern, effectMode.aoeRotation || 0, isSquare)
        for (const { dq, dr } of rotated) {
          const pq = root.q + dq
          const pr = root.r + dr
          if (pq < 0 || pr < 0 || pq >= activeMap.cols || pr >= activeMap.rows) continue
          const pwp = isSquare ? squareToPixel(pq, pr, BASE_SIZE) : hexToPixel(pq, pr, HEX_SIZE)
          const psx = pwp.x * zoom + camX
          const psy = pwp.y * zoom + camY
          const pPts = isSquare ? squareCorners(psx, psy, sz) : hexCorners(psx, psy, sz)
          ctx.beginPath()
          ctx.moveTo(pPts[0].x, pPts[0].y)
          for (let i = 1; i < pPts.length; i++) ctx.lineTo(pPts[i].x, pPts[i].y)
          ctx.closePath()
          ctx.fillStyle = 'rgba(91,155,213,0.18)'
          ctx.fill()
          ctx.strokeStyle = '#5b9bd5'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
    }

    // Drop-target highlight — drawn while a roster card is being dragged over a tile
    const dt = dropTargetHex.current
    if (dt) {
      const dtWp = isSquare ? squareToPixel(dt.q, dt.r, BASE_SIZE) : hexToPixel(dt.q, dt.r, HEX_SIZE)
      const dtSx = dtWp.x * zoom + camX
      const dtSy = dtWp.y * zoom + camY
      const dtPts = isSquare ? squareCorners(dtSx, dtSy, sz) : hexCorners(dtSx, dtSy, sz)
      ctx.beginPath()
      ctx.moveTo(dtPts[0].x, dtPts[0].y)
      for (let i = 1; i < dtPts.length; i++) ctx.lineTo(dtPts[i].x, dtPts[i].y)
      ctx.closePath()
      ctx.fillStyle = 'rgba(123, 196, 127, 0.25)'
      ctx.fill()
      ctx.strokeStyle = '#7bc47f'
      ctx.lineWidth = 3
      ctx.stroke()
    }
  }

  // ── Fit map to canvas ─────────────────────────────────────────
  function fitMap() {
    const canvas = canvasRef.current
    const { campaign, setCamera } = storeRef.current
    if (!canvas || !campaign) return
    const W = canvas.width, H = canvas.height
    if (!W || !H) return
    const activeMap = campaign.maps[campaign.activeMapId]
    if (!activeMap) return
    const isSquare = activeMap.tileStyle === 'square'
    const bounds = isSquare
      ? squareGridBounds(activeMap.cols, activeMap.rows, SQUARE_SIZE)
      : gridBounds(activeMap.cols, activeMap.rows, HEX_SIZE)
    const pad = 60
    const zoom = Math.min((W - pad * 2) / bounds.width, (H - pad * 2) / bounds.height, 2.5)
    setCamera({
      zoom,
      x: (W - bounds.width * zoom) / 2 - bounds.minX * zoom,
      y: (H - bounds.height * zoom) / 2 - bounds.minY * zoom,
    })
  }

  // ── Mount: size canvas, fit, wire non-passive wheel ───────────
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    function resize() {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      fitMap()
      draw()
    }

    function onWheel(e) {
      e.preventDefault()
      const { camera, setCamera } = storeRef.current
      const factor = e.deltaY < 0 ? 1.12 : 0.89
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const newZoom = Math.min(6, Math.max(0.12, camera.zoom * factor))
      setCamera({
        zoom: newZoom,
        x: mx - (mx - camera.x) * (newZoom / camera.zoom),
        y: my - (my - camera.y) * (newZoom / camera.zoom),
      })
    }

    function onTouchStart(e) {
      if (e.touches.length === 1) {
        const { camera } = storeRef.current
        dragging.current = true
        dragOrigin.current = { x: e.touches[0].clientX - camera.x, y: e.touches[0].clientY - camera.y }
      }
    }

    function onTouchMove(e) {
      if (dragging.current && dragOrigin.current && e.touches.length === 1) {
        e.preventDefault()
        const { updateCamera } = storeRef.current
        updateCamera({ x: e.touches[0].clientX - dragOrigin.current.x, y: e.touches[0].clientY - dragOrigin.current.y })
      }
    }

    function onTouchEnd() {
      dragging.current = false
      dragOrigin.current = null
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    return () => {
      ro.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, []) // eslint-disable-line

  // Re-fit when active map changes
  useEffect(() => {
    fitMap()
    draw()
  }, [store.campaign?.activeMapId]) // eslint-disable-line

  // Redraw on every store change
  useEffect(() => { draw() })

  // ── Hex hit test ──────────────────────────────────────────────
  function getHex(clientX, clientY) {
    const canvas = canvasRef.current
    const { campaign, camera } = storeRef.current
    if (!canvas || !campaign) return null
    const activeMap = campaign.maps[campaign.activeMapId]
    if (!activeMap) return null
    const rect = canvas.getBoundingClientRect()
    const wx = (clientX - rect.left - camera.x) / camera.zoom
    const wy = (clientY - rect.top - camera.y) / camera.zoom
    const { q, r } = activeMap.tileStyle === 'square' ? pixelToSquare(wx, wy) : pixelToHex(wx, wy)
    if (q >= 0 && q < activeMap.cols && r >= 0 && r < activeMap.rows) return { q, r }
    return null
  }

  // ── Mouse handlers ────────────────────────────────────────────
  function onMouseDown(e) {
    const { tool, camera, setSelectedTile, setInspectorOpen, activeBiome, setTileBiome, eraseTile, tileSelectionMode, toggleSelectedTile, portalPickMode, endPortalPick, setActiveMap } = storeRef.current
    if (e.button === 2 || e.button === 1 || e.altKey) {
      dragging.current = true
      dragOrigin.current = { x: e.clientX - camera.x, y: e.clientY - camera.y }
      return
    }
    if (e.button !== 0) return
    const hex = getHex(e.clientX, e.clientY)

    // Effect mode — clicks target tiles
    const { effectMode, setEffectRootTile, toggleEffectTile } = storeRef.current
    if (effectMode) {
      if (hex) {
        const effect = storeRef.current.campaign?.effects?.[effectMode.effectId]
        if (effect?.targetType === 'tile_select') {
          toggleEffectTile(hex.q, hex.r)
        } else if (effect?.targetType === 'single_tile' || effect?.targetType === 'tile_aoe') {
          setEffectRootTile(hex.q, hex.r)
        }
      }
      return
    }

    // Portal pick mode — capture tile, switch back to origin map, do NOT select tile normally
    if (portalPickMode) {
      if (hex) {
        portalPickMode.onPick({ q: hex.q, r: hex.r })
        endPortalPick()
        setActiveMap(portalPickMode.originMapId)
      }
      return
    }

    // Tile selection mode — clicks toggle tiles
    if (tileSelectionMode) {
      if (hex) toggleSelectedTile(hex.q, hex.r)
      return
    }

    if (tool === 'select') {
      // Defer selection to mouseup so left-drag can pan instead
      mouseDownPos.current = { x: e.clientX, y: e.clientY }
      pendingSelect.current = hex
      dragOrigin.current = { x: e.clientX - camera.x, y: e.clientY - camera.y }
    } else {
      painting.current = true
      if (hex) {
        if (tool === 'paint') setTileBiome(hex.q, hex.r, activeBiome)
        if (tool === 'erase') eraseTile(hex.q, hex.r)
      }
    }
  }

  function onMouseMove(e) {
    const { updateCamera, tool, activeBiome, setTileBiome, eraseTile } = storeRef.current
    // Promote left-click hold into a pan once past movement threshold
    if (!dragging.current && mouseDownPos.current && e.buttons === 1) {
      const dx = e.clientX - mouseDownPos.current.x
      const dy = e.clientY - mouseDownPos.current.y
      if (Math.hypot(dx, dy) > 4) {
        dragging.current = true
        pendingSelect.current = undefined
      }
    }
    if (dragging.current && dragOrigin.current) {
      updateCamera({ x: e.clientX - dragOrigin.current.x, y: e.clientY - dragOrigin.current.y })
      return
    }
    const hex = getHex(e.clientX, e.clientY)
    hoveredTile.current = hex
    if (painting.current && hex) {
      if (tool === 'paint') setTileBiome(hex.q, hex.r, activeBiome)
      if (tool === 'erase') eraseTile(hex.q, hex.r)
    }
    draw()
    const el = document.getElementById('hex-coords')
    if (el) el.textContent = hex ? `${hex.q}, ${hex.r}` : '—'
  }

  function onMouseUp() {
    if (!dragging.current && pendingSelect.current !== undefined) {
      const { setSelectedTile, setInspectorOpen } = storeRef.current
      setSelectedTile(pendingSelect.current)
      if (pendingSelect.current) setInspectorOpen(true)
    }
    pendingSelect.current = undefined
    mouseDownPos.current = null
    dragging.current = false
    painting.current = false
    dragOrigin.current = null
  }

  function onMouseLeave() {
    hoveredTile.current = null
    dragging.current = false
    painting.current = false
    pendingSelect.current = undefined
    mouseDownPos.current = null
    draw()
    const el = document.getElementById('hex-coords')
    if (el) el.textContent = '—'
  }

  function onDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const hex = getHex(e.clientX, e.clientY)
    const prev = dropTargetHex.current
    // Only redraw when the highlighted tile actually changes
    if (hex?.q !== prev?.q || hex?.r !== prev?.r) {
      dropTargetHex.current = hex
      draw()
    }
  }

  function onDragLeave() {
    dropTargetHex.current = null
    draw()
  }

  function onDrop(e) {
    e.preventDefault()
    dropTargetHex.current = null
    const raw = e.dataTransfer.getData('application/tilestories-entity')
    if (raw) {
      try {
        const { id } = JSON.parse(raw)
        const hex = getHex(e.clientX, e.clientY)
        if (hex) {
          const { campaign, placeToken } = storeRef.current
          placeToken(id, hex.q, hex.r, campaign.activeMapId)
        }
      } catch (_) {}
    }
    draw()
  }

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: '#141618' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor: store.effectMode ? 'crosshair' : store.portalPickMode ? 'crosshair' : store.tileSelectionMode ? 'cell' : store.tool === 'select' ? 'grab' : 'crosshair' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onContextMenu={e => e.preventDefault()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />
    </div>
  )
}