import { produce, type Draft } from "immer";
import {
  composeDungeonName,
  DUNGEON_TYPES,
  OPEN_DOOR_TABLE,
  SECRET_PASSAGE_TABLE,
  SECRET_PASSAGE_TABLE_BY_TYPE,
  TYPE_LABELS,
} from "../data/dungeonTypes.ts";
import { ARMOR_PIECE_LABELS, DUNGEON_TABLES } from "../data/dungeonTables.ts";
import { SPELL_TABLE } from "../data/spells.ts";
import { HIRELING_BY_NAME } from "../data/hirelings.ts";
import { ANIMAL_BY_NAME } from "../data/animals.ts";
import { SPELL_TABLE_BY_KEY, parseSpellKey, spellKey } from "./character.ts";
import {
  boxFromCenter,
  buildConnector,
  classifyDoorOpen,
  isTeleportDestination,
  placeChild,
  reachableSegIds,
  resolveBoss,
  rollSegment,
  sizeFor,
} from "./dungeon.ts";
import { rollDie } from "./dice.ts";
import {
  castCombatSpell,
  equippedEffects,
  blocksMoveSilently,
  resolveDamageChoice,
  trySurviveDeath,
} from "./fight.ts";
import {
  COMBAT_ONLY_SPELL_NAMES,
  HORDE_ORC,
  KNOWN_CASTABLE_SPELL_NAMES,
  NECROMANCY_SKELETON,
  parseWeaponFormula,
  resolveMonsterCount,
  resolvePlayerAttack,
  resolveSpellDamage,
  TARGETED_SPELL_NAMES,
} from "./combat.ts";
import {
  createInitialDungeonState,
  isHoldableRewardEffect,
  makeLevel,
  type DungeonAction,
  type DungeonState,
  type SegmentState,
  segmentHasChest,
} from "./dungeonState.ts";
import { MUTATION_IDS } from "../data/mutations.ts";
import { benchUnusableWeapon, canWieldWeapon, twoHandedBlockReason } from "./hands.ts";
import { createInitialMilestones, MAX_TORCHES, maxHeldItemsFor } from "./town.ts";
import type { RNG } from "./rng.ts";
import {
  bumpStatsForNewSegment,
  pushLog,
  leaveRemains,
  dungeonLog,
  spendTorches,
  buildSegment,
} from "./dungeonRun/core.ts";
import {
  addArmorPieces,
  addHeldItem,
  packUsed,
  addConsumable,
  applyConsumable,
} from "./dungeonRun/inventory.ts";
import {
  startCombat,
  startCombatIfMonsters,
  isActionBlocked,
  wakeSneakedPastMonsters,
  attackBonus,
  attackMultiplier,
  ignoresAbility,
  ignoredAbilities,
  applyMonsterTurn,
  handleMonsterDefeat,
  finishIfVictorious,
} from "./dungeonRun/combat.ts";
import { resolveTrapOutcome } from "./dungeonRun/traps.ts";
import {
  rewardItemName,
  OGRE_RESTRICTED_REWARD_KINDS,
  OGRE_UNUSABLE_TREASURE_WORTH,
  resolveWonder,
  resolvePotion,
  resolveMagicItem,
  finishRoomSegment,
  buildSecretPassageStaircase,
} from "./dungeonRun/rewards.ts";
import { restoreMapFromPersisted, rerollMonstersIfNeeded } from "./dungeonRun/persistence.ts";

