export const DICE_TYPES = {
  d4:  { sides: 4,  label: 'D4'  },
  d6:  { sides: 6,  label: 'D6'  },
  d8:  { sides: 8,  label: 'D8'  },
  d10: { sides: 10, label: 'D10' },
  d12: { sides: 12, label: 'D12' },
  d20: { sides: 20, label: 'D20' },
}

export function rollDice(diceType = 'd20') {
  const sides = DICE_TYPES[diceType]?.sides ?? 20
  return Math.floor(Math.random() * sides) + 1
}

// e.g. "2d6+3 fire" — used by AbilityLibrary
export function formatDamage(dice, type, bonus) {
  if (!dice) return ''
  let s = dice
  if (bonus > 0) s += `+${bonus}`
  else if (bonus < 0) s += `${bonus}`
  if (type && type !== 'none') s += ` ${type}`
  return s
}

// Validates strings like "2d6", "1d20", "d4"
export function isValidDice(val) {
  return /^\d*d\d+$/i.test((val || '').trim())
}

// Validates dice expressions with optional bonus, e.g. "2d6", "1d8+3", "d4-1"
export function isValidDiceExpr(val) {
  return /^\d*d\d+([+-]\d+)?$/i.test((val || '').trim())
}

// Rolls a dice expression like "2d6", "1d8+3", "d4"
export function rollDiceExpr(expr) {
  const match = /^(\d*)d(\d+)([+-]\d+)?$/i.exec((expr || '').trim())
  if (!match) return 0
  const count = parseInt(match[1] || '1')
  const sides = parseInt(match[2])
  const bonus = parseInt(match[3] || '0')
  let total = bonus
  for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1
  return total
}
