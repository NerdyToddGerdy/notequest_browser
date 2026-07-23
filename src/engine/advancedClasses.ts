import { ADVANCED_CLASS_TABLE } from "../data/advancedClasses.ts";
import type { ArmorPieceKind } from "../data/dungeonTables.ts";
import type { CreatedCharacter } from "../data/types.ts";
import type { GraveyardEntry } from "./graveyard.ts";
import { parseSpellKey, rollSpellFromTable, spellKey, SPELL_TABLE_BY_KEY } from "./character.ts";
import type { AdventurerResources } from "./town.ts";
import type { RNG } from "./rng.ts";

/** Advanced Classes (Expanded World, issue #23) -- unlike Race/Class tables, these are purchased
 * with coins in a City/Fortress rather than rolled, and a character can stack up as many as they
 * like (never the same one twice). This mirrors `arena.ts`'s precedent of a self-contained engine
 * module rather than folding a large system into `town.ts` directly. */

export interface AdvancedClassContext {
  resources: AdventurerResources;
  character: CreatedCharacter;
  /** World-scoped, like the Graveyard itself -- only used for Gravedigger's "lost another
   * character" check (the currently-alive character can't be in it yet, so any entry present
   * necessarily belongs to a previous character). */
  graveyard: GraveyardEntry[];
}

/** Every spell key (`character.ts`'s `spellKey()` composite) the character currently knows, live
 * in this run -- read from `resources.spellUses` rather than `character.spells`/`fixedGrants`
 * alone, since an Advanced Class or a Gnome's `learnRandomSpell()` can grant more spells mid-game
 * that should count toward a later "know N spells" requirement too. A spent-to-0 spell's key stays
 * in the object, so this correctly still counts as "known." */
function knownSpellKeys(resources: AdventurerResources): string[] {
  return Object.keys(resources.spellUses);
}

function knownSpellNames(resources: AdventurerResources): Set<string> {
  const names = new Set<string>();
  for (const key of knownSpellKeys(resources)) {
    const { table, roll } = parseSpellKey(key);
    const spell = SPELL_TABLE_BY_KEY[table]?.[roll];
    if (spell) names.add(spell.name);
  }
  return names;
}

/** Requirement predicates for the Advanced Classes this app can honestly check today -- every
 * other entry in `ADVANCED_CLASS_TABLE` is either blocked on a small counter this pass deliberately
 * doesn't add yet (opened-locks, sold-an-item, per-terrain travel counts, ...) or a whole unbuilt
 * system (Buildings/Politics/Sewers/Arena history/a prior-class death check) -- see the issue #23
 * follow-up for the full breakdown. Only classes listed here are ever acquirable; every other one
 * always reads as "not yet trackable" via `isAdvancedClassTrackable()` below. */
