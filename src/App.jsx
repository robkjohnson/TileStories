import React, { useState, useEffect } from 'react'
import { useStore } from './store/useStore'
import HexGrid from './components/HexGrid/HexGrid'
import ZoomControls from './components/HexGrid/ZoomControls'
import Toolbar from './components/Toolbar/Toolbar'
import MapTabs from './components/MapTabs/MapTabs'
import NewCampaignModal from './components/Modal/NewCampaignModal'
import OverlayBar from './components/EventEditor/OverlayBar'
import EffectExecutor from './components/EffectSystem/EffectExecutor'
import MenuScreen from './components/CampaignLibrary/MenuScreen'
import SaveStatus from './components/CampaignLibrary/SaveStatus'
import useAutoSave from './utils/useAutoSave'
import useGameSocket from './utils/useGameSocket'
import useSessionSync from './utils/useSessionSync'
import { useSessionStore } from './store/useSessionStore'
import LeftSidebar from './components/OrganizerUI/LeftSidebar'
import RightSidebar from './components/OrganizerUI/RightSidebar'
import { LeftResizableSidebar, RightResizableSidebar } from './components/OrganizerUI/ResizableSidebar'
import styles from './App.module.css'

export default function App() {
  const { campaign, setCampaign } = useStore()
  const [showMenu, setShowMenu] = useState(!campaign)
  const [showNewModal, setShowNewModal] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const { lastSaved, saving, saveNow } = useAutoSave(campaign)

  const { session, setConnected, handleMessage, setOnCampaignUpdate, setOnMoveApplied, setOnResolveBroadcastStoryboard, setOnTakeItem, setOnUpdatePortrait, setOnPlayerUseEffect } = useSessionStore()
  const { send: sessionSend } = useGameSocket((msg) => {
    if (msg.type === 'CONNECTED') setConnected(true)
    handleMessage(msg)
  })

  // Expose send globally so SessionControls (deep in sidebar) can use it
  // without prop-drilling through 4 levels
  useEffect(() => { window.__tilestoriesSend = sessionSend }, [sessionSend])

  const { markSynced } = useSessionSync(campaign, session, sessionSend)

  useEffect(() => {
    setOnCampaignUpdate((updated) => {
      if (updated) {
        markSynced(updated)
        setCampaign(updated)
      }
    })
    return () => setOnCampaignUpdate(null)
  }, [setOnCampaignUpdate, setCampaign, markSynced])

  // RESOLVE_AND_BROADCAST_STORYBOARD: organizer resolves images and sends to player/display
  useEffect(() => {
    setOnResolveBroadcastStoryboard(async (msg) => {
      const sb = campaign?.storyboards?.[msg.storyboardId]
      if (!sb || !sessionSend) return
      const { resolveStoryboardImages } = await import('./utils/imageStorage')
      const resolved = await resolveStoryboardImages(sb)
      const target = msg.storyboardTarget || 'player'
      if (target === 'display' || target === 'both') {
        sessionSend({ type: 'SHOW_STORYBOARD', storyboard: resolved })
      }
      if (target === 'player' || target === 'both') {
        sessionSend({ type: 'SHOW_STORYBOARD_TO_PLAYER', storyboard: resolved, tileKey: msg.tileKey, deviceId: msg.triggeringPlayerDeviceId })
      }
    })
    return () => setOnResolveBroadcastStoryboard(null)
  }, [setOnResolveBroadcastStoryboard, campaign, sessionSend])

  useEffect(() => {
    setOnMoveApplied((updated) => {
      if (updated) {
        markSynced(updated)
        setCampaign(updated)
      }
    })
    return () => setOnMoveApplied(null)
  }, [setOnMoveApplied, setCampaign, markSynced])

  useEffect(() => {
    setOnTakeItem((msg) => {
      const state = useStore.getState()
      const container = state.campaign?.containers?.[msg.containerId]
      if (!container) return
      const item = container.items?.find(i => i.id === msg.itemId)
      if (!item) return
      state.updateContainer(msg.containerId, { items: container.items.filter(i => i.id !== msg.itemId) })
      const char = state.campaign?.actors?.[msg.characterId]
      if (char) {
        const inv = [...(char.inventory || []), { ...item, id: Math.random().toString(36).slice(2, 9) }]
        state.updateCharacter(msg.characterId, { inventory: inv })
      }
    })
    return () => setOnTakeItem(null)
  }, [setOnTakeItem])

  useEffect(() => {
    setOnUpdatePortrait((msg) => {
      useStore.getState().updateCharacter(msg.characterId, { portrait: msg.portrait })
    })
    return () => setOnUpdatePortrait(null)
  }, [setOnUpdatePortrait])

  useEffect(() => {
    setOnPlayerUseEffect((msg) => {
      useStore.getState().executeEffectFromPlayer(msg)
    })
    return () => setOnPlayerUseEffect(null)
  }, [setOnPlayerUseEffect])

  function handleCreate(campaignData) {
    setCampaign(campaignData)
    setShowMenu(false)
    setShowNewModal(false)
  }

  return (
    <div className={styles.app}>

      {/* Toolbar */}
      <Toolbar
        onNewCampaign={() => setShowNewModal(true)}
        onSave={saveNow}
        extraRight={<SaveStatus lastSaved={lastSaved} saving={saving} />}
      />

      {campaign && <MapTabs />}

      {/* Main workspace */}
      <div className={styles.workspace}>
        {/* Left sidebar */}
        <LeftResizableSidebar
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed(c => !c)}>
          <LeftSidebar collapsed={leftCollapsed} />
        </LeftResizableSidebar>

        {/* Map area */}
        <div className={styles.mapArea}>
          {campaign
            ? <HexGrid />
            : (
              <div className={styles.emptyMap}>
                <div className={styles.emptyHex}>⬡</div>
                <p>No campaign loaded</p>
                <button className={styles.emptyBtn} onClick={() => setShowMenu(true)}>
                  Open campaign library
                </button>
              </div>
            )
          }
          {campaign && <ZoomControls />}
          {campaign && <OverlayBar />}
          {campaign && <EffectExecutor />}
        </div>

        {/* Right sidebar */}
        {campaign && (
          <RightResizableSidebar
            collapsed={rightCollapsed}
            onToggleCollapse={() => setRightCollapsed(c => !c)}>
            <RightSidebar collapsed={rightCollapsed} />
          </RightResizableSidebar>
        )}
      </div>

      {/* Full-screen overlays */}
      {showMenu && (
        <MenuScreen
          onLoad={(data) => { setCampaign(data); setShowMenu(false) }}
          onNew={() => { setShowMenu(false); setShowNewModal(true) }}
        />
      )}

      <NewCampaignModal
        show={showNewModal}
        onCreate={handleCreate}
        onClose={() => { setShowNewModal(false); if (!campaign) setShowMenu(true) }}
      />
    </div>
  )
}