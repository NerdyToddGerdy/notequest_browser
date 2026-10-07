/**
 * Room Content and Reward tables: Wonders, Potions, Magic Items, curiosities, and finishing a room
 * once its content is resolved.
 *
 * Split out of `dungeonReducer.ts` (issue #144), which still owns every action -- these are the
 * helpers its cases share. Behavior is unchanged; only where the code lives moved.
 */
import type { Draft } from "immer";
import {
  ARMOR_PIECE_LABELS,
  ARMOR_TABLE,
  substituteItemPlaceholder,
  DUNGEON_TABLES,
  type MagicItemEntry,
  type MonsterTemplate,
  type PotionEntry,
  type RoomContentReward,
  type WonderEntry,
} from "../../data/dungeonTables.ts";
import { SPELL_TABLE } from "../../data/spells.ts";
import { rollSpellFromTable, spellKey } from "../character.ts";
import { buildConnector, placeChild } from "../dungeon.ts";
import { rollDie } from "../dice.ts";
import { trySurviveDeath } from "../fight.ts";
import { resolveMonsterCount } from "../combat.ts";
import {
  isHoldableItemEffect,
  type Direction,
  type DungeonState,
  type LevelState,
  type SegmentState,
} from "../dungeonState.ts";
import { rollMutationEntry } from "../mutations.ts";
import { MAX_TORCHES } from "../town.ts";
import type { RNG } from "../rng.ts";
import { bumpStatsForNewSegment, pushLog, leaveRemains, dungeonLog, buildSegment } from "./core.ts";
import { addArmorPiece, addHeldItem, addConsumable, cannotWearArmor } from "./inventory.ts";
import { startCombatIfMonsters } from "./combat.ts";

/** "Health Potion (Recovers all HP)." -> "Health Potion". The Wonders column carries a real `name`;
 * the Treasure column only has its printed text, and the parenthetical is the effect description. */
export function rewardItemName(text: string): string {
  return text.split(" (")[0]!.replace(/\.$/, "").trim();
}

/** Ogre "cannot use potions" -- the two holdable Treasure outcomes that are actually potions, so an
 * Ogre keeps #83's sell-instead path rather than stowing one it could never drink. Torches and the
 * Ziggurat's Strange Fruit aren't in any of Ogre's three restricted categories. */
export const OGRE_RESTRICTED_REWARD_KINDS: ReadonlySet<string> = new Set([
  "healAll",
  "restoreAllSpells",
]);

/** Issue #83: flat placeholder worth for an Ogre-unusable potion/scroll outcome that has no coin
 * value of its own to draw on (unlike armor, which at least has a `maxHp` to derive one from) --
 * matches the scale of this dungeon type's other small heldValue Treasures (Religious Object/
 * Sinister Idol, 3 coins). */
export const OGRE_UNUSABLE_TREASURE_WORTH = 3;

/** A Wonder either grants its own HP-bearing item (Jester Hat, 2 HP) or a standing ability with
 * nothing else to attach to (Amulet of the Dead) -- both become a `draft.armor` entry (0 HP for
 * the latter, so it's never offered as a damage-absorption choice but still equipped/trackable and
 * checked by whichever system its effect concerns), except `combatDamageBonus`/`grantsTorches`/
 * `randomSpell`, which apply immediately (to the active fight, the torch count, or spellUses
 * respectively) rather than lingering as an item. */
