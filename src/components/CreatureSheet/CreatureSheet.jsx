import React, { useState, useRef } from 'react'
import { useStore, newId } from '../../store/useStore'
import styles from './CreatureSheet.module.css'
import { useDebouncedField } from '../../utils/useDebouncedStore'
import { storeImage } from '../../utils/imageStorage'
import AbilityAssigner from '../AbilitySystem/AbilityAssigner'
import InventoryPanel from '../ItemSystem/InventoryPanel'
import { rollDice, DICE_TYPES } from '../../utils/dice'

const SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']
const CR_OPTIONS = ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30']
const TYPES = [
  { id: 'pet',       label: 'Pet',       color: '#7bc47f' },
  { id: 'mount',     label: 'Mount',     color: '#c8a96e' },
  { id: 'companion', label: 'Companion', color: '#5b9bd5' },
  { id: 'wild',      label: 'Wild',      color: '#9a9790' },
  { id: 'enemy',     label: 'Enemy',     color: '#c25a4a' },
]
const CREATURE_EMOJIS = ['🐾','🐺','🐻','🦁','🐯','🐲','🐉','🦅','🦆','🦉','🐍','🦎','🐢','🦇','🦊','🐗','🦌','🐴','🐂','🦏','🐘','🦋','🐝','🦀','🐙','🦑','🦈','🐊','🦂','🐓']

const ATTR_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }

