import type { DungeonTypeKey, SegmentType } from "../data/dungeonTypes.ts";
import type {
  ArmorPieceKind,
  ItemEffect,
  MonsterAbility,
  MonsterTemplate,
  RoomContentEntry,
} from "../data/dungeonTables.ts";
import type { BuildingKind, SpellTableKey } from "../data/types.ts";
import { createInitialMilestones, type AdvancedClassMilestones } from "./town.ts";

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
  /** Move Silently succeeded: the monsters here are undefeated but never noticed the character, so
   * this segment no longer blocks further actions -- until a noisy action (breaking a door, a fired
   * trap) inside it wakes them, which clears this flag and starts combat with them attacking first. */
  sneakedPast?: boolean;
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
  /** Unwielded weapons the fallen character was carrying -- see DungeonState.spareWeapons. */
  weapons: EquippedWeapon[];
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
  /** Vimes/Paralyze (New Spells, issue #61): this monster skips its attack for this many more
   * rounds (0 = none active) -- a multi-turn version of `skipNextAttack` above, decremented once
   * per round in `applyMonsterTurn()` rather than cleared after a single skip. */
  silencedTurns: number;
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
   * revived) this fight -- each one is a "body" ENGULF_BODY can consume for a full heal. Also
   * doubles as the generic "monsters killed this fight" count Absorb Soul/Fire of the Dead need
   * (New Spells, issue #61) -- same underlying signal, reused rather than tracked twice. */
  engulfableBodies: number;
  /** Ethereal Body (New Spells, issue #61): "all damage you take is reduced by 1 point," for the
   * rest of this fight -- applied per monster hit (before poison/absorbable are split out), not
   * once per round, floored at 0. */
  damageReduction: number;
  /** Magic Shield (New Spells, issue #61): "it can absorb 4 damage points. Can cast more than one" --
   * each cast pushes a new independently-depleting pool; absorbable damage drains the oldest
   * (first) shield before spilling to the next, then to the normal armor-or-HP choice. Poison still
   * bypasses shields entirely, the same "cannot be absorbed by armor or other means" rule armor
   * itself is already subject to. */
  shields: number[];
  /** Absorb Soul (New Spells, issue #61): "after a fight, recover 5 HP for each monster killed" --
   * set when cast, consumed (and cleared) by `finishIfVictorious()` alongside `engulfableBodies`. */
  absorbSoulActive: boolean;
  /** Fire of the Dead (New Spells, issue #61): "after a fight, you get 2 torches for every monster
   * killed" -- same shape as `absorbSoulActive` above, the other deferred-to-victory Death spell. */
  fireOfTheDeadActive: boolean;
}

/** A "worth N Coins in the town" item found by opening a Treasure -- held until there's a town to sell it in. */
export interface HeldItem {
  name: string;
  worth: number;
}

/** A building (Buildings, issue #27) a character owns, tied to the hex it was built on --
 * `hexKey` rather than a full `HexCoord` since that's how `WorldState.tiles`/`politicalStatus` are
 * already keyed, and the Vassal-range check needs to parse it back via `parseHexKey()` regardless. */
