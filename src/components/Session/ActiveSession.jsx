import React, { useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import styles from './SessionPanel.module.css'

export default function ActiveSession({ session, campaign, send, onEnd }) {
  const { moveRequests, dismissMoveRequest } = useSessionStore()
  const [cutsceneForm, setCutsceneForm] = useState(false)
  const [cutscene, setCutscene] = useState({ title: '', content: '', type: 'text' })

  const players = Object.values(session.players || {})
  const maps = Object.values(campaign?.maps || {})
  const currentTurn = session.turnOrder?.[session.currentTurnIndex]
  const isPaused = session.status === 'paused'

  function changeMap(mapId) {
    send({ type: 'CHANGE_MAP', mapId })
  }

  function showCutscene() {
    if (!cutscene.title && !cutscene.content) return
    send({ type: 'SHOW_CUTSCENE', cutscene })
    setCutsceneForm(false)
  }

  function dismissCutscene() {
    send({ type: 'DISMISS_CUTSCENE' })
  }

  function approveMoveRequest(req) {
    send({
      type: 'MOVE_TOKEN',
      entityType: 'characters',
      entityId: req.characterId,
      tileKey: req.tileKey,
    })
    dismissMoveRequest(req.id)
  }

  return (
    <div className={styles.activeSession}>

      {/* Status bar */}
      <div className={styles.statusBar}>
        <span className={`${styles.statusDot} ${isPaused ? styles.statusPaused : styles.statusActive}`} />
        <span className={styles.statusText}>{isPaused ? 'Paused' : 'Active'}</span>
        <button className={styles.pauseBtn}
          onClick={() => send({ type: 'PAUSE_GAME' })}>
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button className={styles.endBtn} onClick={onEnd}>End</button>
      </div>

      {/* Players */}
      <div className={styles.sectionLabel}>Players ({players.length})</div>
      <div className={styles.playerList}>
        {players.map(p => {
          const char = campaign?.characters?.[p.characterId] || p.character
          return (
            <div key={p.deviceId} className={styles.activePlayerRow}>
              <span className={styles.playerName}>{p.name}</span>
              <span className={styles.playerChar}>{char?.name || '—'}</span>
              <span className={styles.playerTile}>
                {char?.currentTile ? `(${char.currentTile.q},${char.currentTile.r})` : 'unplaced'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Turn tracker */}
      <div className={styles.sectionLabel}>Turn order</div>
      {session.turnOrder?.length > 0 ? (
        <div className={styles.turnTracker}>
          <div className={styles.currentTurn}>
            <span className={styles.turnLabel}>Current turn:</span>
            <span className={styles.turnName}>{currentTurn?.name || '—'}</span>
          </div>
          <div className={styles.turnBtns}>
            <button className={styles.turnBtn} onClick={() => send({ type: 'PREV_TURN' })}>◀</button>
            <button className={styles.turnBtn} onClick={() => send({ type: 'NEXT_TURN' })}>▶ Next</button>
          </div>
          <div className={styles.turnOrder}>
            {session.turnOrder.map((t, i) => (
              <span key={t.id} className={`${styles.turnChip} ${i === session.currentTurnIndex ? styles.turnChipActive : ''}`}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.empty}>No turn order set</div>
      )}

      {/* Change map */}
      <div className={styles.sectionLabel}>Player map</div>
      <div className={styles.mapSwitcher}>
        {maps.map(m => (
          <button key={m.id}
            className={`${styles.mapBtn} ${m.id === session.activeMapId ? styles.mapBtnActive : ''}`}
            onClick={() => changeMap(m.id)}>
            {m.name}
          </button>
        ))}
      </div>

      {/* Move requests */}
      {moveRequests.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Move requests ({moveRequests.length})</div>
          {moveRequests.map(req => (
            <div key={req.id} className={styles.moveRequest}>
              <span className={styles.moveReqName}>{req.playerName}</span>
              <span className={styles.moveReqTile}>→ {req.tileKey}</span>
              <button className={styles.approveBtn} onClick={() => approveMoveRequest(req)}>✓</button>
              <button className={styles.denyBtn} onClick={() => dismissMoveRequest(req.id)}>×</button>
            </div>
          ))}
        </>
      )}

      {/* Cutscene controls */}
      <div className={styles.sectionLabel}>Cutscene / Dialog</div>
      {session.cutscene ? (
        <div className={styles.activeCutscene}>
          <span className={styles.cutsceneTitle}>{session.cutscene.title || 'Active cutscene'}</span>
          <button className={styles.dismissCutsceneBtn} onClick={dismissCutscene}>Dismiss</button>
        </div>
      ) : !cutsceneForm ? (
        <button className={styles.showCutsceneBtn} onClick={() => setCutsceneForm(true)}>
          + Show cutscene / dialog
        </button>
      ) : (
        <div className={styles.cutsceneForm}>
          <input type="text" placeholder="Title…" value={cutscene.title}
            onChange={e => setCutscene(c => ({ ...c, title: e.target.value }))} />
          <textarea rows={3} placeholder="Content / narration…" value={cutscene.content}
            onChange={e => setCutscene(c => ({ ...c, content: e.target.value }))}
            style={{ resize: 'vertical' }} />
          <div className={styles.cutsceneTypeRow}>
            {['text','image','both'].map(t => (
              <button key={t}
                className={`${styles.typeBtn} ${cutscene.type === t ? styles.typeBtnActive : ''}`}
                onClick={() => setCutscene(c => ({ ...c, type: t }))}>
                {t}
              </button>
            ))}
          </div>
          <div className={styles.cutsceneActions}>
            <button className={styles.cancelBtn} onClick={() => setCutsceneForm(false)}>Cancel</button>
            <button className={styles.showBtn} onClick={showCutscene}>Show to players</button>
          </div>
        </div>
      )}

      {/* Music — placeholder for Phase next */}
      <div className={styles.sectionLabel}>Music & Sound <span className={styles.soon}>coming soon</span></div>
      <div className={styles.musicPlaceholder}>
        Music controls will be built in the next phase. The infrastructure is ready — devices are tracked, target selection is wired up.
      </div>

    </div>
  )
}