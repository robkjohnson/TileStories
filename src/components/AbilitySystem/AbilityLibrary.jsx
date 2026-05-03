import React, { useState } from 'react'
import { useStore, ABILITY_CATEGORIES, DAMAGE_TYPES, ACTION_COSTS, RANGE_TYPES, SAVE_STATS } from '../../store/useStore'
import { formatDamage, isValidDice } from '../../utils/dice'
import styles from './AbilityLibrary.module.css'
import { useDebouncedField } from '../../utils/useDebouncedStore'

export default function AbilityLibrary() {
  const { campaign, addAbilityTemplate, updateAbilityTemplate, deleteAbilityTemplate } = useStore()
  const [expanded, setExpanded] = useState(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const templates = Object.values(campaign?.abilities || {})
    .sort((a, b) => a.name.localeCompare(b.name))

  const filtered = templates.filter(t => {
    if (filterCat !== 'all' && t.category !== filterCat) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) &&
        !t.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })

  function handleCreate() {
    const id = addAbilityTemplate()
    setCreating(false)
    setExpanded(id)
  }

  return (
    <div className={styles.library}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input className={styles.search} type="text" placeholder="Search abilities…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <button className={styles.addBtn} onClick={handleCreate}>+ New ability</button>
      </div>

      {/* Category filter */}
      <div className={styles.filterRow}>
        <button className={`${styles.filterBtn} ${filterCat === 'all' ? styles.filterActive : ''}`}
          onClick={() => setFilterCat('all')}>All ({templates.length})</button>
        {Object.entries(ABILITY_CATEGORIES).map(([key, def]) => (
          <button key={key}
            className={`${styles.filterBtn} ${filterCat === key ? styles.filterActive : ''}`}
            style={filterCat === key ? { borderColor: def.color, color: def.color } : {}}
            onClick={() => setFilterCat(key)}>
            {def.icon} {def.label} ({templates.filter(t => t.category === key).length})
          </button>
        ))}
      </div>

      {/* Template list */}
      {filtered.length === 0
        ? <div className={styles.empty}>
            {templates.length === 0 ? 'No abilities yet — create your first template' : 'No matches'}
          </div>
        : filtered.map(tmpl => (
          <AbilityTemplateRow
            key={tmpl.id}
            template={tmpl}
            expanded={expanded === tmpl.id}
            onToggle={() => setExpanded(expanded === tmpl.id ? null : tmpl.id)}
            onUpdate={partial => updateAbilityTemplate(tmpl.id, partial)}
            onDelete={() => deleteConfirm === tmpl.id
              ? deleteAbilityTemplate(tmpl.id)
              : setDeleteConfirm(tmpl.id)
            }
            deleteConfirm={deleteConfirm === tmpl.id}
            onCancelDelete={() => setDeleteConfirm(null)}
          />
        ))
      }
    </div>
  )
}

// ── Single template row ───────────────────────────────────────
function AbilityTemplateRow({ template: tmpl, expanded, onToggle, onUpdate, onDelete, deleteConfirm, onCancelDelete }) {
  const cat = ABILITY_CATEGORIES[tmpl.category] || ABILITY_CATEGORIES.attack
  const dmgDisplay = formatDamage(tmpl.damageDice, tmpl.damageType, tmpl.damageBonus)
  const actionDef = ACTION_COSTS.find(a => a.id === tmpl.actionCost)
  const usesText = tmpl.usesPerRest ? `${tmpl.usesPerRest}/${tmpl.restType} rest` : 'Unlimited'

  return (
    <div className={styles.templateCard}>
      {/* Header */}
      <div className={styles.cardHeader} onClick={onToggle}>
        <span className={styles.catDot} style={{ background: cat.color }}>{cat.icon}</span>
        <div className={styles.cardTitle}>
          <span className={styles.cardName}>{tmpl.name}</span>
          <span className={styles.cardMeta}>
            {actionDef?.label} · {usesText}
            {dmgDisplay && <> · {dmgDisplay}</>}
          </span>
        </div>
        {tmpl.tags?.length > 0 && (
          <div className={styles.tagRow}>
            {tmpl.tags.slice(0, 3).map(t => <span key={t} className={styles.tag}>{t}</span>)}
          </div>
        )}
        <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Editor */}
      {expanded && (
        <AbilityEditor
          template={tmpl}
          onUpdate={onUpdate}
          onDelete={onDelete}
          deleteConfirm={deleteConfirm}
          onCancelDelete={onCancelDelete}
        />
      )}
    </div>
  )
}

