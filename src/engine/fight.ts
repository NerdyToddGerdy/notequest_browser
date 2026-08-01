import type { Draft } from "immer";
import { ARMOR_PIECE_LABELS, type ItemEffect, type MonsterAbility } from "../data/dungeonTables.ts";
import { MUTATION_IDS } from "../data/mutations.ts";
import {
  checkUndeadRevival,
  HEAL_AMOUNT,
  parseWeaponFormula,
  resolvePlayerAttack,
  resolveSpellDamage,
  rollLoot,
  type CombatEvent,
} from "./combat.ts";
import { rollDie } from "./dice.ts";
import type {
  ArmorPiece,
  CombatMonsterState,
  CombatState,
  Consumable,
  EquippedWeapon,
} from "./dungeonState.ts";
import type { RNG } from "./rng.ts";

/** The shared combat core (issue #120).
 *
 * Everything here used to live inside `dungeonReducer.ts`, reading and writing a
 * `Draft<DungeonState>` directly -- which is why a fight could only happen inside a dungeon. Events
 * on Travel (#91) and the Arena (#58) each grew their own smaller, parallel implementation instead,
 * and those implementations silently dropped armor, spells, attack bonuses, the Hireling and every
 * animal. For the Arena that was a defensible scoping call (you choose to enter). For a wilderness
 * Event it wasn't: the encounter is mandatory, so a player was forced into a fight without the
 * character they had built.
 *
 * The seam is `Fighter`: the character-side state a fight actually reads. `DungeonState` and
 * `AdventurerResources` both satisfy it structurally, so the same functions serve a dungeon room, a
 * hex in the wilderness and an Arena bout without any of them knowing which they're in.
 *
 * What deliberately *isn't* here: anything about where the fight happens. Segments, remains, loot
 * tables, `alive`/`deathCause` and the Graveyard all stay with their own owners -- this module
 * reports that the fighter went down and lets the caller decide what that means.
 */

/** The character-side fields a fight reads and writes. Optional members are the ones `DungeonState`
 * carries but `AdventurerResources` doesn't, or vice versa; every read defaults them. */
export interface Fighter {
  hp: number;
  maxHp: number;
  coins: number;
  treasures: number;
  keys: number;
  torches: number;
  monsterKills: number;
  bossKills: number;
  killsByName: Record<string, number>;
  killsByAbility: Partial<Record<MonsterAbility, number>>;
  armor: ArmorPiece[];
  weapon: EquippedWeapon | null;
  raceName: string;
  className: string;
  advancedClasses: string[];
  animals: string[];
  hireling: string | null;
  hirelingHp?: number | null;
  spellUses: Record<string, number>;
  maxSpellUses: Record<string, number>;
  milestones: { hasCastSpell: boolean; hasCastColdRay: boolean; hasHadArmorDestroyed: boolean };
  mutations?: string[];
  zombieRevivals?: number;
  consumables?: Consumable[];
  /** Ziggurat's Effect of the Forgotten Gods (issue #30) -- a whole-run bonus, dungeon-only today. */
  runDamageBonus?: number;
}

/** Where a combat message goes. The dungeon appends to its own roll log; Town/World panels keep a
 * short transcript of their own. Passing it in is what keeps this module free of `DungeonState`. */
export type FightLog = (message: string, variant?: "normal" | "descend") => void;

export function matchesTags(monster: Draft<CombatMonsterState>, tags: string[]): boolean {
  const name = monster.name.toLowerCase();
  return tags.some((tag) => name.includes(tag.toLowerCase()));
}

/** Ogre's "cannot wear armor," reachable by mutation too (issue #30). */
export function cannotWearArmor(fighter: Fighter): boolean {
  return fighter.raceName === "Ogre" || (fighter.mutations ?? []).includes(MUTATION_IDS.noArmor);
}

export function equippedEffects(fighter: Fighter): ItemEffect[] {
  const effects: ItemEffect[] = [];
  if (fighter.weapon?.bonusEffect) effects.push(fighter.weapon.bonusEffect);
  for (const piece of fighter.armor) {
    if (piece.effect) effects.push(piece.effect);
  }
  return effects;
}

const ASSASSIN_FIRST_HIT_MULTIPLIER = 3;

/** `isHorn`: Rinoceroid's horn attack bypasses the equipped weapon entirely, so it skips any
 * weapon-specific bonus effect -- general combat buffs (Potion of Fury, Grave Digger) still apply. */
