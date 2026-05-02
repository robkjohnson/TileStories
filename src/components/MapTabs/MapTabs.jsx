import { useState } from 'react'
import { useStore } from '../../store/useStore'
import styles from './MapTabs.module.css'

export default function MapTabs() {
  const { campaign, setActiveMap, addMap, deleteMap, updateMap, resizeMap } = useStore()
  const [showNewMap, setShowNewMap] = useState(false)
  const [newMapParentId, setNewMapParentId] = useState(null)
  const [editingMapId, setEditingMapId] = useState(null)  // map being edited in modal
  const [inlineEditId, setInlineEditId] = useState(null)  // tab inline rename
  const [inlineEditName, setInlineEditName] = useState('')

  if (!campaign) return null

  const maps = Object.values(campaign.maps).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const activeId = campaign.activeMapId
  const activeMap = campaign.maps[activeId]

  const topMaps = maps.filter(m => !m.parentMapId)
  const activeTopId = activeMap?.parentMapId ?? activeId
  const activeSubMaps = maps.filter(m => m.parentMapId === activeTopId)

  function openNewMap(parentId = null) {
    setNewMapParentId(parentId)
    setShowNewMap(true)
  }

  function handleDelete(e, mapId) {
    e.stopPropagation()
    if (maps.length <= 1) return
    const mapToDelete = campaign.maps[mapId]
    const subs = maps.filter(m => m.parentMapId === mapId)
    const msg = subs.length > 0
      ? `Delete "${mapToDelete?.name}"? Its ${subs.length} sub-map(s) will become standalone maps.`
      : `Delete map "${mapToDelete?.name}"? This cannot be undone.`
    if (!window.confirm(msg)) return
    subs.forEach(sub => updateMap(sub.id, { parentMapId: null }))
    deleteMap(mapId)
  }

  function handleDeleteSub(e, mapId) {
    e.stopPropagation()
    const name = campaign.maps[mapId]?.name
    if (!window.confirm(`Delete sub-map "${name}"? This cannot be undone.`)) return
    deleteMap(mapId)
  }

  function startInlineRename(e, map) {
    e.stopPropagation()
    setInlineEditId(map.id)
    setInlineEditName(map.name)
  }

  function commitInlineRename(mapId) {
    if (inlineEditName.trim()) updateMap(mapId, { name: inlineEditName.trim() })
    setInlineEditId(null)
  }

  function openEditMap(e, mapId) {
    e.stopPropagation()
    setEditingMapId(mapId)
  }

  return (
    <div className={styles.tabsWrap}>
      {/* Row 1 — top-level maps */}
      <div className={styles.tabBar}>
        {topMaps.map(map => {
          const isActive = map.id === activeTopId
          const subCount = maps.filter(m => m.parentMapId === map.id).length
          return (
            <div
              key={map.id}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => setActiveMap(map.id)}
            >
              {inlineEditId === map.id ? (
                <input
                  className={styles.renameInput}
                  value={inlineEditName}
                  autoFocus
                  onChange={e => setInlineEditName(e.target.value)}
                  onBlur={() => commitInlineRename(map.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitInlineRename(map.id)
                    if (e.key === 'Escape') setInlineEditId(null)
                    e.stopPropagation()
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className={styles.tabName} onDoubleClick={e => startInlineRename(e, map)}>{map.name}</span>
                  {subCount > 0 && <span className={styles.subBadge} title={`${subCount} sub-map${subCount > 1 ? 's' : ''}`}>{subCount}</span>}
                  <span className={styles.tabSize}>{map.cols}×{map.rows}</span>
                  <button className={styles.tabEdit} onClick={e => openEditMap(e, map.id)} title="Map settings">⚙</button>
                  {maps.length > 1 && (
                    <button className={styles.tabClose} onClick={e => handleDelete(e, map.id)} title="Delete map">×</button>
                  )}
                </>
              )}
            </div>
          )
        })}
        <button className={styles.addTab} onClick={() => openNewMap(null)}>+ Map</button>
      </div>

      {/* Row 2 — sub-maps of active top-level map */}
      {activeSubMaps.length > 0 && (
        <div className={styles.subTabBar}>
          <span className={styles.subTabArrow}>↳</span>
          {activeSubMaps.map(map => (
            <div
              key={map.id}
              className={`${styles.subTab} ${map.id === activeId ? styles.subTabActive : ''}`}
              onClick={() => setActiveMap(map.id)}
            >
              {inlineEditId === map.id ? (
                <input
                  className={styles.renameInput}
                  value={inlineEditName}
                  autoFocus
                  onChange={e => setInlineEditName(e.target.value)}
                  onBlur={() => commitInlineRename(map.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitInlineRename(map.id)
                    if (e.key === 'Escape') setInlineEditId(null)
                    e.stopPropagation()
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className={styles.subTabName} onDoubleClick={e => startInlineRename(e, map)}>{map.name}</span>
                  <span className={styles.tabSize}>{map.cols}×{map.rows}</span>
                  <button className={styles.tabEdit} onClick={e => openEditMap(e, map.id)} title="Map settings">⚙</button>
                  <button className={styles.tabClose} onClick={e => handleDeleteSub(e, map.id)} title="Delete sub-map">×</button>
                </>
              )}
            </div>
          ))}
          <button className={styles.addSubTab} onClick={() => openNewMap(activeTopId)}>+ Sub-map</button>
        </div>
      )}

      {showNewMap && (
        <NewMapModal
          campaign={campaign}
          parentId={newMapParentId}
          topMaps={topMaps}
          onClose={() => setShowNewMap(false)}
          onCreate={(data) => { addMap(data); setShowNewMap(false) }}
        />
      )}

      {editingMapId && (
        <EditMapModal
          campaign={campaign}
          map={campaign.maps[editingMapId]}
          topMaps={topMaps}
          onClose={() => setEditingMapId(null)}
          onSave={(mapId, changes, newCols, newRows) => {
            const map = campaign.maps[mapId]
            if (newCols !== map.cols || newRows !== map.rows) {
              resizeMap(mapId, newCols, newRows)
            }
            updateMap(mapId, changes)
            setEditingMapId(null)
          }}
        />
      )}
    </div>
  )
}

// ── Shared modal shell ─────────────────────────────────────────
const modalWrap = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }
const modalBox  = { background: 'var(--bg-surface)', border: '0.5px solid var(--border-strong)', borderRadius: 12, padding: 24, width: 340, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }
const fieldStyle = { marginBottom: 12 }
const labelStyle = { display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 5 }

// ── New Map Modal ──────────────────────────────────────────────
function NewMapModal({ campaign, parentId, topMaps, onClose, onCreate }) {
  const [name, setName] = useState('New Map')
  const [cols, setCols] = useState(campaign.settings.defaultCols)
  const [rows, setRows] = useState(campaign.settings.defaultRows)
  const [defaultBiome, setDefaultBiome] = useState(campaign.settings.defaultBiome)
  const [description, setDescription] = useState('')
  const [selectedParentId, setSelectedParentId] = useState(parentId || '')
  const [tileStyle, setTileStyle] = useState('hex')

  function handleCreate() {
    if (!name.trim()) return
    onCreate({
      name: name.trim(),
      description: description.trim(),
      cols: Math.max(5, Math.min(60, cols)),
      rows: Math.max(5, Math.min(60, rows)),
      defaultBiome,
      tileStyle,
      parentMapId: selectedParentId || null,
    })
  }

  const isSubMap = !!selectedParentId
  const parentName = campaign.maps[selectedParentId]?.name

  return (
    <div style={modalWrap}>
      <div style={modalBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>{isSubMap ? 'New sub-map' : 'New map'}</h3>
            {isSubMap && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>↳ inside {parentName}</div>}
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Map name</label>
          <input type="text" value={name} autoFocus onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Description</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional…" />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Tile style</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['hex', '⬡ Hex'], ['square', '▢ Square']].map(([val, label]) => (
              <button key={val} onClick={() => setTileStyle(val)}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: `0.5px solid ${tileStyle === val ? 'var(--accent)' : 'var(--border-strong)'}`, background: tileStyle === val ? 'rgba(200,169,110,0.12)' : 'transparent', color: tileStyle === val ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: tileStyle === val ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {!parentId && topMaps.length > 0 && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Sub-map of</label>
            <select value={selectedParentId} onChange={e => setSelectedParentId(e.target.value)}>
              <option value="">None (top-level)</option>
              {topMaps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}><label style={labelStyle}>Columns</label><input type="number" value={cols} onChange={e => setCols(parseInt(e.target.value) || 18)} min={5} max={60} /></div>
          <div style={{ flex: 1 }}><label style={labelStyle}>Rows</label><input type="number" value={rows} onChange={e => setRows(parseInt(e.target.value) || 14)} min={5} max={60} /></div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Default tile type</label>
          <select value={defaultBiome} onChange={e => setDefaultBiome(e.target.value)}>
            {Object.values(campaign.tileTypes || {}).sort((a, b) => a.name.localeCompare(b.name)).map(tt => (
              <option key={tt.id} value={tt.id}>{tt.icon} {tt.name}</option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16 }}>{cols} × {rows} = {cols * rows} tiles</div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 6, border: '0.5px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={handleCreate} disabled={!name.trim()} style={{ padding: '7px 16px', borderRadius: 6, background: 'var(--accent)', color: '#1a1a1a', fontWeight: 600, fontSize: 13, cursor: 'pointer', border: 'none', opacity: name.trim() ? 1 : 0.4 }}>Create</button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Map Modal ─────────────────────────────────────────────
function EditMapModal({ campaign, map, topMaps, onClose, onSave }) {
  const [name, setName] = useState(map.name)
  const [description, setDescription] = useState(map.description || '')
  const [cols, setCols] = useState(map.cols)
  const [rows, setRows] = useState(map.rows)
  const [defaultBiome, setDefaultBiome] = useState(map.defaultBiome || campaign.settings.defaultBiome)
  const [parentMapId, setParentMapId] = useState(map.parentMapId || '')
  const [tileStyle, setTileStyle] = useState(map.tileStyle || 'hex')

  const shrinking = cols < map.cols || rows < map.rows
  const tileCount = Object.keys(map.tiles || {}).length

  // Count tiles that would be cut off
  const lostTiles = shrinking
    ? Object.keys(map.tiles || {}).filter(key => {
        const [q, r] = key.split(',').map(Number)
        return q >= cols || r >= rows
      }).length
    : 0

  function handleSave() {
    if (!name.trim()) return
    onSave(map.id, {
      name: name.trim(),
      description: description.trim(),
      defaultBiome,
      tileStyle,
      parentMapId: parentMapId || null,
    }, Math.max(5, Math.min(60, cols)), Math.max(5, Math.min(60, rows)))
  }

  // Available parents: top-level maps excluding this map itself
  const parentOptions = topMaps.filter(m => m.id !== map.id && !m.parentMapId)

  return (
    <div style={modalWrap}>
      <div style={{ ...modalBox, width: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Map settings</h3>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{map.cols}×{map.rows} · {tileCount} custom tiles</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Map name</label>
          <input type="text" value={name} autoFocus onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description…" rows={2}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 12, resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Tile style</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['hex', '⬡ Hex'], ['square', '▢ Square']].map(([val, label]) => (
              <button key={val} onClick={() => setTileStyle(val)}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: `0.5px solid ${tileStyle === val ? 'var(--accent)' : 'var(--border-strong)'}`, background: tileStyle === val ? 'rgba(200,169,110,0.12)' : 'transparent', color: tileStyle === val ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: tileStyle === val ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Default tile type</label>
          <select value={defaultBiome} onChange={e => setDefaultBiome(e.target.value)}>
            {Object.values(campaign.tileTypes || {}).sort((a, b) => a.name.localeCompare(b.name)).map(tt => (
              <option key={tt.id} value={tt.id}>{tt.icon} {tt.name}</option>
            ))}
          </select>
        </div>

        {parentOptions.length > 0 && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Sub-map of</label>
            <select value={parentMapId} onChange={e => setParentMapId(e.target.value)}>
              <option value="">None (top-level)</option>
              {parentOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ marginBottom: 6 }}>
          <label style={labelStyle}>Map size</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, textTransform: 'none', fontSize: 10 }}>Columns</label>
              <input type="number" value={cols} onChange={e => setCols(parseInt(e.target.value) || map.cols)} min={5} max={60} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, textTransform: 'none', fontSize: 10 }}>Rows</label>
              <input type="number" value={rows} onChange={e => setRows(parseInt(e.target.value) || map.rows)} min={5} max={60} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{cols} × {rows} = {cols * rows} tiles</div>
          {lostTiles > 0 && (
            <div style={{ fontSize: 11, color: '#c8a96e', marginTop: 4, padding: '5px 8px', background: 'rgba(200,169,110,0.1)', borderRadius: 5, border: '0.5px solid rgba(200,169,110,0.3)' }}>
              ⚠ Reducing size will remove {lostTiles} custom tile{lostTiles > 1 ? 's' : ''} outside the new bounds.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 6, border: '0.5px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()} style={{ padding: '7px 16px', borderRadius: 6, background: 'var(--accent)', color: '#1a1a1a', fontWeight: 600, fontSize: 13, cursor: 'pointer', border: 'none', opacity: name.trim() ? 1 : 0.4 }}>Save</button>
        </div>
      </div>
    </div>
  )
}
