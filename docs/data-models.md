# TileStories — Data Models Reference (Schema v2)

All campaign data lives in a single JSON document exported as `.tilestories.json`.

## Campaign (root)

```typescript
{
  id:            string        // random 8-char base-36
  schemaVersion: number        // 2 (current)
  name:          string
  description:   string
  gameSystemId:  string        // e.g. 'dnd5e' | 'generic' — see docs/game-systems.md

  // Per-campaign game rule overrides (null = use base system defaults)
  customActorTypes:  ActorType[] | null    // replaces system.actorTypes when set
  customDamageTypes: string[] | null       // replaces system.damageTypes when set
  customStats:       StatDefinition[] | null  // replaces system.stats when set

  settings: {
    defaultBiome: string       // tile type key used for unpainted tiles
    defaultCols:  number
    defaultRows:  number
  }
  tileTypes:   { [id]: TileType }
  maps:        { [id]: Map }
  activeMapId: string
  actors:      { [id]: Actor }    // unified characters + creatures
  items:       { [id]: ItemTemplate }
  abilities:   { [id]: AbilityTemplate }
  statuses:    { [id]: Status }
  effects:     { [id]: Effect }
  containers:  { [id]: Container }
  storyboards: { [id]: Storyboard }
  story:       { [id]: StoryEntry }
  joinScreenBg: string | null     // base64 background image for the display join screen
  attachments: Attachment[]
  coverImage:  string | null      // base64
  createdAt:   ISO string
  updatedAt:   ISO string
}
```

---

## Actor

Replaces the old split between `characters` and `creatures`. Every token on every map is an actor.

```typescript
{
  id:         string
  actorType:  string        // from gameSystem.actorTypes[x].id
                            // e.g. 'player'|'npc'|'monster'|'wild'|'pet'|'mount'…

  // Display
  name:       string
  emoji:      string | null
  portrait:   string | null // base64 data URL
  attachments: Attachment[]

  // Stats — flexible key/value map keyed by gameSystem stat IDs
  // D&D 5e actors will have: hp, maxHp, ac, speed, initiative, str, dex, con, int, wis, cha
  // Plus optional: cr (text), size (text)
  stats: { [statId: string]: number | string }

  species: string           // free-form species/race

  // Game systems
  traits:        string[]       // tags for event gating and status negation
  activeStatuses: StatusInstance[]
  abilities:      AbilityInstance[]
  inventory:      ItemInstance[]
  currency:       { [currencyId: string]: number }  // e.g. { gp: 100, sp: 50 }

  // Notes (multi-audience)
  notes:       string       // organizer only — stripped before sending to players
  publicNotes: string       // legacy; shown to players
  description: string       // public lore
  biography:   string       // private backstory

  // Ownership
  ownedBy:        string | null  // actorId (for pets/mounts)
  assignedPlayer: string | null  // player device ID

  // Visibility
  isKey:             boolean  // visible on all maps simultaneously
  revealedToPlayers: boolean

  // Map position
  currentMapId: string | null
  currentTile:  { q: number, r: number } | null

  // Extensibility
  customFields: { [key: string]: any }

  createdAt: ISO string
  updatedAt: ISO string
}
```

### StatusInstance
```typescript
{
  statusId:         string
  appliedAt:        ISO string
  appliedModifiers?: { stat: string, value: number }[]  // tracked for reversal on removal
  sourceTile?:      { mapId: string, tileKey: string, lingering: boolean }
}
```

### AbilityInstance
```typescript
{
  templateId:     string
  usesRemaining:  number | null  // null = defer to template
  overrides:      object          // per-actor field overrides
}
```

### ItemInstance
```typescript
{
  id:         string
  templateId: string
  quantity:   number
  notes:      string
  identified: boolean   // false = players see "Unknown Item"
}
```

---

## Map

```typescript
{
  id:             string
  name:           string
  description:    string
  tab:            string        // organizer-defined group label (e.g. "World", "Dungeons"); '' = ungrouped
  cols:           number
  rows:           number
  defaultBiome:   string        // tile type key
  parentMapId:    string | null
  tileStyle:      'hex' | 'square'

  // Background image — rendered behind the tile grid
  backgroundImage: string | null  // base64 data URL
  bgImgWidth:      number | null  // natural pixel width (for aspect ratio)
  bgImgHeight:     number | null  // natural pixel height
  bgCols:          number | null  // how many tile-columns the image spans (null = map.cols)
  bgOffsetX:       number         // horizontal shift in tile units (can be fractional)
  bgOffsetY:       number         // vertical shift in tile units (can be fractional)

  tiles:        { ['q,r']: Tile }
  firedEvents:  { ['q,r']: FiredEventOverlay }
  eventLog:     EventLogEntry[]
  createdAt:    ISO string
}
```

### Tile
```typescript
{
  biome:         string       // tile type key
  label:         string
  notes:         string       // organizer only
  tokens:        string[]     // actorIds
  events:        Event[]
  activeStatuses: TileStatusInstance[]
  walkable?:     boolean      // overrides tile type walkability
}
```

### TileStatusInstance
```typescript
{
  statusId:         string
  appliedAt:        ISO string
  originalWalkable?: boolean  // saved so walkability is restored on status removal
}
```

---

