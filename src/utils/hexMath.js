// Flat-top hex grid using "even-q" offset coordinates
// q = column (left→right), r = row (top→bottom)
// Even columns are NOT shifted; odd columns shift down by half a hex height.
// This produces a rectangular grid with no diagonal shear.

export const HEX_SIZE = 40 // circumradius in px

const SQRT3 = Math.sqrt(3)

// Offset coords (q, r) → pixel center, flat-top even-q
export function hexToPixel(q, r, size = HEX_SIZE) {
  const x = size * 1.5 * q
  const y = size * SQRT3 * (r + (q % 2 === 0 ? 0 : 0.5))
  return { x, y }
}

// Pixel → nearest offset hex (flat-top even-q)
export function pixelToHex(px, py, size = HEX_SIZE) {
  // Convert pixel to fractional axial first, then to offset
  const q_frac = (2 / 3) * px / size
  const q = Math.round(q_frac)

  // Adjust py for the column offset before computing r
  const offset = (q % 2 === 0) ? 0 : 0.5
  const r = Math.round(py / (size * SQRT3) - offset)

  // Find the true nearest hex by checking q and its neighbours
  const candidates = [
    { q, r },
    { q: q - 1, r: r - (((q - 1) % 2 === 0) ? 0 : 0) },
    { q: q - 1, r: r + (((q - 1) % 2 === 0) ? 0 : 0) },
    { q: q + 1, r: r - (((q + 1) % 2 === 0) ? 0 : 0) },
    { q: q + 1, r: r + (((q + 1) % 2 === 0) ? 0 : 0) },
  ]

  let best = { q, r }
  let bestDist = Infinity
  for (const c of candidates) {
    const cp = hexToPixel(c.q, c.r, size)
    const d = (cp.x - px) ** 2 + (cp.y - py) ** 2
    if (d < bestDist) { bestDist = d; best = c }
  }
  return best
}

// 6 corner points of a flat-top hex centered at (cx, cy)
export function hexCorners(cx, cy, size = HEX_SIZE) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) })
  }
  return pts
}

// Unique string key for a tile
export function tileKey(q, r) { return `${q},${r}` }

// Parse a tile key back to coords
export function parseKey(key) {
  const [q, r] = key.split(',').map(Number)
  return { q, r }
}

// Bounding box (world coords) of a cols×rows offset grid
export function gridBounds(cols, rows, size = HEX_SIZE) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let q = 0; q < cols; q++) {
    for (let r = 0; r < rows; r++) {
      const { x, y } = hexToPixel(q, r, size)
      minX = Math.min(minX, x - size)
      minY = Math.min(minY, y - size * SQRT3 / 2)
      maxX = Math.max(maxX, x + size)
      maxY = Math.max(maxY, y + size * SQRT3 / 2)
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

// Axial distance (works approximately for offset coords)
export function hexDistance(a, b) {
  // Convert offset to axial for distance calc
  function toAxial(q, r) {
    return { q, r: r - (q - (q & 1)) / 2 }
  }
  const a2 = toAxial(a.q, a.r)
  const b2 = toAxial(b.q, b.r)
  return (Math.abs(a2.q - b2.q) + Math.abs(a2.q + a2.r - b2.q - b2.r) + Math.abs(a2.r - b2.r)) / 2
}

// ── Square grid math ──────────────────────────────────────────
export const SQUARE_SIZE = 60 // side length in px

export function squareToPixel(q, r, size = SQUARE_SIZE) {
  return { x: (q + 0.5) * size, y: (r + 0.5) * size }
}

export function pixelToSquare(px, py, size = SQUARE_SIZE) {
  return { q: Math.floor(px / size), r: Math.floor(py / size) }
}

export function squareCorners(cx, cy, sz = SQUARE_SIZE) {
  const h = sz / 2
  return [
    { x: cx - h, y: cy - h },
    { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h },
    { x: cx - h, y: cy + h },
  ]
}

export function squareGridBounds(cols, rows, size = SQUARE_SIZE) {
  return { minX: 0, minY: 0, maxX: cols * size, maxY: rows * size, width: cols * size, height: rows * size }
}

export function squareDistance(a, b) {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r))
}

// ── Neighbours ────────────────────────────────────────────────
// 6 neighbours in offset coords (flat-top even-q)
export function hexNeighbours(q, r) {
  const even = q % 2 === 0
  return [
    { q: q + 1, r: even ? r : r + 1 },
    { q: q + 1, r: even ? r - 1 : r },
    { q: q,     r: r - 1 },
    { q: q - 1, r: even ? r - 1 : r },
    { q: q - 1, r: even ? r : r + 1 },
    { q: q,     r: r + 1 },
  ]
}