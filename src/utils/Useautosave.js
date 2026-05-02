import { useEffect, useRef, useState } from 'react'
import { saveCampaign } from './storage'

const INTERVAL_MS = 60 * 1000  // 1 minute

export default function useAutoSave(campaign) {
  const [lastSaved, setLastSaved] = useState(null)
  const [saving, setSaving] = useState(false)
  const campaignRef = useRef(campaign)
  campaignRef.current = campaign

  function save() {
    const c = campaignRef.current
    if (!c) return
    setSaving(true)
    try {
      saveCampaign(c)
      setLastSaved(new Date())
    } finally {
      setSaving(false)
    }
  }

  // Auto-save on interval
  useEffect(() => {
    if (!campaign) return
    const timer = setInterval(save, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [!!campaign]) // eslint-disable-line

  // Also save when campaign first loads
  useEffect(() => {
    if (campaign) save()
  }, [campaign?.id]) // eslint-disable-line

  return { lastSaved, saving, saveNow: save }
}