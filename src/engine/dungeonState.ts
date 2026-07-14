import type { DungeonTypeKey, SegmentType } from "../data/dungeonTypes.ts";
import type { ArmorPieceKind, ItemEffect, MonsterAbility, MonsterTemplate, RoomContentEntry } from "../data/dungeonTables.ts";

export type Direction = "N" | "E" | "S" | "W";

export interface DoorState {
  dir: Direction;
  opened: boolean;
  childId: number | null;
  leadsToLevel: number | null;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface SegmentState extends Box {
  id: number;
  type: SegmentType;
  cameFromDir: Direction | null;
  flavor: string | null;
  doors: DoorState[];
  /** True only for the single segment created by ROLL_DUNGEON -- see classifyDoorOpen. */
  isEntrance: boolean;
  roomContent?: RoomContentEntry;
  monsters?: MonsterTemplate;
  monstersDefeated?: boolean;
  /** Set on empty rooms when RETURN_TO_DUNGEON/RESUME_DUNGEON restores a persisted map -- per the
   * rulebook, resting in town (or a new character taking over) means fresh monsters may have moved
   * into any room that's currently empty, re-rolled the next time the player actually looks at it
   * (SELECT_SEGMENT), not eagerly for the whole map at once -- this app has only one combat slot,
   * so eagerly rolling every empty room could produce several "occupied" rooms with no way to fight
   * more than one at a time. */
  needsMonsterReroll?: boolean;
  secretPassageSearched?: boolean;
  secretPassageResult?: string | null;
  trapResult?: string | null;
  chestOpened?: boolean;
  chestResult?: string | null;
  /** "His backpack and clothes on the floor" -- coins/Treasures/Keys left by a character who died here. */
  remains?: FallenAdventurer | null;
}

export interface FallenAdventurer {
  names: string[];
  coins: number;
  treasures: number;
  keys: number;
  heldItems: HeldItem[];
  armor: ArmorPiece[];
  weapon: EquippedWeapon | null;
}

/** A worn armor piece -- either one of the 5 named pieces (rolled on the Armor table) or a
 * `"wonderItem"` (a bespoke Wonder that's itself a protective item, e.g. "Jester Hat (2 HP)"). */
export interface ArmorPiece {
  piece: ArmorPieceKind;
  hp: number;
  maxHp: number;
  /** The specific item's name (e.g. "Centurion's [Armor]"), if this came from a named Magic Item
   * or Wonder -- shown in the Equipment UI in place of the generic ArmorPieceKind label. */
  itemName?: string;
  /** The named item's standing ability (e.g. Leprechaun's Armor's doubleChestCoins), if any --
   * checked by whichever system it affects (combat, chests, traps) for as long as it's equipped. */
  effect?: ItemEffect;
}

/** A weapon found in a dungeon, overriding the character's class weapon while carried. */
export interface EquippedWeapon {
  name: string;
  formula: string;
  twoHanded?: boolean;
  /** From a Magic Item's bonus (e.g. "[Weapon] of Destruction: Deals +2 damage"), if any. */
  bonusEffect?: ItemEffect;
}

export interface ConnectorState {
  x: number;
  y: number;
  w: number;
  h: number;
  horiz: boolean;
}

export interface LevelState {
  depth: number;
  segments: SegmentState[];
  connectors: ConnectorState[];
  doorsRemaining: number;
  hasStaircase: boolean;
  isFinalRoomLevel: boolean;
  finalRoomPlaced: boolean;
  stairwayTarget: number | null;
}

export interface DungeonStats {
  segments: number;
  corridors: number;
  rooms: number;
  staircases: number;
  doorsRemaining: number;
  finalRooms: number;
}

export interface LogEntryState {
  id: number;
  message: string;
  variant: "normal" | "descend";
}

export interface CombatMonsterState {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  abilities: MonsterAbility[];
  /** Bonus damage queued onto this monster's next attack by Firebreath or Sorcery. */
  bonusDamage: number;
  /** Deathtouch: this monster's next attack kills the player outright. */
  deathtouchPending: boolean;
  /** Paralyze: this monster's next attack freezes the player for this many turns (0 = none queued). */
  paralyzePending: number;
  /** Cold Ray: this monster is frozen and skips its next counter-attack entirely. */
  skipNextAttack: boolean;
}

export interface CombatState {
  segId: number;
  monsters: CombatMonsterState[];
  /** Turns the player must skip from a Paralyze effect (each PLAYER_ATTACK dispatch resolves one full round). */
  paralyzedTurns: number;
  /** How many defeated monsters still owe a Loot roll, resolved when the fight ends in victory. */
  pendingLootRolls: number;
  /** True for the Final Room's Dungeon Boss fight -- victory grants 2d6 Treasures instead of normal Loot. */
  isBoss: boolean;
  outcome: "ongoing" | "victory" | "defeat";
  /** Set instead of applying a monster counter-attack's damage immediately, whenever the player has
   * at least one usable (hp > 0) armor piece -- "reduce this value from your HP (or armor's HP...
   * your call)" per the rulebook. Cleared by RESOLVE_DAMAGE, which applies it to whichever pool the
   * player chose. Null (not 0) when there's nothing pending, so a real 0-damage hit can't be confused
   * with "no hit happened." */
  pendingDamage: number | null;
  /** From a Wonder's `combatDamageBonus` effect (e.g. Potion of Fury: "+2 until the end of the
   * fight") -- added to the player's weapon damage roll each round of *this* fight, then discarded
   * when combat ends (not persisted onto the character outside combat). */
  playerDamageBonus: number;
  /** Slimemen only: bumped by `handleMonsterDefeat` for every monster actually removed (killed, not
   * revived) this fight -- each one is a "body" ENGULF_BODY can consume for a full heal. */
  engulfableBodies: number;
}

/** A "worth N Coins in the town" item found by opening a Treasure -- held until there's a town to sell it in. */
export interface HeldItem {
  name: string;
  worth: number;
}

export interface DungeonState {
  dungeonTypeKey: DungeonTypeKey | null;
  dungeonName: string | null;
  entranceFlavor: string | null;
  levels: LevelState[];
  activeLevel: number;
  nextSegmentId: number;
  nextLogId: number;
  nextMonsterId: number;
  selectedSegId: number | null;
  stats: DungeonStats;
  log: LogEntryState[];
  torches: number;
  hp: number;
  maxHp: number;
  coins: number;
  /** From Loot rolls and Chests -- currently just a counter, no economy or town to spend them in yet. */
  treasures: number;
  /** From Loot rolls -- currently just a counter; doesn't yet let you skip a door's lock roll. */
  keys: number;
  /** Coin-valued items found by opening Treasures, held until there's a town to sell them in. */
  heldItems: HeldItem[];
  /** Worn armor pieces (max one of each ArmorPieceKind per the rulebook's "can't use more than one
   * identical piece"), each an independent HP pool the player may choose to absorb damage with. */
  armor: ArmorPiece[];
  /** An acquired weapon overriding the character's class weapon; null falls back to it. */
  weapon: EquippedWeapon | null;
  combat: CombatState | null;
  /** Ordinary monsters and Bosses defeated this run -- character-specific, like torches/hp, not
   * map/exploration state, so a new adventurer via RESUME_DUNGEON starts back at 0 even though
   * they're exploring the same map (see CLAUDE.md's Resuming section). Shown on the Graveyard. */
  monsterKills: number;
  bossKills: number;
  /** The active character's name -- used only to label remains left behind if they die. */
  characterName: string;
  /** The active character's race/class names (e.g. "Dwarf", "Grave Digger") -- matched by exact
   * string against `RaceDef.name`/`ClassDef.name`, the same "no formal taxonomy" pattern the
   * Armor & Weapons system already uses for monster-tag matching. Drives every race/class ability
   * that needs reducer-level logic (see CLAUDE.md's "Race and class abilities" section); abilities
   * resolvable entirely in a UI component instead read `character.race`/`character.cls` directly. */
  raceName: string;
  className: string;
  /** The active character's weapon damage formula (e.g. "1d6+1"), rolled on each PLAYER_ATTACK. */
  weaponFormula: string;
  /** Remaining uses per spell, keyed by its 1d6 Basic Spells table roll. Depleted uses are gone until Rest (not yet built). */
  spellUses: Record<number, number>;
  /** false once the character has died; deathCause distinguishes the Darkness from a lost fight. */
  alive: boolean;
  deathCause: "darkness" | "combat" | null;
}

/** A dungeon a character has explored, whether they died, retreated, or beat it -- unbeaten ones
 * are resumable by a later character; beaten ones are kept only as a historical record (Town's
 * dungeon list, styled like the Graveyard) since `isDungeonBeaten()` marks them done. */
export interface PendingDungeon {
  id: string;
  dungeon: DungeonState;
  /** The most recent character to explore it, for display flavor only. */
  lastCharacterName: string;
}

/** True once the Final Room's Boss has been defeated -- the dungeon is complete, nothing left to resume. */
export function isDungeonBeaten(state: DungeonState): boolean {
  return state.levels.some(
    (lvl) => lvl.isFinalRoomLevel && lvl.segments[0]?.type === "final" && lvl.segments[0]?.monstersDefeated === true,
  );
}

export function makeLevel(depth: number): LevelState {
  return {
    depth,
    segments: [],
    connectors: [],
    doorsRemaining: 0,
    hasStaircase: false,
    isFinalRoomLevel: false,
    finalRoomPlaced: false,
    stairwayTarget: null,
  };
}

export function createInitialDungeonState(
  startingTorches = 10,
  startingHp = 20,
  weaponFormula = "1d6",
  spellUses: Record<number, number> = {},
  characterName = "",
  coins = 0,
  treasures = 0,
  keys = 0,
  heldItems: HeldItem[] = [],
  /** Defaults to startingHp -- a brand new character always starts at full health, but a
   * returning one may not (see RESUME_DUNGEON/RETURN_TO_DUNGEON, which pass this explicitly
   * so a character who retreated at less than full HP doesn't have their max HP clamped down
   * to whatever they currently have). */
  maxHp: number = startingHp,
  armor: ArmorPiece[] = [],
  weapon: EquippedWeapon | null = null,
  monsterKills = 0,
  bossKills = 0,
  raceName = "",
  className = "",
): DungeonState {
  return {
    dungeonTypeKey: null,
    dungeonName: null,
    entranceFlavor: null,
    levels: [],
    activeLevel: 0,
    nextSegmentId: 1,
    nextLogId: 1,
    nextMonsterId: 1,
    selectedSegId: null,
    stats: { segments: 0, corridors: 0, rooms: 0, staircases: 0, doorsRemaining: 0, finalRooms: 0 },
    log: [],
    torches: startingTorches,
    hp: startingHp,
    maxHp,
    coins,
    treasures,
    keys,
    heldItems,
    armor,
    weapon,
    combat: null,
    monsterKills,
    bossKills,
    characterName,
    raceName,
    className,
    weaponFormula,
    spellUses,
    alive: true,
    deathCause: null,
  };
}

export type LockChoice = "pickLock" | "breakDoor";

export type DungeonAction =
  | { type: "ROLL_DUNGEON"; typeRoll: number; secondRoll: number; thirdRoll: number }
  | {
      type: "RESOLVE_DOOR_LOCK";
      segId: number;
      doorIdx: number;
      doorRoll: number;
      trapRoll: number | null;
      lockChoice: LockChoice | null;
    }
  | { type: "OPEN_DOOR"; segId: number; doorIdx: number; roll: number | null; wasNoisy: boolean }
  | { type: "SWITCH_LEVEL"; levelIndex: number }
  | { type: "SELECT_SEGMENT"; segId: number | null }
  | { type: "ROLL_SECRET_PASSAGE"; segId: number; roll: number; trapRoll: number | null }
  | { type: "ROLL_CHEST"; segId: number; dice: [number, number]; trapRoll: number | null }
  | { type: "COLLECT_REMAINS"; segId: number }
  | { type: "OPEN_TREASURE"; roll: number; maxSpellUses: Record<number, number> }
  /** `useHorn`: Rinoceroid's "You can attack with your horn (Damage 1d6)" -- a flat 1d6, no
   * weapon modifier, ignoring whatever's equipped, for this one attack. */
  | { type: "PLAYER_ATTACK"; targetId: number; roll: number; useHorn?: boolean }
  /** Slimemen's "If you engulf the body of an enemy, you regain all HP" -- consumes one body from
   * `CombatState.engulfableBodies` (set by `handleMonsterDefeat` whenever a monster is actually
   * removed, not revived) and heals to full, same as a full round (the monsters still counter-attack). */
  | { type: "ENGULF_BODY" }
  | { type: "CAST_SPELL"; spellRoll: number; targetId?: number }
  /** Resolves a CombatState.pendingDamage from a monster counter-attack: onto the player's HP, or
   * onto one of `armor`'s indices ("your call" per the rulebook). */
  | { type: "RESOLVE_DAMAGE"; absorbWith: "hp" | number }
  | {
      type: "RESUME_DUNGEON";
      dungeon: DungeonState;
      torches: number;
      hp: number;
      maxHp: number;
      weaponFormula: string;
      spellUses: Record<number, number>;
      characterName: string;
      raceName: string;
      className: string;
    }
  | {
      /** The same still-living character coming back from a Town visit -- unlike RESUME_DUNGEON
       * (a new character taking over a dead one's map), every resource carries over exactly. */
      type: "RETURN_TO_DUNGEON";
      dungeon: DungeonState;
      torches: number;
      hp: number;
      maxHp: number;
      coins: number;
      treasures: number;
      keys: number;
      heldItems: HeldItem[];
      armor: ArmorPiece[];
      weapon: EquippedWeapon | null;
      weaponFormula: string;
      spellUses: Record<number, number>;
      characterName: string;
      raceName: string;
      className: string;
      monsterKills: number;
      bossKills: number;
    }
  | { type: "RESET" };
