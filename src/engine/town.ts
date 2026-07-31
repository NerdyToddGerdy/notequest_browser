import type { MonsterAbility } from "../data/dungeonTables.ts";
import type { Terrain } from "../data/hexTables.ts";
import type { SpellTableKey } from "../data/types.ts";
import { HEAL_AMOUNT, OUT_OF_COMBAT_SPELL_NAMES, parseWeaponFormula } from "./combat.ts";
import { MUTATION_IDS } from "../data/mutations.ts";
import type { ArmorPieceKind } from "../data/dungeonTables.ts";
import { isUsableOutOfCombat } from "./dungeonState.ts";
import type {
  ArmorPiece,
  Consumable,
  EquippedWeapon,
  HeldItem,
  OwnedBuilding,
} from "./dungeonState.ts";
import { rollSpell, spellKey, SPELL_TABLE_BY_KEY } from "./character.ts";
import { rollDie } from "./dice.ts";
import type { RNG } from "./rng.ts";

/** A living character's current stats, carried between the dungeon and the town -- unlike
 * `CreatedCharacter`, which only ever holds the starting values rolled at creation. */
export interface AdventurerResources {
  torches: number;
  hp: number;
  maxHp: number;
  coins: number;
  treasures: number;
  keys: number;
  heldItems: HeldItem[];
  armor: ArmorPiece[];
  weapon: EquippedWeapon | null;
  /** Found weapons not currently wielded -- see DungeonState.spareWeapons. */
  spareWeapons: EquippedWeapon[];
  /** Issue #82: found armor pieces benched because their slot was already occupied ("can't use
   * more than one identical piece") -- see DungeonState.spareArmor. */
  spareArmor: ArmorPiece[];
  /** Keyed by `character.ts`'s `spellKey(table, roll)` composite -- see `DungeonState.spellUses`. */
  spellUses: Record<string, number>;
  /** Per-spell ceiling `spellUses` can hold/be restored to by Rest -- unlike `spellUses` itself,
   * this isn't derivable on the fly from `character.spells`/`fixedGrants` alone (issue #75): a
   * spell granted *after* Character Creation (an Advanced Class/Hireling ability, Gnome's Culture
   * Action, a Magic Scroll) needs its own ceiling too, or it silently never shows up in
   * `CharacterSheet`'s Spells list and gets wiped back down to nothing the next time the character
   * Rests. Starts as `computeSpellUses(character.spells, character.fixedGrants)` at creation, then
   * every site that grants a spell use bumps this by the identical amount alongside `spellUses`
   * itself -- see `grantSpellUses()`, Cleric/Paladin/Anti-Paladin/Bard's fixed grants, Gnome's
   * `learnRandomSpell()`, and `dungeonReducer.ts`'s Magic Scroll/`magicScrolls` reward sites.
   * Mirrored on `DungeonState` for the same reason `spellUses` itself is. */
  maxSpellUses: Record<string, number>;
  monsterKills: number;
  bossKills: number;
  /** Per-monster-name/-ability kill tallies, mirroring `DungeonState`'s own fields of the same
   * name -- see there for why these exist. */
  killsByName: Record<string, number>;
  killsByAbility: Partial<Record<MonsterAbility, number>>;
  /** Spent while exploring the World map, same as `torches` is spent while exploring a dungeon --
   * neither resource is touched by the other activity, but both persist across every screen as
   * part of this same object. */
  provisions: number;
  /** Advanced Classes (issue #23) acquired so far, by name -- stacks freely, never the same one
   * twice (enforced by `canAcquireAdvancedClass()`). Mirrored on `DungeonState` since a couple of
   * abilities (Goblinator, Gravedigger) apply mid-dungeon -- see `advancedClasses.ts`. */
  advancedClasses: string[];
  /** Hirelings (issue #25) -- the currently-employed Hireling's name, or `null`. Unlike
   * `advancedClasses`, this expires per dungeon trip rather than persisting indefinitely -- see
   * CLAUDE.md's Hirelings note for exactly how it's threaded through `DungeonState`/App.tsx so a
   * hire is spent the moment it's actually used to enter a new dungeon. */
  hireling: string | null;
  /** The employed Hireling's current HP, or `null` for "at full" (issue #114) -- mirrors
   * `DungeonState.hirelingHp`, so a trip paused in Town and resumed doesn't heal the hired help.
   * Set at hire time, written back by the dungeon's own `RESOLVE_DAMAGE`, cleared when the trip ends. */
  hirelingHp: number | null;
  /** Potions held for later (issue #110) -- mirrors `DungeonState.consumables`, and shares the
   * 10-item Pack cap with `heldItems` (the rulebook's limit is "up to 10 items in your backpack",
   * not ten of each). Usable in Town/World too, via `drinkConsumable()`. */
  consumables: Consumable[];
  /** Flavor-only finds tallied by name (issues #109/#115) -- mirrors `DungeonState.curiosities`.
   * Permanent per character, like `advancedClasses`/`mutations`. */
  curiosities: Record<string, number>;
  /** Animals (issue #26) -- trained or bought companions, by name, up to `MAX_ANIMALS`. Persists
   * permanently once acquired, same "stacks freely, never expires" shape as `advancedClasses`
   * (not `hireling`'s per-trip expiry) -- see `src/engine/animals.ts`. At most one entry is ever a
   * Mount (enforced at acquisition time, see `activeMount()`). Mirrored on `DungeonState` since
   * Dog's Move-Silently block applies mid-dungeon. */
  animals: string[];
  /** One-time achievement flags/counters (issue #70) powering several Advanced Classes'
   * requirement checks that don't fit the existing kill-tally/graveyard-based shapes -- see
   * `AdvancedClassMilestones`. */
  milestones: AdvancedClassMilestones;
  /** Buildings (issue #27) owned so far -- stacks freely like `advancedClasses`/`animals` (never
   * expires the way `hireling` does). Mirrored on `DungeonState` since `finishIfVictorious()`'s
   * Boss-kill tax credit needs to read it mid-dungeon -- see `src/engine/buildings.ts`. */
  buildings: OwnedBuilding[];
  /** Warfare (issue #28) -- total currently-available recruited troops, and which hex keys already
   * have an unspent one recruited (gating re-recruiting from the same source until that troop is
   * actually spent on an attack). Neither is mirrored on `DungeonState` -- same "World/Town-only,
   * nothing inside a dungeon run needs it" shape as `travelStats` below, not `buildings`'s own
   * mid-dungeon-readable one. */
  troops: number;
  troopSources: string[];
  /** Lifetime World-map travel counters (issue #72) powering Lumberjack/Druid/Survivor/Pirate/
   * Bard/Cook's requirement checks -- see `TravelStats`. Unlike `milestones`, this is never
   * mirrored on `DungeonState`: every one of these signals only ever changes via World-map travel
   * (`WorldScreen.tsx`'s `handleTravel()`) or Town's Rest/Buy actions, nothing inside a dungeon
   * run needs to read it mid-fight. */
  travelStats: TravelStats;
  /** Miner (Advanced Class, issue #62): distinct dungeon runs retreated-from-alive or beaten, by
   * runId -- deduplicated the same way `TravelStats.citiesVisited` is, so retreating from (and
   * re-entering) the same still-unfinished run over and over can't trivially inflate this the way
   * a bare counter would. Not mirrored on `DungeonState`: it only ever changes in Town, at
   * `App.tsx`'s `handleReturnToTown`, the same "World/Town-only" shape as `travelStats` above. */
  survivedRunIds: string[];
  /** Fly (New Spells, Advanced 6, issue #61): "Can move through any land without spending any
   * Provision" -- armed by `castFly()` and consumed by `WorldScreen.tsx`'s `handleTravel()` on the
   * next move, then cleared back to `false`. Deliberately not routed through the shared
   * `CAST_SPELL`/`KNOWN_CASTABLE_SPELL_NAMES` pipeline (`combat.ts`) the way Heal/Light/Natural Cure
   * are: that pipeline's "Cast" button also renders inside a dungeon (`DungeonScreen`'s own
   * `canCastOutOfCombat`), where Fly's effect (Provisions, a World-map-only resource) means
   * nothing -- a bespoke `canCastFly()`/`castFly()` pair confined to World/Town avoids ever needing
   * a meaningless dungeon-side case. World/Town-only, not mirrored on `DungeonState`, same shape as
   * `travelStats`/`troops` above. */
  flyActive: boolean;
  /** Pesadelum's Forest of the Impaled (issue #105): "roll a die. If it's 1 you are catatonic."
   * Read as losing your next move -- the next travel action is consumed doing nothing and clears
   * this. World/Town-only, like `flyActive`; `loadSession()` back-fills `?? false`. */
  catatonic: boolean;
  /** Laboratory's Special Rule (issue #30): every mutation this character has accumulated, by
   * `MutationEntry.id`. Permanent once acquired, like `advancedClasses` -- a mutation is not
   * something you recover from. Flavor-only outcomes are recorded too, so `CharacterSheet` can list
   * them; the mechanical ones are read back by id (see `MUTATION_IDS`). */
  mutations: string[];
  /** How many times the zombie mutation has already brought this character back -- the exponent in
   * "half your maximum hit points, then half of that, and so on." */
  zombieRevivals: number;
  /** Ziggurat's "Effect of the Forgotten Gods" Special Rule (issue #30): "A divine light
   * illuminates you and you gain +1 damage on all attacks on the next dungeon exploration you
   * make" -- armed here, consumed into `DungeonState.runDamageBonus` the moment a genuinely fresh
   * dungeon is entered (mirroring `hireling`'s own per-trip consumption in `DungeonScreen.tsx`),
   * then cleared back to 0. World/Town-only otherwise. */
  nextDungeonDamageBonus: number;
}

