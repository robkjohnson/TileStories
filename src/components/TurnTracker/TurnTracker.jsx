import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { useSessionStore } from '../../store/useSessionStore'
import { tokenColor } from '../CharacterSheet/CharacterSheet'
import styles from './TurnTracker.module.css'

export default function TurnTracker() {
  const { campaign, tickStatusDurations } = useStore()
  const { session } = useSessionStore()
  const [adding, setAdding] = useState(false)
  const [addFilter, setAddFilter] = useState('all')
  const [addSearch, setAddSearch] = useState('')
  const dragItem = useRef(null)
  const dragOver = useRef(null)

  const send = window.__tilestoriesSend
  if (!session || !send) return (
    <div className={styles.empty}>Start a session to use the turn tracker</div>
  )

  const turnOrder = session.turnOrder || []
  const currentIdx = session.currentTurnIndex ?? 0
  const turnMode = session.turnMode || 'organizer'
  const current = turnOrder[currentIdx]

  // Tick status durations whenever the active turn advances
  const prevIdxRef = useRef(null)
  useEffect(() => {
    if (turnMode !== 'turn' || turnOrder.length === 0) return
    if (prevIdxRef.current === null) { prevIdxRef.current = currentIdx; return }
    if (prevIdxRef.current === currentIdx) return
    const prevActor = turnOrder[prevIdxRef.current]
    const nextActor = turnOrder[currentIdx]
    if (prevActor?.id) tickStatusDurations(prevActor.id, 'end')
    if (nextActor?.id) tickStatusDurations(nextActor.id, 'start')
    prevIdxRef.current = currentIdx
  }, [currentIdx, turnMode])

  const CREATURE_TYPES = new Set(['pet','mount','companion','wild','enemy'])
  const inTurn = new Set(turnOrder.map(t => t.id))
  const available = Object.values(campaign?.actors || {})
    .filter(a => !inTurn.has(a.id))
    .map(a => ({ id: a.id, name: a.name, actorType: a.actorType, emoji: a.emoji || (CREATURE_TYPES.has(a.actorType) ? '🐾' : null) }))

  function setMode(mode) { send({ type: 'SET_TURN_MODE', mode }) }
  function next() { send({ type: 'NEXT_TURN' }) }
  function prev() { send({ type: 'PREV_TURN' }) }
  function remove(id) { send({ type: 'REMOVE_FROM_TURN', id }) }

  function addToTurn(entity) {
    const entry = {
      id: entity.id,
      name: entity.name,
      actorType: entity.actorType,
      emoji: entity.emoji,
      initiative: 0,
    }
    send({ type: 'SET_TURN_ORDER', turnOrder: [...turnOrder, entry] })
    setAdding(false)
  }

  // Drag reorder
  function onDragStart(e, idx) {
    dragItem.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragEnter(idx) { dragOver.current = idx }
  function onDragEnd() {
    if (dragItem.current === null || dragOver.current === null) return
    const newOrder = [...turnOrder]
    const [moved] = newOrder.splice(dragItem.current, 1)
    newOrder.splice(dragOver.current, 0, moved)
    send({ type: 'REORDER_TURN', turnOrder: newOrder })
    dragItem.current = null
    dragOver.current = null
  }

  const ring = (actorType) => tokenColor({ actorType }).ring

  return (
    <div className={styles.tracker}>
      {/* Mode selector */}
      <div className={styles.modeRow}>
        {[
          ['organizer', '🎲', 'Organizer'],
          ['party',     '🎉', 'Party'],
          ['turn',      '⚔️', 'Turn'],
        ].map(([mode, icon, label]) => (
          <button key={mode}
            className={`${styles.modeBtn} ${turnMode === mode ? styles.modeBtnActive : ''}`}
            onClick={() => setMode(mode)}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Current mode description */}
      <div className={styles.modeDesc}>
        {turnMode === 'organizer' && 'Organizer controls all — no active player turns'}
        {turnMode === 'party'     && 'All players act simultaneously'}
        {turnMode === 'turn'      && turnOrder.length === 0 && 'No tokens in turn order yet'}
        {turnMode === 'turn'      && turnOrder.length > 0 && current && (
          <span>Current: <strong style={{ color: ring(current.actorType) }}>{current.name}</strong></span>
        )}
      </div>

      {/* Turn controls */}
      {turnMode === 'turn' && turnOrder.length > 0 && (
        <div className={styles.controls}>
          <button className={styles.ctrlBtn} onClick={prev}>◀ Prev</button>
          <button className={styles.nextBtn} onClick={next}>Next ▶</button>
        </div>
      )}

      {/* Turn order list */}
      {turnOrder.length > 0 && (
        <div className={styles.orderList}>
          {turnOrder.map((entry, idx) => {
            const entryRing = ring(entry.actorType)
            const isActive = turnMode === 'turn' && idx === currentIdx
            return (
              <div key={entry.id}
                className={`${styles.orderItem} ${isActive ? styles.orderItemActive : ''}`}
                style={{ borderLeftColor: entryRing }}
                draggable
                onDragStart={e => onDragStart(e, idx)}
                onDragEnter={() => onDragEnter(idx)}
                onDragEnd={onDragEnd}
                onDragOver={e => e.preventDefault()}>
                <span className={styles.dragHandle}>⠿</span>
                <div className={styles.orderAvatar} style={{ background: entryRing + '22', borderColor: entryRing }}>
                  <span>{entry.emoji || '👤'}</span>
                </div>
                <div className={styles.orderInfo}>
                  <span className={styles.orderName}>{entry.name}</span>
                  <span className={styles.orderType} style={{ color: entryRing }}>
                    {isActive ? '← active' : entry.actorType}
                  </span>
                </div>
                {isActive && <span className={styles.activeCrown}>👑</span>}
                <button className={styles.removeBtn} onClick={() => remove(entry.id)} title="Remove">×</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add tokens */}
      <div className={styles.addSection}>
        {adding ? (
          <>
            <div className={styles.addHeader}>
              <span className={styles.addTitle}>Add to turn order</span>
              <button className={styles.cancelAddBtn} onClick={() => { setAdding(false); setAddFilter('all'); setAddSearch('') }}>Cancel</button>
            </div>

            {/* Search */}
            <input
              className={styles.addSearch}
              type="text"
              placeholder="Search…"
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
            />

            {/* Filter chips */}
            <div className={styles.addFilterRow}>
              {[
                ['all',       'All'],
                ['player',    'Players'],
                ['npc',       'NPCs'],
                ['monster',   'Monsters'],
                ['creature',  'Creatures'],
              ].map(([id, label]) => (
                <button key={id}
                  className={`${styles.addFilterBtn} ${addFilter === id ? styles.addFilterBtnActive : ''}`}
                  onClick={() => setAddFilter(id)}>
                  {label}
                </button>
              ))}
            </div>

            {(() => {
              const term = addSearch.trim().toLowerCase()
              const filtered = available.filter(e => {
                const matchesType = addFilter === 'all'
                  || (addFilter === 'creature' ? CREATURE_TYPES.has(e.actorType) : e.actorType === addFilter)
                const matchesSearch = !term || e.name.toLowerCase().includes(term)
                return matchesType && matchesSearch
              })
              if (available.length === 0)
                return <div className={styles.empty}>All characters are already in the turn order</div>
              if (filtered.length === 0)
                return <div className={styles.empty}>No matches</div>
              return filtered.map(entity => (
                <button key={entity.id} className={styles.addItem}
                  style={{ borderLeftColor: ring(entity.actorType) }}
                  onClick={() => addToTurn(entity)}>
                  <span>{entity.emoji || '👤'}</span>
                  <span className={styles.addItemName}>{entity.name}</span>
                  <span className={styles.addItemType} style={{ color: ring(entity.actorType) }}>{entity.actorType}</span>
                </button>
              ))
            })()}
          </>
        ) : (
          <button className={styles.addBtn} onClick={() => setAdding(true)}>+ Add to turn order</button>
        )}
      </div>
    </div>
  )
}