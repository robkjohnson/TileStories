# TileStories — Architecture Overview

## Three-App Structure

TileStories is a single codebase that builds three distinct web apps from the same React + Vite project.

| App | Entry point | URL | Who uses it |
|-----|-------------|-----|-------------|
| **Organizer** | `src/main.jsx` → `App.jsx` | `localhost:5173` (dev) | Game master / DM |
| **Player** | `src/player-main.jsx` → `PlayerApp.jsx` | `[GM-IP]:3001` | Players (any device) |
| **Display** | `src/display-main.jsx` → `DisplayApp.jsx` | `[GM-IP]:3001/display.html` | TV / projector |

The Organizer and Display are built together by `vite build`. The Player app is built separately with `vite build --config vite.player.config.js` and is served statically by the Express server.

## Data Flow

```
Organizer (Zustand) ──── WebSocket ──── Server (in-memory session)
       │                                       │
       │  campaign sanitized for players       ├─── Player 1 (React)
       │                                       ├─── Player 2 (React)
       └── IndexedDB (persistent campaign)     └─── Display (React)
```

- **Campaign data** lives in the Organizer's browser (IndexedDB). The server holds an in-memory copy while a session is active and broadcasts a sanitized version to players.
- **Session state** (turn order, movement, dice rolls) is ephemeral — it lives only in the server's memory and resets when the server restarts.
- **Player-local data** (map pins, notes) is stored in each player device's `localStorage` and is never synced.

## Directory Structure

```
TileStories/
├── server.js              # Express + WebSocket server (port 3001)
├── index.html             # Organizer app HTML shell
├── display.html           # Display app HTML shell
├── player.html            # Player app HTML shell
├── vite.config.js         # Organizer + display build
├── vite.player.config.js  # Player app build
├── scripts/
│   └── migrate-campaign.js  # CLI migration tool (v1 → v2 schema)
├── docs/                  # You are here
├── src/
│   ├── systems/           # Game system definitions (rules layer)
│   │   ├── dnd5e.js
│   │   ├── generic.js
│   │   └── index.js
│   ├── models/            # Entity factories (data layer)
│   │   ├── id.js
│   │   ├── actor.js
│   │   ├── campaign.js
│   │   ├── map.js
│   │   ├── item.js
│   │   ├── ability.js
│   │   ├── effect.js
│   │   ├── event.js
│   │   ├── storyboard.js
│   │   └── index.js       # barrel export
│   ├── store/             # State management
│   │   ├── useStore.js    # Main Zustand store (combines slices)
│   │   ├── useSessionStore.js  # Multiplayer session state
│   │   └── slices/
│   │       ├── campaignSlice.js
│   │       ├── mapSlice.js
│   │       ├── actorSlice.js
│   │       ├── itemSlice.js
│   │       ├── abilitySlice.js
│   │       ├── effectSlice.js
│   │       ├── eventSlice.js
│   │       └── uiSlice.js
│   ├── components/        # React UI (see below)
│   ├── utils/             # Pure utilities
│   ├── App.jsx            # Organizer root
│   ├── PlayerApp.jsx      # Player root
│   └── DisplayApp.jsx     # Display root
```

## State Management

The store is split into **domain slices** that all share a single Zustand store instance. Each slice is a function `(set, get) => ({ ...actions })` — they can call each other's actions via `get().someAction()` since all slices are merged into the same namespace.

```
useStore
  ├── campaignSlice   — campaign root + schema migrations
  ├── mapSlice        — maps, tiles, tile types, overlays
  ├── actorSlice      — actors, token placement, status/damage
  ├── itemSlice       — item library, inventories, containers
  ├── abilitySlice    — ability library, actor instances
  ├── effectSlice     — status/effect library, effect execution
  ├── eventSlice      — tile events, storyboards, story entries
  └── uiSlice         — tool, camera, selection modes (not persisted)
```

## Persistence

| What | Where | Lifetime |
|------|-------|----------|
| Campaign | IndexedDB (`tilestories_campaigns`) | Permanent (until cleared) |
| Display preferences | `localStorage` | Per-device |
| Session state | Server memory | Until server restart |
| Player annotations | `localStorage` | Per-device |

Auto-save is handled by `useAutoSave.js` — it debounces 500 ms after any campaign change and writes to IndexedDB. Export/import via `.tilestories.json` is the primary backup mechanism.

## WebSocket Protocol

Messages are JSON objects with a `type` field. Key flows:

| Direction | Message type | What it does |
|-----------|-------------|-------------|
| Org → Server | `HOST_SESSION` | Creates session, registers organizer |
| Org → Server | `SYNC_CAMPAIGN` | Pushes updated campaign to all players |
| Player → Server | `JOIN_SESSION` | Registers player, receives campaign |
| Player → Server | `REQUEST_MOVE` | Move request (auto-approved in party/turn mode) |
| Server → Org | `MOVE_APPLIED` | Confirms move, sends updated campaign |
| Server → Player | `CAMPAIGN_UPDATED` | Sanitized campaign broadcast |
| Org → Server | `SHOW_STORYBOARD` | Pushes storyboard to Display screen |
| Org → Server | `SHOW_STORYBOARD_TO_PLAYER` | Pushes storyboard to specific player |

## Campaign Sanitization

Before sending campaign data to players, `sanitizeCampaignForPlayer()` in `server.js`:
- Removes `notes` from all actors (organizer-only field)
- Removes `notes` from all tiles
- Filters out events with `visibility: 'none'`
- Filters story entries to only those with `visibleToPlayers: true`

## Hex Grid

The map renders on a single HTML5 canvas (`HexGrid.jsx`). Tiles are **flat-top hexagons** using even-q offset coordinates. Pure coordinate math lives in `utils/hexMath.js`.

Square grids are also supported — the map's `tileStyle` field switches between the two.
