import React, { useState } from 'react'
import { useStore, ABILITY_CATEGORIES } from '../../store/useStore'
import { AbilityCard } from './AbilityLibrary'
import { formatDamage } from '../../utils/dice'
import styles from './AbilityAssigner.module.css'

// entityType: 'creatures' | 'characters'
export default function AbilityAssigner({ entityType, entityId }) {
  const { campaign, assignAbility, removeAbility, updateAbilityInstance } = useStore()
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')

  const entity = campaign?.[entityType]?.[entityId]
  const allTemplates = campaign?.abilities || {}
  const instances = entity?.abilities || []

  // Templates already assigned
  const assignedIds = new Set(instances.map(i => i.templateId))

  // Available templates (not yet assigned)
  const available = Object.values(allTemplates).filter(t =>
    !assignedIds.has(t.id) &&
    (search === '' || t.name.toLowerCase().includes(search.toLowerCase()) ||
     t.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase())))
  )

  function handleUse(templateId) {
    const instance = instances.find(i => i.templateId === templateId)
    const tmpl = allTemplates[templateId]
    if (!tmpl?.usesPerRest) return // unlimited, nothing to track
    const current = instance?.usesRemaining ?? tmpl.usesPerRest
    if (current <= 0) return
    updateAbilityInstance(entityType, entityId, templateId, { usesRemaining: current - 1 })
  }

  function handleRestore(templateId) {
    const tmpl = allTemplates[templateId]
    updateAbilityInstance(entityType, entityId, templateId, {
      usesRemaining: tmpl?.usesPerRest ?? null
    })
  }

  return (
    <div className={styles.root}>
      {/* Assigned abilities */}
      {instances.length === 0
        ? <div className={styles.empty}>No abilities assigned</div>
        : instances.map(instance => {
            const tmpl = allTemplates[instance.templateId]
            if (!tmpl) return null
            const cat = ABILITY_CATEGORIES[tmpl.category] || ABILITY_CATEGORIES.attack
            const usesRemaining = instance.usesRemaining ?? tmpl.usesPerRest
            const depleted = tmpl.usesPerRest && usesRemaining <= 0

            return (
              <div key={instance.templateId} className={`${styles.instanceRow} ${depleted ? styles.depleted : ''}`}>
                <AbilityCard
                  template={tmpl}
                  instance={instance}
                  onUse={tmpl.usesPerRest ? () => handleUse(instance.templateId) : undefined}
                />
                <div className={styles.instanceActions}>
                  {tmpl.usesPerRest && depleted && (
                    <button className={styles.restoreBtn} onClick={() => handleRestore(instance.templateId)}>
                      ↺ Restore
                    </button>
                  )}
                  <button className={styles.removeBtn}
                    onClick={() => removeAbility(entityType, entityId, instance.templateId)}
                    title="Remove ability">×</button>
                </div>
              </div>
            )
          })
      }

      {/* Add from library */}
      {!showPicker ? (
        <button className={styles.addBtn} onClick={() => setShowPicker(true)}>
          + Assign ability from library
        </button>
      ) : (
        <div className={styles.picker}>
          <div className={styles.pickerHeader}>
            <input className={styles.pickerSearch} type="text" autoFocus
              placeholder="Search ability library…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <button className={styles.pickerClose} onClick={() => { setShowPicker(false); setSearch('') }}>×</button>
          </div>

          {available.length === 0 ? (
            <div className={styles.pickerEmpty}>
              {Object.keys(allTemplates).length === 0
                ? 'No abilities in library yet — create some in the Campaign panel'
                : 'All abilities already assigned'
              }
            </div>
          ) : (
            <div className={styles.pickerList}>
              {available.map(tmpl => {
                const cat = ABILITY_CATEGORIES[tmpl.category] || ABILITY_CATEGORIES.attack
                const dmg = formatDamage(tmpl.damageDice, tmpl.damageType, tmpl.damageBonus)
                return (
                  <button key={tmpl.id} className={styles.pickerItem}
                    onClick={() => { assignAbility(entityType, entityId, tmpl.id); setSearch('') }}>
                    <span className={styles.pickerIcon}>{cat.icon}</span>
                    <div className={styles.pickerInfo}>
                      <span className={styles.pickerName}>{tmpl.name}</span>
                      <span className={styles.pickerMeta} style={{ color: cat.color }}>
                        {cat.label}{dmg ? ` · ${dmg}` : ''}
                        {tmpl.usesPerRest ? ` · ${tmpl.usesPerRest}/${tmpl.restType} rest` : ' · Unlimited'}
                      </span>
                    </div>
                    <span className={styles.pickerAssign}>Assign</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}