/** Lifetime World-map travel counters (issue #72) -- bundled into one object for the same reason
 * `AdvancedClassMilestones` is: keeps the threading surface (creation, `handleReturnToTown`,
 * `loadSession()` back-fill) from growing by 5 more individual fields. Unlike `milestones`, none
 * of these need mirroring onto `DungeonState` (see `AdventurerResources.travelStats`'s own doc
 * comment) so there's no `RESUME_DUNGEON`/`RETURN_TO_DUNGEON` threading to do at all -- `App.tsx`'s
 * `handleReturnToTown` just carries it forward from `prev`, the same way `provisions` already is,
 * since `DungeonState` has no equivalent field to read it from. */
export interface TravelStats {
  /** Lumberjack (>= 2) / Druid (>= 6, the same signal at a higher threshold) -- every move onto a
   * forest hex, lifetime, not deduplicated by hex. */
  forestsCrossed: number;
  /** Survivor (>= 2) -- every move onto a desert hex, lifetime. */
  desertsCrossed: number;
  /** Pirate (>= 5) -- "sailed through," so this only counts a move onto a water hex made while
   * `WorldState.hasBoat` was true for that move (a water hex crossed via Patovsky/Sharkin's own
   * water-walking, with no boat hired, isn't "sailing"). */
  territoriesSailed: number;
  /** Bard (>= 3) -- distinct cities/fortresses *visited*, so this needs de-duplication (unlike the
   * three counters above) -- stored as the hex key of every City/Fortress hex ever arrived at. */
  citiesVisited: string[];
  /** Cook (>= 20) -- lifetime provisions actually *spent* on travel, distinct from
   * `resources.provisions`'s current balance (which also goes up on Buy Provisions) -- this only
   * ever increases, tallied inside `payTravelCost()` itself from the same shortfall-aware `spend`
   * value it already computes, rather than duplicating that math here. */
  provisionsSpentTotal: number;
}

export function createInitialTravelStats(): TravelStats {
  return {
    forestsCrossed: 0,
    desertsCrossed: 0,
    territoriesSailed: 0,
    citiesVisited: [],
    provisionsSpentTotal: 0,
  };
}

/** One-time achievement flags/counters (issue #70) that exist purely to answer a handful of
 * Advanced Class requirement questions ("used a spell," "sold an item," ...) that neither the
 * existing kill tallies nor the Graveyard can answer. Bundled into one object -- mirrored on
 * `DungeonState` for the subset the reducer itself sets mid-dungeon -- rather than 6 separate
 * top-level fields, to keep the already-repetitive `createInitialDungeonState()`/`RESUME_DUNGEON`/
 * `RETURN_TO_DUNGEON`/`session.ts` threading surface from growing by 6 more individual params. */
export interface AdvancedClassMilestones {
  /** Scholar: "used a spell or scroll" -- set on any successful CAST_SPELL dispatch, or on
   * redeeming a Magic Scroll's randomSpell reward (OPEN_TREASURE). */
  hasCastSpell: boolean;
  /** Necromancer: "used the Cold Ray spell" specifically -- not just any spell, so this is set
   * only inside CAST_SPELL's "Cold Ray" case, alongside (not instead of) hasCastSpell above. */
  hasCastColdRay: boolean;
  /** Merchant: "sold an item" -- set the first time `sellItem()` actually removes one. */
  hasSoldItem: boolean;
  /** Blacksmith: "had an armor destroyed" -- set wherever an equipped piece's HP hits 0. */
  hasHadArmorDestroyed: boolean;
  /** Gladiator: "fought in an Arena" -- set whenever an Arena fight starts. */
  hasFoughtInArena: boolean;
  /** Thief: "opened at least 4 locks" -- incremented in RESOLVE_DOOR_LOCK's pickLock branch
   * regardless of whether Locksmith/Burglar's free-pick bypass applies (the lock was still
   * opened, just without spending a torch for it). */
  locksOpened: number;
  /** Noble (issue #27): "Talk to the King of a Fortress" -- approximated as having *attempted* a
   * Political Affinity roll at a Fortress hex at least once, regardless of outcome ("talking" is
   * the act of visiting and rolling, not a required success). Set by `politics.ts`'s
   * `resolvePoliticalAffinity()`. */
  talkedToKing: boolean;
  /** Janitor (issue #62/#30): "Killed all creatures from a Sewer" -- set when a Sewers run is
   * actually *finished*, i.e. the metal ladder out is climbed (`DungeonState.exitUsed`), which is
   * the only completion a dungeon with no Boss has. Read as "you cleared a Sewer": the rooms are
   * generated lazily as doors open, so there is no fixed population "all creatures" could mean, and
   * getting out is the rulebook's own definition of having done the place. */
  clearedASewer: boolean;
  /** Emperor (issue #27): "Have 1 fortress and 3 vassals" -- incremented whenever a Political
   * Affinity roll resolves to `"vassal"` (see `resolvePoliticalAffinity()`). */
  vassalCount: number;
}

