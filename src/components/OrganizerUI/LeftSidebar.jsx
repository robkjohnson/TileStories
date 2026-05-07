import React, { useState, useRef } from 'react'
import { useStore, getSystem, getCampaignSystem, SYSTEMS, newId } from '../../store/useStore'
import { listCampaigns, loadCampaign, saveCampaign, exportCampaign, importCampaign } from '../../utils/storage'
import { useDebouncedField } from '../../utils/useDebouncedStore'
import AbilityLibrary from '../AbilitySystem/AbilityLibrary'
import ItemLibrary from '../ItemSystem/ItemLibrary'
import StoryboardEditor from '../Storyboard/StoryboardEditor'
import TileTypeManager from '../TileTypes/TileTypeManager'
import StatusLibrary from '../EffectSystem/StatusLibrary'
import EffectLibrary from '../EffectSystem/EffectLibrary'
import MapManager from './MapManager'
import styles from './Sidebar.module.css'

const TABS = [
  { id: 'campaign', icon: '⬡',  label: 'Campaign' },
  { id: 'world',    icon: '🗺', label: 'World'    },
  { id: 'library',  icon: '📚', label: 'Library'  },
  { id: 'story',    icon: '📖', label: 'Story'    },
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
            {tab === 'campaign' && <CampaignTab />}
            {tab === 'world'    && <WorldTab />}
            {tab === 'library'  && <LibraryTab />}
            {tab === 'story'    && <StoryTab />}
          </div>
        </>
      )}
    </div>
  )
}

