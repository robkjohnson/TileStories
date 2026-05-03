import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore'
import styles from './TileTypeManager.module.css'

// ── Curated emoji palette for map building ────────────────────
const EMOJI_CATS = [
  { label: 'Terrain',    items: ['🌿','🌾','🌲','🌳','🌴','🎋','🌵','🍂','🍄','⛰️','🏔️','🌋','🏜️','🌊','💧','❄️','🌫️','🔥','🪨','🪵','🏝️','🗻','🌑','🌱','🍀','🌰','🪸','🫧','🟫','🟩','🏞️','🌿'] },
  { label: 'Nature',     items: ['🌸','🌹','🌺','🌷','🌼','🌻','🍁','🍃','🎍','🎄','🎋','🐾','🪺','💐','🪻','🌏','🌐','🍀','🌱','🌾','🌿','🍂','🍃','🪴','🎋','🎍','🌿','🌴','🌵','🎄','🌰','🫧'] },
  { label: 'Structures', items: ['🏠','🏡','🏘️','🏰','🏯','🏛️','⛩️','🕌','🕍','🏗️','🏚️','🏭','🗼','🚪','🧱','🛖','🏕️','⛺','🔐','⚰️','🏺','🌉','🛕','🏟️','🗿','🪤','🪣','🔔','🏪','🏨','🏦','🏥'] },
  { label: 'Roads',      items: ['🛤️','🛣️','⚓','🧭','🪧','🚧','🛑','🗺️','🏃','🚶','🛶','⛵','🚢','🌉','🪜','🛷','⛽','🚏','🏴','⛳','🪝','🎌','🏁','⛓️','🔗','🧲','🚩','🚶','🏍️','🛤️'] },
  { label: 'Weather',    items: ['☀️','🌙','⭐','🌟','💫','✨','🌈','☁️','⛅','🌤️','🌦️','🌧️','⛈️','🌩️','🌪️','🌫️','❄️','⛄','☃️','🔥','💧','⚡','🌬️','🌅','🌄','🌠','🌌','🌑','🌕','🌓','🌛','🌜'] },
  { label: 'Markers',    items: ['📍','📌','🚩','🏴','🏳️','⭐','🌟','❗','❓','⚠️','🔴','🟡','🟢','🔵','🟣','⚫','⚪','🎯','💎','👁️','🔱','⚜️','🔰','✅','❌','🏁','🔶','🔷','💠','🎴','🔮','🧿'] },
  { label: 'Combat',     items: ['⚔️','🛡️','🗡️','🏹','🪃','💣','🧨','⛓️','🪖','🎖️','🏆','🤺','💥','☠️','💀','🔩','⚙️','🔱','⚡','🔥','🎯','🗺️','🏴‍☠️','🥊','🪬','⚜️','🔫','🏺','⛏️','🪓'] },
  { label: 'Items',      items: ['🗝️','🔑','💰','💎','📜','⚗️','🏺','⛏️','🪓','🧪','🔮','🧿','🏮','🪔','🕯️','📦','🎁','🧰','🔭','🪄','🪝','🎲','🎭','🃏','💍','🧲','🔦','📯','🎺','🎸','🎒','🗝️'] },
  { label: 'Creatures',  items: ['🐉','🦁','🐺','🦅','🐍','🕷️','🦇','🦂','👻','🧟','👹','🧌','🧛','🐻','🦊','🦎','🐗','🦬','🦌','🦉','🦋','🐙','🦑','🦕','🐝','🦀','🦈','🐊','🦃','🐃','🦏','🦛'] },
  { label: 'Magic',      items: ['🔮','🪄','⚗️','🧿','✨','💫','🌀','🌟','🧙','🧝','🧜','🧚','🦄','🐲','⚡','🌙','👁️','🪬','🧬','🌈','🎭','⚜️','🔱','💠','🌌','☯️','🌠','🪩','🫧','💫','🌀','✴️'] },
  { label: 'People',     items: ['🧙','👑','🤺','🎭','🧝','🧚','🧜','🦸','🦹','🧌','🧛','👹','💀','👤','🤵','🧑‍🌾','🧑‍⚕️','🧑‍🎨','🧑‍⚖️','🕵️','🫅','🫡','🪖','🛡️','🏹','🧑‍🔬','🧑‍🚀','🤴','👸','🧑‍🍳'] },
  { label: 'Symbols',    items: ['♠️','♥️','♦️','♣️','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🔶','🔷','🔸','🔹','💠','✅','❌','⚠️','❓','❗','🔱','⚜️','🔰','🎌','🏁','⭐','🌟','💫','☯️','✴️'] },
]

