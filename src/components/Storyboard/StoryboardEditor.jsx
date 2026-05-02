import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useStore, makeStoryboard } from '../../store/useStore'
import styles from './StoryboardEditor.module.css'
import { storeImage, resolveStoryboardImages } from '../../utils/imageStorage'
import { useImage } from '../../utils/useImage'

// Resolved image component — handles both raw dataUrls and IndexedDB hashes
function ResolvedImg({ src, alt, className, style, draggable }) {
  const resolved = useImage(src)
  if (!resolved) return null
  return <img src={resolved} alt={alt || ''} className={className} style={style} draggable={draggable} />
}

export default function StoryboardEditor() {
  const { campaign, addStoryboard, updateStoryboard, deleteStoryboard } = useStore()
  const [editing, setEditing] = useState(null) // storyboard id being edited

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
      {/* Sidebar list — always visible */}
      <div className={styles.list}>
        <button className={styles.createBtn} onClick={handleCreate}>+ New storyboard</button>

        {storyboards.length === 0 ? (
          <div className={styles.empty}>No storyboards yet</div>
        ) : storyboards.map(s => (
          <div key={s.id} className={styles.listCard}>
            {s.backgroundImage && (
              <div className={styles.listThumb}>
                <ResolvedImg src={s.backgroundImage} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
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

      {/* Full-screen modal editor — renders above everything */}
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
  const [selectedLayer, setSelectedLayer] = useState(null)
  const [dragging, setDragging] = useState(null) // { layerId, startX, startY, origX, origY }
  const bgRef = useRef(null)
  const layerImgRefs = useRef({})

  const CANVAS_W = 1280
  const CANVAS_H = 720

  function updateLayer(id, patch) {
    onUpdate({ layers: sb.layers.map(l => l.id === id ? { ...l, ...patch } : l) })
  }

  async function addPortraitLayerFromRoster(portrait) {
    const hash = await storeImage(portrait)
    addPortraitLayer(hash)
  }

  function addPortraitLayer(hashOrDataUrl) {
    const id = Math.random().toString(36).slice(2, 9)
    const newLayer = {
      id,
      type: 'image',
      src: hashOrDataUrl,
      x: 200, y: 100,
      width: 300, height: 400,
      rotation: 0,
      flipX: false, flipY: false,
      opacity: 1,
      label: 'Portrait',
    }
    onUpdate({ layers: [...sb.layers, newLayer] })
    setSelectedLayer(id)
  }

  function addTextLayer() {
    const id = Math.random().toString(36).slice(2, 9)
    onUpdate({
      textBlocks: [...(sb.textBlocks || []), {
        id, text: 'Enter text…',
        x: 100, y: 600,
        fontSize: 32, color: '#ffffff',
        bold: false, align: 'left',
      }]
    })
  }

  function removeLayer(id) {
    onUpdate({ layers: sb.layers.filter(l => l.id !== id) })
    if (selectedLayer === id) setSelectedLayer(null)
  }

  function removeTextBlock(id) {
    onUpdate({ textBlocks: (sb.textBlocks || []).filter(t => t.id !== id) })
  }

  function updateTextBlock(id, patch) {
    onUpdate({ textBlocks: (sb.textBlocks || []).map(t => t.id === id ? { ...t, ...patch } : t) })
  }

  async function handleBgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const hash = await storeImage(ev.target.result)
      onUpdate({ backgroundImage: hash })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handlePortraitUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const hash = await storeImage(ev.target.result)
      addPortraitLayer(hash)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const selLayer = sb.layers.find(l => l.id === selectedLayer) || null
  const selText  = (sb.textBlocks || []).find(t => t.id === selectedLayer) || null

  // Mouse drag on canvas
  function onLayerMouseDown(e, layerId, isText = false) {
    e.stopPropagation()
    const layer = isText
      ? (sb.textBlocks || []).find(l => l.id === layerId)
      : sb.layers.find(l => l.id === layerId)
    if (!layer) return
    setSelectedLayer(layerId)
    setDragging({ layerId, startX: e.clientX, startY: e.clientY, origX: layer.x, origY: layer.y, isText })
  }

  function onCanvasMouseMove(e) {
    if (!dragging) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const dx = (e.clientX - dragging.startX) * scaleX
    const dy = (e.clientY - dragging.startY) * scaleY
    if (dragging.isText) {
      updateTextBlock(dragging.layerId, { x: dragging.origX + dx, y: dragging.origY + dy })
    } else {
      updateLayer(dragging.layerId, { x: dragging.origX + dx, y: dragging.origY + dy })
    }
  }

  const wasDragging = useRef(false)

  function onCanvasMouseUp() {
    wasDragging.current = !!dragging
    setDragging(null)
  }

  function onCanvasClick(e) {
    // Don't deselect if we just finished a drag
    if (wasDragging.current) { wasDragging.current = false; return }
    if (e.target === canvasRef.current) setSelectedLayer(null)
  }

  // Character portrait picker from campaign
  const [charFilter, setCharFilter] = useState('all')
  const { campaign } = useStore()
  const allPortraitChars = Object.values(campaign?.characters || {}).filter(c => c.portrait)
  const characters = charFilter === 'all'
    ? allPortraitChars
    : allPortraitChars.filter(c => c.type === charFilter)

  return (
    <div className={styles.editor}>
      {/* Top bar */}
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
                        onClick={() => addPortraitLayerFromRoster(c.portrait)}
                        title={c.name}>
                        <ResolvedImg src={c.portrait} alt={c.name} style={{ width:24, height:24, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
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

          {/* Layer list */}
          <div className={styles.toolSection}>
            <div className={styles.toolLabel}>Layers ({sb.layers.length})</div>
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
        <div className={styles.canvasWrap}>
          <div
            ref={canvasRef}
            className={styles.canvas}
            style={{
              backgroundColor: sb.backgroundColor || '#1a1c1e',
              aspectRatio: '16/9',
            }}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={() => setDragging(null)}
            onClick={onCanvasClick}>

            {/* Background image layer */}
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
                }}
                onMouseDown={e => onLayerMouseDown(e, layer.id)}>
                <ResolvedImg src={layer.src} draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            ))}

            {/* Text blocks — selectable and draggable like image layers */}
            {(sb.textBlocks || []).map(tb => (
              <div key={tb.id}
                className={`${styles.canvasText} ${selectedLayer === tb.id ? styles.canvasLayerSelected : ''}`}
                style={{
                  left: `${(tb.x / CANVAS_W) * 100}%`,
                  top: `${(tb.y / CANVAS_H) * 100}%`,
                  fontSize: `${(tb.fontSize / CANVAS_H) * 100}vh`,
                  color: tb.color || '#fff',
                  fontWeight: tb.bold ? 700 : 400,
                  textAlign: tb.align || 'left',
                  fontStyle: tb.italic ? 'italic' : 'normal',
                  cursor: 'move',
                  userSelect: 'none',
                  outline: selectedLayer === tb.id ? '2px solid var(--accent)' : 'none',
                  outlineOffset: 4,
                  padding: '2px 4px',
                  maxWidth: tb.maxWidth ? `${(tb.maxWidth / CANVAS_W) * 100}%` : undefined,
                  whiteSpace: tb.maxWidth ? 'pre-wrap' : 'nowrap',
                }}
                onMouseDown={e => onLayerMouseDown(e, tb.id, true)}>
                {tb.text}
              </div>
            ))}
          </div>
        </div>

        {/* Right: controls for selected image layer */}
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

        {/* Right: controls for selected text block */}
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
            <input type="range" min={12} max={200} value={selText.fontSize || 32}
              onChange={e => updateTextBlock(selText.id, { fontSize: parseInt(e.target.value) })} />
            <span className={styles.rangeVal}>{selText.fontSize || 32}px</span>

            <label className={styles.toolLabel}>Color</label>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <input type="color" value={selText.color || '#ffffff'}
                onChange={e => updateTextBlock(selText.id, { color: e.target.value })}
                style={{ width:36, height:28, border:'none', padding:0, cursor:'pointer', borderRadius:4 }} />
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>{selText.color || '#ffffff'}</span>
            </div>

            <label className={styles.toolLabel}>Max width (0 = no wrap)</label>
            <input type="number" min={0} max={CANVAS_W}
              value={selText.maxWidth || 0}
              onChange={e => updateTextBlock(selText.id, { maxWidth: parseInt(e.target.value) || 0 })} />

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