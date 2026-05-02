// Hook to resolve an image hash (or raw dataUrl) to a displayable src
import { useState, useEffect } from 'react'
import { loadImage } from './imageStorage'

export function useImage(hashOrDataUrl) {
  const [src, setSrc] = useState(
    // If it's already a raw dataUrl (legacy or not yet stored), use directly
    typeof hashOrDataUrl === 'string' && hashOrDataUrl.startsWith('data:')
      ? hashOrDataUrl
      : null
  )

  useEffect(() => {
    if (!hashOrDataUrl) { setSrc(null); return }
    if (hashOrDataUrl.startsWith('data:')) { setSrc(hashOrDataUrl); return }
    // It's a hash — load from IndexedDB
    loadImage(hashOrDataUrl).then(data => setSrc(data || null))
  }, [hashOrDataUrl])

  return src
}