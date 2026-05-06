/**
 * Generic / custom game system definition.
 *
 * A minimal blank-slate system for campaigns that don't map to any
 * established ruleset. Organizers can rename any of these fields
 * through the campaign settings UI once it is built.
 *
 * See docs/game-systems.md for the full field reference.
 */
export const GENERIC = {
  id: 'generic',
  name: 'Generic / Custom',
  description: 'A blank-slate system. Rename and extend everything to fit your game.',

  actorTypes: [
    { id: 'hero',     label: 'Hero',     short: 'HERO', isPlayer: true,  icon: '⭐', showInRoster: true  },
    { id: 'ally',     label: 'Ally',     short: 'ALLY', isPlayer: false, icon: '🤝', showInRoster: true  },
    { id: 'neutral',  label: 'Neutral',  short: 'NTL',  isPlayer: false, icon: '👤', showInRoster: true  },
    { id: 'creature', label: 'Creature', short: 'CRE',  isPlayer: false, icon: '🐾', showInRoster: false },
    { id: 'villain',  label: 'Villain',  short: 'VIL',  isPlayer: false, icon: '💀', showInRoster: true  },
  ],

  stats: [
    { id: 'hp',    label: 'Health',  short: 'HP',  type: 'resource', default: 10, min: 0, group: 'core' },
    { id: 'maxHp', label: 'Max HP',  short: 'MAX', type: 'number',   default: 10,         group: 'core' },
    { id: 'def',   label: 'Defense', short: 'DEF', type: 'number',   default: 10,         group: 'core' },
    { id: 'move',  label: 'Move',    short: 'MOV', type: 'number',   default: 5,          group: 'core' },
    { id: 'init',  label: 'Initiative', short: 'INIT', type: 'number', default: 0,        group: 'core' },
  ],

  hpStat:        'hp',
  maxHpStat:     'maxHp',
  speedStat:     'move',
  initiativeStat: 'init',

  savingThrowStats: [],

  currencies: [
    { id: 'gold', label: 'Gold', shortLabel: 'G', baseConversion: 1 },
  ],

  itemCategories: {
    weapon:     { label: 'Weapon',     icon: '⚔️',  color: '#c25a4a' },
    armor:      { label: 'Armor',      icon: '🛡️',  color: '#5b9bd5' },
    consumable: { label: 'Consumable', icon: '🧪',  color: '#7bc47f' },
    quest:      { label: 'Quest',      icon: '📜',  color: '#c8a96e' },
    misc:       { label: 'Misc',       icon: '✨',  color: '#9a9790' },
  },

  rarities: [
    { id: 'common',    label: 'Common',    color: '#9a9790' },
    { id: 'uncommon',  label: 'Uncommon',  color: '#7bc47f' },
    { id: 'rare',      label: 'Rare',      color: '#5b9bd5' },
    { id: 'legendary', label: 'Legendary', color: '#c8a96e' },
  ],

  damageTypes: ['physical', 'magical', 'fire', 'cold', 'lightning', 'poison', 'none'],

  abilityCategories: {
    attack:  { label: 'Attack',  color: '#c25a4a', icon: '⚔️' },
    support: { label: 'Support', color: '#7bc47f', icon: '💚' },
    passive: { label: 'Passive', color: '#9a9790', icon: '✨' },
  },

  actionCosts: [
    { id: 'action',  label: 'Action' },
    { id: 'passive', label: 'Passive' },
  ],

  rangeTypes: [
    { id: 'melee',  label: 'Melee' },
    { id: 'ranged', label: 'Ranged' },
    { id: 'self',   label: 'Self' },
  ],

  sizeCategories: [
    { id: 'small',  label: 'Small' },
    { id: 'medium', label: 'Medium' },
    { id: 'large',  label: 'Large' },
  ],
}
