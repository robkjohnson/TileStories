// Shared logic for determining what a viewer can see

// Can this viewer see a specific event?
export function canSeeEvent(event, viewerMode, viewerTraits = []) {
  // Organizer always sees everything
  if (viewerMode === 'organizer') return true

  // Player view — check event visibility setting
  if (event.visibility === 'none') return false
  if (event.visibility === 'all') return true
  if (event.visibility === 'traits') {
    const required = event.requiredTraits || []
    if (required.length === 0) return true  // no traits specified = everyone
    return required.some(t => viewerTraits.includes(t))
  }
  return true
}

// Filter an array of events to only those the viewer can see
export function visibleEvents(events = [], viewerMode, viewerTraits = []) {
  return events.filter(e => canSeeEvent(e, viewerMode, viewerTraits))
}

// Should the event dot show on a tile?
export function shouldShowEventDot(tile, viewerMode, viewerTraits = []) {
  const events = tile?.events || []
  return visibleEvents(events, viewerMode, viewerTraits).length > 0
}

// Should the fired event overlay show on a tile?
export function shouldShowOverlay(overlay, viewerMode, viewerTraits = []) {
  if (!overlay) return false
  if (viewerMode === 'organizer') return true
  // Overlays inherit the visibility of the event that fired them
  // For now overlays from 'none' events are hidden from players
  if (overlay.visibility === 'none') return false
  if (overlay.visibility === 'traits') {
    const required = overlay.requiredTraits || []
    if (required.length === 0) return true
    return required.some(t => viewerTraits.includes(t))
  }
  return true
}