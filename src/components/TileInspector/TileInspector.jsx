import React, { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { getTileType } from '../../utils/biomes'
import CharacterSheet, { tokenColor, tokenDisplay } from '../CharacterSheet/CharacterSheet'
import EventEditor from '../EventEditor/EventEditor'
import { getAnnotation, setAnnotation, clearAnnotation, PIN_COLORS } from '../../utils/playerAnnotations'
import { TileContainers } from '../ItemSystem/ContainerPanel'
import styles from './TileInspector.module.css'

export default function TileInspector({ inline }) {
  // Read selectedTile and the active map id directly
  const selectedTile = useStore(s => s.selectedTile)
  const setTileField  = useStore(s => s.setTileField)
  const setTileBiome  = useStore(s => s.setTileBiome)

  // Derive the tile and tileTypes directly from campaign state so this component
  // subscribes to the exact data it renders — prevents stale display after tile type changes.
  const { tile, tileTypes } = useStore(s => {
    const campaign = s.campaign
    if (!campaign || !s.selectedTile) return { tile: null, tileTypes: campaign?.tileTypes ?? {}, activeMapId: null }
    const mapId = campaign.activeMapId
    const map = campaign.maps[mapId]
    const key = `${s.selectedTile.q},${s.selectedTile.r}`
    const t = (map?.tiles?.[key]) ?? { biome: map?.defaultBiome ?? 'grassland', label: '', notes: '', tokens: [], events: [] }
    return { tile: t, tileTypes: campaign.tileTypes ?? {} }
  })

  const [sheetCharId, setSheetCharId] = useState(null)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Inspector</span>
      </div>

      <div className={styles.body}>
        {!selectedTile || !tile
          ? <EmptyState />
          : <TileDetail
              q={selectedTile.q}
              r={selectedTile.r}
              tile={tile}
              tileTypes={tileTypes}
              onBiomeChange={(id) => setTileBiome(selectedTile.q, selectedTile.r, id)}
              onFieldChange={(field, val) => setTileField(selectedTile.q, selectedTile.r, field, val)}
              onOpenSheet={setSheetCharId}
            />
        }
      </div>

      {sheetCharId && <CharacterSheet characterId={sheetCharId} onClose={() => setSheetCharId(null)} />}
    </div>
  )
}

function EmptyState() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>⬡</div>
      <p>Click any tile to inspect it</p>
    </div>
  )
}

