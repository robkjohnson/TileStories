import React, { useState, useRef, useEffect } from 'react'
import { useStore, getSystem } from '../../store/useStore'
import { StatusPill } from '../EffectSystem/StatusLibrary'
import { TOKEN_EMOJIS } from '../../utils/tokenEmojis'
import styles from './CharacterSheet.module.css'
import { useDebouncedField } from '../../utils/useDebouncedStore'
import { storeImage } from '../../utils/imageStorage'
import AbilityAssigner from '../AbilitySystem/AbilityAssigner'
import InventoryPanel from '../ItemSystem/InventoryPanel'
import { rollDice, DICE_TYPES } from '../../utils/dice'

// Static colors for all built-in actor types across all shipped systems.
// Any unknown actorType (custom system) is assigned from PALETTE by index.
const STATIC_COLORS = {
  player:    { ring: '#5b9bd5', bg: '#1a3050' },
  npc:       { ring: '#7bc47f', bg: '#1a3020' },
  monster:   { ring: '#c25a4a', bg: '#301a1a' },
  enemy:     { ring: '#e06050', bg: '#2a1518' },
  wild:      { ring: '#9a9790', bg: '#252220' },
  pet:       { ring: '#7bc47f', bg: '#1a3020' },
  mount:     { ring: '#c8a96e', bg: '#2a2210' },
  companion: { ring: '#5b9bd5', bg: '#1a3050' },
  hero:      { ring: '#f0c040', bg: '#2a2010' },
  ally:      { ring: '#7bc47f', bg: '#1a3020' },
  neutral:   { ring: '#9a9790', bg: '#252220' },
  creature:  { ring: '#c8a96e', bg: '#2a2210' },
  villain:   { ring: '#9b7bc4', bg: '#201a30' },
}
const STATIC_EMOJI = {
  player: '🧙', npc: '👤', monster: '👹', enemy: '⚔️',
  wild: '🐾', pet: '🐕', mount: '🐴', companion: '🤝',
  hero: '⭐', ally: '🤝', neutral: '👤', creature: '🐾', villain: '💀',
}
const PALETTE = ['#5b9bd5','#7bc47f','#c25a4a','#c8a96e','#9b7bc4','#9a9790','#f0c040','#e07040']

// system param is optional — callers that already have it pass it for
// correct label and icon on custom/unknown actor types.
export function tokenColor(c, system) {
  if (STATIC_COLORS[c?.actorType]) return STATIC_COLORS[c.actorType]
  if (system && c?.actorType) {
    const idx = system.actorTypes.findIndex(t => t.id === c.actorType)
    const ring = PALETTE[Math.max(0, idx) % PALETTE.length]
    return { ring, bg: ring + '22' }
  }
  return STATIC_COLORS.npc
}

export function tokenDisplay(c, system) {
  if (c?.emoji) return c.emoji
  if (system) {
    const typeDef = system.actorTypes.find(t => t.id === c?.actorType)
    if (typeDef?.icon) return typeDef.icon
  }
  return STATIC_EMOJI[c?.actorType] || '👤'
}

const MAX_PORTRAIT_BYTES = 1.5 * 1024 * 1024  // 1.5 MB per portrait
const MAX_FILE_BYTES     = 5 * 1024 * 1024     // 5 MB per attachment
const ACCEPTED_IMAGE     = 'image/jpeg,image/png,image/gif,image/webp'
const ACCEPTED_FILES     = '.pdf,.txt,.md,.png,.jpg,.jpeg,.gif,.webp'

function fmtBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = e => resolve(e.target.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// ── Character sheet modal ─────────────────────────────────────
function DebouncedNameInput({ value, onUpdate }) {
  const field = useDebouncedField(value, onUpdate)
  return <input className={styles.nameInput} {...field} placeholder="Character name…" />
}

function DebouncedTextarea({ value, onUpdate, rows = 3, placeholder }) {
  const field = useDebouncedField(value, onUpdate)
  return <textarea className={styles.storyTextarea} rows={rows} placeholder={placeholder} style={{ resize: 'vertical' }} {...field} />
}

export default function CharacterSheet({ characterId, onClose, inline }) {
  const { campaign, updateCharacter, deleteCharacter, removeStatusFromCharacter, restCharacter } = useStore()
  const character = campaign?.actors?.[characterId]
  const system = getSystem(campaign?.gameSystemId)
  const [tab, setTab] = useState('info')  // 'info' | 'abilities' | 'items' | 'files'
  const [traitsDraft, setTraitsDraft] = useState((character?.traits || []).join(', '))
  const [uploadError, setUploadError] = useState(null)

  useEffect(() => {
    setTraitsDraft((character?.traits || []).join(', '))
  }, [characterId])
  const [deleteConfirm, setDeleteConfirm] = React.useState(false)
  const portraitInputRef = useRef(null)
  const fileInputRef = useRef(null)

  if (!character) return null
  const colors = tokenColor(character, system)

  function update(field, value) { updateCharacter(characterId, { [field]: value }) }
  function updateStat(stat, value) { updateCharacter(characterId, { stats: { ...character.stats, [stat]: value } }) }

  // ── Portrait upload ───────────────────────────────────────────
  async function handlePortrait(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    if (file.size > MAX_PORTRAIT_BYTES) {
      setUploadError(`Portrait too large (${fmtBytes(file.size)}). Max 1.5 MB.`)
      e.target.value = ''; return
    }
    try {
      const dataUrl = await readAsDataURL(file)
      update('portrait', dataUrl)
    } catch { setUploadError('Failed to read image.') }
    e.target.value = ''
  }

  // ── File attachment upload ────────────────────────────────────
  async function handleFileAttach(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`File too large (${fmtBytes(file.size)}). Max 5 MB.`)
      e.target.value = ''; return
    }
    try {
      const dataUrl = await readAsDataURL(file)
      const attachment = {
        id: Math.random().toString(36).slice(2, 9),
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      }
      update('attachments', [...(character.attachments || []), attachment])
    } catch { setUploadError('Failed to read file.') }
    e.target.value = ''
  }

  function removeAttachment(id) {
    update('attachments', (character.attachments || []).filter(a => a.id !== id))
  }

  function downloadAttachment(att) {
    const a = document.createElement('a')
    a.href = att.dataUrl
    a.download = att.name
    a.click()
  }

  const attachments = character.attachments || []

  const sheetEl = (
      <div className={styles.sheet} style={inline ? { maxHeight:'100%', boxShadow:'none', border:'none', borderRadius:0, width:'100%', overflow:'auto' } : {}}>

        {/* ── Header ── */}
        <div className={styles.header} style={{ borderBottomColor: colors.ring }}>
          {/* Portrait */}
          <div className={styles.portraitWrap} style={{ borderColor: colors.ring, background: colors.bg }}
            onClick={() => portraitInputRef.current?.click()} title="Click to upload portrait">
            {character.portrait
              ? <img src={character.portrait} alt="portrait" className={styles.portraitImg} />
              : <span className={styles.portraitEmoji}>{tokenDisplay(character)}</span>
            }
            <div className={styles.portraitOverlay}>📷</div>
          </div>
          <input ref={portraitInputRef} type="file" accept={ACCEPTED_IMAGE} style={{ display: 'none' }} onChange={handlePortrait} />

          <div className={styles.headerInfo}>
            <DebouncedNameInput value={character.name} onUpdate={v => update('name', v)} />
            <div className={styles.typeRow}>
              {system.actorTypes.map(typeDef => {
                const c = tokenColor({ actorType: typeDef.id }, system)
                const active = character.actorType === typeDef.id
                return (
                  <button key={typeDef.id}
                    className={`${styles.typeBtn} ${active ? styles.typeBtnActive : ''}`}
                    style={active ? { borderColor: c.ring, color: c.ring } : {}}
                    onClick={() => update('actorType', typeDef.id)}
                    title={typeDef.label}>
                    {typeDef.icon} {typeDef.short}
                  </button>
                )
              })}
            </div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:4 }}>
              <PillToggle
                active={!!character.isKey}
                onChange={v => update('isKey', v)}
                activeColor="#c8a96e"
                label="Key character"
              />
              <PillToggle
                active={!!character.revealedToPlayers}
                onChange={v => update('revealedToPlayers', v)}
                activeColor="#5b9bd5"
                label="Revealed to players"
              />
            </div>
            {character.portrait && (
              <button className={styles.removePortrait} onClick={() => update('portrait', null)}>Remove portrait</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {deleteConfirm
              ? <>
                  <button style={{ padding:'3px 8px', borderRadius:4, background:'var(--danger)', color:'#fff', border:'none', fontSize:11, cursor:'pointer' }}
                    onClick={() => { deleteCharacter(characterId); onClose?.() }}>Delete</button>
                  <button style={{ padding:'3px 8px', borderRadius:4, border:'0.5px solid var(--border-strong)', background:'transparent', color:'var(--text-muted)', fontSize:11, cursor:'pointer' }}
                    onClick={() => setDeleteConfirm(false)}>Cancel</button>
                </>
              : <button style={{ padding:'3px 8px', borderRadius:4, border:'0.5px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:11, cursor:'pointer' }}
                  onClick={() => setDeleteConfirm(true)} title="Delete character">🗑</button>
            }
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>
        </div>

        {uploadError && <div className={styles.uploadError}>{uploadError}</div>}

        {/* ── Tabs ── */}
        <div className={styles.tabs}>
          {[['info','Info'],['story','Story'],['abilities','Abilities'],['items','Items'],['files',`Files${attachments.length ? ` (${attachments.length})` : ''}`]].map(([id, label]) => (
            <button key={id} className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {/* ── Info tab ── */}
        {tab === 'info' && <>
          {/* Emoji picker */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Token icon <span className={styles.hint}>(shown on map when no portrait)</span></div>
            <div className={styles.emojiRow}>
              {TOKEN_EMOJIS.map(e => (
                <button key={e}
                  className={`${styles.emojiBtn} ${character.emoji === e ? styles.emojiBtnActive : ''}`}
                  onClick={() => update('emoji', character.emoji === e ? null : e)}>{e}</button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Stats</div>
            <div className={styles.statsGrid}>
              <StatField label="HP" value={character.stats.hp} max={character.stats.maxHp}
                onChange={v => updateStat('hp', v)} onMaxChange={v => updateStat('maxHp', v)} showMax />
              <StatField label="Speed" value={character.stats.speed} onChange={v => updateStat('speed', v)} />
            </div>
            {system.actorTypes.find(t => t.id === character.actorType)?.isPlayer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 10px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', minWidth: 50 }}>Gold (gp)</div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>$</span>
                <button style={{ width: 24, height: 24, borderRadius: 4, border: '0.5px solid var(--border-strong)', background: 'var(--bg-overlay)', color: 'var(--text-secondary)', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => update('currency', { ...character.currency, gp: Math.max(0, (character.currency?.gp ?? 0) - 1) })}>−</button>
                <input type="number" min={0}
                  value={character.currency?.gp ?? 0}
                  onChange={e => update('currency', { ...character.currency, gp: Math.max(0, parseFloat(e.target.value) || 0) })}
                  style={{ width: 64, background: 'transparent', border: 'none', borderBottom: '0.5px solid var(--border-strong)', color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, padding: '0 2px', textAlign: 'center' }} />
                <button style={{ width: 24, height: 24, borderRadius: 4, border: '0.5px solid var(--border-strong)', background: 'var(--bg-overlay)', color: 'var(--text-secondary)', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => update('currency', { ...character.currency, gp: (character.currency?.gp ?? 0) + 1 })}>+</button>
              </div>
            )}
          </div>

          {/* Location */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Location</div>
            <div className={styles.locationRow}>
              {character.currentMapId && campaign.maps[character.currentMapId]
                ? <><span className={styles.locationMap}>{campaign.maps[character.currentMapId].name}</span>
                    {character.currentTile && <span className={styles.locationTile}>({character.currentTile.q}, {character.currentTile.r})</span>}</>
                : <span className={styles.locationNone}>Not placed on any map</span>}
            </div>
          </div>

          {/* Rest */}
          {(character.abilities || []).some(a => campaign?.abilities?.[a.templateId]?.usesPerRest) && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Rest</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => restCharacter(characterId, 'short')}
                  style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border-strong)', background: 'var(--bg-overlay)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
                >
                  Short Rest
                </button>
                <button
                  onClick={() => restCharacter(characterId, 'long')}
                  style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--accent-dim)', background: 'rgba(200,169,110,0.08)', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                >
                  Long Rest
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Public notes <span className={styles.hint}>(visible to players)</span></div>
            <textarea className={styles.notes} rows={2} value={character.publicNotes || ''}
              onChange={e => update('publicNotes', e.target.value)} placeholder="Description, appearance, voice…" />
          </div>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Organizer notes <span className={styles.hint}>(hidden)</span></div>
            <textarea className={styles.notes} rows={3} value={character.notes || ''}
              onChange={e => update('notes', e.target.value)} placeholder="Secrets, motivations, plot hooks…" />
          </div>

          {/* Traits */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Traits <span className={styles.hint}>(comma-separated — used for event visibility and status negation)</span></div>
            <input type="text" className={styles.notes}
              value={traitsDraft}
              onChange={e => setTraitsDraft(e.target.value)}
              onBlur={e => update('traits', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="brave, fire-resistant, undead…" />
          </div>

          {/* Active Statuses */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Active Statuses</div>
            {(character.activeStatuses || []).length === 0
              ? <div className={styles.hint}>No active statuses.</div>
              : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(character.activeStatuses || []).map(entry => (
                    <StatusPill key={entry.statusId} statusId={entry.statusId} campaign={campaign} entry={entry}
                      onRemove={() => removeStatusFromCharacter(characterId, entry.statusId)} />
                  ))}
                </div>
            }
          </div>

          {/* Damage defenses */}
          {(system.damageTypes?.length > 0) && (
            <DefenseSection character={character} system={system} onUpdate={(f, v) => update(f, v)} />
          )}

          <SheetDiceRoller character={character} />
        </>}

        {/* ── Abilities tab ── */}
        {tab === 'abilities' && (
          <div className={styles.section}>
            <AbilityAssigner entityId={characterId} />
          </div>
        )}

        {/* ── Story tab ── */}
        {tab === 'story' && (
          <div className={styles.section}>
            <div className={styles.storyLabel}>
              Description
              <span className={styles.storyHint}>Visible to all players</span>
            </div>
            <DebouncedTextarea
              value={character.description || ''}
              onUpdate={v => update('description', v)}
              placeholder="How other players and the world sees this character…"
              rows={4}
            />
            <div className={styles.storyLabel} style={{ marginTop: 8 }}>
              Biography
              <span className={styles.storyHint}>Private — only visible to this player and the organizer</span>
            </div>
            <DebouncedTextarea
              value={character.biography || ''}
              onUpdate={v => update('biography', v)}
              placeholder="Backstory, motivations, secrets…"
              rows={5}
            />
            <div className={styles.storyLabel} style={{ marginTop: 8 }}>
              Currency ($)
              <span className={styles.storyHint}>Player wallet balance</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>$</span>
              <input type="number" min={0}
                value={character.currency ?? 0}
                onChange={e => update('currency', parseFloat(e.target.value) || 0)}
                style={{ flex: 1 }} />
            </div>

            <div className={styles.storyLabel} style={{ marginTop: 8 }}>
              Public notes
              <span className={styles.storyHint}>Extra public info (legacy)</span>
            </div>
            <DebouncedTextarea
              value={character.publicNotes || ''}
              onUpdate={v => update('publicNotes', v)}
              placeholder="Public notes visible to players…"
              rows={3}
            />
            <div className={styles.storyLabel} style={{ marginTop: 8 }}>
              Organizer notes
              <span className={styles.storyHint}>Only visible to organizer</span>
            </div>
            <DebouncedTextarea
              value={character.notes || ''}
              onUpdate={v => update('notes', v)}
              placeholder="Private organizer notes…"
              rows={3}
            />
          </div>
        )}

        {/* ── Items tab ── */}
        {tab === 'items' && (
          <div className={styles.section}>
            <InventoryPanel entityId={characterId} />
          </div>
        )}

        {/* ── Files tab ── */}
        {tab === 'files' && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Attached files</div>
            <p className={styles.fileHint}>
              Files are stored inside the campaign and shared over local wifi with all connected players. Max 5 MB per file. Supported: images, PDF, text, markdown.
            </p>

            <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()}>
              + Attach file
            </button>
            <input ref={fileInputRef} type="file" accept={ACCEPTED_FILES} style={{ display: 'none' }} onChange={handleFileAttach} />

            {attachments.length === 0
              ? <div className={styles.noFiles}>No files attached yet</div>
              : <div className={styles.fileList}>
                  {attachments.map(att => (
                    <FileRow key={att.id} att={att}
                      onDownload={() => downloadAttachment(att)}
                      onRemove={() => removeAttachment(att.id)} />
                  ))}
                </div>
            }
          </div>
        )}

      </div>
  )
  if (inline) return sheetEl
  return <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>{sheetEl}</div>
}

// ── File row ──────────────────────────────────────────────────
function FileRow({ att, onDownload, onRemove }) {
  const [preview, setPreview] = useState(false)
  const isImage = att.type?.startsWith('image/')

  return (
    <div className={styles.fileRow}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px' }}>
        <div className={styles.fileIcon}>{isImage ? '🖼️' : att.type === 'application/pdf' ? '📄' : '📝'}</div>
        <div className={styles.fileInfo}>
          <div className={styles.fileName}>{att.name}</div>
          <div className={styles.fileMeta}>{fmtBytes(att.size)}</div>
        </div>
        <div className={styles.fileActions}>
          {isImage && <button className={styles.fileBtn} onClick={() => setPreview(p => !p)} title="Preview">👁</button>}
          <button className={styles.fileBtn} onClick={onDownload} title="Download">↓</button>
          <button className={`${styles.fileBtn} ${styles.fileBtnDanger}`} onClick={onRemove} title="Remove">×</button>
        </div>
      </div>
      {preview && isImage && (
        <div className={styles.imagePreview}>
          <img src={att.dataUrl} alt={att.name} className={styles.previewImg} />
        </div>
      )}
    </div>
  )
}

// ── Stat field ────────────────────────────────────────────────
function StatField({ label, value, max, onChange, onMaxChange, showMax }) {
  return (
    <div className={styles.statField}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statInputRow}>
        <input type="number" className={styles.statInput} value={value ?? 0}
          onChange={e => onChange(parseInt(e.target.value) || 0)} />
        {showMax && onMaxChange && <>
          <span className={styles.statSep}>/</span>
          <input type="number" className={styles.statInput} value={max ?? 0}
            onChange={e => onMaxChange(parseInt(e.target.value) || 0)} />
        </>}
      </div>
    </div>
  )
}

// ── Damage defenses (resistances, vulnerabilities, immunities) ───
function DefenseSection({ character, system, onUpdate }) {
  const allTypes = (system.damageTypes || []).filter(t => t !== 'none')

  function toggle(field, type) {
    const cur = character[field] || []
    onUpdate(field, cur.includes(type) ? cur.filter(t => t !== type) : [...cur, type])
  }

  const ROWS = [
    { field: 'immunities',     label: 'Immune',     color: '#7bc47f' },
    { field: 'resistances',    label: 'Resistant',  color: '#5b9bd5' },
    { field: 'vulnerabilities',label: 'Vulnerable', color: '#c25a4a' },
  ]

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Damage defenses</div>
      {ROWS.map(({ field, label, color }) => (
        <div key={field} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {allTypes.map(t => {
              const active = (character[field] || []).includes(t)
              return (
                <button key={t} onClick={() => toggle(field, t)} style={{
                  padding: '2px 8px', fontSize: 10, borderRadius: 10, cursor: 'pointer',
                  border: `1px solid ${active ? color : 'var(--border)'}`,
                  background: active ? color + '22' : 'transparent',
                  color: active ? color : 'var(--text-muted)',
                  textTransform: 'capitalize', transition: 'all 0.1s',
                }}>{t}</button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Sheet dice roller ─────────────────────────────────────────
function SheetDiceRoller({ character }) {
  const [diceType, setDiceType] = useState('d20')
  const [description, setDescription] = useState('')
  const [lastRoll, setLastRoll] = useState(null)

  function handleRoll() {
    const value = rollDice(diceType)
    setLastRoll(value)
    window.__tilestoriesSend?.({
      type: 'DICE_ROLL',
      characterId: character.id,
      characterName: character.name,
      diceType,
      value,
      description: description.trim() || null,
    })
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Roll Dice for Player</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {Object.keys(DICE_TYPES).map(dt => (
          <button key={dt}
            onClick={() => setDiceType(dt)}
            style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              border: `0.5px solid ${diceType === dt ? 'var(--accent)' : 'var(--border)'}`,
              background: diceType === dt ? 'rgba(200,169,110,0.12)' : 'transparent',
              color: diceType === dt ? 'var(--accent)' : 'var(--text-muted)',
            }}>
            {DICE_TYPES[dt].label}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Description (e.g. Perception check)…"
        value={description}
        onChange={e => setDescription(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleRoll()}
        style={{ width: '100%', marginBottom: 6, padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 12 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={handleRoll}
          style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--accent)', color: '#1a1a1a', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          🎲 Roll {DICE_TYPES[diceType].label}
        </button>
        {lastRoll !== null && (
          <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent)' }}>{lastRoll}</span>
        )}
      </div>
    </div>
  )
}

// ── Pill toggle — styled boolean button ──────────────────────
function PillToggle({ active, onChange, activeColor, label }) {
  return (
    <button
      onClick={() => onChange(!active)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 8px 3px 5px',
        borderRadius: 20,
        border: `1px solid ${active ? activeColor : 'var(--border)'}`,
        background: active ? activeColor + '22' : 'transparent',
        color: active ? activeColor : 'var(--text-muted)',
        fontSize: 11, cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s, color 0.15s',
      }}
    >
      <span style={{
        width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
        background: active ? activeColor : 'var(--border)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, color: active ? '#1a1a1a' : 'transparent',
        transition: 'background 0.15s',
      }}>✓</span>
      {label}
    </button>
  )
}