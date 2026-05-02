import React, { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import CharacterSheet, { tokenColor, tokenDisplay } from '../CharacterSheet/CharacterSheet'
import CreatureSheet from '../CreatureSheet/CreatureSheet'
import AbilityLibrary from '../AbilitySystem/AbilityLibrary'
import ItemLibrary from '../ItemSystem/ItemLibrary'
import ContainerManager from '../ItemSystem/ContainerPanel'
import styles from './CampaignPanel.module.css'

const TABS = [
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'characters', label: 'Characters', icon: '👥' },
  { id: 'creatures', label: 'Creatures', icon: '🐾' },
  { id: 'abilities', label: 'Abilities', icon: '⚡' },
  { id: 'items', label: 'Items', icon: '🎒' },
  { id: 'containers', label: 'Containers', icon: '📦' },
  { id: 'story', label: 'Story', icon: '📖' },
]

export default function CampaignPanel({ open, onClose, inline }) {
  const [tab, setTab] = useState('settings')
  const [sheetCharId, setSheetCharId] = useState(null)
  const [sheetCreatureId, setSheetCreatureId] = useState(null)

  if (!inline && !open) return null

  return (
    <>
      <div className={inline ? styles.panelInline : `${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <div className={styles.tabs}>
            {TABS.map(t => (
              <button
                key={t.id}
                className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className={styles.tabIcon}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          {tab === 'settings' && <SettingsTab />}
          {tab === 'characters' && <CharactersTab onOpenSheet={setSheetCharId} />}
          {tab === 'creatures' && <CreaturesTab onOpenSheet={setSheetCreatureId} />}
        {tab === 'abilities' && <div style={{padding:16}}><AbilityLibrary /></div>}
        {tab === 'items' && <div style={{padding:16}}><ItemLibrary /></div>}
        {tab === 'containers' && <div style={{padding:16}}><ContainerManager /></div>}
        {tab === 'story' && <StoryTab />}
        </div>
      </div>

      {sheetCharId && (
        <CharacterSheet characterId={sheetCharId} onClose={() => setSheetCharId(null)} />
      )}
      {sheetCreatureId && (
        <CreatureSheet creatureId={sheetCreatureId} onClose={() => setSheetCreatureId(null)} />
      )}
    </>
  )
}

// ── Settings tab ──────────────────────────────────────────────
function SettingsTab() {
  const { campaign, updateCampaign } = useStore()
  const portraitRef = useRef(null)
  if (!campaign) return null

  const s = campaign.settings || {}

  function update(field, value) {
    updateCampaign({ [field]: value })
  }

  function updateSetting(key, value) {
    updateCampaign({ settings: { ...s, [key]: value } })
  }

  async function handleCoverImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Image too large — max 2 MB'); return }
    const reader = new FileReader()
    reader.onload = ev => update('coverImage', ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className={styles.tabContent}>

      {/* Cover image */}
      <div
        className={styles.coverWrap}
        onClick={() => portraitRef.current?.click()}
        title="Click to upload a cover image"
      >
        {campaign.coverImage
          ? <img src={campaign.coverImage} alt="cover" className={styles.coverImg} />
          : <div className={styles.coverPlaceholder}>
              <span className={styles.coverHex}>⬡</span>
              <span className={styles.coverHint}>Click to add cover image</span>
            </div>
        }
        <div className={styles.coverOverlay}>📷 Change image</div>
      </div>
      <input ref={portraitRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverImage} />
      {campaign.coverImage && (
        <button className={styles.removeBtn} onClick={() => update('coverImage', null)}>Remove cover image</button>
      )}

      <Field label="Campaign name">
        <input
          type="text"
          value={campaign.name || ''}
          onChange={e => update('name', e.target.value)}
          placeholder="Campaign name…"
        />
      </Field>

      <Field label="Description">
        <textarea
          rows={3}
          value={campaign.description || ''}
          onChange={e => update('description', e.target.value)}
          placeholder="A brief description of the campaign…"
          style={{ resize: 'vertical' }}
        />
      </Field>

      <div className={styles.divider}>Default map settings</div>

      <div className={styles.row}>
        <Field label="Columns">
          <input type="number" min={5} max={60}
            value={s.defaultCols || 18}
            onChange={e => updateSetting('defaultCols', parseInt(e.target.value) || 18)}
          />
        </Field>
        <Field label="Rows">
          <input type="number" min={5} max={60}
            value={s.defaultRows || 14}
            onChange={e => updateSetting('defaultRows', parseInt(e.target.value) || 14)}
          />
        </Field>
      </div>

      <Field label="Default tile type">
        <select
          value={s.defaultBiome || 'grassland'}
          onChange={e => updateSetting('defaultBiome', e.target.value)}
        >
          {Object.values(campaign?.tileTypes || {})
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(tt => (
              <option key={tt.id} value={tt.id}>{tt.icon} {tt.name}</option>
            ))}
        </select>
      </Field>

      <div className={styles.divider}>Campaign files</div>
      <CampaignFiles campaign={campaign} onUpdate={update} />
    </div>
  )
}

// ── Campaign-level file attachments ───────────────────────────
function CampaignFiles({ campaign, onUpdate }) {
  const fileRef = useRef(null)
  const attachments = campaign.attachments || []

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('File too large — max 5 MB'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const att = {
        id: Math.random().toString(36).slice(2, 9),
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: ev.target.result,
        uploadedAt: new Date().toISOString(),
      }
      onUpdate('attachments', [...attachments, att])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function remove(id) {
    onUpdate('attachments', attachments.filter(a => a.id !== id))
  }

  function download(att) {
    const a = document.createElement('a')
    a.href = att.dataUrl
    a.download = att.name
    a.click()
  }

  function fmtBytes(b) {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1024 / 1024).toFixed(2)} MB`
  }

  return (
    <div>
      <p className={styles.hint}>Attach world maps, reference images, PDFs, or notes. Files are stored in the campaign and shared with players over local wifi.</p>
      <button className={styles.uploadBtn} onClick={() => fileRef.current?.click()}>+ Attach file</button>
      <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.gif,.webp" style={{ display: 'none' }} onChange={handleFile} />

      {attachments.length === 0
        ? <div className={styles.noFiles}>No campaign files yet</div>
        : <div className={styles.fileList}>
            {attachments.map(att => (
              <div key={att.id} className={styles.fileRow}>
                <span className={styles.fileIcon}>{att.type?.startsWith('image/') ? '🖼️' : att.type === 'application/pdf' ? '📄' : '📝'}</span>
                <div className={styles.fileInfo}>
                  <div className={styles.fileName}>{att.name}</div>
                  <div className={styles.fileMeta}>{fmtBytes(att.size)}</div>
                </div>
                <button className={styles.fileBtn} onClick={() => download(att)} title="Download">↓</button>
                <button className={`${styles.fileBtn} ${styles.fileBtnDanger}`} onClick={() => remove(att.id)} title="Remove">×</button>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ── Characters tab ────────────────────────────────────────────
function CharactersTab({ onOpenSheet }) {
  const { campaign, addCharacter, deleteCharacter } = useStore()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  if (!campaign) return null
  const characters = Object.values(campaign.characters || {})

  const filtered = characters.filter(c => {
    if (filter !== 'all' && c.type !== filter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function handleAdd(type) {
    const names = { player: 'New Player', npc: 'New NPC', monster: 'New Monster' }
    const id = addCharacter({ name: names[type], type })
    onOpenSheet(id)
  }

  function handleDelete(id) {
    deleteCharacter(id)
    setDeleteConfirm(null)
  }

  function getLocation(char) {
    if (!char.currentMapId) return null
    const map = campaign.maps[char.currentMapId]
    if (!map) return null
    return `${map.name}${char.currentTile ? ` (${char.currentTile.q},${char.currentTile.r})` : ''}`
  }

  const TYPE_FILTERS = ['all', 'player', 'npc', 'monster']

  return (
    <div className={styles.tabContent}>
      {/* Add buttons */}
      <div className={styles.addRow}>
        {['player', 'npc', 'monster'].map(type => {
          const colors = tokenColor({ type })
          return (
            <button key={type} className={styles.addCharBtn}
              style={{ borderColor: colors.ring + '80', color: colors.ring }}
              onClick={() => handleAdd(type)}>
              + {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          )
        })}
      </div>

      {/* Search + filter */}
      {characters.length > 0 && (
        <>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search characters…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className={styles.filterRow}>
            {TYPE_FILTERS.map(f => (
              <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter(f)}>
                {f === 'all' ? `All (${characters.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)}s (${characters.filter(c => c.type === f).length})`}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Character list */}
      {filtered.length === 0 ? (
        <div className={styles.emptyChars}>
          {characters.length === 0 ? 'No characters yet — add one above' : 'No matches'}
        </div>
      ) : (
        <div className={styles.charList}>
          {filtered.map(char => {
            const colors = tokenColor(char)
            const loc = getLocation(char)
            return (
              <div key={char.id} className={styles.charRow} style={{ borderLeftColor: colors.ring }}>
                {/* Avatar */}
                <div className={styles.charAvatar}
                  style={{ background: colors.bg, borderColor: colors.ring, cursor: 'pointer' }}
                  onClick={() => onOpenSheet(char.id)}>
                  {char.portrait
                    ? <img src={char.portrait} alt="" className={styles.charAvatarImg} />
                    : <span style={{ fontSize: 18 }}>{tokenDisplay(char)}</span>
                  }
                </div>

                {/* Info */}
                <div className={styles.charInfo} onClick={() => onOpenSheet(char.id)}>
                  <div className={styles.charName}>{char.name}</div>
                  <div className={styles.charMeta} style={{ color: colors.ring }}>
                    {char.type} · HP {char.stats?.hp ?? '?'}/{char.stats?.maxHp ?? '?'}
                  </div>
                  {loc && <div className={styles.charLocation}>📍 {loc}</div>}
                </div>

                {/* Delete */}
                <div>
                  {deleteConfirm === char.id ? (
                    <div className={styles.deleteConfirmRow}>
                      <button className={styles.deleteYes} onClick={() => handleDelete(char.id)}>Delete</button>
                      <button className={styles.deleteNo} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className={styles.charDeleteBtn} onClick={() => setDeleteConfirm(char.id)}>🗑</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Story tab ─────────────────────────────────────────────────
function StoryTab() {
  const { campaign, addStoryEntry, updateStoryEntry, deleteStoryEntry } = useStore()
  const [expanded, setExpanded] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState('lore')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  if (!campaign) return null
  const entries = Object.values(campaign.story || {})
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const TYPE_DEF = {
    lore:    { label: 'Lore',    icon: '📜', color: '#c8a96e' },
    secret:  { label: 'Secret',  icon: '🔒', color: '#c25a4a' },
    session: { label: 'Session', icon: '📅', color: '#5b9bd5' },
  }

  function handleCreate() {
    const id = addStoryEntry({ type: newType, title: 'New entry', visibleToPlayers: newType !== 'secret' })
    setCreating(false)
    setExpanded(id)
  }

  return (
    <div className={styles.tabContent}>
      {/* Add entry */}
      {creating ? (
        <div className={styles.newEntryForm}>
          <div className={styles.typePickerRow}>
            {Object.entries(TYPE_DEF).map(([type, def]) => (
              <button key={type}
                className={`${styles.typePickBtn} ${newType === type ? styles.typePickBtnActive : ''}`}
                style={newType === type ? { borderColor: def.color, color: def.color } : {}}
                onClick={() => setNewType(type)}>
                {def.icon} {def.label}
              </button>
            ))}
          </div>
          <div className={styles.newEntryActions}>
            <button className={styles.cancelBtn} onClick={() => setCreating(false)}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleCreate}>Create</button>
          </div>
        </div>
      ) : (
        <button className={styles.addEntryBtn} onClick={() => setCreating(true)}>+ Add entry</button>
      )}

      {/* Entry list */}
      {entries.length === 0 ? (
        <div className={styles.emptyChars}>No story entries yet</div>
      ) : (
        <div className={styles.entryList}>
          {entries.map(entry => {
            const def = TYPE_DEF[entry.type] || TYPE_DEF.lore
            const isExpanded = expanded === entry.id
            return (
              <div key={entry.id} className={styles.entryCard}>
                {/* Header */}
                <div className={styles.entryHeader} onClick={() => setExpanded(isExpanded ? null : entry.id)}>
                  <span className={styles.entryIcon}>{def.icon}</span>
                  <div className={styles.entryTitleWrap}>
                    <span className={styles.entryTitle}>{entry.title}</span>
                    <span className={styles.entryType} style={{ color: def.color }}>{def.label}</span>
                  </div>
                  {!entry.visibleToPlayers && <span className={styles.hiddenBadge}>🔒</span>}
                  <span className={styles.entryChevron}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Body */}
                {isExpanded && (
                  <div className={styles.entryBody}>
                    <input
                      type="text"
                      className={styles.entryTitleInput}
                      value={entry.title}
                      onChange={e => updateStoryEntry(entry.id, { title: e.target.value })}
                      placeholder="Title…"
                    />

                    {entry.type === 'session' && (
                      <div className={styles.fieldRow}>
                        <label className={styles.fieldLabel}>Session date</label>
                        <input type="date" value={entry.sessionDate?.slice(0, 10) || ''}
                          onChange={e => updateStoryEntry(entry.id, { sessionDate: e.target.value })} />
                      </div>
                    )}

                    <textarea
                      className={styles.entryContent}
                      rows={6}
                      value={entry.content || ''}
                      onChange={e => updateStoryEntry(entry.id, { content: e.target.value })}
                      placeholder={
                        entry.type === 'lore' ? 'World lore, history, culture…' :
                        entry.type === 'secret' ? 'Hidden information, organizer only…' :
                        'What happened this session…'
                      }
                      style={{ resize: 'vertical' }}
                    />

                    {entry.type !== 'secret' && (
                      <label className={styles.visCheck}>
                        <input type="checkbox"
                          checked={!!entry.visibleToPlayers}
                          onChange={e => updateStoryEntry(entry.id, { visibleToPlayers: e.target.checked })}
                        />
                        Visible to players
                      </label>
                    )}

                    <div className={styles.entryFooter}>
                      {deleteConfirm === entry.id ? (
                        <>
                          <button className={styles.deleteYes} onClick={() => { deleteStoryEntry(entry.id); setDeleteConfirm(null); setExpanded(null) }}>Delete</button>
                          <button className={styles.deleteNo} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                        </>
                      ) : (
                        <button className={styles.entryDeleteBtn} onClick={() => setDeleteConfirm(entry.id)}>🗑 Delete entry</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

// ── Creatures tab ─────────────────────────────────────────────
function CreaturesTab({ onOpenSheet }) {
  const { campaign, addCreature, deleteCreature } = useStore()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  if (!campaign) return null

  const creatures = Object.values(campaign.creatures || {})

  const TYPE_COLORS = {
    pet: '#7bc47f', mount: '#c8a96e', companion: '#5b9bd5',
    wild: '#9a9790', enemy: '#c25a4a',
  }
  const TYPE_LABELS = { pet: 'Pet', mount: 'Mount', companion: 'Companion', wild: 'Wild', enemy: 'Enemy' }
  const FILTERS = ['all', 'pet', 'mount', 'companion', 'wild', 'enemy']

  const filtered = creatures.filter(c => {
    if (filter !== 'all' && c.type !== filter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !c.species?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function handleAdd(type) {
    const id = addCreature({ type })
    onOpenSheet(id)
  }

  function getOwnerName(c) {
    if (!c.ownedBy) return null
    return campaign.characters?.[c.ownedBy]?.name || null
  }

  return (
    <div className={styles.tabContent}>
      {/* Add buttons */}
      <div className={styles.addRow}>
        {Object.entries(TYPE_LABELS).map(([type, label]) => (
          <button key={type} className={styles.addCharBtn}
            style={{ borderColor: TYPE_COLORS[type] + '80', color: TYPE_COLORS[type] }}
            onClick={() => handleAdd(type)}>
            + {label}
          </button>
        ))}
      </div>

      {creatures.length > 0 && (
        <>
          <input type="text" className={styles.searchInput}
            placeholder="Search creatures…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <div className={styles.filterRow}>
            {FILTERS.map(f => (
              <button key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter(f)}>
                {f === 'all' ? `All (${creatures.length})` : `${TYPE_LABELS[f]}s (${creatures.filter(c => c.type === f).length})`}
              </button>
            ))}
          </div>
        </>
      )}

      {filtered.length === 0
        ? <div className={styles.emptyChars}>{creatures.length === 0 ? 'No creatures yet' : 'No matches'}</div>
        : <div className={styles.charList}>
            {filtered.map(creature => {
              const color = TYPE_COLORS[creature.type] || '#9a9790'
              const owner = getOwnerName(creature)
              const sb = creature.statBlock || {}
              return (
                <div key={creature.id} className={styles.charRow}
                  style={{ borderLeftColor: color }}
                  onClick={() => onOpenSheet(creature.id)}>

                  {/* Avatar */}
                  <div className={styles.charAvatar} style={{ background: color + '22', borderColor: color }}>
                    {creature.portrait
                      ? <img src={creature.portrait} alt="" className={styles.charAvatarImg} />
                      : <span style={{ fontSize: 20 }}>{creature.emoji || '🐾'}</span>
                    }
                  </div>

                  {/* Info */}
                  <div className={styles.charInfo}>
                    <div className={styles.charName}>{creature.name}</div>
                    <div className={styles.charMeta} style={{ color }}>
                      {TYPE_LABELS[creature.type]}{creature.species ? ` · ${creature.species}` : ''} · CR {sb.cr || '?'} · HP {sb.hp}/{sb.maxHp}
                    </div>
                    {owner && <div className={styles.charLocation}>👤 {owner}</div>}
                  </div>

                  {/* Delete */}
                  <div onClick={e => e.stopPropagation()}>
                    {deleteConfirm === creature.id ? (
                      <div className={styles.deleteConfirmRow}>
                        <button className={styles.deleteYes} onClick={() => { deleteCreature(creature.id); setDeleteConfirm(null) }}>Delete</button>
                        <button className={styles.deleteNo} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className={styles.charDeleteBtn} onClick={() => setDeleteConfirm(creature.id)}>🗑</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}