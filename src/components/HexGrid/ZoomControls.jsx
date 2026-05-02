import React from 'react'
import { useStore } from '../../store/useStore'
import { gridBounds, HEX_SIZE } from '../../utils/hexMath'

export default function ZoomControls() {
  const { camera, setCamera, campaign } = useStore()

  function zoomAt(factor) {
    const el = document.querySelector('canvas')
    if (!el) return
    const W = el.width, H = el.height
    const cx = W / 2, cy = H / 2
    const newZoom = Math.min(6, Math.max(0.12, camera.zoom * factor))
    setCamera({ zoom: newZoom, x: cx - (cx - camera.x) * (newZoom / camera.zoom), y: cy - (cy - camera.y) * (newZoom / camera.zoom) })
  }

  function fitToView() {
    const el = document.querySelector('canvas')
    if (!el || !campaign) return
    const W = el.width, H = el.height
    const bounds = gridBounds(campaign.cols, campaign.rows, HEX_SIZE)
    const pad = 60
    const zoom = Math.min((W - pad * 2) / bounds.width, (H - pad * 2) / bounds.height, 2.5)
    setCamera({ zoom, x: (W - bounds.width * zoom) / 2 - bounds.minX * zoom, y: (H - bounds.height * zoom) / 2 - bounds.minY * zoom })
  }

  const pct = Math.round(camera.zoom * 100)

  const btn = { width: 32, height: 32, borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.16)', background: '#22252a', color: '#e8e6e1', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }

  return (
    <div style={{ position: 'absolute', bottom: 20, left: 16, display: 'flex', flexDirection: 'column', gap: 3, zIndex: 10 }}>
      <button style={btn} onClick={() => zoomAt(1.25)}>+</button>
      <button style={{ ...btn, fontSize: 11 }} onClick={fitToView}>{pct}%</button>
      <button style={btn} onClick={() => zoomAt(0.8)}>−</button>
    </div>
  )
}