export function resolveWonder(draft: Draft<DungeonState>, entry: WonderEntry, rng: RNG): void {
  // Ogre (New Races, issue #60): "Cannot use potions, scrolls or wear armor" -- every Wonder
  // outcome that would otherwise grant *something* (a worn trinket, or an immediate potion/scroll/
  // combat-buff effect) is one of exactly those three restricted things, so instead of vanishing
  // outright it becomes a sellable HeldItem (issue #83) -- worth taken from the item's own HP pool
  // where it has one (a worn trinket), else a flat placeholder matching this dungeon type's other
  // small heldValue Treasures (Religious Object/Sinister Idol, 3 coins) for the potion/scroll-shaped
  // outcomes that never had a coin value of their own to draw on. A pure-flavor Wonder with no
  // `grantsHp` (e.g. "Lamp") grants nothing to anyone, Ogre included, so it's excluded here. Pyramid's
  // (issue #30) `rerollBaseTable: "weapon"` and Citadel's `grantsWeapon` are also excluded -- Ogre
  // "still fully benefits from [Weapon] of X items... since the restriction never mentions weapons,"
  // same as Magic Items.
  const isOgreUnusable =
    draft.raceName === "Ogre" &&
    entry.grantsWeapon === undefined &&
    (entry.grantsHp !== undefined || entry.effect.kind !== "flavor") &&
    !(entry.effect.kind === "rerollBaseTable" && entry.effect.table === "weapon") &&
    // The Master key (issue #95) is a key, not armor, a potion or a scroll -- none of the three
    // things Ogre "cannot use" -- so it's kept rather than sold. This is the first Wonder that fits
    // neither side of #83's wear-it-or-sell-it split, and the exemption is deliberately narrow: it
    // names the one effect rather than widening the rule.
    entry.effect.kind !== "opensAnyLock";
  if (isOgreUnusable) {
    const worth =
      entry.grantsHp !== undefined ? Math.max(1, entry.grantsHp) : OGRE_UNUSABLE_TREASURE_WORTH;
    addHeldItem(
      draft,
      { name: entry.name, worth },
      `Treasure: ${entry.text} Ogres cannot use this -- sold instead.`,
    );
    return;
  }
  if (entry.grantsWeapon) {
    // Citadel's Reward table (issue #30): "Orc Machete (1d6+1 Damage)" -- the one Wonders-column
    // row that's a plain weapon rather than a wearable trinket.
    draft.spareWeapons.push({
      name: entry.grantsWeapon.name,
      formula: entry.grantsWeapon.formula,
      twoHanded: entry.grantsWeapon.twoHanded,
    });
    pushLog(draft, `Treasure: ${entry.text}`);
    return;
  }
  // Issue #110: a Wonder that's really a potion is stowed rather than drunk on the spot. Gated on
  // `grantsHp === undefined` so a *wearable* trinket that also heals stays a trinket, and reached only
  // after the Ogre branch above, which sells these instead.
  if (entry.grantsHp === undefined && isHoldableItemEffect(entry.effect)) {
    addConsumable(
      draft,
      { name: entry.name, text: entry.text, effect: entry.effect },
      `Treasure: ${entry.text}`,
      rng,
    );
    return;
  }
  if (entry.grantsHp !== undefined) {
    addArmorPiece(draft, {
      piece: "wonderItem",
      hp: entry.grantsHp,
      maxHp: entry.grantsHp,
      itemName: entry.name,
      effect: entry.effect,
    });
  } else if (entry.effect.kind === "combatDamageBonus") {
    // OPEN_TREASURE is "usable anytime, not tied to a room" (see CLAUDE.md), so opening one
    // outside a fight is normal, expected usage -- but this bonus only means anything mid-fight,
    // so it's simply wasted rather than banked for whatever fight comes next.
    if (draft.combat) {
      draft.combat.playerDamageBonus += entry.effect.amount;
    } else {
      pushLog(
        draft,
        `Treasure: ${entry.text} No fight is happening right now, so it has no effect.`,
      );
      return;
    }
  } else if (entry.effect.kind === "grantsTorches") {
    const gained = Math.min(entry.effect.amount, MAX_TORCHES - draft.torches);
    draft.torches += gained;
  } else if (entry.effect.kind === "healAmount") {
    // Ziggurat's "Addictive Sweet Drink" (issue #30): "Recovers 1 HP" -- applied immediately, same
    // shape as grantsTorches above, not banked as a worn item.
    const healed = Math.min(entry.effect.amount, draft.maxHp - draft.hp);
    draft.hp += healed;
  } else if (entry.effect.kind === "rerollBaseTable") {
    // Pyramid's Wonders column (issue #30): "[Roll in the 'Armor'/'Weapon' table]" -- an ordinary
    // find, no bonus layered on (unlike a Magic Item's own "[Armor] of X" shape).
    if (entry.effect.table === "armor") {
      const roll = rollDie(rng);
      const base = ARMOR_TABLE[roll]!;
      addArmorPiece(draft, { piece: base.piece, hp: base.maxHp, maxHp: base.maxHp });
      pushLog(
        draft,
        `Treasure: ${entry.text} (${ARMOR_PIECE_LABELS[base.piece]}, ${base.maxHp} HP)`,
      );
    } else {
      const roll = rollDie(rng);
      const base = DUNGEON_TABLES[draft.dungeonTypeKey!].weapon[roll]!;
      draft.spareWeapons.push({
        name: base.name,
        formula: base.formula,
        twoHanded: base.twoHanded,
      });
      pushLog(draft, `Treasure: ${entry.text} — a ${base.name} (${base.formula} damage).`);
    }
    return;
  } else if (entry.effect.kind === "randomSpell") {
    // Always a random *Basic* Spell per the rulebook's own wording for every Wonder/Magic
    // Scroll/Mana Potion that grants one -- New Spells (issue #24) tables are never rolled here.
    const spellRoll = rollDie(rng);
    draft.spellUses[spellKey("basic", spellRoll)] =
      (draft.spellUses[spellKey("basic", spellRoll)] ?? 0) + 1;
    const spellName = SPELL_TABLE[spellRoll]?.name ?? "a spell";
    pushLog(draft, `Treasure: ${entry.text} — learned ${spellName}!`);
    return;
  } else if (entry.effect.kind !== "flavor") {
    addArmorPiece(draft, {
      piece: "wonderItem",
      hp: 0,
      maxHp: 0,
      itemName: entry.name,
      effect: entry.effect,
    });
  } else {
    // Issue #109: a pure-flavor Wonder with no `grantsHp` (Goblin Whistle, Lamp, Salamander Potion,
    // Potion of the Helping hand) matched no arm above, so the player was told they found it and
    // then given nothing whatsoever -- "vanish into the void," in the report's words. It has no
    // mechanical effect to grant and no HP to wear, so it lands in the Curiosities tally instead
    // (issue #115), which is also the running count of arms and tails a player asked to be able to
    // look at.
    recordCuriosity(draft, entry.name);
  }
  pushLog(draft, `Treasure: ${entry.text}`);
}