// ── Preset tile types ─────────────────────────────────────────
const PRESETS = [
  { name: 'Road',        color: '#7a6a50', border: '#5a4a30', textColor: '#f0e8d8', icon: '🛤️', walkable: true  },
  { name: 'Dirt Road',   color: '#8a6840', border: '#6a4820', textColor: '#f8e8c0', icon: '🛣️', walkable: true  },
  { name: 'Camp',        color: '#5a7a50', border: '#3a5a30', textColor: '#d0f0c0', icon: '⛺', walkable: true  },
  { name: 'Tent',        color: '#6a7860', border: '#4a5840', textColor: '#dce8d4', icon: '⛺', walkable: true  },
  { name: 'Village',     color: '#8a6858', border: '#6a4838', textColor: '#f0d8c8', icon: '🏘️', walkable: true  },
  { name: 'Castle',      color: '#4a4a5a', border: '#2a2a3a', textColor: '#d0d0e8', icon: '🏰', walkable: true  },
  { name: 'Ruins',       color: '#605850', border: '#403830', textColor: '#d0c8b8', icon: '🏚️', walkable: true  },
  { name: 'Shrine',      color: '#8a3030', border: '#6a1010', textColor: '#f8c0b0', icon: '⛩️', walkable: true  },
  { name: 'Harbor',      color: '#2a6a8a', border: '#1a4a6a', textColor: '#b0d8f8', icon: '⚓', walkable: true  },
  { name: 'Bridge',      color: '#9a8060', border: '#7a6040', textColor: '#f8ead8', icon: '🌉', walkable: true  },
  { name: 'Mine',        color: '#4a4040', border: '#2a2020', textColor: '#c8c0b8', icon: '⛏️', walkable: true  },
  { name: 'Farm',        color: '#9a8030', border: '#7a6010', textColor: '#f8e8a0', icon: '🌾', walkable: true  },
  { name: 'Deep Forest', color: '#1a4a28', border: '#0a3018', textColor: '#90c8a0', icon: '🌲', walkable: true  },
  { name: 'Quicksand',   color: '#9a8850', border: '#7a6830', textColor: '#f0e0b0', icon: '⚠️', walkable: false },
  { name: 'Cliff',       color: '#5a5050', border: '#3a3030', textColor: '#d0c8c0', icon: '⛰️', walkable: false },
]

