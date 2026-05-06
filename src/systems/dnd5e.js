/**
 * D&D 5th Edition game system definition.
 *
 * A game system defines every rules-specific concept that TileStories
 * needs to display, validate, and operate on campaign data. Swapping this
 * object out — or building a new one — is all that is required to run a
 * completely different TTRPG in the same tool.
 *
 * See docs/game-systems.md for the full field reference.
 */
export const DND5E = {
  id: 'dnd5e',
  name: 'D&D 5th Edition',
  description: 'Dungeons & Dragons 5th Edition ruleset.',

  // ── Actor types ───────────────────────────────────────────────
  // Replaces the old hardcoded 'player'/'npc'/'monster' and 'wild'/'pet'/'mount' etc.
  // isPlayer: true  → can be assigned to a player's session device.
  // showInRoster:   → whether this type shows in the main character roster sidebar.
  actorTypes: [
    { id: 'player',    label: 'Player Character', short: 'PC',   isPlayer: true,  icon: '🧙', showInRoster: true  },
    { id: 'npc',       label: 'NPC',              short: 'NPC',  isPlayer: false, icon: '👤', showInRoster: true  },
    { id: 'monster',   label: 'Monster',          short: 'MON',  isPlayer: false, icon: '👹', showInRoster: true  },
    { id: 'wild',      label: 'Wild Creature',    short: 'WILD', isPlayer: false, icon: '🐾', showInRoster: false },
    { id: 'pet',       label: 'Pet',              short: 'PET',  isPlayer: false, icon: '🐕', showInRoster: false },
    { id: 'mount',     label: 'Mount',            short: 'MNT',  isPlayer: false, icon: '🐴', showInRoster: false },
    { id: 'companion', label: 'Companion',        short: 'COMP', isPlayer: false, icon: '🤝', showInRoster: false },
    { id: 'enemy',     label: 'Enemy',            short: 'ENM',  isPlayer: false, icon: '⚔️', showInRoster: true  },
  ],

  // ── Stats ─────────────────────────────────────────────────────
  // Every numeric or text field an actor can have. The actor's `stats` object
  // is keyed by these IDs. Components use this list to know what to display.
  //
  // type:
  //   'attribute' — primary ability score (shown with modifier)
  //   'resource'  — has a current value tracked against a max
  //   'number'    — plain numeric field
  //   'text'      — free-form string (size category, CR string, etc.)
  //
  // actorTypes: if set, only show this stat for those actor type IDs.
  // group:       used to group fields in the character sheet UI.
  stats: [
    // Core ability scores
    { id: 'str',        label: 'Strength',        short: 'STR',  type: 'attribute', default: 10,       group: 'abilities' },
    { id: 'dex',        label: 'Dexterity',       short: 'DEX',  type: 'attribute', default: 10,       group: 'abilities' },
    { id: 'con',        label: 'Constitution',    short: 'CON',  type: 'attribute', default: 10,       group: 'abilities' },
    { id: 'int',        label: 'Intelligence',    short: 'INT',  type: 'attribute', default: 10,       group: 'abilities' },
    { id: 'wis',        label: 'Wisdom',          short: 'WIS',  type: 'attribute', default: 10,       group: 'abilities' },
    { id: 'cha',        label: 'Charisma',        short: 'CHA',  type: 'attribute', default: 10,       group: 'abilities' },
    // Combat stats
    { id: 'hp',         label: 'Hit Points',      short: 'HP',   type: 'resource',  default: 10, min: 0, group: 'combat' },
    { id: 'maxHp',      label: 'Max HP',          short: 'MAX',  type: 'number',    default: 10,       group: 'combat' },
    { id: 'ac',         label: 'Armor Class',     short: 'AC',   type: 'number',    default: 10,       group: 'combat' },
    { id: 'speed',      label: 'Speed',           short: 'SPD',  type: 'number',    default: 30,       group: 'combat' },
    { id: 'initiative', label: 'Initiative',      short: 'INIT', type: 'number',    default: 0,        group: 'combat' },
    // Creature-specific extras (only shown for non-PC types)
    { id: 'cr',   label: 'Challenge Rating', short: 'CR',   type: 'text',   default: '—',      group: 'creature',
      actorTypes: ['monster', 'wild', 'enemy'] },
    { id: 'size', label: 'Size',             short: 'SIZE', type: 'text',   default: 'medium', group: 'creature',
      actorTypes: ['monster', 'wild', 'enemy', 'pet', 'mount', 'companion'] },
  ],

  // Which stat IDs drive the core engine mechanics
  hpStat:        'hp',
  maxHpStat:     'maxHp',
  speedStat:     'speed',
  initiativeStat: 'initiative',

  // Stats available as saving throw targets in ability builders
  savingThrowStats: ['str', 'dex', 'con', 'int', 'wis', 'cha'],

  // ── Currencies ────────────────────────────────────────────────
  // baseConversion: value in gold pieces (gp = 1.0 reference).
  // Actors store currency as { gp: 0, sp: 0, ... } keyed by these IDs.
  currencies: [
    { id: 'pp', label: 'Platinum', shortLabel: 'PP', baseConversion: 10   },
    { id: 'gp', label: 'Gold',     shortLabel: 'GP', baseConversion: 1    },
    { id: 'ep', label: 'Electrum', shortLabel: 'EP', baseConversion: 0.5  },
    { id: 'sp', label: 'Silver',   shortLabel: 'SP', baseConversion: 0.1  },
    { id: 'cp', label: 'Copper',   shortLabel: 'CP', baseConversion: 0.01 },
  ],

  // ── Item categories ───────────────────────────────────────────
  itemCategories: {
    weapon:     { label: 'Weapon',     icon: '⚔️',  color: '#c25a4a' },
    armor:      { label: 'Armor',      icon: '🛡️',  color: '#5b9bd5' },
    consumable: { label: 'Consumable', icon: '🧪',  color: '#7bc47f' },
    tool:       { label: 'Tool',       icon: '🔧',  color: '#c8a96e' },
    key:        { label: 'Key',        icon: '🗝️',  color: '#9b7bc4' },
    quest:      { label: 'Quest',      icon: '📜',  color: '#c8a96e' },
    container:  { label: 'Container',  icon: '📦',  color: '#8a7060' },
    misc:       { label: 'Misc',       icon: '✨',  color: '#9a9790' },
  },

  // ── Item rarities ─────────────────────────────────────────────
  rarities: [
    { id: 'common',    label: 'Common',    color: '#9a9790' },
    { id: 'uncommon',  label: 'Uncommon',  color: '#7bc47f' },
    { id: 'rare',      label: 'Rare',      color: '#5b9bd5' },
    { id: 'very_rare', label: 'Very Rare', color: '#9b7bc4' },
    { id: 'legendary', label: 'Legendary', color: '#c8a96e' },
  ],

  // ── Damage types ──────────────────────────────────────────────
  damageTypes: [
    'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
    'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder', 'none',
  ],

  // ── Ability categories ────────────────────────────────────────
  abilityCategories: {
    attack:   { label: 'Attack',   color: '#c25a4a', icon: '⚔️' },
    defense:  { label: 'Defense',  color: '#5b9bd5', icon: '🛡️' },
    utility:  { label: 'Utility',  color: '#c8a96e', icon: '🔧' },
    passive:  { label: 'Passive',  color: '#7bc47f', icon: '✨' },
    reaction: { label: 'Reaction', color: '#9b7bc4', icon: '⚡' },
  },

  // ── Action costs ─────────────────────────────────────────────
  actionCosts: [
    { id: 'action',   label: 'Action' },
    { id: 'bonus',    label: 'Bonus Action' },
    { id: 'reaction', label: 'Reaction' },
    { id: 'free',     label: 'Free' },
    { id: 'passive',  label: 'Passive' },
  ],

  // ── Range types ───────────────────────────────────────────────
  rangeTypes: [
    { id: 'melee',  label: 'Melee' },
    { id: 'ranged', label: 'Ranged' },
    { id: 'self',   label: 'Self' },
    { id: 'touch',  label: 'Touch' },
    { id: 'aoe',    label: 'Area of Effect' },
  ],

  // ── Size categories (for creature stat blocks) ────────────────
  sizeCategories: [
    { id: 'tiny',        label: 'Tiny' },
    { id: 'small',       label: 'Small' },
    { id: 'medium',      label: 'Medium' },
    { id: 'large',       label: 'Large' },
    { id: 'huge',        label: 'Huge' },
    { id: 'gargantuan',  label: 'Gargantuan' },
  ],
}
