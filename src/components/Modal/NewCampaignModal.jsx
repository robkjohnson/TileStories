import React, { useState } from 'react'
import { makeCampaign } from '../../store/useStore'
import styles from './Modal.module.css'

export default function NewCampaignModal({ show, onCreate, onClose }) {
  const [name, setName] = useState('The Verdant Reaches')
  const [description, setDescription] = useState('')
  const [firstMapName, setFirstMapName] = useState('World Map')
  const [cols, setCols] = useState(18)
  const [rows, setRows] = useState(14)
  if (!show) return null

  function handleCreate() {
    if (!name.trim()) return
    const campaign = makeCampaign({
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

  return (
    <div className={styles.overlay} onKeyDown={handleKey}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>New campaign</h2>
          {onClose && <button className={styles.closeBtn} onClick={onClose}>×</button>}
        </div>

        <div className={styles.section}>Campaign</div>

        <div className={styles.field}>
          <label>Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Campaign name…" />
        </div>
        <div className={styles.field}>
          <label>Description <span className={styles.optional}>(optional)</span></label>
          <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief description of the campaign…" style={{ resize: 'none' }} />
        </div>

        <div className={styles.section}>First map</div>

        <div className={styles.field}>
          <label>Map name</label>
          <input type="text" value={firstMapName} onChange={e => setFirstMapName(e.target.value)} placeholder="e.g. World Map, Town Square…" />
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