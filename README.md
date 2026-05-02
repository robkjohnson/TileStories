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
- Paint and label hex-grid maps (18 × 14 default, customizable)
- Manage characters, NPCs, creatures, items, and abilities
- Create multi-step events (storyboards, floods, reveals, portals, messages)
- Host real-time sessions — players join by IP, no account needed
- Turn-order tracking, dice rolls, movement approval
- Multiple maps per campaign with portal-based travel
- Auto-saves to browser IndexedDB; export/import as `.tilestories.json`

**Player features**
- Join a session from any device on the same network
- Move your token, view inventory, roll dice
- Receive storyboard scenes pushed by the GM
- Annotate the map with personal pins

**Display features**
- Full-screen map output for a TV or projector
- GM-controlled storyboard scenes and visual overlays
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

```bash
npm start
```

This launches both the Vite dev server (organizer) and the WebSocket/Express game server concurrently.

| Server | Address |
|---|---|
| Organizer UI | `http://localhost:5173` |
| Player / display | `http://[your-local-ip]:3001` |

Find your local IP with `ipconfig` (Windows) or `ifconfig` / `ip a` (Mac/Linux). Players need to be on the same Wi-Fi network.

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

After building, you can serve the `dist/` folder from any static host and run `node server.js` for multiplayer.

---

## Project structure

```
tilestories/
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
    ├── store/
    │   ├── useStore.js         # Campaign state (Zustand)
    │   └── useSessionStore.js  # Session/multiplayer state
    ├── components/         # UI components (see REQUIREMENTS.md)
    └── utils/              # Hex math, storage, sockets, dice
```

---

## Tech stack

- **React 18** + **Zustand** — UI and state
- **Vite** — build tool and dev server
- **CSS Modules** — scoped component styles
- **Node.js + Express + ws** — game server and WebSocket relay
- **IndexedDB / localStorage** — client-side persistence (no database required)

---

## How multiplayer works

1. GM opens the Organizer at `http://localhost:5173` and starts a session.
2. Players navigate to `http://[GM's-local-ip]:3001` on their devices.
3. All state flows through the WebSocket server (`server.js`) — the organizer is the source of truth.
4. The display screen connects the same way but receives push-only updates from the organizer.

Session state lives in memory on the server and resets on restart. Campaign data (maps, characters, items) is saved only in the GM's browser — export a `.tilestories.json` to back it up.

---

## Looking for testers

We're looking for people to help test TileStories in real game sessions. If you run into bugs or have feedback, please [open an issue](../../issues) with:

- What you were doing
- What you expected to happen
- What actually happened
- Your OS and browser

Especially interested in feedback on:
- **Multiplayer stability** across different networks / devices
- **Player device experience** on phones (iOS Safari, Android Chrome)
- **Map painting** and tile system usability
- **Session flow** — join → play → end

---

## Contributing

Pull requests are welcome. For larger changes, open an issue first to discuss the approach.

```bash
# Install deps
npm install

# Run in dev mode
npm start

# After making changes, verify the build still works
npm run build
npm run build:player
```

There are no automated tests yet — manual testing against the dev server is the current workflow.

---

## License

MIT