export function attackBonus(
  fighter: Fighter,
  combat: Draft<CombatState> | null,
  monster: Draft<CombatMonsterState>,
  isHorn = false,
): number {
  // Ziggurat's Effect of the Forgotten Gods (issue #30): "+1 damage on all attacks" for the whole
  // run, unlike combat.playerDamageBonus's per-fight scope.
  let bonus = (combat?.playerDamageBonus ?? 0) + (fighter.runDamageBonus ?? 0);
  // Grave Digger (base Class) and Gravedigger (Advanced Class, issue #23) are two separate
  // rulebook entries that happen to grant the identical "+2 damage to Undead" bonus -- either one
  // (or both) applies the same single +2, not stacked.
  if (
    (fighter.className === "Grave Digger" || fighter.advancedClasses.includes("Gravedigger")) &&
    monster.abilities.includes("undead")
  ) {
    bonus += 2;
  }
  // Ogre (New Races, issue #22): "Deals +2 damage." Unconditional, unlike Grave Digger's
  // Undead-only bonus above -- the rulebook doesn't restrict it to any monster type or weapon.
  if (fighter.raceName === "Ogre") {
    bonus += 2;
  }
  // Minstrel (Hireling, issue #25): "Can play music in combat (+2 damage)." Unconditional, same
  // shape as Ogre's own +2 above.
  if (fighter.hireling === "Minstrel") {
    bonus += 2;
  }
  // Dwarf Soldier (Hireling, issue #25): "Deals +1 damage against Orcs and Goblins." Reuses the
  // exact tag-substring-match mechanism the equipped-item effects below already establish.
  if (fighter.hireling === "Dwarf Soldier" && matchesTags(monster, ["orc", "goblin"])) {
    bonus += 1;
  }
  // Helsing (Advanced Class, issue #71): "+1 damage against Vampires and Ghouls" -- the identical
  // tags the Garlic necklace item's own damageBonusVsTag effect already uses.
  if (fighter.advancedClasses.includes("Helsing") && matchesTags(monster, ["vampire", "ghoul"])) {
    bonus += 1;
  }
  // Bugcatcher (Advanced Class, issue #71): "+1 damage against insects and arachnids" -- matches
  // the same curated spider/scorpion/wasp names its kill-count requirement sums (see
  // advancedClasses.ts's BUG_MONSTER_NAMES), as a substring so plural/boss variants match too.
  if (
    fighter.advancedClasses.includes("Bugcatcher") &&
    matchesTags(monster, ["spider", "scorpion", "wasp"])
  ) {
    bonus += 1;
  }
  if (isHorn) return bonus;
  for (const effect of equippedEffects(fighter)) {
    if (effect.kind === "weaponDamageBonus") {
      bonus += effect.amount;
    } else if (effect.kind === "damageBonusVsTag" && matchesTags(monster, effect.tags)) {
      bonus += effect.amount;
    }
  }
  return bonus;
}

/** Multiplier applied to just the weapon's own roll (e.g. "[Weapon] of the Dragon Slayer: Double
 * damage against Dragons"), before `attackBonus` is added. */
export function attackMultiplier(
  fighter: Fighter,
  monster: Draft<CombatMonsterState>,
  isHorn = false,
  isFirstAttack = false,
): number {
  let multiplier = 1;
  // Assassin (Advanced Class, issue #103): "Deals 3 times damage on your first attack." Checked
  // *before* the isHorn early return below, because this is a class ability rather than an equipped
  // weapon's effect -- a Rinoceroid's horn skips the weapon, not the character's own training.
  if (isFirstAttack && fighter.advancedClasses.includes("Assassin")) {
    multiplier *= ASSASSIN_FIRST_HIT_MULTIPLIER;
  }
  if (isHorn) return multiplier;
  for (const effect of equippedEffects(fighter)) {
    if (effect.kind === "damageMultiplierVsTag" && matchesTags(monster, effect.tags)) {
      multiplier *= effect.multiplier;
    }
  }
  return multiplier;
}

/** True if any equipped item (weapon or armor) ignores this specific monster ability. */
export function ignoresAbility(fighter: Fighter, ability: MonsterAbility): boolean {
  return equippedEffects(fighter).some(
    (effect) => effect.kind === "ignoresMonsterAbility" && effect.ability === ability,
  );
}

/** Every monster ability ignored by an equipped item, e.g. Boatman's Oar bypassing Intangible's
 * damage-parity block -- fed into `resolvePlayerAttack`'s defensive-ability filter. */
export function ignoredAbilities(fighter: Fighter): MonsterAbility[] {
  return equippedEffects(fighter)
    .filter(
      (effect): effect is Extract<ItemEffect, { kind: "ignoresMonsterAbility" }> =>
        effect.kind === "ignoresMonsterAbility",
    )
    .map((effect) => effect.ability);
}

/** True once at least one equipped armor piece can actually absorb something. */
export function hasUsableArmor(fighter: Fighter): boolean {
  return fighter.armor.some((piece) => piece.hp > 0);
}

/** The three death-survival abilities, in the order they've always been checked: Samambro's roll,
 * then a Raven's, then the zombie mutation (not a roll -- it always fires while there's HP left to
 * halve, so the rollable chances are spent first).
 *
 * Returns true if the character lives after all, having already set `hp`. Moving this into the
 * shared core means a Samambro now survives a Wyvern in the wilderness too, which they didn't
 * before -- wilderness fights never consulted any of these (issue #120). */