function modifier(score) {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

function DebouncedNameInput({ value, onUpdate }) {
  const field = useDebouncedField(value, onUpdate)
  return <input className={styles.nameInput} {...field} placeholder="Creature name…" />
}

export default function CreatureSheet({ creatureId, onClose, inline }) {
  const { campaign, updateCreature, deleteCreature } = useStore()
  const [deleteConfirm, setDeleteConfirm] = React.useState(false)
  const creature = campaign?.creatures?.[creatureId]
  const [tab, setTab] = useState('stats')
  const portraitRef = useRef(null)

  if (!creature) return null

  const typeInfo = TYPES.find(t => t.id === creature.type) || TYPES[3]

  function update(field, value) { updateCreature(creatureId, { [field]: value }) }
  function updateStat(key, value) { updateCreature(creatureId, { statBlock: { ...creature.statBlock, [key]: value } }) }

  // Changing type: owned types keep/prompt owner, wild/enemy clears it
  function handleTypeChange(newType) {
    const ownedTypes = ['pet', 'mount', 'companion']
    if (ownedTypes.includes(newType)) {
      update('type', newType)
      // Don't clear existing owner when switching between owned types
    } else {
      // Wild / Enemy — clear ownership
      updateCreature(creatureId, { type: newType, ownedBy: null })
    }
  }

  async function handlePortrait(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const hash = await storeImage(ev.target.result)
      update('portrait', hash)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const sb = creature.statBlock || {}
  const characters = Object.values(campaign?.characters || {})
  const owner = creature.ownedBy ? campaign?.characters?.[creature.ownedBy] : null

  const sheetEl = (
      <div className={styles.sheet} style={inline ? { maxHeight:'100%', boxShadow:'none', border:'none', borderRadius:0, width:'100%', overflow:'auto' } : {}}>

        {/* Header */}
        <div className={styles.header} style={{ borderBottomColor: typeInfo.color }}>
          <div className={styles.portrait} style={{ borderColor: typeInfo.color }}
            onClick={() => portraitRef.current?.click()}>
            {creature.portrait
              ? <img src={creature.portrait} alt="" className={styles.portraitImg} />
              : <span className={styles.portraitEmoji}>{creature.emoji || '🐾'}</span>
            }
            <div className={styles.portraitOverlay}>📷</div>
          </div>
          <input ref={portraitRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePortrait} />

          <div className={styles.headerInfo}>
            <DebouncedNameInput value={creature.name} onUpdate={v => update('name', v)} />
            <input className={styles.speciesInput} value={creature.species || ''}
              onChange={e => update('species', e.target.value)} placeholder="Species / type…" />
            <div className={styles.typeRow}>
              {TYPES.map(t => (
                <button key={t.id}
                  className={`${styles.typeBtn} ${creature.type === t.id ? styles.typeBtnActive : ''}`}
                  style={creature.type === t.id ? { borderColor: t.color, color: t.color } : {}}
                  onClick={() => handleTypeChange(t.id)}>{t.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {deleteConfirm
              ? <>
                  <button style={{ padding:'3px 8px', borderRadius:4, background:'var(--danger)', color:'#fff', border:'none', fontSize:11, cursor:'pointer' }}
                    onClick={() => { deleteCreature(creatureId); onClose?.() }}>Delete</button>
                  <button style={{ padding:'3px 8px', borderRadius:4, border:'0.5px solid var(--border-strong)', background:'transparent', color:'var(--text-muted)', fontSize:11, cursor:'pointer' }}
                    onClick={() => setDeleteConfirm(false)}>Cancel</button>
                </>
              : <button style={{ padding:'3px 8px', borderRadius:4, border:'0.5px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:11, cursor:'pointer' }}
                  onClick={() => setDeleteConfirm(true)} title="Delete creature">🗑</button>
            }
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>
        </div>

        {/* Emoji row */}
        <div className={styles.emojiRow}>
          {CREATURE_EMOJIS.map((e, i) => (
            <button key={i}
              className={`${styles.emojiBtn} ${creature.emoji === e ? styles.emojiBtnActive : ''}`}
              onClick={() => update('emoji', e)}>{e}</button>
          ))}
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {[['stats','Stats'],['abilities','Abilities'],['traits','Traits'],['inventory','Inventory'],['info','Info']].map(([id, label]) => (
            <button key={id} className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
              onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {/* ── Stats tab ── */}
        {tab === 'stats' && (
          <div className={styles.tabContent}>

            {/* HP / AC / Speed row */}
            <div className={styles.mainStats}>
              <MainStat label="HP" value={sb.hp} max={sb.maxHp}
                onChange={v => updateStat('hp', v)} onMaxChange={v => updateStat('maxHp', v)} showMax />
              <MainStat label="AC" value={sb.ac} onChange={v => updateStat('ac', v)} />
              <MainStat label="Speed" value={sb.speed} onChange={v => updateStat('speed', v)} suffix="ft" />
            </div>

            {/* Size + CR */}
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Size</label>
                <select value={sb.size || 'medium'} onChange={e => updateStat('size', e.target.value)}>
                  {SIZES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Challenge Rating</label>
                <select value={sb.cr || '1/4'} onChange={e => updateStat('cr', e.target.value)}>
                  {CR_OPTIONS.map(cr => <option key={cr} value={cr}>CR {cr}</option>)}
                </select>
              </div>
            </div>

            {/* Attributes */}
            <div className={styles.sectionLabel}>Attributes</div>
            <div className={styles.attrGrid}>
              {Object.keys(ATTR_LABELS).map(attr => (
                <div key={attr} className={styles.attrBox}>
                  <div className={styles.attrLabel}>{ATTR_LABELS[attr]}</div>
                  <div className={styles.attrMod}>{modifier(sb[attr] || 10)}</div>
                  <input type="number" className={styles.attrInput}
                    value={sb[attr] || 10} min={1} max={30}
                    onChange={e => updateStat(attr, parseInt(e.target.value) || 10)} />
                </div>
              ))}
            </div>

            {/* Ownership — only for pet/mount/companion */}
            <div className={styles.sectionLabel}>Status</div>
            <div className={styles.statusSection}>
              {['pet','mount','companion'].includes(creature.type) ? (
                <>
                  <div className={styles.statusLabel}>
                    <span style={{ color: typeInfo.color }}>●</span>
                    {' '}{typeInfo.label} — assign to a character
                  </div>
                  <select
                    value={creature.ownedBy || ''}
                    onChange={e => update('ownedBy', e.target.value || null)}
                    className={styles.ownerSelect}
                  >
                    <option value="">— Unassigned (party asset) —</option>
                    {characters.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                    ))}
                  </select>
                  {owner
                    ? <div className={styles.ownerBadge} style={{ borderColor: typeInfo.color + '60' }}>
                        <span style={{ color: typeInfo.color }}>👤</span> Belongs to <strong>{owner.name}</strong>
                        <button
                          className={styles.releaseBtn}
                          onClick={() => updateCreature(creatureId, { ownedBy: null, type: 'wild' })}
                        >
                          Release to wild
                        </button>
                      </div>
                    : <div className={styles.ownerBadge}>
                        No owner assigned — unassigned {creature.type}s are party assets
                      </div>
                  }
                </>
              ) : (
                <div className={styles.statusSection}>
                  <div className={styles.statusLabel}>
                    <span style={{ color: typeInfo.color }}>●</span>
                    {' '}{typeInfo.label} — not owned by any character
                  </div>
                  {characters.length > 0 && (
                    <div className={styles.adoptRow}>
                      <span className={styles.adoptLabel}>Assign to:</span>
                      <div className={styles.adoptBtns}>
                        {characters.slice(0, 6).map(c => (
                          <button key={c.id} className={styles.adoptBtn}
                            onClick={() => updateCreature(creatureId, { ownedBy: c.id, type: 'pet' })}>
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Location */}
            {creature.currentMapId && campaign?.maps?.[creature.currentMapId] && (
              <>
                <div className={styles.sectionLabel}>Location</div>
                <div className={styles.locationRow}>
                  <span className={styles.locationMap}>{campaign.maps[creature.currentMapId].name}</span>
                  {creature.currentTile && <span className={styles.locationTile}>({creature.currentTile.q}, {creature.currentTile.r})</span>}
                </div>
              </>
            )}

            <CreatureSheetDiceRoller creature={creature} />
          </div>
        )}

        {/* ── Abilities tab ── */}
        {tab === 'abilities' && (
          <div className={styles.tabContent}>
            <AbilityAssigner entityType="creatures" entityId={creatureId} />
          </div>
        )}

        {/* ── Traits tab ── */}
        {tab === 'traits' && (
          <TraitsTab creature={creature} onUpdate={data => update('traits', data)} />
        )}

        {/* ── Inventory tab ── */}
        {tab === 'inventory' && (
          <div className={styles.tabContent}>
            <InventoryPanel entityType="creatures" entityId={creatureId} />
          </div>
        )}

        {/* ── Info tab ── */}
        {tab === 'info' && (
          <div className={styles.tabContent}>
            <div className={styles.sectionLabel}>Organizer notes</div>
            <textarea className={styles.notes} rows={6}
              value={creature.notes || ''}
              onChange={e => update('notes', e.target.value)}
              placeholder="Behaviour, history, special rules…"
            />
            {creature.portrait && (
              <button className={styles.removeBtn} onClick={() => update('portrait', null)}>Remove portrait</button>
            )}
          </div>
        )}
      </div>
  )
  if (inline) return sheetEl
  return <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>{sheetEl}</div>
}

// ── Sheet dice roller ─────────────────────────────────────────
function CreatureSheetDiceRoller({ creature }) {
  const [diceType, setDiceType] = useState('d20')
  const [description, setDescription] = useState('')
  const [lastRoll, setLastRoll] = useState(null)

  function handleRoll() {
    const value = rollDice(diceType)
    setLastRoll(value)
    window.__tilestoriesSend?.({
      type: 'DICE_ROLL',
      characterId: creature.id,
      characterName: creature.name,
      diceType,
      value,
      description: description.trim() || null,
    })
  }

  return (
    <>
      <div className={styles.sectionLabel}>Dice Roll for Creature</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {Object.keys(DICE_TYPES).map(dt => (
          <button key={dt}
            onClick={() => setDiceType(dt)}
            style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              border: `0.5px solid ${diceType === dt ? 'var(--accent)' : 'var(--border)'}`,
              background: diceType === dt ? 'rgba(200,169,110,0.12)' : 'transparent',
              color: diceType === dt ? 'var(--accent)' : 'var(--text-muted)',
            }}>
            {DICE_TYPES[dt].label}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Description (e.g. Attack roll)…"
        value={description}
        onChange={e => setDescription(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleRoll()}
        style={{ width: '100%', marginBottom: 6, padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--border-strong)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 12 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={handleRoll}
          style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--accent)', color: '#1a1a1a', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          🎲 Roll {DICE_TYPES[diceType].label}
        </button>
        {lastRoll !== null && (
          <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent)' }}>{lastRoll}</span>
        )}
      </div>
    </>
  )
}

// ── Traits tab ────────────────────────────────────────────────
function TraitsTab({ creature, onUpdate }) {
  const [editing, setEditing] = useState(null)
  const traits = creature.traits || []

  function addTrait() {
    const t = { id: newId(), name: 'New Trait', description: '' }
    onUpdate([...traits, t])
    setEditing(t.id)
  }

  function updateTrait(id, partial) {
    onUpdate(traits.map(t => t.id === id ? { ...t, ...partial } : t))
  }

  function removeTrait(id) {
    onUpdate(traits.filter(t => t.id !== id))
    if (editing === id) setEditing(null)
  }

  return (
    <div className={styles.tabContent}>
      <p className={styles.hint}>Natural traits, senses, resistances, or special properties of this creature.</p>
      <button className={styles.addBtn} onClick={addTrait}>+ Add trait</button>

      {traits.length === 0
        ? <div className={styles.empty}>No traits yet</div>
        : traits.map(trait => (
          <div key={trait.id} className={styles.traitCard}>
            <div className={styles.traitHeader} onClick={() => setEditing(editing === trait.id ? null : trait.id)}>
              <span className={styles.traitName}>{trait.name || '(unnamed)'}</span>
              <div className={styles.traitActions}>
                <button onClick={e => { e.stopPropagation(); removeTrait(trait.id) }} className={styles.removeInline}>×</button>
                <span className={styles.chevron}>{editing === trait.id ? '▲' : '▼'}</span>
              </div>
            </div>
            {editing === trait.id && (
              <div className={styles.traitBody}>
                <input className={styles.traitNameInput} value={trait.name}
                  onChange={e => updateTrait(trait.id, { name: e.target.value })}
                  placeholder="Trait name…" />
                <textarea className={styles.traitDesc} rows={3}
                  value={trait.description}
                  onChange={e => updateTrait(trait.id, { description: e.target.value })}
                  placeholder="Describe this trait…"
                  style={{ resize: 'vertical' }} />
              </div>
            )}
            {editing !== trait.id && trait.description && (
              <div className={styles.traitDescPreview}>{trait.description}</div>
            )}
          </div>
        ))
      }
    </div>
  )
}

// ── Inventory tab ─────────────────────────────────────────────
function InventoryTab({ creature, onUpdate }) {
  const inventory = creature.inventory || []

  function addItem() {
    onUpdate([...inventory, { id: newId(), name: 'New Item', quantity: 1, description: '', weight: 0 }])
  }

  function updateItem(id, partial) {
    onUpdate(inventory.map(i => i.id === id ? { ...i, ...partial } : i))
  }

  function removeItem(id) { onUpdate(inventory.filter(i => i.id !== id)) }

  const totalWeight = inventory.reduce((sum, i) => sum + ((i.weight || 0) * (i.quantity || 1)), 0)

  return (
    <div className={styles.tabContent}>
      <div className={styles.inventoryHeader}>
        <button className={styles.addBtn} onClick={addItem}>+ Add item</button>
        {inventory.length > 0 && (
          <span className={styles.weightTotal}>{totalWeight} lb total</span>
        )}
      </div>

      {inventory.length === 0
        ? <div className={styles.empty}>No items carried</div>
        : <div className={styles.itemList}>
            <div className={styles.itemListHeader}>
              <span>Item</span><span>Qty</span><span>Weight</span><span />
            </div>
            {inventory.map(item => (
              <div key={item.id} className={styles.itemRow}>
                <div className={styles.itemNameWrap}>
                  <input className={styles.itemName} value={item.name}
                    onChange={e => updateItem(item.id, { name: e.target.value })}
                    placeholder="Item name…" />
                  {item.description !== undefined && (
                    <input className={styles.itemDesc} value={item.description}
                      onChange={e => updateItem(item.id, { description: e.target.value })}
                      placeholder="Description…" />
                  )}
                </div>
                <input type="number" className={styles.itemQty} min={1}
                  value={item.quantity || 1}
                  onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })} />
                <div className={styles.itemWeightWrap}>
                  <input type="number" className={styles.itemWeight} min={0} step={0.1}
                    value={item.weight || 0}
                    onChange={e => updateItem(item.id, { weight: parseFloat(e.target.value) || 0 })} />
                  <span className={styles.lbLabel}>lb</span>
                </div>
                <button className={styles.removeInline} onClick={() => removeItem(item.id)}>×</button>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────
function MainStat({ label, value, max, onChange, onMaxChange, showMax, suffix }) {
  return (
    <div className={styles.mainStat}>
      <div className={styles.mainStatLabel}>{label}</div>
      <div className={styles.mainStatValue}>
        <input type="number" value={value ?? 0} onChange={e => onChange(parseInt(e.target.value) || 0)} />
        {showMax && <><span>/</span><input type="number" value={max ?? 0} onChange={e => onMaxChange(parseInt(e.target.value) || 0)} /></>}
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
    </div>
  )
}