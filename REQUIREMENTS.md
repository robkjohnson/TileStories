# TileStories — Requirements & Feature Specification

This document describes the intended behavior of TileStories. It serves as a reference for contributors and a checklist for testers.

---

## System overview

TileStories is a **local-network, real-time TTRPG session manager** with three client views (organizer, player, display) and a WebSocket relay server. All persistent data lives in the GM's browser. No cloud account or database is required.

### Roles

| Role | Description |
|---|---|
| **Organizer (GM)** | Hosts the session, controls all state, runs on the game master's machine |
| **Player** | Joins via local IP, controls their character token and receives GM-pushed content |
| **Display** | Passive screen (TV/projector) that shows what the GM chooses to broadcast |

---

## Functional requirements

### F1 — Campaign management

| ID | Requirement | Status |
|---|---|---|
| F1.1 | Create a new campaign with a default map | ✅ Implemented |
| F1.2 | Save campaign to browser IndexedDB automatically (debounced) | ✅ Implemented |
| F1.3 | Load a saved campaign from the campaign library | ✅ Implemented |
| F1.4 | Export campaign to `.tilestories.json` file | ✅ Implemented |
| F1.5 | Import campaign from `.tilestories.json` file | ✅ Implemented |
| F1.6 | Delete a saved campaign | ✅ Implemented |
| F1.7 | Campaign stores: maps, characters, NPCs, creatures, items, abilities, storyboards, events | ✅ Implemented |

### F2 — Map system

| ID | Requirement | Status |
|---|---|---|
| F2.1 | Hexagonal grid map (flat-top offset coordinates) | ✅ Implemented |
| F2.2 | Multiple named maps per campaign | ✅ Implemented |
| F2.3 | Switch between maps via tab bar | ✅ Implemented |
| F2.4 | Paint tiles with a terrain/biome type using a brush tool | ✅ Implemented |
| F2.5 | Erase tiles back to default | ✅ Implemented |
| F2.6 | Label tiles with visible text | ✅ Implemented |
| F2.7 | Attach organizer-only notes to a tile | ✅ Implemented |
| F2.8 | Zoom and pan the map | ✅ Implemented |
| F2.9 | Place character/creature tokens on tiles | ✅ Implemented |
| F2.10 | Tokens display character portrait or emoji | ✅ Implemented |
| F2.11 | Portal events teleport players between maps | ✅ Implemented |

### F3 — Tile types / biomes

| ID | Requirement | Status |
|---|---|---|
| F3.1 | 16+ built-in tile types (Grassland, Forest, Water, Mountain, Dungeon, etc.) | ✅ Implemented |
| F3.2 | Custom tile types with name, icon, color, walkability, status effects | ✅ Implemented |
| F3.3 | Tile types stored per campaign | ✅ Implemented |

### F4 — Character management

| ID | Requirement | Status |
|---|---|---|
| F4.1 | Create player characters with name, class, race, level, HP, AC, speed, initiative | ✅ Implemented |
| F4.2 | Character portrait (uploaded image, base64 stored) | ✅ Implemented |
| F4.3 | Emoji icon fallback if no portrait | ✅ Implemented |
| F4.4 | Link a character to a player device in a session | ✅ Implemented |
| F4.5 | Character ability scores and derived modifiers | ✅ Implemented |
| F4.6 | Custom fields on characters | ✅ Implemented |
| F4.7 | Traits (tags used for event visibility gating) | ✅ Implemented |

### F5 — NPC / creature management

| ID | Requirement | Status |
|---|---|---|
| F5.1 | Create creatures with name, size, CR, HP, AC, speed, ability scores | ✅ Implemented |
| F5.2 | Creature stat block view | ✅ Implemented |
| F5.3 | Assign abilities to creatures | ✅ Implemented |
| F5.4 | Creature tokens on the map | ✅ Implemented |

### F6 — Item system