/** Tallies a flavor-only find by name (issues #109/#115) -- `killsByName`'s exact shape, for the same
 * reason: repeats are the interesting part ("4 arms and 3 tails"), and a flat list of four identical
 * rows would be noise. Optional/back-filled per the usual convention. */
export function recordCuriosity(draft: Draft<DungeonState>, name: string): void {
  const tally = draft.curiosities ?? {};
  tally[name] = (tally[name] ?? 0) + 1;
  draft.curiosities = tally;
}

/** Laboratory's Potions column (issue #30) -- a fourth reward column no other dungeon type has, so
 * it gets its own resolver rather than being squeezed into `resolveWonder`'s trinket/HP shape. Every
 * row is a drunk-on-the-spot potion, which is exactly why an Ogre ("cannot use potions") sells it
 * instead (see CLAUDE.md's "Unusable gear is sellable"). */
export function resolvePotion(draft: Draft<DungeonState>, entry: PotionEntry, rng: RNG): void {
  if (draft.raceName === "Ogre") {
    addHeldItem(
      draft,
      { name: entry.name, worth: OGRE_UNUSABLE_TREASURE_WORTH },
      `Treasure: ${entry.text} Ogres cannot drink potions -- sold instead.`,
    );
    return;
  }

  if (entry.rollsMutation) {
    // The one row that reaches into the dungeon's Special Rule early: the potion mutates you now,
    // rather than on the way out (`App.tsx`'s own leaving-the-dungeon roll).
    pushLog(draft, `Treasure: ${entry.text}`);
    applyMutationToDungeon(draft, rng);
    return;
  }

  // Issue #110: the Laboratory's Luminescence Potion is worth nothing at 10 torches, so it stows like
  // every other timing-dependent potion. Its Mutation/flavor rows are unaffected -- a mutation isn't
  // something you save for later, and a curiosity has no moment to wait for.
  if (isHoldableItemEffect(entry.effect)) {
    addConsumable(
      draft,
      { name: entry.name, text: entry.text, effect: entry.effect },
      `Treasure: ${entry.text}`,
      rng,
    );
    return;
  }

  switch (entry.effect.kind) {
    case "randomSpell": {
      // "Learn 3 Random Basic Spells" -- three separate rolls, the same Basic-only shape every other
      // spell grant in this file uses.
      const names: string[] = [];
      for (let i = 0; i < 3; i++) {
        const spellRoll = rollDie(rng);
        const key = spellKey("basic", spellRoll);
        draft.spellUses[key] = (draft.spellUses[key] ?? 0) + 1;
        draft.maxSpellUses[key] = (draft.maxSpellUses[key] ?? 0) + 1;
        names.push(SPELL_TABLE[spellRoll]?.name ?? "a spell");
      }
      pushLog(draft, `Treasure: ${entry.text} — learned ${names.join(", ")}!`);
      return;
    }
    default:
      // A flavor potion (Goblin/Zombie/Extra Hand) is drunk and remembered rather than dropped --
      // same reasoning as a flavor Wonder above (issues #109/#115).
      recordCuriosity(draft, entry.name);
      break;
  }
  pushLog(draft, `Treasure: ${entry.text}`);
}

