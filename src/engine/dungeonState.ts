import type { DungeonTypeKey, SegmentType } from "../data/dungeonTypes.ts";
import type { MonsterAbility, MonsterTemplate, RoomContentEntry } from "../data/dungeonTables.ts";

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
  combat: CombatState | null;
  /** The active character's name -- used only to label remains left behind if they die. */
  characterName: string;
  /** The active character's weapon damage formula (e.g. "1d6+1"), rolled on each PLAYER_ATTACK. */
  weaponFormula: string;
  /** Remaining uses per spell, keyed by its 1d6 Basic Spells table roll. Depleted uses are gone until Rest (not yet built). */
  spellUses: Record<number, number>;
  /** false once the character has died; deathCause distinguishes the Darkness from a lost fight. */
  alive: boolean;
  deathCause: "darkness" | "combat" | null;
}

/** A dungeon left unbeaten (by death or by voluntarily leaving) -- resumable by a later character. */
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
    maxHp: startingHp,
    coins: 0,
    treasures: 0,
    keys: 0,
    heldItems: [],
    combat: null,
    characterName,
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
  | { type: "PLAYER_ATTACK"; targetId: number; roll: number }
  | { type: "CAST_SPELL"; spellRoll: number; targetId?: number }
  | {
      type: "RESUME_DUNGEON";
      dungeon: DungeonState;
      torches: number;
      hp: number;
      weaponFormula: string;
      spellUses: Record<number, number>;
      characterName: string;
    }
  | { type: "RESET" };
