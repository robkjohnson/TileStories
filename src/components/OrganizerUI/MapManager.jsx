import React, { useState } from 'react'
import { useStore } from '../../store/useStore'
import styles from './Sidebar.module.css'
import ms from './MapManager.module.css'

export default function MapManager() {
  const { campaign, addMap, updateMap, deleteMap, resizeMap, setActiveMap } = useStore()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCols, setNewCols] = useState(12)
  const [newRows, setNewRows] = useState(10)
  const [resizing, setResizing] = useState(null)
  const [resizeCols, setResizeCols] = useState(0)
  const [resizeRows, setResizeRows] = useState(0)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  if (!campaign) return <div className={styles.emptyHint} style={{ padding: '12px' }}>No campaign loaded.</div>

  const maps = Object.values(campaign.maps || {})
  const activeMapId = campaign.activeMapId

  function handleAdd() {
    const name = newName.trim()
    if (!name) return
    addMap({ name, cols: Math.max(4, newCols), rows: Math.max(4, newRows) })
    setAdding(false)
    setNewName('')
    setNewCols(12)
    setNewRows(10)
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
    if (deleteConfirm === id) {
      deleteMap(id)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(id)
    }
  }

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Maps ({maps.length})</div>
        {maps.length === 0 && <div className={styles.emptyHint}>No maps yet.</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {maps.map(map => (
            <div key={map.id} className={`${ms.mapRow} ${map.id === activeMapId ? ms.mapRowActive : ''}`}>

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
                    <button className={styles.smallBtn} onClick={e => { e.stopPropagation(); openResize(map) }}>
                      Resize
                    </button>
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
          ))}
        </div>
      </div>

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
            <div className={styles.actionRow}>
              <button className={styles.cancelBtn} onClick={() => { setAdding(false); setNewName('') }}>Cancel</button>
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