// ── Campaign tab ──────────────────────────────────────────────
function CampaignTab() {
  const { campaign, setCampaign, updateCampaign } = useStore()
  const [campaigns, setCampaigns] = useState(() => listCampaigns())
  const fileRef = useRef(null)

  const nameField = useDebouncedField(campaign?.name, v => updateCampaign({ name: v }))
  const descField = useDebouncedField(campaign?.description, v => updateCampaign({ description: v }))

  function handleLoad(id) {
    const data = loadCampaign(id)
    if (data) setCampaign(data)
    setCampaigns(listCampaigns())
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
      <div className={styles.emptyHint}>No campaign loaded.</div>
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

      <GameSystemSection campaign={campaign} updateCampaign={updateCampaign} />
      <CustomGameRulesSection campaign={campaign} updateCampaign={updateCampaign} />
      <CoverImageEditor />

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Saved campaigns ({campaigns.length})</div>
        {campaigns.length === 0
          ? <div className={styles.emptyHint}>No saved campaigns</div>
          : campaigns.map(c => (
            <div key={c.id} className={`${styles.campaignRow} ${c.id === campaign.id ? styles.campaignRowActive : ''}`}>
              <div className={styles.campaignRowInfo} onClick={() => c.id !== campaign.id && handleLoad(c.id)}>
                <span className={styles.campaignRowName}>{c.name}</span>
                <span className={styles.campaignRowMeta}>{c.mapCount} map{c.mapCount !== 1 ? 's' : ''}</span>
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

// ── Game system section ───────────────────────────────────────
function GameSystemSection({ campaign, updateCampaign }) {
  const [open, setOpen] = useState(false)
  const system = getCampaignSystem(campaign)

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Game system</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{system.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
            {system.actorTypes.map(t => t.icon).join(' ')}
          </div>
        </div>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
          {SYSTEMS.map(sys => (
            <button
              key={sys.id}
              onClick={() => { updateCampaign({ gameSystemId: sys.id }); setOpen(false) }}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: `1.5px solid ${sys.id === campaign?.gameSystemId ? 'var(--accent)' : 'var(--border)'}`,
                background: sys.id === campaign?.gameSystemId ? 'rgba(200,169,110,0.08)' : 'var(--bg-raised)',
                color: sys.id === campaign?.gameSystemId ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>{sys.name}</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{sys.description}</div>
              <div style={{ fontSize: 10, marginTop: 3, opacity: 0.6 }}>
                {sys.actorTypes.map(t => `${t.icon} ${t.label}`).join(' · ')}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Custom game rules (all systems) ──────────────────────────
function CustomGameRulesSection({ campaign, updateCampaign }) {
  const [newDmgType, setNewDmgType] = useState('')
  const [addingStat, setAddingStat] = useState(false)
  const [newStatLabel, setNewStatLabel] = useState('')
  const [newStatType, setNewStatType] = useState('number')
  const [newStatGroup, setNewStatGroup] = useState('')

  const baseSystem = getSystem(campaign.gameSystemId)
  const actorTypes  = campaign.customActorTypes  ?? baseSystem.actorTypes
  const damageTypes = campaign.customDamageTypes ?? baseSystem.damageTypes
  const stats       = campaign.customStats       ?? baseSystem.stats

  const actorCounts = Object.values(campaign.actors || {}).reduce((acc, a) => {
    acc[a.actorType] = (acc[a.actorType] || 0) + 1
    return acc
  }, {})

  function updateActorType(id, patch) {
    updateCampaign({ customActorTypes: actorTypes.map(t => t.id === id ? { ...t, ...patch } : t) })
  }
  function addActorType() {
    const t = { id: newId(), label: 'New Type', short: 'NEW', isPlayer: false, icon: '👤', showInRoster: true }
    updateCampaign({ customActorTypes: [...actorTypes, t] })
  }
  function removeActorType(id) {
    updateCampaign({ customActorTypes: actorTypes.filter(t => t.id !== id) })
  }

  function addDamageType() {
    const key = newDmgType.trim().toLowerCase().replace(/\s+/g, '_')
    if (!key || damageTypes.includes(key)) return
    updateCampaign({ customDamageTypes: [...damageTypes, key] })
    setNewDmgType('')
  }
  function removeDamageType(key) {
    updateCampaign({ customDamageTypes: damageTypes.filter(t => t !== key) })
  }

  function updateStat(id, patch) {
    updateCampaign({ customStats: stats.map(s => s.id === id ? { ...s, ...patch } : s) })
  }
  function addStat() {
    const label = newStatLabel.trim()
    if (!label) return
    const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!id || stats.find(s => s.id === id)) return
    const group = newStatGroup.trim() || 'custom'
    const s = {
      id,
      label,
      short: label.slice(0, 4).toUpperCase(),
      type: newStatType,
      group,
      default: newStatType === 'text' ? '' : newStatType === 'attribute' ? 10 : 0,
    }
    updateCampaign({ customStats: [...stats, s] })
    setNewStatLabel('')
    setNewStatGroup('')
    setNewStatType('number')
    setAddingStat(false)
  }
  function removeStat(id) {
    updateCampaign({ customStats: stats.filter(s => s.id !== id) })
  }

  const subLabel = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
  const resetBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)', padding: 0 }
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }
  const checkLabel = { display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }
  const checkBox = { accentColor: 'var(--accent)', width: 11, height: 11 }
  const TYPE_COLORS = { attribute: '#c8a96e', resource: '#5b9bd5', number: 'var(--text-muted)', text: '#7bc47f' }

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Game Rules</div>

      {/* Actor Types */}
      <div style={subLabel}>
        <span>Actor Types</span>
        {campaign.customActorTypes !== null && (
          <button style={resetBtn} onClick={() => updateCampaign({ customActorTypes: null })} title="Reset to system defaults">
            Reset
          </button>
        )}
      </div>

      {actorTypes.map(t => {
        const count = actorCounts[t.id] || 0
        return (
          <div key={t.id} style={rowStyle}>
            <input
              value={t.icon}
              onChange={e => updateActorType(t.id, { icon: e.target.value })}
              style={{ width: 30, textAlign: 'center', fontSize: 14, padding: '2px 3px', flexShrink: 0 }}
              title="Icon emoji"
              maxLength={2}
            />
            <input
              value={t.label}
              onChange={e => {
                const label = e.target.value
                updateActorType(t.id, { label, short: label.slice(0, 4).toUpperCase() })
              }}
              style={{ flex: 1, fontSize: 11, minWidth: 0 }}
              placeholder="Type name"
            />
            <label style={checkLabel} title="Player character type">
              <input type="checkbox" checked={!!t.isPlayer} onChange={e => updateActorType(t.id, { isPlayer: e.target.checked })} style={checkBox} />
              PC
            </label>
            <label style={checkLabel} title="Show in roster">
              <input type="checkbox" checked={!!t.showInRoster} onChange={e => updateActorType(t.id, { showInRoster: e.target.checked })} style={checkBox} />
              Roster
            </label>
            {count > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 16, textAlign: 'right' }} title={`${count} actor(s) use this type`}>
                {count}
              </span>
            )}
            <button
              onClick={() => count === 0 && removeActorType(t.id)}
              disabled={count > 0}
              title={count > 0 ? `${count} actor(s) use this type — reassign first` : 'Remove type'}
              style={{ background: 'none', border: 'none', cursor: count > 0 ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', fontSize: 15, opacity: count > 0 ? 0.3 : 0.7, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
            >×</button>
          </div>
        )
      })}

      <button className={styles.addEntryBtn} onClick={addActorType} style={{ fontSize: 11, padding: '4px 8px' }}>
        + Add actor type
      </button>

      {/* Damage Types */}
      <div style={{ ...subLabel, marginTop: 14 }}>
        <span>Damage Types</span>
        {campaign.customDamageTypes !== null && (
          <button style={resetBtn} onClick={() => updateCampaign({ customDamageTypes: null })} title="Reset to system defaults">
            Reset
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
        {damageTypes.map(key => (
          <span key={key} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 10,
            fontSize: 10, fontWeight: 500,
            background: 'var(--bg-raised)', border: '0.5px solid var(--border)',
            color: 'var(--text-secondary)',
          }}>
            {key}
            {key !== 'none' && (
              <button
                onClick={() => removeDamageType(key)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: 0, lineHeight: 1 }}
                title={`Remove "${key}"`}
              >×</button>
            )}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 5 }}>
        <input
          value={newDmgType}
          onChange={e => setNewDmgType(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addDamageType()}
          placeholder="New damage type…"
          style={{ flex: 1, fontSize: 11 }}
        />
        <button
          onClick={addDamageType}
          disabled={!newDmgType.trim()}
          style={{ fontSize: 11, padding: '3px 8px', background: 'var(--bg-raised)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: newDmgType.trim() ? 'pointer' : 'not-allowed', opacity: newDmgType.trim() ? 1 : 0.5 }}
        >Add</button>
      </div>

      {/* Stats */}
      <div style={{ ...subLabel, marginTop: 14 }}>
        <span>Stats</span>
        {campaign.customStats !== null && (
          <button style={resetBtn} onClick={() => updateCampaign({ customStats: null })} title="Reset to system defaults">
            Reset
          </button>
        )}
      </div>

      {stats.map(s => (
        <div key={s.id} style={{ ...rowStyle, marginBottom: 3 }}>
          <input
            value={s.short || ''}
            onChange={e => updateStat(s.id, { short: e.target.value.toUpperCase().slice(0, 5) })}
            style={{ width: 36, textAlign: 'center', fontSize: 10, fontWeight: 600, padding: '2px 3px', flexShrink: 0, fontFamily: 'monospace' }}
            title="Short label"
            maxLength={5}
          />
          <input
            value={s.label}
            onChange={e => updateStat(s.id, { label: e.target.value })}
            style={{ flex: 1, fontSize: 11, minWidth: 0 }}
            placeholder="Stat name"
          />
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, border: `0.5px solid ${TYPE_COLORS[s.type] || 'var(--border)'}`, color: TYPE_COLORS[s.type] || 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {s.type}
          </span>
          <button
            onClick={() => removeStat(s.id)}
            title={`Remove "${s.label}"`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 15, opacity: 0.7, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
          >×</button>
        </div>
      ))}

      {addingStat ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4, padding: '8px 10px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border)' }}>
          <input
            autoFocus
            value={newStatLabel}
            onChange={e => setNewStatLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStat()}
            placeholder="Stat name…"
            style={{ fontSize: 11 }}
          />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['number', 'attribute', 'resource', 'text'].map(t => (
              <button key={t} onClick={() => setNewStatType(t)} style={{
                padding: '2px 7px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                border: `0.5px solid ${newStatType === t ? TYPE_COLORS[t] : 'var(--border)'}`,
                background: newStatType === t ? (TYPE_COLORS[t] + '22') : 'transparent',
                color: newStatType === t ? TYPE_COLORS[t] : 'var(--text-muted)',
              }}>{t}</button>
            ))}
          </div>
          <input
            value={newStatGroup}
            onChange={e => setNewStatGroup(e.target.value)}
            placeholder="Group (e.g. combat, custom)…"
            style={{ fontSize: 11 }}
          />
          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
            <button onClick={() => { setAddingStat(false); setNewStatLabel(''); setNewStatGroup(''); setNewStatType('number') }}
              style={{ fontSize: 11, padding: '3px 8px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={addStat} disabled={!newStatLabel.trim()}
              style={{ fontSize: 11, padding: '3px 8px', background: 'var(--accent)', border: 'none', borderRadius: 3, color: '#1a1a1a', fontWeight: 600, cursor: newStatLabel.trim() ? 'pointer' : 'not-allowed', opacity: newStatLabel.trim() ? 1 : 0.5 }}>
              Add
            </button>
          </div>
        </div>
      ) : (
        <button className={styles.addEntryBtn} onClick={() => setAddingStat(true)} style={{ fontSize: 11, padding: '4px 8px', marginTop: 3 }}>
          + Add stat
        </button>
      )}
    </div>
  )
}

// ── World tab (Maps + Tile Types) ─────────────────────────────
function WorldTab() {
  const [subTab, setSubTab] = useState('maps')
  return (
    <>
      <div className={styles.subTabBar}>
        {[['maps', 'Maps'], ['tiletypes', 'Tile Types']].map(([id, label]) => (
          <button key={id}
            className={`${styles.subTab} ${subTab === id ? styles.subTabActive : ''}`}
            onClick={() => setSubTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {subTab === 'maps'      && <MapManager />}
      {subTab === 'tiletypes' && <TileTypeManager />}
    </>
  )
}

// ── Library tab (Items · Abilities · Statuses · Effects · Containers) ──
function LibraryTab() {
  const [subTab, setSubTab] = useState('items')
  return (
    <>
      <div className={styles.subTabBar} style={{ flexWrap: 'wrap', gap: '3px 3px' }}>
        {[
          ['items',      'Items'],
          ['abilities',  'Abilities'],
          ['statuses',   'Statuses'],
          ['effects',    'Effects'],
          ['containers', 'Containers'],
        ].map(([id, label]) => (
          <button key={id}
            className={`${styles.subTab} ${subTab === id ? styles.subTabActive : ''}`}
            onClick={() => setSubTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {subTab === 'items'      && <ItemLibrary />}
      {subTab === 'abilities'  && <AbilityLibrary />}
      {subTab === 'statuses'   && <StatusLibrary />}
      {subTab === 'effects'    && <EffectLibrary />}
      {subTab === 'containers' && <ContainerLibrary />}
    </>
  )
}

// ── Container Library — global list of all containers ────────
function ContainerLibrary() {
  const { campaign, addContainer, updateContainer, deleteContainer } = useStore()
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('Chest')

  const containers = Object.values(campaign?.containers || {})
    .sort((a, b) => a.name.localeCompare(b.name))

  const maps = campaign?.maps || {}

  function getLocation(c) {
    const map = maps[c.mapId]
    if (!map) return '(unplaced)'
    return c.tileKey ? `${map.name} · ${c.tileKey}` : map.name
  }

  function handleAdd() {
    if (!newName.trim()) return
    const activeMapId = campaign?.activeMapId
    const firstMapId = activeMapId || Object.keys(maps)[0]
    if (!firstMapId) return
    addContainer({ mapId: firstMapId, tileKey: null, name: newName.trim(), discovered: true })
    setAdding(false)
    setNewName('Chest')
  }

  function handleDelete(id, e) {
    e.stopPropagation()
    if (deleteConfirm === id) { deleteContainer(id); setDeleteConfirm(null) }
    else setDeleteConfirm(id)
  }

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Containers ({containers.length})</div>
        {containers.length === 0 && (
          <div className={styles.emptyHint}>No containers yet. Place them on tiles via the Tile panel.</div>
        )}
        {containers.map(c => {
          const TYPE_ICONS = { chest: '📦', barrel: '🛢', bag: '👜', crate: '🗃', safe: '🔒', other: '📫' }
          const icon = TYPE_ICONS[c.type] || '📦'
          return (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '0.5px solid var(--border)',
              background: 'var(--bg-raised)',
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  value={c.name}
                  onChange={e => updateContainer(c.id, { name: e.target.value })}
                  style={{
                    background: 'transparent', border: 'none',
                    color: 'var(--text-primary)', fontSize: 12, fontWeight: 500,
                    width: '100%', padding: 0,
                  }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                  <span>{getLocation(c)}</span>
                  <span>·</span>
                  <span>{c.items?.length ?? 0} items</span>
                  {c.locked && <span>· 🔒 DC {c.lockDC}</span>}
                  {!c.discovered && <span>· hidden</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={c.discovered}
                    onChange={e => updateContainer(c.id, { discovered: e.target.checked })}
                    style={{ accentColor: 'var(--accent)', width: 11, height: 11 }} />
                  vis
                </label>
                {deleteConfirm === c.id ? (
                  <div className={styles.deleteConfirmInline}>
                    <button className={styles.deleteYesBtn} onClick={e => handleDelete(c.id, e)}>✓</button>
                    <button className={styles.deleteNoBtn} onClick={e => { e.stopPropagation(); setDeleteConfirm(null) }}>✕</button>
                  </div>
                ) : (
                  <button className={styles.deleteInlineBtn} style={{ opacity: 1 }}
                    onClick={e => handleDelete(c.id, e)}>🗑</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.section}>
        {adding ? (
          <div className={styles.createForm}>
            <input className={styles.inlineInput} placeholder="Container name…" value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()} autoFocus />
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Created on the active map. Use the Tile panel to place it on a specific tile.
            </div>
            <div className={styles.actionRow}>
              <button className={styles.cancelBtn} onClick={() => { setAdding(false); setNewName('Chest') }}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleAdd} disabled={!newName.trim()}>Add</button>
            </div>
          </div>
        ) : (
          <button className={styles.addEntryBtn} onClick={() => setAdding(true)}>+ Add container</button>
        )}
      </div>
    </>
  )
}

// ── Story tab (Storyboards + Lore/Notes) ─────────────────────
function StoryTab() {
  const [subTab, setSubTab] = useState('lore')
  return (
    <>
      <div className={styles.subTabBar}>
        {[['lore', 'Lore & Notes'], ['storyboards', 'Storyboards']].map(([id, label]) => (
          <button key={id}
            className={`${styles.subTab} ${subTab === id ? styles.subTabActive : ''}`}
            onClick={() => setSubTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {subTab === 'storyboards' && <StoryboardEditor />}
      {subTab === 'lore'        && <LoreTab />}
    </>
  )
}

// ── Lore & Notes ──────────────────────────────────────────────
function LoreTab() {
  const { campaign, addStoryEntry, deleteStoryEntry } = useStore()
  const [expanded, setExpanded] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState('lore')

  const TYPE_DEF = {
    lore:    { label: 'Lore',    icon: '📜', color: '#c8a96e' },
    secret:  { label: 'Secret',  icon: '🔒', color: '#c25a4a' },
    session: { label: 'Session', icon: '📅', color: '#5b9bd5' },
  }

  const entries = Object.values(campaign?.story || {})
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

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
        <LoreEntry
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

function LoreEntry({ entry, typeDef, expanded, onToggle, onDelete }) {
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