| ID | Requirement | Status |
|---|---|---|
| F6.1 | Item templates: weapon, armor, consumable, container, key, misc | ✅ Implemented |
| F6.2 | Item rarities: common, uncommon, rare, very rare, legendary | ✅ Implemented |
| F6.3 | Assign items to characters and containers | ✅ Implemented |
| F6.4 | Container types: chest, bag, altar, hidden | ✅ Implemented |
| F6.5 | Currency tracking per character | ✅ Implemented |

### F7 — Ability system

| ID | Requirement | Status |
|---|---|---|
| F7.1 | Ability templates with name, description, damage type, dice, saving throw, AoE shape | ✅ Implemented |
| F7.2 | Uses-per-rest tracking (short rest / long rest) | ✅ Implemented |
| F7.3 | Assign abilities to characters and creatures | ✅ Implemented |

### F8 — Event system

| ID | Requirement | Status |
|---|---|---|
| F8.1 | Attach events to individual tiles | ✅ Implemented |
| F8.2 | Event types: Storyboard, Fire, Flood, Collapse, Reveal, Portal, Message | ✅ Implemented |
| F8.3 | Multi-step event sequences | ✅ Implemented |
| F8.4 | Visibility modes: all players, no players, trait-gated | ✅ Implemented |
| F8.5 | Fire an event manually from the tile inspector | ✅ Implemented |
| F8.6 | Event log showing recent fired events | ✅ Implemented |
| F8.7 | Overlay effects on the display screen when events fire | ✅ Implemented |

### F9 — Storyboard system

| ID | Requirement | Status |
|---|---|---|
| F9.1 | Create named storyboards with a background image | ✅ Implemented |
| F9.2 | Layer images and text blocks on a storyboard | ✅ Implemented |
| F9.3 | Per-layer: position, rotation, flip, opacity | ✅ Implemented |
| F9.4 | Broadcast a storyboard to: organizer only, players, display screen, or all | ✅ Implemented |
| F9.5 | Storyboard stored per campaign and reusable across events | ✅ Implemented |

### F10 — Multiplayer session

| ID | Requirement | Status |
|---|---|---|
| F10.1 | Organizer starts a session; players join by navigating to the server IP | ✅ Implemented |
| F10.2 | Players identified by a persistent device ID (localStorage) | ✅ Implemented |
| F10.3 | Player sets a display name before joining | ✅ Implemented |
| F10.4 | Organizer assigns a character to each connected player | ✅ Implemented |
| F10.5 | Real-time map sync: token positions visible to all | ✅ Implemented |
| F10.6 | Turn order modes: organizer-controlled, full-party, turn-based | ✅ Implemented |
| F10.7 | Movement speed enforcement: organizer approves player moves | ✅ Implemented |
| F10.8 | Players can submit move requests; organizer approves or rejects | ✅ Implemented |
| F10.9 | Organizer can push storyboards to player screens | ✅ Implemented |
| F10.10 | Display screen connects as a passive observer | ✅ Implemented |
| F10.11 | Session state resets on server restart (not persisted server-side) | ✅ Implemented |

### F11 — Dice system

| ID | Requirement | Status |
|---|---|---|
| F11.1 | Organizer can initiate a dice roll request to all players | ✅ Implemented |
| F11.2 | Players roll from their device and result is broadcast | ✅ Implemented |
| F11.3 | Threshold success checking (roll ≥ target) | ✅ Implemented |
| F11.4 | Dice types: d4, d6, d8, d10, d12, d20, d100 | ✅ Implemented |
| F11.5 | Dice log shows last 20 rolls | ✅ Implemented |

### F12 — Player annotations

| ID | Requirement | Status |
|---|---|---|
| F12.1 | Players can place pins on the map | ✅ Implemented |
| F12.2 | Pins stored locally on the player's device, not synced to organizer | ✅ Implemented |

### F13 — Player notes

