import React, { useState } from 'react'
import { makeCampaign, SYSTEMS } from '../../store/useStore'
import styles from './Modal.module.css'

export default function NewCampaignModal({ show, onCreate, onClose }) {
  const [name, setName]             = useState('The Verdant Reaches')
  const [description, setDescription] = useState('')
  const [firstMapName, setFirstMapName] = useState('World Map')
  const [cols, setCols]             = useState(18)
  const [rows, setRows]             = useState(14)
  const [systemId, setSystemId]     = useState(SYSTEMS[0]?.id ?? 'dnd5e')

  if (!show) return null

  function handleCreate() {
    if (!name.trim()) return
    const campaign = makeCampaign(systemId, {
      name: name.trim(),
      description: description.trim(),
      firstMapName: firstMapName.trim() || 'World Map',
      defaultBiome: 'grassland',
      defaultCols: Math.max(5, Math.min(60, cols)),
      defaultRows: Math.max(5, Math.min(60, rows)),
    })
    onCreate(campaign)
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape' && onClose) onClose()
  }

  const selectedSystem = SYSTEMS.find(s => s.id === systemId) ?? SYSTEMS[0]

  return (
    <div className={styles.overlay} onKeyDown={handleKey}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>New campaign</h2>
          {onClose && <button className={styles.closeBtn} onClick={onClose}>×</button>}
        </div>

        {/* Game system */}
        <div className={styles.section}>Game system</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 20px 12px', flexWrap: 'wrap' }}>
          {SYSTEMS.map(sys => (
            <button
              key={sys.id}
              onClick={() => setSystemId(sys.id)}
              style={{
                flex: 1, minWidth: 120,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1.5px solid ${sys.id === systemId ? 'var(--accent)' : 'var(--border-strong)'}`,
                background: sys.id === systemId ? 'rgba(200,169,110,0.1)' : 'var(--bg-raised)',
                color: sys.id === systemId ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.1s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{sys.name}</div>
              <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.3 }}>{sys.description}</div>
              <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>
                {sys.actorTypes.map(t => t.icon).join(' ')}
              </div>
            </button>
          ))}
        </div>

        {/* Actor type preview */}
        {selectedSystem && (
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>
              Actor types in {selectedSystem.name}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {selectedSystem.actorTypes.map(t => (
                <span key={t.id} style={{
                  padding: '2px 8px', borderRadius: 10,
                  border: '0.5px solid var(--border)',
                  background: 'var(--bg-overlay)',
                  fontSize: 11, color: 'var(--text-secondary)',
                }}>
                  {t.icon} {t.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Campaign details */}
        <div className={styles.section}>Campaign</div>
        <div className={styles.field}>
          <label>Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Campaign name…" />
        </div>
        <div className={styles.field}>
          <label>Description <span className={styles.optional}>(optional)</span></label>
          <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="A brief description of the campaign…" style={{ resize: 'none' }} />
        </div>

        {/* First map */}
        <div className={styles.section}>First map</div>
        <div className={styles.field}>
          <label>Map name</label>
          <input type="text" value={firstMapName} onChange={e => setFirstMapName(e.target.value)}
            placeholder="e.g. World Map, Town Square…" />
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label>Columns</label>
            <input type="number" value={cols} onChange={e => setCols(parseInt(e.target.value) || 18)} min={5} max={60} />
          </div>
          <div className={styles.field}>
            <label>Rows</label>
            <input type="number" value={rows} onChange={e => setRows(parseInt(e.target.value) || 14)} min={5} max={60} />
          </div>
        </div>
        <div className={styles.hint}>{cols} × {rows} = {cols * rows} tiles</div>

        <div className={styles.actions}>
          {onClose && <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>}
          <button className={styles.btnPrimary} onClick={handleCreate} disabled={!name.trim()}>
            Create campaign
          </button>
        </div>
      </div>
    </div>
  )
}
