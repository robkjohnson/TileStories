import React, { useState } from 'react'
import { useStore, STEP_TYPES, VISIBILITY_OPTIONS, makeEvent, makeStep, rotateAoePattern } from '../../store/useStore'
import { resolveStoryboardImages } from '../../utils/imageStorage'
import styles from './EventEditor.module.css'

// ── Main event editor panel ───────────────────────────────────
export default function EventEditor({ tileQ, tileR, tile }) {
  const { campaign, addEvent, updateEvent, deleteEvent, fireEvent } = useStore()
  const [expanded, setExpanded] = useState(null)
  const [creating, setCreating] = useState(false)
  const [confirmFire, setConfirmFire] = useState(null)

  const events = tile?.events || []
  const maps = Object.values(campaign?.maps || {})
  const storyboards = Object.values(campaign?.storyboards || {})
  const effects = Object.values(campaign?.effects || {}).sort((a, b) => a.name.localeCompare(b.name))
  const activeMapId = campaign?.activeMapId

  function handleCreate(draft) {
    addEvent(tileQ, tileR, draft)
    setCreating(false)
  }

  function confirmAndFire() {
    if (!confirmFire) return
    const ev = events.find(e => e.id === confirmFire)
    fireEvent(tileQ, tileR, confirmFire)

    // Handle storyboard + message steps via WS
    if (ev?.steps) {
      ev.steps.forEach(async step => {
        if (step.type === 'storyboard' && step.storyboardId) {
          const sb = campaign?.storyboards?.[step.storyboardId]
          if (sb && window.__tilestoriesSend) {
            const resolved = await resolveStoryboardImages(sb)
            const target = step.storyboardTarget || 'player'
            if (target === 'display' || target === 'both') {
              window.__tilestoriesSend({ type: 'SHOW_STORYBOARD', storyboard: resolved })
            }
            if (target === 'player' || target === 'both') {
              window.__tilestoriesSend({ type: 'SHOW_STORYBOARD_TO_PLAYER', storyboard: resolved, tileKey: `${tileQ},${tileR}` })
            }
          }
        }
        if (step.type === 'message' && step.text && window.__tilestoriesSend) {
          window.__tilestoriesSend({ type: 'SHOW_CUTSCENE', cutscene: { title: ev.name, content: step.text, type: 'text', targets: 'all' } })
        }
      })
    }

    setConfirmFire(null)
    setExpanded(null)
  }

  const pendingEvent = events.find(e => e.id === confirmFire)

  return (
    <div className={styles.container}>
      {events.map(ev => (
        <EventRow
          key={ev.id}
          event={ev}
          expanded={expanded === ev.id}
          onToggle={() => setExpanded(expanded === ev.id ? null : ev.id)}
          onUpdate={partial => { updateEvent(tileQ, tileR, ev.id, { ...ev, ...partial }) }}
          onDelete={() => { deleteEvent(tileQ, tileR, ev.id); setExpanded(null) }}
          onFire={() => setConfirmFire(ev.id)}
          maps={maps}
          storyboards={storyboards}
          effects={effects}
          activeMapId={activeMapId}
          tileQ={tileQ}
          tileR={tileR}
        />
      ))}

      {creating && (
        <EventForm
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
          maps={maps}
          storyboards={storyboards}
          effects={effects}
          activeMapId={activeMapId}
        />
      )}

      {!creating && (
        <button className={styles.addBtn} onClick={() => setCreating(true)}>+ Add event</button>
      )}

      {pendingEvent && (
        <div className={styles.confirmFireDialog}>
          <div className={styles.confirmFireTitle}>⚡ Fire event?</div>
          <div className={styles.confirmFireName}>{pendingEvent.name || '(unnamed)'}</div>
          {pendingEvent.steps?.length > 0 && (
            <div className={styles.confirmSteps}>
              {pendingEvent.steps.map((s, i) => {
                const def = STEP_TYPES[s.type] || STEP_TYPES.message
                return <span key={i} className={styles.confirmStep}>{def.icon} {def.label}</span>
              })}
            </div>
          )}
          <div className={styles.confirmFireBtns}>
            <button className={styles.cancelBtn} onClick={() => setConfirmFire(null)}>Cancel</button>
            <button className={styles.fireBtn} onClick={confirmAndFire}>⚡ Fire</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Single event row ──────────────────────────────────────────
function EventRow({ event, expanded, onToggle, onUpdate, onDelete, onFire, maps, storyboards, effects, activeMapId, tileQ, tileR }) {
  const stepSummary = (event.steps || []).map(s => STEP_TYPES[s.type]?.icon || '•').join(' ')
  const fired = !!event.firedAt

  return (
    <div className={styles.eventRow}>
      <div className={styles.eventHeader} onClick={onToggle}>
        <span className={styles.eventSteps}>{stepSummary || '—'}</span>
        <span className={styles.eventName}>{event.name || '(unnamed)'}</span>
        {event.visibility === 'none' && <span className={styles.visBadge} title="Organizer only">🔒</span>}
        {fired && <span className={styles.firedBadge}>Fired</span>}
        <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className={styles.eventBody}>
          <EventForm
            key={event.id + '-' + (event.steps?.length || 0) + '-' + (event.firedAt || '')}
            initial={event}
            onSave={onUpdate}
            maps={maps}
            storyboards={storyboards}
            effects={effects}
            activeMapId={activeMapId}
            isEdit
            tileQ={tileQ}
            tileR={tileR}
          />
          <div className={styles.eventActions}>
            <button className={styles.fireBtn} onClick={onFire}>⚡ Fire event</button>
            <button className={styles.deleteBtn} onClick={onDelete}>Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Event form (create or edit) ───────────────────────────────
function EventForm({ initial = {}, onSave, onCancel, maps, storyboards, effects, activeMapId, isEdit, tileQ, tileR }) {
  const [name, setName] = useState(initial.name || '')
  const [description, setDescription] = useState(initial.description || '')
  const [visibility, setVisibility] = useState(initial.visibility || 'all')
  const [requiredTraits, setRequiredTraits] = useState((initial.requiredTraits || []).join(', '))
  const [steps, setSteps] = useState(initial.steps || [])

  function handleSave() {
    const traits = requiredTraits.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    onSave({
      ...initial,
      name,
      description,
      visibility,
      requiredTraits: traits,
      steps,
    })
  }

  function addStep(type) {
    setSteps(s => [...s, makeStep(type)])
  }

  function updateStep(idx, patch) {
    setSteps(s => s.map((step, i) => i === idx ? { ...step, ...patch } : step))
  }

  function removeStep(idx) {
    setSteps(s => s.filter((_, i) => i !== idx))
  }

  function moveStep(idx, dir) {
    setSteps(s => {
      const n = [...s]
      const to = idx + dir
      if (to < 0 || to >= n.length) return n
      ;[n[idx], n[to]] = [n[to], n[idx]]
      return n
    })
  }

  return (
    <div className={styles.form}>
      {/* Name */}
      <input className={styles.nameInput} placeholder="Event name…" value={name}
        onChange={e => setName(e.target.value)} />

      {/* Description */}
      <textarea className={styles.descInput} placeholder="Description (visible to players)…" rows={2}
        value={description} onChange={e => setDescription(e.target.value)} />

      {/* Visibility */}
      <div className={styles.formRow}>
        <span className={styles.formLabel}>Visibility</span>
        <select value={visibility} onChange={e => setVisibility(e.target.value)}>
          {VISIBILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
        </select>
      </div>

      {visibility === 'traits' && (
        <input className={styles.traitInput} placeholder="Required traits (comma-separated)…"
          value={requiredTraits} onChange={e => setRequiredTraits(e.target.value)} />
      )}

      {/* Steps */}
      <div className={styles.stepsLabel}>
        Steps <span className={styles.stepsHint}>(execute in order when fired)</span>
      </div>

      {steps.map((step, idx) => (
        <StepEditor
          key={step.id}
          step={step}
          idx={idx}
          total={steps.length}
          maps={maps}
          storyboards={storyboards}
          effects={effects}
          activeMapId={activeMapId}
          tileQ={tileQ}
          tileR={tileR}
          onChange={patch => updateStep(idx, patch)}
          onRemove={() => removeStep(idx)}
          onMoveUp={() => moveStep(idx, -1)}
          onMoveDown={() => moveStep(idx, 1)}
        />
      ))}

      {/* Add step buttons */}
      <div className={styles.addStepRow}>
        {Object.entries(STEP_TYPES).map(([type, def]) => (
          <button key={type} className={styles.addStepBtn}
            style={{ borderColor: def.color + '88', color: def.color }}
            onClick={() => addStep(type)}
            title={def.description}>
            {def.icon} {def.label}
          </button>
        ))}
      </div>

      {/* Save / cancel */}
      <div className={styles.formActions}>
        {onCancel && <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>}
        <button className={styles.saveBtn} onClick={handleSave} disabled={!name.trim() && steps.length === 0}>
          {isEdit ? 'Save changes' : 'Create event'}
        </button>
      </div>
    </div>
  )
}

// ── Individual step editor ────────────────────────────────────
function StepEditor({ step, idx, total, maps, storyboards, effects, activeMapId, tileQ, tileR, onChange, onRemove, onMoveUp, onMoveDown }) {
  const def = STEP_TYPES[step.type] || STEP_TYPES.message
  const { campaign, startPortalPick, endPortalPick, portalPickMode } = useStore()
  const isPicking = !!portalPickMode

  return (
    <div className={styles.stepCard} style={{ borderLeftColor: def.color }}>
      {/* Step header */}
      <div className={styles.stepHeader}>
        <span className={styles.stepIcon}>{def.icon}</span>
        <span className={styles.stepLabel} style={{ color: def.color }}>{def.label}</span>
        <div className={styles.stepControls}>
          <button className={styles.stepMoveBtn} onClick={onMoveUp} disabled={idx === 0} title="Move up">↑</button>
          <button className={styles.stepMoveBtn} onClick={onMoveDown} disabled={idx === total - 1} title="Move down">↓</button>
          <button className={styles.stepRemoveBtn} onClick={onRemove} title="Remove">×</button>
        </div>
      </div>

      {/* Step-specific settings */}
      <div className={styles.stepBody}>
        {/* Storyboard step */}
        {step.type === 'storyboard' && (
          <>
            <div className={styles.stepRow}>
              <label>Scene</label>
              <select value={step.storyboardId || ''} onChange={e => onChange({ storyboardId: e.target.value || null })}>
                <option value="">— pick a storyboard —</option>
                {storyboards.map(sb => <option key={sb.id} value={sb.id}>{sb.name}</option>)}
              </select>
            </div>
            <div className={styles.stepRow}>
              <label>Show to</label>
              <div className={styles.targetBtns}>
                {[['player','Triggering player'],['display','Display'],['both','Both']].map(([val, lbl]) => (
                  <button key={val}
                    className={`${styles.targetBtn} ${(step.storyboardTarget || 'player') === val ? styles.targetBtnActive : ''}`}
                    onClick={() => onChange({ storyboardTarget: val })}>{lbl}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Effect step */}
        {step.type === 'effect' && (
          <EffectStepEditor
            step={step}
            effects={effects}
            campaign={campaign}
            activeMapId={activeMapId}
            onChange={onChange}
          />
        )}

        {/* Portal step */}
        {step.type === 'portal' && (
          <>
            <div className={styles.stepRow}>
              <label>Dest map</label>
              <select value={step.targetMapId || ''} onChange={e => onChange({ targetMapId: e.target.value || null, targetTile: null })}>
                <option value="">— pick a map —</option>
                {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            {step.targetMapId && (
              <div className={styles.stepRow}>
                <label>Dest tile</label>
                <PortalTilePicker
                  mapId={step.targetMapId}
                  targetTile={step.targetTile}
                  onChange={tile => onChange({ targetTile: tile })}
                />
              </div>
            )}
          </>
        )}

        {/* Message step */}
        {step.type === 'message' && (
          <textarea className={styles.messageInput} rows={2}
            placeholder="Message shown to players when this event fires…"
            value={step.text || ''}
            onChange={e => onChange({ text: e.target.value })} />
        )}
      </div>
    </div>
  )
}

// ── Effect step editor ────────────────────────────────────────
function EffectStepEditor({ step, effects, campaign, activeMapId, onChange }) {
  const chosenEffect = campaign?.effects?.[step.effectId]

  function addTile(q, r) {
    if ((step.selectedTiles || []).find(t => t.q === q && t.r === r)) return
    onChange({ selectedTiles: [...(step.selectedTiles || []), { q, r }] })
  }
  function removeTile(q, r) {
    onChange({ selectedTiles: (step.selectedTiles || []).filter(t => !(t.q === q && t.r === r)) })
  }
  function toggleChar(charId) {
    const chars = step.selectedChars || []
    if (chars.includes(charId)) onChange({ selectedChars: chars.filter(id => id !== charId) })
    else onChange({ selectedChars: [...chars, charId] })
  }

  const allChars = Object.values(campaign?.characters || {})
    .filter(c => !c.hidden)
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className={styles.affectedWrap}>
      {/* Effect picker */}
      <div className={styles.stepRow}>
        <label>Effect</label>
        <select value={step.effectId || ''} onChange={e => onChange({ effectId: e.target.value || null, selectedTiles: [], selectedChars: [], aoeRotation: 0 })}>
          <option value="">— pick an effect —</option>
          {effects.map(ef => <option key={ef.id} value={ef.id}>{ef.name}</option>)}
        </select>
      </div>

      {chosenEffect && (
        <>
          {/* Tile targeting */}
          {(chosenEffect.targetType === 'single_tile' || chosenEffect.targetType === 'tile_aoe' || chosenEffect.targetType === 'tile_select') && (
            <>
              <div className={styles.stepRow} style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {chosenEffect.targetType === 'tile_aoe'
                  ? 'Select the AoE origin tile (pattern radiates from it).'
                  : chosenEffect.targetType === 'single_tile'
                  ? 'Select one target tile.'
                  : `Select up to ${chosenEffect.targetCount || 1} target tile(s).`}
              </div>
              <div className={styles.affectedList}>
                {(step.selectedTiles || []).map(t => (
                  <span key={`${t.q},${t.r}`} className={styles.affectedChip}>
                    ({t.q},{t.r})
                    <button onClick={() => removeTile(t.q, t.r)}>×</button>
                  </span>
                ))}
              </div>
              <PortalTilePicker
                mapId={activeMapId}
                targetTile={null}
                label="+ Add tile"
                onChange={t => { if (t) addTile(t.q, t.r) }}
              />
              {chosenEffect.targetType === 'tile_aoe' && (
                <div className={styles.stepRow} style={{ marginTop: 6 }}>
                  <label>AoE rotation</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button className={styles.addTileBtn} onClick={() => onChange({ aoeRotation: (((step.aoeRotation || 0) - 1) % 8 + 8) % 8 })}>↺</button>
                    <span style={{ fontSize: 12, color: 'var(--accent)', minWidth: 36, textAlign: 'center' }}>{((step.aoeRotation || 0) % 8) * 45}°</span>
                    <button className={styles.addTileBtn} onClick={() => onChange({ aoeRotation: (((step.aoeRotation || 0) + 1) % 8 + 8) % 8 })}>↻</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Char targeting */}
          {chosenEffect.targetType === 'char_select' && (
            <div className={styles.affectedWrap}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                Select up to {chosenEffect.targetCount || 1} character(s) to target.
              </div>
              <div className={styles.affectedList}>
                {allChars.map(char => {
                  const sel = (step.selectedChars || []).includes(char.id)
                  return (
                    <button key={char.id}
                      className={`${styles.affectedChip} ${sel ? styles.affectedChipActive : ''}`}
                      style={{ cursor: 'pointer', background: sel ? 'rgba(200,169,110,0.2)' : undefined, borderColor: sel ? 'var(--accent)' : undefined }}
                      onClick={() => toggleChar(char.id)}
                    >
                      {char.emoji || '👤'} {char.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Portal tile picker (Q/R inputs + click-to-pick) ───────────
function PortalTilePicker({ mapId, targetTile, onChange, label = '🎯 Click tile on map' }) {
  const { campaign, setActiveMap, startPortalPick, endPortalPick, portalPickMode } = useStore()
  const destMap = campaign?.maps?.[mapId]
  const originMapId = campaign?.activeMapId
  const isPicking = !!portalPickMode

  const [q, setQ] = useState(targetTile?.q ?? 0)
  const [r, setR] = useState(targetTile?.r ?? 0)

  React.useEffect(() => {
    setQ(targetTile?.q ?? 0)
    setR(targetTile?.r ?? 0)
  }, [targetTile?.q, targetTile?.r])

  function commitInputs(newQ, newR) {
    const cq = Math.max(0, Math.min(newQ, (destMap?.cols ?? 99) - 1))
    const cr = Math.max(0, Math.min(newR, (destMap?.rows ?? 99) - 1))
    onChange({ q: cq, r: cr })
  }

  function handleClickPick() {
    setActiveMap(mapId)
    startPortalPick(originMapId, tile => {
      setQ(tile.q); setR(tile.r); onChange(tile)
    })
  }

  return (
    <div className={styles.portalPickerWrap}>
      {targetTile && (
        <span className={styles.portalTileChip}>({targetTile.q},{targetTile.r})</span>
      )}
      {isPicking
        ? <button className={styles.portalCancelBtn} onClick={() => { endPortalPick(); setActiveMap(originMapId) }}>Cancel pick</button>
        : <button className={styles.addTileBtn} onClick={handleClickPick}>{label}</button>
      }
      <div className={styles.portalInputRow}>
        <span className={styles.portalCoordLabel}>Q</span>
        <input type="number" min={0} value={q} className={styles.portalCoordInput}
          onChange={e => { const v = parseInt(e.target.value)||0; setQ(v); commitInputs(v, r) }} />
        <span className={styles.portalCoordLabel}>R</span>
        <input type="number" min={0} value={r} className={styles.portalCoordInput}
          onChange={e => { const v = parseInt(e.target.value)||0; setR(v); commitInputs(q, v) }} />
      </div>
    </div>
  )
}

// ── Confirm fire dialog ───────────────────────────────────────
// (rendered inline in main component above)