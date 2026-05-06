import React, { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import styles from './Sidebar.module.css'
import ms from './MapManager.module.css'

const MAX_BG_BYTES = 5 * 1024 * 1024
// Slider range for cols. Inverted: right = larger tiles = fewer cols.
const COLS_MIN = 4
const COLS_MAX = 120
function clampCols(cols) { return Math.min(Math.max(Math.round(cols), COLS_MIN), COLS_MAX) }

export default function MapManager() {
  const { campaign, addMap, updateMap, deleteMap, resizeMap, setActiveMap } = useStore()

  // Existing-map state
  const [resizing, setResizing] = useState(null)
  const [resizeCols, setResizeCols] = useState(0)
  const [resizeRows, setResizeRows] = useState(0)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const fileInputs = useRef({})

  // New-map creation state
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCols, setNewCols] = useState(12)
  const [newRows, setNewRows] = useState(10)
  const [newTileStyle, setNewTileStyle] = useState('hex')
  const [newDefaultBiome, setNewDefaultBiome] = useState(campaign?.settings?.defaultBiome || 'grassland')
  const [newBgImage, setNewBgImage] = useState(null)
  const [newBgImgSize, setNewBgImgSize] = useState({ w: 1, h: 1 })
  const [newBgCols, setNewBgCols] = useState(18)
  const newBgFileRef = useRef(null)

  // Rows for new map derived from image aspect ratio
  const newBgRows = Math.max(4, Math.round(newBgCols * newBgImgSize.h / newBgImgSize.w))

  if (!campaign) return <div className={styles.emptyHint} style={{ padding: '12px' }}>No campaign loaded.</div>

  const maps = Object.values(campaign.maps || {})
  const activeMapId = campaign.activeMapId

  // ── New map ───────────────────────────────────────────────────
  function handleNewBgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_BG_BYTES) { alert('Image must be under 5 MB'); e.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = ev => {
      const src = ev.target.result
      const img = new Image()
      img.onload = () => {
        setNewBgImgSize({ w: img.naturalWidth, h: img.naturalHeight })
        setNewBgCols(18)
        setNewBgImage(src)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleAdd() {
    const name = newName.trim()
    if (!name) return
    const cols = newBgImage ? newBgCols : Math.max(4, newCols)
    const rows = newBgImage ? newBgRows : Math.max(4, newRows)
    addMap({
      name, cols, rows, tileStyle: newTileStyle, defaultBiome: newDefaultBiome,
      ...(newBgImage ? {
        backgroundImage: newBgImage,
        bgImgWidth: newBgImgSize.w,
        bgImgHeight: newBgImgSize.h,
        bgCols: null,
      } : {}),
    })
    resetNewForm()
  }

  function resetNewForm() {
    setAdding(false)
    setNewName('')
    setNewCols(12)
    setNewRows(10)
    setNewTileStyle('hex')
    setNewDefaultBiome(campaign?.settings?.defaultBiome || 'grassland')
    setNewBgImage(null)
    setNewBgImgSize({ w: 1, h: 1 })
    setNewBgCols(18)
  }

  // ── Existing map ──────────────────────────────────────────────
  function handleBgUpload(e, mapId) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_BG_BYTES) { alert('Image must be under 5 MB'); e.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = ev => {
      const src = ev.target.result
      const img = new Image()
      img.onload = () => {
        const m = campaign.maps[mapId]
        // Store the image and its natural dimensions; bgCols=null so image fills the map.
        // Auto-resize rows so the image aspect ratio matches the tile grid exactly.
        const newRows = Math.max(4, Math.round(m.cols * img.naturalHeight / img.naturalWidth))
        updateMap(mapId, {
          backgroundImage: src,
          bgImgWidth: img.naturalWidth,
          bgImgHeight: img.naturalHeight,
          bgCols: null,
          bgOffsetX: 0,
          bgOffsetY: 0,
        })
        if (newRows !== m.rows) resizeMap(mapId, m.cols, newRows)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Slider controls column count — rows auto-derived from image aspect ratio.
  function handleBgSlider(mapId, newCols) {
    const m = campaign.maps[mapId]
    const aspect = m.bgImgHeight && m.bgImgWidth ? m.bgImgHeight / m.bgImgWidth : m.rows / m.cols
    const newRows = Math.max(4, Math.round(newCols * aspect))
    resizeMap(mapId, newCols, newRows)
  }

  function removeBg(mapId) {
    updateMap(mapId, {
      backgroundImage: null, bgImgWidth: null, bgImgHeight: null,
      bgCols: null, bgOffsetX: 0, bgOffsetY: 0,
    })
  }

  function openResize(map) {
    setResizing(map.id)
    setResizeCols(map.cols)
    setResizeRows(map.rows)
  }

  function applyResize() {
    resizeMap(resizing, Math.max(4, resizeCols), Math.max(4, resizeRows))
    setResizing(null)
  }

  function handleDelete(id, e) {
    e.stopPropagation()
    if (maps.length <= 1) return
    if (deleteConfirm === id) { deleteMap(id); setDeleteConfirm(null) }
    else setDeleteConfirm(id)
  }

  return (
    <>
      {/* ── Map list ───────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Maps ({maps.length})</div>
        {maps.length === 0 && <div className={styles.emptyHint}>No maps yet.</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {maps.map(map => (
            <div key={map.id} className={`${ms.mapRow} ${map.id === activeMapId ? ms.mapRowActive : ''}`}
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>

              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className={ms.mapRowMain} onClick={() => setActiveMap(map.id)}>
                  <span className={ms.mapActiveChip}>{map.id === activeMapId ? '●' : '○'}</span>
                  <input
                    className={ms.mapNameInput}
                    value={map.name}
                    onClick={e => e.stopPropagation()}
                    onChange={e => updateMap(map.id, { name: e.target.value })}
                  />
                  <span className={ms.mapSize}>{map.cols}×{map.rows}</span>
                </div>

                <div className={ms.mapActions}>
                  {resizing === map.id ? (
                    <div className={ms.resizeForm}>
                      <input type="number" min={4} max={60} value={resizeCols}
                        className={ms.sizeInput}
                        onChange={e => setResizeCols(parseInt(e.target.value) || 4)} />
                      <span className={ms.sizeSep}>×</span>
                      <input type="number" min={4} max={60} value={resizeRows}
                        className={ms.sizeInput}
                        onChange={e => setResizeRows(parseInt(e.target.value) || 4)} />
                      <button className={styles.saveBtn} onClick={applyResize}>✓</button>
                      <button className={styles.cancelBtn} onClick={() => setResizing(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                      {!map.backgroundImage && (
                        <button className={styles.smallBtn} onClick={e => { e.stopPropagation(); openResize(map) }}>
                          Resize
                        </button>
                      )}
                      {deleteConfirm === map.id ? (
                        <div className={styles.deleteConfirmInline}>
                          <button className={styles.deleteYesBtn} onClick={e => handleDelete(map.id, e)}>✓</button>
                          <button className={styles.deleteNoBtn} onClick={e => { e.stopPropagation(); setDeleteConfirm(null) }}>✕</button>
                        </div>
                      ) : (
                        <button
                          className={styles.deleteInlineBtn}
                          style={{ opacity: maps.length > 1 ? undefined : 0.3, cursor: maps.length > 1 ? 'pointer' : 'default' }}
                          onClick={e => handleDelete(map.id, e)}
                          title={maps.length <= 1 ? 'Cannot delete the only map' : 'Delete map'}>
                          🗑
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Background image section */}
              <div className={ms.bgSection} onClick={e => e.stopPropagation()}>
                {map.backgroundImage ? (
                  <div className={ms.bgActive}>
                    <img src={map.backgroundImage} className={ms.bgThumb} alt="Map background" />
                    <div className={ms.bgControls}>
                      <div className={ms.bgSliderLabel}>
                        <span className={ms.bgSliderEndLabel}>Fewer</span>
                        <span className={ms.bgSliderCols}>{map.cols} × {map.rows} tiles</span>
                        <span className={ms.bgSliderEndLabel}>More</span>
                      </div>
                      <input
                        type="range"
                        className={ms.bgSlider}
                        min={COLS_MIN} max={COLS_MAX}
                        value={clampCols(map.cols)}
                        onChange={e => handleBgSlider(map.id, clampCols(e.target.value))}
                      />
                      <div className={ms.bgOffsetRow}>
                        <label className={ms.bgOffsetField}>
                          <span>X</span>
                          <input type="number" step={0.5} className={ms.bgOffsetInput}
                            value={map.bgOffsetX ?? 0}
                            onChange={e => updateMap(map.id, { bgOffsetX: parseFloat(e.target.value) || 0 })} />
                        </label>
                        <label className={ms.bgOffsetField}>
                          <span>Y</span>
                          <input type="number" step={0.5} className={ms.bgOffsetInput}
                            value={map.bgOffsetY ?? 0}
                            onChange={e => updateMap(map.id, { bgOffsetY: parseFloat(e.target.value) || 0 })} />
                        </label>
                        <span className={ms.bgOffsetHint}>offset (tiles)</span>
                      </div>
                      <button className={ms.bgRemoveBtn} onClick={() => removeBg(map.id)}>Remove image</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button className={ms.bgAddBtn} onClick={() => fileInputs.current[map.id]?.click()}>
                      📷 Background image
                    </button>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: 'none' }}
                      ref={el => { if (el) fileInputs.current[map.id] = el }}
                      onChange={e => handleBgUpload(e, map.id)}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── New map form ────────────────────────────────────────── */}
      <div className={styles.section}>
        {adding ? (
          <div className={styles.createForm}>
            <input
              className={styles.inlineInput}
              placeholder="Map name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              autoFocus
            />

            {/* Background image */}
            <div className={ms.newBgRow}>
              {newBgImage ? (
                <div className={ms.newBgHas}>
                  <img src={newBgImage} className={ms.newBgThumb} alt="Background" />
                  <button className={ms.newBgRemove}
                    onClick={() => { setNewBgImage(null); setNewBgImgSize({ w: 1, h: 1 }) }}>
                    ✕ Remove
                  </button>
                </div>
              ) : (
                <button className={ms.bgAddBtn} onClick={() => newBgFileRef.current?.click()}>
                  📷 Add background image
                </button>
              )}
              <input
                ref={newBgFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleNewBgUpload}
              />
            </div>

            {/* Size — tile size slider when bg image set, manual inputs otherwise */}
            {newBgImage ? (
              <div className={ms.newBgSizeBlock}>
                <div className={ms.bgSliderLabel}>
                  <span className={ms.bgSliderEndLabel}>Fewer</span>
                  <span className={ms.bgSliderCols}>{newBgCols} × {newBgRows} tiles</span>
                  <span className={ms.bgSliderEndLabel}>More</span>
                </div>
                <input
                  type="range"
                  className={ms.bgSlider}
                  min={COLS_MIN} max={COLS_MAX}
                  value={clampCols(newBgCols)}
                  onChange={e => setNewBgCols(clampCols(e.target.value))}
                />
              </div>
            ) : (
              <div className={styles.fieldRow}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Size</span>
                <input type="number" min={4} max={60} value={newCols}
                  className={ms.sizeInput}
                  onChange={e => setNewCols(parseInt(e.target.value) || 12)} />
                <span className={ms.sizeSep}>×</span>
                <input type="number" min={4} max={60} value={newRows}
                  className={ms.sizeInput}
                  onChange={e => setNewRows(parseInt(e.target.value) || 10)} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>cols × rows</span>
              </div>
            )}

            {/* Grid style */}
            <div className={styles.fieldRow}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Grid</span>
              {['hex', 'square'].map(s => (
                <button key={s}
                  onClick={() => setNewTileStyle(s)}
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${newTileStyle === s ? 'var(--accent)' : 'var(--border)'}`,
                    background: newTileStyle === s ? 'rgba(200,169,110,0.1)' : 'var(--bg-raised)',
                    color: newTileStyle === s ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}>
                  {s === 'hex' ? '⬡ Hex' : '⬜ Square'}
                </button>
              ))}
            </div>

            {/* Default tile type */}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Default tile</div>
              <div className={ms.biomePickerGrid}>
                {Object.values(campaign.tileTypes || {}).sort((a, b) => a.name.localeCompare(b.name)).map(tt => (
                  <button
                    key={tt.id}
                    title={tt.name}
                    onClick={() => setNewDefaultBiome(tt.id)}
                    className={ms.biomeChip}
                    style={{
                      background: tt.color,
                      borderColor: tt.id === newDefaultBiome ? 'var(--accent)' : tt.border,
                      outline: tt.id === newDefaultBiome ? '1.5px solid var(--accent)' : 'none',
                    }}
                  >
                    {tt.icon || tt.name?.[0]}
                  </button>
                ))}
              </div>
              {(() => { const tt = (campaign.tileTypes || {})[newDefaultBiome]; return tt ? <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{tt.icon} {tt.name}</div> : null })()}
            </div>

            <div className={styles.actionRow}>
              <button className={styles.cancelBtn} onClick={resetNewForm}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleAdd} disabled={!newName.trim()}>Add map</button>
            </div>
          </div>
        ) : (
          <button className={styles.addEntryBtn} onClick={() => setAdding(true)}>+ New map</button>
        )}
      </div>
    </>
  )
}