export function trySurviveDeath(fighter: Fighter, rng: RNG, log: FightLog): boolean {
  if (fighter.raceName === "Samambro" && rollDie(rng) >= 3) {
    fighter.hp = 1;
    log("Samambro's resilience pulls you back from the brink -- you survive with 1 HP!");
    return true;
  }
  if (fighter.animals.includes("Raven") && rollDie(rng) >= 4) {
    fighter.hp = 1;
    log("Your Raven circles back with an omen -- you survive with 1 HP!");
    return true;
  }
  if ((fighter.mutations ?? []).includes(MUTATION_IDS.zombie)) {
    const revivals = fighter.zombieRevivals ?? 0;
    const hp = Math.floor(fighter.maxHp / 2 ** (revivals + 1));
    if (hp >= 1) {
      fighter.hp = hp;
      fighter.zombieRevivals = revivals + 1;
      log(`Rotten flesh knits itself back together -- you rise again with ${hp} HP.`, "descend");
      return true;
    }
  }
  return false;
}

/** What a monster round did, for the caller to act on. `died` is the only thing this module can't
 * finish itself: a dungeon leaves remains and flips `alive`, the World writes a Graveyard entry. */
export interface MonsterTurnResult {
  died: boolean;
  /** True when damage is waiting on a `RESOLVE_DAMAGE` choice -- the round isn't over yet. */
  awaitingAbsorption: boolean;
}

/** One full monster round. Every defensive rule lives here: Poison bypassing armor, Ethereal Body's
 * reduction, Magic Shield, Deathtouch, Paralyze, and the armor-or-HP-or-Hireling choice. */
export function applyMonsterTurn(
  fighter: Fighter,
  combat: Draft<CombatState>,
  rng: RNG,
  log: FightLog,
): MonsterTurnResult {
  // Issue #84: this is the one chokepoint every round-ending action already calls, so it's where
  // HIRELING_ATTACK's once-per-round cap resets for whatever round comes next. ANIMAL_ATTACK
  // (issue #67/#29) reuses the identical shape for Snake.
  combat.hirelingAttackedThisRound = false;
  combat.animalAttackedThisRound = false;

  // Poison: "All damage from this creature cannot be absorbed by armor or other means" -- tallied
  // apart from every other monster's damage, which the player may still choose to absorb.
  // Pirate (Advanced Class, issue #72): "Ignores Poison" -- the damage still lands, but no longer
  // bypasses armor, so it folds into absorbableDamage below instead of the poison-only pool.
  // Pirate's "ignores Poison" and the green-blood mutation (issue #30) grant the identical effect --
  // one OR'd condition, the same "two entries, one bonus" precedent as Grave Digger/Gravedigger.
  const ignoresPoison =
    fighter.advancedClasses.includes("Pirate") ||
    (fighter.mutations ?? []).includes(MUTATION_IDS.poisonImmune);
  let poisonDamage = 0;
  let absorbableDamage = 0;
  let deathtouchKill = false;
  let paralyzeTurns = 0;
  for (const monster of combat.monsters) {
    // Vimes/Paralyze (New Spells, issue #61): a silenced monster skips its attack entirely, same
    // as a Cold Ray freeze, but for multiple rounds -- decremented once per round regardless of
    // whether it actually had a turn to skip yet (silencedTurns already accounts for this round).
    if (monster.silencedTurns > 0) {
      monster.silencedTurns -= 1;
    } else if (!monster.skipNextAttack && monster.hp > 0) {
      // Ethereal Body (New Spells, issue #61): "all damage you take is reduced by 1 point," applied
      // per monster hit -- floored at 0, so it can't turn a hit into healing.
      const dmg = Math.max(0, monster.damage + monster.bonusDamage - combat.damageReduction);
      if (monster.abilities.includes("poison") && !ignoresPoison) {
        poisonDamage += dmg;
      } else {
        absorbableDamage += dmg;
      }
      if (monster.deathtouchPending) deathtouchKill = true;
      if (monster.paralyzePending > paralyzeTurns) paralyzeTurns = monster.paralyzePending;
    }
    monster.bonusDamage = 0;
    monster.deathtouchPending = false;
    monster.paralyzePending = 0;
    monster.skipNextAttack = false;
  }

  // Deathtouch "kills you" outright per the rulebook -- armor doesn't get a say.
  if (deathtouchKill) {
    fighter.hp = 0;
    if (trySurviveDeath(fighter, rng, log)) return { died: false, awaitingAbsorption: false };
    log("A deathly touch stops your heart instantly.", "descend");
    return { died: true, awaitingAbsorption: false };
  }

  if (paralyzeTurns > 0) {
    combat.paralyzedTurns += paralyzeTurns;
    log(`You are paralyzed for ${paralyzeTurns} turn${paralyzeTurns > 1 ? "s" : ""}!`);
  }

  // Applied first and unconditionally so a fatal poison tick doesn't leave a moot absorption
  // choice pending for whatever non-poison damage landed in the same round.
  if (poisonDamage > 0) {
    fighter.hp = Math.max(0, fighter.hp - poisonDamage);
    log(`Poison courses through you for ${poisonDamage} damage.`);
  }

  // Magic Shield (New Spells, issue #61): "it can absorb 4 damage points. Can cast more than one" --
  // drains the oldest shield first, spilling into the next, before offering the normal
  // armor-or-HP choice; poison already bypassed this pool entirely above, same as it bypasses
  // armor ("cannot be absorbed by armor or other means"). Depleted shields are dropped.
  while (absorbableDamage > 0 && combat.shields.length > 0) {
    const absorbed = Math.min(absorbableDamage, combat.shields[0]!);
    combat.shields[0] = combat.shields[0]! - absorbed;
    absorbableDamage -= absorbed;
    if (combat.shields[0] === 0) combat.shields.shift();
  }

  if (fighter.hp > 0 && absorbableDamage > 0) {
    // "Reduce this value from your HP (or armor's HP, if you're using one -- your call)": with
    // usable armor equipped -- or, issue #84, a living Hireling -- defer to RESOLVE_DAMAGE instead
    // of subtracting HP immediately.
    if (hasUsableArmor(fighter) || (combat.hireling && combat.hireling.hp > 0)) {
      combat.pendingDamage = absorbableDamage;
      log(`The monsters strike for ${absorbableDamage} damage -- choose what absorbs it.`);
      return { died: false, awaitingAbsorption: true };
    }
    fighter.hp = Math.max(0, fighter.hp - absorbableDamage);
    log(`The monsters strike back for ${absorbableDamage} damage.`);
  }
  if (fighter.hp <= 0) {
    if (trySurviveDeath(fighter, rng, log)) return { died: false, awaitingAbsorption: false };
    log("You fall in combat, overwhelmed by your foes.", "descend");
    return { died: true, awaitingAbsorption: false };
  }
  return { died: false, awaitingAbsorption: false };
}