| ID | Requirement | Status |
|---|---|---|
| F13.1 | Players have a personal notes area in their session view | ✅ Implemented |
| F13.2 | Notes stored locally on the player's device | ✅ Implemented |

---

## Non-functional requirements

| ID | Requirement |
|---|---|
| NF1 | Works on the same local-area network (Wi-Fi); no internet required during play |
| NF2 | Player view must be usable on mobile (iOS Safari, Android Chrome) |
| NF3 | Organizer view targets desktop browsers (Chrome, Firefox, Edge) |
| NF4 | Campaign data must survive browser refresh (IndexedDB persistence) |
| NF5 | Player device identity must survive browser refresh (localStorage) |
| NF6 | No accounts, no cloud services, no third-party auth |
| NF7 | Images stored as base64 in IndexedDB; campaign JSON stays lean |
| NF8 | Server must handle at least 6 simultaneous player connections |

---

## Known limitations / out of scope (v0.1)

- No server-side campaign persistence — data lives only in the GM's browser
- No undo/redo on map edits
- No fog of war (tile visibility per player)
- No embedded audio/music playback (display screen has a music state stub)
- No offline PWA / service worker
- No authentication — anyone on the LAN can join a session by URL

---

## Component inventory

| Component | File | Description |
|---|---|---|
| HexGrid | `src/components/HexGrid/` | Map rendering, pan/zoom, token drag |
| TileInspector | `src/components/TileInspector/` | Tile detail panel, event list |
| Toolbar | `src/components/Toolbar/` | Tool picker, campaign controls |
| MapTabs | `src/components/MapTabs/` | Map switching tabs |
| EventEditor | `src/components/EventEditor/` | Create/edit/fire tile events |
| Storyboard | `src/components/Storyboard/` | Storyboard builder and broadcast |
| CharacterSheet | `src/components/CharacterSheet/` | PC detail view |
| CreatureSheet | `src/components/CreatureSheet/` | NPC/creature stat block |
| ItemSystem | `src/components/ItemSystem/` | Inventory, containers |
| AbilitySystem | `src/components/AbilitySystem/` | Abilities and spells |
| TurnTracker | `src/components/TurnTracker/` | Initiative and turn order |
| Session | `src/components/Session/` | Lobby and active session UI |
| CampaignLibrary | `src/components/CampaignLibrary/` | Save/load campaign menu |
| CampaignPanel | `src/components/CampaignPanel/` | Campaign metadata editor |
| TileTypes | `src/components/TileTypes/` | Custom biome/tile type manager |
| OrganizerUI | `src/components/OrganizerUI/` | Sidebars, character roster, session controls |
| Modal | `src/components/Modal/` | Generic modal wrapper |

---

## Testing checklist (for volunteer testers)

### Setup
- [ ] Clone the repo and `npm install` succeeds
- [ ] `npm start` launches without errors
- [ ] Organizer loads at `http://localhost:5173`
- [ ] Player view loads at `http://[ip]:3001`
- [ ] Display view loads at `http://[ip]:3001/display.html`

### Campaign basics
- [ ] Create a new campaign
- [ ] Paint tiles with different biomes
- [ ] Add a label to a tile
- [ ] Create a character with a portrait
- [ ] Create an NPC/creature
- [ ] Create an item and assign it to a character
- [ ] Export campaign as `.tilestories.json`
- [ ] Import that file back in a fresh campaign list

### Session / multiplayer
- [ ] Start a session as organizer
- [ ] Join as a player from a second device or browser tab
- [ ] Player token appears on organizer map
- [ ] Player can move their token
- [ ] Organizer sees the move
- [ ] Organizer fires a storyboard — player sees it
- [ ] Dice roll request flows from organizer → player → result visible to both

### Edge cases
- [ ] Refresh organizer mid-session — campaign still loads
- [ ] Player refreshes their tab — reconnects and character is still there
- [ ] Open display screen — map stays in sync
- [ ] Two players moving simultaneously — no state corruption