export function createInitialMilestones(): AdvancedClassMilestones {
  return {
    hasCastSpell: false,
    hasCastColdRay: false,
    hasSoldItem: false,
    hasHadArmorDestroyed: false,
    hasFoughtInArena: false,
    locksOpened: 0,
    talkedToKing: false,
    vassalCount: 0,
    clearedASewer: false,
  };
}

/** "You can carry a maximum of 10 torches at a time." */
export const MAX_TORCHES = 10;

/** "No one can carry more than 20 provisions." */
export const MAX_PROVISIONS = 20;

/** "Load Limit: ...up to 10 items in your backpack" (issue #82) -- `heldItems`' own sibling cap to
 * `MAX_TORCHES`, previously never enforced anywhere. */
export const MAX_HELD_ITEMS = 10;

/** Cargo Ogre (Hireling, issue #63): "Can carry 40 items (return it to you at the end)" -- raises
 * the Pack cap for as long as it's employed, reverting the moment the trip ends (`hireling`'s own
 * per-trip expiry already handles the "return it to you at the end" half automatically, since
 * `resources.hireling`/`DungeonState.hireling` are never carried past one dungeon trip). Monkey
 * (Animals, issue #67): "It can carry an extra item" -- a flat +1 on top of whichever base cap
 * applies, since Monkey persists permanently once acquired (unlike Hirelings) rather than
 * replacing the base cap outright the way Cargo Ogre's own much larger number does. */
export function maxHeldItemsFor(hireling: string | null, animals: string[] = []): number {
  const base = hireling === "Cargo Ogre" ? 40 : MAX_HELD_ITEMS;
  return animals.includes("Monkey") ? base + 1 : base;
}

/** Resting only helps if it would actually recover something -- full HP and every spell already
 * at its max uses means the coin buys nothing. `isChampion`: Advanced Class Champion's "You don't
 * need to spend money to recover" waives the coin cost entirely, same optional-flag shape as
 * `isBlacksmith`/`isCatPerson` below. Reads `resources.maxSpellUses` directly (issue #75) rather
 * than taking it as a separate parameter -- that field is now the persisted source of truth,
 * kept in sync by every spell-granting site, so a second, independently-computed value here could
 * only ever drift from it. */
export function canRest(resources: AdventurerResources, isChampion = false): boolean {
  if (!isChampion && resources.coins < 1) return false;
  if (resources.hp < resources.maxHp) return true;
  return Object.entries(resources.maxSpellUses).some(
    ([key, max]) => (resources.spellUses[key] ?? 0) < max,
  );
}

/** "Rest: Spend 1 coin and recover your HP and spells consumed." Restores to
 * `resources.maxSpellUses` (issue #75) -- the persisted ceiling, not a value recomputed from
 * `character.spells`/`fixedGrants` alone, so a spell granted after Character Creation (an
 * Advanced Class/Hireling ability, Gnome's Culture Action, a Magic Scroll) survives a Rest
 * instead of being silently wiped back down to the character's original starting allotment. */
export function rest(resources: AdventurerResources, isChampion = false): AdventurerResources {
  return {
    ...resources,
    coins: isChampion ? resources.coins : resources.coins - 1,
    hp: resources.maxHp,
    spellUses: { ...resources.maxSpellUses },
  };
}

/** Whether the spell at this composite key is one of the two (Heal/Light) usable outside a
 * dungeon fight at all -- see `combat.ts`'s `OUT_OF_COMBAT_SPELL_NAMES` for why this is
 * name-matched rather than keyed by table/roll directly. */
export function canCastSpell(
  resources: AdventurerResources,
  table: SpellTableKey,
  roll: number,
): boolean {
  const spell = SPELL_TABLE_BY_KEY[table]?.[roll];
  if (!spell || !OUT_OF_COMBAT_SPELL_NAMES.has(spell.name)) return false;
  return (resources.spellUses[spellKey(table, roll)] ?? 0) > 0;
}

/** Town/World's own equivalent of dungeonReducer.ts's CAST_SPELL case, for just the out-of-combat
 * spells CharacterSheet's "Cast" button ever offers outside a dungeon (Teleport/Cold Ray/Lightning/
 * Fireball/Insect Rain/Magic Blast/Banish the Dead all need combat, which neither screen has).
 * Mirrors that case's Heal/Natural Cure (min(amount, room left before maxHp)) and Light
 * (min(1, room left before MAX_TORCHES)) math exactly, since there's no DungeonState/reducer here
 * to dispatch CAST_SPELL against. */
export function castSpell(
  resources: AdventurerResources,
  table: SpellTableKey,
  roll: number,
): AdventurerResources {
  if (!canCastSpell(resources, table, roll)) return resources;
  const spell = SPELL_TABLE_BY_KEY[table]![roll]!;
  const key = spellKey(table, roll);
  const spellUses = { ...resources.spellUses, [key]: resources.spellUses[key]! - 1 };
  if (spell.name === "Heal") {
    const healed = Math.min(HEAL_AMOUNT, resources.maxHp - resources.hp);
    return { ...resources, hp: resources.hp + healed, spellUses };
  }
  if (spell.name === "Natural Cure") {
    const healed = Math.min(12, resources.maxHp - resources.hp);
    return { ...resources, hp: resources.hp + healed, spellUses };
  }
  const gained = Math.min(1, MAX_TORCHES - resources.torches);
  return { ...resources, torches: resources.torches + gained, spellUses };
}

const FLY_SPELL_KEY = spellKey("advanced", 6);

/** Fly (New Spells, Advanced 6, issue #61): known, has an unspent use, and isn't already armed for
 * an upcoming move. Deliberately its own bespoke pair rather than routing through `canCastSpell()`/
 * `castSpell()` -- see `AdventurerResources.flyActive`'s own doc comment for why. */
export function canCastFly(resources: AdventurerResources): boolean {
  return (resources.spellUses[FLY_SPELL_KEY] ?? 0) > 0 && !resources.flyActive;
}

/** Arms `flyActive` and spends the use immediately (matching every other spell here, which spends
 * on cast regardless of whether its effect is realized right away) -- `WorldScreen.tsx`'s
 * `handleTravel()` is what actually consumes the armed flag, on the very next move. */
export function castFly(resources: AdventurerResources): AdventurerResources {
  if (!canCastFly(resources)) return resources;
  return {
    ...resources,
    spellUses: { ...resources.spellUses, [FLY_SPELL_KEY]: resources.spellUses[FLY_SPELL_KEY]! - 1 },
    flyActive: true,
  };
}

export function canBuyTorch(resources: AdventurerResources): boolean {
  return resources.coins >= 1 && resources.torches < MAX_TORCHES;
}