/** Resolves a pending absorption choice: onto HP, onto one of `armor`'s indices, or onto the
 * employed Hireling. Returns whether the fighter died taking it. */
export function resolveDamageChoice(
  fighter: Fighter,
  combat: Draft<CombatState>,
  absorbWith: "hp" | "hireling" | number,
  rng: RNG,
  log: FightLog,
): { died: boolean; armorDestroyed: boolean } {
  if (combat.pendingDamage === null) return { died: false, armorDestroyed: false };
  const amount = combat.pendingDamage;
  combat.pendingDamage = null;
  let armorDestroyed = false;

  if (absorbWith === "hp") {
    fighter.hp = Math.max(0, fighter.hp - amount);
  } else if (absorbWith === "hireling") {
    // Issue #84: mirrors the armor-piece branch's exact overflow-to-HP shape. A Hireling reduced to
    // 0 HP is gone for good -- clearing the top-level field too, so its status line and any later
    // fight correctly show no Hireling, matching "you pay to face just one dungeon" rather than a
    // temporary knockout.
    const h = combat.hireling;
    if (!h) return { died: false, armorDestroyed: false };
    const absorbed = Math.min(amount, h.hp);
    h.hp -= absorbed;
    const overflow = amount - absorbed;
    if (overflow > 0) fighter.hp = Math.max(0, fighter.hp - overflow);
    log(
      h.hp <= 0
        ? `${h.name} absorbs ${absorbed} damage and falls!`
        : `${h.name} absorbs ${absorbed} damage (${h.hp}/${h.maxHp} HP left).`,
    );
    // The single place a Hireling's HP ever drops, so the single place the persisted value needs
    // writing back (issue #114) -- it has to survive this fight ending.
    if (h.hp <= 0) {
      fighter.hireling = null;
      fighter.hirelingHp = null;
    } else {
      fighter.hirelingHp = h.hp;
    }
  } else {
    const piece = fighter.armor[absorbWith];
    if (!piece) return { died: false, armorDestroyed: false };
    const absorbed = Math.min(amount, piece.hp);
    piece.hp -= absorbed;
    const overflow = amount - absorbed;
    if (overflow > 0) fighter.hp = Math.max(0, fighter.hp - overflow);
    const label = piece.itemName ?? ARMOR_PIECE_LABELS[piece.piece];
    log(
      piece.hp <= 0
        ? `Your ${label} absorbs ${absorbed} damage and is destroyed!`
        : `Your ${label} absorbs ${absorbed} damage (${piece.hp}/${piece.maxHp} HP left).`,
    );
    if (piece.hp <= 0) armorDestroyed = true;
  }

  if (fighter.hp <= 0) {
    if (trySurviveDeath(fighter, rng, log)) return { died: false, armorDestroyed };
    log("You fall in combat, overwhelmed by your foes.", "descend");
    return { died: true, armorDestroyed };
  }
  return { died: false, armorDestroyed };
}

// --- Running a fight -----------------------------------------------------------------------------
//
// Everything below orchestrates a whole round. `dungeonReducer.ts` keeps its own orchestration,
// because a dungeon fight also touches segments, remains, room state and the loot-per-segment
// bookkeeping none of which exist elsewhere -- but the *rules* it applies are the ones above.
// Events and the Arena use these, so a wilderness fight is now the same fight, with the same
// character, as one in a dungeon.

/** A fresh `CombatState`. `segId` is `-1` outside a dungeon: nothing out there reads it, and the
 * alternative -- making it nullable -- would ripple through every dungeon site for no gain. */