const REQUIREMENT_CHECKS: Partial<Record<string, (ctx: AdvancedClassContext) => boolean>> = {
  // Imps are always 2d6 (minimum roll 2), so a solo "Imp" kill can never happen -- no singular
  // form to sum here, unlike Goblinator below.
  Ruthless: (ctx) => (ctx.resources.killsByName["imps"] ?? 0) >= 10,
  // Goblins are 1d6, so a lone kill logs as "goblin" (singular, issue #65) rather than "goblins" --
  // both forms have to be summed or a run full of solo-Goblin rooms would silently undercount.
  Goblinator: (ctx) =>
    (ctx.resources.killsByName["goblins"] ?? 0) + (ctx.resources.killsByName["goblin"] ?? 0) >= 20,
  // "Having lost another character" -- the currently-alive character can't be in the Graveyard yet
  // (a character is only recorded there at the moment they die), so any entry at all necessarily
  // belongs to a previous character.
  Gravedigger: (ctx) => ctx.graveyard.length > 0,
  Orcslayer: (ctx) =>
    (ctx.resources.killsByName["orc king"] ?? 0) > 0 ||
    (ctx.resources.killsByName["orc leader"] ?? 0) > 0,
  Dragonslayer: (ctx) => (ctx.resources.killsByName["dragon"] ?? 0) > 0,
  Guard: (ctx) => ctx.resources.monsterKills >= 3,
  Ghostbuster: (ctx) => (ctx.resources.killsByAbility.intangible ?? 0) >= 10,
  // "Having faced an undead" -- approximated as having *killed* one, since this app doesn't track
  // monsters merely encountered (only defeated ones), the same documented simplification used
  // elsewhere in this codebase for requirements the rulebook phrases more loosely than the engine
  // can currently observe.
  Cleric: (ctx) => (ctx.resources.killsByAbility.undead ?? 0) >= 1,
  Ambidextrous: (ctx) => ctx.resources.bossKills >= 2,
  Warrior: (ctx) => ctx.resources.bossKills >= 1,
  Champion: (ctx) => ctx.resources.bossKills >= 4,
  Multidextrous: (ctx) => ctx.resources.advancedClasses.includes("Ambidextrous"),
  // "Be a Knight or a Cleric" -- Knight itself isn't buildable yet (it needs Noble, which needs
  // Buildings/Politics), but the Cleric half of this OR is fully checkable on its own, so the
  // requirement as a whole is still honestly answerable.
  Paladin: (ctx) => ctx.resources.advancedClasses.includes("Cleric"),
  "Anti-Paladin": (ctx) => ctx.resources.advancedClasses.includes("Paladin"),
  Mage: (ctx) => {
    let count = 0;
    for (const key of knownSpellKeys(ctx.resources)) if (key.startsWith("basic:")) count++;
    return count >= 3;
  },
  Elementalist: (ctx) => {
    const names = knownSpellNames(ctx.resources);
    return names.has("Fireball") && names.has("Cold Ray");
  },
  Alchemist: (ctx) => knownSpellKeys(ctx.resources).length >= 4,
  Arcane: (ctx) => knownSpellKeys(ctx.resources).length >= 6,
  // "Find all pieces of an armor" -- checkable straight from resources.armor with no new state at
  // all: the 5 real body slots (excluding "ring", a documented 0-HP dud roll, and "wonderItem",
  // which isn't a standard body slot -- see CLAUDE.md's Armor & Weapons note) all present at once.
  Collector: (ctx) => {
    const real: ArmorPieceKind[] = ["bracelets", "boots", "shoulderpads", "helm", "breastplate"];
    const owned = new Set(ctx.resources.armor.map((a) => a.piece));
    return real.every((piece) => owned.has(piece));
  },
  Scholar: (ctx) => ctx.resources.milestones.hasCastSpell,
  Merchant: (ctx) => ctx.resources.milestones.hasSoldItem,
  Necromancer: (ctx) => ctx.resources.milestones.hasCastColdRay,
  Blacksmith: (ctx) => ctx.resources.milestones.hasHadArmorDestroyed,
  Gladiator: (ctx) => ctx.resources.milestones.hasFoughtInArena,
  Thief: (ctx) => ctx.resources.milestones.locksOpened >= 4,
  // "Be Necromancer and have killed a Lich" -- no monster is named exactly "Lich" (the closest is
  // Tomb's boss "Lich King of the Ethernal Wars"), so this is a substring match against
  // killsByName, the same "no formal taxonomy" precedent Armor & Weapons' tag-matching already
  // established, layered on top of the existing "chain on an already-acquired class" pattern
  // Paladin/Anti-Paladin use.
  Necromaster: (ctx) =>
    ctx.resources.advancedClasses.includes("Necromancer") &&
    Object.entries(ctx.resources.killsByName).some(
      ([name, count]) => name.includes("lich") && count > 0,
    ),
  Assassin: (ctx) =>
    ctx.resources.advancedClasses.includes("Thief") && ctx.resources.bossKills >= 1,
  // Lumberjack/Druid: the identical lifetime forest-hexes-crossed signal at two thresholds.
  Lumberjack: (ctx) => ctx.resources.travelStats.forestsCrossed >= 2,
  Druid: (ctx) => ctx.resources.travelStats.forestsCrossed >= 6,
  Survivor: (ctx) => ctx.resources.travelStats.desertsCrossed >= 2,
  Pirate: (ctx) => ctx.resources.travelStats.territoriesSailed >= 5,
  // Distinct cities/fortresses visited, not a raw travel count -- see TravelStats.citiesVisited.
  Bard: (ctx) => ctx.resources.travelStats.citiesVisited.length >= 3,
  Cook: (ctx) => ctx.resources.travelStats.provisionsSpentTotal >= 20,
  // "Avenged the death of a relative" -- no family/relative concept exists anywhere in this game
  // (issue #73), so this is approximated as "a previous character exists in the (world-scoped)
  // Graveyard" -- the same signal Gravedigger's own "lost another character" already checks, just
  // under different flavor text. A documented simplification, same tier as Cleric's "faced an
  // undead" (approximated as having killed one).
  Avenger: (ctx) => ctx.graveyard.length > 0,
  // "Be Necromaster and having died" -- as written this is a paradox (the buyer is alive, in Town,
  // acquiring it), so it's read instead as a genuinely cross-character, world-scoped check: did
  // *any* past character die while holding the Necromancer class? `GraveyardEntry.advancedClasses`
  // (issue #73) is optional for the same back-compat reason every other Graveyard field is, so an
  // entry recorded before this field existed simply never satisfies this (rather than throwing).
  Lich: (ctx) => ctx.graveyard.some((entry) => entry.advancedClasses?.includes("Necromancer")),
};

