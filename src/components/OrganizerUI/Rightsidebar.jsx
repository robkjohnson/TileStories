import React, { useState, lazy, Suspense } from 'react'
import { useStore } from '../../store/useStore'
import TileDetail from './TileDetail'
import SessionControls from './SessionControls'
import styles from './Sidebar.module.css'

const CharacterSheet  = lazy(() => import('../CharacterSheet/CharacterSheet'))
const CreatureSheet   = lazy(() => import('../CreatureSheet/CreatureSheet'))
const CharacterRoster = lazy(() => import('./CharacterRoster'))

const TABS = [
  { id: 'tile',     icon: '⬡',  label: 'Tile'     },
  { id: 'actors',   icon: '👥', label: 'Actors'   },
  { id: 'session',  icon: '▶',  label: 'Session'  },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

export default function RightSidebar({ collapsed }) {
  const { selectedTile } = useStore()
  const [tab, setTab] = useState('tile')
  const [entityStack, setEntityStack] = useState([])

  React.useEffect(() => {
    if (selectedTile) { setTab('tile'); setEntityStack([]) }
  }, [selectedTile?.q, selectedTile?.r])

  function pushEntity(type, id) { setEntityStack(s => [...s, { type, id }]) }
  function popEntity()           { setEntityStack(s => s.slice(0, -1)) }
  const topEntity = entityStack[entityStack.length - 1] ?? null

  function handleTabChange(id) {
    setTab(id)
    setEntityStack([])
  }

  return (
    <div className={`${styles.sidebar} ${styles.right}`}>
      {!collapsed && (
        <>
          <div className={styles.tabBar}>
            {TABS.map(t => (
              <button key={t.id}
                className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
                onClick={() => handleTabChange(t.id)}
                title={t.label}>
                <span className={styles.tabIcon}>{t.icon}</span>
                <span className={styles.tabLabel}>{t.label}</span>
              </button>
            ))}
          </div>

          {topEntity && (
            <div className={styles.breadcrumb}>
              <button className={styles.backBtn} onClick={popEntity}>← Back</button>
              <span className={styles.breadcrumbLabel}>
                {topEntity.type === 'character' ? 'Character' : 'Creature'}
              </span>
            </div>
          )}

          <div className={styles.tabContent}>
            {topEntity ? (
              <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
                {topEntity.type === 'character'
                  ? <CharacterSheet characterId={topEntity.id} inline onClose={popEntity} />
                  : <CreatureSheet  creatureId={topEntity.id}  inline onClose={popEntity} />
                }
              </Suspense>
            ) : (
              <>
                {tab === 'tile'     && <TileDetail onOpenEntity={pushEntity} />}
                {tab === 'actors'   && (
                  <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
                    <CharacterRoster onOpenEntity={pushEntity} />
                  </Suspense>
                )}
                {tab === 'session'  && <SessionControls />}
                {tab === 'settings' && <SettingsTab />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Settings tab ──────────────────────────────────────────────
function SettingsTab() {
  const {
    showGrid, toggleGrid,
    showCoords, toggleCoords,
    showAllLabels, toggleAllLabels,
    labelSize, setLabelSize,
    statusIconSize, setStatusIconSize,
  } = useStore()

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
        <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>
          {labelSize.toFixed(1)}×
        </span>
      </div>
      <div className={styles.settingRow}>
        <span style={{ flex: 1 }}>Status icon size</span>
        <input type="range" min={0.4} max={2} step={0.1} value={statusIconSize}
          onChange={e => setStatusIconSize(parseFloat(e.target.value))}
          style={{ width: 72, accentColor: 'var(--accent)' }} />
        <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>
          {statusIconSize.toFixed(1)}×
        </span>
      </div>
    </div>
  )
}
