# TileStories — Game Systems

A **game system** is a per-campaign configuration object that defines all the rules-specific concepts TileStories needs to function: what stats actors have, what currencies exist, what item categories are available, and so on.

Every campaign stores a `gameSystemId` field. TileStories looks up the full definition at runtime with `getSystem(campaign.gameSystemId)`.

---

## Built-in Systems

| ID | Name | File |
|----|------|------|
| `dnd5e` | D&D 5th Edition | `src/systems/dnd5e.js` |
| `generic` | Generic / Custom | `src/systems/generic.js` |

If a campaign's `gameSystemId` doesn't match any registered system, TileStories falls back to `dnd5e`.

---

## System Definition Schema

```typescript
{
  id:          string   // unique identifier, used in campaign.gameSystemId
  name:        string   // displayed in the campaign creation UI
  description: string

  // ── Actor types ────────────────────────────────────────────
  // Replaces the old hardcoded 'player'/'npc'/'monster'/'wild'/'pet' etc.
  actorTypes: {
    id:           string   // stored in actor.actorType
    label:        string
    short:        string   // abbreviated label for tight UI spaces
    isPlayer:     boolean  // true = can be assigned to a player's session device
    icon:         string   // emoji
    showInRoster: boolean  // whether this type appears in the character roster sidebar
  }[]

  // ── Stats ──────────────────────────────────────────────────
  // Everything in actor.stats is keyed by these IDs.
  stats: {
    id:          string
    label:       string
    short:       string       // abbreviated
    type:        'attribute'  // primary ability score, shows modifier in UI
               | 'resource'   // has a current value vs a max (HP)
               | 'number'     // plain numeric field
               | 'text'       // free-form string (CR, size category, etc.)
    default:     number | string
    min?:        number        // clamp lower bound (used for hp = 0)
    group:       string        // groups stats in the character sheet UI
    actorTypes?: string[]      // if set, only show for these actor type IDs
  }[]

  // Which stat IDs drive built-in mechanics:
  hpStat:         string   // actor's current HP stat ID
  maxHpStat:      string   // actor's max HP stat ID
  speedStat:      string   // used for movement range enforcement
  initiativeStat: string   // used to sort the turn tracker

  // Stats available as saving throw targets in ability builders
  savingThrowStats: string[]   // stat IDs

  // ── Currencies ──────────────────────────────────────────────
  // actor.currency is { [currencyId]: number }
  currencies: {
    id:             string
    label:          string
    shortLabel:     string
    baseConversion: number  // value in the primary currency (gp = 1.0 reference)
  }[]

  // ── Item categories ─────────────────────────────────────────
  // Keys used in itemTemplate.category
  itemCategories: {
    [categoryId: string]: { label: string, icon: string, color: string }
  }

  // ── Item rarities ────────────────────────────────────────────
  rarities: { id: string, label: string, color: string }[]

  // ── Combat ───────────────────────────────────────────────────
  damageTypes: string[]   // used in ability and effect builders

  abilityCategories: {
    [categoryId: string]: { label: string, color: string, icon: string }
  }

  actionCosts:  { id: string, label: string }[]
  rangeTypes:   { id: string, label: string }[]

  // ── Creature sizes ────────────────────────────────────────────
  sizeCategories: { id: string, label: string }[]
}
```

---

## Adding a New Game System

1. Create `src/systems/mysystem.js` following the schema above.
2. Import and add it to `SYSTEMS` in `src/systems/index.js`:

```javascript
import { MYSYSTEM } from './mysystem.js'
export const SYSTEMS = [DND5E, GENERIC, MYSYSTEM]
```

3. That's it. The campaign creation UI reads from `SYSTEMS` automatically.

---

## Adapting Existing Campaigns

When you create a campaign with a custom system, the organizer picks the system at creation time and it's stored in `campaign.gameSystemId`. If you want to change the system for an existing campaign:

1. Export the campaign via the Campaign Library panel.
2. Open the JSON file and change `"gameSystemId"` to the new system ID.
3. Check that all actor `stats` objects still have values for the new system's stat IDs. Add any missing ones manually.
4. Re-import the campaign.

---

## How Stats Are Stored

Actor stats are stored as a flat object keyed by stat IDs from the game system:

```javascript
// D&D 5e actor
actor.stats = {
  str: 14, dex: 12, con: 16, int: 8, wis: 10, cha: 13,
  hp: 20, maxHp: 28, ac: 15, speed: 30, initiative: 1,
}

// Generic system actor
actor.stats = {
  hp: 10, maxHp: 10, def: 8, move: 5, init: 2,
}
```

Stats not defined in the system are silently ignored by the UI but are preserved in the JSON. This means it's safe to switch a campaign's system without losing data — the old stat values remain as `customFields`-style extras.

---

## Currency

Currencies are stored as a per-actor object:

```javascript
actor.currency = { gp: 150, sp: 30, cp: 5 }
```

The `baseConversion` field on each currency definition is used to display total values in the primary denomination. For D&D 5e with `gp = 1.0`, an actor holding `{ gp: 1, sp: 10, cp: 100 }` has a total of 3 gp.