/** "Buy Torches: Spend 1 coin and add 1 torch. Max 10 torches carried at a time." */
export function buyTorch(resources: AdventurerResources): AdventurerResources {
  return {
    ...resources,
    coins: resources.coins - 1,
    torches: Math.min(resources.torches + 1, MAX_TORCHES),
  };
}

/** Issue #90: fills up to whichever is the real limiting factor -- the MAX_TORCHES cap or the
 * player's own coin purse -- in one call, spending min(coins, room left before cap) coins. */
export function buyMaxTorches(resources: AdventurerResources): AdventurerResources {
  const bought = Math.max(0, Math.min(resources.coins, MAX_TORCHES - resources.torches));
  return { ...resources, coins: resources.coins - bought, torches: resources.torches + bought };
}

/** "Sell Items: Sell any item in any city for [its worth in] coins." Each HeldItem already
 * carries the sale price it was found with (e.g. "Ornament, worth 5 Coins in the town").
 * `isCatPerson`: "You can sell equipment in the town for twice the price."
 * `isFortress` (issue #94): "If it is a Fortress, double this value."
 *
 * The two multipliers **stack** (4x for a Cat-Person selling in a Fortress), confirmed with the
 * user. This is deliberately *not* the "two rulebook entries, one bonus, no double-counting"
 * convention: that applies where two entries grant the identical effect (Grave Digger/Gravedigger,
 * Cat-Person/Merchant -- which is itself still OR'd into `isCatPerson` by the caller). Here one
 * multiplier is a property of the *place* and the other of the *seller*, so they're independent. */
export function sellItem(
  resources: AdventurerResources,
  index: number,
  isCatPerson = false,
  isFortress = false,
): AdventurerResources {
  const item = resources.heldItems[index];
  if (!item) return resources;
  const multiplier = (isCatPerson ? 2 : 1) * (isFortress ? 2 : 1);
  return {
    ...resources,
    coins: resources.coins + item.worth * multiplier,
    heldItems: resources.heldItems.filter((_, i) => i !== index),
    milestones: { ...resources.milestones, hasSoldItem: true },
  };
}

/** Selling gear (issue #117). Neither armor nor weapons carry a printed price anywhere in the
 * rulebook, which is exactly why no sell path for them existed -- `HeldItem` has a `worth` and
 * `ArmorPiece`/`EquippedWeapon` don't. Both formulas below are this project's own, chosen to be
 * consistent rather than invented per item, and documented as such.
 *
 * Armor reuses #83's existing basis: an unusable piece is already worth `Math.max(1, maxHp)` when an
 * Ogre sells it, so a Breastplate fetches 10 and a Ring 1. **Collector** ("Sell a piece of armor for
 * 5 coins," issue #103) floors that at 5 rather than replacing it -- a real upgrade on the cheap
 * pieces, and no double-count on a Breastplate already worth more. Confirmed with the user as the
 * reading that satisfies both the class and #117's "anyone should be able to unload a benched
 * Breastplate." */
export function armorWorth(piece: ArmorPiece, isCollector = false): number {
  const base = Math.max(1, piece.maxHp);
  return isCollector ? Math.max(COLLECTOR_ARMOR_FLOOR, base) : base;
}

const COLLECTOR_ARMOR_FLOOR = 5;

/** A weapon's price comes from the one thing the rulebook does give it -- its damage formula -- so a
 * Dagger (1d6-1) is cheap and a Halberd (1d6+3) isn't. `#48` scoped selling weapons out precisely
 * because no price data exists; this is the documented simplification that unblocks it. Floored at 1
 * so nothing is ever worthless. */
export function weaponWorth(weapon: EquippedWeapon): number {
  const { modifier } = parseWeaponFormula(weapon.formula);
  return Math.max(1, WEAPON_BASE_WORTH + modifier);
}

const WEAPON_BASE_WORTH = 3;

/** Which of the four gear lists a sale refers to. `weapon` holds a single item, so its `index` is
 * always 0 -- kept in the same shape as the others so `Equipment` has one callback, not four. */
export type EquipmentList = "armor" | "spareArmor" | "weapon" | "spareWeapons";

export interface EquipmentSaleTarget {
  list: EquipmentList;
  index: number;
}

export interface SellOptions {
  /** Cat-Person or the Merchant Advanced Class -- "sell items for double the value." */
  isDoubler?: boolean;
  /** "If it is a Fortress, double this value" (issue #94) -- a property of the place, so it stacks. */
  isFortress?: boolean;
  /** Collector (issue #103) -- floors an armor piece's price at 5 coins. */
  isCollector?: boolean;
}

/** The multiplier shared by every sale, so the Pack and the Equipment lists can't drift apart. */
function sellMultiplier(opts: SellOptions): number {
  return (opts.isDoubler ? 2 : 1) * (opts.isFortress ? 2 : 1);
}

/** What this piece of gear would fetch right now, multipliers included -- `null` if the slot is
 * empty. `Equipment` labels its Sell button with this, so the price shown is the price paid. */
export function equipmentSaleWorth(
  resources: AdventurerResources,
  target: EquipmentSaleTarget,
  opts: SellOptions = {},
): number | null {
  const base = baseWorthOf(resources, target, opts);
  return base === null ? null : base * sellMultiplier(opts);
}

function baseWorthOf(
  resources: AdventurerResources,
  target: EquipmentSaleTarget,
  opts: SellOptions,
): number | null {
  switch (target.list) {
    case "armor": {
      const piece = resources.armor[target.index];
      return piece ? armorWorth(piece, opts.isCollector) : null;
    }
    case "spareArmor": {
      const piece = resources.spareArmor[target.index];
      return piece ? armorWorth(piece, opts.isCollector) : null;
    }
    case "weapon":
      return resources.weapon ? weaponWorth(resources.weapon) : null;
    case "spareWeapons": {
      const spare = resources.spareWeapons[target.index];
      return spare ? weaponWorth(spare) : null;
    }
  }
}

/** Sells one piece of gear, crediting `equipmentSaleWorth()` and removing it. A no-op on an empty
 * slot, like every other Town action. Selling the *equipped* weapon is allowed and safe: `weapon` is
 * an override, so the character falls back to their class's own `weaponFormula` rather than being
 * left unarmed. Sets `hasSoldItem` (Merchant's requirement, issue #70) exactly like `sellItem()`. */
export function sellEquipment(
  resources: AdventurerResources,
  target: EquipmentSaleTarget,
  opts: SellOptions = {},
): AdventurerResources {
  const worth = equipmentSaleWorth(resources, target, opts);
  if (worth === null) return resources;
  const withoutIt: AdventurerResources = {
    ...resources,
    armor:
      target.list === "armor"
        ? resources.armor.filter((_, i) => i !== target.index)
        : resources.armor,
    spareArmor:
      target.list === "spareArmor"
        ? resources.spareArmor.filter((_, i) => i !== target.index)
        : resources.spareArmor,
    weapon: target.list === "weapon" ? null : resources.weapon,
    spareWeapons:
      target.list === "spareWeapons"
        ? resources.spareWeapons.filter((_, i) => i !== target.index)
        : resources.spareWeapons,
  };
  return {
    ...withoutIt,
    coins: resources.coins + worth,
    milestones: { ...resources.milestones, hasSoldItem: true },
  };
}