export function dungeonReducer(
  state: DungeonState,
  action: DungeonAction,
  rng: RNG = Math.random,
): DungeonState {
  switch (action.type) {
    case "ROLL_DUNGEON": {
      const dtype = DUNGEON_TYPES[action.typeRoll];
      if (!dtype) throw new Error(`No dungeon type for roll ${action.typeRoll}`);

      return produce(state, (draft) => {
        // Issue #92: the entry torch goes through `spendTorches()` like every other spend, rather
        // than a bare decrement that could drive the counter negative. Charged *before* anything is
        // built, so a failed spend leaves no half-made dungeon behind: a Miner (or a successful
        // Samambro/Raven roll) is spared and simply doesn't enter, anyone else meets the Darkness.
        // `DungeonScreen` also disables "Roll for Dungeon" at 0 torches, so in practice this is
        // defense in depth -- reducer decides, UI mirrors.
        if (!spendTorches(draft, 1, "Entering the dungeon costs 1 torch to light the way.")) return;

        draft.dungeonTypeKey = dtype.key;
        // Issue #101: the Expanded World's four-part name, with the dungeon type sitting *inside*
        // it rather than leading -- "The Cursed Palace of the Frost Queen".
        draft.dungeonName = composeDungeonName(dtype.name, ...action.nameRolls);
        draft.entranceFlavor = dtype.entrance;
        draft.levels = [makeLevel(1)];
        draft.activeLevel = 0;
        draft.nextSegmentId = 1;
        draft.nextLogId = 1;
        draft.selectedSegId = null;
        draft.log = [];
        draft.stats = {
          segments: 0,
          corridors: 0,
          rooms: 0,
          staircases: 0,
          doorsRemaining: 0,
          finalRooms: 0,
        };
        const level = draft.levels[0]!;
        const box = boxFromCenter(0, 0, sizeFor(dtype.entranceType, null));
        const entrance = buildSegment(
          draft,
          dtype.entranceType,
          box,
          null,
          dtype.doors,
          null,
          rng,
          true,
        );
        level.segments.push(entrance);
        level.doorsRemaining += dtype.doors;
        draft.currentSegId = entrance.id;
        draft.selectedSegId = entrance.id;
        bumpStatsForNewSegment(draft.stats, dtype.entranceType, dtype.doors);
        finishRoomSegment(draft, entrance, false, rng);
      });
    }

    case "SELECT_SEGMENT": {
      if (state.selectedSegId === action.segId) return state;
      // Moving to a *different* segment than the one the player currently occupies is only
      // possible into the fog-of-war boundary (see reachableSegIds) and never mid-combat;
      // re-selecting the segment you're already standing in (e.g. to trigger its monster
      // re-roll after a restore, see restoreMapFromPersisted) is always allowed.
      if (action.segId != null && action.segId !== state.currentSegId) {
        if (state.combat || isActionBlocked(state)) return state;
        const level = state.levels[state.activeLevel];
        const reachable = level ? reachableSegIds(level, state.currentSegId) : new Set<number>();
        if (!reachable.has(action.segId)) return state;
      }
      return produce(state, (draft) => {
        draft.selectedSegId = action.segId;
        if (action.segId == null) return;
        draft.currentSegId = action.segId;
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        if (seg) rerollMonstersIfNeeded(draft, seg, rng);
      });
    }

    case "SWITCH_LEVEL": {
      if (state.combat || isActionBlocked(state)) return state;
      // A plain LevelTabs click (no segId) just changes which level's map is displayed -- always
      // allowed, though nothing on a level other than wherever currentSegId actually is will be
      // reachable once you get there (see reachableSegIds). Physically stepping through an
      // already-opened staircase (segId set, from DungeonMap's descend button) additionally moves
      // the player -- only valid if that staircase leads out of the segment they're currently in.
      if (action.segId != null) {
        const level = state.levels[state.activeLevel];
        const reachable = level ? reachableSegIds(level, state.currentSegId) : new Set<number>();
        if (!reachable.has(action.segId)) return state;
      } else if (state.activeLevel === action.levelIndex) {
        return state;
      }
      return produce(state, (draft) => {
        draft.activeLevel = action.levelIndex;
        draft.selectedSegId = action.segId ?? null;
        if (action.segId == null) return;
        draft.currentSegId = action.segId;
        const targetLevel = draft.levels[action.levelIndex];
        const seg = targetLevel?.segments.find((s) => s.id === action.segId);
        if (seg) rerollMonstersIfNeeded(draft, seg, rng);
      });
    }

    case "ROLL_SECRET_PASSAGE": {
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        if (!seg || seg.secretPassageSearched) return;

        if (
          !spendTorches(
            draft,
            1,
            `Segment ${seg.id}: spent 1 torch searching for a secret passage.`,
            seg.id,
            rng,
          )
        ) {
          return;
        }

        seg.secretPassageSearched = true;
        // Deadly Dungeons (issue #30): Pyramid/Necropolis print their own distinct Secret Passage
        // table; every other type (including Citadel/Ziggurat, whose own printed tables happen to
        // match this one exactly) falls back to the shared table.
        const secretPassageTable = draft.dungeonTypeKey
          ? (SECRET_PASSAGE_TABLE_BY_TYPE[draft.dungeonTypeKey] ?? SECRET_PASSAGE_TABLE)
          : SECRET_PASSAGE_TABLE;
        seg.secretPassageResult = secretPassageTable[action.roll] ?? null;
        if (action.roll === 1 && action.trapRoll != null && draft.dungeonTypeKey) {
          const trap = DUNGEON_TABLES[draft.dungeonTypeKey].trap[action.trapRoll];
          if (trap) {
            seg.trapResult = trap.text;
            resolveTrapOutcome(draft, trap, seg.id, rng, action.bladeRoll);
            wakeSneakedPastMonsters(draft, seg, rng);
          }
        }
        if (action.roll === 6) {
          buildSecretPassageStaircase(draft, level!, seg, rng);
        }
      });
    }

    case "ROLL_CHEST": {
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        if (!seg || seg.chestOpened) return;
        if (!segmentHasChest(seg)) return;

        seg.chestOpened = true;
        const [a, b] = action.dice;

        if (a === 1 && b === 1) {
          seg.chestResult = "The chest was empty — it was a trap!";
          pushLog(draft, `Segment ${seg.id}: the chest was empty and triggered a trap!`);
          if (action.trapRoll != null && draft.dungeonTypeKey) {
            const trap = DUNGEON_TABLES[draft.dungeonTypeKey].trap[action.trapRoll];
            if (trap) {
              seg.trapResult = trap.text;
              pushLog(draft, trap.text);
              resolveTrapOutcome(draft, trap, seg.id, rng, action.bladeRoll);
              wakeSneakedPastMonsters(draft, seg, rng);
            }
          }
          return;
        }

        const hasDoubleChestCoins = draft.armor.some(
          (piece) => piece.effect?.kind === "doubleChestCoins",
        );
        const coins = Math.max(a, b) * (hasDoubleChestCoins ? 2 : 1);
        const treasures = Math.min(a, b);
        draft.coins += coins;
        draft.treasures += treasures;
        seg.chestResult = `Found ${coins} coin${coins === 1 ? "" : "s"} and ${treasures} Treasure${treasures === 1 ? "" : "s"}.`;
        pushLog(
          draft,
          `Segment ${seg.id}: opened the chest — ${coins} coin${coins === 1 ? "" : "s"}, ${treasures} Treasure${treasures === 1 ? "" : "s"}.`,
        );
      });
    }

    case "COLLECT_REMAINS": {
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        if (!seg?.remains) return;
        const { names, coins, treasures, keys, heldItems, armor, spareArmor, weapon, weapons } =
          seg.remains;
        const remainsPotions = seg.remains.consumables ?? [];
        draft.coins += coins;
        draft.treasures += treasures;
        draft.keys += keys;
        // Ogre (New Races, issue #60): "Cannot... wear armor" -- recovered armor (worn or benched)
        // is left behind rather than picked up (coins/Treasures/Keys/held items/weapons are all
        // unaffected).
        if (draft.raceName !== "Ogre") {
          addArmorPieces(draft, armor);
          addArmorPieces(draft, spareArmor);
        }
        if (weapon) draft.spareWeapons.push(weapon);
        draft.spareWeapons.push(...weapons);
        // Pack cap (issue #82): none of coins/treasures/keys/armor/weapons are capped, only
        // heldItems -- take as many as currently fit, first-overflow becomes pendingPackItem, and
        // anything past that stays behind in a shrunken remains (nothing is ever silently lost;
        // collecting again later, once there's room, picks up the next one the same way).
        const capacity = maxHeldItemsFor(draft.hireling, draft.animals);
        const room = Math.max(0, capacity - packUsed(draft));
        const fitting = heldItems.slice(0, room);
        const overflow = heldItems.slice(room);
        draft.heldItems.push(...fitting);
        // Held potions (issue #110) share those same slots, and are taken after sellables with
        // whatever room is left. Anything that doesn't fit stays in the remains, like an item.
        const potionRoom = Math.max(0, capacity - packUsed(draft));
        const fittingPotions = remainsPotions.slice(0, potionRoom);
        const potionOverflow = remainsPotions.slice(potionRoom);
        if (fittingPotions.length > 0) {
          draft.consumables = [...(draft.consumables ?? []), ...fittingPotions];
        }
        const recovered = [...fitting, ...fittingPotions].map((item) => item.name);
        const itemsPart = recovered.length > 0 ? `, and ${recovered.join(", ")}` : "";
        pushLog(
          draft,
          `Segment ${seg.id}: recovered ${coins} coin${coins === 1 ? "" : "s"}, ${treasures} Treasure${treasures === 1 ? "" : "s"}, and ${keys} Key${keys === 1 ? "" : "s"}${itemsPart} from the remains of ${names.join(", ")}.`,
        );
        if (overflow.length > 0) {
          draft.pendingPackItem = overflow[0]!;
          seg.remains = {
            names,
            coins: 0,
            treasures: 0,
            keys: 0,
            heldItems: overflow.slice(1),
            consumables: potionOverflow,
            armor: [],
            spareArmor: [],
            weapon: null,
            weapons: [],
          };
          pushLog(
            draft,
            `Your Pack is full -- ${overflow[0]!.name} is still waiting in the remains.`,
          );
        } else if (potionOverflow.length > 0) {
          // Potions alone overflowed, so there's no `pendingPackItem` swap to offer (that prompt
          // trades one sellable for another) -- they simply wait here until the Pack has room.
          seg.remains = {
            names,
            coins: 0,
            treasures: 0,
            keys: 0,
            heldItems: [],
            consumables: potionOverflow,
            armor: [],
            spareArmor: [],
            weapon: null,
            weapons: [],
          };
          pushLog(
            draft,
            `Your Pack is full -- ${potionOverflow.map((p) => p.name).join(", ")} still waiting in the remains.`,
          );
        } else {
          seg.remains = null;
        }
      });
    }

    case "WIELD_WEAPON": {
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const chosen = draft.spareWeapons[action.index];
        if (!chosen) return;
        // "Your Hands" (issue #100): the enforcement point. Wielding is unrestricted in Town (the
        // rulebook scopes the rule to "when exploring a dungeon"), so this is where a two-handed
        // weapon actually has to justify itself -- and where the reason is spelled out rather than
        // the click silently doing nothing. `Equipment` disables the button too, but the reducer is
        // the authority, per the project's reducer-decides/UI-mirrors convention.
        if (!canWieldWeapon(draft, chosen)) {
          pushLog(draft, twoHandedBlockReason(draft) ?? "You cannot wield that.");
          return;
        }
        draft.spareWeapons.splice(action.index, 1);
        if (draft.weapon) draft.spareWeapons.push(draft.weapon);
        draft.weapon = chosen;
        pushLog(draft, `You wield the ${chosen.name}.`);
      });
    }

    case "WIELD_ARMOR": {
      // Issue #82: armor's own per-slot equivalent of WIELD_WEAPON -- unlike weapon's single
      // equipped slot, this has to find-and-replace by `piece` kind, since several different
      // slots can be worn at once.
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const chosen = draft.spareArmor[action.index];
        if (!chosen) return;
        draft.spareArmor.splice(action.index, 1);
        const displacedIndex = draft.armor.findIndex((p) => p.piece === chosen.piece);
        if (displacedIndex >= 0) {
          const [displaced] = draft.armor.splice(displacedIndex, 1);
          draft.spareArmor.push(displaced!);
        }
        draft.armor.push(chosen);
        pushLog(draft, `You wear the ${chosen.itemName ?? ARMOR_PIECE_LABELS[chosen.piece]}.`);
      });
    }

    case "DISCARD_ITEM": {
      // Issue #82: a free, anywhere-usable Pack discard -- same minimal out-of-combat gate as
      // WIELD_WEAPON/WIELD_ARMOR.
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const item = draft.heldItems[action.index];
        if (!item) return;
        draft.heldItems.splice(action.index, 1);
        pushLog(draft, `You leave the ${item.name} behind.`);
      });
    }

    case "USE_CONSUMABLE": {
      // Issue #110. Deliberately usable mid-fight (that's the whole point of holding a Health Potion
      // or a Potion of Fury), so unlike DISCARD_ITEM this isn't gated on `!state.combat` -- instead it
      // consumes the round exactly like CAST_SPELL and OPEN_TREASURE, since drinking is an action.
      if (!state.alive || isActionBlocked(state)) return state;
      if (state.combat?.pendingDamage != null) return state;
      if (!state.consumables?.[action.index]) return state;
      return produce(state, (draft) => {
        const item = draft.consumables![action.index]!;
        draft.consumables!.splice(action.index, 1);
        applyConsumable(draft, item, rng);
        if (draft.combat) {
          applyMonsterTurn(draft, draft.combat, rng);
        }
      });
    }

    case "DISCARD_CONSUMABLE": {
      // The DISCARD_ITEM equivalent, and gated identically -- dropping a bottle isn't a combat action.
      if (!state.alive || state.combat || isActionBlocked(state)) return state;
      return produce(state, (draft) => {
        const item = draft.consumables?.[action.index];
        if (!item) return;
        draft.consumables!.splice(action.index, 1);
        pushLog(draft, `You leave the ${item.name} behind.`);
      });
    }

    case "RESOLVE_PACK_SWAP": {
      // Unlike the other free actions above, this is the *resolution* of an already-pending
      // choice, so it's the one case that must run even while isActionBlocked(state) is true (it
      // IS what clears that block) -- only `state.alive`/`state.pendingPackItem` gate it.
      if (!state.alive || state.pendingPackItem == null) return state;
      return produce(state, (draft) => {
        const incoming = draft.pendingPackItem;
        if (!incoming) return;
        draft.pendingPackItem = null;
        if (action.discardIndex === "decline") {
          pushLog(draft, `You leave the ${incoming.name} behind.`);
          return;
        }
        const existing = draft.heldItems[action.discardIndex];
        if (!existing) return;
        draft.heldItems.splice(action.discardIndex, 1);
        draft.heldItems.push(incoming);
        pushLog(draft, `You drop the ${existing.name} to make room for the ${incoming.name}.`);
      });
    }

    case "RESOLVE_DOOR_LOCK": {
      if (
        !state.alive ||
        state.combat ||
        isActionBlocked(state) ||
        action.segId !== state.currentSegId
      ) {
        return state;
      }
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        const door = seg?.doors[action.doorIdx];
        if (!seg || !door || door.opened) return;

        // Sewers (issue #30): "Floodgate: works like normal doors but cannot be destroyed, has no
        // traps, and will always be locked." So the door roll is overridden entirely rather than
        // filtered -- a floodgate has no trap outcome and no unlocked outcome to fall through to.
        const outcome = door.floodgate ? "locked" : OPEN_DOOR_TABLE[action.doorRoll];
        if (outcome === "trap") {
          if (!draft.dungeonTypeKey || action.trapRoll == null) return;
          const trap = DUNGEON_TABLES[draft.dungeonTypeKey].trap[action.trapRoll];
          if (!trap) return;
          pushLog(draft, `Segment ${seg.id}: ${trap.text}`);
          resolveTrapOutcome(draft, trap, seg.id, rng, action.bladeRoll);
          wakeSneakedPastMonsters(draft, seg, rng);
        } else if (outcome === "locked") {
          if (action.lockChoice === "pickLock") {
            // Thief (Advanced Class, issue #70): counts as opened regardless of whether the
            // free-pick bypass below applies -- the lock was still opened either way.
            draft.milestones.locksOpened += 1;
            // Locksmith (base Class), Burglar (Hireling, issue #25), and Thief (Advanced Class,
            // its own "Does not waste torches when Opening Locks" ability) all grant the identical
            // "no torch spent picking a lock" benefit.
            if (
              draft.className === "Locksmith" ||
              draft.hireling === "Burglar" ||
              draft.advancedClasses.includes("Thief")
            ) {
              pushLog(draft, `Segment ${seg.id}: your lockpicking skill needs no torch.`);
            } else {
              spendTorches(
                draft,
                1,
                `Segment ${seg.id}: spent 1 torch to pick the lock.`,
                seg.id,
                rng,
              );
            }
          } else if (action.lockChoice === "useKey") {
            // Issue #95: "If you find a key, you can open any door in the dungeon." No torch, no
            // noise -- the quiet option the locked-door prompt previously lacked. Counted toward
            // Thief's `locksOpened` (its requirement is "opened at least 4 locks," and a key opens
            // the lock; breaking the door destroys it without ever opening it, which is why the
            // break branch below still doesn't count).
            //
            // "The Master Key opens any door in any dungeon" -- a standing item effect, so it spends
            // nothing at all and works at 0 keys.
            const hasMasterKey = equippedEffects(draft).some((e) => e.kind === "opensAnyLock");
            if (!hasMasterKey && draft.keys < 1) return;
            if (hasMasterKey) {
              draft.milestones.locksOpened += 1;
              pushLog(draft, `Segment ${seg.id}: the Master key turns without resistance.`);
            } else {
              draft.keys -= 1;
              draft.milestones.locksOpened += 1;
              pushLog(
                draft,
                `Segment ${seg.id}: a key turns the lock quietly. (${draft.keys} left)`,
              );
            }
          } else if (action.lockChoice === "breakDoor") {
            // A Floodgate "cannot be destroyed" -- the UI doesn't offer this, and the reducer
            // refuses it too (reducer decides, UI mirrors).
            if (door.floodgate) return;
            // Issue #96: remembered so the alarm can travel back through it later.
            door.broken = true;
            pushLog(
              draft,
              `Segment ${seg.id}: broke the door open — no torch spent, but it alerts nearby monsters.`,
            );
            if (draft.className === "Lumberjack") {
              const roll = rollDie(rng);
              if (roll === 6) {
                draft.torches = Math.min(draft.torches + 1, MAX_TORCHES);
                pushLog(draft, "Splintered wood makes for good kindling — you gain 1 torch.");
              }
            }
            wakeSneakedPastMonsters(draft, seg, rng);
          }
        }
      });
    }

    case "OPEN_DOOR": {
      if (
        !state.alive ||
        state.combat ||
        isActionBlocked(state) ||
        action.segId !== state.currentSegId
      ) {
        return state;
      }
      const classification = classifyDoorOpen(state, action.segId, action.doorIdx);

      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel]!;
        const seg = level.segments.find((s) => s.id === action.segId)!;
        const door = seg.doors[action.doorIdx]!;

        switch (classification.kind) {
          case "reuse-final": {
            const targetLevel = draft.levels[classification.targetLevel]!;
            const finalSeg = targetLevel.segments[0]!;
            door.opened = true;
            door.childId = finalSeg.id;
            door.leadsToLevel = classification.targetLevel;
            level.doorsRemaining -= 1;
            draft.stats.doorsRemaining -= 1;
            pushLog(
              draft,
              `Segment ${seg.id} (staircase) → the same Final Room already found on Level ${classification.targetLevel + 1}`,
              "descend",
            );
            draft.activeLevel = classification.targetLevel;
            draft.currentSegId = finalSeg.id;
            draft.selectedSegId = finalSeg.id;
            break;
          }

          case "reuse-normal": {
            // A second staircase down to an already-discovered level opens onto that level's own
            // single entrance (its root segment, segments[0]) rather than a new, disconnected
            // entry point -- the same "one shared destination" shape reuse-final already gives a
            // second staircase down to an already-found Final Room. No Segments-table roll is
            // needed since nothing new is built (see DungeonMap's AUTOMATIC_KINDS).
            const targetLevel = draft.levels[classification.targetLevel]!;
            const rootSeg = targetLevel.segments[0]!;
            door.opened = true;
            door.childId = rootSeg.id;
            door.leadsToLevel = classification.targetLevel;
            level.doorsRemaining -= 1;
            draft.stats.doorsRemaining -= 1;

            pushLog(
              draft,
              `Segment ${seg.id} (staircase) → the same Level ${classification.targetLevel + 1} already found — Segment ${rootSeg.id} (${TYPE_LABELS[rootSeg.type]})`,
              "descend",
            );
            draft.activeLevel = classification.targetLevel;
            draft.currentSegId = rootSeg.id;
            draft.selectedSegId = rootSeg.id;
            break;
          }

          case "descend-final": {
            const finalLevel = makeLevel(level.depth + 1);
            finalLevel.isFinalRoomLevel = true;
            finalLevel.finalRoomPlaced = true;
            const box = boxFromCenter(0, 0, sizeFor("final", null));
            const finalId = draft.nextSegmentId;
            draft.nextSegmentId += 1;
            const finalSeg: Draft<SegmentState> = {
              id: finalId,
              type: "final",
              ...box,
              cameFromDir: null,
              flavor: "A large room with no doors. The Boss waits at its center.",
              doors: [],
              isEntrance: false,
              monsters: resolveBoss(draft.dungeonTypeKey!, rng),
            };
            finalLevel.segments.push(finalSeg);
            draft.levels.push(finalLevel);
            const targetIndex = draft.levels.length - 1;

            door.opened = true;
            door.childId = finalId;
            door.leadsToLevel = targetIndex;
            level.stairwayTarget = targetIndex;
            level.doorsRemaining -= 1;

            draft.stats.segments += 1;
            draft.stats.finalRooms += 1;
            draft.stats.doorsRemaining -= 1;

            pushLog(
              draft,
              `Segment ${seg.id} (staircase) → the Final Room — Level ${targetIndex + 1}, Segment ${finalId}`,
              "descend",
            );
            draft.activeLevel = targetIndex;
            draft.currentSegId = finalId;
            draft.selectedSegId = finalId;
            startCombatIfMonsters(draft, finalSeg, false, rng, true);
            break;
          }

          case "dead-end-final": {
            const box = placeChild(seg, door.dir, "final", level.segments);
            const finalId = draft.nextSegmentId;
            draft.nextSegmentId += 1;
            const finalSeg: Draft<SegmentState> = {
              id: finalId,
              type: "final",
              ...box,
              cameFromDir: door.dir,
              flavor: "No stairs were ever found on this level. The Boss waits at its center.",
              doors: [],
              isEntrance: false,
              monsters: resolveBoss(draft.dungeonTypeKey!, rng),
            };
            level.segments.push(finalSeg);
            level.connectors.push(buildConnector(seg, door.dir, box));

            door.opened = true;
            door.childId = finalId;
            level.doorsRemaining -= 1;
            level.finalRoomPlaced = true;
            // Bug fix: this level now holds the Final Room, same as a descend-final level does --
            // without this, isDungeonBeaten() (which requires isFinalRoomLevel) never recognized a
            // dead-end-final victory as beating the dungeon.
            level.isFinalRoomLevel = true;

            draft.stats.segments += 1;
            draft.stats.finalRooms += 1;
            draft.stats.doorsRemaining -= 1;

            pushLog(
              draft,
              `Segment ${seg.id} was the last door on Level ${draft.activeLevel + 1} — the Final Room (Segment ${finalId}), no stairs ever found`,
              "descend",
            );
            draft.currentSegId = finalId;
            draft.selectedSegId = finalId;
            startCombatIfMonsters(draft, finalSeg, false, rng, true);
            break;
          }

          case "descend-normal": {
            if (action.roll == null) throw new Error("descend-normal requires a roll");
            const row = rollSegment(
              seg.type,
              action.roll,
              draft.dungeonTypeKey!,
              !!door.continuesTunnel,
            );
            const newLevel = makeLevel(level.depth + 1);
            const box = boxFromCenter(0, 0, sizeFor(row.type, null));
            const rootSeg = buildSegment(
              draft,
              row.type,
              box,
              null,
              row.doors,
              row.flavor ?? null,
              rng,
              false,
              !!row.floodgate,
            );
            newLevel.segments.push(rootSeg);
            newLevel.doorsRemaining += row.doors;
            if (row.type === "staircase") newLevel.hasStaircase = true;
            draft.levels.push(newLevel);
            const targetIndex = draft.levels.length - 1;

            door.opened = true;
            door.childId = rootSeg.id;
            door.leadsToLevel = targetIndex;
            level.stairwayTarget = targetIndex;
            level.doorsRemaining -= 1;

            bumpStatsForNewSegment(draft.stats, row.type, row.doors);
            draft.stats.doorsRemaining -= 1;

            pushLog(
              draft,
              `Segment ${seg.id} (staircase) → descends to Level ${targetIndex + 1} — Segment ${rootSeg.id} (${TYPE_LABELS[row.type]})`,
              "descend",
            );
            draft.activeLevel = targetIndex;
            draft.currentSegId = rootSeg.id;
            draft.selectedSegId = rootSeg.id;
            finishRoomSegment(draft, rootSeg, false, rng);
            break;
          }

          case "normal": {
            if (action.roll == null) throw new Error("normal requires a roll");
            const row = rollSegment(
              seg.type,
              action.roll,
              draft.dungeonTypeKey!,
              !!door.continuesTunnel,
            );
            const box = placeChild(seg, door.dir, row.type, level.segments);
            const childSeg = buildSegment(
              draft,
              row.type,
              box,
              door.dir,
              row.doors,
              row.flavor ?? null,
              rng,
              false,
              !!row.floodgate,
            );
            level.segments.push(childSeg);
            level.connectors.push(buildConnector(seg, door.dir, box));

            door.opened = true;
            door.childId = childSeg.id;
            level.doorsRemaining += row.doors - 1;
            if (row.type === "staircase") level.hasStaircase = true;

            bumpStatsForNewSegment(draft.stats, row.type, row.doors);
            draft.stats.doorsRemaining -= 1;

            pushLog(draft, `Segment ${seg.id} → ${TYPE_LABELS[row.type]} (Segment ${childSeg.id})`);
            draft.currentSegId = childSeg.id;
            draft.selectedSegId = childSeg.id;
            finishRoomSegment(draft, childSeg, action.wasNoisy, rng);
            break;
          }
        }
      });
    }

    case "CLIMB_OUT": {
      // Sewers (issue #30): "A metal ladder leads to the surface." The only way a run without a Boss
      // can be finished. Gated exactly like every other room action -- alive, not mid-fight, nothing
      // pending, and standing in the room that actually has the ladder.
      if (!state.alive || state.combat || isActionBlocked(state) || state.exitUsed) return state;
      if (action.segId !== state.currentSegId) return state;
      const seg = state.levels[state.activeLevel]?.segments.find((sg) => sg.id === action.segId);
      if (!seg?.roomContent?.isExit) return state;
      // Cave (issue #138): "Spend 1 torch to get out of this cave." Gated on *having* the torch
      // rather than routed through `spendTorches()`'s death path -- every other torch cost can
      // fairly kill you, but dying of darkness at the moment you escape is the one case where that
      // reads as a bug rather than a risk. `RoomInspector` disables the button on the same check.
      const exitCost = seg.roomContent.exitTorchCost ?? 0;
      if (state.torches < exitCost) return state;
      return produce(state, (draft) => {
        if (exitCost > 0) {
          spendTorches(draft, exitCost, "You spend a torch forcing your way out.", null, rng);
        }
        draft.exitUsed = true;
        // Janitor (issue #62): "Killed all creatures from a Sewer." Getting out is what counts as
        // having done the place -- see the milestone's own note for why "all creatures" can't be
        // taken literally against a lazily-generated map.
        if (draft.dungeonTypeKey === "sewers") draft.milestones.clearedASewer = true;
        pushLog(
          draft,
          exitCost > 0
            ? "You wade out through the flooded grotto and back into open air."
            : "You climb the ladder and haul yourself up into the daylight.",
          "descend",
        );
      });
    }

    case "RESOLVE_ROOM_ENTRY": {
      if (!state.alive || state.combat || action.segId !== state.currentSegId) return state;
      return produce(state, (draft) => {
        const level = draft.levels[draft.activeLevel];
        const seg = level?.segments.find((s) => s.id === action.segId);
        const monsters = seg?.monsters;
        if (!seg || !monsters || seg.monstersDefeated || seg.sneakedPast) return;

        if (action.choice === "attack") {
          startCombat(draft, seg.id, monsters, false, rng);
          return;
        }

        // Dog (issue #26): "In the dungeon, it doesn't allow you to Move in Silence." The reducer
        // is the actual authority (RoomEntryPrompt.tsx mirrors this by not offering the button).
        // Cave's "[Armor] of Laughter" (issue #138) is Cursed with the identical effect, so it ORs
        // in here rather than getting a second mechanism -- two entries, one block.
        if (blocksMoveSilently(draft)) return;

        // Move Silently: "Spend 1 torch and roll a die for each monster inside the room; if any
        // die results in a 1, the monsters see you and attack first." The room's monster count can
        // itself be a dice roll (e.g. "1d6 Goblins"), so it's resolved here rather than passed in
        // from the client, same as any other hidden roll (a fresh room's monster count included).
        if (
          !spendTorches(
            draft,
            1,
            `Segment ${seg.id}: spent 1 torch trying to move silently.`,
            seg.id,
            rng,
          )
        ) {
          return;
        }
        const monsterCount = resolveMonsterCount(monsters.count, rng);
        // Halfling: "When you roll to Move Silently, roll two dice and discard the lowest (except
        // in the Boss)" -- Boss rooms never reach this action at all (see startCombatIfMonsters's
        // direct, unconditional calls for descend-final/dead-end-final), so no extra check needed.
        const isHalfling = draft.raceName === "Halfling";
        // Sewers (issue #30): "If you try to move silently in a tunnel, monsters detect you if you
        // land 1 or 2 on the die." Everywhere else only a 1 gives you away -- a tunnel you can't see
        // the end of is twice as likely to betray you. Halfling's discard-the-lowest still applies
        // on top, so the two rules compose rather than one overriding the other.
        const detectOn = seg.type === "tunnel" ? 2 : 1;
        const detected = Array.from({ length: monsterCount }, () => {
          const rolls = isHalfling ? [rollDie(rng), rollDie(rng)] : [rollDie(rng)];
          return Math.max(...rolls);
        }).some((roll) => roll <= detectOn);
        if (detected) {
          pushLog(draft, `Segment ${seg.id}: you're spotted! The monsters attack first.`);
          startCombat(draft, seg.id, monsters, true, rng);
        } else {
          seg.sneakedPast = true;
          pushLog(draft, `Segment ${seg.id}: you slip through undetected.`);
        }
      });
    }

    case "PLAYER_ATTACK": {
      if (
        !state.alive ||
        !state.combat ||
        state.combat.outcome !== "ongoing" ||
        state.combat.pendingDamage !== null
      ) {
        return state;
      }
      return produce(state, (draft) => {
        const combat = draft.combat;
        if (!combat) return;

        if (combat.paralyzedTurns > 0) {
          combat.paralyzedTurns -= 1;
          pushLog(draft, "You are paralyzed and cannot act this turn.");
          applyMonsterTurn(draft, combat, rng);
          return;
        }

        const monster = combat.monsters.find((m) => m.id === action.targetId);
        if (!monster) return;

        // Assassin (issue #103) reads this, so it has to be captured before it's set -- and set here,
        // not at each of the handler's several exits, so no branch can forget to spend the opening
        // strike. A paralyzed turn returned above without reaching this, which is right: being unable
        // to act isn't attacking.
        const isFirstAttack = !combat.playerHasAttacked;
        combat.playerHasAttacked = true;

        // Goblin (New Races, issue #60): "If you roll 1 on the damage die, you explode. Dealing 5
        // damage to everyone in the room." Confirmed with the user: monsters only, the Goblin
        // themselves isn't harmed -- mirroring the Hireling Goblin Helper's own explosion (#84,
        // `HIRELING_EXPLODE`) rather than the Explosive monster ability's player-facing precedent.
        // Replaces the normal single-target attack entirely for this roll, reusing the identical
        // room-wide "fixed damage, Stoneskin/Intangible defense applies" shape Fireball/Insect
        // Rain/Goblin Helper's own explosion already use.
        if (draft.raceName === "Goblin" && action.roll === 1) {
          pushLog(draft, "You roll a 1 and explode, dealing 5 damage to everyone in the room!");
          for (const m of [...combat.monsters]) {
            const result = resolveSpellDamage(m, 5);
            m.hp = Math.max(0, m.hp - result.damageDealt);
            if (result.blocked) {
              pushLog(draft, `${m.name} is unharmed (${result.blocked}).`);
            } else if (result.damageDealt > 0) {
              pushLog(draft, `${m.name} takes ${result.damageDealt} damage.`);
            }
            handleMonsterDefeat(draft, combat, m, rng);
          }
          finishIfVictorious(draft, combat, rng);
          if (draft.combat && draft.combat.outcome === "ongoing") {
            applyMonsterTurn(draft, draft.combat, rng);
          }
          return;
        }

        // Rinoceroid's horn and the horns mutation (issue #30) are the same attack.
        const useHorn =
          action.useHorn === true &&
          (draft.raceName === "Rinoceroid" || (draft.mutations ?? []).includes(MUTATION_IDS.horns));
        const weaponBonus = useHorn ? undefined : draft.weapon?.bonusEffect;
        if (weaponBonus?.kind === "instantKillOnRoll" && action.roll === weaponBonus.roll) {
          pushLog(
            draft,
            `Your ${draft.weapon!.name} strikes true, killing ${monster.name} instantly!`,
          );
          monster.hp = 0;
          handleMonsterDefeat(draft, combat, monster, rng);
        } else {
          const { modifier } = useHorn
            ? { modifier: 0 }
            : parseWeaponFormula(draft.weapon?.formula ?? draft.weaponFormula);
          const baseTotal = Math.max(0, action.roll + modifier);
          const weaponTotal =
            baseTotal * attackMultiplier(draft, monster, useHorn, isFirstAttack) +
            attackBonus(draft, monster, useHorn);
          // Legibility: a tripled hit otherwise looks like an ordinary lucky roll, and Assassin
          // costs 200 coins plus a Boss kill -- the player should see it fire.
          if (isFirstAttack && draft.advancedClasses.includes("Assassin")) {
            pushLog(draft, "You strike before they know you're there — triple damage!");
          }
          const result = resolvePlayerAttack(
            monster,
            action.roll,
            weaponTotal,
            rng,
            useHorn ? [] : ignoredAbilities(draft),
          );

          if (result.selfDestructDamageToPlayer > 0) {
            // Goblinator (Advanced Class, issue #23): "Take -2 damage per Explosion."
            const explosionDamage = draft.advancedClasses.includes("Goblinator")
              ? Math.max(0, result.selfDestructDamageToPlayer - 2)
              : result.selfDestructDamageToPlayer;
            pushLog(draft, `${monster.name} explodes, dealing ${explosionDamage} damage to you!`);
            draft.hp = Math.max(0, draft.hp - explosionDamage);
          } else if (result.damageDealt > 0) {
            pushLog(draft, `You hit ${monster.name} for ${result.damageDealt} damage.`);
          } else {
            const blockedBy = result.events.find(
              (e) => e.kind === "stoneskin" || e.kind === "intangible",
            );
            pushLog(
              draft,
              blockedBy
                ? `Your attack fails to harm ${monster.name} (${blockedBy.kind}).`
                : `Your attack fails to harm ${monster.name}.`,
            );
          }
          monster.hp = Math.max(0, monster.hp - result.damageDealt);

          if (result.damageDealt > 0 && !useHorn) {
            const lifesteal = equippedEffects(draft).find((e) => e.kind === "lifesteal");
            if (lifesteal && lifesteal.kind === "lifesteal") {
              const healed = Math.min(lifesteal.amount, draft.maxHp - draft.hp);
              if (healed > 0) {
                draft.hp += healed;
                pushLog(draft, `Your weapon drains ${healed} HP from ${monster.name}.`);
              }
            }
          }

          for (const event of result.events) {
            if (event.kind === "horde") {
              const id = draft.nextMonsterId;
              draft.nextMonsterId += 1;
              combat.monsters.push({ ...HORDE_ORC, id });
              pushLog(draft, "An Orc joins the fight!");
            } else if (event.kind === "necromancy") {
              const id = draft.nextMonsterId;
              draft.nextMonsterId += 1;
              combat.monsters.push({ ...NECROMANCY_SKELETON, id });
              pushLog(draft, "A Skeleton rises to join the fight!");
            }
          }

          if (draft.hp <= 0) {
            if (trySurviveDeath(draft, rng, dungeonLog(draft))) return;
            draft.alive = false;
            draft.deathCause = "combat";
            pushLog(draft, "The explosion kills you instantly.", "descend");
            leaveRemains(draft, combat.segId);
            draft.combat = null;
            return;
          }

          if (result.monsterDefeated) {
            handleMonsterDefeat(draft, combat, monster, rng);
          } else {
            for (const event of result.events) {
              if (event.kind === "firebreath") {
                if (ignoresAbility(draft, "firebreath")) {
                  pushLog(
                    draft,
                    `${monster.name} breathes fire, but your weapon shields you from the flames.`,
                  );
                } else {
                  monster.bonusDamage += 10;
                  pushLog(
                    draft,
                    `${monster.name} breathes fire, readying a scorching counterattack!`,
                  );
                }
              } else if (event.kind === "sorcery") {
                monster.bonusDamage += event.bonus;
                pushLog(
                  draft,
                  `${monster.name} casts a spell, empowering its next attack by ${event.bonus}!`,
                );
              } else if (event.kind === "deathtouch") {
                if (ignoresAbility(draft, "deathtouch")) {
                  pushLog(
                    draft,
                    `${monster.name}'s touch turns deathly cold, but your ward protects you.`,
                  );
                } else {
                  monster.deathtouchPending = true;
                  pushLog(draft, `${monster.name}'s touch turns deathly cold...`);
                }
              } else if (event.kind === "regeneration") {
                monster.hp = Math.min(monster.maxHp, monster.hp + event.amount);
                pushLog(draft, `${monster.name} regenerates ${event.amount} HP.`);
              } else if (event.kind === "paralyze") {
                if (ignoresAbility(draft, "paralyze")) {
                  pushLog(
                    draft,
                    `${monster.name} prepares a paralyzing strike, but your ward protects you.`,
                  );
                } else {
                  monster.paralyzePending = event.turns;
                  pushLog(draft, `${monster.name} prepares a paralyzing strike!`);
                }
              }
            }
          }
        }

        finishIfVictorious(draft, combat, rng);
        if (draft.combat && draft.combat.outcome === "ongoing") {
          applyMonsterTurn(draft, draft.combat, rng);
        }
      });
    }

    case "ENGULF_BODY": {
      if (
        !state.alive ||
        !state.combat ||
        state.combat.outcome !== "ongoing" ||
        state.combat.pendingDamage !== null ||
        state.raceName !== "Slimemen" ||
        state.combat.engulfableBodies <= 0
      ) {
        return state;
      }
      return produce(state, (draft) => {
        const combat = draft.combat;
        if (!combat) return;

        if (combat.paralyzedTurns > 0) {
          combat.paralyzedTurns -= 1;
          pushLog(draft, "You are paralyzed and cannot act this turn.");
          applyMonsterTurn(draft, combat, rng);
          return;
        }

        combat.engulfableBodies -= 1;
        draft.hp = draft.maxHp;
        pushLog(draft, "You engulf a fallen enemy's body, regaining all your HP.");

        if (draft.combat && draft.combat.outcome === "ongoing") {
          applyMonsterTurn(draft, draft.combat, rng);
        }
      });
    }

    case "HIRELING_ATTACK": {
      // Deliberately not gated on the player's own paralysis (Paralyze's rulebook effect is on
      // the player specifically) or combat.paralyzedTurns at all -- and never calls
      // applyMonsterTurn(), since this is a free action that doesn't end the round (issue #84).
      if (
        !state.alive ||
        !state.combat ||
        state.combat.outcome !== "ongoing" ||
        state.combat.pendingDamage !== null ||
        !state.combat.hireling ||
        state.combat.hireling.hp <= 0 ||
        state.combat.hirelingAttackedThisRound
      ) {
        return state;
      }
      const hirelingDef = HIRELING_BY_NAME[state.combat.hireling.name];
      if (!hirelingDef?.weaponFormula) return state;
      return produce(state, (draft) => {
        const combat = draft.combat;
        if (!combat || !combat.hireling) return;
        const monster = combat.monsters.find((m) => m.id === action.targetId);
        if (!monster) return;
        combat.hirelingAttackedThisRound = true;

        // Same "fixed/rolled damage, Stoneskin/Intangible defense applies, no roll-of-1/6 special
        // abilities trigger" shape as spell damage -- the Hireling swings its own mundane weapon,
        // unaffected by the player's own gear.
        const { modifier } = parseWeaponFormula(hirelingDef.weaponFormula!);
        const total = Math.max(0, action.roll + modifier);
        const result = resolveSpellDamage(monster, total);
        monster.hp = Math.max(0, monster.hp - result.damageDealt);
        if (result.damageDealt > 0) {
          pushLog(
            draft,
            `${combat.hireling.name} hits ${monster.name} for ${result.damageDealt} damage.`,
          );
        } else {
          pushLog(
            draft,
            result.blocked
              ? `${combat.hireling.name}'s attack fails to harm ${monster.name} (${result.blocked}).`
              : `${combat.hireling.name}'s attack fails to harm ${monster.name}.`,
          );
        }

        if (result.monsterDefeated) {
          handleMonsterDefeat(draft, combat, monster, rng);
        }
        // In case the Hireling's own blow was the finishing one -- this action never calls
        // applyMonsterTurn(), but a won fight still needs to resolve Loot/close out combat.
        finishIfVictorious(draft, combat, rng);
      });
    }

    case "ANIMAL_ATTACK": {
      // Snake (Animals, issue #26/#29/#67): same free-action, once-per-round shape as
      // HIRELING_ATTACK -- deliberately not gated on the player's own paralysis, and never calls
      // applyMonsterTurn(). Unlike a Hireling, the Snake has no HP of its own to check here -- it
      // can't be harmed or lost, only ever a bonus attack.
      if (
        !state.alive ||
        !state.combat ||
        state.combat.outcome !== "ongoing" ||
        state.combat.pendingDamage !== null ||
        !state.animals.includes("Snake") ||
        state.combat.animalAttackedThisRound
      ) {
        return state;
      }
      return produce(state, (draft) => {
        const combat = draft.combat;
        if (!combat) return;
        const monster = combat.monsters.find((m) => m.id === action.targetId);
        if (!monster) return;
        combat.animalAttackedThisRound = true;

        // Same "fixed damage, Stoneskin/Intangible defense applies, no roll-of-1/6 special
        // abilities trigger" shape as spell damage/HIRELING_ATTACK -- Snake's own flat Dmg 1.
        const result = resolveSpellDamage(monster, ANIMAL_BY_NAME.Snake!.damage);
        monster.hp = Math.max(0, monster.hp - result.damageDealt);
        if (result.damageDealt > 0) {
          pushLog(draft, `Your Snake bites ${monster.name} for ${result.damageDealt} damage.`);
        } else {
          pushLog(
            draft,
            result.blocked
              ? `Your Snake's bite fails to harm ${monster.name} (${result.blocked}).`
              : `Your Snake's bite fails to harm ${monster.name}.`,
          );
        }

        if (result.monsterDefeated) {
          handleMonsterDefeat(draft, combat, monster, rng);
        }
        finishIfVictorious(draft, combat, rng);
      });
    }

    case "HIRELING_EXPLODE": {
      // Only Goblin Helper has this ability -- matched by name, same "no formal taxonomy"
      // precedent every other named-ability check in this file already uses.
      if (
        !state.alive ||
        !state.combat ||
        state.combat.outcome !== "ongoing" ||
        state.combat.pendingDamage !== null ||
        state.combat.hireling?.name !== "Goblin Helper" ||
        state.combat.hireling.hp <= 0
      ) {
        return state;
      }
      return produce(state, (draft) => {
        const combat = draft.combat;
        if (!combat || combat.hireling?.name !== "Goblin Helper") return;
        pushLog(draft, "Goblin Helper explodes!");
        // Same room-wide "fixed damage, Stoneskin/Intangible defense applies" shape Fireball/
        // Insect Rain already use -- spread into a snapshot since handleMonsterDefeat mutates
        // combat.monsters by filtering as it goes.
        for (const monster of [...combat.monsters]) {
          const result = resolveSpellDamage(monster, 5);
          monster.hp = Math.max(0, monster.hp - result.damageDealt);
          if (result.blocked) {
            pushLog(draft, `${monster.name} is unharmed (${result.blocked}).`);
          } else if (result.damageDealt > 0) {
            pushLog(draft, `${monster.name} takes ${result.damageDealt} damage.`);
          }
          handleMonsterDefeat(draft, combat, monster, rng);
        }
        // A genuine self-destruct -- gone for good, not just this fight's own copy.
        combat.hireling = null;
        draft.hireling = null;
        draft.hirelingHp = null;
        finishIfVictorious(draft, combat, rng);
      });
    }

    case "RIDE_CART": {
      // Mine (issue #138): "a railroad going down the entire Wide Tunnel... an attack of 1d6+3
      // damage to any monsters in the way." Gated on being in a *wide* tunnel -- the rail only runs
      // there, so a Grotto or a narrow tunnel has no cart to ride. Free and doesn't end the round,
      // the same shape as HIRELING_EXPLODE and the Snake's own attack; capped at one ride per fight
      // by `cartUsed`, which is how "stop the cart if the monster hasn't died" is expressed.
      if (
        !state.alive ||
        !state.combat ||
        state.combat.outcome !== "ongoing" ||
        state.combat.pendingDamage !== null ||
        state.combat.cartUsed ||
        state.dungeonTypeKey !== "mine"
      ) {
        return state;
      }
      const cartSeg = state.levels[state.activeLevel]?.segments.find(
        (s) => s.id === state.combat!.segId,
      );
      if (cartSeg?.type !== "tunnel") return state;
      return produce(state, (draft) => {
        const combat = draft.combat;
        if (!combat) return;
        combat.cartUsed = true;
        const damage = Math.max(0, action.roll + 3);
        pushLog(draft, `You kick the ore cart loose and ride it down the rail (${damage} damage).`);
        // Snapshot the list: handleMonsterDefeat filters combat.monsters as it goes. Same
        // fixed-damage, defenses-still-apply shape Fireball and the Goblin Helper already use.
        for (const monster of [...combat.monsters]) {
          const result = resolveSpellDamage(monster, damage);
          monster.hp = Math.max(0, monster.hp - result.damageDealt);
          if (result.blocked) {
            pushLog(draft, `${monster.name} is unharmed (${result.blocked}).`);
          } else if (result.damageDealt > 0) {
            pushLog(draft, `${monster.name} takes ${result.damageDealt} damage.`);
          }
          handleMonsterDefeat(draft, combat, monster, rng);
        }
        finishIfVictorious(draft, combat, rng);
      });
    }

    case "RESOLVE_DAMAGE": {
      if (!state.alive || !state.combat || state.combat.pendingDamage === null) return state;
      return produce(state, (draft) => {
        const combat = draft.combat;
        if (!combat || combat.pendingDamage === null) return;
        const result = resolveDamageChoice(
          draft,
          combat,
          action.absorbWith,
          rng,
          dungeonLog(draft),
        );
        // Blacksmith (issue #70) -- a dungeon-side milestone, so it stays out of the shared core.
        if (result.armorDestroyed) draft.milestones.hasHadArmorDestroyed = true;
        if (result.died) {
          draft.alive = false;
          draft.deathCause = "combat";
          leaveRemains(draft, combat.segId);
          draft.combat = null;
        }
      });
    }

    case "CAST_SPELL": {
      if (!state.alive || state.combat?.pendingDamage != null || isActionBlocked(state))
        return state;
      const spell = SPELL_TABLE_BY_KEY[action.table]?.[action.spellRoll];
      const key = spellKey(action.table, action.spellRoll);
      const remaining = state.spellUses[key] ?? 0;
      // Matched by name, not (table, roll) -- see KNOWN_CASTABLE_SPELL_NAMES's own doc comment
      // (combat.ts) for why: New Spells (issue #24) means the same name can appear under more than
      // one table (Elemental's Cold Ray/Lightning/Fireball are the identical Core spells), and
      // every New Spells effect beyond those isn't wired up to a real case here yet regardless of
      // how many uses of it the character actually has.
      if (!spell || remaining <= 0 || !KNOWN_CASTABLE_SPELL_NAMES.has(spell.name)) return state;
      const combatOnly = COMBAT_ONLY_SPELL_NAMES.has(spell.name);
      if (combatOnly && !state.combat) return state;
      if (TARGETED_SPELL_NAMES.has(spell.name) && action.targetId == null) return state;
      if (spell.name === "Teleport") {
        const destLevel = action.destLevel != null ? state.levels[action.destLevel] : undefined;
        const destSeg = destLevel?.segments.find((s) => s.id === action.destSegId);
        if (!destSeg || !isTeleportDestination(destSeg, state.combat!.segId)) return state;
      }

      return produce(state, (draft) => {
        draft.spellUses[key] = remaining - 1;
        draft.milestones.hasCastSpell = true; // Scholar (issue #70)
        const combat = draft.combat;

        if (combat && combat.paralyzedTurns > 0) {
          combat.paralyzedTurns -= 1;
          pushLog(draft, "You are paralyzed and cannot cast a spell this turn.");
          applyMonsterTurn(draft, combat, rng);
          return;
        }

        // Teleport is the one spell the shared core can't own: it needs a destination segment,
        // which only exists in a dungeon (out in the world, fleeing is the equivalent escape).
        if (spell.name === "Teleport") {
          if (combat) {
            const destLevelIndex = action.destLevel!;
            const destSeg = draft.levels[destLevelIndex]!.segments.find(
              (s) => s.id === action.destSegId,
            )!;
            pushLog(
              draft,
              `You cast Teleport and vanish from the fight, reappearing in ${TYPE_LABELS[destSeg.type]} (Segment ${destSeg.id}, Level ${destLevelIndex + 1}).`,
              "descend",
            );
            draft.combat = null;
            draft.activeLevel = destLevelIndex;
            draft.currentSegId = destSeg.id;
            draft.selectedSegId = destSeg.id;
            rerollMonstersIfNeeded(draft, destSeg, rng);
          }
          return; // fled -- no monster counter-turn
        }
        // Necromancer (issue #70) tracks this one specifically, and it's a dungeon-side milestone.
        if (spell.name === "Cold Ray") draft.milestones.hasCastColdRay = true;
        castCombatSpell(
          draft,
          combat ?? null,
          spell.name,
          action.targetId,
          rng,
          dungeonLog(draft),
          MAX_TORCHES,
        );

        if (draft.combat) {
          finishIfVictorious(draft, draft.combat, rng);
          if (draft.combat && draft.combat.outcome === "ongoing") {
            applyMonsterTurn(draft, draft.combat, rng);
          }
        }
      });
    }

    case "OPEN_TREASURE": {
      if (
        !state.alive ||
        state.treasures <= 0 ||
        !state.dungeonTypeKey ||
        state.combat?.pendingDamage != null ||
        isActionBlocked(state)
      ) {
        return state;
      }
      const outcome = DUNGEON_TABLES[state.dungeonTypeKey].treasure[action.roll];
      if (!outcome) return state;

      return produce(state, (draft) => {
        const combat = draft.combat;

        if (combat && combat.paralyzedTurns > 0) {
          combat.paralyzedTurns -= 1;
          pushLog(draft, "You are paralyzed and cannot examine the treasure this turn.");
          applyMonsterTurn(draft, combat, rng);
          return;
        }

        draft.treasures -= 1;

        // Issue #110: a reward whose worth depends on *when* it's used is stowed instead of

        // fired here -- a Health Potion at full HP was simply wasted before. An Ogre keeps #83's

        // sell-instead path for the two that are actually potions.

        const ogreBlocked =
          draft.raceName === "Ogre" && OGRE_RESTRICTED_REWARD_KINDS.has(outcome.effect.kind);

        if (isHoldableRewardEffect(outcome.effect) && !ogreBlocked) {
          addConsumable(
            draft,
            { name: rewardItemName(outcome.text), text: outcome.text, effect: outcome.effect },
            `Treasure: ${outcome.text}`,
            rng,
          );
        } else
          switch (outcome.effect.kind) {
            case "heldValue": {
              addHeldItem(
                draft,
                { name: outcome.effect.name, worth: outcome.effect.amount },
                `Treasure: ${outcome.text}`,
              );
              break;
            }
            case "heldValueRoll": {
              let sum = 0;
              for (let i = 0; i < outcome.effect.dice; i++) sum += rollDie(rng);
              const worth = sum * outcome.effect.multiplier;
              addHeldItem(
                draft,
                { name: outcome.effect.name, worth },
                `Treasure: ${outcome.text} (worth ${worth} coins)`,
              );
              break;
            }
            case "grantTorchesRoll": {
              // Sewers (issue #30): "1d6 Torches" -- capped at MAX_TORCHES like every other torch
              // grant, so a full bag simply wastes the excess rather than overfilling.
              // Every torch grant in the book is d6-based, and `rollDie` is this codebase's only die
              // primitive -- `sides` is carried on the effect for honesty about the printed table
              // rather than because anything rolls anything else.
              let rolled = 0;
              for (let i = 0; i < outcome.effect.dice; i++) rolled += rollDie(rng);
              const gained = Math.min(rolled, MAX_TORCHES - draft.torches);
              draft.torches += gained;
              pushLog(
                draft,
                `Treasure: ${outcome.text} (+${gained} torch${gained === 1 ? "" : "es"})`,
              );
              break;
            }
            case "healAll": {
              // Ogre (New Races, issue #60): "Cannot use potions" -- the Treasure is still spent
              // (already decremented above), but instead of vanishing outright it becomes a sellable
              // HeldItem (issue #83), same flat placeholder worth every Ogre-unusable potion/scroll
              // outcome uses.
              if (draft.raceName === "Ogre") {
                addHeldItem(
                  draft,
                  { name: "Health Potion", worth: OGRE_UNUSABLE_TREASURE_WORTH },
                  `Treasure: ${outcome.text} Ogres cannot use potions -- sold instead.`,
                );
                break;
              }
              const healed = draft.maxHp - draft.hp;
              draft.hp = draft.maxHp;
              pushLog(draft, `Treasure: ${outcome.text}${healed > 0 ? ` (+${healed} HP)` : ""}`);
              break;
            }
            case "restoreAllSpells": {
              if (draft.raceName === "Ogre") {
                addHeldItem(
                  draft,
                  { name: "Mana Potion", worth: OGRE_UNUSABLE_TREASURE_WORTH },
                  `Treasure: ${outcome.text} Ogres cannot use potions -- sold instead.`,
                );
                break;
              }
              // Reads the persisted ceiling directly (issue #75) rather than a client-computed value
              // passed through the action -- the same fix `rest()` needed, and for the same reason.
              draft.spellUses = { ...draft.maxSpellUses };
              pushLog(draft, `Treasure: ${outcome.text}`);
              break;
            }
            case "randomSpell": {
              // Ogre (New Races, issue #60): "Cannot use scrolls" -- the scroll is still spent, but
              // instead of vanishing it becomes a sellable HeldItem (issue #83).
              if (draft.raceName === "Ogre") {
                addHeldItem(
                  draft,
                  { name: "Magic Scroll", worth: OGRE_UNUSABLE_TREASURE_WORTH },
                  `Treasure: ${outcome.text} Ogres cannot use scrolls -- sold instead.`,
                );
                break;
              }
              const spellRoll = rollDie(rng);
              const key = spellKey("basic", spellRoll);
              draft.spellUses[key] = (draft.spellUses[key] ?? 0) + 1;
              // Raises the ceiling too (issue #75), same as every other spell-granting site.
              draft.maxSpellUses[key] = (draft.maxSpellUses[key] ?? 0) + 1;
              const spellName = SPELL_TABLE[spellRoll]?.name ?? "a spell";
              draft.milestones.hasCastSpell = true; // Scholar (issue #70): "used a spell or scroll"
              pushLog(draft, `Treasure: ${outcome.text} — learned ${spellName}!`);
              break;
            }
            case "restoreRandomSpellUse": {
              // Ziggurat's "Strange Fruit" (issue #30): "recover 1 use of a spell" -- a random
              // currently-known spell, unlike Reload Mana (still deferred), which lets the player
              // choose. Not one of Ogre's three restricted categories (potions/scrolls/armor), so no
              // Ogre check here.
              const knownKeys = Object.keys(draft.spellUses);
              if (knownKeys.length === 0) {
                pushLog(draft, `Treasure: ${outcome.text} You don't know any spells yet.`);
                break;
              }
              const key = knownKeys[rollDie(rng) % knownKeys.length]!;
              const max = draft.maxSpellUses[key] ?? draft.spellUses[key]!;
              draft.spellUses[key] = Math.min(max, (draft.spellUses[key] ?? 0) + 1);
              const { table, roll: spellRoll } = parseSpellKey(key);
              const spellName = SPELL_TABLE_BY_KEY[table]?.[spellRoll]?.name ?? "a spell";
              pushLog(draft, `Treasure: ${outcome.text} — recovers a use of ${spellName}.`);
              break;
            }
            case "flavor": {
              pushLog(draft, `Treasure: ${outcome.text}`);
              break;
            }
            case "rerollColumn": {
              const roll = rollDie(rng);
              if (outcome.effect.column === "wonders") {
                resolveWonder(draft, DUNGEON_TABLES[draft.dungeonTypeKey!].wonders[roll]!, rng);
              } else if (outcome.effect.column === "magicItem") {
                resolveMagicItem(
                  draft,
                  DUNGEON_TABLES[draft.dungeonTypeKey!].magicItem[roll]!,
                  rng,
                );
              } else if (outcome.effect.column === "potions") {
                // Only the Laboratory prints a Potions column, and only its own Reward table
                // redirects here -- the optional lookup keeps a hypothetical redirect from a type
                // without one from crashing.
                const potion = DUNGEON_TABLES[draft.dungeonTypeKey!].potions?.[roll];
                if (potion) resolvePotion(draft, potion, rng);
              } else {
                const base = DUNGEON_TABLES[draft.dungeonTypeKey!].weapon[roll]!;
                draft.spareWeapons.push({
                  name: base.name,
                  formula: base.formula,
                  twoHanded: base.twoHanded,
                });
                pushLog(draft, `Treasure: You find a ${base.name} (${base.formula} damage).`);
              }
              break;
            }
          }

        if (draft.combat) {
          applyMonsterTurn(draft, draft.combat, rng);
        }
      });
    }

    case "RESUME_DUNGEON": {
      // Immer deep-freezes everything it produces; action.dungeon is the frozen output of
      // some earlier produce() call (possibly still sitting in a caller's pendingDungeons
      // list). Deep-cloning it before handing pieces to a *new* draft avoids both mutating
      // frozen data (which throws) and aliasing that old snapshot's objects going forward.
      const persisted = structuredClone(action.dungeon);
      return produce(
        createInitialDungeonState(
          action.torches,
          action.hp,
          action.weaponFormula,
          action.spellUses,
          action.characterName,
          0,
          0,
          0,
          [],
          action.maxHp,
          [],
          null,
          0,
          0,
          action.raceName,
          action.className,
          {},
          {},
          [],
          [],
          null,
          [],
          createInitialMilestones(),
          action.maxSpellUses,
          [],
          [],
        ),
        (draft) => {
          // Laboratory (issue #30): mutations belong to the *character*, not the run, so the
          // arriving character brings their own -- a new adventurer on a dead one's map does not
          // inherit the dead character's mutations.
          draft.mutations = action.mutations ?? [];
          draft.zombieRevivals = action.zombieRevivals ?? 0;
          draft.curiosities = action.curiosities ?? {};
          // "Your Hands" (issue #100): likewise the arriving character's own arms. RESUME_DUNGEON
          // carries no weapon at all (it becomes remains), so there's nothing to bench here.
          draft.armLost = action.armLost ?? false;
          restoreMapFromPersisted(
            draft,
            persisted,
            rng,
            "A new adventurer takes up the fallen's path.",
            true,
          );
        },
      );
    }

    case "RETURN_TO_DUNGEON": {
      // Same aliasing/freezing concern as RESUME_DUNGEON above.
      const persisted = structuredClone(action.dungeon);
      return produce(
        createInitialDungeonState(
          action.torches,
          action.hp,
          action.weaponFormula,
          action.spellUses,
          action.characterName,
          action.coins,
          action.treasures,
          action.keys,
          action.heldItems,
          action.maxHp,
          action.armor,
          action.weapon,
          action.monsterKills,
          action.bossKills,
          action.raceName,
          action.className,
          action.killsByName,
          action.killsByAbility,
          action.spareWeapons,
          action.advancedClasses,
          action.hireling,
          action.animals,
          action.milestones,
          action.maxSpellUses,
          action.buildings,
          action.spareArmor,
        ),
        (draft) => {
          // Ziggurat's Effect of the Forgotten Gods (issue #93): `runDamageBonus` belongs to the
          // *run*, not the character, so it's restored from the persisted run rather than passed in
          // as an action field like every resource above. `createInitialDungeonState()` would
          // otherwise default it to 0 and silently drop a bonus that cost a provision to earn.
          // RESUME_DUNGEON deliberately does *not* do this -- a new character taking over someone
          // else's map doesn't inherit their blessing, same as every other character-specific field.
          draft.runDamageBonus = persisted.runDamageBonus ?? 0;
          // Same character, so their mutations come along unchanged (issue #30).
          draft.mutations = action.mutations ?? [];
          draft.zombieRevivals = action.zombieRevivals ?? 0;
          draft.curiosities = action.curiosities ?? {};
          // Same trip, so the potions the character walked out with walk back in (issue #110).
          draft.consumables = action.consumables ?? [];
          // Same trip, so the Hireling comes back as battered as it left (issue #114) -- resting in
          // Town heals the character, never the hired help.
          draft.hirelingHp = action.hirelingHp ?? null;
          draft.armLost = action.armLost ?? false;
          restoreMapFromPersisted(draft, persisted, rng, "You return to the dungeon.", false);
          // "Your Hands" (issue #100): wielding is unrestricted in Town, so a two-handed weapon
          // equipped at the shops is caught here, on the way back in -- the same check a genuinely
          // fresh entry makes (see `DungeonScreen.tsx`). No Light globe survives a trip to Town, so
          // only a Lamp or a Torchbearer can keep it equipped.
          const benched = benchUnusableWeapon(draft);
          if (benched) {
            pushLog(
              draft,
              `You need a hand for your torch, so the ${benched} goes into your pack.`,
            );
          }
        },
      );
    }

    default:
      return state;
  }
}
