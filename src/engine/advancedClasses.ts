import { ADVANCED_CLASS_TABLE } from "../data/advancedClasses.ts";
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
  Ruthless: (ctx) => (ctx.resources.killsByName["imps"] ?? 0) >= 10,
  Goblinator: (ctx) => (ctx.resources.killsByName["goblins"] ?? 0) >= 20,
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
 * Ghostbuster's first-turn Intangible immunity), so falls through untouched. */
function applyAdvancedClassAbility(
  name: string,
  resources: AdventurerResources,
  rng: RNG,
): AdventurerResources {
  switch (name) {
    case "Mage":
      return grantSpellUses(resources, "basic", 4, rng);
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
