import React, { useState } from 'react'
import { useStore, makeStatus } from '../../store/useStore'
import { useDebouncedField } from '../../utils/useDebouncedStore'
import styles from './StatusLibrary.module.css'

const STATUS_COLORS = [
  '#c25a4a', '#c8a96e', '#7bc47f', '#5b9bd5',
  '#9b7bc4', '#c8709a', '#4ab0c8', '#9a9790',
]

const STATUS_ICONS = [
  '🔥','💧','❄️','⚡','☠️','💀','🩸','💚','💛','💜','🖤','🤍',
  '⚠️','🛡️','⚔️','🗡️','🏹','🔮','✨','💫','🌀','🌫️','🌊','🌪️',
  '😵','😴','😤','🤢','🥵','🥶','😰','🤩','😇','🤬','😈','👻',
  '🦠','🕸️','🔱','⚜️','🌟','💥','🔴','🟡','🟢','🔵','🟣','⚫',
  '👁️','🦷','🦴','🫀','🧠','🐍','🦂','🕷️','🐾','🌿','🌑','☄️',
]

const CHAR_STATS = [
  { key: 'hp',        label: 'HP',         hint: 'immediate — not reversed on removal' },
  { key: 'maxHp',     label: 'Max HP',     hint: 'temporary' },
  { key: 'ac',        label: 'AC',         hint: 'temporary' },
  { key: 'speed',     label: 'Speed',      hint: 'temporary' },
  { key: 'initiative',label: 'Initiative', hint: 'temporary' },
]

// ── Exported StatusPill — used across the app ─────────────────
export function StatusPill({ statusId, campaign, onRemove }) {
  const status = campaign?.statuses?.[statusId]
  if (!status) return null
  return (
    <span className={styles.pill} style={{
      background: status.color + '28',
      border: `1px solid ${status.color}66`,
      color: status.color,
    }}>
      {status.icon && <span className={styles.pillIcon}>{status.icon}</span>}
      {status.name}
      {onRemove && (
        <button className={styles.pillRemove} onClick={e => { e.stopPropagation(); onRemove() }} title="Remove status">×</button>
      )}
    </span>
  )
}

