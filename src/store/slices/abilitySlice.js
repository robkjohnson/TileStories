/**
 * Ability slice — ability template library and actor ability instances.
 */
import { makeAbilityTemplate, makeAbilityInstance } from '../../models/ability.js'

export const createAbilitySlice = (set, get) => ({

  // ── Ability template library ──────────────────────────────────
  addAbilityTemplate(data = {}) {
    const tmpl = makeAbilityTemplate(data)
    set(s => ({
      campaign: {
        ...s.campaign,
        abilities: { ...s.campaign.abilities, [tmpl.id]: tmpl },
        updatedAt: new Date().toISOString(),
      },
    }))
    return tmpl.id
  },

  updateAbilityTemplate(id, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        abilities: { ...s.campaign.abilities, [id]: { ...s.campaign.abilities[id], ...partial } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  deleteAbilityTemplate(id) {
    const { campaign } = get()
    if (!campaign) return
    const abilities = { ...campaign.abilities }
    delete abilities[id]

    // Remove instances from all actor ability lists
    const actors = Object.fromEntries(
      Object.entries(campaign.actors || {}).map(([aid, a]) => [
        aid, { ...a, abilities: (a.abilities || []).filter(ab => ab.templateId !== id) },
      ])
    )

    set(s => ({
      campaign: { ...s.campaign, abilities, actors, updatedAt: new Date().toISOString() },
    }))
  },

  // ── Actor ability instances ───────────────────────────────────
  assignAbility(actorId, templateId) {
    const { campaign } = get()
    const actor = campaign?.actors?.[actorId]
    if (!actor) return
    if ((actor.abilities || []).find(a => a.templateId === templateId)) return // no duplicates
    const tmpl = campaign.abilities?.[templateId]
    const instance = makeAbilityInstance(templateId, {
      usesRemaining: tmpl?.usesPerRest ?? null,
    })
    set(s => ({
      campaign: {
        ...s.campaign,
        actors: {
          ...s.campaign.actors,
          [actorId]: { ...actor, abilities: [...(actor.abilities || []), instance] },
        },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  removeAbility(actorId, templateId) {
    const { campaign } = get()
    const actor = campaign?.actors?.[actorId]
    if (!actor) return
    set(s => ({
      campaign: {
        ...s.campaign,
        actors: {
          ...s.campaign.actors,
          [actorId]: { ...actor, abilities: (actor.abilities || []).filter(a => a.templateId !== templateId) },
        },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  updateAbilityInstance(actorId, templateId, partial) {
    const { campaign } = get()
    const actor = campaign?.actors?.[actorId]
    if (!actor) return
    set(s => ({
      campaign: {
        ...s.campaign,
        actors: {
          ...s.campaign.actors,
          [actorId]: {
            ...actor,
            abilities: (actor.abilities || []).map(a =>
              a.templateId === templateId ? { ...a, ...partial } : a
            ),
          },
        },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  // ── Backward-compat aliases ───────────────────────────────────
  // Old API passed entityType ('characters'|'creatures') + entityId.
  // New API just takes actorId.
  assignAbilityToEntity(entityType, entityId, templateId) {
    get().assignAbility(entityId, templateId)
  },
  removeAbilityFromEntity(entityType, entityId, templateId) {
    get().removeAbility(entityId, templateId)
  },
  updateAbilityInstanceOnEntity(entityType, entityId, templateId, partial) {
    get().updateAbilityInstance(entityId, templateId, partial)
  },
})