/** Whether this held potion does anything out here (issue #110). Potion of Fury is the one that
 * doesn't -- there's no fight on the World map -- so its button is disabled rather than hidden,
 * matching the always-visible-but-disabled convention `Ask` and the spell "Cast" buttons use. */
export function canDrinkConsumable(resources: AdventurerResources, index: number): boolean {
  const item = resources.consumables[index];
  return !!item && isUsableOutOfCombat(item.effect);
}

/** Drinks a held potion in Town or on the World map. Named `drink...` rather than `use...` so ESLint's
 * `react-hooks/rules-of-hooks` doesn't mistake a `use`-prefixed plain function for a hook -- the same
 * rename `resolveForgottenGods()` needed, and it matches `canDrinkVerdosaPotion()` besides. Deliberately a separate implementation from the
 * dungeon's own `USE_CONSUMABLE` for the same reason `canCastSpell()`/`castSpell()` are: out here
 * there's no reducer to dispatch against, and no round for it to consume. */
export function drinkConsumable(
  resources: AdventurerResources,
  index: number,
  rng: RNG = Math.random,
): AdventurerResources {
  const item = resources.consumables[index];
  if (!item || !isUsableOutOfCombat(item.effect)) return resources;
  const without = {
    ...resources,
    consumables: resources.consumables.filter((_, i) => i !== index),
  };
  switch (item.effect.kind) {
    case "healAll":
      return { ...without, hp: without.maxHp };
    case "healAmount":
      return { ...without, hp: Math.min(without.maxHp, without.hp + item.effect.amount) };
    case "restoreAllSpells":
      return { ...without, spellUses: { ...without.maxSpellUses } };
    case "restoreRandomSpellUse": {
      const knownKeys = Object.keys(without.spellUses);
      if (knownKeys.length === 0) return without;
      const key = knownKeys[rollDie(rng) % knownKeys.length]!;
      const max = without.maxSpellUses[key] ?? without.spellUses[key]!;
      return {
        ...without,
        spellUses: {
          ...without.spellUses,
          [key]: Math.min(max, (without.spellUses[key] ?? 0) + 1),
        },
      };
    }
    case "grantsTorches":
      return { ...without, torches: Math.min(MAX_TORCHES, without.torches + item.effect.amount) };
    case "grantTorchesRoll": {
      let rolled = 0;
      for (let i = 0; i < item.effect.dice; i++) rolled += rollDie(rng);
      return { ...without, torches: Math.min(MAX_TORCHES, without.torches + rolled) };
    }
    default:
      return without;
  }
}

/** Drops a held potion. Free, like `DISCARD_ITEM`'s Pack equivalent. */
export function discardConsumable(
  resources: AdventurerResources,
  index: number,
): AdventurerResources {
  return { ...resources, consumables: resources.consumables.filter((_, i) => i !== index) };
}

/** How many of the Pack's slots are in use (issue #110): sellables and potions share them, per the
 * rulebook's "up to 10 items in your backpack." The single place both UI and engine count from. */
export function packUsedSlots(resources: AdventurerResources): number {
  return resources.heldItems.length + resources.consumables.length;
}

/** `isBlacksmith`: "You can repair an armor by spending 1 Torch [instead of a coin]." */
export function canFixArmor(
  resources: AdventurerResources,
  index: number,
  isBlacksmith = false,
): boolean {
  const piece = resources.armor[index];
  const cost = isBlacksmith ? resources.torches : resources.coins;
  return cost >= 1 && !!piece && piece.hp < piece.maxHp;
}

/** "Fix Armor: Spend 1 coin to recover HP of an armor." */
export function fixArmor(
  resources: AdventurerResources,
  index: number,
  isBlacksmith = false,
): AdventurerResources {
  const piece = resources.armor[index];
  if (!piece) return resources;
  return {
    ...resources,
    coins: isBlacksmith ? resources.coins : resources.coins - 1,
    torches: isBlacksmith ? resources.torches - 1 : resources.torches,
    armor: resources.armor.map((p, i) => (i === index ? { ...p, hp: p.maxHp } : p)),
  };
}

/** Swaps a found-but-unwielded weapon into the equipped slot, pushing whatever was equipped (if
 * anything) back into spareWeapons -- Town's own free, no-roll equivalent of dungeonReducer.ts's
 * WIELD_WEAPON action, for wielding while not in a dungeon at all. */
export function wieldWeapon(resources: AdventurerResources, index: number): AdventurerResources {
  const chosen = resources.spareWeapons[index];
  if (!chosen) return resources;
  const remaining = resources.spareWeapons.filter((_, i) => i !== index);
  return {
    ...resources,
    weapon: chosen,
    spareWeapons: resources.weapon ? [...remaining, resources.weapon] : remaining,
  };
}

/** Swaps a benched armor piece into its slot, displacing whatever already occupies that *same*
 * slot (if anything) back into `spareArmor` -- Town's own free, no-roll equivalent of
 * dungeonReducer.ts's WIELD_ARMOR action. Unlike `wieldWeapon()`'s single equipped slot, armor has
 * to find-and-replace by `piece` kind, since several different slots can be worn at once. */
export function wieldArmor(resources: AdventurerResources, index: number): AdventurerResources {
  const chosen = resources.spareArmor[index];
  if (!chosen) return resources;
  // Laboratory's mutations (issue #30): the bubbles mutation forbids armour outright; the extra-toe
  // one forbids just boots. Enforced here rather than by hiding the button, so the rule holds however
  // the swap is reached (`Equipment` also disables the row -- reducer decides, UI mirrors).
  if (!canWearArmorPiece(resources, chosen.piece)) return resources;
  const remaining = resources.spareArmor.filter((_, i) => i !== index);
  const displaced = resources.armor.find((p) => p.piece === chosen.piece);
  return {
    ...resources,
    armor: [...resources.armor.filter((p) => p.piece !== chosen.piece), chosen],
    spareArmor: displaced ? [...remaining, displaced] : remaining,
  };
}

/** Laboratory's mutations (issue #30). `noArmor` (bubbles) blocks every piece; `noBoots` (an extra
 * toe) blocks only the Boots slot. Ogre's own "cannot wear armor" is *not* folded in here: it's a
 * race check the dungeon reducer already applies at every grant site, and Town has no armour-granting
 * path of its own to guard. */
export function canWearArmorPiece(resources: AdventurerResources, piece: ArmorPieceKind): boolean {
  if (resources.mutations.includes(MUTATION_IDS.noArmor)) return false;
  if (piece === "boots" && resources.mutations.includes(MUTATION_IDS.noBoots)) return false;
  return true;
}

/** Issue #82: a free, anywhere-usable discard from the Pack -- Town's own equivalent of
 * dungeonReducer.ts's DISCARD_ITEM action, and the non-Town counterpart to `sellItem()` (no coins
 * credited, just gone). */
export function discardItem(resources: AdventurerResources, index: number): AdventurerResources {
  if (!resources.heldItems[index]) return resources;
  return { ...resources, heldItems: resources.heldItems.filter((_, i) => i !== index) };
}

