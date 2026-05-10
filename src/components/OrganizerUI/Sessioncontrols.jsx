import React, { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { useSessionStore } from '../../store/useSessionStore'
import styles from './Sidebar.module.css'
import TurnTracker from '../TurnTracker/TurnTracker'
import { rollDice, DICE_TYPES } from '../../utils/dice'
import { getCampaignSystem } from '../../systems/index'
import { QRCodeSVG } from 'qrcode.react'

export default function SessionControls() {
  const { campaign, updateCampaign, displayLabelSize, setDisplayLabelSize } = useStore()
  const { session, connected, setServerInfo, diceRolls } = useSessionStore()
  const [joinScreenOn, setJoinScreenOn] = useState(false)
  const [cutsceneForm, setCutsceneForm] = useState(false)
  const [playerUrl, setPlayerUrl] = useState(null)

  useEffect(() => {
    const base = `http://${window.location.hostname}:3001`
    fetch(`${base}/api/server-info`)
      .then(r => r.json())
      .then(data => {
        setServerInfo(data)
        setPlayerUrl(`http://${data.ip}:${data.port}`)
      })
      .catch(() => setPlayerUrl(`http://${window.location.hostname}:3001`))
  }, [])

  const send = window.__tilestoriesSend
  if (!send) return <div className={styles.section}><div className={styles.emptyHint}>Session controls initializing…</div></div>

  const players = Object.values(session?.players || {})
  const maps = Object.values(campaign?.maps || {})
  const isPaused = session?.status === 'paused'

  return (
    <>
      {/* Connection + URL */}
      <div className={styles.section}>
        <div className={styles.statusRow}>
          <span className={`${styles.dot} ${connected ? styles.dotGreen : styles.dotGray}`} />
          <span className={styles.statusText}>{connected ? 'Server online' : 'Connecting…'}</span>
        </div>
        {playerUrl && (
          <div className={styles.urlBox}>
            <div className={styles.urlLabel}>Players join at:</div>
            <div className={styles.urlValue}>{playerUrl}</div>
            <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(playerUrl)}>Copy</button>
          </div>
        )}
      </div>

      {/* No session */}
      {!session && (
        <div className={styles.section}>
          <button className={styles.primaryBtn}
            onClick={() => campaign && send({ type: 'HOST_SESSION', campaign })}
            disabled={!campaign || !connected}>
            ⚡ Start session
          </button>
        </div>
      )}

      {/* Lobby */}
      {session?.status === 'lobby' && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Lobby — {players.length} player{players.length !== 1 ? 's' : ''}</div>
          {players.map(p => (
            <div key={p.deviceId} className={styles.playerRow}>
              <span className={styles.playerName}>{p.name}</span>
              <span className={styles.playerChar}>{p.character?.name || '—'}</span>
              {p.ready && <span className={styles.readyDot}>✓</span>}
            </div>
          ))}
          <button className={styles.displayBtn}
            onClick={() => window.open('/display.html', 'tilestories-display', 'width=1280,height=720,menubar=no,toolbar=no')}>
            📺 Open Display
          </button>
          <div className={styles.actionRow}>
            <button className={styles.dangerBtn} onClick={() => send({ type: 'END_SESSION' })}>End</button>
            <button className={styles.primaryBtn}
              onClick={() => send({ type: 'START_GAME' })}>▶ Begin</button>
          </div>
        </div>
      )}

      {/* Join screen settings — visible when there's a session (lobby or active) */}
      {session && (
        <JoinScreenSection
          campaign={campaign}
          updateCampaign={updateCampaign}
          playerUrl={playerUrl}
          joinScreenOn={joinScreenOn}
          setJoinScreenOn={setJoinScreenOn}
          send={send}
        />
      )}

      {/* Active / paused */}
      {(session?.status === 'active' || session?.status === 'paused') && (<>

        <div className={styles.section}>
          <div className={styles.statusRow}>
            <span className={`${styles.dot} ${isPaused ? styles.dotAmber : styles.dotGreen}`} />
            <span className={styles.statusText}>{isPaused ? 'Paused' : 'Active'}</span>
            <button className={styles.smallBtn} onClick={() => send({ type: 'PAUSE_GAME' })}>
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button className={styles.dangerBtnSm} onClick={() => send({ type: 'END_SESSION' })}>End</button>
          </div>
        </div>

        {/* Players */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Players ({players.length})</div>
          {players.map(p => {
            const char = campaign?.actors?.[p.characterId] || p.character
            return (
              <div key={p.deviceId} className={styles.playerRow}>
                <span className={styles.playerName}>{p.name}</span>
                <span className={styles.playerChar}>{char?.name || '—'}</span>
                <span className={styles.playerTile}>
                  {char?.currentTile ? `(${char.currentTile.q},${char.currentTile.r})` : '—'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Turn tracker */}
        <TurnTracker />

        {/* Map switcher */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Player map</div>
          <div className={styles.mapBtns}>
            {maps.map(m => (
              <button key={m.id}
                className={`${styles.mapBtn} ${m.id === session.activeMapId ? styles.mapBtnActive : ''}`}
                onClick={() => send({ type: 'CHANGE_MAP', mapId: m.id })}>{m.name}</button>
            ))}
          </div>
        </div>

        {/* Cutscene */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Cutscene / Dialog</div>
          {session.cutscene ? (
            <div className={styles.activeCutscene}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 12 }}>{session.cutscene.title || 'Active cutscene'}</div>
                {session.cutscene.targets !== 'all' && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    → {players.filter(p => session.cutscene.targets?.includes(p.deviceId)).map(p => p.name).join(', ') || 'specific players'}
                  </div>
                )}
              </div>
              <button className={styles.smallBtn} onClick={() => send({ type: 'DISMISS_CUTSCENE' })}>Dismiss</button>
            </div>
          ) : !cutsceneForm ? (
            <button className={styles.addEntryBtn} onClick={() => setCutsceneForm(true)}>+ Show cutscene / dialog</button>
          ) : (
            <CutsceneForm
              players={players}
              campaign={campaign}
              onSend={cs => { send({ type: 'SHOW_CUTSCENE', cutscene: cs }); setCutsceneForm(false) }}
              onCancel={() => setCutsceneForm(false)}
            />
          )}
        </div>

        {/* Display control */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Display screen</div>
          <button className={styles.displayBtn}
            onClick={() => window.open('/display.html', 'tilestories-display', 'width=1280,height=720,menubar=no,toolbar=no')}>
            📺 Open Display
          </button>
          <div className={styles.actionRow}>
            <button className={styles.actionBtn}
              onClick={() => send({ type: 'SHOW_DISPLAY_MAP' })}>
              🗺 Show map
            </button>
            <button
              className={`${styles.actionBtn} ${joinScreenOn ? styles.actionBtnActive : ''}`}
              onClick={() => {
                const next = !joinScreenOn
                setJoinScreenOn(next)
                send({ type: 'SET_JOIN_SCREEN', visible: next })
              }}>
              🔗 Join screen
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>Label size</span>
            <input type="range" min={0.5} max={2} step={0.1}
              value={displayLabelSize}
              onChange={e => setDisplayLabelSize(parseFloat(e.target.value))}
              style={{ width: 72, accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{displayLabelSize.toFixed(1)}×</span>
          </div>
        </div>

        {/* Dice */}
        <DiceSection diceRolls={diceRolls} players={players} campaign={campaign} send={send} />

        {/* Music placeholder */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Music & Sound <span className={styles.soon}>coming soon</span></div>
        </div>
      </>)}
    </>
  )
}

// ── Join screen section ───────────────────────────────────────
function JoinScreenSection({ campaign, updateCampaign, playerUrl, joinScreenOn, setJoinScreenOn, send }) {
  const fileRef = useRef(null)
  const hasBg = !!campaign?.joinScreenBg

  function handleBgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => updateCampaign({ joinScreenBg: ev.target.result })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function toggleJoinScreen() {
    const next = !joinScreenOn
    setJoinScreenOn(next)
    send({ type: 'SET_JOIN_SCREEN', visible: next })
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        🔗 Join Screen
        <button
          className={`${styles.smallBtn} ${joinScreenOn ? styles.smallBtnActive : ''}`}
          style={{ marginLeft: 'auto' }}
          onClick={toggleJoinScreen}
        >
          {joinScreenOn ? 'Showing' : 'Show on display'}
        </button>
      </div>

      {/* QR code + URL preview */}
      {playerUrl && (
        <div className={styles.joinPreviewBlock}>
          <div className={styles.joinPreviewQr}>
            <QRCodeSVG value={playerUrl} size={72} bgColor="transparent" fgColor="var(--text-primary)" level="M" />
          </div>
          <div className={styles.joinPreviewInfo}>
            <div className={styles.joinPreviewUrl}>{playerUrl}</div>
            <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(playerUrl)}>
              Copy link
            </button>
          </div>
        </div>
      )}

      {/* Background image */}
      <div className={styles.sectionLabel} style={{ marginTop: 4 }}>Background image</div>
      {hasBg ? (
        <div className={styles.joinBgRow}>
          <img
            src={campaign.joinScreenBg}
            alt="Join screen background"
            className={styles.joinBgThumb}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className={styles.smallBtn} onClick={() => fileRef.current?.click()}>Replace</button>
            <button className={styles.smallBtn} onClick={() => updateCampaign({ joinScreenBg: null })}>Remove</button>
          </div>
        </div>
      ) : (
        <button className={styles.bgAddBtn} onClick={() => fileRef.current?.click()}>
          + Add background image
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgUpload} />
    </div>
  )
}

// ── Dice section ─────────────────────────────────────────────
function DiceSection({ diceRolls, players, campaign, send }) {
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [showRollForm, setShowRollForm] = useState(false)

  // Player roll request state
  const [selectedPlayers, setSelectedPlayers] = useState(new Set())
  const [requestDiceType, setRequestDiceType] = useState('d20')
  const [threshold, setThreshold] = useState('')
  const [requestDescription, setRequestDescription] = useState('')
  const [requestStatId, setRequestStatId] = useState(null)

  // Organizer roll state
  const [rollDiceType, setRollDiceType] = useState('d20')
  const [rollName, setRollName] = useState('')
  const [rollDescription, setRollDescription] = useState('')
  const [rollThreshold, setRollThreshold] = useState('')
  const [rollStatId, setRollStatId] = useState(null)
  const [rollBonus, setRollBonus] = useState('')

  const system = getCampaignSystem(campaign)
  const rollableStats = (system?.stats || []).filter(s => s.type === 'attribute' || s.type === 'number')

  function togglePlayer(deviceId) {
    setSelectedPlayers(prev => {
      const next = new Set(prev)
      next.has(deviceId) ? next.delete(deviceId) : next.add(deviceId)
      return next
    })
  }

  function toggleAllPlayers() {
    if (selectedPlayers.size === players.length) {
      setSelectedPlayers(new Set())
    } else {
      setSelectedPlayers(new Set(players.map(p => p.deviceId)))
    }
  }

  function handleOrganizerRoll() {
    const value = rollDice(rollDiceType)
    const bonusNum = rollBonus !== '' ? parseInt(rollBonus) : null
    const statDef = rollStatId ? rollableStats.find(s => s.id === rollStatId) : null
    send({
      type: 'DICE_ROLL',
      characterName: rollName.trim() || 'Organizer',
      diceType: rollDiceType,
      value,
      bonus: bonusNum,
      statId: rollStatId || null,
      statLabel: statDef ? (statDef.short || statDef.label) : null,
      description: rollDescription.trim() || null,
      threshold: rollThreshold ? parseInt(rollThreshold) : null,
    })
    setShowRollForm(false)
    setRollName('')
    setRollDescription('')
    setRollThreshold('')
    setRollStatId(null)
    setRollBonus('')
  }

  function handleSendRequest() {
    if (selectedPlayers.size === 0) return
    const statDef = requestStatId ? rollableStats.find(s => s.id === requestStatId) : null
    send({
      type: 'SEND_ROLL_REQUEST',
      deviceIds: [...selectedPlayers],
      diceType: requestDiceType,
      threshold: threshold ? parseInt(threshold) : null,
      description: requestDescription.trim() || null,
      statId: requestStatId || null,
    })
    setShowRequestForm(false)
    setSelectedPlayers(new Set())
    setThreshold('')
    setRequestDescription('')
    setRequestStatId(null)
    setRequestDiceType('d20')
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        🎲 Dice Rolls
        {diceRolls.length > 0 && (
          <button className={styles.smallBtn} style={{ marginLeft: 'auto' }} onClick={() => send({ type: 'CLEAR_DICE_LOG' })}>
            Clear
          </button>
        )}
      </div>

      {diceRolls.length === 0 && (
        <div className={styles.emptyHint}>No rolls yet</div>
      )}

      {diceRolls.slice(0, 10).map((roll, i) => {
        const displayVal = roll.total ?? roll.value
        const isSuccess = roll.success === true
        const isFail = roll.success === false
        return (
          <div key={roll.id || i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 8px',
            borderRadius: 6,
            background: i === 0 ? 'var(--bg-raised)' : 'transparent',
            borderLeft: `3px solid ${isSuccess ? '#7bc47f' : isFail ? '#c25a4a' : 'var(--border)'}`,
            opacity: i === 0 ? 1 : Math.max(0.5, 1 - i * 0.08),
            fontSize: 12,
          }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: isSuccess ? '#7bc47f' : isFail ? '#c25a4a' : 'var(--text-primary)', minWidth: 22, textAlign: 'center' }}>
              {displayVal}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {roll.characterName}
                {roll.rolledBy === 'organizer' && (
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4 }}>DM</span>
                )}
              </div>
              {roll.description && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {roll.description}
                </div>
              )}
              {roll.bonus != null && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {roll.value} + {roll.statLabel || 'bonus'} ({roll.bonus >= 0 ? '+' : ''}{roll.bonus})
                </div>
              )}
              {roll.threshold != null && (
                <div style={{ fontSize: 10, color: isSuccess ? '#7bc47f' : isFail ? '#c25a4a' : 'var(--text-muted)' }}>
                  DC {roll.threshold} · {isSuccess ? '✓ pass' : '✗ fail'}
                </div>
              )}
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
              {roll.diceType?.toUpperCase()}
            </span>
          </div>
        )
      })}

      {/* Both forms closed — show action buttons */}
      {!showRollForm && !showRequestForm && (
        <>
          <button className={styles.addEntryBtn} onClick={() => setShowRollForm(true)}>
            🎲 Roll dice
          </button>
          <button className={styles.addEntryBtn} style={{ marginTop: 4 }} onClick={() => setShowRequestForm(true)}>
            + Send roll request to players
          </button>
        </>
      )}

      {/* Organizer roll form */}
      {showRollForm && (
        <div className={styles.cutsceneFormFull}>
          <div className={styles.sectionLabel}>Die</div>
          <div className={styles.csTypeRow}>
            {Object.keys(DICE_TYPES).map(die => (
              <button
                key={die}
                className={`${styles.csTypeBtn} ${rollDiceType === die ? styles.csTypeBtnActive : ''}`}
                onClick={() => setRollDiceType(die)}
              >
                {die.toUpperCase()}
              </button>
            ))}
          </div>

          <div className={styles.sectionLabel} style={{ marginTop: 4 }}>Name</div>
          <input
            type="text"
            placeholder="e.g. Goblin Chief, Environment…"
            value={rollName}
            onChange={e => setRollName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleOrganizerRoll()}
            autoFocus
          />

          <div className={styles.sectionLabel} style={{ marginTop: 4 }}>Description — optional</div>
          <input
            type="text"
            placeholder="e.g. Attack roll, Perception…"
            value={rollDescription}
            onChange={e => setRollDescription(e.target.value)}
          />

          {rollableStats.length > 0 && (<>
            <div className={styles.sectionLabel} style={{ marginTop: 4 }}>Stat — optional</div>
            <div className={styles.csTypeRow} style={{ flexWrap: 'wrap', gap: 3 }}>
              {rollableStats.map(stat => (
                <button
                  key={stat.id}
                  className={`${styles.csTypeBtn} ${rollStatId === stat.id ? styles.csTypeBtnActive : ''}`}
                  style={{ flex: 'none', padding: '4px 7px' }}
                  onClick={() => { setRollStatId(prev => prev === stat.id ? null : stat.id); setRollBonus('') }}
                >
                  {stat.short || stat.label}
                </button>
              ))}
            </div>
            {rollStatId && (
              <input
                type="number"
                placeholder="Bonus (e.g. +3, -1)"
                value={rollBonus}
                onChange={e => setRollBonus(e.target.value)}
              />
            )}
          </>)}

          <div className={styles.sectionLabel} style={{ marginTop: 4 }}>DC — optional</div>
          <input
            type="number"
            min={1} max={30}
            placeholder="e.g. 15"
            value={rollThreshold}
            onChange={e => setRollThreshold(e.target.value)}
          />

          <div className={styles.actionRow}>
            <button className={styles.cancelBtn} onClick={() => {
              setShowRollForm(false)
              setRollDiceType('d20')
              setRollName('')
              setRollDescription('')
              setRollThreshold('')
              setRollStatId(null)
              setRollBonus('')
            }}>Cancel</button>
            <button className={styles.primaryBtn} onClick={handleOrganizerRoll} style={{ flex: 1 }}>
              🎲 Roll {rollDiceType.toUpperCase()}
            </button>
          </div>
        </div>
      )}

      {/* Player roll request form */}
      {showRequestForm && (
        <div className={styles.cutsceneFormFull}>
          <div className={styles.sectionLabel}>Die</div>
          <div className={styles.csTypeRow}>
            {Object.keys(DICE_TYPES).map(die => (
              <button
                key={die}
                className={`${styles.csTypeBtn} ${requestDiceType === die ? styles.csTypeBtnActive : ''}`}
                onClick={() => setRequestDiceType(die)}
              >
                {die.toUpperCase()}
              </button>
            ))}
          </div>

          <div className={styles.sectionLabel} style={{ marginTop: 4 }}>Description — optional</div>
          <input
            type="text"
            placeholder="e.g. Stealth check…"
            value={requestDescription}
            onChange={e => setRequestDescription(e.target.value)}
          />

          {rollableStats.length > 0 && (<>
            <div className={styles.sectionLabel} style={{ marginTop: 4 }}>Stat Bonus — optional</div>
            <div className={styles.csTypeRow} style={{ flexWrap: 'wrap', gap: 3 }}>
              {rollableStats.map(stat => (
                <button
                  key={stat.id}
                  className={`${styles.csTypeBtn} ${requestStatId === stat.id ? styles.csTypeBtnActive : ''}`}
                  style={{ flex: 'none', padding: '4px 7px' }}
                  onClick={() => setRequestStatId(prev => prev === stat.id ? null : stat.id)}
                >
                  {stat.short || stat.label}
                </button>
              ))}
            </div>
          </>)}

          <div className={styles.sectionLabel} style={{ marginTop: 4 }}>DC — optional</div>
          <input
            type="number"
            min={1} max={30}
            placeholder="e.g. 15"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
          />

          <div className={styles.sectionLabel} style={{ marginTop: 4 }}>Send to</div>
          {players.length === 0
            ? <div className={styles.emptyHint}>No players connected</div>
            : (<>
              <div className={styles.csPlayerPills}>
                {players.map(p => {
                  const charName = (campaign?.actors?.[p.characterId] || p.character)?.name
                  const active = selectedPlayers.has(p.deviceId)
                  return (
                    <button
                      key={p.deviceId}
                      className={`${styles.csPlayerPill} ${active ? styles.csPlayerPillActive : ''}`}
                      onClick={() => togglePlayer(p.deviceId)}
                    >
                      <span className={styles.csPlayerPillName}>{p.name}</span>
                      {charName && <span className={styles.csPlayerPillChar}>{charName}</span>}
                    </button>
                  )
                })}
              </div>
              {players.length > 1 && (
                <button className={styles.csSelectAllBtn} onClick={toggleAllPlayers}>
                  {selectedPlayers.size === players.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </>)
          }

          <div className={styles.actionRow}>
            <button className={styles.cancelBtn} onClick={() => {
              setShowRequestForm(false)
              setSelectedPlayers(new Set())
              setRequestStatId(null)
              setRequestDiceType('d20')
            }}>Cancel</button>
            <button className={styles.primaryBtn} onClick={handleSendRequest} disabled={selectedPlayers.size === 0} style={{ flex: 1 }}>
              🎲 Send to {selectedPlayers.size || 0} player{selectedPlayers.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cutscene / Dialog form ────────────────────────────────────
function CutsceneForm({ players, campaign, onSend, onCancel }) {
  const [title, setTitle]       = useState('')
  const [content, setContent]   = useState('')
  const [type, setType]         = useState('text')
  const [imageUrl, setImageUrl] = useState('')
  const [targets, setTargets]   = useState('all')  // 'all' | Set of deviceIds
  const [selectedPlayers, setSelectedPlayers] = useState(new Set())

  // Rewards
  const [giveItems, setGiveItems]       = useState(false)
  const [giveCurrency, setGiveCurrency] = useState(false)
  const [currency, setCurrency]         = useState(0)
  const [rewardItems, setRewardItems]   = useState([])  // [{ templateId, quantity }]

  const allItems = Object.values(campaign?.items || {})

  function togglePlayer(deviceId) {
    setSelectedPlayers(prev => {
      const next = new Set(prev)
      next.has(deviceId) ? next.delete(deviceId) : next.add(deviceId)
      return next
    })
  }

  function addRewardItem() {
    setRewardItems(r => [...r, { templateId: '', quantity: 1 }])
  }
  function updateRewardItem(i, patch) {
    setRewardItems(r => r.map((item, idx) => idx === i ? { ...item, ...patch } : item))
  }
  function removeRewardItem(i) {
    setRewardItems(r => r.filter((_, idx) => idx !== i))
  }

  function handleSend() {
    const rewards = {}
    if (giveCurrency && currency !== 0) rewards.currency = currency
    if (giveItems) {
      const validItems = rewardItems.filter(r => r.templateId && r.quantity > 0)
      if (validItems.length) rewards.items = validItems
    }
    onSend({
      title,
      content,
      type,
      imageUrl: type !== 'text' ? imageUrl : '',
      targets: targets === 'all' ? 'all' : [...selectedPlayers],
      rewards: Object.keys(rewards).length ? rewards : null,
    })
  }

  const hasContent = title.trim() || content.trim()

  return (
    <div className={styles.cutsceneFormFull}>
      {/* Title */}
      <input placeholder="Title (optional)…" value={title}
        onChange={e => setTitle(e.target.value)} />

      {/* Content */}
      <textarea rows={3} placeholder="Narration / dialog…" value={content}
        onChange={e => setContent(e.target.value)} style={{ resize: 'vertical' }} />

      {/* Type */}
      <div className={styles.csTypeRow}>
        {['text','image','both'].map(t => (
          <button key={t}
            className={`${styles.csTypeBtn} ${type === t ? styles.csTypeBtnActive : ''}`}
            onClick={() => setType(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {type !== 'text' && (
        <input placeholder="Image URL…" value={imageUrl}
          onChange={e => setImageUrl(e.target.value)} />
      )}

      {/* Target */}
      <div className={styles.sectionLabel} style={{ marginTop: 4 }}>Send to</div>
      <div className={styles.csTargetRow}>
        <button
          className={`${styles.csTypeBtn} ${targets === 'all' ? styles.csTypeBtnActive : ''}`}
          onClick={() => setTargets('all')}>
          Everyone
        </button>
        <button
          className={`${styles.csTypeBtn} ${targets === 'select' ? styles.csTypeBtnActive : ''}`}
          onClick={() => setTargets('select')}>
          Specific players
        </button>
      </div>

      {targets === 'select' && (
        <div className={styles.csPlayerList}>
          {players.length === 0
            ? <div className={styles.emptyHint}>No players connected</div>
            : players.map(p => (
              <label key={p.deviceId} className={styles.csPlayerCheck}>
                <input type="checkbox"
                  checked={selectedPlayers.has(p.deviceId)}
                  onChange={() => togglePlayer(p.deviceId)} />
                <span className={styles.csPlayerName}>{p.name}</span>
                {p.character?.name && <span className={styles.csPlayerChar}>{p.character.name}</span>}
              </label>
            ))
          }
        </div>
      )}

      {/* Rewards */}
      <div className={styles.sectionLabel} style={{ marginTop: 4 }}>Rewards (optional)</div>

      <label className={styles.csRewardCheck}>
        <input type="checkbox" checked={giveCurrency} onChange={e => setGiveCurrency(e.target.checked)} />
        Give currency ($)
      </label>
      {giveCurrency && (
        <div className={styles.csCurrencyRow}>
          <span className={styles.csCurrencySign}>$</span>
          <input type="number" value={currency}
            onChange={e => setCurrency(parseFloat(e.target.value) || 0)}
            placeholder="0" style={{ flex: 1 }} />
          <span className={styles.csHint}>{currency < 0 ? 'deducted' : 'given'} per player</span>
        </div>
      )}

      <label className={styles.csRewardCheck}>
        <input type="checkbox" checked={giveItems} onChange={e => setGiveItems(e.target.checked)} />
        Give items
      </label>
      {giveItems && (
        <div className={styles.csItemList}>
          {rewardItems.map((ri, i) => (
            <div key={i} className={styles.csItemRow}>
              <select value={ri.templateId}
                onChange={e => updateRewardItem(i, { templateId: e.target.value })}
                style={{ flex: 1 }}>
                <option value="">— select item —</option>
                {allItems.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
              <input type="number" min={1} value={ri.quantity}
                onChange={e => updateRewardItem(i, { quantity: parseInt(e.target.value) || 1 })}
                style={{ width: 44, textAlign: 'center' }} />
              <button className={styles.removeInline}
                onClick={() => removeRewardItem(i)}>×</button>
            </div>
          ))}
          {allItems.length > 0
            ? <button className={styles.addSmallBtn} onClick={addRewardItem}>+ Add item</button>
            : <div className={styles.emptyHint}>No items in library yet</div>
          }
        </div>
      )}

      <div className={styles.actionRow} style={{ marginTop: 6 }}>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        <button className={styles.primaryBtn}
          onClick={handleSend}
          disabled={!hasContent && targets === 'all' && !giveCurrency && !giveItems}
          style={{ flex: 1 }}>
          {giveCurrency || giveItems ? '⚡ Send & give rewards' : '⚡ Show to players'}
        </button>
      </div>
    </div>
  )
}