export interface OwnedBuilding {
  hexKey: string;
  kind: BuildingKind;
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
  /** The segment the player physically occupies right now -- distinct from `selectedSegId`
   * (what's shown in the RoomInspector), though the two are always kept in lockstep by
   * SELECT_SEGMENT (see CLAUDE.md's Positional movement section): selecting a segment other than
   * the current one only succeeds if it's reachable, and doing so moves you there. */
  currentSegId: number | null;
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
  /** Found weapons not currently wielded -- every weapon-grant site pushes here rather than
   * overwriting `weapon` directly, so finding a new one never silently discards whatever was
   * equipped. WIELD_WEAPON swaps a chosen entry here with whatever's currently equipped. */
  spareWeapons: EquippedWeapon[];
  combat: CombatState | null;
  /** Ordinary monsters and Bosses defeated this run -- character-specific, like torches/hp, not
   * map/exploration state, so a new adventurer via RESUME_DUNGEON starts back at 0 even though
   * they're exploring the same map (see CLAUDE.md's Resuming section). Shown on the Graveyard. */
  monsterKills: number;
  bossKills: number;
  /** Per-monster-name and per-ability kill tallies, alongside the above any/Boss split -- keyed by
   * the defeated monster's own lowercased `name` (or ability), the same "no formal taxonomy, just
   * match the string" precedent Armor & Weapons' tag-matching already established. Powers Advanced
   * Class kill-count requirements (#23) like Ruthless's "10 Imps" or Ghostbuster's "10 intangible
   * beings" -- neither is answerable from monsterKills/bossKills alone. A monster with multiple
   * abilities increments each one; not mutually exclusive with killsByName. */
  killsByName: Record<string, number>;
  killsByAbility: Partial<Record<MonsterAbility, number>>;
  /** The active character's name -- used only to label remains left behind if they die. */
  characterName: string;
  /** The active character's race/class names (e.g. "Dwarf", "Grave Digger") -- matched by exact
   * string against `RaceDef.name`/`ClassDef.name`, the same "no formal taxonomy" pattern the
   * Armor & Weapons system already uses for monster-tag matching. Drives every race/class ability
   * that needs reducer-level logic (see CLAUDE.md's "Race and class abilities" section); abilities
   * resolvable entirely in a UI component instead read `character.race`/`character.cls` directly. */
  raceName: string;
  className: string;
  /** Advanced Classes (issue #23) acquired so far, by name -- mirrors `AdventurerResources` of the
   * same name. Only Goblinator's damage-reduction-per-Explosion and Gravedigger's +2-vs-Undead
   * currently need it mid-dungeon (see `attackBonus()`/the Explosive branch in `dungeonReducer.ts`);
   * every other acquired class's effect is already baked into `hp`/`maxHp`/`spellUses` at the
   * moment it's purchased in Town, same as the character's race/class abilities above. */
  advancedClasses: string[];
  /** Hirelings (issue #25) -- the current dungeon trip's Hireling, by name, or `null`. Unlike
   * `advancedClasses`, this deliberately does NOT default to `[]`/persist the same way -- it
   * expires per trip (see CLAUDE.md's Hirelings note): `RESUME_DUNGEON` never carries it (a new
   * character doesn't inherit a dead one's Hireling), `RETURN_TO_DUNGEON` carries it over exactly
   * (same trip, paused in Town), and App.tsx's `handleReturnToTown` clears it once the trip is
   * actually beaten. Burglar/Minstrel/Dwarf Soldier's abilities check this field directly (a passive
   * check, not a one-time grant) -- see `attackBonus()`/`RESOLVE_DOOR_LOCK`/`RoomInspector.tsx`. */
  hireling: string | null;
  /** Animals (issue #26) -- trained/bought companions carried on this run, by name, mirroring
   * `AdventurerResources.animals`. Threaded like `advancedClasses` (permanent -- `RESUME_DUNGEON`
   * resets to `[]`, `RETURN_TO_DUNGEON` carries it over exactly), not like `hireling` (which
   * expires per trip). Only needed here for Dog's reducer-side Move Silently block. */
  animals: string[];
  /** Issue #70's Advanced Class achievement flags/counters -- mirrors `AdventurerResources` of the
   * same name, but only the subset the reducer itself mutates mid-dungeon (hasCastSpell,
   * hasCastColdRay, hasHadArmorDestroyed, locksOpened) is ever actually written here; hasSoldItem/
   * hasFoughtInArena only ever change in Town/World and just ride along unchanged. */
  milestones: AdvancedClassMilestones;
  /** Buildings (issue #27) owned so far, mirroring `AdventurerResources.buildings` -- threaded
   * like `advancedClasses`/`animals` (permanent -- `RESUME_DUNGEON` resets to `[]`, a new character
   * doesn't inherit a dead one's real estate; `RETURN_TO_DUNGEON` carries it over exactly). Only
   * needed here for `finishIfVictorious()`'s Boss-kill tax credit. */
  buildings: OwnedBuilding[];
  /** The active character's weapon damage formula (e.g. "1d6+1"), rolled on each PLAYER_ATTACK. */
  weaponFormula: string;
  /** Remaining uses per spell, keyed by `character.ts`'s `spellKey(table, roll)` composite (not a
   * bare roll number -- see `SpellTableKey`'s own doc comment, issue #24). Depleted uses are gone
   * until Rest. */
  spellUses: Record<string, number>;
  /** Per-spell ceiling `spellUses` is restored to by Rest -- mirrors `AdventurerResources` of the
   * same name (issue #75). Bumped here (not just in Town) by the two `OPEN_TREASURE` reward sites
   * that grant spell uses mid-dungeon (a room's automatic `magicScrolls` reward, and the Magic
   * Scroll treasure's `randomSpell` roll). */
  maxSpellUses: Record<string, number>;
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

/** True once the Final Room's Boss has been defeated -- the dungeon is complete, nothing left to
 * resume. Scans every segment of every level for a defeated Final Room, rather than gating on
 * `lvl.isFinalRoomLevel` or assuming the Final Room sits at `segments[0]` -- `seg.type === "final"`
 * is unambiguous on its own (it's only ever created for the Boss's own room, in exactly two places
 * in `dungeonReducer.ts`, both already commented "doubles as isBoss with no separate field to
 * track"), so no other flag is needed to confirm it. This deliberately doesn't depend on
 * `isFinalRoomLevel` at all: a `dead-end-final` victory used to read as unfinished because that
 * flag went unset AND the Final Room landed at a non-zero segment index -- fixing just the flag
 * would only help *future* dungeons, since an already-persisted save's `isFinalRoomLevel` is
 * already baked in as `false` and can't retroactively fix itself. Scanning every segment's own
 * `type`/`monstersDefeated` instead works immediately for saves from before this fix too, since
 * `monstersDefeated` was always being set correctly. */
export function isDungeonBeaten(state: DungeonState): boolean {
  return state.levels.some((lvl) =>
    lvl.segments.some((seg) => seg.type === "final" && seg.monstersDefeated === true),
  );
}

/** True while any segment still holds a fallen adventurer's coins/Treasures/Keys/items --
 * `leaveRemains()` sets this at every death site, `COLLECT_REMAINS` clears it back to null, so
 * this is a simple always-accurate scan rather than a separately-tracked flag. */
export function hasUnlootedRemains(state: DungeonState): boolean {
  return state.levels.some((lvl) => lvl.segments.some((seg) => seg.remains != null));
}

/** How many fallen adventurers' bodies -- across every segment, every level -- never got
 * recovered. `SegmentState.remains.names` already accumulates every death's name if more than one
 * character fell in the same room (see `leaveRemains()`), so this sums list lengths rather than
 * counting segments. */
export function countUnlootedRemains(state: DungeonState): number {
  let count = 0;
  for (const lvl of state.levels) {
    for (const seg of lvl.segments) {
      if (seg.remains) count += seg.remains.names.length;
    }
  }
  return count;
}

/** Issue #80: unfinished dungeons before cleared ones -- a plain stable sort (JS's `Array.sort()`
 * has been stability-guaranteed since ES2019), so whatever order `dungeons` already arrives in is
 * preserved within each of the two groups. `WorldScreen.tsx` uses this to layer its own
 * closest-to-farthest ordering on top, by pre-sorting `dungeons` by distance before calling this --
 * the two compose correctly precisely because this sort is stable. `CharacterCreationScreen`,
 * which has no `WorldState`/player position to measure distance from, calls this directly on the
 * raw, unsorted history instead, falling back to whatever order that arrived in within each group. */
export function sortDungeonsForDisplay(dungeons: PendingDungeon[]): PendingDungeon[] {
  return [...dungeons].sort(
    (a, b) => Number(isDungeonBeaten(a.dungeon)) - Number(isDungeonBeaten(b.dungeon)),
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
  spellUses: Record<string, number> = {},
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
  killsByName: Record<string, number> = {},
  killsByAbility: Partial<Record<MonsterAbility, number>> = {},
  spareWeapons: EquippedWeapon[] = [],
  advancedClasses: string[] = [],
  hireling: string | null = null,
  animals: string[] = [],
  milestones: AdvancedClassMilestones = createInitialMilestones(),
  // Defaults to `spellUses` itself -- for every existing caller that doesn't pass this explicitly
  // (i.e. every test fixture predating issue #75), the character's current uses and their ceiling
  // are the same thing, same as before this field existed.
  maxSpellUses: Record<string, number> = spellUses,
  buildings: OwnedBuilding[] = [],
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
    currentSegId: null,
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
    spareWeapons,
    combat: null,
    monsterKills,
    bossKills,
    killsByName,
    killsByAbility,
    characterName,
    raceName,
    className,
    advancedClasses,
    hireling,
    animals,
    milestones,
    buildings,
    weaponFormula,
    spellUses,
    maxSpellUses,
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
  /** A quiet arrival (OPEN_DOOR/staircase descent with `wasNoisy: false`) into a room with
   * monsters waits here instead of starting combat immediately -- "Attack First" is the free
   * default (the player still gets the first attack, exactly like before this action existed).
   * "moveSilently" spends 1 torch; the per-monster detection rolls (and how many monsters that
   * even is, since a room's count can itself be a dice roll like "1d6 Goblins") are resolved
   * inside the reducer via its `rng` param, same as every other hidden roll in this engine (e.g.
   * a fresh room's monster count) -- there's nothing for the client to pre-roll or animate. */
  | { type: "RESOLVE_ROOM_ENTRY"; segId: number; choice: "attack" | "moveSilently" }
  /** `segId`: only set when triggered by physically stepping through an already-opened staircase
   * (DungeonMap's descend button) -- moves the player there too. Omitted for a plain LevelTabs
   * click, which only changes which level's map is *displayed*, not where the player stands. */
  | { type: "SWITCH_LEVEL"; levelIndex: number; segId?: number }
  | { type: "SELECT_SEGMENT"; segId: number | null }
  | { type: "ROLL_SECRET_PASSAGE"; segId: number; roll: number; trapRoll: number | null }
  | { type: "ROLL_CHEST"; segId: number; dice: [number, number]; trapRoll: number | null }
  | { type: "COLLECT_REMAINS"; segId: number }
  /** Swaps a found-but-unwielded weapon into the equipped slot, pushing whatever was equipped (if
   * anything) back into spareWeapons -- out-of-combat only, see CLAUDE.md's Armor & Weapons note. */
  | { type: "WIELD_WEAPON"; index: number }
  // maxSpellUses (issue #75) is read from `state.maxSpellUses` directly now, rather than being
  // recomputed client-side and passed through the action -- that field is the persisted source of
  // truth for Mana Potion's restoreAllSpells effect below.
  | { type: "OPEN_TREASURE"; roll: number }
  /** `useHorn`: Rinoceroid's "You can attack with your horn (Damage 1d6)" -- a flat 1d6, no
   * weapon modifier, ignoring whatever's equipped, for this one attack. */
  | { type: "PLAYER_ATTACK"; targetId: number; roll: number; useHorn?: boolean }
  /** Slimemen's "If you engulf the body of an enemy, you regain all HP" -- consumes one body from
   * `CombatState.engulfableBodies` (set by `handleMonsterDefeat` whenever a monster is actually
   * removed, not revived) and heals to full, same as a full round (the monsters still counter-attack). */
  | { type: "ENGULF_BODY" }
  /** `destLevel`/`destSegId`: required for Teleport (basic table, spellRoll 3) -- the
   * already-discovered, empty room the player chose to reappear in (see `isTeleportDestination`).
   * Unused by every other spell. `table` distinguishes which New Spells table (issue #24)
   * `spellRoll` is from -- see `SpellTableKey`'s own doc comment for why a bare roll number alone
   * isn't enough anymore. */
  | {
      type: "CAST_SPELL";
      table: SpellTableKey;
      spellRoll: number;
      targetId?: number;
      destLevel?: number;
      destSegId?: number;
    }
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
      spellUses: Record<string, number>;
      maxSpellUses: Record<string, number>;
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
      spareWeapons: EquippedWeapon[];
      weaponFormula: string;
      spellUses: Record<string, number>;
      maxSpellUses: Record<string, number>;
      characterName: string;
      raceName: string;
      className: string;
      advancedClasses: string[];
      hireling: string | null;
      animals: string[];
      monsterKills: number;
      bossKills: number;
      killsByName: Record<string, number>;
      killsByAbility: Partial<Record<MonsterAbility, number>>;
      milestones: AdvancedClassMilestones;
      buildings: OwnedBuilding[];
    };
