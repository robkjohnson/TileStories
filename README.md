# TileStories — TTRPG Session Manager

A local-first, browser-based session manager for tabletop roleplaying games. TileStories gives a Game Master a full toolkit for running tile-map campaigns — characters, events, storyboards, and real-time multiplayer sync — across three separate screens: the organizer, player devices, and a display/TV screen.

---

## What it does

| View | Who uses it | URL (dev) |
|---|---|---|
| **Organizer** | GM / host | `http://localhost:5173` |
| **Player** | Players on phones/laptops | `http://[your-ip]:3001` |
| **Display** | TV / secondary screen | `http://[your-ip]:3001/display.html` |

**Organizer features**
- Paint and label hex-grid and square-grid maps (18 × 14 default, customizable)
- Organize maps into named tabs/groups with per-map settings panels
- Manage characters, NPCs, creatures, items, and abilities
- Create multi-step events (storyboards, effects, portals, messages)
- Host real-time sessions — players scan a QR code to join, no account needed
- Turn-order tracking, dice rolls (with stat-based bonuses), movement approval
- Send roll requests to specific players; stat bonuses added automatically from their character sheet
- Multiple maps per campaign with portal-based travel
- Storyboard editor with drag-and-drop image/text layers, proper 16:9 canvas scaling
- Game-system-driven character sheets (D&D 5e and Generic built in; fully customizable per campaign)
- Auto-saves to browser IndexedDB; export/import as `.tilestories.json`

**Player features**
- Join a session by scanning a QR code on the display screen — no manual IP entry needed
- Move your token, view inventory, roll dice
- Stat bonuses automatically added to rolls requested by the GM
- Receive storyboard scenes pushed by the GM
- Annotate the map with personal pins

**Display features**
- Join screen with live QR code shown before and between sessions — players just scan to connect
- Customisable join screen background image per campaign
- Full-screen map output for a TV or projector
- GM-controlled storyboard scenes and visual overlays
- Live dice roll panel with success/fail indicators
- Stays in sync with the organizer automatically

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- npm (bundled with Node.js)

### Install

```bash
git clone https://github.com/YOUR_USERNAME/tilestories.git
cd tilestories
npm install
```

### Run (development)

**Windows:** double-click `start.bat` in the project folder.

**All platforms:**
```bash
npm start
```

This builds the player app and launches both the Vite dev server (organizer) and the WebSocket/Express game server concurrently.

| Server | Address |
|---|---|
| Organizer UI | `http://localhost:5173` |
| Player / display | `http://[your-local-ip]:3001` |

Players join by scanning the QR code shown on the display screen, or by navigating directly to `http://[your-local-ip]:3001`. They need to be on the same Wi-Fi network as the GM.

### Run servers separately

```bash
npm run dev      # Vite dev server only (organizer, port 5173)
npm run server   # Game server only (port 3001)
```

### Production build

```bash
npm run build          # Builds organizer + display apps → dist/
npm run build:player   # Builds player app → player-dist/
npm run preview        # Preview production build locally
```

After building, serve the `dist/` folder from any static host and run `node server.js` for multiplayer.

---

## Project structure

```
tilestories/
├── start.bat           # Windows double-click launcher
├── index.html          # Organizer app entry
├── display.html        # Display/TV entry
├── player.html         # Player app entry
├── server.js           # WebSocket + Express game server (port 3001)
├── vite.config.js      # Organizer + display Vite config
├── vite.player.config.js
└── src/
    ├── App.jsx             # Organizer root
    ├── PlayerApp.jsx       # Player root
    ├── DisplayApp.jsx      # Display root
    ├── systems/            # Game system definitions (D&D 5e, Generic, …)
    ├── store/
    │   ├── useStore.js         # Campaign state (Zustand)
    │   └── useSessionStore.js  # Session/multiplayer state
    ├── components/         # UI components
    └── utils/              # Hex math, storage, sockets, dice
```

---

## Tech stack

- **React 18** + **Zustand** — UI and state
- **Vite** — build tool and dev server
- **CSS Modules** — scoped component styles
- **Node.js + Express + ws** — game server and WebSocket relay
- **qrcode.react** — QR code generation for the display join screen
- **IndexedDB / localStorage** — client-side persistence (no database required)

---

## How multiplayer works

1. GM opens the Organizer at `http://localhost:5173` and starts a session.
2. The Display screen (`/display.html`) automatically shows a join screen with a live QR code.
3. Players scan the QR code (or navigate directly to `http://[GM's-local-ip]:3001`) to join.
4. All state flows through the WebSocket server (`server.js`) — the organizer is the source of truth.
5. The GM can re-show the join screen at any time mid-session for late arrivals.

Session state lives in memory on the server and resets on restart. Campaign data (maps, characters, items) is saved only in the GM's browser — export a `.tilestories.json` to back it up.

---

## License

MIT
