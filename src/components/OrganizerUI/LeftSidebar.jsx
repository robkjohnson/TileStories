import React, { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { listCampaigns, loadCampaign, saveCampaign, exportCampaign, importCampaign } from '../../utils/storage'
import { useDebouncedField } from '../../utils/useDebouncedStore'
import AbilityLibrary from '../AbilitySystem/AbilityLibrary'
import ItemLibrary from '../ItemSystem/ItemLibrary'
import StoryboardEditor from '../Storyboard/StoryboardEditor'
import TileTypeManager from '../TileTypes/TileTypeManager'
import styles from './Sidebar.module.css'

const TABS = [
  { id: 'campaign',    icon: '⬡',  label: 'Campaign'   },
  { id: 'storyboards', icon: '🎬', label: 'Storyboards' },
  { id: 'abilities',   icon: '⚡', label: 'Abilities'   },
  { id: 'items',       icon: '🎒', label: 'Items'       },
]

export default function LeftSidebar({ collapsed }) {
  const [tab, setTab] = useState('campaign')

  return (
    <div className={`${styles.sidebar} ${styles.left}`}>
      {!collapsed && (
        <>
          <div className={styles.tabBar}>
            {TABS.map(t => (
              <button key={t.id}
                className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
                onClick={() => setTab(t.id)} title={t.label}>
                <span className={styles.tabIcon}>{t.icon}</span>
                <span className={styles.tabLabel}>{t.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {tab === 'campaign'    && <CampaignTab />}
            {tab === 'storyboards' && <StoryboardEditor />}
            {tab === 'abilities'   && <AbilityLibrary />}
            {tab === 'items'       && <ItemLibrary />}
          </div>
        </>
      )}
    </div>
  )
}

// ── Campaign tab (sub-tabs: Info, Tile Types, Story) ──────────
function CampaignTab() {
  const [subTab, setSubTab] = useState('info')

  return (
    <>
      <div className={styles.subTabBar}>
        {[['info', 'Info'], ['tiletypes', 'Tile Types'], ['story', 'Story']].map(([id, label]) => (
          <button key={id}
            className={`${styles.subTab} ${subTab === id ? styles.subTabActive : ''}`}
            onClick={() => setSubTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {subTab === 'info'      && <CampaignInfo />}
      {subTab === 'tiletypes' && <TileTypeManager />}
      {subTab === 'story'     && <StoryTab />}
    </>
  )
}

// ── Campaign Info ─────────────────────────────────────────────
function CampaignInfo() {
  const { campaign, setCampaign, updateCampaign } = useStore()
  const [campaigns, setCampaigns] = useState(() => listCampaigns())
  const fileRef = useRef(null)

  const nameField = useDebouncedField(campaign?.name, v => updateCampaign({ name: v }))
  const descField = useDebouncedField(campaign?.description, v => updateCampaign({ description: v }))

  function handleLoad(id) {
    const data = loadCampaign(id)
    if (data) setCampaign(data)
  }

  function handleSave() {
    if (campaign) { saveCampaign(campaign); setCampaigns(listCampaigns()) }
  }

  function handleExport() { if (campaign) exportCampaign(campaign) }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try { const data = await importCampaign(file); setCampaign(data) }
    catch { alert('Invalid campaign file') }
    e.target.value = ''
  }

  if (!campaign) return (
    <div className={styles.section}>
      <div className={styles.emptyHint}>No campaign loaded</div>
    </div>
  )

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Active campaign</div>
        <input className={styles.inlineInput} placeholder="Campaign name…" {...nameField} />
        <textarea className={styles.inlineTextarea} rows={2} placeholder="Description…" {...descField} />
        <div className={styles.actionRow}>
          <button className={styles.actionBtn} onClick={handleSave}>💾 Save</button>
          <button className={styles.actionBtn} onClick={handleExport}>↓ Export</button>
          <button className={styles.actionBtn} onClick={() => fileRef.current?.click()}>↑ Import</button>
        </div>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
      </div>

      <CoverImageEditor />

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Saved campaigns ({campaigns.length})</div>
        {campaigns.length === 0
          ? <div className={styles.emptyHint}>No saved campaigns</div>
          : campaigns.map(c => (
            <div key={c.id} className={`${styles.campaignRow} ${c.id === campaign.id ? styles.campaignRowActive : ''}`}>
              <div className={styles.campaignRowInfo} onClick={() => c.id !== campaign.id && handleLoad(c.id)}>
                <span className={styles.campaignRowName}>{c.name}</span>
                <span className={styles.campaignRowMeta}>{c.mapCount} maps</span>
              </div>
              {c.id === campaign.id && <span className={styles.activeBadge}>Active</span>}
            </div>
          ))
        }
      </div>
    </>
  )
}

function CoverImageEditor() {
  const { campaign, updateCampaign } = useStore()
  const ref = useRef(null)

  async function handle(e) {
    const file = e.target.files?.[0]
    if (!file || file.size > 2 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = ev => updateCampaign({ coverImage: ev.target.result })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Cover image</div>
      <div className={styles.coverThumb} onClick={() => ref.current?.click()}>
        {campaign?.coverImage
          ? <img src={campaign.coverImage} alt="" className={styles.coverImg} />
          : <span className={styles.coverPlaceholder}>Click to upload</span>}
      </div>
      {campaign?.coverImage && (
        <button className={styles.removeLink} onClick={() => updateCampaign({ coverImage: null })}>Remove</button>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handle} />
    </div>
  )
}

// ── Story tab ─────────────────────────────────────────────────
function StoryTab() {
  const { campaign, addStoryEntry, deleteStoryEntry } = useStore()
  const [expanded, setExpanded] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState('lore')

  const entries = Object.values(campaign?.story || {})
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
    <>
      <div className={styles.section}>
        {creating ? (
          <div className={styles.createForm}>
            <div className={styles.typePickRow}>
              {Object.entries(TYPE_DEF).map(([type, def]) => (
                <button key={type}
                  className={`${styles.typePickBtn} ${newType === type ? styles.typePickBtnActive : ''}`}
                  style={newType === type ? { borderColor: def.color, color: def.color } : {}}
                  onClick={() => setNewType(type)}>
                  {def.icon} {def.label}
                </button>
              ))}
            </div>
            <div className={styles.actionRow}>
              <button className={styles.cancelBtn} onClick={() => setCreating(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleCreate}>Create</button>
            </div>
          </div>
        ) : (
          <button className={styles.addEntryBtn} onClick={() => setCreating(true)}>+ Add entry</button>
        )}
      </div>

      {entries.map(entry => (
        <StoryEntry
          key={entry.id}
          entry={entry}
          typeDef={TYPE_DEF[entry.type] || TYPE_DEF.lore}
          expanded={expanded === entry.id}
          onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
          onDelete={() => { deleteStoryEntry(entry.id); setExpanded(null) }}
        />
      ))}
    </>
  )
}

function StoryEntry({ entry, typeDef, expanded, onToggle, onDelete }) {
  const { updateStoryEntry } = useStore()
  const titleField   = useDebouncedField(entry.title,   v => updateStoryEntry(entry.id, { title: v }))
  const contentField = useDebouncedField(entry.content, v => updateStoryEntry(entry.id, { content: v }))

  return (
    <div className={styles.entryCard}>
      <div className={styles.entryHeader} onClick={onToggle}>
        <span>{typeDef.icon}</span>
        <span className={styles.entryTitle}>{entry.title}</span>
        <span className={styles.entryType} style={{ color: typeDef.color }}>{typeDef.label}</span>
        {!entry.visibleToPlayers && <span className={styles.hiddenBadge}>🔒</span>}
        <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className={styles.entryBody}>
          <input className={styles.inlineInput} placeholder="Title…" {...titleField} />
          <textarea className={styles.inlineTextarea} rows={5} {...contentField}
            placeholder={entry.type === 'secret' ? 'Organizer eyes only…' : 'Write here…'} />
          {entry.type !== 'secret' && (
            <label className={styles.visCheck}>
              <input type="checkbox" checked={!!entry.visibleToPlayers}
                onChange={e => updateStoryEntry(entry.id, { visibleToPlayers: e.target.checked })} />
              Visible to players
            </label>
          )}
          <button className={styles.deleteLink} onClick={onDelete}>Delete entry</button>
        </div>
      )}
    </div>
  )
}
