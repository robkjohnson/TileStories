import React, { useState } from 'react'
import { useStore, makeAction } from '../../store/useStore'
import { useDebouncedField } from '../../utils/useDebouncedStore'
import { isValidDiceExpr } from '../../utils/dice'
import AoePatternEditor from './AoePatternEditor'
import styles from './EffectLibrary.module.css'

const TARGET_TYPES = [
  { id: 'single_tile',  label: 'Single Tile',       icon: '⬡' },
  { id: 'tile_aoe',     label: 'Tile AoE',           icon: '💥' },
  { id: 'tile_select',  label: 'Tile Select',        icon: '🎯' },
  { id: 'char_select',  label: 'Character Select',   icon: '👤' },
]

const DURATION_TYPES = [
  { id: 'one_time',  label: 'One Time',  desc: 'Effect fires and is done' },
  { id: 'lingering', label: 'Lingering', desc: 'Applies a status that persists' },
]

export default function EffectLibrary() {
  const { campaign, addEffect, deleteEffect, startEffectMode } = useStore()
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const effects = Object.values(campaign?.effects || {})
    .sort((a, b) => a.name.localeCompare(b.name))

  const filtered = effects.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleDelete(id) {
    if (deleteConfirm === id) {
      deleteEffect(id)
      setDeleteConfirm(null)
      if (expanded === id) setExpanded(null)
    } else {
      setDeleteConfirm(id)
    }
  }

  return (
    <div className={styles.library}>
      <div className={styles.toolbar}>
        <input className={styles.search} type="text" placeholder="Search effects…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <button className={styles.addBtn} onClick={() => { const id = addEffect(); setExpanded(id) }}>
          + New
        </button>
      </div>

      {filtered.length === 0 && (
        <div className={styles.empty}>
          {search ? 'No effects match.' : 'No effects yet. Create one to get started.'}
        </div>
      )}

      {filtered.map(effect => (
        <div key={effect.id} className={styles.card}>
          <div className={styles.cardHeader} onClick={() => setExpanded(expanded === effect.id ? null : effect.id)}>
            <span className={styles.targetIcon}>
              {TARGET_TYPES.find(t => t.id === effect.targetType)?.icon || '⚡'}
            </span>
            <div className={styles.cardTitle}>
              <span className={styles.cardName}>{effect.name || 'Unnamed'}</span>
              <span className={styles.cardMeta}>
                {TARGET_TYPES.find(t => t.id === effect.targetType)?.label}
                {' · '}
                {effect.durationType === 'lingering' ? 'Lingering' : 'One Time'}
                {effect.actions?.length > 0 && ` · ${effect.actions.length} action${effect.actions.length > 1 ? 's' : ''}`}
              </span>
            </div>
            <button
              className={styles.useBtn}
              onClick={e => { e.stopPropagation(); startEffectMode(effect.id) }}
              title="Use this effect"
            >
              ▶ Use
            </button>
            <span className={styles.chevron}>{expanded === effect.id ? '▲' : '▼'}</span>
          </div>

          {expanded === effect.id && (
            <EffectEditor
              effect={effect}
              campaign={campaign}
              deleteConfirm={deleteConfirm === effect.id}
              onDelete={() => handleDelete(effect.id)}
              onCancelDelete={() => setDeleteConfirm(null)}
              onUse={() => startEffectMode(effect.id)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Effect editor ─────────────────────────────────────────────
function EffectEditor({ effect, campaign, deleteConfirm, onDelete, onCancelDelete, onUse }) {
  const { updateEffect } = useStore()
  const [showAoeEditor, setShowAoeEditor] = useState(false)

  const nameField = useDebouncedField(effect.name, v => updateEffect(effect.id, { name: v }))
  const descField = useDebouncedField(effect.description, v => updateEffect(effect.id, { description: v }))

  const tileStyle = Object.values(campaign?.maps || {})[0]?.tileStyle || 'hex'

  function addAction() {
    const action = makeAction()
    updateEffect(effect.id, { actions: [...(effect.actions || []), action] })
  }

  function updateAction(actionId, partial) {
    const actions = (effect.actions || []).map(a => a.id === actionId ? { ...a, ...partial } : a)
    updateEffect(effect.id, { actions })
  }

  function removeAction(actionId) {
    updateEffect(effect.id, { actions: (effect.actions || []).filter(a => a.id !== actionId) })
  }

  const statuses = Object.values(campaign?.statuses || {})

  return (
    <div className={styles.editor}>
      {/* Name + description */}
      <div className={styles.editorRow}>
        <div className={styles.editorField}>
          <label>Name</label>
          <input type="text" {...nameField} placeholder="Effect name…" />
        </div>
      </div>

      <div className={styles.editorField}>
        <label>Description</label>
        <textarea rows={2} {...descField} placeholder="What does this effect do?" style={{ resize: 'vertical' }} />
      </div>

      {/* Target type */}
      <div className={styles.editorField}>
        <label>Target type</label>
        <div className={styles.btnGroup}>
          {TARGET_TYPES.map(t => (
            <button key={t.id}
              className={`${styles.groupBtn} ${effect.targetType === t.id ? styles.groupBtnActive : ''}`}
              onClick={() => updateEffect(effect.id, { targetType: t.id })}
              title={t.label}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Target-type-specific options */}
      {effect.targetType === 'tile_aoe' && (
        <div className={styles.editorField}>
          <label>AoE Pattern <span className={styles.subLabel}>({effect.aoePattern?.length || 0} cells around root)</span></label>
          <button className={styles.aoeBtn} onClick={() => setShowAoeEditor(true)}>
            ✏️ Edit Pattern
          </button>
          {showAoeEditor && (
            <AoePatternEditor
              value={effect.aoePattern || []}
              onChange={pattern => updateEffect(effect.id, { aoePattern: pattern })}
              tileStyle={tileStyle}
              onClose={() => setShowAoeEditor(false)}
            />
          )}
        </div>
      )}

      {(effect.targetType === 'tile_select' || effect.targetType === 'char_select') && (
        <div className={styles.editorField} style={{ maxWidth: 160 }}>
          <label>
            {effect.targetType === 'tile_select' ? 'Number of tiles' : 'Number of characters'}
          </label>
          <input type="number" min={1} max={20} value={effect.targetCount || 1}
            onChange={e => updateEffect(effect.id, { targetCount: Math.max(1, parseInt(e.target.value) || 1) })} />
        </div>
      )}

      {/* Duration type */}
      <div className={styles.editorField}>
        <label>Duration</label>
        <div className={styles.btnGroup}>
          {DURATION_TYPES.map(d => (
            <button key={d.id}
              className={`${styles.groupBtn} ${effect.durationType === d.id ? styles.groupBtnActive : ''}`}
              onClick={() => updateEffect(effect.id, { durationType: d.id })}
              title={d.desc}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.editorField}>
        <label>Actions</label>
        {(effect.actions || []).length === 0 && (
          <div className={styles.emptyHint}>No actions yet — this effect won't do anything.</div>
        )}
        {(effect.actions || []).map(action => (
          <ActionRow
            key={action.id}
            action={action}
            statuses={statuses}
            onUpdate={partial => updateAction(action.id, partial)}
            onRemove={() => removeAction(action.id)}
          />
        ))}
        <button className={styles.addActionBtn} onClick={addAction}>+ Add action</button>
      </div>

      {/* Use effect */}
      <button className={styles.useEffectBtn} onClick={onUse}>
        ▶ Use Effect
      </button>

      {/* Delete */}
      <div className={styles.deleteRow}>
        {deleteConfirm ? (
          <>
            <span className={styles.deleteWarning}>Delete "{effect.name}"?</span>
            <button className={styles.deleteBtnConfirm} onClick={onDelete}>Yes, delete</button>
            <button className={styles.deleteBtnCancel} onClick={onCancelDelete}>Cancel</button>
          </>
        ) : (
          <button className={styles.deleteBtn} onClick={onDelete}>Delete effect</button>
        )}
      </div>
    </div>
  )
}

// ── Action row ────────────────────────────────────────────────
function ActionRow({ action, statuses, onUpdate, onRemove }) {
  const [diceError, setDiceError] = useState(false)

  return (
    <div className={styles.actionRow}>
      <div className={styles.actionType}>
        <button
          className={`${styles.actionTypeBtn} ${action.type === 'damage' ? styles.actionTypeBtnActive : ''}`}
          onClick={() => onUpdate({ type: 'damage' })}
        >⚔️ Damage</button>
        <button
          className={`${styles.actionTypeBtn} ${action.type === 'apply_status' ? styles.actionTypeBtnActive : ''}`}
          onClick={() => onUpdate({ type: 'apply_status' })}
        >✨ Apply Status</button>
      </div>

      {action.type === 'damage' && (
        <div className={styles.actionFields}>
          <div className={styles.editorField}>
            <label>Dice <span className={styles.subLabel}>(e.g. 2d6, d8+3)</span></label>
            <input
              type="text"
              value={action.diceExpr || ''}
              style={diceError ? { borderColor: '#c25a4a' } : {}}
              onChange={e => {
                setDiceError(e.target.value && !isValidDiceExpr(e.target.value))
                onUpdate({ diceExpr: e.target.value })
              }}
              placeholder="2d6"
            />
          </div>
          <div className={styles.editorField} style={{ maxWidth: 80 }}>
            <label>Flat dmg</label>
            <input type="number" value={action.flatAmount || 0}
              onChange={e => onUpdate({ flatAmount: parseInt(e.target.value) || 0 })} />
          </div>
        </div>
      )}

      {action.type === 'apply_status' && (
        <div className={styles.actionFields}>
          <div className={styles.editorField}>
            <label>Status to apply</label>
            {statuses.length === 0 ? (
              <div className={styles.emptyHint}>No statuses defined yet. Create one in the Statuses tab.</div>
            ) : (
              <select value={action.statusId || ''} onChange={e => onUpdate({ statusId: e.target.value })}>
                <option value="">— select a status —</option>
                {statuses.map(s => (
                  <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <button className={styles.removeActionBtn} onClick={onRemove} title="Remove action">×</button>
    </div>
  )
}
