import React, { useState, useRef } from 'react'
import { useDebouncedField } from '../../utils/useDebouncedStore'
import { useStore } from '../../store/useStore'
import { getTileType } from '../../utils/biomes'
import { tokenColor, tokenDisplay } from '../CharacterSheet/CharacterSheet'
import { StatusPill } from '../EffectSystem/StatusLibrary'
import EventEditor from '../EventEditor/EventEditor'
import { TileContainers } from '../ItemSystem/ContainerPanel'
import { getAnnotation, setAnnotation, clearAnnotation, PIN_COLORS } from '../../utils/playerAnnotations'
import { resolveStoryboardImages } from '../../utils/imageStorage'
import styles from './Sidebar.module.css'

export default function TileDetail({ onOpenEntity }) {
  const { selectedTile, getTile, setTileField, setTileBiome, campaign, removeStatusFromTile } = useStore()
  const tileBgInputRef = useRef(null)
  const [tileTypeOpen, setTileTypeOpen] = useState(false)
  const tileTypeRef = useRef(null)
  const [activeTileKey, setActiveTileKey] = useState(null)

  React.useEffect(() => {
    if (!tileTypeOpen) return
    function onDown(e) {
      if (tileTypeRef.current && !tileTypeRef.current.contains(e.target)) setTileTypeOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [tileTypeOpen])

  if (!selectedTile) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyHex}>⬡</div>
        <p>Click any tile to inspect it</p>
      </div>
    )
  }

  const tile = getTile(selectedTile.q, selectedTile.r)
  const tileType = getTileType(tile.biome, campaign?.tileTypes)

  function handleTileBgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setTileField(selectedTile.q, selectedTile.r, 'displayBackground', ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const currentKey = selectedTile ? `${selectedTile.q},${selectedTile.r}` : null
  const isShowingThisTile = activeTileKey !== null && activeTileKey === currentKey

  async function handleShowTile() {
    if (!window.__tilestoriesSend) return
    if (isShowingThisTile) {
      window.__tilestoriesSend({ type: 'HIDE_TILE' })
      setActiveTileKey(null)
      return
    }
    const sbId = tile.displayStoryboardId
    if (sbId) {
      const sb = campaign?.storyboards?.[sbId]
      if (sb) {
        const resolved = await resolveStoryboardImages(sb)
        window.__tilestoriesSend({ type: 'SHOW_STORYBOARD', storyboard: resolved })
        setActiveTileKey(null)
        return
      }
    }
    window.__tilestoriesSend({ type: 'SHOW_TILE', q: selectedTile.q, r: selectedTile.r })
    setActiveTileKey(currentKey)
  }

  return (
    <div className={styles.scrollArea}>
      {/* Tile type banner */}
      <div className={styles.biomeBanner} style={{ background: tileType.color, color: tileType.textColor, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={styles.biomeIcon}>{tileType.icon}</span>
        <div style={{ flex: 1 }}>
          <div className={styles.biomeName}>{tileType.name}</div>
          <div className={styles.biomeCoords}>({selectedTile.q}, {selectedTile.r})</div>
        </div>
        <button
          onClick={handleShowTile}
          style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, background: isShowingThisTile ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)', color: tileType.textColor, border: `0.5px solid ${tileType.textColor}88`, cursor: 'pointer', flexShrink: 0, fontWeight: isShowingThisTile ? 600 : 400 }}
        >{isShowingThisTile ? 'Hide Tile' : 'Show Tile'}</button>
      </div>

      {/* Label + show toggle */}
      <div className={styles.section}>
        <div className={styles.fieldRow}>
          <DebouncedTileInput
            value={tile.label || ''}
            onChange={v => setTileField(selectedTile.q, selectedTile.r, 'label', v)}
            placeholder="Tile label…"
            style={{ flex: 1 }}
          />
          <button
            title={tile.showLabel ? 'Visible on map' : 'Hidden on map'}
            className={`${styles.eyeBtn} ${tile.showLabel ? styles.eyeBtnOn : ''}`}
            onClick={() => setTileField(selectedTile.q, selectedTile.r, 'showLabel', !tile.showLabel)}>
            {tile.showLabel ? '👁' : '👁‍🗨'}
          </button>
        </div>
      </div>

      {/* Tile type change button + dropdown */}
      <div className={styles.section} ref={tileTypeRef} style={{ position: 'relative' }}>
        <button
          className={styles.changeTileTypeBtn}
          onClick={() => setTileTypeOpen(o => !o)}
        >
          <span>{tileType.icon}</span>
          <span style={{ flex: 1, textAlign: 'left' }}>Change Tile Type</span>
          <span style={{ fontSize: 9, opacity: 0.6 }}>{tileTypeOpen ? '▲' : '▼'}</span>
        </button>
        {tileTypeOpen && (
          <div className={styles.tileTypeDropdown}>
            {Object.values(campaign?.tileTypes || {}).map(tt => {
              const isActive = tt.id === tile.biome || (!tile.biome && tt.id === 'grassland')
              return (
                <button
                  key={tt.id}
                  className={`${styles.tileTypeOption} ${isActive ? styles.tileTypeOptionActive : ''}`}
                  onClick={() => { setTileBiome(selectedTile.q, selectedTile.r, tt.id); setTileTypeOpen(false) }}
                >
                  <span className={styles.tileTypeOptionDot} style={{ background: tt.color }}>{tt.icon}</span>
                  <span>{tt.name}</span>
                  {isActive && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--accent)' }}>✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Tokens */}
      <div className={styles.section}>
        <TokensSection tileQ={selectedTile.q} tileR={selectedTile.r} tile={tile} onOpenEntity={onOpenEntity} />
      </div>

      {/* Containers */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Containers</div>
        <TileContainers tileKey={`${selectedTile.q},${selectedTile.r}`} />
      </div>

      {/* Active Statuses */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Active Statuses</div>
        {(tile.activeStatuses || []).length === 0
          ? <div className={styles.emptyHint}>No active statuses on this tile.</div>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(tile.activeStatuses || []).map(({ statusId }) => (
                <StatusPill key={statusId} statusId={statusId} campaign={campaign}
                  onRemove={() => removeStatusFromTile(campaign.activeMapId, `${selectedTile.q},${selectedTile.r}`, statusId)} />
              ))}
            </div>
        }
      </div>

      {/* Events */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Events ({tile.events?.length ?? 0})</div>
        <EventEditor tileQ={selectedTile.q} tileR={selectedTile.r} tile={tile} />
      </div>

      {/* Notes */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Organizer notes</div>
        <DebouncedTileTextarea
          value={tile.notes || ''}
          onChange={v => setTileField(selectedTile.q, selectedTile.r, 'notes', v)}
          placeholder="Only visible to organizer…"
          rows={3}
        />
      </div>

      {/* Display background */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Display background</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          Shown full-screen when "Show Tile" is clicked. Storyboard takes priority over image.
        </div>

        {/* Storyboard picker */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Storyboard</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              value={tile.displayStoryboardId || ''}
              onChange={e => setTileField(selectedTile.q, selectedTile.r, 'displayStoryboardId', e.target.value || null)}
              style={{ flex: 1, fontSize: 12 }}
            >
              <option value="">None</option>
              {Object.values(campaign?.storyboards || {})
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(sb => <option key={sb.id} value={sb.id}>{sb.name}</option>)
              }
            </select>
            {tile.displayStoryboardId && (
              <button
                onClick={() => setTileField(selectedTile.q, selectedTile.r, 'displayStoryboardId', null)}
                style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            )}
          </div>
        </div>

        {/* Image override */}
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Image</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {tile.displayBackground ? (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img src={tile.displayBackground} alt="" style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 4, border: '0.5px solid var(--border)', display: 'block' }} />
                <button
                  onClick={() => setTileField(selectedTile.q, selectedTile.r, 'displayBackground', null)}
                  style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >×</button>
              </div>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', flex: 1 }}>
                None — uses tile type default
              </span>
            )}
            <button
              onClick={() => tileBgInputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text)', cursor: 'pointer', fontSize: 11 }}
            >
              <span>📷</span>
              <span>{tile.displayBackground ? 'Change' : 'Upload'}</span>
            </button>
            <input ref={tileBgInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }} onChange={handleTileBgUpload} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Stable debounced input components for tile fields
// Using wrapper components instead of hook directly so identity is stable
function DebouncedTileInput({ value, onChange, ...rest }) {
  const field = useDebouncedField(value, onChange)
  return <input className={styles.inlineInput} {...field} {...rest} />
}
function DebouncedTileTextarea({ value, onChange, ...rest }) {
  const field = useDebouncedField(value, onChange)
  return <textarea className={styles.inlineTextarea} {...field} {...rest} />
}

function TokensSection({ tileQ, tileR, tile, onOpenEntity }) {
  const { campaign, updateActor, addCharacter, setTileField, placeToken: storePlaceToken } = useStore()
  const [showRoster, setShowRoster] = useState(false)
  const [rosterFilter, setRosterFilter] = useState('all')
  const [rosterSearch, setRosterSearch] = useState('')

  const tokenIds = tile.tokens || []
  const actors = campaign?.actors || {}
  const activeMapId = campaign?.activeMapId
  const tileTokens = tokenIds.map(id => actors[id]).filter(Boolean)
  const placed = new Set(tokenIds)
  const CREATURE_TYPES = new Set(['pet','mount','companion','wild','enemy'])
  const availableAll = Object.values(actors)
    .filter(c => !placed.has(c.id))

  function placeToken(charId) {
    storePlaceToken(charId, tileQ, tileR, activeMapId)
    setShowRoster(false)
  }

  function removeToken(charId) {
    setTileField(tileQ, tileR, 'tokens', tokenIds.filter(id => id !== charId))
    updateActor(charId, { currentMapId: null, currentTile: null })
  }

  function createAndPlace(type) {
    const names = { player: 'New Player', npc: 'New NPC', monster: 'New Monster' }
    const id = addCharacter({ name: names[type], type })
    setTimeout(() => storePlaceToken(id, tileQ, tileR, activeMapId), 0)
  }

  return (
    <>
      <div className={styles.tokensSectionHeader}>
        <span className={styles.sectionLabel} style={{ margin: 0 }}>Tokens ({tileTokens.length})</span>
        <button className={styles.addSmallBtn} onClick={() => setShowRoster(r => !r)}>
          {showRoster ? 'Done' : '+ Add'}
        </button>
      </div>

      {tileTokens.map(char => {
        const colors = tokenColor(char)
        return (
          <div key={char.id} className={styles.tokenCard} style={{ borderLeftColor: colors.ring }}>
            <div className={styles.tokenAvatar} style={{ background: colors.bg, borderColor: colors.ring }}
              onClick={() => onOpenEntity('character', char.id)}>
              {char.portrait
                ? <img src={char.portrait} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <span style={{ fontSize: 16 }}>{tokenDisplay(char)}</span>
              }
            </div>
            <div className={styles.tokenInfo} onClick={() => onOpenEntity('character', char.id)}>
              <div className={styles.tokenName}>{char.name}</div>
              <div className={styles.tokenMeta} style={{ color: colors.ring }}>
                {char.actorType} · HP {char.stats?.hp ?? '?'}/{char.stats?.maxHp ?? '?'}
              </div>
            </div>
            <button className={styles.removeTokenBtn} onClick={() => removeToken(char.id)} title="Remove from tile">↑</button>
          </div>
        )
      })}

      {showRoster && (
        <div className={styles.rosterPanel}>
          <div className={styles.quickCreate}>
            {['player','npc','monster'].map(type => (
              <button key={type} className={styles.quickCreateBtn} onClick={() => createAndPlace(type)}>
                + {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {availableAll.length > 0 && (
            <>
              <div style={{ padding: '4px 6px 2px', borderTop: '0.5px solid var(--border)' }}>
                <input
                  type="text"
                  placeholder="Search…"
                  value={rosterSearch}
                  onChange={e => setRosterSearch(e.target.value)}
                  style={{ width: '100%', padding: '4px 6px', borderRadius: 4, border: '0.5px solid var(--border-strong)', background: 'var(--bg-overlay)', color: 'var(--text-primary)', fontSize: 11 }}
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '4px 6px' }}>
                {[['all','All'],['player','Players'],['npc','NPCs'],['monster','Monsters'],['creature','Creatures']].map(([id, label]) => (
                  <button key={id} onClick={() => setRosterFilter(id)}
                    style={{ padding: '2px 7px', borderRadius: 10, border: `0.5px solid ${rosterFilter === id ? 'var(--accent)' : 'var(--border)'}`, background: rosterFilter === id ? 'rgba(200,169,110,0.08)' : 'transparent', color: rosterFilter === id ? 'var(--accent)' : 'var(--text-muted)', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {label}
                  </button>
                ))}
              </div>

              <div className={styles.rosterDivider} style={{ borderTop: '0.5px solid var(--border)' }}>Add to tile</div>
              {(() => {
                const term = rosterSearch.trim().toLowerCase()
                const filtered = availableAll.filter(c => {
                  const matchType = rosterFilter === 'all'
                    || (rosterFilter === 'creature' ? CREATURE_TYPES.has(c.actorType) : c.actorType === rosterFilter)
                  const matchSearch = !term || c.name.toLowerCase().includes(term)
                  return matchType && matchSearch
                })
                if (filtered.length === 0) return (
                  <div style={{ padding: '8px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>No matches</div>
                )
                return filtered.map(char => {
                  const colors = tokenColor(char)
                  return (
                    <button key={char.id} className={styles.rosterItem} onClick={() => placeToken(char.id)}>
                      <span style={{ fontSize: 16 }}>{tokenDisplay(char)}</span>
                      <span className={styles.rosterName}>{char.name}</span>
                      <span className={styles.rosterType} style={{ color: colors.ring }}>{char.actorType}</span>
                    </button>
                  )
                })
              })()}
            </>
          )}
        </div>
      )}
    </>
  )
}