export default function StatusLibrary() {
  const { campaign, addStatus, deleteStatus } = useStore()
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const statuses = Object.values(campaign?.statuses || {})
    .sort((a, b) => a.name.localeCompare(b.name))

  const filtered = statuses.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleDelete(id) {
    if (deleteConfirm === id) {
      deleteStatus(id)
      setDeleteConfirm(null)
      if (expanded === id) setExpanded(null)
    } else {
      setDeleteConfirm(id)
    }
  }

  return (
    <div className={styles.library}>
      <div className={styles.toolbar}>
        <input className={styles.search} type="text" placeholder="Search statuses…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <button className={styles.addBtn} onClick={() => { const id = addStatus(); setExpanded(id) }}>
          + New
        </button>
      </div>

      {filtered.length === 0 && (
        <div className={styles.empty}>
          {search ? 'No statuses match.' : 'No statuses yet. Create one to get started.'}
        </div>
      )}

      {filtered.map(s => (
        <div key={s.id} className={styles.card}>
          <div className={styles.cardHeader} onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
            <span className={styles.colorDot} style={{ background: s.color }}>{s.icon || ''}</span>
            <div className={styles.cardTitle}>
              <span className={styles.cardName}>{s.name || 'Unnamed'}</span>
              <span className={styles.cardMeta}>
                {s.eligibleTargets === 'tiles' ? 'Tiles' : 'Characters'}
                {s.modifiers?.length > 0 && ` · ${s.modifiers.length} modifier${s.modifiers.length !== 1 ? 's' : ''}`}
                {s.negatingTraits?.length > 0 && ` · Negated by: ${s.negatingTraits.join(', ')}`}
              </span>
            </div>
            <span className={styles.chevron}>{expanded === s.id ? '▲' : '▼'}</span>
          </div>

          {expanded === s.id && (
            <StatusEditor
              status={s}
              campaign={campaign}
              deleteConfirm={deleteConfirm === s.id}
              onDelete={() => handleDelete(s.id)}
              onCancelDelete={() => setDeleteConfirm(null)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Status editor ─────────────────────────────────────────────
function StatusEditor({ status, campaign, deleteConfirm, onDelete, onCancelDelete }) {
  const { updateStatus } = useStore()
  const [negatingDraft, setNegatingDraft] = useState((status.negatingTraits || []).join(', '))
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  const nameField = useDebouncedField(status.name, v => updateStatus(status.id, { name: v }))
  const descField = useDebouncedField(status.description, v => updateStatus(status.id, { description: v }))

  React.useEffect(() => {
    setNegatingDraft((status.negatingTraits || []).join(', '))
  }, [status.id])

  const otherStatuses = Object.values(campaign?.statuses || {}).filter(s => s.id !== status.id)
  const eligibleTargets = status.eligibleTargets || 'characters'
  const modifiers = status.modifiers || []

  function toggleBlocks(targetId) {
    const blocks = status.blocks || []
    const next = blocks.includes(targetId)
      ? blocks.filter(id => id !== targetId)
      : [...blocks, targetId]
    updateStatus(status.id, { blocks: next })
  }

  // ── Modifier helpers ──────────────────────────────────────────
  function addStatModifier() {
    const newMod = { id: Math.random().toString(36).slice(2, 10), type: 'stat', stat: 'ac', value: 1 }
    updateStatus(status.id, { modifiers: [...modifiers, newMod] })
  }

  function updateModifier(modId, changes) {
    updateStatus(status.id, {
      modifiers: modifiers.map(m => m.id === modId ? { ...m, ...changes } : m)
    })
  }

  function removeModifier(modId) {
    updateStatus(status.id, { modifiers: modifiers.filter(m => m.id !== modId) })
  }

  // For tiles: at most one setWalkable modifier
  function setTileWalkableModifier(value) {
    // value: true (make walkable), false (make unwalkable), null (no modifier)
    const withoutWalkable = modifiers.filter(m => m.type !== 'setWalkable')
    if (value === null) {
      updateStatus(status.id, { modifiers: withoutWalkable })
    } else {
      const newMod = { id: Math.random().toString(36).slice(2, 10), type: 'setWalkable', value }
      updateStatus(status.id, { modifiers: [...withoutWalkable, newMod] })
    }
  }

  const walkableMod = modifiers.find(m => m.type === 'setWalkable')
  const walkableValue = walkableMod ? walkableMod.value : null

  return (
    <div className={styles.editor}>
      <div className={styles.editorRow}>
        <div className={styles.editorField}>
          <label>Name</label>
          <input type="text" {...nameField} placeholder="Status name…" />
        </div>
        <div className={styles.editorField} style={{ flex: '0 0 auto' }}>
          <label>Icon</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setIconPickerOpen(o => !o)}
              style={{ fontSize: 22, width: 40, height: 40, borderRadius: 8, border: `1px solid ${iconPickerOpen ? 'var(--accent)' : 'var(--border-strong)'}`, background: 'var(--bg-overlay)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Pick an icon"
            >
              {status.icon || '·'}
            </button>
            <input type="text" value={status.icon || ''} maxLength={4}
              onChange={e => updateStatus(status.id, { icon: e.target.value })}
              placeholder="type…"
              style={{ width: 60, fontSize: 13 }} />
          </div>
        </div>
      </div>

      {iconPickerOpen && (
        <div className={styles.editorField}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3, padding: 8, background: 'var(--bg-overlay)', borderRadius: 8, border: '1px solid var(--border-strong)' }}>
            {STATUS_ICONS.map(icon => (
              <button key={icon}
                onClick={() => { updateStatus(status.id, { icon }); setIconPickerOpen(false) }}
                style={{ fontSize: 18, padding: 4, border: status.icon === icon ? '1px solid var(--accent)' : '1px solid transparent', borderRadius: 5, background: status.icon === icon ? 'rgba(200,169,110,0.2)' : 'transparent', cursor: 'pointer', lineHeight: 1 }}
                title={icon}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.editorField}>
        <label>Description</label>
        <textarea rows={2} {...descField} placeholder="What does this status do?" style={{ resize: 'vertical' }} />
      </div>

      <div className={styles.editorField}>
        <label>Color</label>
        <div className={styles.colorRow}>
          {STATUS_COLORS.map(c => (
            <button key={c} className={`${styles.colorSwatch} ${status.color === c ? styles.colorSwatchActive : ''}`}
              style={{ background: c }} onClick={() => updateStatus(status.id, { color: c })} />
          ))}
          <input type="color" value={status.color || '#c25a4a'}
            onChange={e => updateStatus(status.id, { color: e.target.value })}
            title="Custom color" className={styles.colorPicker} />
          <span className={styles.pillPreview}>
            <StatusPill statusId={status.id} campaign={campaign} />
          </span>
        </div>
      </div>

      {/* ── Eligible Targets ────────────────────────────────────── */}
      <div className={styles.editorField}>
        <label>Eligible targets</label>
        <div className={styles.targetRow}>
          {['characters', 'tiles'].map(t => (
            <button
              key={t}
              className={`${styles.targetBtn} ${eligibleTargets === t ? styles.targetBtnActive : ''}`}
              onClick={() => updateStatus(status.id, { eligibleTargets: t })}
            >
              {t === 'characters' ? '🧑 Characters' : '🗺️ Tiles'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Modifiers ───────────────────────────────────────────── */}
      <div className={styles.editorField}>
        <label>
          Modifiers
          {eligibleTargets === 'characters' && (
            <span className={styles.subLabel}> (applied while status is active; HP is immediate, others are reversed on removal)</span>
          )}
        </label>

        {eligibleTargets === 'characters' && (
          <div className={styles.modifiersList}>
            {modifiers.filter(m => m.type === 'stat').map(mod => (
              <div key={mod.id} className={styles.modifierRow}>
                <select
                  value={mod.stat}
                  onChange={e => updateModifier(mod.id, { stat: e.target.value })}
                  className={styles.modifierSelect}
                >
                  {CHAR_STATS.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={mod.value}
                  onChange={e => updateModifier(mod.id, { value: parseInt(e.target.value, 10) || 0 })}
                  className={styles.modifierValue}
                  title="Positive to add, negative to subtract"
                />
                <span className={styles.modifierHint}>
                  {CHAR_STATS.find(s => s.key === mod.stat)?.hint}
                </span>
                <button className={styles.modifierRemove} onClick={() => removeModifier(mod.id)} title="Remove">×</button>
              </div>
            ))}
            <button className={styles.modifierAddBtn} onClick={addStatModifier}>+ Add stat modifier</button>
          </div>
        )}

        {eligibleTargets === 'tiles' && (
          <div className={styles.modifiersList}>
            <div className={styles.editorField}>
              <label>Walkable</label>
              <div className={styles.targetRow}>
                {[
                  { label: 'No change', value: null },
                  { label: 'Make Walkable', value: true },
                  { label: 'Make Un-Walkable', value: false },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    className={`${styles.targetBtn} ${walkableValue === opt.value ? styles.targetBtnActive : ''}`}
                    onClick={() => setTileWalkableModifier(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.editorField}>
              <label>Apply to characters on tile</label>
              {modifiers.filter(m => m.type === 'applyToCharacters').map(mod => {
                const target = campaign?.statuses?.[mod.statusId]
                return (
                  <div key={mod.id} className={styles.applyToCharsRow}>
                    {target
                      ? <span className={styles.pill} style={{ background: target.color + '28', border: `1px solid ${target.color}66`, color: target.color }}>
                          {target.icon && <span className={styles.pillIcon}>{target.icon}</span>}
                          {target.name}
                        </span>
                      : <span className={styles.emptyHint}>Unknown status</span>
                    }
                    <button
                      className={`${styles.lingerBtn} ${mod.lingering ? styles.lingerBtnActive : ''}`}
                      onClick={() => updateModifier(mod.id, { lingering: !mod.lingering })}
                      title={mod.lingering ? 'Status lingers after leaving tile — click to make it expire on exit' : 'Status expires when character leaves tile — click to make it linger'}
                    >
                      {mod.lingering ? 'Lingers' : 'Removed on exit'}
                    </button>
                    <button className={styles.modifierRemove} onClick={() => removeModifier(mod.id)} title="Remove">×</button>
                  </div>
                )
              })}
              <ApplyToCharsAdder
                campaign={campaign}
                existing={modifiers.filter(m => m.type === 'applyToCharacters').map(m => m.statusId)}
                onAdd={statusId => {
                  const newMod = { id: Math.random().toString(36).slice(2, 10), type: 'applyToCharacters', statusId }
                  updateStatus(status.id, { modifiers: [...modifiers, newMod] })
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className={styles.editorField}>
        <label>Negating traits <span className={styles.subLabel}>(comma-separated — targets with any of these traits are immune)</span></label>
        <input type="text"
          value={negatingDraft}
          onChange={e => setNegatingDraft(e.target.value)}
          onBlur={e => updateStatus(status.id, { negatingTraits: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="undead, construct, fire-immune…" />
      </div>

      <div className={styles.editorField}>
        <label>Blocks these statuses <span className={styles.subLabel}>(targets with this status cannot receive these)</span></label>
        {otherStatuses.length === 0 ? (
          <div className={styles.emptyHint}>No other statuses defined yet.</div>
        ) : (
          <div className={styles.blocksList}>
            {otherStatuses.map(s => (
              <label key={s.id} className={styles.blocksItem}>
                <input type="checkbox"
                  checked={(status.blocks || []).includes(s.id)}
                  onChange={() => toggleBlocks(s.id)} />
                <span className={styles.blocksItemDot} style={{ background: s.color }} />
                {s.icon && <span>{s.icon}</span>}
                <span>{s.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className={styles.deleteRow}>
        {deleteConfirm ? (
          <>
            <span className={styles.deleteWarning}>Delete "{status.name}"?</span>
            <button className={styles.deleteBtnConfirm} onClick={onDelete}>Yes, delete</button>
            <button className={styles.deleteBtnCancel} onClick={onCancelDelete}>Cancel</button>
          </>
        ) : (
          <button className={styles.deleteBtn} onClick={onDelete}>Delete status</button>
        )}
      </div>
    </div>
  )
}

// ── Small adder for applyToCharacters modifiers ───────────────
function ApplyToCharsAdder({ campaign, existing, onAdd }) {
  const [open, setOpen] = useState(false)
  const candidates = Object.values(campaign?.statuses || {}).filter(s =>
    (s.eligibleTargets === 'characters' || !s.eligibleTargets) && !existing.includes(s.id)
  ).sort((a, b) => a.name.localeCompare(b.name))

  if (!open) {
    return (
      <button className={styles.modifierAddBtn} onClick={() => setOpen(true)}>
        + Add status to apply
      </button>
    )
  }

  return (
    <div className={styles.applyToCharsAdder}>
      <select
        autoFocus
        defaultValue=""
        className={styles.modifierSelect}
        onChange={e => { if (e.target.value) { onAdd(e.target.value); setOpen(false) } }}
        onBlur={() => setOpen(false)}
        style={{ flex: 1 }}
      >
        <option value="" disabled>Pick a character status…</option>
        {candidates.length === 0 && <option disabled>No character statuses available</option>}
        {candidates.map(s => (
          <option key={s.id} value={s.id}>{s.icon ? `${s.icon} ` : ''}{s.name}</option>
        ))}
      </select>
      <button className={styles.deleteBtnCancel} onClick={() => setOpen(false)}>Cancel</button>
    </div>
  )
}