/** Whether this Advanced Class has a real requirement check at all -- every other entry in
 * `ADVANCED_CLASS_TABLE` is authored (for flavor/completeness in the UI) but permanently
 * unacquirable in this version. */
export function isAdvancedClassTrackable(name: string): boolean {
  return name in REQUIREMENT_CHECKS;
}

export function meetsAdvancedClassRequirement(name: string, ctx: AdvancedClassContext): boolean {
  const check = REQUIREMENT_CHECKS[name];
  return check ? check(ctx) : false;
}

export function canAcquireAdvancedClass(ctx: AdvancedClassContext, name: string): boolean {
  const def = ADVANCED_CLASS_TABLE[name];
  if (!def) return false;
  if (ctx.resources.advancedClasses.includes(name)) return false;
  if (ctx.resources.coins < def.cost) return false;
  return meetsAdvancedClassRequirement(name, ctx);
}

/** Rolls `count` spells from `table` and adds one use of each to `resources.spellUses` -- shared
 * with `hirelings.ts` (Rent Wizard/Elf Soldier/Gnome Helper's "cast N random Basic Spells"), since
 * both are the identical "grant N random spell uses at hire/acquire time" shape. */
export function grantSpellUses(
  resources: AdventurerResources,
  table: Parameters<typeof rollSpellFromTable>[0],
  count: number,
  rng: RNG,
): AdventurerResources {
  const spellUses = { ...resources.spellUses };
  for (let i = 0; i < count; i++) {
    const { entry } = rollSpellFromTable(table, rng);
    const key = spellKey(entry.table, entry.roll);
    spellUses[key] = (spellUses[key] ?? 0) + 1;
  }
  return { ...resources, spellUses };
}

/** Applies the acquired class's ability, where it grants something mechanically real (see
 * CLAUDE.md's Advanced Classes note for the full list) -- every other class in `REQUIREMENT_CHECKS`
 * either has no ability ("None.") or one left flavor-only (Ambidextrous/Multidextrous's dual-wield,
 * Ghostbuster's first-turn Intangible immunity, Collector's "sell an armor piece for 5 coins" --
 * would need a new sell action on `Equipment`'s armor list, no precedent for selling armor exists
 * yet -- and Assassin's "3x damage on your first attack," which would need a new `CombatState`
 * field to track "has this fight's first attack happened yet"), so falls through untouched. */
