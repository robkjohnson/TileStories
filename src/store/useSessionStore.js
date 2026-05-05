// Session state for the organizer — synced via WebSocket
import { create } from 'zustand'

export const useSessionStore = create((set, get) => ({
  // Connection
  connected: false,
  serverInfo: null,          // { ip, port }

  // Session
  session: null,             // full session object from server
  sessionStatus: null,       // 'lobby' | 'active' | 'paused' | 'ended' | null

  // Pending move requests from players
  moveRequests: [],          // [{ deviceId, playerName, characterId, tileKey }]

  // Dice roll log (ephemeral — mirrors server's diceRolls list)
  diceRolls: [],

  setConnected: (v) => set({ connected: v }),
  onCampaignUpdate: null,
  onMoveApplied: null,
  onResolveBroadcastStoryboard: null,
  onTakeItem: null,
  onUpdatePortrait: null,
  onPlayerUseEffect: null,
  setOnCampaignUpdate: (fn) => set({ onCampaignUpdate: fn }),
  setOnMoveApplied: (fn) => set({ onMoveApplied: fn }),
  setOnResolveBroadcastStoryboard: (fn) => set({ onResolveBroadcastStoryboard: fn }),
  setOnTakeItem: (fn) => set({ onTakeItem: fn }),
  setOnUpdatePortrait: (fn) => set({ onUpdatePortrait: fn }),
  setOnPlayerUseEffect: (fn) => set({ onPlayerUseEffect: fn }),
  setServerInfo: (info) => set({ serverInfo: info }),

  handleMessage(msg) {
    switch (msg.type) {
      case 'CONNECTED':
        set({ connected: true, sessionStatus: msg.sessionStatus })
        break

      case 'SESSION_HOSTED':
        set({ session: msg.session, sessionStatus: 'lobby' })
        break

      case 'SESSION_STATE':
        set({
          session: msg.session,
          sessionStatus: msg.session?.status || null,
        })
        break

      case 'PLAYER_JOINED':
      case 'PLAYER_LEFT':
      case 'PLAYER_READY':
        if (msg.players) {
          set(s => ({
            session: s.session ? {
              ...s.session,
              players: Object.fromEntries(msg.players.map(p => [p.deviceId, p]))
            } : s.session
          }))
        }
        if (msg.campaign) {
          get().onCampaignUpdate?.(msg.campaign)
        }
        break

      case 'RESOLVE_AND_BROADCAST_STORYBOARD':
        get().onResolveBroadcastStoryboard?.(msg)
        break

      case 'TAKE_ITEM_REQUEST':
        get().onTakeItem?.(msg)
        break

      case 'UPDATE_CHARACTER_PORTRAIT':
        get().onUpdatePortrait?.(msg)
        break

      case 'PLAYER_USE_EFFECT':
        get().onPlayerUseEffect?.(msg)
        break

      case 'MOVE_APPLIED':
        if (msg.campaign) {
          get().onMoveApplied?.(msg.campaign)
        }
        break

      case 'CAMPAIGN_UPDATED':
        if (msg.campaign) {
          get().onCampaignUpdate?.(msg.campaign)
        }
        break

      case 'MOVE_REQUEST':
        set(s => ({
          moveRequests: [...s.moveRequests, {
            deviceId: msg.deviceId,
            playerName: msg.playerName,
            characterId: msg.characterId,
            tileKey: msg.tileKey,
            id: Math.random().toString(36).slice(2, 8),
          }]
        }))
        break

      case 'DICE_ROLL_BROADCAST':
        set(s => {
          const rolls = [msg.roll, ...s.diceRolls].slice(0, 20)
          return { diceRolls: rolls }
        })
        break

      case 'DICE_LOG_CLEARED':
        set({ diceRolls: [] })
        break

      case 'DICE_LOG_STATE':
        set({ diceRolls: msg.rolls || [] })
        break

      case 'SESSION_ENDED':
        set({ session: null, sessionStatus: null, moveRequests: [], diceRolls: [] })
        break
    }
  },

  dismissMoveRequest(id) {
    set(s => ({ moveRequests: s.moveRequests.filter(r => r.id !== id) }))
  },
}))