export function createCombatState(opts: {
  monsters: CombatMonsterState[];
  segId?: number;
  isBoss?: boolean;
  hireling?: { name: string; hp: number; maxHp: number } | null;
}): CombatState {
  return {
    segId: opts.segId ?? -1,
    monsters: opts.monsters,
    paralyzedTurns: 0,
    pendingLootRolls: 0,
    isBoss: opts.isBoss ?? false,
    outcome: "ongoing",
    pendingDamage: null,
    playerDamageBonus: 0,
    engulfableBodies: 0,
    damageReduction: 0,
    shields: [],
    absorbSoulActive: false,
    fireOfTheDeadActive: false,
    hireling: opts.hireling ?? null,
    hirelingAttackedThisRound: false,
    animalAttackedThisRound: false,
    playerHasAttacked: false,
  };
}

/** Removes a monster reduced to 0 HP, resolving Undead revival and tallying the kill. The dungeon
 * has its own copy of this that additionally queues per-segment loot; the two agree on every
 * character-side effect (kill counters, Slimemen bodies, Cook's coin). */
export function handleDefeat(
  fighter: Fighter,
  combat: Draft<CombatState>,
  monster: Draft<CombatMonsterState>,
  rng: RNG,
  log: FightLog,
  bypassRevival = false,
): void {
  if (monster.hp > 0) return;
  const revived =
    !bypassRevival && !ignoresAbility(fighter, "undead") && checkUndeadRevival(monster, rng);
  if (revived) {
    monster.hp = 1;
    log(`${monster.name} rises again with 1 HP!`);
    return;
  }
  if (monster.abilities.includes("loot")) combat.pendingLootRolls += 1;
  combat.monsters = combat.monsters.filter((m) => m.id !== monster.id);
  fighter.monsterKills += 1;
  if (combat.isBoss) fighter.bossKills += 1;
  const nameKey = monster.name.toLowerCase();
  fighter.killsByName[nameKey] = (fighter.killsByName[nameKey] ?? 0) + 1;
  for (const ability of monster.abilities) {
    fighter.killsByAbility[ability] = (fighter.killsByAbility[ability] ?? 0) + 1;
  }
  log(`${monster.name} is defeated!`);
  combat.engulfableBodies += 1; // Slimemen's engulf-for-full-HP -- no Undead exception in the rulebook
  if (fighter.className === "Cook" && !monster.abilities.includes("undead")) {
    fighter.coins += 1;
    log("Cook's instincts: +1 coin from the kill.");
  }
}

/** The monster-mutating half of an attack's events -- Firebreath's queued counter, Regeneration's
 * heal, Sorcery's bonus damage. Shared so a wilderness monster behaves like a dungeon one. */
function applyAttackEvents(
  monster: Draft<CombatMonsterState>,
  events: CombatEvent[],
  log: FightLog,
): void {
  for (const event of events) {
    switch (event.kind) {
      case "firebreath":
        monster.bonusDamage += 10;
        log(`${monster.name} draws breath -- its next attack will burn.`);
        break;
      case "sorcery":
        monster.bonusDamage += event.bonus;
        log(`${monster.name} weaves a spell -- its next attack hits harder.`);
        break;
      case "regeneration":
        monster.hp = Math.min(monster.maxHp, monster.hp + event.amount);
        log(`${monster.name} regenerates ${event.amount} HP.`);
        break;
      case "deathtouch":
        monster.deathtouchPending = true;
        log(`${monster.name} reaches for your throat...`);
        break;
      case "paralyze":
        monster.paralyzePending = Math.max(monster.paralyzePending, event.turns);
        break;
      default:
        break;
    }
  }
}

/** What one round did. `died` is the caller's to act on, exactly like `MonsterTurnResult`. */
export interface FightRoundResult {
  died: boolean;
  victory: boolean;
  awaitingAbsorption: boolean;
}

/** A whole round outside a dungeon: the player's attack, then the monsters'. Every rule the dungeon
 * applies applies here -- attack bonuses, weapon effects, defensive abilities, Assassin's opener,
 * armor absorption, the Hireling, poison, shields, paralysis and the survival abilities. */
