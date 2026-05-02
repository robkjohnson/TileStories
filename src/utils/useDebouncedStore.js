// A hook for text inputs that need to write to a Zustand store.
// Local state updates instantly (smooth typing), store updates on blur
// or after a debounce — preventing re-renders from killing focus.

import { useState, useEffect, useRef, useCallback } from 'react'

export function useDebouncedField(storeValue, onUpdate, debounceMs = 600) {
  const [local, setLocal] = useState(storeValue ?? '')
  const timer = useRef(null)
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  // Sync inbound store changes (e.g. another client updated, or initial load)
  // but DON'T override if the user is actively typing
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setLocal(storeValue ?? '')
  }, [storeValue])

  function handleChange(e) {
    const val = e.target.value
    setLocal(val)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onUpdateRef.current(val), debounceMs)
  }

  function handleBlur(e) {
    focused.current = false
    if (timer.current) clearTimeout(timer.current)
    onUpdateRef.current(e.target.value)
  }

  function handleFocus() { focused.current = true }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { value: local, onChange: handleChange, onBlur: handleBlur, onFocus: handleFocus }
}