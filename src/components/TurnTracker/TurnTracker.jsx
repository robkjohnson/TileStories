import React, { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { useSessionStore } from '../../store/useSessionStore'
import styles from './TurnTracker.module.css'

export default function TurnTracker() {
  const { campaign } = useStore()
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

  // All characters + creatures available to add
  const allChars = Object.values(campaign?.characters || {})
  const allCreatures = Object.values(campaign?.creatures || {})
  const inTurn = new Set(turnOrder.map(t => t.id))
  const available = [
    ...allChars.map(c => ({ id: c.id, name: c.name, type: c.type, emoji: c.emoji, entityKind: 'character' })),
    ...allCreatures.map(c => ({ id: c.id, name: c.name, type: c.type, emoji: c.emoji || '🐾', entityKind: 'creature' })),
  ].filter(e => !inTurn.has(e.id))

  function setMode(mode) { send({ type: 'SET_TURN_MODE', mode }) }
  function next() { send({ type: 'NEXT_TURN' }) }
  function prev() { send({ type: 'PREV_TURN' }) }
  function remove(id) { send({ type: 'REMOVE_FROM_TURN', id }) }

  function addToTurn(entity) {
    const entry = {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      emoji: entity.emoji,
      entityKind: entity.entityKind,
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

  const RING = { player:'#5b9bd5', npc:'#7bc47f', monster:'#c25a4a', pet:'#7bc47f', wild:'#9a9790', enemy:'#c25a4a', companion:'#5b9bd5', mount:'#c8a96e' }

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
          <span>Current: <strong style={{ color: RING[current.type] || '#c8a96e' }}>{current.name}</strong></span>
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
            const ring = RING[entry.type] || '#9a9790'
            const isActive = turnMode === 'turn' && idx === currentIdx
            return (
              <div key={entry.id}
                className={`${styles.orderItem} ${isActive ? styles.orderItemActive : ''}`}
                style={{ borderLeftColor: ring }}
                draggable
                onDragStart={e => onDragStart(e, idx)}
                onDragEnter={() => onDragEnter(idx)}
                onDragEnd={onDragEnd}
                onDragOver={e => e.preventDefault()}>
                <span className={styles.dragHandle}>⠿</span>
                <div className={styles.orderAvatar} style={{ background: ring + '22', borderColor: ring }}>
                  <span>{entry.emoji || '👤'}</span>
                </div>
                <div className={styles.orderInfo}>
                  <span className={styles.orderName}>{entry.name}</span>
                  <span className={styles.orderType} style={{ color: ring }}>
                    {isActive ? '← active' : entry.type}
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
                  || (addFilter === 'creature' ? e.entityKind === 'creature' : e.type === addFilter)
                const matchesSearch = !term || e.name.toLowerCase().includes(term)
                return matchesType && matchesSearch
              })
              if (available.length === 0)
                return <div className={styles.empty}>All characters are already in the turn order</div>
              if (filtered.length === 0)
                return <div className={styles.empty}>No matches</div>
              return filtered.map(entity => (
                <button key={entity.id} className={styles.addItem}
                  style={{ borderLeftColor: RING[entity.type] || '#9a9790' }}
                  onClick={() => addToTurn(entity)}>
                  <span>{entity.emoji || '👤'}</span>
                  <span className={styles.addItemName}>{entity.name}</span>
                  <span className={styles.addItemType} style={{ color: RING[entity.type] || '#9a9790' }}>{entity.type}</span>
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