export function canBuyProvision(resources: AdventurerResources): boolean {
  return resources.coins >= 1 && resources.provisions < MAX_PROVISIONS;
}

/** "[Buy] more in any city by paying 1 coin per Provision, up to a maximum of 20." */
export function buyProvision(resources: AdventurerResources): AdventurerResources {
  return {
    ...resources,
    coins: resources.coins - 1,
    provisions: Math.min(resources.provisions + 1, MAX_PROVISIONS),
  };
}

/** Issue #90: `buyMaxTorches()`'s sibling for Provisions -- spends min(coins, room left before
 * MAX_PROVISIONS) coins in one call. */
export function buyMaxProvisions(resources: AdventurerResources): AdventurerResources {
  const bought = Math.max(0, Math.min(resources.coins, MAX_PROVISIONS - resources.provisions));
  return {
    ...resources,
    coins: resources.coins - bought,
    provisions: resources.provisions + bought,
  };
}

/** "Every day of travel consumes 1 Provision ... If you run out of provisions and have to move,
 * lose 1 HP for each provision needed [that you don't have]." Spends whatever provisions are
 * available first; any shortfall at all costs a flat 1 HP for the move -- not scaled to how many
 * provisions were actually short (a Mountain move at 0 provisions costs the same 1 HP as a Plains
 * move at 0 provisions, not 3x as much just because Mountains normally cost more) -- floored at 1,
 * a deliberate v1 simplification: the rulebook's actual lethal hex hazards (Glacier's Cracked Ice,
 * Thin Ice, a failed Reef check) live in the deferred Events on Travel/Location-effects layer, not
 * here, so running out of provisions alone can hurt but not kill. `hasHireling` (issue #25): "You
 * also pay for Provisions for each of them during the trip" -- a flat +1 provision per move while
 * one is employed, regardless of which Hireling (the rulebook doesn't specify a rate per type, so a
 * flat surcharge is a documented simplification, same tier as `bladeTrap`'s roll-of-2). */
export function payTravelCost(
  resources: AdventurerResources,
  cost: number,
  hasHireling = false,
): AdventurerResources {
  const totalCost = hasHireling ? cost + 1 : cost;
  const spend = Math.min(resources.provisions, totalCost);
  const shortfall = totalCost - spend;
  return {
    ...resources,
    provisions: resources.provisions - spend,
    hp: Math.max(1, resources.hp - (shortfall > 0 ? 1 : 0)),
    // Cook (Advanced Class, issue #72): "spent 20 provisions on the road" -- tallies the actual
    // shortfall-aware amount deducted above, not the raw terrain cost.
    travelStats: {
      ...resources.travelStats,
      provisionsSpentTotal: resources.travelStats.provisionsSpentTotal + spend,
    },
  };
}

/** Advanced Classes (issue #72): the remaining lifetime travel counters -- forests/deserts
 * crossed, territories sailed, and distinct cities visited -- called by `WorldScreen.tsx`'s
 * `handleTravel()` alongside `payTravelCost()`, describing whichever hex the player is actually
 * arriving at. Kept separate from `payTravelCost()` (which only knows a numeric cost) since these
 * need the destination's terrain/location, which the caller already has in hand. */
export function recordTravelStats(
  resources: AdventurerResources,
  terrain: Terrain,
  isCity: boolean,
  hexKey: string,
  wasSailing: boolean,
): AdventurerResources {
  const stats = resources.travelStats;
  return {
    ...resources,
    travelStats: {
      ...stats,
      forestsCrossed: stats.forestsCrossed + (terrain === "forest" ? 1 : 0),
      desertsCrossed: stats.desertsCrossed + (terrain === "desert" ? 1 : 0),
      territoriesSailed: stats.territoriesSailed + (wasSailing && terrain === "water" ? 1 : 0),
      citiesVisited:
        isCity && !stats.citiesVisited.includes(hexKey)
          ? [...stats.citiesVisited, hexKey]
          : stats.citiesVisited,
    },
  };
}

/** Ziggurat's "Effect of the Forgotten Gods" Special Rule (issue #30): "When you are in the
 * hexagon of this dungeon (but outside the dungeon), you can spend 1 provision and roll a die in
 * the table below." Requires standing on the current tile with a known Ziggurat-type dungeon --
 * `WorldScreen.tsx` computes that from `dungeonHistory`/`HexTile.dungeonRunId`, since neither this
 * function nor `AdventurerResources` has any notion of "which hex" on its own. */
export function canUseForgottenGods(resources: AdventurerResources): boolean {
  return resources.provisions >= 1;
}

export interface ForgottenGodsResult {
  resources: AdventurerResources;
  message: string;
}

export function resolveForgottenGods(
  resources: AdventurerResources,
  rng: RNG = Math.random,
): ForgottenGodsResult {
  if (!canUseForgottenGods(resources)) return { resources, message: "" };
  const spent = { ...resources, provisions: resources.provisions - 1 };
  const roll = rollDie(rng);
  if (roll === 1) {
    // "A big storm hits and lightning strikes you for 1d6 points of damage" -- floored at 1 HP,
    // same "can hurt but not kill" precedent payTravelCost()'s own provisions-shortfall damage
    // already established for environmental World-map effects outside a dungeon.
    const damage = rollDie(rng);
    return {
      resources: { ...spent, hp: Math.max(1, spent.hp - damage) },
      message: `Lightning strikes you for ${damage} damage!`,
    };
  }
  if (roll === 2) {
    return { resources: spent, message: "Nothing happens..." };
  }
  if (roll === 3) {
    // "An owl follows you... it doesn't count towards the limit of animals you can have" --
    // pushed unconditionally, bypassing MAX_ANIMALS entirely (unlike Knight's "Gain a Horse",
    // which silently no-ops if the cap is already full -- this Owl is explicitly cap-exempt).
    return {
      resources: { ...spent, animals: [...spent.animals, "Owl"] },
      message: "An owl follows you, unbound by the usual limit on animals.",
    };
  }
  if (roll === 4 || roll === 5) {
    // "+1 damage on all attacks on the next dungeon exploration you make" -- stacks if rolled more
    // than once before that next exploration actually starts (no cap mentioned in the rulebook).
    return {
      resources: { ...spent, nextDungeonDamageBonus: spent.nextDungeonDamageBonus + 1 },
      message: "A divine light illuminates you -- your next dungeon exploration deals +1 damage.",
    };
  }
  return {
    resources: { ...spent, hp: spent.hp + 4, maxHp: spent.maxHp + 4 },
    message: "A light descends from the sky. You permanently gain +4 HP.",
  };
}

// -- "Different Cultures" (docs/game-rules-reference.md lines 941-952): one bonus City Action per
// culture, on top of the base Rest/Buy/Sell/Fix set above. Several of these reference systems this
// codebase doesn't have (Curses, hand-economy, day-passage) -- per the project's own established
// precedent (`bladeTrap`'s flavor-only roll-of-2, `WeaponEntry.twoHanded` unenforced), those parts
// resolve as flavor-only rather than triggering new engine work; see each function's own comment.

