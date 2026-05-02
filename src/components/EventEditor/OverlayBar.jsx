import React from 'react'
import { useStore } from '../../store/useStore'

export default function OverlayBar() {
  const { campaign, clearAllOverlays, makeOverlayPermanent, tileSelectionMode, endTileSelection, portalPickMode, endPortalPick, setActiveMap } = useStore()
  if (!campaign) return null

  // Portal pick mode — highest priority banner
  if (portalPickMode) {
    return (
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        background: '#1a1a1a', border: '2px solid #c8a96e', borderRadius: 10,
        padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12,
        zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', fontSize: 13,
        whiteSpace: 'nowrap', color: '#c8a96e',
      }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <span>Click a tile to set as portal destination</span>
        <button
          onClick={() => { endPortalPick(); setActiveMap(portalPickMode.originMapId) }}
          style={{
            padding: '4px 12px', borderRadius: 6, border: '1px solid #c8a96e',
            background: 'transparent', color: '#c8a96e', cursor: 'pointer', fontSize: 12,
          }}>
          Cancel
        </button>
      </div>
    )
  }

  // Tile selection mode bar — takes priority
  if (tileSelectionMode) {
    return (
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        background: '#1a1a1a', border: '2px solid #c8a96e', borderRadius: 10,
        padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12,
        zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', fontSize: 13,
        whiteSpace: 'nowrap', color: '#c8a96e',
      }}>
        <span style={{ fontSize: 18 }}>🖱</span>
        <span>
          <strong>Tile selection mode</strong> — click tiles to add/remove
          <span style={{ color: '#9a9790', marginLeft: 8 }}>
            {tileSelectionMode.tiles.length} selected
          </span>
        </span>
        <button
          onClick={() => endTileSelection()}
          style={{
            padding: '5px 14px', borderRadius: 6, border: '1.5px solid #c8a96e',
            background: '#c8a96e', color: '#1a1a1a', fontWeight: 700,
            fontSize: 12, cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    )
  }

  const activeMap = campaign.maps[campaign.activeMapId]
  const firedEvents = activeMap?.firedEvents || {}
  const count = Object.keys(firedEvents).length
  if (count === 0) return null

  // Group by type for summary
  const byType = {}
  Object.values(firedEvents).forEach(ov => {
    byType[ov.type] = (byType[ov.type] || 0) + 1
  })

  const hasBiomeable = Object.values(firedEvents).some(ov =>
    ['fire','flood','collapse'].includes(ov.type)
  )

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--bg-surface)',
      border: '0.5px solid var(--border-strong)',
      borderRadius: 10,
      padding: '8px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      zIndex: 20,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      fontSize: 12,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
        ⚡ {count} active overlay{count !== 1 ? 's' : ''}
      </span>
      <span style={{ color: 'var(--text-muted)' }}>
        {Object.entries(byType).map(([t, n]) => `${n} ${t}`).join(', ')}
      </span>

      {hasBiomeable && (
        <button
          onClick={() => {
            // Promote all biomeable overlays
            Object.keys(firedEvents).forEach(key => {
              makeOverlayPermanent(key)
            })
          }}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '0.5px solid var(--accent-dim)',
            background: 'transparent',
            color: 'var(--accent)',
            fontSize: 12,
            cursor: 'pointer',
          }}
          title="Permanently change biomes of affected tiles"
        >
          Make permanent
        </button>
      )}

      <button
        onClick={() => clearAllOverlays()}
        style={{
          padding: '4px 10px',
          borderRadius: 6,
          border: '0.5px solid var(--border-strong)',
          background: 'transparent',
          color: 'var(--text-muted)',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Clear overlays
      </button>
    </div>
  )
}