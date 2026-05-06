/**
 * UI slice — ephemeral view state that is never persisted to the campaign.
 *
 * This includes the active tool, camera position, effect mode, tile selection
 * mode, portal picking, and display preferences. Nothing here is saved to
 * IndexedDB or exported with the campaign.
 */
export const createUiSlice = (set, get) => ({

  // ── Tool & map state ──────────────────────────────────────────
  selectedTile:   null,
  tool:           'select',         // 'select' | 'paint' | 'erase' | 'label' | 'token'
  activeBiome:    'grassland',
  showGrid:       true,
  showCoords:     false,
  showAllLabels:  false,            // organizer global toggle to show all tile labels

  // Display preferences — persisted in localStorage per-device, not in campaign
  labelSize:       parseFloat(localStorage.getItem('tilestories_labelSize')        || '1'),
  statusIconSize:  parseFloat(localStorage.getItem('tilestories_statusIconSize')   || '1'),
  displayLabelSize:parseFloat(localStorage.getItem('tilestories_displayLabelSize') || '1'),

  inspectorOpen: true,

  // ── Selection modes ───────────────────────────────────────────
  // Tile selection mode: map clicks toggle tiles into a set (used by EventEditor).
  tileSelectionMode: null,          // null | { tiles: [{q,r}] }

  // Portal pick mode: click a tile to pick a portal destination.
  portalPickMode: null,             // null | { originMapId, onPick: fn(tile) }

  // ── Effect mode ───────────────────────────────────────────────
  effectMode: null,
  // null | { effectId, selectedTiles: [{q,r}], selectedChars: [id], aoeRotation: 0-7 }

  lastEffectResults: null,
  // null | [{ actorId, name, damage, newHp }]

  // ── Viewer context ────────────────────────────────────────────
  // Controls what the current user can see. Organizer sees everything;
  // player mode filters by visibility rules and traits.
  viewerMode:   'organizer',        // 'organizer' | 'player'
  viewerTraits: [],                 // traits the current viewer has (for trait-gated events)

  // ── Camera ────────────────────────────────────────────────────
  camera: { x: 0, y: 0, zoom: 1 },

  // ── Setters ───────────────────────────────────────────────────
  setSelectedTile:   (tile)  => set({ selectedTile: tile }),
  setTool:           (tool)  => set({ tool }),
  setActiveBiome:    (b)     => set({ activeBiome: b }),
  toggleGrid:        ()      => set(s => ({ showGrid: !s.showGrid })),
  toggleCoords:      ()      => set(s => ({ showCoords: !s.showCoords })),
  toggleAllLabels:   ()      => set(s => ({ showAllLabels: !s.showAllLabels })),
  setInspectorOpen:  (v)     => set({ inspectorOpen: v }),
  setViewerMode:     (mode)  => set({ viewerMode: mode }),
  setViewerTraits:   (traits)=> set({ viewerTraits: traits }),
  setCamera:         (cam)   => set({ camera: cam }),
  updateCamera:      (partial) => set(s => ({ camera: { ...s.camera, ...partial } })),
  clearEffectResults:()      => set({ lastEffectResults: null }),

  setLabelSize: (v) => {
    localStorage.setItem('tilestories_labelSize', v)
    set({ labelSize: v })
  },
  setStatusIconSize: (v) => {
    localStorage.setItem('tilestories_statusIconSize', v)
    set({ statusIconSize: v })
  },
  setDisplayLabelSize: (v) => {
    localStorage.setItem('tilestories_displayLabelSize', v)
    set({ displayLabelSize: v })
  },

  // ── Tile selection mode ───────────────────────────────────────
  startTileSelection: (initialTiles = []) => set({ tileSelectionMode: { tiles: initialTiles } }),

  toggleSelectedTile: (q, r) => set(s => {
    if (!s.tileSelectionMode) return {}
    const tiles = s.tileSelectionMode.tiles
    const exists = tiles.find(t => t.q === q && t.r === r)
    return {
      tileSelectionMode: {
        ...s.tileSelectionMode,
        tiles: exists ? tiles.filter(t => !(t.q === q && t.r === r)) : [...tiles, { q, r }],
      },
    }
  }),

  endTileSelection: () => {
    const tiles = get().tileSelectionMode?.tiles || []
    set({ tileSelectionMode: null })
    return tiles
  },

  // ── Portal pick mode ──────────────────────────────────────────
  startPortalPick: (originMapId, onPick) => set({ portalPickMode: { originMapId, onPick } }),
  endPortalPick:   () => set({ portalPickMode: null }),

  // ── Effect mode ───────────────────────────────────────────────
  startEffectMode: (effectId) => set({
    effectMode: { effectId, selectedTiles: [], selectedChars: [], aoeRotation: 0 },
  }),
  cancelEffectMode: () => set({ effectMode: null }),

  rotateEffectAoe: (dir) => set(s => ({
    effectMode: s.effectMode
      ? { ...s.effectMode, aoeRotation: (((s.effectMode.aoeRotation ?? 0) + (dir === 'cw' ? 1 : -1)) % 8 + 8) % 8 }
      : null,
  })),

  setEffectRootTile: (q, r) => set(s => ({
    effectMode: s.effectMode ? { ...s.effectMode, selectedTiles: [{ q, r }] } : null,
  })),

  toggleEffectTile: (q, r) => set(s => {
    if (!s.effectMode) return {}
    const tiles  = s.effectMode.selectedTiles
    const exists = tiles.find(t => t.q === q && t.r === r)
    return {
      effectMode: {
        ...s.effectMode,
        selectedTiles: exists
          ? tiles.filter(t => !(t.q === q && t.r === r))
          : [...tiles, { q, r }],
      },
    }
  }),

  toggleEffectChar: (actorId) => set(s => {
    if (!s.effectMode) return {}
    const chars  = s.effectMode.selectedChars
    const exists = chars.includes(actorId)
    return {
      effectMode: {
        ...s.effectMode,
        selectedChars: exists ? chars.filter(id => id !== actorId) : [...chars, actorId],
      },
    }
  }),
})
