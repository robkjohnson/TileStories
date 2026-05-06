# TileStories — Adding New Features

This guide explains the patterns to follow when extending TileStories so new systems fit cleanly into the existing structure.

---

## Adding a New Entity Type

New entity types (e.g. a "Vehicle" or "Structure" that can appear on maps) follow this path:

1. **Model factory** in `src/models/`:
   ```javascript
   // src/models/vehicle.js
   import { newId } from './id.js'
   export function makeVehicle(overrides = {}) {
     return {
       id: newId(),
       name: 'New Vehicle',
       // ... fields
       createdAt: new Date().toISOString(),
       ...overrides,
     }
   }
   ```

2. **Export from the barrel** in `src/models/index.js`:
   ```javascript
   export { makeVehicle } from './vehicle.js'
   ```

3. **Store slice** in `src/store/slices/vehicleSlice.js`:
   ```javascript
   import { makeVehicle } from '../../models/vehicle.js'
   export const createVehicleSlice = (set, get) => ({
     addVehicle(data = {}) { ... },
     updateVehicle(id, partial) { ... },
     deleteVehicle(id) { ... },
   })
   ```

4. **Register the slice** in `src/store/useStore.js`:
   ```javascript
   import { createVehicleSlice } from './slices/vehicleSlice.js'
   export const useStore = create((set, get) => ({
     ...createVehicleSlice(set, get),
     // ... existing slices
   }))
   ```

5. **Add to campaign** in `src/models/campaign.js`:
   ```javascript
   vehicles: {},   // add to the campaign factory
   ```

6. **Add migration** in `src/store/slices/campaignSlice.js` if the field needs to be added to existing campaigns on load (it usually does — just add `vehicles: {}` as a default in the migration chain).

---

## Adding a New Event Step Type

Event steps are what actually happens when a tile event fires.

1. **Register the type** in `src/models/event.js`:
   ```javascript
   export const STEP_TYPES = {
     // ... existing types
     loot: { label: 'Loot Drop', icon: '💎', color: '#c8a96e', description: 'Drops items into a container' },
   }
   ```

2. **Add a factory case** in `makeStep()`:
   ```javascript
   case 'loot': return { ...base, containerId: null, items: [], ...overrides }
   ```

3. **Handle execution** in `eventSlice.js` inside `fireEvent()`, in the `steps.forEach` switch statement:
   ```javascript
   case 'loot': {
     // Add items to a container, log it, etc.
     break
   }
   ```

4. **Add a UI editor** — create a `LootStepEditor.jsx` component in `src/components/EventEditor/` following the same pattern as the existing step editors.

---

## Adding a New Effect Action Type

Effect actions are the atomic mechanics that fire when an effect executes (damage, apply status, etc.).

1. **Add the type** in `src/models/effect.js` — document it in `makeEffectAction()`.

2. **Handle it** in both `effectSlice.js` (`_resolveAndExecute`) and `eventSlice.js` (`fireEvent` → effect step processing). Both places execute effects — keep them in sync.

3. **Add a UI row** in the EffectSystem component so organizers can configure the new action type.

---

## Adding a New Status Modifier Type

Status modifiers define what a status actually does when applied.

1. **Document the type** in `makeStatusModifier()` in `src/models/effect.js`.

2. **Apply it** in `actorSlice.js` → `applyStatusToActor()`, and remove it in `removeStatusFromActor()` (track reversible changes in `appliedModifiers`).

3. **Apply to tiles** in `effectSlice.js` → `applyStatusToTile()` if the modifier affects tiles.

---

## Adding a New Game System

See `docs/game-systems.md` for the full walkthrough.

---

## Extending the Actor Model

Actors have a `customFields` object for arbitrary organizer-defined data. Before adding a new first-class field to the actor schema:

- Ask: is this truly universal (every actor in every system needs it)?
- If yes: add it to `makeActor()` in `src/models/actor.js` and add a migration in `campaignSlice.js`.
- If no: use `customFields` or add it as a game-system-specific stat.

---

## Schema Migrations

When you make a breaking change to the campaign data structure:

1. Increment `SCHEMA_VERSION` in `src/models/campaign.js`.
2. Add a migration function in `src/store/slices/campaignSlice.js` (follow the existing pass pattern — each function is idempotent).
3. Add the same logic to `scripts/migrate-campaign.js` so organizers can migrate exported files.

**Rule:** migrations must be safe to run on already-migrated campaigns. Check for the presence of new fields rather than relying on version numbers alone.

---

## Store Patterns

**Reading state:**
```javascript
const actor = useStore(s => s.campaign?.actors?.[actorId])
```

**Calling actions:**
```javascript
const { updateActor, applyStatusToActor } = useStore()
```

**Cross-slice calls** (inside a slice, one action calling another):
```javascript
// actorSlice.js — calls removeStatusFromActor which lives in the same store
get().removeStatusFromActor(actorId, statusId)
```

**Avoid re-renders** by selecting only what the component needs rather than destructuring the whole campaign object.