export function fightRound(
  fighter: Draft<Fighter>,
  combat: Draft<CombatState>,
  targetId: number,
  rawRoll: number,
  weaponFormula: string,
  rng: RNG,
  log: FightLog,
  opts: { isHorn?: boolean } = {},
): FightRoundResult {
  if (combat.outcome !== "ongoing" || combat.pendingDamage !== null) {
    return { died: false, victory: false, awaitingAbsorption: combat.pendingDamage !== null };
  }
  if (combat.paralyzedTurns > 0) {
    combat.paralyzedTurns -= 1;
    log("You are paralyzed and cannot act this turn.");
    return finishRound(fighter, combat, rng, log);
  }
  const monster = combat.monsters.find((m) => m.id === targetId);
  if (!monster || monster.hp <= 0) {
    return { died: false, victory: false, awaitingAbsorption: false };
  }

  const isHorn = opts.isHorn ?? false;
  const isFirstAttack = !combat.playerHasAttacked;
  combat.playerHasAttacked = true;

  const { modifier } = isHorn ? { modifier: 0 } : parseWeaponFormula(weaponFormula);
  const baseTotal = Math.max(0, rawRoll + modifier);
  const total =
    baseTotal * attackMultiplier(fighter, monster, isHorn, isFirstAttack) +
    attackBonus(fighter, combat, monster, isHorn);
  if (isFirstAttack && fighter.advancedClasses.includes("Assassin")) {
    log("You strike before they know you're there — triple damage!");
  }
  const atk = resolvePlayerAttack(
    monster,
    rawRoll,
    total,
    rng,
    isHorn ? [] : ignoredAbilities(fighter),
  );

  // `resolvePlayerAttack` reports the damage; applying it is the caller's job, the same split the
  // dungeon reducer makes at each of its own nine attack sites.
  monster.hp = Math.max(0, monster.hp - atk.damageDealt);

  if (atk.selfDestructDamageToPlayer > 0) {
    // Goblinator (Advanced Class, issue #23): "Take -2 damage per Explosion."
    const damage = fighter.advancedClasses.includes("Goblinator")
      ? Math.max(0, atk.selfDestructDamageToPlayer - 2)
      : atk.selfDestructDamageToPlayer;
    log(`${monster.name} explodes, dealing ${damage} damage to you!`);
    fighter.hp = Math.max(0, fighter.hp - damage);
  } else if (atk.damageDealt > 0) {
    log(`You hit ${monster.name} for ${atk.damageDealt} damage.`);
  } else {
    log(`Your attack fails to harm ${monster.name}.`);
  }

  if (!atk.monsterDefeated) applyAttackEvents(monster, atk.events, log);
  handleDefeat(fighter, combat, monster, rng, log);

  // Explosive can defeat the monster *and* kill the player in the same blast, so death is checked
  // before victory -- the one real bugfix `arena.ts` contributed, kept here.
  if (fighter.hp <= 0) {
    if (!trySurviveDeath(fighter, rng, log)) {
      combat.outcome = "defeat";
      return { died: true, victory: false, awaitingAbsorption: false };
    }
  }
  return finishRound(fighter, combat, rng, log);
}

/** Victory check, then the monsters' turn. Split out so a paralyzed round takes the same path. */
function finishRound(
  fighter: Draft<Fighter>,
  combat: Draft<CombatState>,
  rng: RNG,
  log: FightLog,
): FightRoundResult {
  if (combat.monsters.length === 0) {
    payOutVictory(fighter, combat, rng, log);
    combat.outcome = "victory";
    return { died: false, victory: true, awaitingAbsorption: false };
  }
  const turn = applyMonsterTurn(fighter, combat, rng, log);
  if (turn.died) combat.outcome = "defeat";
  return { died: turn.died, victory: false, awaitingAbsorption: turn.awaitingAbsorption };
}

/** Loot and the deferred victory triggers. The dungeon pays out Treasures/building tax on top; this
 * is the part every fight shares. */
export function payOutVictory(
  fighter: Draft<Fighter>,
  combat: Draft<CombatState>,
  rng: RNG,
  log: FightLog,
): void {
  if (combat.absorbSoulActive && combat.engulfableBodies > 0) {
    const healed = Math.min(5 * combat.engulfableBodies, fighter.maxHp - fighter.hp);
    fighter.hp += healed;
    log(`Absorb Soul restores ${healed} HP from the fallen.`);
  }
  if (combat.fireOfTheDeadActive && combat.engulfableBodies > 0) {
    fighter.torches += 2 * combat.engulfableBodies;
    log("Fire of the Dead: the corpses burn as torches.");
  }
  if (combat.pendingLootRolls > 0) {
    const loot = rollLoot(combat.pendingLootRolls, rng);
    fighter.coins += loot.coins;
    fighter.treasures += loot.treasures;
    fighter.keys += loot.keys;
    const parts = [
      loot.coins > 0 ? `${loot.coins} coin${loot.coins === 1 ? "" : "s"}` : null,
      loot.treasures > 0 ? `${loot.treasures} Treasure${loot.treasures === 1 ? "" : "s"}` : null,
      loot.keys > 0 ? `${loot.keys} Key${loot.keys === 1 ? "" : "s"}` : null,
    ].filter((p): p is string => p !== null);
    if (parts.length > 0) log(`You loot ${parts.join(", ")} from the fallen.`);
    combat.pendingLootRolls = 0;
  }
}

/** A free Hireling attack, capped once per round (issue #84). */
export function hirelingAttack(
  fighter: Draft<Fighter>,
  combat: Draft<CombatState>,
  targetId: number,
  roll: number,
  damageModifier: number,
  rng: RNG,
  log: FightLog,
): void {
  const h = combat.hireling;
  if (!h || h.hp <= 0 || combat.hirelingAttackedThisRound) return;
  const monster = combat.monsters.find((m) => m.id === targetId);
  if (!monster || monster.hp <= 0) return;
  combat.hirelingAttackedThisRound = true;
  const result = resolveSpellDamage(monster, Math.max(0, roll + damageModifier));
  monster.hp = Math.max(0, monster.hp - result.damageDealt);
  if (result.damageDealt > 0) {
    log(`${h.name} hits ${monster.name} for ${result.damageDealt} damage.`);
  } else {
    log(`${h.name}'s attack fails to harm ${monster.name}.`);
  }
  handleDefeat(fighter, combat, monster, rng, log);
}

