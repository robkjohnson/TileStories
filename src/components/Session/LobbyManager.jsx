import React, { useState } from 'react'
import styles from './SessionPanel.module.css'

export default function LobbyManager({ session, campaign, playerUrl, send, onEnd }) {
  const players = Object.values(session.players || {})
  const maps = Object.values(campaign?.maps || {})
  const [startingMapId, setStartingMapId] = useState(session.activeMapId || campaign?.activeMapId)

  function handleStart() {
    send({ type: 'START_GAME' })
  }

  function handleAssignTile(deviceId, tileKey) {
    send({ type: 'ASSIGN_START', deviceId, tileKey, mapId: startingMapId })
  }

  const allReady = players.length > 0 && players.every(p => p.ready)
  const allAssigned = players.length > 0 && players.every(p => p.assignedTile)

  return (
    <div className={styles.lobby}>
      {/* Join info */}
      <div className={styles.urlBox}>
        <div className={styles.urlLabel}>Players join at:</div>
        <div className={styles.urlValue}>{playerUrl}</div>
        <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(playerUrl)}>Copy</button>
      </div>

      <div className={styles.sectionLabel}>
        Players in lobby ({players.length})
      </div>

      {players.length === 0 ? (
        <div className={styles.empty}>Waiting for players to connect…</div>
      ) : (
        <div className={styles.playerList}>
          {players.map(p => (
            <div key={p.deviceId} className={styles.playerRow}>
              <div className={styles.playerInfo}>
                <span className={styles.playerName}>{p.name}</span>
                <span className={styles.playerChar}>
                  {p.character?.name || 'No character'}
                  {p.character?.type ? ` (${p.character.type})` : ''}
                </span>
              </div>
              <div className={styles.playerStatus}>
                {p.ready
                  ? <span className={styles.readyBadge}>✓ Ready</span>
                  : <span className={styles.waitingBadge}>Waiting</span>
                }
              </div>
              {/* Starting tile assignment */}
              <div className={styles.assignWrap}>
                {p.assignedTile
                  ? <span className={styles.assignedTile}>
                      📍 {p.assignedTile.q},{p.assignedTile.r}
                      <button className={styles.clearAssign}
                        onClick={() => send({ type: 'ASSIGN_START', deviceId: p.deviceId, tileKey: null })}>×</button>
                    </span>
                  : <span className={styles.noAssign}>No start tile</span>
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Starting map */}
      <div className={styles.sectionLabel}>Starting map</div>
      <select className={styles.mapSelect} value={startingMapId}
        onChange={e => setStartingMapId(e.target.value)}>
        {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>

      <p className={styles.hint}>
        To assign starting tiles: select a player in the inspector after clicking a tile, or use the map to click tiles while the lobby is open.
      </p>

      {/* Actions */}
      <div className={styles.lobbyActions}>
        <button className={styles.endBtn} onClick={onEnd}>End session</button>
        <button
          className={styles.startGameBtn}
          onClick={handleStart}
          disabled={players.length === 0}
        >
          ▶ Begin game {!allAssigned && players.length > 0 && '(some players unassigned)'}
        </button>
      </div>
    </div>
  )
}