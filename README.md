# TileStories

A local, browser-based session manager for tabletop roleplaying games. Runs on the GM's machine and serves three browser views: an organizer for the GM, a player view for each player's device, and a display for a TV or projector.

| View | Who uses it | Address |
|---|---|---|
| Organizer | GM | `http://localhost:5173` |
| Player | Players | `http://[your-ip]:3001` |
| Display | TV / projector | `http://[your-ip]:3001/display.html` |

---

## Getting Started

### 1. Install Node.js

Download and install [Node.js](https://nodejs.org/) (v18 or newer). npm comes bundled with it.

### 2. Get the code

```bash
git clone https://github.com/YOUR_USERNAME/tilestories.git
cd tilestories
```

### 3. Install dependencies

```bash
npm install
```

Only needed once (or after pulling updates).

### 4. Start the app

**Windows:** double-click `start.bat` in the project folder.

**Mac / Linux:**
```bash
npm start
```

This starts everything — the organizer UI and the game server. Open `http://localhost:5173` in your browser to get started.

---

## Multiplayer

Players need to be on the same Wi-Fi network as the GM's machine.

1. Start a session in the Organizer.
2. The Display screen shows a join screen with a QR code.
3. Players scan the QR code (or go to `http://[GM's-local-ip]:3001` manually).

The GM can toggle the join screen on/off mid-session for late arrivals. Session state lives in the server's memory and resets when the server restarts. Campaign data lives in the GM's browser — export a `.tilestories.json` backup from the campaign panel.

---

## What's in each view

**Organizer**
- Hex and square grid map editor, multiple maps per campaign
- Maps organized into named tabs
- Characters, NPCs, creatures, items, abilities, and status effects
- Tile events with multi-step triggers (storyboards, effects, portals, messages)
- Session controls: turn order, movement, dice rolls, roll requests to players
- Storyboard editor with image/text layers
- Game-system-driven character sheets (D&D 5e and Generic included; customizable per campaign)
- Auto-saves to IndexedDB; export/import as `.tilestories.json`

**Player**
- Move token on the map
- View character sheet, inventory, and abilities
- Receive and respond to GM roll requests (stat bonuses applied automatically)
- Receive storyboard scenes from the GM
- Add personal map annotations

**Display**
- Join screen with QR code
- Full-screen map view
- Storyboard scenes pushed from the organizer
- Dice roll log with pass/fail indicators

---

## Project structure

```
tilestories/
├── start.bat               # Windows launcher
├── server.js               # WebSocket + Express game server (port 3001)
├── index.html              # Organizer entry
├── display.html            # Display entry
├── player.html             # Player entry
├── vite.config.js
├── vite.player.config.js
└── src/
    ├── App.jsx             # Organizer root
    ├── PlayerApp.jsx       # Player root
    ├── DisplayApp.jsx      # Display root
    ├── systems/            # Game system definitions
    ├── store/              # Zustand state (campaign + session)
    ├── components/         # UI components
    └── utils/              # Hex math, storage, sockets, dice
```

---

## Tech stack

- React 18 + Zustand
- Vite
- CSS Modules
- Node.js + Express + ws
- qrcode.react
- IndexedDB / localStorage

---

## Developer options

Run parts of the stack separately:

```bash
npm run dev      # Vite dev server only (organizer, port 5173)
npm run server   # Game server only (port 3001)
```

Build for production:

```bash
npm run build          # Organizer + display → dist/
npm run build:player   # Player app → player-dist/
```

Serve `dist/` from any static host and run `node server.js` for the game server.

---

## License

MIT
