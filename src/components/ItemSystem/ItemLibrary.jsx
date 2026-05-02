import React, { useState } from 'react'
import { useStore, ITEM_CATEGORIES, ITEM_RARITIES } from '../../store/useStore'
import styles from './ItemLibrary.module.css'
import { useDebouncedField } from '../../utils/useDebouncedStore'

export default function ItemLibrary() {
  const { campaign, addItemTemplate, updateItemTemplate, deleteItemTemplate } = useStore()
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const templates = Object.values(campaign?.items || {})
    .sort((a, b) => a.name.localeCompare(b.name))

  const filtered = templates.filter(t => {
    if (filterCat !== 'all' && t.category !== filterCat) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) &&
        !t.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })

  function handleCreate() {
    const id = addItemTemplate()
    setExpanded(id)
  }

  return (
    <div className={styles.library}>
      <div className={styles.toolbar}>
        <input className={styles.search} type="text" placeholder="Search items…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <button className={styles.addBtn} onClick={handleCreate}>+ New item</button>
      </div>

      <div className={styles.filterRow}>
        <button className={`${styles.filterBtn} ${filterCat === 'all' ? styles.filterActive : ''}`}
          onClick={() => setFilterCat('all')}>All ({templates.length})</button>
        {Object.entries(ITEM_CATEGORIES).map(([key, def]) => (
          <button key={key}
            className={`${styles.filterBtn} ${filterCat === key ? styles.filterActive : ''}`}
            style={filterCat === key ? { borderColor: def.color, color: def.color } : {}}
            onClick={() => setFilterCat(key)}>
            {def.icon} {def.label} ({templates.filter(t => t.category === key).length})
          </button>
        ))}
      </div>

      {filtered.length === 0
        ? <div className={styles.empty}>
            {templates.length === 0 ? 'No items yet — create your first template' : 'No matches'}
          </div>
        : filtered.map(tmpl => (
          <ItemTemplateRow key={tmpl.id}
            template={tmpl}
            expanded={expanded === tmpl.id}
            onToggle={() => setExpanded(expanded === tmpl.id ? null : tmpl.id)}
            onUpdate={p => updateItemTemplate(tmpl.id, p)}
            deleteConfirm={deleteConfirm === tmpl.id}
            onDelete={() => deleteConfirm === tmpl.id ? (deleteItemTemplate(tmpl.id), setDeleteConfirm(null), setExpanded(null)) : setDeleteConfirm(tmpl.id)}
            onCancelDelete={() => setDeleteConfirm(null)}
          />
        ))
      }
    </div>
  )
}

