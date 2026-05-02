import React from 'react'

export default function SaveStatus({ lastSaved, saving }) {
  function fmtTime(d) {
    if (!d) return null
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{
      fontSize: 11,
      color: 'var(--text-muted)',
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '0 12px',
      borderLeft: '0.5px solid var(--border)',
      height: '100%',
      whiteSpace: 'nowrap',
    }}>
      {saving ? (
        <><span style={{ color: 'var(--accent)' }}>●</span> Saving…</>
      ) : lastSaved ? (
        <><span style={{ color: 'var(--success)' }}>●</span> Saved {fmtTime(lastSaved)}</>
      ) : null}
    </div>
  )
}