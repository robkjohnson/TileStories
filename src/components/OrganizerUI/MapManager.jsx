import React, { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import styles from './Sidebar.module.css'
import ms from './MapManager.module.css'

const MAX_BG_BYTES = 5 * 1024 * 1024
const COLS_MIN = 4
const COLS_MAX = 120
function clampCols(cols) { return Math.min(Math.max(Math.round(cols), COLS_MIN), COLS_MAX) }

export default function MapManager() {
  const { campaign, addMap, updateMap, deleteMap, resizeMap, setActiveMap } = useStore()

  // Per-map interaction state
  const [openSettings, setOpenSettings] = useState(null)
  const [resizing, setResizing]         = useState(null)
  const [resizeCols, setResizeCols]     = useState(0)
  const [resizeRows, setResizeRows]     = useState(0)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const fileInputs = useRef({})

  // New-map creation state
  const [adding, setAdding]               = useState(false)
  const [newName, setNewName]             = useState('')
  const [newTab, setNewTab]               = useState('')
  const [newCols, setNewCols]             = useState(12)
  const [newRows, setNewRows]             = useState(10)
  const [newTileStyle, setNewTileStyle]   = useState('hex')
  const [newDefaultBiome, setNewDefaultBiome] = useState(campaign?.settings?.defaultBiome || 'grassland')
  const [newBgImage, setNewBgImage]       = useState(null)
  const [newBgImgSize, setNewBgImgSize]   = useState({ w: 1, h: 1 })
  const [newBgCols, setNewBgCols]         = useState(18)
  const newBgFileRef = useRef(null)

  const newBgRows = Math.max(4, Math.round(newBgCols * newBgImgSize.h / newBgImgSize.w))

  if (!campaign) return <div className={styles.emptyHint} style={{ padding: '12px' }}>No campaign loaded.</div>

  const maps = Object.values(campaign.maps || {})
  const activeMapId = campaign.activeMapId

  // Collect existing tab names for autocomplete
  const existingTabs = [...new Set(maps.map(m => m.tab || '').filter(Boolean))].sort()

  // Group maps by tab; unnamed maps appear first
  const groups = {}
  for (const m of maps) {
    const key = m.tab || ''
    if (!groups[key]) groups[key] = []
    groups[key].push(m)
  }
  const groupKeys = Object.keys(groups).sort((a, b) => {
    if (!a && b) return -1
    if (a && !b) return 1
    return a.localeCompare(b)
  })

  // ── New map handlers ──────────────────────────────────────────
  function handleNewBgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_BG_BYTES) { alert('Image must be under 5 MB'); e.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = ev => {
      const src = ev.target.result
      const img = new Image()
      img.onload = () => { setNewBgImgSize({ w: img.naturalWidth, h: img.naturalHeight }); setNewBgCols(18); setNewBgImage(src) }
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
      tab: newTab.trim(),
      ...(newBgImage ? { backgroundImage: newBgImage, bgImgWidth: newBgImgSize.w, bgImgHeight: newBgImgSize.h, bgCols: null } : {}),
    })
    resetNewForm()
  }

  function resetNewForm() {
    setAdding(false); setNewName(''); setNewTab('')
    setNewCols(12); setNewRows(10); setNewTileStyle('hex')
    setNewDefaultBiome(campaign?.settings?.defaultBiome || 'grassland')
    setNewBgImage(null); setNewBgImgSize({ w: 1, h: 1 }); setNewBgCols(18)
  }

  // ── Existing map handlers ─────────────────────────────────────
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
        const newR = Math.max(4, Math.round(m.cols * img.naturalHeight / img.naturalWidth))
        updateMap(mapId, { backgroundImage: src, bgImgWidth: img.naturalWidth, bgImgHeight: img.naturalHeight, bgCols: null, bgOffsetX: 0, bgOffsetY: 0 })
        if (newR !== m.rows) resizeMap(mapId, m.cols, newR)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleBgSlider(mapId, cols) {
    const m = campaign.maps[mapId]
    const aspect = m.bgImgHeight && m.bgImgWidth ? m.bgImgHeight / m.bgImgWidth : m.rows / m.cols
    resizeMap(mapId, cols, Math.max(4, Math.round(cols * aspect)))
  }

  function removeBg(mapId) {
    updateMap(mapId, { backgroundImage: null, bgImgWidth: null, bgImgHeight: null, bgCols: null, bgOffsetX: 0, bgOffsetY: 0 })
  }

  function openResize(map) { setResizing(map.id); setResizeCols(map.cols); setResizeRows(map.rows) }
  function applyResize() { resizeMap(resizing, Math.max(4, resizeCols), Math.max(4, resizeRows)); setResizing(null) }

  function handleDelete(id, e) {
    e.stopPropagation()
    if (maps.length <= 1) return
    if (deleteConfirm === id) {
      deleteMap(id)
      setDeleteConfirm(null)
      if (openSettings === id) setOpenSettings(null)
    } else {
      setDeleteConfirm(id)
    }
  }

  function toggleSettings(id) {
    setOpenSettings(openSettings === id ? null : id)
    if (resizing === id) setResizing(null)
    setDeleteConfirm(null)
  }

  return (
    <>
      {/* ── Map list ─────────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Maps ({maps.length})</div>
        {maps.length === 0 && <div className={styles.emptyHint}>No maps yet.</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groupKeys.map(tabKey => (
            <div key={tabKey} className={ms.tabGroup}>
              {tabKey && (
                <div className={ms.tabHeader}><span>{tabKey}</span></div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {groups[tabKey].map(map => {
                  const isActive      = map.id === activeMapId
                  const isOpen        = openSettings === map.id
                  const isResizing    = resizing === map.id

                  return (
                    <div key={map.id} className={`${ms.mapItem} ${isActive ? ms.mapItemActive : ''}`}>

                      {/* ── Compact row ── */}
                      <div className={ms.mapRow} onClick={() => setActiveMap(map.id)}>
                        <span className={ms.mapActiveChip}>{isActive ? '●' : '○'}</span>
                        <input
                          className={ms.mapNameInput}
                          value={map.name}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateMap(map.id, { name: e.target.value })}
                        />
                        <span className={ms.mapSize}>{map.cols}×{map.rows}</span>

                        <button
                          className={`${ms.settingsBtn} ${isOpen ? ms.settingsBtnActive : ''}`}
                          onClick={e => { e.stopPropagation(); toggleSettings(map.id) }}
                          title="Map settings"
                        >⚙</button>

                        {deleteConfirm === map.id ? (
                          <div style={{ display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}>
                            <button className={styles.deleteYesBtn} onClick={e => handleDelete(map.id, e)}>✓</button>
                            <button className={styles.deleteNoBtn} onClick={e => { e.stopPropagation(); setDeleteConfirm(null) }}>✕</button>
                          </div>
                        ) : (
                          <button
                            className={ms.deleteBtn}
                            style={{ opacity: maps.length > 1 ? undefined : 0.3, cursor: maps.length > 1 ? 'pointer' : 'default' }}
                            onClick={e => handleDelete(map.id, e)}
                            title={maps.length <= 1 ? 'Cannot delete the only map' : 'Delete map'}
                          >🗑</button>
                        )}
                      </div>

                      {/* ── Settings panel ── */}
                      {isOpen && (
                        <div className={ms.settingsPanel} onClick={e => e.stopPropagation()}>

                          {/* Group / Tab */}
                          <div className={ms.settingsRow}>
                            <span className={ms.settingsLabel}>Group</span>
                            <input
                              className={ms.settingsInput}
                              value={map.tab || ''}
                              onChange={e => updateMap(map.id, { tab: e.target.value })}
                              placeholder="e.g. World, Dungeons…"
                              list={`tabs-${map.id}`}
                            />
                            {existingTabs.length > 0 && (
                              <datalist id={`tabs-${map.id}`}>
                                {existingTabs.map(t => <option key={t} value={t} />)}
                              </datalist>
                            )}
                          </div>

                          {/* Grid style */}
                          <div className={ms.settingsRow}>
                            <span className={ms.settingsLabel}>Grid</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {['hex', 'square'].map(s => (
                                <button key={s}
                                  onClick={() => updateMap(map.id, { tileStyle: s })}
                                  style={{
                                    fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                                    border: `1px solid ${(map.tileStyle || 'hex') === s ? 'var(--accent)' : 'var(--border)'}`,
                                    background: (map.tileStyle || 'hex') === s ? 'rgba(200,169,110,0.1)' : 'transparent',
                                    color: (map.tileStyle || 'hex') === s ? 'var(--accent)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                  }}>
                                  {s === 'hex' ? '⬡ Hex' : '⬜ Square'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Size / Resize */}
                          {!map.backgroundImage && (
                            <div className={ms.settingsRow}>
                              <span className={ms.settingsLabel}>Size</span>
                              {isResizing ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input type="number" min={4} max={120} value={resizeCols}
                                    className={ms.sizeInput}
                                    onChange={e => setResizeCols(parseInt(e.target.value) || 4)} />
                                  <span className={ms.sizeSep}>×</span>
                                  <input type="number" min={4} max={120} value={resizeRows}
                                    className={ms.sizeInput}
                                    onChange={e => setResizeRows(parseInt(e.target.value) || 4)} />
                                  <button className={styles.saveBtn} onClick={applyResize}>✓</button>
                                  <button className={styles.cancelBtn} onClick={() => setResizing(null)}>✕</button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                                    {map.cols} × {map.rows}
                                  </span>
                                  <button className={styles.smallBtn} onClick={() => openResize(map)}>Resize</button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Default tile */}
                          <div className={ms.settingsRow} style={{ alignItems: 'flex-start' }}>
                            <span className={ms.settingsLabel} style={{ paddingTop: 3 }}>Default tile</span>
                            <div style={{ flex: 1 }}>
                              <div className={ms.biomePickerGrid}>
                                {Object.values(campaign.tileTypes || {})
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(tt => (
                                    <button key={tt.id} title={tt.name}
                                      onClick={() => updateMap(map.id, { defaultBiome: tt.id })}
                                      className={ms.biomeChip}
                                      style={{
                                        background: tt.color,
                                        borderColor: tt.id === (map.defaultBiome || 'grassland') ? 'var(--accent)' : tt.border,
                                        outline: tt.id === (map.defaultBiome || 'grassland') ? '1.5px solid var(--accent)' : 'none',
                                      }}>
                                      {tt.icon || tt.name?.[0]}
                                    </button>
                                  ))}
                              </div>
                              {(() => {
                                const tt = (campaign.tileTypes || {})[map.defaultBiome || 'grassland']
                                return tt ? <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{tt.icon} {tt.name}</div> : null
                              })()}
                            </div>
                          </div>

                          {/* Background image */}
                          <div className={ms.settingsBgSection}>
                            <span className={ms.settingsLabel}>Background</span>
                            {map.backgroundImage ? (
                              <div className={ms.bgActive}>
                                <img src={map.backgroundImage} className={ms.bgThumb} alt="Map background" />
                                <div className={ms.bgControls}>
                                  <div className={ms.bgSliderLabel}>
                                    <span className={ms.bgSliderEndLabel}>Fewer</span>
                                    <span className={ms.bgSliderCols}>{map.cols} × {map.rows} tiles</span>
                                    <span className={ms.bgSliderEndLabel}>More</span>
                                  </div>
                                  <input type="range" className={ms.bgSlider}
                                    min={COLS_MIN} max={COLS_MAX} value={clampCols(map.cols)}
                                    onChange={e => handleBgSlider(map.id, clampCols(e.target.value))} />
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
                                  📷 Upload background image
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
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── New map form ─────────────────────────────────────────── */}
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

            {/* Group / Tab */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, minWidth: 36 }}>Group</span>
              <input
                style={{ flex: 1, fontSize: 11 }}
                placeholder="e.g. World, Dungeons, Towns…"
                value={newTab}
                onChange={e => setNewTab(e.target.value)}
                list="new-map-tabs"
              />
              {existingTabs.length > 0 && (
                <datalist id="new-map-tabs">
                  {existingTabs.map(t => <option key={t} value={t} />)}
                </datalist>
              )}
            </div>

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
              <input ref={newBgFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }} onChange={handleNewBgUpload} />
            </div>

            {/* Size */}
            {newBgImage ? (
              <div className={ms.newBgSizeBlock}>
                <div className={ms.bgSliderLabel}>
                  <span className={ms.bgSliderEndLabel}>Fewer</span>
                  <span className={ms.bgSliderCols}>{newBgCols} × {newBgRows} tiles</span>
                  <span className={ms.bgSliderEndLabel}>More</span>
                </div>
                <input type="range" className={ms.bgSlider} min={COLS_MIN} max={COLS_MAX}
                  value={clampCols(newBgCols)} onChange={e => setNewBgCols(clampCols(e.target.value))} />
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
                <button key={s} onClick={() => setNewTileStyle(s)}
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

            {/* Default tile */}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Default tile</div>
              <div className={ms.biomePickerGrid}>
                {Object.values(campaign.tileTypes || {}).sort((a, b) => a.name.localeCompare(b.name)).map(tt => (
                  <button key={tt.id} title={tt.name}
                    onClick={() => setNewDefaultBiome(tt.id)}
                    className={ms.biomeChip}
                    style={{
                      background: tt.color,
                      borderColor: tt.id === newDefaultBiome ? 'var(--accent)' : tt.border,
                      outline: tt.id === newDefaultBiome ? '1.5px solid var(--accent)' : 'none',
                    }}>
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
