import React, { useState, useRef, useEffect, useCallback } from 'react'
import styles from './ResizableSidebar.module.css'

const MIN_WIDTH = 180
const MAX_WIDTH = 520
const COLLAPSED_WIDTH = 32
const STORAGE_KEY_L = 'tilestories_sidebar_left_width'
const STORAGE_KEY_R = 'tilestories_sidebar_right_width'

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

export function LeftResizableSidebar({ collapsed, onToggleCollapse, children }) {
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(STORAGE_KEY_L))
    return isNaN(saved) ? 240 : clamp(saved, MIN_WIDTH, MAX_WIDTH)
  })
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startW.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const next = clamp(startW.current + delta, MIN_WIDTH, MAX_WIDTH)
      setWidth(next)
    }
    function onUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setWidth(w => { localStorage.setItem(STORAGE_KEY_L, w); return w })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const actualWidth = collapsed ? COLLAPSED_WIDTH : width

  return (
    <div className={styles.sidebarWrap} style={{ width: actualWidth, minWidth: actualWidth, maxWidth: actualWidth }}>
      <div className={styles.sidebarInner} style={{ width: actualWidth }}>
        {children}
      </div>
      {/* Resize handle — only when not collapsed */}
      {!collapsed && (
        <div className={styles.resizeHandleRight} onMouseDown={onMouseDown} title="Drag to resize" />
      )}
      {/* Collapse toggle */}
      <button
        className={`${styles.collapseBtn} ${styles.collapseBtnRight}`}
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand' : 'Collapse'}
        style={{ right: collapsed ? -10 : -10 }}>
        {collapsed ? '›' : '‹'}
      </button>
    </div>
  )
}

export function RightResizableSidebar({ collapsed, onToggleCollapse, children }) {
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(STORAGE_KEY_R))
    return isNaN(saved) ? 280 : clamp(saved, MIN_WIDTH, MAX_WIDTH)
  })
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startW.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current) return
      const delta = startX.current - e.clientX  // inverted for right sidebar
      const next = clamp(startW.current + delta, MIN_WIDTH, MAX_WIDTH)
      setWidth(next)
    }
    function onUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setWidth(w => { localStorage.setItem(STORAGE_KEY_R, w); return w })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const actualWidth = collapsed ? COLLAPSED_WIDTH : width

  return (
    <div className={styles.sidebarWrap} style={{ width: actualWidth, minWidth: actualWidth, maxWidth: actualWidth }}>
      {/* Resize handle on left edge */}
      {!collapsed && (
        <div className={styles.resizeHandleLeft} onMouseDown={onMouseDown} title="Drag to resize" />
      )}
      <div className={styles.sidebarInner} style={{ width: actualWidth }}>
        {children}
      </div>
      {/* Collapse toggle */}
      <button
        className={`${styles.collapseBtn} ${styles.collapseBtnLeft}`}
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? '‹' : '›'}
      </button>
    </div>
  )
}