/** Applies one Mutation-table roll to a dungeon run in progress (the Mutation Potion). The
 * leaving-the-dungeon path applies the identical table to `AdventurerResources` instead -- see
 * `mutations.ts`'s `rollMutationEntry` for why the walk is shared and the application isn't. */
export function applyMutationToDungeon(draft: Draft<DungeonState>, rng: RNG): void {
  const { entry } = rollMutationEntry(rng);
  const effect = entry.effect;

  if (effect.kind === "death") {
    pushLog(draft, `Mutation: ${entry.text}`);
    if (trySurviveDeath(draft, rng, dungeonLog(draft))) return;
    draft.alive = false;
    // Not "combat" and not the Darkness -- but those are the only two values `deathCause` has, and
    // "darkness" is what every reader already treats as "died in the dungeon, not in a fight."
    draft.deathCause = "darkness";
    leaveRemains(draft, draft.currentSegId);
    draft.combat = null;
    return;
  }

  draft.mutations = [...(draft.mutations ?? []), entry.id];
  if (effect.kind === "maxHp") {
    // Floored at 1 exactly like the resources-side applier and Hard Work's own maxHp cost.
    draft.maxHp = Math.max(1, draft.maxHp + effect.amount);
    draft.hp = Math.min(draft.hp, draft.maxHp);
  }
  pushLog(draft, `Mutation: ${entry.text}`);
}

/** A Magic Item is always "[Armor] of X" or "[Weapon] of X" -- roll the base table for the
 * concrete piece/weapon, then layer the named item's bonus on top (an armor bonus is baked into
 * the piece's HP if it's `extraHp`, or attached as `effect` for anything else the piece grants;
 * a weapon bonus always rides along as `bonusEffect`, applied during combat). */