function applyAdvancedClassAbility(
  name: string,
  resources: AdventurerResources,
  rng: RNG,
): AdventurerResources {
  switch (name) {
    case "Mage":
      return grantSpellUses(resources, "basic", 4, rng);
    // Scholar's own random-Basic-spell grant, same shape as Mage's just a smaller count -- unlike
    // Mage, Scholar's requirement (`hasCastSpell`) is what unblocked this, not the spell count itself.
    case "Scholar":
      return grantSpellUses(resources, "basic", 3, rng);
    case "Cleric": {
      const key = spellKey("basic", 1); // Heal
      return { ...resources, spellUses: { ...resources.spellUses, [key]: (resources.spellUses[key] ?? 0) + 2 } };
    }
    case "Paladin": {
      const key = spellKey("basic", 1); // Heal
      return { ...resources, spellUses: { ...resources.spellUses, [key]: (resources.spellUses[key] ?? 0) + 3 } };
    }
    case "Anti-Paladin": {
      // "Gains 4 Death Spells but loses all Healing spells" -- Heal is the only spell in this
      // codebase that heals today, so it's the only one zeroed out.
      const withDeath = grantSpellUses(resources, "death", 4, rng);
      const healKey = spellKey("basic", 1);
      return { ...withDeath, spellUses: { ...withDeath.spellUses, [healKey]: 0 } };
    }
    case "Elementalist":
      return grantSpellUses(resources, "elemental", 4, rng);
    case "Arcane":
      return grantSpellUses(resources, "advanced", 4, rng);
    // Necromancer and Necromaster (its own chained-on class, see REQUIREMENT_CHECKS) grant the
    // identical "4 random Death Spells" -- same shape as Anti-Paladin's own Death Spell grant.
    case "Necromancer":
    case "Necromaster":
    case "Lich":
      return grantSpellUses(resources, "death", 4, rng);
    // Druid's own random-Nature-spell grant, same shape as Mage/Elementalist/Arcane/Scholar.
    case "Druid":
      return grantSpellUses(resources, "nature", 4, rng);
    // Bard: "Gain 3 uses of the Paralyze Advanced Spell" -- a fixed grant, not random, same shape
    // as Cleric/Paladin's fixed Heal grant. Paralyze (advanced:5) has no "Cast" button yet (issue
    // #61 -- New Spells' still-deferred effects), so this correctly tracks the uses without doing
    // anything mechanical until that spell itself is wired up, the same "tracked but not castable"
    // state every other deferred New Spell is already in.
    case "Bard": {
      const key = spellKey("advanced", 5); // Paralyze
      return { ...resources, spellUses: { ...resources.spellUses, [key]: (resources.spellUses[key] ?? 0) + 3 } };
    }
    default:
      return resources;
  }
}

/** Spends the coin cost, stacks the class onto `advancedClasses`, applies its HP bonus to both
 * current and max HP (a permanent buff, same "direct maxHp mutation" precedent as `hardWork()`'s
 * permanent HP loss), then applies whichever ability above is mechanically real. Returns the
 * resources unchanged if `canAcquireAdvancedClass()` would reject it. */
export function acquireAdvancedClass(
  ctx: AdvancedClassContext,
  name: string,
  rng: RNG = Math.random,
): AdventurerResources {
  if (!canAcquireAdvancedClass(ctx, name)) return ctx.resources;
  const def = ADVANCED_CLASS_TABLE[name]!;
  const withPurchase: AdventurerResources = {
    ...ctx.resources,
    coins: ctx.resources.coins - def.cost,
    advancedClasses: [...ctx.resources.advancedClasses, name],
    maxHp: ctx.resources.maxHp + def.hpBonus,
    hp: ctx.resources.hp + def.hpBonus,
  };
  return applyAdvancedClassAbility(name, withPurchase, rng);
}