function ItemTemplateRow({ template: t, expanded, onToggle, onUpdate, deleteConfirm, onDelete, onCancelDelete }) {
  const cat = ITEM_CATEGORIES[t.category] || ITEM_CATEGORIES.misc
  const rarity = ITEM_RARITIES.find(r => r.id === t.rarity) || ITEM_RARITIES[0]
  const { campaign } = useStore()

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader} onClick={onToggle}>
        <span className={styles.catIcon}>{cat.icon}</span>
        <div className={styles.cardInfo}>
          <span className={styles.cardName}>{t.name}</span>
          <span className={styles.cardMeta}>
            <span style={{ color: rarity.color }}>{rarity.label}</span>
            {' · '}{cat.label}
            {t.weight > 0 && ` · ${t.weight}lb`}
            {t.value > 0 && ` · ${t.value}gp`}
          </span>
        </div>
        {t.tags?.length > 0 && (
          <div className={styles.tagRow}>
            {t.tags.slice(0, 3).map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
          </div>
        )}
        <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className={styles.editor}>
          {/* Name + Category */}
          <div className={styles.editorRow}>
            <Field label="Name" style={{ flex: 2 }}>
              <DebouncedItemInput storeValue={t.name} onUpdate={v => onUpdate({ name: v })} placeholder="Item name…" />
            </Field>
            <Field label="Category">
              <select value={t.category} onChange={e => onUpdate({ category: e.target.value })}>
                {Object.entries(ITEM_CATEGORIES).map(([k, d]) => (
                  <option key={k} value={k}>{d.icon} {d.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Rarity">
              <select value={t.rarity} onChange={e => onUpdate({ rarity: e.target.value })}>
                {ITEM_RARITIES.map(r => (
                  <option key={r.id} value={r.id} style={{ color: r.color }}>{r.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Description">
            <DebouncedItemTextarea storeValue={t.description || ''} onUpdate={v => onUpdate({ description: v })} placeholder="What this item does, looks like, or where it came from…" />
          </Field>

          <div className={styles.editorRow}>
            <Field label="Weight (lb)">
              <input type="number" min={0} step={0.1} value={t.weight || 0}
                onChange={e => onUpdate({ weight: parseFloat(e.target.value) || 0 })} />
            </Field>
            <Field label="Value (gp)">
              <input type="number" min={0} value={t.value || 0}
                onChange={e => onUpdate({ value: parseInt(e.target.value) || 0 })} />
            </Field>
          </div>

          <Field label="Tags (comma-separated)">
            <input type="text" value={(t.tags || []).join(', ')}
              onChange={e => onUpdate({ tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="cryptid-lure, rare, crafted…" />
          </Field>

          {/* Granted traits */}
          <div className={styles.sectionDivider}>Granted traits</div>
          <p className={styles.hint}>Traits automatically added to whoever holds this item.</p>
          <GrantedTraitsEditor traits={t.grantedTraits || []} onChange={v => onUpdate({ grantedTraits: v })} />

          {/* Linked abilities */}
          <div className={styles.sectionDivider}>Linked abilities</div>
          <p className={styles.hint}>Abilities granted to the holder while they have this item.</p>
          <LinkedAbilitiesEditor abilityIds={t.abilityIds || []} onChange={v => onUpdate({ abilityIds: v })} />

          {/* Delete */}
          <div className={styles.deleteRow}>
            {deleteConfirm ? (
              <>
                <span className={styles.deleteWarning}>Removes from all inventories and containers.</span>
                <button className={styles.deleteConfirmBtn} onClick={onDelete}>Confirm delete</button>
                <button className={styles.cancelBtn} onClick={onCancelDelete}>Cancel</button>
              </>
            ) : (
              <button className={styles.deleteBtn} onClick={onDelete}>🗑 Delete template</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DebouncedItemInput({ storeValue, onUpdate, ...rest }) {
  const field = useDebouncedField(storeValue, onUpdate)
  return <input type="text" {...field} {...rest} />
}
function DebouncedItemTextarea({ storeValue, onUpdate, ...rest }) {
  const field = useDebouncedField(storeValue, onUpdate)
  return <textarea rows={3} style={{ resize: 'vertical' }} {...field} {...rest} />
}

function GrantedTraitsEditor({ traits, onChange }) {
  const { newId } = useStore.getState ? {} : {}
  function add() {
    onChange([...traits, { id: Math.random().toString(36).slice(2,9), name: '', description: '' }])
  }
  function update(id, partial) { onChange(traits.map(t => t.id === id ? { ...t, ...partial } : t)) }
  function remove(id) { onChange(traits.filter(t => t.id !== id)) }

  return (
    <div className={styles.traitList}>
      {traits.map(t => (
        <div key={t.id} className={styles.traitRow}>
          <input type="text" value={t.name} onChange={e => update(t.id, { name: e.target.value })}
            placeholder="Trait name…" className={styles.traitName} />
          <input type="text" value={t.description} onChange={e => update(t.id, { description: e.target.value })}
            placeholder="Trait description…" className={styles.traitDesc} />
          <button className={styles.removeInline} onClick={() => remove(t.id)}>×</button>
        </div>
      ))}
      <button className={styles.addSmallBtn} onClick={add}>+ Add trait</button>
    </div>
  )
}

function LinkedAbilitiesEditor({ abilityIds, onChange }) {
  const { campaign } = useStore()
  const allAbilities = campaign?.abilities || {}
  const linked = abilityIds.map(id => allAbilities[id]).filter(Boolean)
  const available = Object.values(allAbilities).filter(a => !abilityIds.includes(a.id))

  return (
    <div className={styles.linkedAbilities}>
      {linked.map(ab => (
        <div key={ab.id} className={styles.linkedAbilityRow}>
          <span className={styles.linkedAbilityName}>{ab.name}</span>
          <span className={styles.linkedAbilityCat}>{ab.category}</span>
          <button className={styles.removeInline} onClick={() => onChange(abilityIds.filter(id => id !== ab.id))}>×</button>
        </div>
      ))}
      {available.length > 0 && (
        <select className={styles.addAbilitySelect}
          value=""
          onChange={e => e.target.value && onChange([...abilityIds, e.target.value])}>
          <option value="">+ Link an ability…</option>
          {available.map(ab => <option key={ab.id} value={ab.id}>{ab.name} ({ab.category})</option>)}
        </select>
      )}
      {Object.keys(allAbilities).length === 0 && (
        <p className={styles.hint} style={{ margin: 0 }}>Create abilities in the Abilities tab first.</p>
      )}
    </div>
  )
}

export function ItemCard({ template: t, instance, compact, onTransfer, transferLabel }) {
  if (!t) return null
  const cat = ITEM_CATEGORIES[t.category] || ITEM_CATEGORIES.misc
  const rarity = ITEM_RARITIES.find(r => r.id === t.rarity) || ITEM_RARITIES[0]
  const displayName = instance?.identified === false ? 'Unknown Item' : t.name

  return (
    <div className={`${styles.itemCard} ${compact ? styles.itemCardCompact : ''}`}
      style={{ borderLeftColor: rarity.color }}>
      <div className={styles.itemCardHeader}>
        <span className={styles.itemIcon}>{cat.icon}</span>
        <div className={styles.itemCardInfo}>
          <span className={styles.itemCardName}>{displayName}</span>
          {instance?.quantity > 1 && <span className={styles.itemQtyBadge}>×{instance.quantity}</span>}
          <span className={styles.itemCardRarity} style={{ color: rarity.color }}>{rarity.label}</span>
        </div>
        {onTransfer && (
          <button className={styles.transferBtn} onClick={onTransfer}>{transferLabel || 'Take'}</button>
        )}
      </div>
      {!compact && t.description && (
        <div className={styles.itemCardDesc}>{t.description}</div>
      )}
      {!compact && (t.weight > 0 || t.value > 0 || t.tags?.length > 0 || t.grantedTraits?.length > 0) && (
        <div className={styles.itemCardStats}>
          {t.weight > 0 && <span className={styles.itemStat}>⚖️ {t.weight}lb</span>}
          {t.value > 0 && <span className={styles.itemStat}>💰 {t.value}gp</span>}
          {t.grantedTraits?.length > 0 && <span className={styles.itemStat}>✨ {t.grantedTraits.length} trait{t.grantedTraits.length !== 1 ? 's' : ''}</span>}
          {t.abilityIds?.length > 0 && <span className={styles.itemStat}>⚡ {t.abilityIds.length} {t.abilityIds.length !== 1 ? 'abilities' : 'ability'}</span>}
          {t.tags?.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
        </div>
      )}
      {instance?.notes && <div className={styles.itemNotes}>{instance.notes}</div>}
    </div>
  )
}

function Field({ label, children, style }) {
  return (
    <div className={styles.editorField} style={style}>
      <label>{label}</label>
      {children}
    </div>
  )
}