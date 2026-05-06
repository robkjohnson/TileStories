import React, { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { listCampaigns, loadCampaign, saveCampaign, exportCampaign, importCampaign, deleteCampaign } from '../../utils/storage'
import styles from './CampaignSidebar.module.css'

export default function CampaignSidebar({ open, onClose, onNew, inline }) {
  const { campaign, setCampaign } = useStore()
  const [campaigns, setCampaigns] = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (open) setCampaigns(listCampaigns())
  }, [open])

  function handleSwitch(id) {
    if (id === campaign?.id) { onClose(); return }
    const data = loadCampaign(id)
    if (data) { setCampaign(data); onClose() }
  }

  function handleDelete(e, id) {
    e.stopPropagation()
    deleteCampaign(id)
    setCampaigns(listCampaigns())
    setDeleteConfirm(null)
  }

  function handleExport() {
    if (campaign) exportCampaign(campaign)
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await importCampaign(file)
      setCampaign(data)
      saveCampaign(data)
      setCampaigns(listCampaigns())
      onClose()
    } catch { alert('Invalid campaign file') }
    e.target.value = ''
  }

  function fmtDate(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  if (!inline && !open) return null

  return (
    <>
      <div className={inline ? styles.sidebarInline : `${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>Campaigns</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Current campaign info */}
        {campaign && (
          <div className={styles.currentCampaign}>
            <div className={styles.currentLabel}>Active</div>
            <div className={styles.currentName}>{campaign.name}</div>
            <div className={styles.currentMeta}>
              {Object.keys(campaign.maps || {}).length} map{Object.keys(campaign.maps || {}).length !== 1 ? 's' : ''} ·
              {Object.keys(campaign.actors || {}).length} actors
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={styles.sidebarActions}>
          <button className={styles.actionBtn} onClick={onNew}>+ New campaign</button>
          <button className={styles.actionBtn} onClick={handleExport} disabled={!campaign}>↓ Export</button>
          <button className={styles.actionBtn} onClick={() => fileRef.current?.click()}>↑ Import</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        </div>

        {/* Campaign list */}
        <div className={styles.campaignList}>
          <div className={styles.listHeader}>All campaigns ({campaigns.length})</div>
          {campaigns.map(c => (
            <div
              key={c.id}
              className={`${styles.campaignItem} ${c.id === campaign?.id ? styles.campaignItemActive : ''}`}
              onClick={() => handleSwitch(c.id)}
            >
              <div className={styles.itemInfo}>
                <div className={styles.itemName}>{c.name}</div>
                <div className={styles.itemMeta}>{c.mapCount} map{c.mapCount !== 1 ? 's' : ''} · {fmtDate(c.updatedAt)}</div>
              </div>
              <div className={styles.itemActions} onClick={e => e.stopPropagation()}>
                {deleteConfirm === c.id ? (
                  <>
                    <button className={styles.deleteYes} onClick={e => handleDelete(e, c.id)}>Delete</button>
                    <button className={styles.deleteNo} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                  </>
                ) : (
                  <button className={styles.deleteBtn} onClick={() => setDeleteConfirm(c.id)}>🗑</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}