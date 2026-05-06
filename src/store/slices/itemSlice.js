/**
 * Item slice — item template library, actor inventories, and containers.
 */
import { makeItemTemplate, makeItemInstance, makeContainer } from '../../models/item.js'

export const createItemSlice = (set, get) => ({

  // ── Item template library ─────────────────────────────────────
  addItemTemplate(data = {}) {
    const tmpl = makeItemTemplate(data)
    set(s => ({
      campaign: {
        ...s.campaign,
        items: { ...s.campaign.items, [tmpl.id]: tmpl },
        updatedAt: new Date().toISOString(),
      },
    }))
    return tmpl.id
  },

  updateItemTemplate(id, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        items: { ...s.campaign.items, [id]: { ...s.campaign.items[id], ...partial } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  deleteItemTemplate(id) {
    const { campaign } = get()
    if (!campaign) return
    const items = { ...campaign.items }
    delete items[id]

    // Remove all instances from actor inventories
    const actors = Object.fromEntries(
      Object.entries(campaign.actors || {}).map(([aid, a]) => [
        aid, { ...a, inventory: (a.inventory || []).filter(i => i.templateId !== id) },
      ])
    )

    // Remove from containers
    const containers = Object.fromEntries(
      Object.entries(campaign.containers || {}).map(([cid, c]) => [
        cid, { ...c, items: (c.items || []).filter(i => i.templateId !== id) },
      ])
    )

    set(s => ({
      campaign: { ...s.campaign, items, actors, containers, updatedAt: new Date().toISOString() },
    }))
  },

  // ── Actor inventory ───────────────────────────────────────────
  giveItem(actorId, templateId, quantity = 1) {
    const { campaign } = get()
    const actor = campaign?.actors?.[actorId]
    if (!actor) return
    const existing = (actor.inventory || []).find(i => i.templateId === templateId)
    const inventory = existing
      ? actor.inventory.map(i => i.templateId === templateId ? { ...i, quantity: i.quantity + quantity } : i)
      : [...(actor.inventory || []), makeItemInstance(templateId, { quantity })]
    set(s => ({
      campaign: {
        ...s.campaign,
        actors: { ...s.campaign.actors, [actorId]: { ...actor, inventory } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  removeItemFromActor(actorId, instanceId, quantity = null) {
    const { campaign } = get()
    const actor = campaign?.actors?.[actorId]
    if (!actor) return
    let inventory
    if (quantity === null) {
      inventory = (actor.inventory || []).filter(i => i.id !== instanceId)
    } else {
      inventory = (actor.inventory || [])
        .map(i => i.id === instanceId ? { ...i, quantity: Math.max(0, i.quantity - quantity) } : i)
        .filter(i => i.quantity > 0)
    }
    set(s => ({
      campaign: {
        ...s.campaign,
        actors: { ...s.campaign.actors, [actorId]: { ...actor, inventory } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  updateItemInstance(actorId, instanceId, partial) {
    const { campaign } = get()
    const actor = campaign?.actors?.[actorId]
    if (!actor) return
    const inventory = (actor.inventory || []).map(i => i.id === instanceId ? { ...i, ...partial } : i)
    set(s => ({
      campaign: {
        ...s.campaign,
        actors: { ...s.campaign.actors, [actorId]: { ...actor, inventory } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  // ── Containers ────────────────────────────────────────────────
  addContainer(data = {}) {
    const c = makeContainer(data)
    set(s => ({
      campaign: {
        ...s.campaign,
        containers: { ...s.campaign.containers, [c.id]: c },
        updatedAt: new Date().toISOString(),
      },
    }))
    return c.id
  },

  updateContainer(id, partial) {
    set(s => ({
      campaign: {
        ...s.campaign,
        containers: { ...s.campaign.containers, [id]: { ...s.campaign.containers[id], ...partial } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  deleteContainer(id) {
    const containers = { ...get().campaign?.containers }
    delete containers[id]
    set(s => ({ campaign: { ...s.campaign, containers, updatedAt: new Date().toISOString() } }))
  },

  addItemToContainer(containerId, templateId, quantity = 1) {
    const { campaign } = get()
    const container = campaign?.containers?.[containerId]
    if (!container) return
    const existing = container.items.find(i => i.templateId === templateId)
    const items = existing
      ? container.items.map(i => i.templateId === templateId ? { ...i, quantity: i.quantity + quantity } : i)
      : [...container.items, makeItemInstance(templateId, { quantity })]
    set(s => ({
      campaign: {
        ...s.campaign,
        containers: { ...s.campaign.containers, [containerId]: { ...container, items } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  removeItemFromContainer(containerId, instanceId, quantity = null) {
    const { campaign } = get()
    const container = campaign?.containers?.[containerId]
    if (!container) return
    let items
    if (quantity === null) {
      items = container.items.filter(i => i.id !== instanceId)
    } else {
      items = container.items
        .map(i => i.id === instanceId ? { ...i, quantity: Math.max(0, i.quantity - quantity) } : i)
        .filter(i => i.quantity > 0)
    }
    set(s => ({
      campaign: {
        ...s.campaign,
        containers: { ...s.campaign.containers, [containerId]: { ...container, items } },
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  transferFromContainer(containerId, instanceId, actorId, quantity = null) {
    const { campaign } = get()
    const container = campaign?.containers?.[containerId]
    const instance = container?.items?.find(i => i.id === instanceId)
    if (!instance) return
    const qty = quantity ?? instance.quantity
    get().giveItem(actorId, instance.templateId, qty)
    get().removeItemFromContainer(containerId, instanceId, qty)
  },

  transferToContainer(actorId, instanceId, containerId, quantity = null) {
    const { campaign } = get()
    const actor = campaign?.actors?.[actorId]
    const instance = actor?.inventory?.find(i => i.id === instanceId)
    if (!instance) return
    const qty = quantity ?? instance.quantity
    get().addItemToContainer(containerId, instance.templateId, qty)
    get().removeItemFromActor(actorId, instanceId, qty)
  },

  // ── Backward-compat aliases ───────────────────────────────────
  // Old API passed an entityType string ('characters'|'creatures').
  // New API just takes an actorId.
  removeItemFromEntity(entityType, entityId, instanceId, quantity = null) {
    get().removeItemFromActor(entityId, instanceId, quantity)
  },
  updateItemInstanceOnEntity(entityType, entityId, instanceId, partial) {
    get().updateItemInstance(entityId, instanceId, partial)
  },
  giveItemToEntity(entityType, entityId, templateId, quantity = 1) {
    get().giveItem(entityId, templateId, quantity)
  },
  transferFromContainerToEntity(containerId, instanceId, entityType, entityId, quantity = null) {
    get().transferFromContainer(containerId, instanceId, entityId, quantity)
  },
  transferToContainerFromEntity(entityType, entityId, instanceId, containerId, quantity = null) {
    get().transferToContainer(entityId, instanceId, containerId, quantity)
  },
})
