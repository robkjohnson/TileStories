import React, { useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { tokenDisplay } from '../CharacterSheet/CharacterSheet'
import styles from './EffectExecutor.module.css'

const TARGET_LABELS = {
  single_tile: 'Click one tile on the map to target it.',
  tile_aoe:    'Click the origin tile on the map — the AoE pattern will radiate from it.',
  tile_select: count => `Click up to ${count} tile${count > 1 ? 's' : ''} on the map, then Execute.`,
  char_select: count => `Select up to ${count} character${count > 1 ? 's' : ''} below, then Execute.`,
}

export default function EffectExecutor() {
  const {
    campaign, effectMode, cancelEffectMode, executeEffect,
    toggleEffectChar, lastEffectResults, clearEffectResults, rotateEffectAoe,
  } = useStore()

  // Auto-dismiss results after 6s
  useEffect(() => {
    if (!lastEffectResults) return
    const t = setTimeout(clearEffectResults, 6000)
    return () => clearTimeout(t)
  }, [lastEffectResults, clearEffectResults])

  // Results toast (shown independently of effectMode)
  if (lastEffectResults && !effectMode) {
    return (
      <div className={styles.resultsBar}>
        <span className={styles.resultsTitle}>Effect applied</span>
        <div className={styles.resultsList}>
          {lastEffectResults.map(r => {
            let detail
            if (r.immune) {
              detail = <span style={{ color: '#7bc47f', fontSize: 10 }}>🛡 Immune{r.damageType ? ` (${r.damageType})` : ''}</span>
            } else if (r.saved && r.damage === 0) {
              detail = <span style={{ color: '#5b9bd5', fontSize: 10 }}>✓ Saved ({r.saveResult?.total} vs DC {r.saveResult?.dc})</span>
            } else {
              const parts = [`−${r.damage} → ${r.newHp} HP`]
              if (r.saveResult?.succeeded) parts.push('½ save')
              if (r.damageType && r.damageType !== 'none') parts.push(r.damageType)
              detail = <span className={styles.resultDmg}>{parts.join(' · ')}</span>
            }
            return (
              <span key={r.actorId} className={styles.resultItem}>
                <span className={styles.resultName}>{r.name}</span>
                {detail}
              </span>
            )
          })}
        </div>
        <button className={styles.resultsDismiss} onClick={clearEffectResults}>Dismiss</button>
      </div>
    )
  }

  if (!effectMode) return null

  const effect = campaign?.effects?.[effectMode.effectId]
  if (!effect) return null

  const { selectedTiles, selectedChars } = effectMode
  const count = effect.targetCount || 1

  const instruction = effect.targetType === 'tile_select'
    ? TARGET_LABELS.tile_select(count)
    : effect.targetType === 'char_select'
    ? TARGET_LABELS.char_select(count)
    : TARGET_LABELS[effect.targetType] || ''

  const canExecute =
    (effect.targetType === 'char_select' && selectedChars.length > 0) ||
    (effect.targetType !== 'char_select' && selectedTiles.length > 0)

  const allChars = Object.values(campaign?.actors || {})
    .filter(c => !c.hidden)
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className={styles.bar}>
      <div className={styles.header}>
        <span className={styles.effectIcon}>⚡</span>
        <div className={styles.effectInfo}>
          <span className={styles.effectName}>{effect.name}</span>
          <span className={styles.effectType}>
            {effect.targetType === 'tile_aoe' && effect.aoePattern?.length > 0
              ? `AoE — ${effect.aoePattern.length + 1} tiles`
              : effect.targetType === 'tile_select' || effect.targetType === 'char_select'
              ? `Select up to ${count}`
              : null}
          </span>
        </div>
        <button className={styles.cancelBtn} onClick={cancelEffectMode}>✕ Cancel</button>
      </div>

      <div className={styles.instruction}>{instruction}</div>

      {/* AoE rotation controls */}
      {effect.targetType === 'tile_aoe' && (
        <div className={styles.rotationRow}>
          <span className={styles.rotationLabel}>Rotation</span>
          <button className={styles.rotateBtn} onClick={() => rotateEffectAoe('ccw')} title="Rotate counter-clockwise">↺</button>
          <span className={styles.rotationSteps}>{((effectMode.aoeRotation ?? 0) % 8 + 8) % 8 * 45}°</span>
          <button className={styles.rotateBtn} onClick={() => rotateEffectAoe('cw')} title="Rotate clockwise">↻</button>
        </div>
      )}

      {/* Character picker for char_select */}
      {effect.targetType === 'char_select' && (
        <div className={styles.charPicker}>
          {allChars.map(char => {
            const isSelected = selectedChars.includes(char.id)
            const atLimit = selectedChars.length >= count && !isSelected
            return (
              <button
                key={char.id}
                className={`${styles.charChip} ${isSelected ? styles.charChipSelected : ''}`}
                onClick={() => !atLimit && toggleEffectChar(char.id)}
                disabled={atLimit}
                title={char.name}
              >
                <span className={styles.charChipEmoji}>{tokenDisplay(char)}</span>
                <span className={styles.charChipName}>{char.name}</span>
                {char.stats?.hp !== undefined && (
                  <span className={styles.charChipHp}>{char.stats.hp}hp</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Selection summary */}
      {(selectedTiles.length > 0 || selectedChars.length > 0) && (
        <div className={styles.selectionSummary}>
          {selectedTiles.length > 0 && (
            <span>{selectedTiles.length} tile{selectedTiles.length > 1 ? 's' : ''} selected</span>
          )}
          {selectedChars.length > 0 && (
            <span>
              {selectedChars.map(id => campaign?.actors?.[id]?.name || id).join(', ')}
            </span>
          )}
        </div>
      )}

      <button
        className={styles.executeBtn}
        onClick={executeEffect}
        disabled={!canExecute}
      >
        Execute Effect →
      </button>
    </div>
  )
}
