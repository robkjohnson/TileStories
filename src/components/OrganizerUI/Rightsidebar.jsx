import React, { useState, Suspense, lazy } from 'react'
import { useStore } from '../../store/useStore'
import { useSessionStore } from '../../store/useSessionStore'
import TileDetail from './TileDetail'
import CharacterRoster from './CharacterRoster'
import SessionControls from './SessionControls'
import styles from './Sidebar.module.css'

// Hoisted outside component so lazy() is only called once
const CharacterSheet = lazy(() => import('../CharacterSheet/CharacterSheet'))
const CreatureSheet  = lazy(() => import('../CreatureSheet/CreatureSheet'))

const TABS = [
  { id: 'tile',     icon: '⬡',  label: 'Tile'     },
  { id: 'roster',   icon: '👥',  label: 'Roster'   },
  { id: 'session',  icon: '▶',  label: 'Session'  },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

export default function RightSidebar({ collapsed }) {
  const { selectedTile } = useStore()
  const [tab, setTab] = useState('tile')
  const [entityStack, setEntityStack] = useState([])

  React.useEffect(() => {
    if (selectedTile && entityStack.length === 0) setTab('tile')
  }, [selectedTile?.q, selectedTile?.r])

  function pushEntity(type, id) { setEntityStack(s => [...s, { type, id }]) }
  function popEntity() { setEntityStack(s => s.slice(0, -1)) }

  const topEntity = entityStack.length > 0 ? entityStack[entityStack.length - 1] : null

  return (
    <div className={`${styles.sidebar} ${styles.right}`}>
      {!collapsed && <>
        {/* Tab bar */}
        <div className={styles.tabBar}>
          {TABS.map(t => (
            <button key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => { setTab(t.id); setEntityStack([]) }}
              title={t.label}>
              <span className={styles.tabIcon}>{t.icon}</span>
              <span className={styles.tabLabel}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Back breadcrumb when drilling into entity */}
        {topEntity && (
          <div className={styles.breadcrumb}>
            <button className={styles.backBtn} onClick={popEntity}>← Back</button>
            <span className={styles.breadcrumbLabel}>
              {topEntity.type === 'character' ? 'Character' : 'Creature'}
            </span>
          </div>
        )}

        <div className={styles.tabContent}>
          {/* Entity drill-down overlays any tab */}
          {topEntity ? (
            <EntityDetail entity={topEntity} onBack={popEntity} />
          ) : (
            <>
              {tab === 'tile'     && <TileDetail onOpenEntity={pushEntity} />}
              {tab === 'roster'   && <CharacterRoster onOpenEntity={pushEntity} />}
              {tab === 'session'  && <SessionControls />}
              {tab === 'settings' && <SettingsTab />}
            </>
          )}
        </div>
      </>}
    </div>
  )
}

function EntityDetail({ entity, onBack }) {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
      {entity.type === 'character'
        ? <CharacterSheet characterId={entity.id} inline onClose={onBack} />
        : <CreatureSheet  creatureId={entity.id}  inline onClose={onBack} />
      }
    </Suspense>
  )
}

// ── Settings tab ──────────────────────────────────────────────
function SettingsTab() {
  const { showGrid, toggleGrid, showCoords, toggleCoords, showAllLabels, toggleAllLabels, labelSize, setLabelSize } = useStore()
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Map display</div>
      <label className={styles.settingRow}>
        <input type="checkbox" checked={showGrid} onChange={toggleGrid} />
        Show grid lines
      </label>
      <label className={styles.settingRow}>
        <input type="checkbox" checked={showCoords} onChange={toggleCoords} />
        Show coordinates
      </label>
      <label className={styles.settingRow}>
        <input type="checkbox" checked={showAllLabels} onChange={toggleAllLabels} />
        Show all tile labels
      </label>
      <div className={styles.settingRow}>
        <span style={{ flex: 1 }}>Label size</span>
        <input type="range" min={0.5} max={2} step={0.1} value={labelSize}
          onChange={e => setLabelSize(parseFloat(e.target.value))}
          style={{ width: 72, accentColor: 'var(--accent)' }} />
        <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{labelSize.toFixed(1)}×</span>
      </div>
    </div>
  )
}