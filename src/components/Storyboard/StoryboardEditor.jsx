import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useStore, makeStoryboard } from '../../store/useStore'
import styles from './StoryboardEditor.module.css'
import { storeImage, resolveStoryboardImages } from '../../utils/imageStorage'
import { useImage } from '../../utils/useImage'

function ResolvedImg({ src, alt, className, style, draggable }) {
  const resolved = useImage(src)
  if (!resolved) return null
  return <img src={resolved} alt={alt || ''} className={className} style={style} draggable={draggable} />
}

export default function StoryboardEditor() {
  const { campaign, addStoryboard, updateStoryboard, deleteStoryboard } = useStore()
  const [editing, setEditing] = useState(null)

  const storyboards = Object.values(campaign?.storyboards || {})
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const sb = editing ? campaign?.storyboards?.[editing] : null

  function handleCreate() {
    const id = addStoryboard({ name: 'New Storyboard' })
    setEditing(id)
  }

  function handleDelete(id) {
    deleteStoryboard(id)
    if (editing === id) setEditing(null)
  }

  async function handleBroadcast(s) {
    if (window.__tilestoriesSend) {
      const resolved = await resolveStoryboardImages(s)
      window.__tilestoriesSend({ type: 'SHOW_STORYBOARD', storyboard: resolved })
    }
  }

  return (
    <>
      <div className={styles.list}>
        <button className={styles.createBtn} onClick={handleCreate}>+ New storyboard</button>

        {storyboards.length === 0 ? (
          <div className={styles.empty}>No storyboards yet</div>
        ) : storyboards.map(s => (
          <div key={s.id} className={styles.listCard}>
            {s.backgroundImage && (
              <div className={styles.listThumb}>
                <ResolvedImg src={s.backgroundImage} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              </div>
            )}
            <div className={styles.listInfo}>
              <span className={styles.listName}>{s.name}</span>
              <span className={styles.listMeta}>{s.layers?.length || 0} layers</span>
            </div>
            <div className={styles.listActions}>
              <button className={styles.editBtn} onClick={() => setEditing(s.id)}>Edit</button>
              <button className={styles.broadcastBtn} onClick={() => handleBroadcast(s)} title="Show on display">📺</button>
              <button className={styles.deleteBtn} onClick={() => handleDelete(s.id)} title="Delete">🗑</button>
            </div>
          </div>
        ))}
      </div>

      {sb && (
        <div className={styles.modalOverlay}>
          <StoryboardCanvas
            storyboard={sb}
            onUpdate={partial => updateStoryboard(sb.id, partial)}
            onClose={() => setEditing(null)}
            onBroadcast={() => handleBroadcast(sb)}
          />
        </div>
      )}
    </>
  )
}