function DebouncedAbilityTextarea({ storeValue, onUpdate, ...rest }) {
  const field = useDebouncedField(storeValue, onUpdate)
  return <textarea rows={3} style={{ resize: 'vertical' }} {...field} {...rest} />
}

function DebouncedAbilityInput({ storeValue, onUpdate, ...rest }) {
  const field = useDebouncedField(storeValue, onUpdate)
  return <input type="text" {...field} {...rest} />
}

// ── Full ability editor ───────────────────────────────────────
function AbilityEditor({ template: tmpl, onUpdate, onDelete, deleteConfirm, onCancelDelete }) {
  const [diceError, setDiceError] = useState(false)
  const [diceError2, setDiceError2] = useState(false)
  const [conditionsDraft, setConditionsDraft] = useState((tmpl.conditions || []).join(', '))
  const [tagsDraft, setTagsDraft] = useState((tmpl.tags || []).join(', '))

  React.useEffect(() => {
    setConditionsDraft((tmpl.conditions || []).join(', '))
    setTagsDraft((tmpl.tags || []).join(', '))
  }, [tmpl.id])

  function handleDiceChange(key, val, setErr) {
    setErr(!isValidDice(val))
    onUpdate({ [key]: val })
  }

  const cat = ABILITY_CATEGORIES[tmpl.category] || ABILITY_CATEGORIES.attack
  const isAoe = tmpl.range === 'aoe'
  const isRanged = tmpl.range === 'ranged'
  const hasSave = !!tmpl.saveStat
  const hasUses = !!tmpl.usesPerRest

  return (
    <div className={styles.editor}>

      {/* Name + Category */}
      <div className={styles.editorRow}>
        <div className={styles.editorField} style={{ flex: 2 }}>
          <label>Name</label>
          <DebouncedAbilityInput storeValue={tmpl.name} onUpdate={v => onUpdate({ name: v })} placeholder="Ability name…" />
        </div>
        <div className={styles.editorField}>
          <label>Category</label>
          <div className={styles.catGrid}>
            {Object.entries(ABILITY_CATEGORIES).map(([key, def]) => (
              <button key={key}
                className={`${styles.catBtn} ${tmpl.category === key ? styles.catBtnActive : ''}`}
                style={tmpl.category === key ? { borderColor: def.color, color: def.color } : {}}
                onClick={() => onUpdate({ category: key })}>
                {def.icon} {def.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className={styles.editorField}>
        <label>Description</label>
        <DebouncedAbilityTextarea storeValue={tmpl.description} onUpdate={v => onUpdate({ description: v })} placeholder="What this ability does…" />
      </div>

      {/* Action + Range */}
      <div className={styles.editorRow}>
        <div className={styles.editorField}>
          <label>Action cost</label>
          <div className={styles.btnGroup}>
            {ACTION_COSTS.map(a => (
              <button key={a.id}
                className={`${styles.groupBtn} ${tmpl.actionCost === a.id ? styles.groupBtnActive : ''}`}
                onClick={() => onUpdate({ actionCost: a.id })}>{a.label}</button>
            ))}
          </div>
        </div>
        <div className={styles.editorField}>
          <label>Range</label>
          <div className={styles.btnGroup}>
            {RANGE_TYPES.map(r => (
              <button key={r.id}
                className={`${styles.groupBtn} ${tmpl.range === r.id ? styles.groupBtnActive : ''}`}
                onClick={() => onUpdate({ range: r.id })}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Range distance */}
      {isRanged && (
        <div className={styles.editorRow}>
          <div className={styles.editorField}>
            <label>Range distance (ft)</label>
            <input type="number" value={tmpl.rangeDistance || ''} min={0}
              onChange={e => onUpdate({ rangeDistance: parseInt(e.target.value) || null })} />
          </div>
        </div>
      )}

      {/* AoE shape + size */}
      {isAoe && (
        <div className={styles.editorRow}>
          <div className={styles.editorField}>
            <label>AoE shape</label>
            <div className={styles.btnGroup}>
              {['cone','line','sphere','cube'].map(s => (
                <button key={s}
                  className={`${styles.groupBtn} ${tmpl.aoeShape === s ? styles.groupBtnActive : ''}`}
                  onClick={() => onUpdate({ aoeShape: s })}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
              ))}
            </div>
          </div>
          <div className={styles.editorField}>
            <label>Size (ft)</label>
            <input type="number" value={tmpl.aoeSize || 15} min={5} step={5}
              onChange={e => onUpdate({ aoeSize: parseInt(e.target.value) || 15 })} />
          </div>
        </div>
      )}

      {/* Damage */}
      <div className={styles.sectionDivider}>Damage</div>
      <div className={styles.editorRow}>
        <div className={styles.editorField}>
          <label>Dice notation {diceError && <span className={styles.diceErr}>invalid</span>}</label>
          <input type="text" value={tmpl.damageDice || ''}
            onChange={e => handleDiceChange('damageDice', e.target.value, setDiceError)}
            placeholder="e.g. 2d6, 1d8, 3d4"
            style={diceError ? { borderColor: 'var(--danger)' } : {}} />
        </div>
        <div className={styles.editorField}>
          <label>Damage type</label>
          <select value={tmpl.damageType || 'none'}
            onChange={e => onUpdate({ damageType: e.target.value })}>
            {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div className={styles.editorField} style={{ maxWidth: 80 }}>
          <label>Bonus</label>
          <input type="number" value={tmpl.damageBonus || 0}
            onChange={e => onUpdate({ damageBonus: parseInt(e.target.value) || 0 })} />
        </div>
      </div>

      {/* Secondary damage */}
      <div className={styles.editorRow}>
        <div className={styles.editorField}>
          <label>Secondary dice {diceError2 && <span className={styles.diceErr}>invalid</span>}</label>
          <input type="text" value={tmpl.secondaryDamageDice || ''}
            onChange={e => handleDiceChange('secondaryDamageDice', e.target.value, setDiceError2)}
            placeholder="e.g. 1d4 (ongoing)" />
        </div>
        <div className={styles.editorField}>
          <label>Type</label>
          <select value={tmpl.secondaryDamageType || 'none'}
            onChange={e => onUpdate({ secondaryDamageType: e.target.value })}>
            {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div className={styles.editorField} style={{ flex: 2 }}>
          <label>Note</label>
          <input type="text" value={tmpl.secondaryDamageDesc || ''}
            onChange={e => onUpdate({ secondaryDamageDesc: e.target.value })}
            placeholder="e.g. On fire, takes this at start of turn" />
        </div>
      </div>

      {/* Saving throw */}
      <div className={styles.sectionDivider}>Saving throw & Uses</div>
      <div className={styles.editorRow}>
        <div className={styles.editorField}>
          <label>Saving throw</label>
          <div className={styles.btnGroup}>
            <button className={`${styles.groupBtn} ${!tmpl.saveStat ? styles.groupBtnActive : ''}`}
              onClick={() => onUpdate({ saveStat: null })}>None</button>
            {SAVE_STATS.map(s => (
              <button key={s}
                className={`${styles.groupBtn} ${tmpl.saveStat === s ? styles.groupBtnActive : ''}`}
                onClick={() => onUpdate({ saveStat: s })}>{s}</button>
            ))}
          </div>
        </div>
        {hasSave && (
          <div className={styles.editorField} style={{ maxWidth: 80 }}>
            <label>Save DC</label>
            <input type="number" value={tmpl.saveDC || 13} min={1} max={30}
              onChange={e => onUpdate({ saveDC: parseInt(e.target.value) || 13 })} />
          </div>
        )}
      </div>

      {/* Uses per rest */}
      <div className={styles.editorRow}>
        <div className={styles.editorField}>
          <label>Uses per rest</label>
          <div className={styles.btnGroup}>
            <button className={`${styles.groupBtn} ${!tmpl.usesPerRest ? styles.groupBtnActive : ''}`}
              onClick={() => onUpdate({ usesPerRest: null })}>Unlimited</button>
            {[1,2,3,4,5].map(n => (
              <button key={n}
                className={`${styles.groupBtn} ${tmpl.usesPerRest === n ? styles.groupBtnActive : ''}`}
                onClick={() => onUpdate({ usesPerRest: n })}>{n}</button>
            ))}
          </div>
        </div>
        {hasUses && (
          <div className={styles.editorField}>
            <label>Rest type</label>
            <div className={styles.btnGroup}>
              <button className={`${styles.groupBtn} ${tmpl.restType === 'short' ? styles.groupBtnActive : ''}`}
                onClick={() => onUpdate({ restType: 'short' })}>Short rest</button>
              <button className={`${styles.groupBtn} ${tmpl.restType === 'long' ? styles.groupBtnActive : ''}`}
                onClick={() => onUpdate({ restType: 'long' })}>Long rest</button>
            </div>
          </div>
        )}
      </div>

      {/* Conditions */}
      <div className={styles.sectionDivider}>Conditions & Tags</div>
      <div className={styles.editorField}>
        <label>Conditions applied <span className={styles.subLabel}>(comma-separated)</span></label>
        <input type="text"
          value={conditionsDraft}
          onChange={e => setConditionsDraft(e.target.value)}
          onBlur={e => onUpdate({ conditions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="poisoned, frightened, paralyzed…" />
      </div>

      <div className={styles.editorField}>
        <label>Tags <span className={styles.subLabel}>(comma-separated, used for search)</span></label>
        <input type="text"
          value={tagsDraft}
          onChange={e => setTagsDraft(e.target.value)}
          onBlur={e => onUpdate({ tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="cryptid, fire, signature, ranged…" />
      </div>

      {/* Preview */}
      {(tmpl.damageDice || tmpl.description) && (
        <div className={styles.preview}>
          <div className={styles.previewLabel}>Preview</div>
          <AbilityCard template={tmpl} compact />
        </div>
      )}

      {/* Delete */}
      <div className={styles.deleteRow}>
        {deleteConfirm ? (
          <>
            <span className={styles.deleteWarning}>This will remove it from all creatures and characters.</span>
            <button className={styles.deleteConfirmBtn} onClick={onDelete}>Confirm delete</button>
            <button className={styles.cancelBtn} onClick={onCancelDelete}>Cancel</button>
          </>
        ) : (
          <button className={styles.deleteBtn} onClick={onDelete}>🗑 Delete template</button>
        )}
      </div>
    </div>
  )
}

// ── Ability card — used in preview and on creature/char sheets ──
export function AbilityCard({ template: tmpl, instance, compact, onUse }) {
  if (!tmpl) return null
  const cat = ABILITY_CATEGORIES[tmpl.category] || ABILITY_CATEGORIES.attack
  const dmg = formatDamage(tmpl.damageDice, tmpl.damageType, tmpl.damageBonus)
  const actionDef = ACTION_COSTS.find(a => a.id === tmpl.actionCost)
  const uses = instance?.usesRemaining ?? tmpl.usesPerRest
  const maxUses = tmpl.usesPerRest

  return (
    <div className={`${styles.abilityCard} ${compact ? styles.abilityCardCompact : ''}`}
      style={{ borderLeftColor: cat.color }}>
      <div className={styles.abilityCardHeader}>
        <span className={styles.abilityIcon}>{cat.icon}</span>
        <span className={styles.abilityName}>{tmpl.name}</span>
        <span className={styles.abilityAction} style={{ color: cat.color }}>{actionDef?.label}</span>
        {maxUses && (
          <div className={styles.usesPips}>
            {Array.from({ length: maxUses }).map((_, i) => (
              <span key={i} className={`${styles.pip} ${uses !== null && i >= uses ? styles.pipUsed : ''}`} />
            ))}
          </div>
        )}
        {onUse && uses !== 0 && (
          <button className={styles.useBtn} style={{ background: cat.color }} onClick={onUse}>Use</button>
        )}
      </div>
      {!compact && tmpl.description && (
        <div className={styles.abilityDesc}>{tmpl.description}</div>
      )}
      <div className={styles.abilityStats}>
        {dmg && <span className={styles.abilityStat}>💥 {dmg}</span>}
        {tmpl.saveStat && <span className={styles.abilityStat}>🎯 DC {tmpl.saveDC} {tmpl.saveStat}</span>}
        {tmpl.range === 'aoe' && <span className={styles.abilityStat}>📐 {tmpl.aoeSize}ft {tmpl.aoeShape}</span>}
        {tmpl.range === 'ranged' && tmpl.rangeDistance && <span className={styles.abilityStat}>🏹 {tmpl.rangeDistance}ft</span>}
        {tmpl.conditions?.length > 0 && <span className={styles.abilityStat}>⚠️ {tmpl.conditions.join(', ')}</span>}
        {tmpl.secondaryDamageDice && <span className={styles.abilityStat}>🔄 {tmpl.secondaryDamageDice} {tmpl.secondaryDamageType} {tmpl.secondaryDamageDesc}</span>}
        {!maxUses && <span className={styles.abilityStat}>∞ Unlimited</span>}
        {maxUses && <span className={styles.abilityStat}>🔁 {maxUses}/{tmpl.restType} rest</span>}
      </div>
      {tmpl.tags?.length > 0 && (
        <div className={styles.tagRow}>
          {tmpl.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
        </div>
      )}
    </div>
  )
}