/**
 * Game system registry.
 *
 * To add a new system:
 *   1. Create src/systems/mysystem.js following the same shape.
 *   2. Import it here and add it to SYSTEMS.
 *   3. It will appear in the campaign creation UI automatically.
 */
import { DND5E }   from './dnd5e.js'
import { GENERIC } from './generic.js'

export { DND5E, GENERIC }

// All built-in systems, ordered as they appear in the UI.
export const SYSTEMS = [DND5E, GENERIC]

/**
 * Look up a system by ID. Falls back to DND5E if the ID is unknown
 * so existing campaigns never break when a system is removed.
 */
export function getSystem(id) {
  return SYSTEMS.find(s => s.id === id) ?? DND5E
}

/**
 * Like getSystem, but for the Generic system merges any per-campaign
 * customActorTypes / customDamageTypes overrides set by the organizer.
 * All other systems are returned as-is.
 */
export function getCampaignSystem(campaign) {
  const base = getSystem(campaign?.gameSystemId)
  if (base.id !== 'generic') return base
  const actorTypes  = campaign?.customActorTypes  ?? base.actorTypes
  const damageTypes = campaign?.customDamageTypes ?? base.damageTypes
  if (actorTypes === base.actorTypes && damageTypes === base.damageTypes) return base
  return { ...base, actorTypes, damageTypes }
}

/**
 * Build a default stats object for an actor based on the given system.
 * Every stat defined in gameSystem.stats gets its `default` value.
 * Falls back to D&D 5e if the system is unresolvable.
 */
export function defaultStatsForSystem(gameSystem) {
  const sys = !gameSystem
    ? DND5E
    : typeof gameSystem === 'string'
      ? getSystem(gameSystem)
      : gameSystem
  return Object.fromEntries((sys.stats || []).map(s => [s.id, s.default ?? 0]))
}

/**
 * Build a default currency object for an actor based on the given system.
 * Every currency starts at 0.
 * Falls back to D&D 5e if the system is unresolvable.
 */
export function defaultCurrencyForSystem(gameSystem) {
  const sys = !gameSystem
    ? DND5E
    : typeof gameSystem === 'string'
      ? getSystem(gameSystem)
      : gameSystem
  return Object.fromEntries((sys.currencies || []).map(c => [c.id, 0]))
}