// ── Canvas editor ─────────────────────────────────────────────
function StoryboardCanvas({ storyboard: sb, onUpdate, onClose, onBroadcast }) {
  const canvasRef = useRef(null)
  const wrapRef   = useRef(null)
  const [selectedLayer, setSelectedLayer] = useState(null)
  const [interaction, setInteraction] = useState(null)
  const [displaySize, setDisplaySize] = useState(null)
  const wasDragging = useRef(false)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const obs = new ResizeObserver(entries => {
      const { width: availW, height: availH } = entries[0].contentRect
      if (availW <= 0 || availH <= 0) return
      const wIfFullHeight = availH * 16 / 9
      if (wIfFullHeight <= availW) {
        setDisplaySize({ w: Math.round(wIfFullHeight), h: Math.round(availH) })
      } else {
        setDisplaySize({ w: Math.round(availW), h: Math.round(availW * 9 / 16) })
      }
    })
    obs.observe(wrap)
    return () => obs.disconnect()
  }, [])

  const CANVAS_W = 1280
  const CANVAS_H = 720

  function updateLayer(id, patch) {
    onUpdate({ layers: sb.layers.map(l => l.id === id ? { ...l, ...patch } : l) })
  }

  function updateTextBlock(id, patch) {
    onUpdate({ textBlocks: (sb.textBlocks || []).map(t => t.id === id ? { ...t, ...patch } : t) })
  }

  function getLayer(layerId, isText) {
    return isText
      ? (sb.textBlocks || []).find(l => l.id === layerId)
      : sb.layers.find(l => l.id === layerId)
  }

  function getScales() {
    const canvas = canvasRef.current
    if (!canvas) return { scaleX: 1, scaleY: 1, rect: { left: 0, top: 0, width: CANVAS_W, height: CANVAS_H } }
    const rect = canvas.getBoundingClientRect()
    return { scaleX: CANVAS_W / rect.width, scaleY: CANVAS_H / rect.height, rect }
  }

  async function addPortraitLayerFromRoster(portrait) {
    const hash = await storeImage(portrait)
    addPortraitLayer(hash)
  }

  function addPortraitLayer(hashOrDataUrl) {
    const id = Math.random().toString(36).slice(2, 9)
    onUpdate({ layers: [...sb.layers, {
      id, type: 'image', src: hashOrDataUrl,
      x: 200, y: 100, width: 300, height: 400,
      rotation: 0, flipX: false, flipY: false, opacity: 1, label: 'Portrait',
    }]})
    setSelectedLayer(id)
  }

  function addTextLayer() {
    const id = Math.random().toString(36).slice(2, 9)
    onUpdate({
      textBlocks: [...(sb.textBlocks || []), {
        id, text: 'Enter text…',
        x: 100, y: 580,
        fontSize: 36, color: '#ffffff',
        bold: false, align: 'left',
        maxWidth: 640, rotation: 0,
      }]
    })
    setSelectedLayer(id)
  }

  function removeLayer(id) {
    onUpdate({ layers: sb.layers.filter(l => l.id !== id) })
    if (selectedLayer === id) setSelectedLayer(null)
  }

  function removeTextBlock(id) {
    onUpdate({ textBlocks: (sb.textBlocks || []).filter(t => t.id !== id) })
    if (selectedLayer === id) setSelectedLayer(null)
  }

  async function handleBgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => { onUpdate({ backgroundImage: await storeImage(ev.target.result) }) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handlePortraitUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => { addPortraitLayer(await storeImage(ev.target.result)) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Interaction handlers ──────────────────────────────────────

  function onLayerMouseDown(e, layerId, isText = false) {
    e.stopPropagation()
    const layer = getLayer(layerId, isText)
    if (!layer) return
    setSelectedLayer(layerId)
    setInteraction({ type: 'drag', layerId, isText, startX: e.clientX, startY: e.clientY, origX: layer.x, origY: layer.y })
  }

  function startResize(e, layerId, handle, isText) {
    const layer = getLayer(layerId, isText)
    if (!layer) return
    setInteraction({
      type: 'resize', layerId, isText, handle,
      startX: e.clientX, startY: e.clientY,
      origX: layer.x, origY: layer.y,
      origW: isText ? (layer.maxWidth || 640) : layer.width,
      origH: isText ? (layer.fontSize || 36) : layer.height,
      origRot: (layer.rotation || 0) * Math.PI / 180,
    })
  }

  function startRotate(e, layerId, isText) {
    const layer = getLayer(layerId, isText)
    if (!layer) return
    const { rect, scaleX, scaleY } = getScales()
    const w = isText ? (layer.maxWidth || 640) : layer.width
    const h = isText ? (layer.fontSize || 36) : layer.height
    const centerX = rect.left + (layer.x + w / 2) / scaleX
    const centerY = rect.top + (layer.y + h / 2) / scaleY
    setInteraction({
      type: 'rotate', layerId, isText, centerX, centerY,
      startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI,
      origRot: layer.rotation || 0,
    })
  }

  function onCanvasMouseMove(e) {
    if (!interaction) return
    const { scaleX, scaleY } = getScales()

    if (interaction.type === 'drag') {
      const dx = (e.clientX - interaction.startX) * scaleX
      const dy = (e.clientY - interaction.startY) * scaleY
      if (interaction.isText) updateTextBlock(interaction.layerId, { x: interaction.origX + dx, y: interaction.origY + dy })
      else updateLayer(interaction.layerId, { x: interaction.origX + dx, y: interaction.origY + dy })

    } else if (interaction.type === 'resize') {
      const dx = (e.clientX - interaction.startX) * scaleX
      const dy = (e.clientY - interaction.startY) * scaleY
      const rot = interaction.origRot
      const ldx = dx * Math.cos(-rot) - dy * Math.sin(-rot)
      const ldy = dx * Math.sin(-rot) + dy * Math.cos(-rot)
      const { handle, origX, origY, origW, origH } = interaction
      let x = origX, y = origY, w = origW, h = origH
      if (handle.includes('e')) w = Math.max(20, origW + ldx)
      if (handle.includes('w')) { x = origX + ldx; w = Math.max(20, origW - ldx) }
      if (!interaction.isText) {
        if (handle.includes('s')) h = Math.max(20, origH + ldy)
        if (handle.includes('n')) { y = origY + ldy; h = Math.max(20, origH - ldy) }
      }
      if (interaction.isText) updateTextBlock(interaction.layerId, { x, maxWidth: Math.round(w) })
      else updateLayer(interaction.layerId, { x, y, width: Math.round(w), height: Math.round(h) })

    } else if (interaction.type === 'rotate') {
      const angle = Math.atan2(e.clientY - interaction.centerY, e.clientX - interaction.centerX) * 180 / Math.PI
      const newRot = Math.round(interaction.origRot + (angle - interaction.startAngle))
      if (interaction.isText) updateTextBlock(interaction.layerId, { rotation: newRot })
      else updateLayer(interaction.layerId, { rotation: newRot })
    }
  }

  function onCanvasMouseUp() {
    wasDragging.current = !!interaction
    setInteraction(null)
  }

  function onCanvasClick(e) {
    if (wasDragging.current) { wasDragging.current = false; return }
    if (e.target === canvasRef.current) setSelectedLayer(null)
  }

  const selLayer = sb.layers.find(l => l.id === selectedLayer) || null
  const selText  = (sb.textBlocks || []).find(t => t.id === selectedLayer) || null

  const { campaign } = useStore()
  const [charFilter, setCharFilter] = useState('all')
  const allPortraitChars = Object.values(campaign?.actors || {}).filter(c => c.portrait)
  const characters = charFilter === 'all'
    ? allPortraitChars
    : allPortraitChars.filter(c => c.actorType === charFilter)

  return (
    <div className={styles.editor}>
      <div className={styles.editorTopBar}>
        <button className={styles.backBtn} onClick={onClose}>← Close</button>
        <input className={styles.nameInput} value={sb.name}
          onChange={e => onUpdate({ name: e.target.value })} />
        <button className={styles.broadcastBtn2} onClick={onBroadcast}>📺 Show on Display</button>
      </div>

      <div className={styles.editorBody}>
        {/* Left tools */}
        <div className={styles.toolPanel}>
          <div className={styles.toolSection}>
            <div className={styles.toolLabel}>Background</div>
            <label className={styles.uploadBtn}>
              📷 Upload image
              <input type="file" accept="image/*" style={{ display:'none' }} onChange={handleBgUpload} />
            </label>
            <div className={styles.colorRow}>
              <label className={styles.toolLabel}>BG Color</label>
              <input type="color" value={sb.backgroundColor || '#1a1c1e'}
                onChange={e => onUpdate({ backgroundColor: e.target.value })} />
            </div>
          </div>

          <div className={styles.toolSection}>
            <div className={styles.toolLabel}>Add portrait</div>
            <label className={styles.uploadBtn}>
              🖼 Upload image
              <input type="file" accept="image/*" style={{ display:'none' }} onChange={handlePortraitUpload} />
            </label>
            {allPortraitChars.length > 0 && (
              <>
                <div className={styles.toolLabel} style={{ marginTop: 6 }}>From roster</div>
                <div className={styles.charFilterRow}>
                  {[['all','All'],['player','Players'],['npc','NPCs'],['monster','Monsters']].map(([id, label]) => (
                    <button key={id}
                      className={`${styles.charFilterBtn} ${charFilter === id ? styles.charFilterBtnActive : ''}`}
                      onClick={() => setCharFilter(id)}>{label}</button>
                  ))}
                </div>
                <div className={styles.portraitPicker}>
                  {characters.length === 0
                    ? <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>None in this group</div>
                    : characters.map(c => (
                      <button key={c.id} className={styles.portraitPickItem}
                        onClick={() => addPortraitLayerFromRoster(c.portrait)} title={c.name}>
                        <ResolvedImg src={c.portrait} alt={c.name} style={{ width:24, height:24, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                        <span>{c.name}</span>
                      </button>
                    ))
                  }
                </div>
              </>
            )}
          </div>

          <div className={styles.toolSection}>
            <div className={styles.toolLabel}>Add text</div>
            <button className={styles.uploadBtn} onClick={addTextLayer}>+ Text block</button>
          </div>

          <div className={styles.toolSection}>
            <div className={styles.toolLabel}>Layers ({sb.layers.length + (sb.textBlocks?.length || 0)})</div>
            {sb.layers.map((l, i) => (
              <div key={l.id}
                className={`${styles.layerItem} ${selectedLayer === l.id ? styles.layerItemSelected : ''}`}
                onClick={() => setSelectedLayer(l.id)}>
                <span className={styles.layerItemLabel}>{l.label || `Layer ${i+1}`}</span>
                <button className={styles.layerDeleteBtn}
                  onClick={e => { e.stopPropagation(); removeLayer(l.id) }}>×</button>
              </div>
            ))}
            {(sb.textBlocks || []).map((t, i) => (
              <div key={t.id}
                className={`${styles.layerItem} ${selectedLayer === t.id ? styles.layerItemSelected : ''}`}
                onClick={() => setSelectedLayer(t.id)}>
                <span className={styles.layerItemLabel}>📝 {t.text.slice(0, 18)}{t.text.length > 18 ? '…' : ''}</span>
                <button className={styles.layerDeleteBtn}
                  onClick={e => { e.stopPropagation(); removeTextBlock(t.id) }}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div ref={wrapRef} className={styles.canvasWrap}>
          <div
            ref={canvasRef}
            className={styles.canvas}
            style={{
              backgroundColor: sb.backgroundColor || '#1a1c1e',
              containerType: 'size',
              ...(displaySize
                ? { width: displaySize.w, height: displaySize.h }
                : { aspectRatio: '16/9', width: '100%', maxHeight: '100%' }),
            }}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            onClick={onCanvasClick}>

            {sb.backgroundImage && (
              <ResolvedImg src={sb.backgroundImage}
                style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', pointerEvents:'none', zIndex:0 }} />
            )}

            {/* Image layers */}
            {sb.layers.map(layer => (
              <div key={layer.id}
                className={`${styles.canvasLayer} ${selectedLayer === layer.id ? styles.canvasLayerSelected : ''}`}
                style={{
                  left: `${(layer.x / CANVAS_W) * 100}%`,
                  top: `${(layer.y / CANVAS_H) * 100}%`,
                  width: `${(layer.width / CANVAS_W) * 100}%`,
                  height: `${(layer.height / CANVAS_H) * 100}%`,
                  transform: `rotate(${layer.rotation || 0}deg) scaleX(${layer.flipX ? -1 : 1}) scaleY(${layer.flipY ? -1 : 1})`,
                  opacity: layer.opacity ?? 1,
                  overflow: 'visible',
                }}
                onMouseDown={e => onLayerMouseDown(e, layer.id)}>
                <ResolvedImg src={layer.src} draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                {selectedLayer === layer.id && (
                  <DragHandles
                    isText={false}
                    onResizeStart={(e, h) => startResize(e, layer.id, h, false)}
                    onRotateStart={e => startRotate(e, layer.id, false)}
                  />
                )}
              </div>
            ))}

            {/* Text blocks */}
            {(sb.textBlocks || []).map(tb => (
              <div key={tb.id}
                className={`${styles.canvasText} ${selectedLayer === tb.id ? styles.canvasLayerSelected : ''}`}
                style={{
                  left: `${(tb.x / CANVAS_W) * 100}%`,
                  top: `${(tb.y / CANVAS_H) * 100}%`,
                  fontSize: `${(tb.fontSize / CANVAS_H) * 100}cqh`,
                  color: tb.color || '#fff',
                  fontWeight: tb.bold ? 700 : 400,
                  textAlign: tb.align || 'left',
                  fontStyle: tb.italic ? 'italic' : 'normal',
                  opacity: tb.opacity ?? 1,
                  maxWidth: `${((tb.maxWidth || 640) / CANVAS_W) * 100}%`,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'break-word',
                  transform: `rotate(${tb.rotation || 0}deg)`,
                  transformOrigin: 'top left',
                  overflow: 'visible',
                }}
                onMouseDown={e => onLayerMouseDown(e, tb.id, true)}>
                {tb.text}
                {selectedLayer === tb.id && (
                  <DragHandles
                    isText={true}
                    onResizeStart={(e, h) => startResize(e, tb.id, h, true)}
                    onRotateStart={e => startRotate(e, tb.id, true)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: image layer controls */}
        {selLayer && !selText && (
          <div className={styles.layerControls}>
            <div className={styles.toolLabel}>Image layer</div>
            <label className={styles.toolLabel}>Label</label>
            <input value={selLayer.label || ''} onChange={e => updateLayer(selLayer.id, { label: e.target.value })} />

            <label className={styles.toolLabel}>Position</label>
            <div className={styles.xyRow}>
              <span>X</span><input type="number" value={Math.round(selLayer.x)} onChange={e => updateLayer(selLayer.id, { x: parseInt(e.target.value) || 0 })} />
              <span>Y</span><input type="number" value={Math.round(selLayer.y)} onChange={e => updateLayer(selLayer.id, { y: parseInt(e.target.value) || 0 })} />
            </div>

            <label className={styles.toolLabel}>Size</label>
            <div className={styles.xyRow}>
              <span>W</span><input type="number" value={Math.round(selLayer.width)} onChange={e => updateLayer(selLayer.id, { width: parseInt(e.target.value) || 100 })} />
              <span>H</span><input type="number" value={Math.round(selLayer.height)} onChange={e => updateLayer(selLayer.id, { height: parseInt(e.target.value) || 100 })} />
            </div>

            <label className={styles.toolLabel}>Rotation (°)</label>
            <input type="range" min={-180} max={180} value={selLayer.rotation || 0}
              onChange={e => updateLayer(selLayer.id, { rotation: parseInt(e.target.value) })} />
            <span className={styles.rangeVal}>{selLayer.rotation || 0}°</span>

            <label className={styles.toolLabel}>Opacity</label>
            <input type="range" min={0} max={1} step={0.05} value={selLayer.opacity ?? 1}
              onChange={e => updateLayer(selLayer.id, { opacity: parseFloat(e.target.value) })} />
            <span className={styles.rangeVal}>{Math.round((selLayer.opacity ?? 1) * 100)}%</span>

            <div className={styles.flipRow}>
              <button className={`${styles.flipBtn} ${selLayer.flipX ? styles.flipBtnActive : ''}`}
                onClick={() => updateLayer(selLayer.id, { flipX: !selLayer.flipX })}>↔ Flip H</button>
              <button className={`${styles.flipBtn} ${selLayer.flipY ? styles.flipBtnActive : ''}`}
                onClick={() => updateLayer(selLayer.id, { flipY: !selLayer.flipY })}>↕ Flip V</button>
            </div>

            <button className={styles.deleteLayerBtn} onClick={() => removeLayer(selLayer.id)}>🗑 Remove</button>
          </div>
        )}

        {/* Right: text block controls */}
        {selText && (
          <div className={styles.layerControls}>
            <div className={styles.toolLabel}>Text layer</div>

            <label className={styles.toolLabel}>Content</label>
            <textarea rows={3} value={selText.text}
              onChange={e => updateTextBlock(selText.id, { text: e.target.value })}
              style={{ resize:'vertical', fontSize:11, lineHeight:1.4 }} />

            <label className={styles.toolLabel}>Position</label>
            <div className={styles.xyRow}>
              <span>X</span><input type="number" value={Math.round(selText.x)} onChange={e => updateTextBlock(selText.id, { x: parseInt(e.target.value) || 0 })} />
              <span>Y</span><input type="number" value={Math.round(selText.y)} onChange={e => updateTextBlock(selText.id, { y: parseInt(e.target.value) || 0 })} />
            </div>

            <label className={styles.toolLabel}>Font size</label>
            <input type="range" min={12} max={200} value={selText.fontSize || 36}
              onChange={e => updateTextBlock(selText.id, { fontSize: parseInt(e.target.value) })} />
            <span className={styles.rangeVal}>{selText.fontSize || 36}px</span>

            <label className={styles.toolLabel}>Text width (wrap)</label>
            <input type="range" min={50} max={CANVAS_W} step={10}
              value={selText.maxWidth || 640}
              onChange={e => updateTextBlock(selText.id, { maxWidth: parseInt(e.target.value) })} />
            <span className={styles.rangeVal}>{selText.maxWidth || 640}px</span>

            <label className={styles.toolLabel}>Rotation (°)</label>
            <input type="range" min={-180} max={180} value={selText.rotation || 0}
              onChange={e => updateTextBlock(selText.id, { rotation: parseInt(e.target.value) })} />
            <span className={styles.rangeVal}>{selText.rotation || 0}°</span>

            <label className={styles.toolLabel}>Color</label>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <input type="color" value={selText.color || '#ffffff'}
                onChange={e => updateTextBlock(selText.id, { color: e.target.value })}
                style={{ width:36, height:28, border:'none', padding:0, cursor:'pointer', borderRadius:4 }} />
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>{selText.color || '#ffffff'}</span>
            </div>

            <label className={styles.toolLabel}>Align</label>
            <div className={styles.flipRow}>
              {['left','center','right'].map(a => (
                <button key={a}
                  className={`${styles.flipBtn} ${(selText.align || 'left') === a ? styles.flipBtnActive : ''}`}
                  onClick={() => updateTextBlock(selText.id, { align: a })}>
                  {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
                </button>
              ))}
            </div>

            <label className={styles.toolLabel}>Style</label>
            <div className={styles.flipRow}>
              <button className={`${styles.flipBtn} ${selText.bold ? styles.flipBtnActive : ''}`}
                onClick={() => updateTextBlock(selText.id, { bold: !selText.bold })}><strong>B</strong></button>
              <button className={`${styles.flipBtn} ${selText.italic ? styles.flipBtnActive : ''}`}
                onClick={() => updateTextBlock(selText.id, { italic: !selText.italic })}><em>I</em></button>
            </div>

            <label className={styles.toolLabel}>Opacity</label>
            <input type="range" min={0} max={1} step={0.05} value={selText.opacity ?? 1}
              onChange={e => updateTextBlock(selText.id, { opacity: parseFloat(e.target.value) })} />
            <span className={styles.rangeVal}>{Math.round((selText.opacity ?? 1) * 100)}%</span>

            <button className={styles.deleteLayerBtn} onClick={() => removeTextBlock(selText.id)}>🗑 Remove</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Drag handles (resize corners + rotation) ──────────────────
const RESIZE_HANDLES = [
  { id: 'nw', top:    0,   left:   0,    cursor: 'nw-resize', tx: '-50%', ty: '-50%' },
  { id: 'n',  top:    0,   left: '50%',  cursor: 'n-resize',  tx: '-50%', ty: '-50%' },
  { id: 'ne', top:    0,   right:  0,    cursor: 'ne-resize', tx:  '50%', ty: '-50%' },
  { id: 'e',  top: '50%',  right:  0,    cursor: 'e-resize',  tx:  '50%', ty: '-50%' },
  { id: 'se', bottom: 0,   right:  0,    cursor: 'se-resize', tx:  '50%', ty:  '50%' },
  { id: 's',  bottom: 0,   left: '50%',  cursor: 's-resize',  tx: '-50%', ty:  '50%' },
  { id: 'sw', bottom: 0,   left:   0,    cursor: 'sw-resize', tx: '-50%', ty:  '50%' },
  { id: 'w',  top: '50%',  left:   0,    cursor: 'w-resize',  tx: '-50%', ty: '-50%' },
]

function DragHandles({ isText, onResizeStart, onRotateStart }) {
  // For text blocks only show horizontal handles (text height is determined by font size)
  const handles = isText
    ? RESIZE_HANDLES.filter(h => h.id === 'e' || h.id === 'w' || h.id === 'ne' || h.id === 'nw' || h.id === 'se' || h.id === 'sw')
    : RESIZE_HANDLES

  return (
    <>
      {handles.map(h => (
        <div
          key={h.id}
          onMouseDown={e => { e.stopPropagation(); onResizeStart(e, h.id) }}
          style={{
            position: 'absolute',
            width: 9, height: 9,
            background: '#fff',
            border: '1.5px solid #c8a96e',
            borderRadius: 2,
            cursor: h.cursor,
            zIndex: 10,
            pointerEvents: 'auto',
            top: h.top,
            bottom: h.bottom,
            left: h.left,
            right: h.right,
            transform: `translate(${h.tx}, ${h.ty})`,
          }}
        />
      ))}
      {/* Line to rotation handle */}
      <div style={{
        position: 'absolute', width: 1, height: 20,
        background: 'rgba(200,169,110,0.65)',
        top: -20, left: 'calc(50% - 0.5px)',
        zIndex: 9, pointerEvents: 'none',
      }} />
      {/* Rotation handle */}
      <div
        onMouseDown={e => { e.stopPropagation(); onRotateStart(e) }}
        title="Drag to rotate"
        style={{
          position: 'absolute',
          width: 13, height: 13,
          background: '#c8a96e',
          borderRadius: '50%',
          top: -33, left: 'calc(50% - 6.5px)',
          cursor: 'grab',
          zIndex: 10,
          pointerEvents: 'auto',
          boxShadow: '0 0 0 2px rgba(0,0,0,0.5)',
        }}
      />
    </>
  )
}