const HUMAN_CURSE_REMOVAL_COST = 200;
export function canRemoveCurse(resources: AdventurerResources): boolean {
  return resources.coins >= HUMAN_CURSE_REMOVAL_COST;
}
/** Human: "Can eliminate a Curse or Cursed Item for 200 coins." No curse system exists anywhere in
 * this codebase (nothing carries a "cursed" flag) -- a pure, flavor-only coin sink. */
export function removeCurse(resources: AdventurerResources): AdventurerResources {
  return { ...resources, coins: resources.coins - HUMAN_CURSE_REMOVAL_COST };
}

const DWARF_LAMP_COST = 40;
/** Named once so the buy action and the not-already-owned check (issue #109) can't drift apart. */
const DWARF_LAMP_NAME = "Dwarven Lamp";
export function canBuyLamp(resources: AdventurerResources): boolean {
  // Issue #109: a Lamp is a permanent, unique utility item -- a second one is meaningless by
  // definition, and with no ownership check a Dwarf with coins could buy an unbounded pile of them,
  // each competing for a Pack slot. Same not-already-owned shape `canAcquireAdvancedClass()` uses.
  if (ownsLamp(resources)) return false;
  return resources.coins >= DWARF_LAMP_COST;
}

export function ownsLamp(resources: AdventurerResources): boolean {
  return resources.heldItems.some((item) => item.name === DWARF_LAMP_NAME);
}
/** Dwarf: "Buy a Lamp for 40 coins. With the lamp you can use both hands in combat." Two-handed
 * weapons are already tracked-but-unenforced (`WeaponEntry.twoHanded`, no hand-economy system) --
 * a flavor-only keepsake added to the Pack, same shape as any other `HeldItem`. */
export function buyLamp(resources: AdventurerResources): AdventurerResources {
  return {
    ...resources,
    coins: resources.coins - DWARF_LAMP_COST,
    heldItems: [...resources.heldItems, { name: DWARF_LAMP_NAME, worth: 5 }],
  };
}

const ELVEN_BOOTS_COST = 60;
export function canBuyElvenBoots(resources: AdventurerResources): boolean {
  return resources.coins >= ELVEN_BOOTS_COST;
}
/** Elf: "Buy a pair of Elven Boots (2 HP) for 60 coins. With them you can only spend 1 provision to
 * move through forests." A real `ArmorPiece` in the existing "boots" slot (can be damaged/fixed
 * normally, same as any dungeon-found boots -- the rulebook's "can't wear two of the same piece"
 * rule isn't enforced anywhere else in this codebase either, so buying a second pair over an
 * already-equipped one isn't specially guarded against here). The travel discount itself is
 * `hasElvenBoots()` below, checked by `WorldScreen.tsx`'s travel-cost caller. */
export function buyElvenBoots(resources: AdventurerResources): AdventurerResources {
  return {
    ...resources,
    coins: resources.coins - ELVEN_BOOTS_COST,
    armor: [...resources.armor, { piece: "boots", hp: 2, maxHp: 2, itemName: "Elven Boots" }],
  };
}

/** True once `resources.armor` includes a pair of Elven Boots -- a case-insensitive `itemName`
 * substring match, the same precedent already established for monster-tag matching. Checked by
 * `WorldScreen.tsx`'s travel-cost caller directly, not baked into `travelCost()` itself (a
 * World-map-only concern, not a dungeon-combat `ItemEffect` one). */
export function hasElvenBoots(resources: AdventurerResources): boolean {
  return resources.armor.some((p) => p.itemName?.toLowerCase().includes("elven boots"));
}

/** Ziggurat's "Feathered Boots" Wonder (issue #30): "Spend 1 provision on swamps" -- a dungeon-found
 * item rather than a Town purchase, but the identical travel-cost-override shape Elven Boots
 * already established (checked by `WorldScreen.tsx`'s travel-cost caller the same way). */
export function hasFeatheredBoots(resources: AdventurerResources): boolean {
  return resources.armor.some((p) => p.itemName?.toLowerCase().includes("feathered boots"));
}

const GNOME_SPELL_COST = 80;
export function canLearnRandomSpell(resources: AdventurerResources): boolean {
  return resources.coins >= GNOME_SPELL_COST;
}
/** Gnome: "Learn a random Basic Magic for 80 coins." Fully real -- rolls a spell exactly like
 * Character Creation's own random-spell rolls (`rollSpell()`) and grants 1 use of it. */
export function learnRandomSpell(
  resources: AdventurerResources,
  rng: RNG = Math.random,
): AdventurerResources {
  const { entry } = rollSpell(rng);
  const key = spellKey(entry.table, entry.roll);
  return {
    ...resources,
    coins: resources.coins - GNOME_SPELL_COST,
    spellUses: { ...resources.spellUses, [key]: (resources.spellUses[key] ?? 0) + 1 },
    // Raises the ceiling too (issue #75), same as every other spell-granting site -- otherwise
    // this never shows up in CharacterSheet's Spells list and a later Rest wipes it out.
    maxSpellUses: { ...resources.maxSpellUses, [key]: (resources.maxSpellUses[key] ?? 0) + 1 },
  };
}

const GOBLIN_POTION_COST = 30;
export interface VerdosaPotionResult {
  resources: AdventurerResources;
  healed: boolean;
}
/** `isOgre`: "Cannot use potions, scrolls or wear armor" (issue #60) -- this is a City Action tied
 * to a Goblin-culture city, not the drinker's own race, so an Ogre visiting one could otherwise
 * still buy and drink this. */
export function canDrinkVerdosaPotion(resources: AdventurerResources, isOgre = false): boolean {
  return !isOgre && resources.coins >= GOBLIN_POTION_COST;
}
/** Goblin: "Buy a Verdosa Potion for 30 coins. When drinking, roll a die. If it's 3 or more you
 * regain all your HP. If not you will be itchy for a whole day." Drunk immediately (not
 * inventoried, matching "when drinking"); the itchy outcome is flavor-only -- no day-passage
 * system exists to model it against. */
export function drinkVerdosaPotion(
  resources: AdventurerResources,
  rng: RNG = Math.random,
): VerdosaPotionResult {
  const roll = rollDie(rng);
  const spent = { ...resources, coins: resources.coins - GOBLIN_POTION_COST };
  if (roll >= 3) return { resources: { ...spent, hp: spent.maxHp }, healed: true };
  return { resources: spent, healed: false };
}

const ORC_GLADIO_COST = 70;
export function canBuyOrcGladio(resources: AdventurerResources): boolean {
  return resources.coins >= ORC_GLADIO_COST;
}
/** Orc: "Buy an Orc Gladio (1d6+1 damage) for 70 coins." Fully real -- overwrites the equipped
 * weapon, same precedent as finding a better one in a dungeon (no equip-swap UI, you use what you
 * just got). */
export function buyOrcGladio(resources: AdventurerResources): AdventurerResources {
  return {
    ...resources,
    coins: resources.coins - ORC_GLADIO_COST,
    weapon: { name: "Orc Gladio", formula: "1d6+1" },
  };
}

/** "Hire Boat: spend 1 coin." The actual water-crossing capability lives on `WorldState.hasBoat`
 * (see `hexReducer.ts`'s `HIRE_BOAT` action) -- this only spends the coin. */
