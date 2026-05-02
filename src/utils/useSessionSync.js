// Auto-syncs organizer campaign changes to all players during an active session.
// Call this once at the App level — it watches the campaign store and debounces
// SYNC_CAMPAIGN messages so rapid edits don't flood the WebSocket.

import { useEffect, useRef, useCallback } from 'react'

const DEBOUNCE_MS = 800  // wait 800ms after last change before syncing

export default function useSessionSync(campaign, session, send) {
  const sendRef = useRef(send)
  sendRef.current = send

  const timerRef = useRef(null)
  const lastSyncedRef = useRef(null)

  // Call this when campaign state was received FROM the server, not created locally.
  // Records the snapshot so useSessionSync won't echo it back immediately.
  // Unlike a time-based suppression, this only blocks the exact received snapshot —
  // any subsequent organizer edit produces a different snapshot and syncs normally.
  const markSynced = useCallback((c) => {
    lastSyncedRef.current = JSON.stringify(c)
  }, [])

  useEffect(() => {
    if (!session || session.status === 'ended') return
    if (!campaign) return

    const snapshot = JSON.stringify(campaign)
    if (snapshot === lastSyncedRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      // Re-check: markSynced may have been called after the timer started
      if (snapshot === lastSyncedRef.current) return
      lastSyncedRef.current = snapshot
      sendRef.current({ type: 'SYNC_CAMPAIGN', campaign })
      console.log('[SYNC] Campaign pushed to players')
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [campaign, session?.status])

  return { markSynced }
}
