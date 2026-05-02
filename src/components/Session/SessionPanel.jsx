import React, { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { useSessionStore } from '../../store/useSessionStore'
import LobbyManager from './LobbyManager'
import ActiveSession from './ActiveSession'
import styles from './SessionPanel.module.css'

export default function SessionPanel({ open, onClose, send, inline }) {
  const { campaign } = useStore()
  const { session, sessionStatus, connected, serverInfo, setServerInfo } = useSessionStore()

  // Fetch server info (local IP) on open
  useEffect(() => {
    if (!open) return
    fetch('http://localhost:3001/api/server-info')
      .then(r => r.json())
      .then(setServerInfo)
      .catch(() => setServerInfo({ ip: 'localhost', port: 3001 }))
  }, [open, setServerInfo])

  function handleHostSession() {
    if (!campaign) return
    send({ type: 'HOST_SESSION', campaign })
  }

  function handleEndSession() {
    send({ type: 'END_SESSION' })
  }

  const playerUrl = serverInfo ? `http://${serverInfo.ip}:${serverInfo.port}` : 'loading…'

  if (!inline && !open) return null

  return (
    <>
      <div className={inline ? styles.panelInline : `${styles.panel} ${open ? styles.panelOpen : ''}`}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>Session</span>
            <span className={`${styles.connDot} ${connected ? styles.connOnline : ''}`} />
            <span className={styles.connLabel}>{connected ? 'Server online' : 'Connecting…'}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>

          {/* No session */}
          {!session && (
            <div className={styles.noSession}>
              <div className={styles.noSessionHex}>⬡</div>
              <p className={styles.noSessionTitle}>No active session</p>
              <p className={styles.noSessionHint}>Start a session to let players join</p>

              {/* Player URL */}
              {serverInfo && (
                <div className={styles.urlBox}>
                  <div className={styles.urlLabel}>Players connect at:</div>
                  <div className={styles.urlValue}>{playerUrl}</div>
                  <button className={styles.copyBtn}
                    onClick={() => navigator.clipboard.writeText(playerUrl)}>
                    Copy
                  </button>
                </div>
              )}

              <button
                className={styles.startBtn}
                onClick={handleHostSession}
                disabled={!campaign || !connected}
              >
                {!campaign ? 'Load a campaign first' : !connected ? 'Connecting to server…' : '⚡ Start session'}
              </button>
            </div>
          )}

          {/* Lobby */}
          {session && sessionStatus === 'lobby' && (
            <LobbyManager
              session={session}
              campaign={campaign}
              playerUrl={playerUrl}
              send={send}
              onEnd={handleEndSession}
            />
          )}

          {/* Active / Paused */}
          {session && (sessionStatus === 'active' || sessionStatus === 'paused') && (
            <ActiveSession
              session={session}
              campaign={campaign}
              send={send}
              onEnd={handleEndSession}
            />
          )}

        </div>
      </div>
    </>
  )
}