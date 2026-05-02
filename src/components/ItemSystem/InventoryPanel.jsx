import React, { useState } from 'react'
import { useStore, ITEM_CATEGORIES } from '../../store/useStore'
import { ItemCard } from './ItemLibrary'
import styles from './InventoryPanel.module.css'

// entityType: 'characters' | 'creatures'
export default function InventoryPanel({ entityType, entityId }) {
  const { campaign, giveItem, removeItemFromEntity, updateItemInstance } = useStore()
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)

  const entity = campaign?.[entityType]?.[entityId]
  const allTemplates = campaign?.items || {}
  const inventory = entity?.inventory || []

  const totalWeight = inventory.reduce((sum, i) => {
    const tmpl = allTemplates[i.templateId]
    return sum + (tmpl?.weight || 0) * (i.quantity || 1)
  }, 0)

  const available = Object.values(allTemplates).filter(t =>
    search === '' ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        {totalWeight > 0 && <span className={styles.weight}>⚖️ {totalWeight.toFixed(1)}lb total</span>}
      </div>

      {/* Items */}
      {inventory.length === 0
        ? <div className={styles.empty}>No items in inventory</div>
        : inventory.map(instance => {
            const tmpl = allTemplates[instance.templateId]
            if (!tmpl) return null
            const isEditing = editingId === instance.id
            return (
              <div key={instance.id} className={styles.instanceWrap}>
                <ItemCard template={tmpl} instance={instance} compact />
                <div className={styles.instanceActions}>
                  <button className={styles.editBtn}
                    onClick={() => setEditingId(isEditing ? null : instance.id)}>
                    {isEditing ? 'Done' : '✏️'}
                  </button>
                  <button className={styles.removeBtn}
                    onClick={() => removeItemFromEntity(entityType, entityId, instance.id)}>×</button>
                </div>
                {isEditing && (
                  <div className={styles.editPanel}>
                    <div className={styles.editRow}>
                      <label>Qty</label>
                      <input type="number" min={1} value={instance.quantity}
                        onChange={e => updateItemInstance(entityType, entityId, instance.id, { quantity: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className={styles.editRow}>
                      <label>Notes</label>
                      <input type="text" value={instance.notes || ''} placeholder="Cracked, cursed, glowing…"
                        onChange={e => updateItemInstance(entityType, entityId, instance.id, { notes: e.target.value })} />
                    </div>
                    <label className={styles.identCheck}>
                      <input type="checkbox" checked={instance.identified !== false}
                        onChange={e => updateItemInstance(entityType, entityId, instance.id, { identified: e.target.checked })} />
                      Identified (players can see the real name)
                    </label>
                  </div>
                )}
              </div>
            )
          })
      }

      {/* Add from library */}
      {!showPicker ? (
        <button className={styles.addBtn} onClick={() => setShowPicker(true)}>+ Add item from library</button>
      ) : (
        <div className={styles.picker}>
          <div className={styles.pickerHeader}>
            <input autoFocus type="text" className={styles.pickerSearch}
              placeholder="Search item library…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <button className={styles.pickerClose} onClick={() => { setShowPicker(false); setSearch('') }}>×</button>
          </div>
          {available.length === 0
            ? <div className={styles.pickerEmpty}>
                {Object.keys(allTemplates).length === 0
                  ? 'No items in library — create some in the Campaign panel'
                  : 'No matches'}
              </div>
            : <div className={styles.pickerList}>
                {available.map(tmpl => {
                  const cat = ITEM_CATEGORIES[tmpl.category] || ITEM_CATEGORIES.misc
                  return (
                    <button key={tmpl.id} className={styles.pickerItem}
                      onClick={() => { giveItem(entityType, entityId, tmpl.id); setSearch('') }}>
                      <span>{cat.icon}</span>
                      <div className={styles.pickerInfo}>
                        <span className={styles.pickerName}>{tmpl.name}</span>
                        <span className={styles.pickerMeta}>{cat.label}{tmpl.weight > 0 ? ` · ${tmpl.weight}lb` : ''}{tmpl.value > 0 ? ` · ${tmpl.value}gp` : ''}</span>
                      </div>
                      <span className={styles.pickerAdd}>Add</span>
                    </button>
                  )
                })}
              </div>
          }
        </div>
      )}
    </div>
  )
}