## TileType (Biome)

```typescript
{
  id:                string   // the key used in tile.biome
  name:              string
  color:             string   // hex fill
  border:            string   // hex border
  textColor:         string
  icon:              string   // emoji
  walkable:          boolean
  traits:            string[] // trait tags applied to actors on this tile
  statusEffects:     string[] // status IDs auto-applied to this tile type
  displayBackground: string | null  // base64 background image shown on the tile
  overlay:           boolean        // true = tile color is blended over displayBackground
  overlayOpacity:    number         // 0–1, controls blend strength when overlay is true
  createdAt:         ISO string
}
```

---

## Event (tile event)

```typescript
{
  id:             string
  name:           string
  description:    string
  steps:          Step[]
  visibility:     'all' | 'none' | 'traits'
  requiredTraits: string[]
  firedAt:        ISO string | null
  sourceTile?:    { q: number, r: number }
  createdAt:      ISO string
}
```

### Step
```typescript
// Storyboard step
{ id, type: 'storyboard', storyboardId: string | null, storyboardTarget: 'player'|'display'|'organizer'|'all' }

// Effect step
{ id, type: 'effect', effectId: string | null, selectedTiles: {q,r}[], selectedChars: string[], aoeRotation: 0-7 }

// Portal step
{ id, type: 'portal', targetMapId: string | null, targetTile: {q,r} | null }

// Message step
{ id, type: 'message', text: string }
```

---

## Effect

```typescript
{
  id:           string
  name:         string
  description:  string
  targetType:   'single_tile' | 'tile_aoe' | 'tile_select' | 'char_select'
  targetCount:  number      // for tile_select / char_select
  aoePattern:   { dq: number, dr: number }[]  // offsets from root tile
  durationType: 'one_time' | 'lingering'
  actions:      EffectAction[]
  createdAt:    ISO string
}
```

### EffectAction
```typescript
{ id, type: 'damage',       diceExpr: string, flatAmount: number }
{ id, type: 'apply_status', statusId: string }
```

---

## Status

```typescript
{
  id:              string
  name:            string
  description:     string
  color:           string    // hex
  icon:            string    // emoji
  negatingTraits:  string[]  // trait tags that block this status
  blocks:          string[]  // other status IDs that can't coexist with this one
  eligibleTargets: 'characters' | 'tiles'
  modifiers:       StatusModifier[]
  createdAt:       ISO string
}
```

### StatusModifier
```typescript
{ id, type: 'stat',              stat: string, value: number }
{ id, type: 'setWalkable',       value: number }      // 0 or 1
{ id, type: 'applyToCharacters', statusId: string, lingering: boolean }
```

---

## ItemTemplate

```typescript
{
  id:            string
  name:          string
  description:   string
  category:      string    // key from gameSystem.itemCategories
  rarity:        string    // id from gameSystem.rarities
  weight:        number
  value:         number    // in base currency
  tags:          string[]
  grantedTraits: { id, name, description }[]
  abilityIds:    string[]  // AbilityTemplate IDs
  effectId:      string | null
  customFields:  object
  createdAt:     ISO string
}
```

---

## AbilityTemplate

```typescript
{
  id:                  string
  name:                string
  description:         string
  category:            string    // key from gameSystem.abilityCategories
  actionCost:          string    // id from gameSystem.actionCosts
  range:               string    // id from gameSystem.rangeTypes
  rangeDistance:       number | null
  damageDice:          string    // e.g. '2d6'
  damageType:          string
  damageBonus:         number
  secondaryDamageDice: string
  secondaryDamageType: string
  secondaryDamageDesc: string
  aoeShape:            string
  aoeSize:             number
  saveStat:            string | null
  saveDC:              number
  usesPerRest:         number | null
  restType:            'short' | 'long'
  conditions:          string[]
  tags:                string[]
  customFields:        object
  effectId:            string | null
  createdAt:           ISO string
}
```

---

## Container

```typescript
{
  id:          string
  name:        string
  type:        string     // id from CONTAINER_TYPES
  description: string
  mapId:       string | null
  tileKey:     string | null   // 'q,r'
  locked:      boolean
  lockDC:      number
  discovered:  boolean
  items:       ItemInstance[]
  createdAt:   ISO string
}
```

---

## Storyboard

```typescript
{
  id:               string
  name:             string
  backgroundImage:  string | null  // base64
  backgroundColor:  string         // hex
  layers: {
    id: string, type: 'image'|'video', src: string,
    x, y, width, height, rotation: number,
    flipX: boolean, flipY: boolean, opacity: number, label: string
  }[]
  textBlocks: {
    id: string, text: string, x, y, fontSize: number,
    color: string, bold: boolean, italic: boolean,
    align: 'left'|'center'|'right',
    opacity: number,        // 0–1
    maxWidth: number,       // % of canvas width (0 = unconstrained)
    rotation: number        // degrees
  }[]
  createdAt: ISO string
}
```

---

## StoryEntry

```typescript
{
  id:              string
  title:           string
  type:            'lore' | 'secret' | 'session'
  content:         string
  visibleToPlayers: boolean
  sessionDate:     ISO string | null
  linkedMapIds:    string[]
  linkedActorIds:  string[]
  createdAt:       ISO string
}
```
