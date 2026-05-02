// WebSocket client hook — used by both organizer and player apps
import { useEffect, useRef, useCallback } from 'react'

export default function useGameSocket(onMessage) {
  const wsRef = useRef(null)
  const onMessageRef = useRef(onMessage)
  const reconnectTimer = useRef(null)
  const mountedRef = useRef(false)
  onMessageRef.current = onMessage

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    } else {
      console.warn('[WS] Not connected, message dropped:', msg.type)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true

    function getWsUrl() {
      // Organizer is on :5173, players on :3001
      // Both connect to the WS server on :3001
      const host = window.location.hostname
      return `ws://${host}:3001`
    }

    function connect() {
      if (!mountedRef.current) return
      if (wsRef.current &&
          (wsRef.current.readyState === WebSocket.CONNECTING ||
           wsRef.current.readyState === WebSocket.OPEN)) return

      const ws = new WebSocket(getWsUrl())
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return }
        console.log('[WS] Connected')
        if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null }
      }

      ws.onmessage = (e) => {
        if (!mountedRef.current) return
        try { onMessageRef.current?.(JSON.parse(e.data)) }
        catch (err) { console.error('[WS] Parse error', err) }
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        console.log('[WS] Disconnected — reconnecting in 2s')
        reconnectTimer.current = setTimeout(connect, 2000)
      }

      ws.onerror = () => {
        // onclose will fire after onerror, handles reconnect
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null }
      if (wsRef.current) {
        wsRef.current.onclose = null  // prevent reconnect on intentional close
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, []) // eslint-disable-line

  return { send, wsRef }
}