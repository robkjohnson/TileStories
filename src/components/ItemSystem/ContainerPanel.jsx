import React, { useState } from 'react'
import { useStore, CONTAINER_TYPES, ITEM_CATEGORIES } from '../../store/useStore'
import { ItemCard } from './ItemLibrary'
import styles from './ContainerPanel.module.css'

// Shows all containers on the current tile
export function TileContainers({ tileKey }) {
  const { campaign, addContainer } = useStore()
  const activeMapId = campaign?.activeMapId
  const containers = Object.values(campaign?.containers || {})
    .filter(c => c.mapId === activeMapId && c.tileKey === tileKey)

  function handleAdd() {
    addContainer({ mapId: activeMapId, tileKey, name: 'Chest', discovered: true })
  }

  return (
    <div>
      {containers.map(c => (
        <ContainerCard key={c.id} container={c} />
      ))}
      <button className={styles.addContainerBtn} onClick={handleAdd}>+ Place container</button>
    </div>
  )
}

function ContainerCard({ container: c }) {
  const { campaign, updateContainer, deleteContainer, addItemToContainer, removeItemFromContainer, transferFromContainer } = useStore()
  const [open, setOpen] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const typeDef = CONTAINER_TYPES.find(t => t.id === c.type) || CONTAINER_TYPES[0]
  const allTemplates = campaign?.items || {}
  const characters = Object.values(campaign?.characters || {})
  const creatures = Object.values(campaign?.creatures || {})

  const available = Object.values(allTemplates).filter(t =>
    search === '' || t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={`${styles.container} ${!c.discovered ? styles.hidden : ''}`}>
      {/* Header */}
      <div className={styles.containerHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.containerEmoji}>{typeDef.emoji}</span>
        <div className={styles.containerInfo}>
          <input className={styles.containerName}
            value={c.name} onClick={e => e.stopPropagation()}
            onChange={e => updateContainer(c.id, { name: e.target.value })} />
          <div className={styles.containerMeta}>
            {typeDef.label}
            {c.locked && <span className={styles.locked}> 🔒 DC {c.lockDC}</span>}
            {!c.discovered && <span className={styles.hiddenTag}> 👁 Hidden</span>}
            {' · '}{c.items.length} item{c.items.length !== 1 ? 's' : ''}
          </div>
        </div>
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className={styles.containerBody}>
          {/* Container settings */}
          <div className={styles.settingsRow}>
            <select value={c.type} onChange={e => updateContainer(c.id, { type: e.target.value })} className={styles.typeSelect}>
              {CONTAINER_TYPES.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
            </select>
            <label className={styles.toggleLabel}>
              <input type="checkbox" checked={c.locked} onChange={e => updateContainer(c.id, { locked: e.target.checked })} />
              Locked
            </label>
            {c.locked && (
              <div className={styles.dcRow}>
                <span className={styles.dcLabel}>DC</span>
                <input type="number" className={styles.dcInput} value={c.lockDC || 15} min={5} max={30}
                  onChange={e => updateContainer(c.id, { lockDC: parseInt(e.target.value) || 15 })} />
              </div>
            )}
            <label className={styles.toggleLabel}>
              <input type="checkbox" checked={c.discovered} onChange={e => updateContainer(c.id, { discovered: e.target.checked })} />
              Visible to players
            </label>
          </div>

          <textarea className={styles.containerDesc} rows={2}
            value={c.description || ''} placeholder="Description…"
            onChange={e => updateContainer(c.id, { description: e.target.value })}
            style={{ resize: 'vertical' }} />

          {/* Items in container */}
          <div className={styles.sectionLabel}>Contents</div>
          {c.items.length === 0
            ? <div className={styles.emptyItems}>Empty</div>
            : c.items.map(instance => {
                const tmpl = allTemplates[instance.templateId]
                if (!tmpl) return null
                return (
                  <div key={instance.id} className={styles.itemRow}>
                    <ItemCard template={tmpl} instance={instance} compact />
                    <div className={styles.itemRowActions}>
                      {/* Transfer to character/creature */}
                      {characters.length + creatures.length > 0 && (
                        <TransferMenu
                          instance={instance}
                          containerId={c.id}
                          characters={characters}
                          creatures={creatures}
                        />
                      )}
                      <button className={styles.removeItemBtn}
                        onClick={() => removeItemFromContainer(c.id, instance.id)}>×</button>
                    </div>
                  </div>
                )
              })
          }

          {/* Add items */}
          {!showPicker ? (
            <button className={styles.addItemBtn} onClick={() => setShowPicker(true)}>+ Add item</button>
          ) : (
            <div className={styles.picker}>
              <div className={styles.pickerHeader}>
                <input autoFocus type="text" className={styles.pickerSearch}
                  placeholder="Search item library…"
                  value={search} onChange={e => setSearch(e.target.value)} />
                <button onClick={() => { setShowPicker(false); setSearch('') }} className={styles.pickerClose}>×</button>
              </div>
              <div className={styles.pickerList}>
                {available.length === 0
                  ? <div className={styles.pickerEmpty}>{Object.keys(allTemplates).length === 0 ? 'No items in library yet' : 'No matches'}</div>
                  : available.map(tmpl => {
                      const cat = ITEM_CATEGORIES[tmpl.category] || ITEM_CATEGORIES.misc
                      return (
                        <button key={tmpl.id} className={styles.pickerItem}
                          onClick={() => { addItemToContainer(c.id, tmpl.id); setSearch('') }}>
                          <span>{cat.icon}</span>
                          <span className={styles.pickerName}>{tmpl.name}</span>
                          <span className={styles.pickerAdd}>Add</span>
                        </button>
                      )
                    })
                }
              </div>
            </div>
          )}

          {/* Delete container */}
          <div className={styles.deleteRow}>
            {deleteConfirm ? (
              <>
                <span className={styles.deleteWarning}>Delete this container?</span>
                <button className={styles.deleteConfirmBtn} onClick={() => deleteContainer(c.id)}>Delete</button>
                <button className={styles.cancelBtn} onClick={() => setDeleteConfirm(false)}>Cancel</button>
              </>
            ) : (
              <button className={styles.deleteBtn} onClick={() => setDeleteConfirm(true)}>🗑 Remove container</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TransferMenu({ instance, containerId, characters, creatures }) {
  const { transferFromContainer } = useStore()
  const [open, setOpen] = useState(false)
  const all = [
    ...characters.map(c => ({ id: c.id, name: c.name, type: 'characters', label: c.type })),
    ...creatures.map(c => ({ id: c.id, name: c.name, type: 'creatures', label: c.type })),
  ]

  if (all.length === 0) return null

  return (
    <div style={{ position: 'relative' }}>
      <button className={styles.transferBtn} onClick={() => setOpen(o => !o)}>Give →</button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div className={styles.transferMenu}>
            {all.map(e => (
              <button key={e.id} className={styles.transferItem}
                onClick={() => { transferFromContainer(containerId, instance.id, e.type, e.id); setOpen(false) }}>
                {e.name} <span className={styles.transferType}>({e.label})</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Full container manager for Campaign panel
export default function ContainerManager() {
  const { campaign, addContainer, deleteContainer } = useStore()
  const [filterMap, setFilterMap] = useState('all')
  const maps = Object.values(campaign?.maps || {})
  const containers = Object.values(campaign?.containers || {})

  const filtered = containers.filter(c =>
    filterMap === 'all' || c.mapId === filterMap
  )

  return (
    <div className={styles.manager}>
      <div className={styles.managerHeader}>
        <select value={filterMap} onChange={e => setFilterMap(e.target.value)} className={styles.mapFilter}>
          <option value="all">All maps ({containers.length})</option>
          {maps.map(m => (
            <option key={m.id} value={m.id}>{m.name} ({containers.filter(c => c.mapId === m.id).length})</option>
          ))}
        </select>
      </div>

      {filtered.length === 0
        ? <div className={styles.empty}>No containers placed yet.<br />Place containers from the tile inspector.</div>
        : filtered.map(c => {
            const mapName = campaign?.maps?.[c.mapId]?.name || 'Unknown map'
            const typeDef = CONTAINER_TYPES.find(t => t.id === c.type) || CONTAINER_TYPES[0]
            return (
              <div key={c.id} className={styles.managerRow}>
                <span className={styles.containerEmoji}>{typeDef.emoji}</span>
                <div className={styles.managerInfo}>
                  <span className={styles.managerName}>{c.name}</span>
                  <span className={styles.managerMeta}>{mapName} · tile {c.tileKey} · {c.items.length} item{c.items.length !== 1 ? 's' : ''}</span>
                </div>
                {!c.discovered && <span className={styles.hiddenTag}>Hidden</span>}
                {c.locked && <span className={styles.locked}>🔒</span>}
              </div>
            )
          })
      }
    </div>
  )
}