// ── Emoji Picker ──────────────────────────────────────────────
function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [cat, setCat] = useState(0)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const btnRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    function onDown(e) { if (ref.current && !ref.current.contains(e.target) && !btnRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function handleOpen() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 240) })
    }
    setOpen(o => !o)
  }

  const filtered = search.trim()
    ? EMOJI_CATS.flatMap(c => c.items).filter(e => e.includes(search))
    : EMOJI_CATS[cat]?.items || []

  return (
    <div className={styles.emojiPickerWrap}>
      <button ref={btnRef} className={styles.iconBtn} onClick={handleOpen} title="Pick an icon emoji">
        <span className={styles.iconBtnEmoji}>{value || '＋'}</span>
        <span className={styles.iconBtnLabel}>icon</span>
      </button>
      {value && (
        <button className={styles.iconClearBtn} onClick={() => onChange('')} title="Clear icon">×</button>
      )}

      {open && (
        <div ref={ref} className={styles.pickerPopover} style={{ top: pos.top, left: pos.left }}>
          <input
            className={styles.pickerSearch}
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {!search && (
            <div className={styles.pickerCats}>
              {EMOJI_CATS.map((c, i) => (
                <button key={c.label} className={`${styles.pickerCat} ${i === cat ? styles.pickerCatActive : ''}`}
                  onClick={() => setCat(i)}>{c.label}</button>
              ))}
            </div>
          )}
          <div className={styles.pickerGrid}>
            {filtered.map((e, i) => (
              <button key={i} className={styles.pickerEmoji}
                onClick={() => { onChange(e); setOpen(false); setSearch('') }}
                title={e}>{e}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── TileTypeManager ───────────────────────────────────────────
export default function TileTypeManager() {
  const { campaign, addTileType, updateTileType, deleteTileType, setActiveBiome } = useStore()
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [statusEffectsDraft, setStatusEffectsDraft] = useState('')
  const [showPresets, setShowPresets] = useState(false)

  const tileTypes = campaign?.tileTypes || {}
  const typeList = Object.values(tileTypes).sort((a, b) => a.name.localeCompare(b.name))

  const bgInputRef = useRef(null)

  function handleBgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => patchDraft('displayBackground', ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function startEdit(tt) { setEditingId(tt.id); setDraft({ ...tt }); setStatusEffectsDraft((tt.statusEffects || []).join(', ')) }
  function cancelEdit() { setEditingId(null); setDraft(null); setStatusEffectsDraft('') }

  function saveEdit() {
    if (!draft) return
    updateTileType(draft.id, draft)
    setEditingId(null)
    setDraft(null)
  }

  function handleDelete(id) {
    deleteTileType(id)
    if (editingId === id) { setEditingId(null); setDraft(null) }
  }

  function handleCreate() {
    const id = addTileType()
    setTimeout(() => {
      const tt = useStore.getState().campaign?.tileTypes?.[id]
      if (tt) startEdit(tt)
    }, 0)
  }

  function handleAddPreset(preset) {
    const id = addTileType(preset)
    setShowPresets(false)
  }

  function patchDraft(field, value) {
    setDraft(d => ({ ...d, [field]: value }))
  }

  function autoTextColor(hex) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
    return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.5 ? '#1a1a1a' : '#f0f0f0'
  }

  const existingNames = new Set(typeList.map(t => t.name.toLowerCase()))

  return (
    <div className={styles.manager}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Tile Types ({typeList.length})</span>
        <div className={styles.headerBtns}>
          <button className={styles.newBtn} onClick={() => setShowPresets(s => !s)}>
            {showPresets ? '↑ Presets' : '+ Preset'}
          </button>
          <button className={styles.newBtn} onClick={handleCreate}>+ New</button>
        </div>
      </div>

      {/* Preset quick-add panel */}
      {showPresets && (
        <div className={styles.presetsPanel}>
          <div className={styles.presetsLabel}>Click to add preset</div>
          <div className={styles.presetGrid}>
            {PRESETS.map(p => {
              const already = existingNames.has(p.name.toLowerCase())
              return (
                <button
                  key={p.name}
                  className={`${styles.presetItem} ${already ? styles.presetItemDim : ''}`}
                  onClick={() => !already && handleAddPreset(p)}
                  title={already ? 'Already added' : `Add "${p.name}"`}
                  style={{ background: p.color, color: p.textColor, borderColor: p.border }}
                  disabled={already}
                >
                  <span>{p.icon}</span>
                  <span className={styles.presetName}>{p.name}</span>
                  {!p.walkable && <span className={styles.noWalkDot}>⛔</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {typeList.length === 0 && !showPresets && (
        <div className={styles.empty}>No tile types yet. Add a preset or create a custom one.</div>
      )}

      {typeList.map(tt => (
        <div key={tt.id} className={styles.typeRow}>
          {editingId === tt.id && draft ? (
            <div className={styles.editPanel}>
              {/* Live preview */}
              <div className={styles.previewSwatch} style={{ background: draft.color, color: draft.textColor, borderColor: draft.border }}>
                <span className={styles.previewIcon}>{draft.icon || '○'}</span>
                <span className={styles.previewName}>{draft.name || 'Unnamed'}</span>
                {!draft.walkable && <span className={styles.noWalkBadge}>⛔</span>}
              </div>

              <label className={styles.fieldLabel}>Name
                <input className={styles.nameInput} value={draft.name} onChange={e => patchDraft('name', e.target.value)} />
              </label>

              {/* Icon row: emoji picker + direct text fallback */}
              <div className={styles.iconRow}>
                <span className={styles.fieldLabelInline}>Icon</span>
                <EmojiPicker value={draft.icon} onChange={v => patchDraft('icon', v)} />
              </div>

              <div className={styles.colorRow}>
                <label className={styles.colorField}>Fill
                  <input type="color" value={draft.color} onChange={e => {
                    const c = e.target.value
                    patchDraft('color', c)
                    patchDraft('textColor', autoTextColor(c))
                  }} />
                </label>
                <label className={styles.colorField}>Border
                  <input type="color" value={draft.border} onChange={e => patchDraft('border', e.target.value)} />
                </label>
                <label className={styles.colorField}>Text
                  <input type="color" value={draft.textColor} onChange={e => patchDraft('textColor', e.target.value)} />
                </label>
              </div>

              <label className={styles.walkableLabel}>
                <input type="checkbox" checked={!!draft.walkable} onChange={e => patchDraft('walkable', e.target.checked)} />
                <span>Walkable</span>
                <span className={styles.walkableHint}>Uncheck to block player movement</span>
              </label>

              <label className={styles.fieldLabel}>Status effects (comma-separated)
                <input
                  className={styles.nameInput}
                  value={statusEffectsDraft}
                  onChange={e => setStatusEffectsDraft(e.target.value)}
                  onBlur={e => patchDraft('statusEffects', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="poisoned, slowed…"
                />
              </label>

              {/* Display background */}
              <div className={styles.fieldLabel}>
                Display background
                <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 0.6, marginLeft: 4 }}>
                  shown full-screen on display when "Show Tile" is clicked
                </span>
                <div className={styles.bgRow}>
                  {draft.displayBackground ? (
                    <div className={styles.bgPreview}>
                      <img src={draft.displayBackground} alt="" className={styles.bgPreviewImg} />
                      <button className={styles.bgRemoveBtn} onClick={() => patchDraft('displayBackground', null)}>×</button>
                    </div>
                  ) : (
                    <div className={styles.bgPlaceholder}>None — will use fill color</div>
                  )}
                  <button className={styles.iconBtn} onClick={() => bgInputRef.current?.click()}>
                    <span className={styles.iconBtnEmoji}>📷</span>
                    <span className={styles.iconBtnLabel}>{draft.displayBackground ? 'Change' : 'Upload'}</span>
                  </button>
                  <input ref={bgInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }} onChange={handleBgUpload} />
                </div>
              </div>

              <div className={styles.editActions}>
                <button className={styles.cancelBtn} onClick={cancelEdit}>Cancel</button>
                <button className={styles.saveBtn} onClick={saveEdit}>Save</button>
              </div>
            </div>
          ) : (
            <div className={styles.typeItem}>
              <div className={styles.swatch} style={{ background: tt.color, borderColor: tt.border }}>
                {tt.icon && <span className={styles.swatchIcon}>{tt.icon}</span>}
              </div>
              <div className={styles.typeInfo}>
                <span className={styles.typeName}>{tt.name}</span>
                <div className={styles.typeMeta}>
                  {!tt.walkable && <span className={styles.noWalkTag}>⛔ No walk</span>}
                  {tt.statusEffects?.length > 0 && (
                    <span className={styles.effectsTag}>{tt.statusEffects.join(', ')}</span>
                  )}
                </div>
              </div>
              <div className={styles.typeActions}>
                <button className={styles.paintBtn} title="Set as active paint color"
                  onClick={() => setActiveBiome(tt.id)}>🖌</button>
                <button className={styles.editBtn} onClick={() => startEdit(tt)}>Edit</button>
                <button className={styles.deleteBtn} onClick={() => handleDelete(tt.id)} title="Delete">×</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
