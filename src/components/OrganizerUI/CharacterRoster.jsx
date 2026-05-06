import React, { useState } from 'react'
import { useStore, getCampaignSystem } from '../../store/useStore'
import { tokenColor, tokenDisplay } from '../CharacterSheet/CharacterSheet'
import { StatusPill } from '../EffectSystem/StatusLibrary'
import { rollDice } from '../../utils/dice'
import styles from './Sidebar.module.css'

export default function CharacterRoster({ onOpenEntity }) {
  const { campaign, addActor, deleteActor, updateActor } = useStore()
  const system = getCampaignSystem(campaign)

  // Derive three groups from the system definition:
  //   players   — isPlayer: true
  //   characters — showInRoster: true, not isPlayer (npcs, villains, allies, etc.)
  //   creatures  — showInRoster: false (pets, mounts, wild, etc.)
  const playerTypes    = system.actorTypes.filter(t => t.isPlayer)
  const characterTypes = system.actorTypes.filter(t => !t.isPlayer && t.showInRoster)
  const creatureTypes  = system.actorTypes.filter(t => !t.showInRoster)

  const allActors = Object.values(campaign?.actors || {})
  const counts = {
    players:    allActors.filter(a => playerTypes.some(t => t.id === a.actorType)).length,
    characters: allActors.filter(a => characterTypes.some(t => t.id === a.actorType)).length,
    creatures:  allActors.filter(a => creatureTypes.some(t => t.id === a.actorType)).length,
  }

  const [filter, setFilter]             = useState('players')
  const [search, setSearch]             = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [collapsed, setCollapsed]       = useState(new Set())

  function toggleGroup(id) {
    setCollapsed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function matchesSearch(name) {
    return !search || name?.toLowerCase().includes(search.toLowerCase())
  }

  function handleAdd(actorType) {
    const typeDef = system.actorTypes.find(t => t.id === actorType)
    const id = addActor({ actorType, name: `New ${typeDef?.label ?? actorType}` })
    const sheetKind = typeDef?.showInRoster === false ? 'creature' : 'character'
    onOpenEntity(sheetKind, id)
  }

  function handleDelete(id, e) {
    e.stopPropagation()
    if (deleteConfirm === id) { deleteActor(id); setDeleteConfirm(null) }
    else setDeleteConfirm(id)
  }

  function openActor(actor) {
    const typeDef = system.actorTypes.find(t => t.id === actor.actorType)
    const kind = typeDef?.showInRoster === false ? 'creature' : 'character'
    onOpenEntity(kind, actor.id)
  }

  // Which actorTypes are shown for the current filter tab
  const visibleTypes = filter === 'players'
    ? playerTypes
    : filter === 'characters'
    ? characterTypes
    : creatureTypes

  const visibleActors = allActors
    .filter(a => visibleTypes.some(t => t.id === a.actorType) && matchesSearch(a.name))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Group visible actors by actorType for section headers
  const grouped = visibleTypes.map(typeDef => ({
    typeDef,
    actors: visibleActors.filter(a => a.actorType === typeDef.id),
  }))

  const tabs = [
    playerTypes.length    > 0 && { id: 'players',    label: `Players (${counts.players})` },
    characterTypes.length > 0 && { id: 'characters',  label: `Characters (${counts.characters})` },
    creatureTypes.length  > 0 && { id: 'creatures',   label: `Creatures (${counts.creatures})` },
  ].filter(Boolean)

  return (
    <>
      <div className={styles.section}>
        <input className={styles.searchInput} type="text" placeholder="Search actors…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className={styles.filterRow}>
          {tabs.map(t => (
            <button key={t.id}
              className={`${styles.filterBtn} ${filter === t.id ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      {grouped.map(({ typeDef, actors: typeActors }) => {
        const colors = tokenColor({ actorType: typeDef.id }, system)
        const isCollapsed = collapsed.has(typeDef.id)
        return (
          <React.Fragment key={typeDef.id}>
            <div className={styles.rosterSectionHeader} onClick={() => toggleGroup(typeDef.id)}
              style={{ cursor: 'pointer', userSelect: 'none' }}>
              <span className={styles.rosterSectionTitle}>
                <span className={styles.rosterSectionDot} style={{ background: colors.ring }} />
                {typeDef.icon} {typeDef.label}
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
                  ({typeActors.length})
                </span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button className={styles.addSmallBtn}
                  onClick={e => { e.stopPropagation(); handleAdd(typeDef.id) }}>
                  + Add
                </button>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{isCollapsed ? '▶' : '▼'}</span>
              </div>
            </div>

            {!isCollapsed && typeActors.length === 0 && (
              <div className={styles.rosterEmpty}>No {typeDef.label.toLowerCase()} yet.</div>
            )}

            {!isCollapsed && typeActors.map(actor => (
              <ActorCard
                key={actor.id}
                actor={actor}
                typeDef={typeDef}
                campaign={campaign}
                system={system}
                onOpen={() => openActor(actor)}
                onDelete={e => handleDelete(actor.id, e)}
                deleteConfirm={deleteConfirm === actor.id}
                onCancelDelete={e => { e.stopPropagation(); setDeleteConfirm(null) }}
                updateActor={updateActor}
              />
            ))}
          </React.Fragment>
        )
      })}
    </>
  )
}

// ── Actor card ────────────────────────────────────────────────
function ActorCard({ actor, typeDef, campaign, system, onOpen, onDelete, deleteConfirm, onCancelDelete, updateActor }) {
  const colors = tokenColor(actor, system)
  const loc = getLocation(actor, campaign)
  const owner = actor.ownedBy ? campaign?.actors?.[actor.ownedBy] : null
  const isPlayer = typeDef?.isPlayer

  function adjustHp(delta) {
    const cur = actor.stats?.hp ?? 0
    const max = actor.stats?.maxHp ?? 999
    updateActor(actor.id, { stats: { ...actor.stats, hp: Math.max(0, Math.min(max, cur + delta)) } })
  }

  function adjustCurrency(delta) {
    const hpStat = system.hpStat || 'hp'
    const cur = actor.currency?.[system.currencies?.[0]?.id ?? 'gp'] ?? 0
    const cid = system.currencies?.[0]?.id ?? 'gp'
    updateActor(actor.id, { currency: { ...actor.currency, [cid]: Math.max(0, cur + delta) } })
  }

  const primaryCurrency = system.currencies?.[0]
  const currencyVal = primaryCurrency ? (actor.currency?.[primaryCurrency.id] ?? 0) : null

  return (
    <div className={styles.rosterCard} style={{ borderLeftColor: colors.ring }} onClick={onOpen}>
      {/* Avatar — draggable token */}
      <div
        className={styles.rosterAvatar}
        style={{ background: colors.bg, borderColor: colors.ring, cursor: 'grab' }}
        draggable
        onDragStart={e => {
          e.stopPropagation()
          const size = 44
          const cv = document.createElement('canvas')
          cv.width = cv.height = size
          cv.style.cssText = 'position:fixed;top:-300px;pointer-events:none'
          const ctx = cv.getContext('2d')
          ctx.beginPath()
          ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
          ctx.fillStyle = colors.bg; ctx.fill()
          ctx.strokeStyle = colors.ring; ctx.lineWidth = 3; ctx.stroke()
          ctx.font = `${Math.round(size * 0.48)}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillStyle = colors.ring
          ctx.fillText(tokenDisplay(actor, system), size / 2, size / 2 + 1)
          document.body.appendChild(cv)
          e.dataTransfer.setDragImage(cv, size / 2, size / 2)
          setTimeout(() => document.body.removeChild(cv), 0)
          e.dataTransfer.setData('application/tilestories-entity', JSON.stringify({ id: actor.id, kind: typeDef?.showInRoster === false ? 'creature' : 'character' }))
          e.dataTransfer.effectAllowed = 'copy'
        }}
      >
        {actor.portrait
          ? <img src={actor.portrait} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', pointerEvents: 'none' }} />
          : <span style={{ fontSize: 18, pointerEvents: 'none' }}>{tokenDisplay(actor, system)}</span>
        }
      </div>

      {/* Info */}
      <div className={styles.rosterInfo}>
        <div className={styles.rosterNameRow}>
          <span className={styles.rosterName}>{actor.name}</span>
          {actor.addedByPlayer && <span className={styles.playerBadge} title="Joined via player device">🎮</span>}
        </div>
        <div className={styles.rosterMeta} style={{ color: colors.ring }}>
          {typeDef?.label ?? actor.actorType}
          {actor.species ? ` · ${actor.species}` : ''}
        </div>
        {owner && <div className={styles.rosterLoc}>👤 {owner.name}</div>}
        {loc  && <div className={styles.rosterLoc}>📍 {loc}</div>}

        {/* Status pills */}
        {(actor.activeStatuses || []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }} onClick={e => e.stopPropagation()}>
            {(actor.activeStatuses || []).slice(0, 3).map(({ statusId }) => (
              <StatusPill key={statusId} statusId={statusId} campaign={campaign} />
            ))}
            {(actor.activeStatuses || []).length > 3 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center' }}>
                +{(actor.activeStatuses || []).length - 3}
              </span>
            )}
          </div>
        )}

        {/* Currency for player-type actors */}
        {isPlayer && primaryCurrency && (
          <div className={styles.currencyRow} onClick={e => e.stopPropagation()}>
            <span className={styles.currencyIcon}>{primaryCurrency.shortLabel}</span>
            <button className={styles.hpBtn} onClick={() => adjustCurrency(-1)}>−</button>
            <input
              className={styles.currencyInput}
              type="number" min={0}
              value={currencyVal}
              onChange={e => {
                const cid = primaryCurrency.id
                updateActor(actor.id, { currency: { ...actor.currency, [cid]: Math.max(0, parseFloat(e.target.value) || 0) } })
              }}
            />
            <button className={styles.hpBtn} onClick={() => adjustCurrency(1)}>+</button>
          </div>
        )}
      </div>

      {/* Right: HP + dice + delete */}
      <div className={styles.rosterActions} onClick={e => e.stopPropagation()}>
        <div className={styles.hpQuick}>
          <div className={styles.hpLabel}>HP</div>
          <div className={styles.hpRow}>
            <button className={styles.hpBtn} onClick={() => adjustHp(-1)}>−</button>
            <span className={styles.hpVal}>{actor.stats?.hp ?? '?'}</span>
            <button className={styles.hpBtn} onClick={() => adjustHp(1)}>+</button>
          </div>
        </div>

        {isPlayer && (
          <button
            className={styles.rosterDiceBtn}
            title="Roll D20"
            onClick={() => {
              const value = rollDice('d20')
              window.__tilestoriesSend?.({
                type: 'DICE_ROLL',
                characterId: actor.id,
                characterName: actor.name,
                diceType: 'd20',
                value,
              })
            }}
          >🎲</button>
        )}

        {deleteConfirm
          ? <div className={styles.deleteConfirmInline}>
              <button className={styles.deleteYesBtn} onClick={onDelete}>✓</button>
              <button className={styles.deleteNoBtn} onClick={onCancelDelete}>✕</button>
            </div>
          : <button className={styles.deleteInlineBtn} onClick={onDelete} title="Delete">🗑</button>
        }
      </div>
    </div>
  )
}

function getLocation(actor, campaign) {
  if (!actor.currentMapId) return null
  const map = campaign?.maps?.[actor.currentMapId]
  if (!map) return null
  return actor.currentTile
    ? `${map.name} (${actor.currentTile.q},${actor.currentTile.r})`
    : map.name
}