/** Snake's poison bite (issue #26/#67) -- a flat, free bonus attack with no HP of its own at stake. */
export function animalAttack(
  fighter: Draft<Fighter>,
  combat: Draft<CombatState>,
  targetId: number,
  damage: number,
  rng: RNG,
  log: FightLog,
): void {
  if (combat.animalAttackedThisRound) return;
  const monster = combat.monsters.find((m) => m.id === targetId);
  if (!monster || monster.hp <= 0) return;
  combat.animalAttackedThisRound = true;
  const result = resolveSpellDamage(monster, damage);
  monster.hp = Math.max(0, monster.hp - result.damageDealt);
  log(
    result.damageDealt > 0
      ? `Your Snake bites ${monster.name} for ${result.damageDealt} damage.`
      : `Your Snake's bite fails to harm ${monster.name}.`,
  );
  handleDefeat(fighter, combat, monster, rng, log);
}

/** Every combat spell's effect, shared by the dungeon and the wilderness (issue #120). Teleport is
 * deliberately absent: in a dungeon it needs a destination segment, and out in the world the
 * equivalent escape is fleeing -- so each caller handles it, and everything else lives here once.
 *
 * Returns false for a spell this doesn't know, so a caller can tell "cast and resolved" from
 * "nothing happened." */
export function castCombatSpell(
  fighter: Draft<Fighter>,
  combat: Draft<CombatState> | null,
  spellName: string,
  targetId: number | undefined,
  rng: RNG,
  log: FightLog,
  maxTorches: number,
): boolean {
  switch (spellName) {
    case "Heal": {
      const healed = Math.min(HEAL_AMOUNT, fighter.maxHp - fighter.hp);
      fighter.hp += healed;
      log(`You cast Heal, recovering ${healed} HP.`);
      return true;
    }
    // Natural Cure (Nature 1, issue #61): "Recovers 12 HP" -- Heal's identical shape, bigger amount.
    case "Natural Cure": {
      const healed = Math.min(12, fighter.maxHp - fighter.hp);
      fighter.hp += healed;
      log(`You cast Natural Cure, recovering ${healed} HP.`);
      return true;
    }
    case "Light": {
      // "Worth a torch (does not use a hand)" -- modeled as a free torch, since this codebase
      // collapses light-source and hand-economy into the single torches count.
      const gained = Math.min(1, maxTorches - fighter.torches);
      fighter.torches += gained;
      log(
        gained > 0
          ? "You cast Light, conjuring a globe worth a torch."
          : `You cast Light, but you're already carrying the maximum ${maxTorches} torches.`,
      );
      return true;
    }
    default:
      break;
  }
  if (!combat) return false;

  switch (spellName) {
    case "Cold Ray": {
      const monster = combat.monsters.find((m) => m.id === targetId);
      if (!monster) return false;
      const result = resolveSpellDamage(monster, 4);
      monster.hp = Math.max(0, monster.hp - result.damageDealt);
      monster.skipNextAttack = true;
      log(
        result.blocked
          ? `Cold Ray fails to harm ${monster.name} (${result.blocked}), but it freezes in place.`
          : `Cold Ray strikes ${monster.name} for ${result.damageDealt} damage, freezing it in place.`,
      );
      handleDefeat(fighter, combat, monster, rng, log);
      return true;
    }
    // Magic Blast (Advanced 10, issue #61) is Lightning's identical single-target shape, with a
    // bigger amount and no freeze -- one branch, keyed off the name.
    case "Lightning":
    case "Magic Blast": {
      const monster = combat.monsters.find((m) => m.id === targetId);
      if (!monster) return false;
      const result = resolveSpellDamage(monster, spellName === "Lightning" ? 6 : 12);
      monster.hp = Math.max(0, monster.hp - result.damageDealt);
      log(
        result.blocked
          ? `${spellName} fails to harm ${monster.name} (${result.blocked}).`
          : `${spellName} strikes ${monster.name} for ${result.damageDealt} damage.`,
      );
      handleDefeat(fighter, combat, monster, rng, log);
      return true;
    }
    // Vimes (Nature 2, issue #61): "Leaves a monster without attacking for 1d6 turns."
    case "Vimes": {
      const monster = combat.monsters.find((m) => m.id === targetId);
      if (!monster) return false;
      const turns = rollDie(rng);
      monster.silencedTurns = turns;
      log(`You cast Vimes, silencing ${monster.name} for ${turns} turns.`);
      return true;
    }
    // Paralyze (Advanced 5, issue #61): Vimes' mechanism, room-wide and at a fixed duration.
    case "Paralyze": {
      log("You cast Paralyze, freezing every monster in the room for 2 turns.");
      for (const monster of combat.monsters) monster.silencedTurns = 2;
      return true;
    }
    // Ethereal Body (Death 1 / Advanced 12): -1 to every hit; doesn't stack from a second cast.
    case "Ethereal Body": {
      combat.damageReduction = Math.max(combat.damageReduction, 1);
      log("You cast Ethereal Body, dulling every blow against you.");
      return true;
    }
    // Magic Shield (Advanced 8): each cast is its own independently-depleting pool.
    case "Magic Shield": {
      combat.shields.push(4);
      log("You cast Magic Shield, conjuring a barrier that can absorb 4 damage.");
      return true;
    }
    case "Absorb Soul": {
      combat.absorbSoulActive = true;
      log("You cast Absorb Soul -- victory here will restore your HP.");
      return true;
    }
    case "Fire of the Dead": {
      combat.fireOfTheDeadActive = true;
      log("You cast Fire of the Dead -- victory here will grant you torches.");
      return true;
    }
    // Insect Rain (Nature 6 / Advanced 2) is Fireball's room-wide shape at a different amount.
    case "Fireball":
    case "Insect Rain": {
      const damage = spellName === "Fireball" ? 5 : 7;
      log(
        spellName === "Fireball"
          ? "You cast Fireball, engulfing the room in flame."
          : "You cast Insect Rain, swarming the room with biting insects.",
      );
      for (const monster of [...combat.monsters]) {
        const result = resolveSpellDamage(monster, damage);
        monster.hp = Math.max(0, monster.hp - result.damageDealt);
        if (result.blocked) log(`${monster.name} is unharmed (${result.blocked}).`);
        else if (result.damageDealt > 0) log(`${monster.name} takes ${result.damageDealt} damage.`);
        handleDefeat(fighter, combat, monster, rng, log);
      }
      return true;
    }
    // Banish the Dead (Death 3): destroys each Undead outright, bypassing the damage math and the
    // Undead ability's own revival roll.
    case "Banish the Dead": {
      const undead = combat.monsters.filter((m) => m.abilities.includes("undead"));
      if (undead.length === 0) {
        log("You cast Banish the Dead, but no Undead linger here.");
        return true;
      }
      log("You cast Banish the Dead, destroying every Undead in the room.");
      for (const monster of undead) {
        monster.hp = 0;
        handleDefeat(fighter, combat, monster, rng, log, true);
      }
      return true;
    }
    default:
      return false;
  }
}

