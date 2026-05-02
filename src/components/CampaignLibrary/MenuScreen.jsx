import React, { useState, useRef, useEffect } from 'react'
import { listCampaigns, loadCampaign, deleteCampaign, importCampaign } from '../../utils/storage'
import styles from './MenuScreen.module.css'

export default function MenuScreen({ onLoad, onNew }) {
  const [campaigns, setCampaigns] = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [importError, setImportError] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    setCampaigns(listCampaigns())
  }, [])

  function handleLoad(id) {
    const data = loadCampaign(id)
    if (data) onLoad(data)
  }

  function handleDelete(id) {
    deleteCampaign(id)
    setCampaigns(listCampaigns())
    setDeleteConfirm(null)
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    try {
      const data = await importCampaign(file)
      onLoad(data)
    } catch (err) {
      setImportError('Invalid campaign file — make sure it\'s a .tilestories.json export.')
    }
    e.target.value = ''
  }

  function fmtDate(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={styles.screen}>
      {/* Logo / title */}
      <div className={styles.hero}>
        <div className={styles.hexLogo}>⬡</div>
        <h1 className={styles.title}>TileStories</h1>
        <p className={styles.subtitle}>TTRPG Session Manager</p>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.btnPrimary} onClick={onNew}>
          + New campaign
        </button>
        <button className={styles.btnSecondary} onClick={() => fileRef.current?.click()}>
          Import .tilestories.json
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
      </div>

      {importError && <div className={styles.importError}>{importError}</div>}

      {/* Campaign list */}
      <div className={styles.library}>
        {campaigns.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyHex}>⬡</div>
            <p>No saved campaigns yet</p>
            <p className={styles.emptyHint}>Create a new campaign to get started</p>
          </div>
        ) : (
          <>
            <div className={styles.libraryHeader}>Saved campaigns ({campaigns.length})</div>
            <div className={styles.campaignGrid}>
              {campaigns.map(c => (
                <div key={c.id} className={styles.campaignCard}>
                  <div className={styles.cardHex}>⬡</div>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardName}>{c.name}</div>
                    <div className={styles.cardMeta}>
                      {c.mapCount} map{c.mapCount !== 1 ? 's' : ''} · Last saved {fmtDate(c.updatedAt)}
                    </div>
                    {c.description && (
                      <div className={styles.cardDesc}>{c.description}</div>
                    )}
                  </div>
                  <div className={styles.cardActions}>
                    <button className={styles.cardLoad} onClick={() => handleLoad(c.id)}>
                      Open
                    </button>
                    {deleteConfirm === c.id ? (
                      <div className={styles.deleteConfirm}>
                        <span>Delete?</span>
                        <button className={styles.deleteYes} onClick={() => handleDelete(c.id)}>Yes</button>
                        <button className={styles.deleteNo} onClick={() => setDeleteConfirm(null)}>No</button>
                      </div>
                    ) : (
                      <button className={styles.cardDelete} onClick={() => setDeleteConfirm(c.id)} title="Delete">🗑</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}