function TileDetail({ q, r, tile, tileTypes, onBiomeChange, onFieldChange, onOpenSheet }) {
  const tileType = getTileType(tile.biome, tileTypes)
  const tileBgInputRef = useRef(null)
  const [activeTileKey, setActiveTileKey] = useState(null)

  const currentKey = `${q},${r}`
  const isShowingThisTile = activeTileKey === currentKey

  function handleTileBgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => onFieldChange('displayBackground', ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function showTileOnDisplay() {
    if (isShowingThisTile) {
      window.__tilestoriesSend?.({ type: 'HIDE_TILE' })
      setActiveTileKey(null)
    } else {
      window.__tilestoriesSend?.({ type: 'SHOW_TILE', q, r })
      setActiveTileKey(currentKey)
    }
  }

  return (
    <>
      {/* Tile type banner */}
      <div className={styles.biomeBanner} style={{ background: tileType.color, color: tileType.textColor }}>
        <span className={styles.biomeIcon}>{tileType.icon}</span>
        <div style={{ flex: 1 }}>
          <div className={styles.biomeName}>
            {tileType.name}
            {tileType.walkable === false && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>⛔ not walkable</span>}
          </div>
          <div className={styles.biomeCoords}>({q}, {r})</div>
        </div>
        <button
          onClick={showTileOnDisplay}
          title={isShowingThisTile ? 'Hide tile from display' : "Show this tile's background on the display screen"}
          style={{
            padding: '4px 8px', borderRadius: 4, fontSize: 11,
            background: isShowingThisTile ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)',
            color: tileType.textColor,
            border: `0.5px solid ${tileType.textColor}88`, cursor: 'pointer',
            flexShrink: 0, transition: 'background 0.1s',
            fontWeight: isShowingThisTile ? 600 : 400,
          }}
        >
          {isShowingThisTile ? 'Hide Tile' : 'Show Tile'}
        </button>
      </div>

      {/* Organizer label + visibility toggle */}
      <Field label="Tile label">
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            placeholder="Name this tile…"
            value={tile.label || ''}
            onChange={e => onFieldChange('label', e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            title={tile.showLabel ? 'Showing on map — click to hide' : 'Hidden on map — click to show'}
            onClick={() => onFieldChange('showLabel', !tile.showLabel)}
            style={{
              padding: '0 8px',
              borderRadius: 'var(--radius-sm)',
              border: '0.5px solid var(--border-strong)',
              background: tile.showLabel ? 'rgba(200,169,110,0.2)' : 'transparent',
              color: tile.showLabel ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 14,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.1s',
            }}
          >
            {tile.showLabel ? '👁' : '👁‍🗨️'}
          </button>
        </div>
        {tile.label && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {tile.showLabel ? 'Visible on map' : 'Hidden — toggle to show on map'}
          </div>
        )}
      </Field>

      {/* Player annotation */}
      <PlayerAnnotationField q={q} r={r} />

      {/* Tokens section */}
      <TokensSection tile={tile} tileQ={q} tileR={r} onOpenSheet={onOpenSheet} />

      {/* Tile type picker */}
      <Field label="Change tile type">
        <div className={styles.biomeGrid}>
          {Object.values(tileTypes || {}).map(tt => {
            const isActive = tt.id === tile.biome || (!tile.biome && tt.id === 'grassland')
            return (
              <button
                key={tt.id}
                className={`${styles.biomeCell} ${isActive ? styles.biomeCellActive : ''}`}
                style={{ background: tt.color, borderColor: isActive ? 'var(--accent)' : tt.border }}
                title={`${tt.name}${tt.walkable === false ? ' ⛔' : ''}`}
                onClick={() => onBiomeChange(tt.id)}
              >
                {tt.icon || tt.name?.[0]}
              </button>
            )
          })}
        </div>
      </Field>

      {/* Notes */}
      <Field label="Organizer notes">
        <textarea rows={3} placeholder="Only visible to organizer…" value={tile.notes || ''} onChange={e => onFieldChange('notes', e.target.value)} style={{ resize: 'vertical' }} />
      </Field>

      {/* Per-tile display background */}
      <Field label="Display background">
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
          Overrides tile type default. Shown full-screen when "Show Tile" is clicked.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {tile.displayBackground ? (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img src={tile.displayBackground} alt="" style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 4, border: '0.5px solid var(--border)', display: 'block' }} />
              <button
                onClick={() => onFieldChange('displayBackground', null)}
                style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: 'var(--danger)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
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
      </Field>

      {/* Containers */}
      <div className={styles.sectionLabel}>Containers</div>
      <TileContainers tileKey={`${q},${r}`} />

      {/* Events */}
      <div className={styles.sectionLabel}>Events ({tile.events?.length ?? 0})</div>
      <EventEditor tileQ={q} tileR={r} tile={tile} />
    </>
  )
}

// ── Tokens section ────────────────────────────────────────────
function TokensSection({ tile, tileQ, tileR, onOpenSheet }) {
  const { campaign, updateCharacter, addCharacter, setTileField } = useStore()
  const [showRoster, setShowRoster] = useState(false)

  const tokenIds = tile.tokens || []
  const characters = campaign?.actors || {}

  // Actors on this tile
  const tileTokens = tokenIds.map(id => characters[id]).filter(Boolean)

  // Actors not on this map tile (available to place)
  const activeMapId = campaign?.activeMapId
  const available = Object.values(characters).filter(c =>
    !(c.currentMapId === activeMapId && c.currentTile?.q === tileQ && c.currentTile?.r === tileR)
  )

  function placeToken(charId) {
    const char = characters[charId]
    if (!char) return

    // Remove from previous tile if on this map
    if (char.currentMapId === activeMapId && char.currentTile) {
      const prevKey = `${char.currentTile.q},${char.currentTile.r}`
      // We need to update the previous tile's token list via store
      // Use a workaround: get prev tile and filter
      const prevMap = campaign.maps[activeMapId]
      const prevTile = prevMap?.tiles?.[prevKey]
      if (prevTile) {
        const newTokens = (prevTile.tokens || []).filter(id => id !== charId)
        useStore.getState().setTileField(char.currentTile.q, char.currentTile.r, 'tokens', newTokens)
      }
    }

    // Add to this tile
    const newTokens = [...tokenIds.filter(id => id !== charId), charId]
    setTileField(tileQ, tileR, 'tokens', newTokens)

    // Update character location
    updateCharacter(charId, { currentMapId: activeMapId, currentTile: { q: tileQ, r: tileR } })
    setShowRoster(false)
  }

  function removeToken(charId) {
    setTileField(tileQ, tileR, 'tokens', tokenIds.filter(id => id !== charId))
    updateCharacter(charId, { currentMapId: null, currentTile: null })
  }

  function createAndPlace(type) {
    const names = { player: 'New Player', npc: 'New NPC', monster: 'New Monster' }
    const id = addCharacter({ name: names[type], type })
    placeToken(id)
  }

  return (
    <div className={styles.tokensSection}>
      <div className={styles.tokensSectionHeader}>
        <span className={styles.sectionLabel} style={{ margin: 0 }}>Tokens ({tileTokens.length})</span>
        <button className={styles.addTokenBtn} onClick={() => setShowRoster(r => !r)}>
          {showRoster ? 'Done' : '+ Add'}
        </button>
      </div>

      {/* Tokens on this tile */}
      {tileTokens.length > 0 && (
        <div className={styles.tokenList}>
          {tileTokens.map(char => (
            <TokenCard
              key={char.id}
              character={char}
              onOpen={() => onOpenSheet(char.id)}
              onRemove={() => removeToken(char.id)}
            />
          ))}
        </div>
      )}

      {/* Roster / placement panel */}
      {showRoster && (
        <div className={styles.roster}>
          <div className={styles.rosterHeader}>Place on tile</div>

          {/* Quick create */}
          <div className={styles.quickCreate}>
            <button className={styles.quickCreateBtn} onClick={() => createAndPlace('player')}>+ Player</button>
            <button className={styles.quickCreateBtn} onClick={() => createAndPlace('npc')}>+ NPC</button>
            <button className={styles.quickCreateBtn} onClick={() => createAndPlace('monster')}>+ Monster</button>
          </div>

          {/* Existing characters */}
          {available.length > 0 && (
            <>
              <div className={styles.rosterDivider}>Existing characters</div>
              {available.map(char => (
                <button key={char.id} className={styles.rosterItem} onClick={() => placeToken(char.id)}>
                  <TokenDot character={char} size={26} />
                  <span className={styles.rosterName}>{char.name}</span>
                  <span className={styles.rosterType}>{char.actorType}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Token card in inspector ───────────────────────────────────
function TokenCard({ character, onOpen, onRemove }) {
  const colors = tokenColor(character)
  return (
    <div className={styles.tokenCard} style={{ borderColor: colors.ring + '55' }}>
      <TokenDot character={character} size={32} onClick={onOpen} />
      <div className={styles.tokenCardInfo}>
        <div className={styles.tokenCardName} onClick={onOpen}>{character.name}</div>
        <div className={styles.tokenCardMeta} style={{ color: colors.ring }}>
          {character.actorType} · HP {character.stats?.hp ?? '?'}/{character.stats?.maxHp ?? '?'}
        </div>
      </div>
      <button className={styles.tokenCardRemove} onClick={onRemove} title="Remove from tile">↑</button>
    </div>
  )
}

// ── Token dot (reused in map canvas logic via separate export) ─
export function TokenDot({ character, size = 32, onClick }) {
  const colors = tokenColor(character)
  const emoji = tokenDisplay(character)
  return (
    <div
      className={styles.tokenDot}
      style={{ width: size, height: size, background: colors.bg, borderColor: colors.ring, cursor: onClick ? 'pointer' : 'default', fontSize: size * 0.48 }}
      onClick={onClick}
      title={character.name}
    >
      {emoji}
    </div>
  )
}

function PlayerAnnotationField({ q, r }) {
  const { campaign, viewerMode } = useStore()
  const [annotation, setAnnotationState] = React.useState(null)
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState({ label: '', color: 'gold' })

  const campaignId = campaign?.id
  const mapId = campaign?.activeMapId

  // Load annotation on mount / tile change
  React.useEffect(() => {
    if (!campaignId || !mapId) return
    const ann = getAnnotation(campaignId, mapId, q, r)
    setAnnotationState(ann)
    if (ann) setDraft({ label: ann.label || '', color: ann.color || 'gold' })
    else setDraft({ label: '', color: 'gold' })
  }, [q, r, campaignId, mapId])

  function save() {
    if (!campaignId || !mapId) return
    setAnnotation(campaignId, mapId, q, r, draft)
    setAnnotationState(draft)
    setEditing(false)
  }

  function clear() {
    if (!campaignId || !mapId) return
    clearAnnotation(campaignId, mapId, q, r)
    setAnnotationState(null)
    setDraft({ label: '', color: 'gold' })
    setEditing(false)
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>My annotation</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'none', opacity: 0.7 }}>stored on this device</span>
      </div>

      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {annotation ? (
            <>
              <span style={{ fontSize: 14 }}>📍</span>
              <span style={{
                flex: 1,
                fontSize: 12,
                color: PIN_COLORS.find(p => p.id === annotation.color)?.color || 'var(--accent)',
                fontWeight: 500,
              }}>
                {annotation.label || '(pin)'}
              </span>
              <button onClick={() => setEditing(true)}
                style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Edit
              </button>
              <button onClick={clear}
                style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ×
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              style={{ width: '100%', padding: '6px', borderRadius: 'var(--radius-sm)', border: '0.5px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', transition: 'all 0.1s' }}
            >
              + Add my annotation
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-raised)', border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            value={draft.label}
            onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
            placeholder="Label this tile for yourself…"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && save()}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {PIN_COLORS.map(p => (
              <button
                key={p.id}
                onClick={() => setDraft(d => ({ ...d, color: p.id }))}
                title={p.label}
                style={{
                  width: 20, height: 20,
                  borderRadius: '50%',
                  background: p.color,
                  border: draft.color === p.id ? '2px solid #fff' : '2px solid transparent',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: draft.color === p.id ? `0 0 0 1px ${p.color}` : 'none',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)}
              style={{ padding: '4px 10px', borderRadius: 4, border: '0.5px solid var(--border-strong)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={save}
              style={{ padding: '4px 10px', borderRadius: 4, background: 'var(--accent)', color: '#1a1a1a', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      {children}
    </div>
  )
}