export function canHireBoat(resources: AdventurerResources): boolean {
  return resources.coins >= 1;
}
export function hireBoat(resources: AdventurerResources): AdventurerResources {
  return { ...resources, coins: resources.coins - 1 };
}

// -- "Getting Money" (issue #58, `docs/game-rules-reference.md` lines 1025-1071): mini-games for a
// broke character. Unlike everything above, Gamble's life-bet can kill the character outright --
// town.ts has no notion of "the character is dead" (that's App.tsx's job, the only place with both
// a `character` and the authority to clear the session/write the Graveyard), so a lethal outcome is
// surfaced as a result field instead of applied here. See `TownDeathCause` in `graveyard.ts`.

/** "Hard work: In a city, spend a few years working hard for more than daily bread. Permanently
 * lose 1 HP and gain 1d6+1 coins." "Permanently" -- unlike every other HP loss in this game, Rest
 * can't undo this, so it comes out of `maxHp` itself (current `hp` clamped down to match if it was
 * already at the old max), not just current HP. Guarded so `maxHp` can never drop to 0 -- the
 * rulebook doesn't list this as a way to die, unlike Gamble/Thug Life/Arena. City-only per the
 * rulebook's own wording (unlike Gamble, which explicitly says "city or fortress") -- callers gate
 * this on `!isFortressLocation(...)`. */
export function canHardWork(resources: AdventurerResources): boolean {
  return resources.maxHp > 1;
}
export function hardWork(
  resources: AdventurerResources,
  rng: RNG = Math.random,
): AdventurerResources {
  const maxHp = resources.maxHp - 1;
  return {
    ...resources,
    maxHp,
    hp: Math.min(resources.hp, maxHp),
    coins: resources.coins + rollDie(rng) + 1,
  };
}

export interface GambleResult {
  resources: AdventurerResources;
  outcome: "won" | "lost" | "survivedLifeBet" | "diedLifeBet";
}
/** "Gamble: In a city or fortress, spend 1 coin and roll a die. If you roll 6 you get 6 coins; if
 * less, you get nothing. If you don't have money, you can bet your life. If you drop less than 6,
 * someone kills you...; if you drop 6 you stay alive and earn 5 coins." Always offered -- which of
 * the two sub-games runs is decided by `resources.coins` itself, matching the rulebook's own "if
 * you don't have money" framing (not a separate action to pick). `diedLifeBet` leaves `resources`
 * untouched; the caller (`TownScreen`, via `onCharacterDied`) is responsible for the actual death --
 * see the block comment above. */
export function gamble(resources: AdventurerResources, rng: RNG = Math.random): GambleResult {
  if (resources.coins >= 1) {
    const spent = { ...resources, coins: resources.coins - 1 };
    if (rollDie(rng) === 6)
      return { resources: { ...spent, coins: spent.coins + 6 }, outcome: "won" };
    return { resources: spent, outcome: "lost" };
  }
  if (rollDie(rng) === 6) {
    return { resources: { ...resources, coins: resources.coins + 5 }, outcome: "survivedLifeBet" };
  }
  return { resources, outcome: "diedLifeBet" };
}

export interface ThugLifeResult {
  resources: AdventurerResources;
  /** Same "town.ts doesn't know the character is dead" split as Gamble's `diedLifeBet` -- `died`
   * leaves `resources` untouched either way; the caller owns the actual death flow. */
  died: boolean;
  /** True on a successful-but-caught escape -- the caller applies the actual hex ban via
   * `hexState.ts`'s `withBannedHex()`, since town.ts has no notion of hexes/WorldState. */
  banned: boolean;
  outcome: "killed" | "diedEscaping" | "fled" | "coins" | "treasure";
  /** Only set for `outcome === "coins"`. */
  amount?: number;
}

/** "Thug Life: Steal money from travelers. In a city roll 2d6, in a fortress roll 3d6, and compare
 * with the table below" -- "Table: Stealing from Travelers." The 15-18 "Crypt/Sanctuary/Palace
 * Treasure!" rows are only reachable on 3d6 (a city's 2d6 tops out at 12) and are flattened to a
 * generic `treasures` credit -- this codebase has no per-dungeon-type Treasure concept to hand out
 * one of specifically, same flavor-simplification precedent as `bladeTrap`'s roll-of-2 or
 * `DUNGEON_TYPE_BY_TERRAIN`'s thematic substitutions. The 5-7 jail row's "lose 1d6 HP... if you are
 * still alive, you have fled" can itself be lethal -- checked here rather than left for the caller,
 * since it's the same roll that determines both the HP loss and whether the escape succeeds. */
export function resolveThugLife(
  resources: AdventurerResources,
  isFortress: boolean,
  rng: RNG = Math.random,
): ThugLifeResult {
  const dice = isFortress ? 3 : 2;
  let roll = 0;
  for (let i = 0; i < dice; i++) roll += rollDie(rng);

  if (roll <= 4) return { resources, died: true, banned: false, outcome: "killed" };
  if (roll <= 7) {
    const hpLoss = rollDie(rng);
    if (resources.hp - hpLoss <= 0) {
      return { resources, died: true, banned: false, outcome: "diedEscaping" };
    }
    return {
      resources: { ...resources, hp: resources.hp - hpLoss },
      died: false,
      banned: true,
      outcome: "fled",
    };
  }
  if (roll === 8) return coinsResult(resources, 2);
  if (roll === 9) return coinsResult(resources, 5);
  if (roll === 10) return coinsResult(resources, 7);
  if (roll <= 12) return coinsResult(resources, 10);
  if (roll <= 14) return coinsResult(resources, 20);
  return {
    resources: { ...resources, treasures: resources.treasures + 1 },
    died: false,
    banned: false,
    outcome: "treasure",
  };
}

function coinsResult(resources: AdventurerResources, amount: number): ThugLifeResult {
  return {
    resources: { ...resources, coins: resources.coins + amount },
    died: false,
    banned: false,
    outcome: "coins",
    amount,
  };
}

// -- Advanced Classes (issue #23): town actions gated on having acquired a specific class, same
// "optional flag" shape as isBlacksmith/isCatPerson above.

const ALCHEMIST_POTION_COST = 50;
/** Alchemist: "Spending 50 coins makes 1 Health Potion." No inventory/potion-use system exists
 * anywhere in this codebase (Treasures' own Health Potion resolves as an instant heal-to-full the
 * moment it's opened, not a stored item) -- brewing one here follows that same precedent, healing
 * immediately rather than adding a `HeldItem` with no way to later "use" it. */
/** `isOgre`: "Cannot use potions, scrolls or wear armor" (issue #60) -- Alchemist is an Advanced
 * Class, acquirable independent of race, so an Ogre could otherwise still brew and drink one. */
export function canBrewHealthPotion(
  resources: AdventurerResources,
  isAlchemist: boolean,
  isOgre = false,
): boolean {
  return (
    !isOgre &&
    isAlchemist &&
    resources.coins >= ALCHEMIST_POTION_COST &&
    resources.hp < resources.maxHp
  );
}
export function brewHealthPotion(resources: AdventurerResources): AdventurerResources {
  return { ...resources, coins: resources.coins - ALCHEMIST_POTION_COST, hp: resources.maxHp };
}