export function resolveMagicItem(
  draft: Draft<DungeonState>,
  entry: MagicItemEntry,
  rng: RNG,
): void {
  // Cave's "[Weapon] of the Nameless Wizard" (issue #138): "Has an Advanced Magic." Unlike
  // `grantsSpells` below -- which *replaces* the item -- this rides alongside it, so it's applied
  // up front and the normal armor/weapon path still runs. Rolled from the entry's own named table,
  // since the point of the item is that the magic is Advanced.
  if (entry.alsoGrantsSpells) {
    const { table, count } = entry.alsoGrantsSpells;
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const { entry: spell } = rollSpellFromTable(table, rng);
      const key = spellKey(spell.table, spell.roll);
      draft.spellUses[key] = (draft.spellUses[key] ?? 0) + 1;
      draft.maxSpellUses[key] = (draft.maxSpellUses[key] ?? 0) + 1;
      names.push(spell.name);
    }
    draft.milestones.hasCastSpell = true; // Scholar (issue #70): "used a spell or scroll"
    pushLog(draft, `It carries magic: ${names.join(", ")}.`);
  }
  if (entry.grantsSpells) {
    // Necropolis's "Fool's Potion" (issue #30): "Learn 3 Random Basic Spells" -- no physical item
    // at all, so this short-circuits before the armor/weapon roll entirely. Ogre's restriction
    // doesn't apply (this isn't the armor half of the table, and "potions/scrolls" here is really
    // just this item's own flavor name, not a mechanical potion/scroll grant).
    const names: string[] = [];
    for (let i = 0; i < entry.grantsSpells; i++) {
      const spellRoll = rollDie(rng);
      const key = spellKey("basic", spellRoll);
      draft.spellUses[key] = (draft.spellUses[key] ?? 0) + 1;
      draft.maxSpellUses[key] = (draft.maxSpellUses[key] ?? 0) + 1;
      names.push(SPELL_TABLE[spellRoll]?.name ?? "a spell");
    }
    draft.milestones.hasCastSpell = true; // Scholar (issue #70): "used a spell or scroll"
    pushLog(draft, `Treasure: ${entry.text} — learned ${names.join(", ")}!`);
    return;
  }
  if (entry.grants === "armor") {
    // Ogre (New Races, issue #60): "Cannot use potions, scrolls or wear armor" -- only the armor
    // half of this table is blocked; Ogre still fully benefits from "[Weapon] of X" items below,
    // since the restriction never mentions weapons. The base Armor table is still rolled (same RNG
    // consumption as anyone else), since its `maxHp` is what gives the unusable piece a worth once
    // it becomes a sellable HeldItem instead of vanishing outright (issue #83). `fixedArmor` (issue
    // #30) skips this roll entirely -- a uniquely-named piece (e.g. "Dwarven breastplate (10 HP)")
    // isn't roll-dependent, so there's no RNG to consume here for it.
    const base = entry.fixedArmor
      ? { piece: entry.fixedArmor.piece, maxHp: entry.fixedArmor.maxHp }
      : ARMOR_TABLE[rollDie(rng)]!;
    // Issue #116: the concrete piece is only known now, so this is where "[Armor] of the Dead"
    // becomes "Helm of the Dead" -- in the name that gets stored *and* in the log line.
    const pieceLabel = ARMOR_PIECE_LABELS[base.piece];
    const itemName = substituteItemPlaceholder(entry.name, pieceLabel);
    const itemText = substituteItemPlaceholder(entry.text, pieceLabel);
    if (cannotWearArmor(draft)) {
      addHeldItem(
        draft,
        { name: itemName, worth: Math.max(1, base.maxHp) },
        `Treasure: ${itemText} Ogres cannot wear armor -- sold instead.`,
      );
      return;
    }
    const bonusHp = entry.effect.kind === "extraHp" ? entry.effect.amount : 0;
    const maxHp = Math.max(0, base.maxHp + bonusHp);
    addArmorPiece(draft, {
      piece: base.piece,
      hp: maxHp,
      maxHp,
      itemName,
      effect: entry.effect.kind === "extraHp" ? undefined : entry.effect,
    });
    pushLog(draft, `Treasure: ${itemText} (${pieceLabel}, ${maxHp} HP)`);
  } else if (entry.fixedFormula) {
    // A uniquely-named weapon: no base roll, so nothing to substitute in (its name is already
    // concrete), but run it through anyway so no template can leak through this branch.
    draft.spareWeapons.push({
      name: substituteItemPlaceholder(entry.name, entry.name),
      formula: entry.fixedFormula,
      twoHanded: entry.twoHanded,
      bonusEffect: entry.effect.kind !== "flavor" ? entry.effect : undefined,
    });
    pushLog(draft, `Treasure: ${entry.text} (${entry.fixedFormula} damage)`);
  } else {
    const roll = rollDie(rng);
    const base = DUNGEON_TABLES[draft.dungeonTypeKey!].weapon[roll]!;
    // Issue #116: "[Weapon] of Destruction" rolled a Mace, so it's the "Mace of Destruction" --
    // previously the item's own name was discarded entirely in favour of the bare base weapon.
    draft.spareWeapons.push({
      name: substituteItemPlaceholder(entry.name, base.name),
      formula: base.formula,
      twoHanded: base.twoHanded,
      bonusEffect: entry.effect.kind !== "flavor" ? entry.effect : undefined,
    });
    pushLog(
      draft,
      `Treasure: ${substituteItemPlaceholder(entry.text, base.name)} (${base.formula} damage)`,
    );
  }
}

/**
 * Applies a Room Content row's automatic reward -- unlike Chests/Treasures (an explicit player
 * action), these are just there the moment the room is built, same as its flavor text. `coins`/
 * `treasures` credit the rolled count directly (`multiplier` for rows like "2d6 paintings, 2
 * coins each"); `magicScrolls` grants that many random Basic Spell uses; `magicItems` rolls that
 * many Magic Items off the dungeon's own table, reusing `resolveMagicItem()` (its "Treasure:" log
 * prefix is a little off for an Armory's own contents, but the base-table-roll/bonus-layering
 * logic it reuses is exactly right, so that's an acceptable trade).
 */