/** A held potion's effect, wherever it's drunk (issues #110/#120). Every branch is the code that
 * used to run at the moment of discovery, and every one of them is character-side, so the
 * wilderness gets it for free. `maxTorches` is passed rather than imported to keep this module free
 * of `town.ts`. */
export function applyConsumableEffect(
  fighter: Draft<Fighter>,
  combat: Draft<CombatState> | null,
  item: Consumable,
  rng: RNG,
  log: FightLog,
  maxTorches = 10,
): void {
  switch (item.effect.kind) {
    case "healAll": {
      const healed = fighter.maxHp - fighter.hp;
      fighter.hp = fighter.maxHp;
      log(`You drink the ${item.name}${healed > 0 ? ` (+${healed} HP)` : ""}.`);
      break;
    }
    case "healAmount": {
      const healed = Math.min(item.effect.amount, fighter.maxHp - fighter.hp);
      fighter.hp += healed;
      log(`You drink the ${item.name}${healed > 0 ? ` (+${healed} HP)` : ""}.`);
      break;
    }
    case "restoreAllSpells": {
      fighter.spellUses = { ...fighter.maxSpellUses };
      log(`You drink the ${item.name} -- every spell is restored.`);
      break;
    }
    case "restoreRandomSpellUse": {
      const knownKeys = Object.keys(fighter.spellUses);
      if (knownKeys.length === 0) {
        log(`You use the ${item.name}, but you don't know any spells yet.`);
        break;
      }
      const key = knownKeys[rollDie(rng) % knownKeys.length]!;
      const max = fighter.maxSpellUses[key] ?? fighter.spellUses[key]!;
      fighter.spellUses[key] = Math.min(max, (fighter.spellUses[key] ?? 0) + 1);
      log(`You use the ${item.name} -- it recovers a spell use.`);
      break;
    }
    case "grantsTorches": {
      const gained = Math.min(item.effect.amount, maxTorches - fighter.torches);
      fighter.torches += gained;
      log(`You use the ${item.name} (+${gained} torch${gained === 1 ? "" : "es"}).`);
      break;
    }
    case "grantTorchesRoll": {
      let rolled = 0;
      for (let i = 0; i < item.effect.dice; i++) rolled += rollDie(rng);
      const gained = Math.min(rolled, maxTorches - fighter.torches);
      fighter.torches += gained;
      log(`You use the ${item.name} (+${gained} torch${gained === 1 ? "" : "es"}).`);
      break;
    }
    case "combatDamageBonus": {
      // The item that made #110 worth building: outside a fight this used to be discarded outright.
      if (combat) {
        combat.playerDamageBonus += item.effect.amount;
        log(`You drink the ${item.name} -- +${item.effect.amount} damage this fight!`);
      } else {
        log(`You drink the ${item.name}, but there's no one to fight.`);
      }
      break;
    }
  }
}
