import React, { useState, useEffect, useRef } from 'react'
import styles from './AoePatternEditor.module.css'

const GRID_SIZE = 5
const CENTER = Math.floor(GRID_SIZE / 2) // 2

function toDelta(col, row, rootCol, rootRow) {
  return { dq: col - rootCol, dr: row - rootRow }
}

export default function AoePatternEditor({ value, onChange, tileStyle = 'hex', onClose }) {
  const [rootPos, setRootPos] = useState({ col: CENTER, row: CENTER })
  const [selected, setSelected] = useState(new Set())
  const [mode, setMode] = useState('draw') // 'draw' | 'move-root'
  const popoverRef = useRef(null)

  // Initialise from value prop
  useEffect(() => {
    const newSelected = new Set()
    value.forEach(({ dq, dr }) => {
      const col = CENTER + dq
      const row = CENTER + dr
      if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
        newSelected.add(`${col},${row}`)
      }
    })
    setSelected(newSelected)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  function handleCellClick(col, row) {
    if (mode === 'move-root') {
      if (col === rootPos.col && row === rootPos.row) { setMode('draw'); return }
      const newSelected = new Set()
      selected.forEach(key => {
        const [sc, sr] = key.split(',').map(Number)
        const nc = col + (sc - rootPos.col)
        const nr = row + (sr - rootPos.row)
        if (nc >= 0 && nc < GRID_SIZE && nr >= 0 && nr < GRID_SIZE) {
          newSelected.add(`${nc},${nr}`)
        }
      })
      setRootPos({ col, row })
      setSelected(newSelected)
      setMode('draw')
      return
    }
    // draw mode: can't toggle root itself
    if (col === rootPos.col && row === rootPos.row) return
    const key = `${col},${row}`
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
  }

  function handleConfirm() {
    const pattern = []
    selected.forEach(key => {
      const [col, row] = key.split(',').map(Number)
      const delta = toDelta(col, row, rootPos.col, rootPos.row)
      if (delta.dq !== 0 || delta.dr !== 0) pattern.push(delta)
    })
    onChange(pattern)
    onClose()
  }

  const isHex = tileStyle === 'hex'
  const selectedCount = selected.size

  return (
    <div className={styles.overlay}>
      <div ref={popoverRef} className={styles.popover}>

        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>AoE Pattern Editor</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Mode bar */}
        <div className={styles.modeBar}>
          <button
            className={`${styles.modeBtn} ${mode === 'draw' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('draw')}
          >
            ✏️ Draw tiles
          </button>
          <button
            className={`${styles.modeBtn} ${mode === 'move-root' ? styles.modeBtnActive : styles.modeBtnRoot}`}
            onClick={() => setMode(m => m === 'move-root' ? 'draw' : 'move-root')}
          >
            ★ Move origin
          </button>
          <button className={styles.clearBtn} onClick={() => setSelected(new Set())}>Clear</button>
        </div>

        {/* Mode instruction */}
        <div className={styles.modeHint}>
          {mode === 'draw'
            ? <>Click cells to toggle them in/out of the AoE pattern. The <strong>★ origin</strong> is where you click on the map.</>
            : <span className={styles.moveHint}>Click any cell to move the ★ origin there. Selected cells will shift to stay relative.</span>
          }
        </div>

        {/* Grid */}
        <div className={`${styles.grid} ${isHex ? styles.gridHex : styles.gridSquare}`}>
          {Array.from({ length: GRID_SIZE }, (_, row) =>
            Array.from({ length: GRID_SIZE }, (_, col) => {
              const key = `${col},${row}`
              const isRoot = col === rootPos.col && row === rootPos.row
              const isSelected = selected.has(key)
              const dq = col - rootPos.col
              const dr = row - rootPos.row
              return (
                <button
                  key={key}
                  className={[
                    styles.cell,
                    isHex ? styles.cellHex : styles.cellSquare,
                    isRoot ? styles.cellRoot : '',
                    isSelected && !isRoot ? styles.cellSelected : '',
                    mode === 'move-root' && !isRoot ? styles.cellMoveable : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleCellClick(col, row)}
                  title={isRoot ? 'Origin (root)' : `Offset: ${dq > 0 ? '+' : ''}${dq}, ${dr > 0 ? '+' : ''}${dr}`}
                >
                  {isRoot ? <span className={styles.rootStar}>★</span> : isSelected ? <span className={styles.selectedDot}>●</span> : null}
                </button>
              )
            })
          )}
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          <span className={styles.statRoot}>★ Origin</span>
          <span className={styles.statSelected}>● {selectedCount} cell{selectedCount !== 1 ? 's' : ''} selected</span>
          <span className={styles.statTotal}>= {selectedCount + 1} total tiles</span>
        </div>

        {/* Confirm */}
        <button className={styles.confirmBtn} onClick={handleConfirm}>
          Apply Pattern
        </button>
      </div>
    </div>
  )
}