export function applyRoomContentReward(
  draft: Draft<DungeonState>,
  reward: RoomContentReward,
  rng: RNG,
): void {
  const count = resolveMonsterCount(reward.count, rng);
  if (count <= 0) return;

  switch (reward.kind) {
    case "coins": {
      const coins = count * (reward.multiplier ?? 1);
      draft.coins += coins;
      pushLog(draft, `You find ${coins} coin${coins === 1 ? "" : "s"}.`);
      break;
    }
    case "treasures": {
      draft.treasures += count;
      pushLog(draft, `You find ${count} Treasure${count === 1 ? "" : "s"}.`);
      break;
    }
    case "magicScrolls": {
      // Ogre (New Races, issue #60): "Cannot use scrolls" -- the scrolls are still found, but
      // instead of vanishing they're sold as one bundled HeldItem (issue #83) rather than granting
      // spell uses.
      if (draft.raceName === "Ogre") {
        const label = `${count} Magic Scroll${count === 1 ? "" : "s"}`;
        addHeldItem(
          draft,
          { name: label, worth: count * OGRE_UNUSABLE_TREASURE_WORTH },
          `You find ${label}, but Ogres cannot use scrolls -- sold instead.`,
        );
        break;
      }
      const spellNames: string[] = [];
      for (let i = 0; i < count; i++) {
        const spellRoll = rollDie(rng);
        const key = spellKey("basic", spellRoll);
        draft.spellUses[key] = (draft.spellUses[key] ?? 0) + 1;
        // Raises the ceiling too (issue #75), same as every other spell-granting site.
        draft.maxSpellUses[key] = (draft.maxSpellUses[key] ?? 0) + 1;
        spellNames.push(SPELL_TABLE[spellRoll]?.name ?? "a spell");
      }
      pushLog(
        draft,
        `You find ${count} Magic Scroll${count === 1 ? "" : "s"}, learning ${spellNames.join(", ")}.`,
      );
      break;
    }
    case "magicItems": {
      if (!draft.dungeonTypeKey) break;
      for (let i = 0; i < count; i++) {
        const roll = rollDie(rng);
        const entry = DUNGEON_TABLES[draft.dungeonTypeKey].magicItem[roll]!;
        resolveMagicItem(draft, entry, rng);
      }
      break;
    }
  }
}

/** Everything that happens once a new *room* segment (not a Final Room, which has no Content roll
 * and so never has `roomContent`) is built and pushed onto the level: its Room Content reward (if
 * any) applies first. A noisy arrival (a broken door, a fired trap) starts combat immediately with
 * the monsters attacking first, same as always. A quiet arrival with monsters instead waits for the
 * player's RESOLVE_ROOM_ENTRY choice (Attack First / Move Silently) rather than defaulting straight
 * into combat -- see docs/game-rules-reference.md's Move Silently rule. */
export function finishRoomSegment(
  draft: Draft<DungeonState>,
  seg: { id: number; monsters?: MonsterTemplate; roomContent?: { reward?: RoomContentReward } },
  wasNoisy: boolean,
  rng: RNG,
): void {
  if (seg.roomContent?.reward) {
    applyRoomContentReward(draft, seg.roomContent.reward, rng);
  }
  if (wasNoisy) {
    startCombatIfMonsters(draft, seg, true, rng);
  }
}

/** "A secret door to a Staircase" (Secret Passage roll of 6) -- builds a real, descendable
 * staircase segment off the room, exactly like an ordinary door resolving to the Segments
 * table's "staircase" outcome (1 door, "the door in the end"), except the door itself is brand
 * new (not one of the room's already-rolled doors) and already open, since finding it via a
 * search *is* the reveal -- no separate OPEN_DOOR click needed. Placed in whichever cardinal
 * direction the room doesn't already have a door facing; a non-entrance room always has at least
 * one free direction (assignDirections caps a non-entrance room's own door count at 3 of 4), so
 * this only ever silently no-ops (the flavor text alone still stands) for a fully 4-doored
 * entrance, the one segment type that can actually use all four. Doesn't touch
 * `stats.doorsRemaining` the way a normal door resolution does beyond `bumpStatsForNewSegment`'s
 * own `+= doors` -- this door was never a previously-counted pending slot to "consume," it's a
 * wholly new one the search just added. */
export function buildSecretPassageStaircase(
  draft: Draft<DungeonState>,
  level: Draft<LevelState>,
  seg: Draft<SegmentState>,
  rng: RNG,
): void {
  const usedDirs = new Set(seg.doors.map((d) => d.dir));
  const freeDir = (["N", "E", "S", "W"] satisfies Direction[]).find((d) => !usedDirs.has(d));
  if (!freeDir) return;

  const box = placeChild(seg, freeDir, "staircase", level.segments);
  const stairSeg = buildSegment(draft, "staircase", box, freeDir, 1, null, rng);
  level.segments.push(stairSeg);
  level.connectors.push(buildConnector(seg, freeDir, box));
  seg.doors.push({ dir: freeDir, opened: true, childId: stairSeg.id, leadsToLevel: null });
  level.hasStaircase = true;

  bumpStatsForNewSegment(draft.stats, "staircase", 1);

  pushLog(draft, `Segment ${seg.id}: a secret door reveals a Staircase (Segment ${stairSeg.id})!`);
  finishRoomSegment(draft, stairSeg, false, rng);
}
