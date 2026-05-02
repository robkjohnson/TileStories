import React, { useRef } from 'react'
import { useStore } from '../../store/useStore'
import { getTileType } from '../../utils/biomes'
import { saveCampaign, exportCampaign, importCampaign } from '../../utils/storage'
import styles from './Toolbar.module.css'

export default function Toolbar({ onNewCampaign, onSave, extraRight }) {
  const { campaign, setCampaign, tool, setTool, activeBiome, setActiveBiome, showGrid, toggleGrid, showCoords, toggleCoords, showAllLabels, toggleAllLabels } = useStore()
  const tileTypes = campaign?.tileTypes || {}
  const fileInputRef = useRef(null)

  function handleSave() {
    if (!campaign) return
    saveCampaign(campaign)
    showToast('Campaign saved')
  }

  function handleExport() {
    if (!campaign) return
    exportCampaign(campaign)
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await importCampaign(file)
      setCampaign(data)
      showToast(`Imported "${data.name}"`)
    } catch { showToast('Import failed') }
    e.target.value = ''
  }

  return (
    <div className={styles.toolbar}>
      <span className={styles.logo}>TileStories</span>

      <div className={styles.group}>
        <ToolBtn active={tool === 'select'} onClick={() => setTool('select')}>
          <SelectIcon /> Select
        </ToolBtn>
        <ToolBtn active={tool === 'paint'} onClick={() => setTool('paint')}>
          <PaintIcon /> Paint
        </ToolBtn>
        <ToolBtn active={tool === 'erase'} onClick={() => setTool('erase')}>
          <EraseIcon /> Erase
        </ToolBtn>
      </div>

      {tool === 'paint' && (
        <div className={styles.group}>
          <BiomePicker activeBiome={activeBiome} onChange={setActiveBiome} tileTypes={tileTypes} />
        </div>
      )}

      <div className={styles.group}>
        <ToolBtn active={showGrid} onClick={toggleGrid}>Grid</ToolBtn>
        <ToolBtn active={showCoords} onClick={toggleCoords}>Coords</ToolBtn>
        <ToolBtn active={showAllLabels} onClick={toggleAllLabels}>Labels</ToolBtn>
      </div>

      <div className={styles.group}>

        <ToolBtn onClick={onNewCampaign}>+ New</ToolBtn>
        <ToolBtn onClick={onSave || handleSave} disabled={!campaign}>Save</ToolBtn>
        <ToolBtn onClick={handleExport} disabled={!campaign}>Export</ToolBtn>
        <ToolBtn onClick={() => fileInputRef.current?.click()}>Import</ToolBtn>
      </div>

      <div className={styles.coordReadout}>q, r: <span id="hex-coords">—</span></div>
      {campaign && <span className={styles.campaignName}>{campaign.name}</span>}

      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
    </div>
  )
}

function ToolBtn({ children, active, onClick, disabled }) {
  return (
    <button className={`${styles.btn} ${active ? styles.btnActive : ''}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function BiomePicker({ activeBiome, onChange, tileTypes }) {
  const active = getTileType(activeBiome, tileTypes)
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState({ top: 0, left: 0 })
  const btnRef = React.useRef(null)

  const typeList = Object.values(tileTypes)

  function handleOpen() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(o => !o)
  }

  return (
    <div>
      <button ref={btnRef} className={styles.biomePicker} onClick={handleOpen}>
        <span className={styles.swatch} style={{ background: active.color }} />
        {active.label || active.name}
        <ChevronIcon />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div className={styles.paletteDropdown} style={{ top: pos.top, left: pos.left }}>
            {typeList.map(tt => (
              <button key={tt.id} className={`${styles.paletteItem} ${tt.id === activeBiome ? styles.paletteItemActive : ''}`} onClick={() => { onChange(tt.id); setOpen(false) }}>
                <span className={styles.swatch} style={{ background: tt.color }} />
                {tt.name}
                {tt.walkable === false && <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>⛔</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function showToast(msg) {
  const existing = document.getElementById('hc-toast')
  if (existing) existing.remove()
  const el = document.createElement('div')
  el.id = 'hc-toast'
  el.textContent = msg
  el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--accent);color:#1a1a1a;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:500;z-index:9999;animation:hcfade 2.5s forwards;pointer-events:none;`
  if (!document.getElementById('hc-toast-style')) {
    const s = document.createElement('style'); s.id = 'hc-toast-style'
    s.textContent = `@keyframes hcfade{0%,60%{opacity:1}100%{opacity:0}}`
    document.head.appendChild(s)
  }
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2600)
}

function SelectIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L10 6L6.5 7L5 10L2 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg> }
function PaintIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="3.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.1"/><path d="M5 7L9.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }
function EraseIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 9.5L7 4.5M4.5 10L9.5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }
function ChevronIcon() { return <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 3.5L4.5 6L7 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }