import React, { useState } from 'react'
import { useStore } from '../../store/useStore'
import { tokenColor, tokenDisplay } from '../CharacterSheet/CharacterSheet'
import { rollDice } from '../../utils/dice'
import styles from './Sidebar.module.css'

const CREATURE_TYPE_COLORS = {
  pet: '#7bc47f', mount: '#c8a96e', companion: '#5b9bd5',
  wild: '#9a9790', enemy: '#c25a4a',
}

export default function CharacterRoster({ onOpenEntity }) {
  const { campaign, addCharacter, deleteCharacter, addCreature, deleteCreature, updateCharacter } = useStore()
  const [filter, setFilter] = useState('players')
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)  // { id, kind }

  const allCharacters = Object.values(campaign?.characters || {})
  const allCreatures  = Object.values(campaign?.creatures  || {})

  const playerChars  = allCharacters.filter(c => c.type === 'player')
  const npcChars     = allCharacters.filter(c => c.type === 'npc')
  const monsterChars = allCharacters.filter(c => c.type === 'monster')

  const matchesSearch = (name) =>
    !search || name?.toLowerCase().includes(search.toLowerCase())

  function handleDeleteChar(id, e) {
    e.stopPropagation()
    if (deleteConfirm?.id === id) {
      deleteCharacter(id)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm({ id, kind: 'character' })
    }
  }

  function handleDeleteCreature(id, e) {
    e.stopPropagation()
    if (deleteConfirm?.id === id) {
      deleteCreature(id)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm({ id, kind: 'creature' })
    }
  }

  function handleAddCharacter(type) {
    const names = { player: 'New Player', npc: 'New NPC', monster: 'New Monster' }
    const id = addCharacter({ name: names[type] || 'New Character', type })
    onOpenEntity('character', id)
  }

  function handleAddCreature(type) {
    const id = addCreature({ type: type || 'wild' })
    onOpenEntity('creature', id)
  }

  function getLocation(entity, isCreature = false) {
    const mapId = entity.currentMapId
    if (!mapId) return null
    const map = campaign?.maps?.[mapId]
    if (!map) return null
    const tile = entity.currentTile
    return tile ? `${map.name} (${tile.q},${tile.r})` : map.name
  }

  return (
    <>
      {/* Search */}
      <div className={styles.section}>
        <input className={styles.searchInput} type="text" placeholder="Search…"
          value={search} onChange={e => setSearch(e.target.value)} />

        {/* Filter tabs */}
        <div className={styles.filterRow}>
          {[
            ['players',   `Players (${playerChars.length})`],
            ['npcs',      `NPCs (${npcChars.length})`],
            ['monsters',  `Monsters (${monsterChars.length})`],
            ['creatures', `Creatures (${allCreatures.length})`],
          ].map(([id, label]) => (
            <button key={id}
              className={`${styles.filterBtn} ${filter === id ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── Players section ── */}
      {filter === 'players' && (
        <>
          <div className={styles.rosterSectionHeader}>
            <span className={styles.rosterSectionTitle}>
              <span className={styles.rosterSectionDot} style={{ background: '#5b9bd5' }} />
              Player characters
            </span>
            <button className={styles.addSmallBtn} onClick={() => handleAddCharacter('player')}>+ Add</button>
          </div>

          {playerChars.length === 0 && (
            <div className={styles.rosterEmpty}>
              No player characters yet.{'\n'}Players create characters when they join a session.
            </div>
          )}

          {playerChars.filter(c => matchesSearch(c.name)).map(char => (
            <CharacterCard
              key={char.id}
              char={char}
              campaign={campaign}
              onOpen={() => onOpenEntity('character', char.id)}
              onDelete={e => handleDeleteChar(char.id, e)}
              deleteConfirm={deleteConfirm?.id === char.id}
              onCancelDelete={e => { e.stopPropagation(); setDeleteConfirm(null) }}
              isPlayerJoined={!!char.addedByPlayer}
              updateCharacter={updateCharacter}
            />
          ))}
        </>
      )}

      {/* ── NPCs section ── */}
      {filter === 'npcs' && (
        <>
          <div className={styles.rosterSectionHeader}>
            <span className={styles.rosterSectionTitle}>
              <span className={styles.rosterSectionDot} style={{ background: '#5b9bd5' }} />
              NPCs
            </span>
            <button className={styles.addSmallBtn} onClick={() => handleAddCharacter('npc')}>+ Add</button>
          </div>

          {npcChars.length === 0 && (
            <div className={styles.rosterEmpty}>No NPCs yet.</div>
          )}

          {npcChars.filter(c => matchesSearch(c.name)).map(char => (
            <CharacterCard
              key={char.id}
              char={char}
              campaign={campaign}
              onOpen={() => onOpenEntity('character', char.id)}
              onDelete={e => handleDeleteChar(char.id, e)}
              deleteConfirm={deleteConfirm?.id === char.id}
              onCancelDelete={e => { e.stopPropagation(); setDeleteConfirm(null) }}
              isPlayerJoined={false}
              updateCharacter={updateCharacter}
            />
          ))}
        </>
      )}

      {/* ── Monsters section ── */}
      {filter === 'monsters' && (
        <>
          <div className={styles.rosterSectionHeader}>
            <span className={styles.rosterSectionTitle}>
              <span className={styles.rosterSectionDot} style={{ background: '#c25a4a' }} />
              Monsters
            </span>
            <button className={styles.addSmallBtn} onClick={() => handleAddCharacter('monster')}>+ Add</button>
          </div>

          {monsterChars.length === 0 && (
            <div className={styles.rosterEmpty}>No monsters yet.</div>
          )}

          {monsterChars.filter(c => matchesSearch(c.name)).map(char => (
            <CharacterCard
              key={char.id}
              char={char}
              campaign={campaign}
              onOpen={() => onOpenEntity('character', char.id)}
              onDelete={e => handleDeleteChar(char.id, e)}
              deleteConfirm={deleteConfirm?.id === char.id}
              onCancelDelete={e => { e.stopPropagation(); setDeleteConfirm(null) }}
              isPlayerJoined={false}
              updateCharacter={updateCharacter}
            />
          ))}
        </>
      )}

      {/* ── Creatures section ── */}
      {filter === 'creatures' && (
        <>
          <div className={styles.rosterSectionHeader}>
            <span className={styles.rosterSectionTitle}>
              <span className={styles.rosterSectionDot} style={{ background: '#c8a96e' }} />
              Creatures
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['pet','wild','enemy'].map(type => (
                <button key={type} className={styles.addSmallBtn}
                  onClick={() => handleAddCreature(type)}>
                  + {type}
                </button>
              ))}
            </div>
          </div>

          {allCreatures.length === 0 && (
            <div className={styles.rosterEmpty}>No creatures yet. Add pets, wild animals, or enemies.</div>
          )}

          {allCreatures.filter(c => matchesSearch(c.name)).map(creature => (
            <CreatureCard
              key={creature.id}
              creature={creature}
              campaign={campaign}
              onOpen={() => onOpenEntity('creature', creature.id)}
              onDelete={e => handleDeleteCreature(creature.id, e)}
              deleteConfirm={deleteConfirm?.id === creature.id}
              onCancelDelete={e => { e.stopPropagation(); setDeleteConfirm(null) }}
            />
          ))}
        </>
      )}
    </>
  )
}

// ── Character card ─────────────────────────────────────────────
function CharacterCard({ char, campaign, onOpen, onDelete, deleteConfirm, onCancelDelete, isPlayerJoined, updateCharacter }) {
  const colors = tokenColor(char)
  const loc = getEntityLocation(char, campaign)
  const isPlayer = char.type === 'player'

  function adjustCurrency(delta) {
    const cur = char.currency ?? 0
    updateCharacter(char.id, { currency: Math.max(0, cur + delta) })
  }

  return (
    <div className={styles.rosterCard} style={{ borderLeftColor: colors.ring }} onClick={onOpen}>
      {/* Avatar */}
      <div className={styles.rosterAvatar} style={{ background: colors.bg, borderColor: colors.ring }}>
        {char.portrait
          ? <img src={char.portrait} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          : <span style={{ fontSize: 18 }}>{tokenDisplay(char)}</span>
        }
      </div>

      {/* Info */}
      <div className={styles.rosterInfo}>
        <div className={styles.rosterNameRow}>
          <span className={styles.rosterName}>{char.name}</span>
          {isPlayerJoined && (
            <span className={styles.playerBadge} title="Joined via player device">🎮</span>
          )}
        </div>
        <div className={styles.rosterMeta} style={{ color: colors.ring }}>
          {char.type}{isPlayerJoined && ' · Player'}
        </div>
        {loc && <div className={styles.rosterLoc}>📍 {loc}</div>}
        {/* Currency — shown inline for player characters */}
        {isPlayer && (
          <div className={styles.currencyRow} onClick={e => e.stopPropagation()}>
            <span className={styles.currencyIcon}>$</span>
            <button className={styles.hpBtn} onClick={() => adjustCurrency(-1)}>−</button>
            <input
              className={styles.currencyInput}
              type="number"
              min={0}
              value={char.currency ?? 0}
              onChange={e => updateCharacter(char.id, { currency: Math.max(0, parseFloat(e.target.value) || 0) })}
            />
            <button className={styles.hpBtn} onClick={() => adjustCurrency(1)}>+</button>
          </div>
        )}
      </div>

      {/* Right side: HP + roll + delete */}
      <div className={styles.rosterActions} onClick={e => e.stopPropagation()}>
        <div className={styles.hpQuick}>
          <div className={styles.hpLabel}>HP</div>
          <div className={styles.hpRow}>
            <button className={styles.hpBtn}
              onClick={() => updateCharacter(char.id, { stats: { ...char.stats, hp: Math.max(0, (char.stats?.hp || 0) - 1) } })}>−</button>
            <span className={styles.hpVal}>{char.stats?.hp ?? '?'}</span>
            <button className={styles.hpBtn}
              onClick={() => updateCharacter(char.id, { stats: { ...char.stats, hp: Math.min(char.stats?.maxHp || 999, (char.stats?.hp || 0) + 1) } })}>+</button>
          </div>
        </div>
        <button
          className={styles.rosterDiceBtn}
          title="Roll D20"
          onClick={() => {
            const value = rollDice('d20')
            window.__tilestoriesSend?.({
              type: 'DICE_ROLL',
              characterId: char.id,
              characterName: char.name,
              diceType: 'd20',
              value,
            })
          }}
        >🎲</button>
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

// ── Creature card ──────────────────────────────────────────────
function CreatureCard({ creature, campaign, onOpen, onDelete, deleteConfirm, onCancelDelete }) {
  const color = CREATURE_TYPE_COLORS[creature.type] || '#9a9790'
  const loc = getEntityLocation(creature, campaign)
  const owner = creature.ownedBy ? campaign?.characters?.[creature.ownedBy] : null

  return (
    <div className={styles.rosterCard} style={{ borderLeftColor: color }} onClick={onOpen}>
      <div className={styles.rosterAvatar} style={{ background: color + '22', borderColor: color }}>
        <span style={{ fontSize: 18 }}>{creature.emoji || '🐾'}</span>
      </div>

      <div className={styles.rosterInfo}>
        <div className={styles.rosterName}>{creature.name}</div>
        <div className={styles.rosterMeta} style={{ color }}>
          {creature.type}{creature.species ? ` · ${creature.species}` : ''}
        </div>
        {owner && <div className={styles.rosterLoc}>👤 {owner.name}</div>}
        {loc && <div className={styles.rosterLoc}>📍 {loc}</div>}
      </div>

      <div className={styles.rosterActions} onClick={e => e.stopPropagation()}>
        <div className={styles.hpQuick}>
          <div className={styles.hpLabel}>HP</div>
          <div className={styles.hpRow}>
            <button className={styles.hpBtn}
              onClick={() => useStore.getState().updateCreature(creature.id, {
                statBlock: { ...creature.statBlock, hp: Math.max(0, (creature.statBlock?.hp || 0) - 1) }
              })}>−</button>
            <span className={styles.hpVal}>{creature.statBlock?.hp ?? '?'}</span>
            <button className={styles.hpBtn}
              onClick={() => useStore.getState().updateCreature(creature.id, {
                statBlock: { ...creature.statBlock, hp: Math.min(creature.statBlock?.maxHp || 999, (creature.statBlock?.hp || 0) + 1) }
              })}>+</button>
          </div>
        </div>
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

function getEntityLocation(entity, campaign) {
  if (!entity.currentMapId) return null
  const map = campaign?.maps?.[entity.currentMapId]
  if (!map) return null
  return entity.currentTile
    ? `${map.name} (${entity.currentTile.q},${entity.currentTile.r})`
    : map.name
}