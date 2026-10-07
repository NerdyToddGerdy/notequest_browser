/**
 * The draft primitives every other part of a dungeon run builds on: the log, torch spending (and
 * the Darkness it can end in), leaving remains, and placing a new segment.
 *
 * Split out of `dungeonReducer.ts` (issue #144), which still owns every action -- these are the
 * helpers its cases share. Behavior is unchanged; only where the code lives moved.
 */
import type { Draft } from "immer";
import type { SegmentType } from "../../data/dungeonTypes.ts";
import { OPPOSITE, assignDirections, resolveRoomExtras } from "../dungeon.ts";
import { trySurviveDeath, type FightLog } from "../fight.ts";
import type { DoorState, DungeonState, DungeonStats, SegmentState } from "../dungeonState.ts";
import { benchUnusableWeapon } from "../hands.ts";
import type { RNG } from "../rng.ts";

export function bumpStatsForNewSegment(
  stats: Draft<DungeonStats>,
  type: SegmentType,
  doors: number,
): void {
  stats.segments += 1;
  if (type === "corridor") stats.corridors += 1;
  else if (type === "staircase") stats.staircases += 1;
  else if (type !== "final") stats.rooms += 1;
  stats.doorsRemaining += doors;
}

export function pushLog(
  draft: Draft<DungeonState>,
  message: string,
  variant: "normal" | "descend" = "normal",
): void {
  draft.log.unshift({ id: draft.nextLogId, message, variant });
  draft.nextLogId += 1;
}

export const DARKNESS_MESSAGE =
  "The darkness devours you. Without a torch, there is no way forward.";

/**
 * "If you lose all HP, your character is dead and all your equipment will be on the floor of
 * that room to be recovered by your next character" -- and per the Darkness section, the same
 * applies there too. Drops the dying character's coins/Treasures/Keys/held items into `segId`
 * (falling back to the entrance if that segment can't be found), merging with any remains
 * already there.
 */
export function leaveRemains(draft: Draft<DungeonState>, segId: number | null): void {
  if (
    draft.coins === 0 &&
    draft.treasures === 0 &&
    draft.keys === 0 &&
    draft.heldItems.length === 0 &&
    (draft.consumables?.length ?? 0) === 0 &&
    draft.armor.length === 0 &&
    draft.spareArmor.length === 0 &&
    !draft.weapon &&
    draft.spareWeapons.length === 0
  ) {
    return;
  }
  const level = draft.levels[draft.activeLevel];
  const seg =
    level?.segments.find((s) => s.id === segId) ?? level?.segments.find((s) => s.isEntrance);
  if (!seg) return;
  if (seg.remains) {
    seg.remains.names.push(draft.characterName);
    seg.remains.coins += draft.coins;
    seg.remains.treasures += draft.treasures;
    seg.remains.keys += draft.keys;
    seg.remains.heldItems.push(...draft.heldItems);
    seg.remains.consumables = [...(seg.remains.consumables ?? []), ...(draft.consumables ?? [])];
    seg.remains.armor.push(...draft.armor);
    seg.remains.spareArmor.push(...draft.spareArmor);
    if (!seg.remains.weapon) seg.remains.weapon = draft.weapon;
    seg.remains.weapons.push(...draft.spareWeapons);
  } else {
    seg.remains = {
      names: [draft.characterName],
      coins: draft.coins,
      treasures: draft.treasures,
      keys: draft.keys,
      heldItems: [...draft.heldItems],
      consumables: [...(draft.consumables ?? [])],
      armor: [...draft.armor],
      spareArmor: [...draft.spareArmor],
      weapon: draft.weapon,
      weapons: [...draft.spareWeapons],
    };
  }
}

/** The dungeon's own log sink, handed to the shared core so its messages land in the roll log. */
export function dungeonLog(draft: Draft<DungeonState>): FightLog {
  return (message, variant) => pushLog(draft, message, variant);
}

/** Spends `cost` torches, logging `message`; if there aren't enough, the Darkness kills the character instead. */
export function spendTorches(
  draft: Draft<DungeonState>,
  cost: number,
  message: string,
  segId: number | null = null,
  rng: RNG = Math.random,
): boolean {
  if (draft.torches < cost) {
    if (draft.className === "Miner" || draft.advancedClasses.includes("Miner")) {
      // "If you run out of torches, you can leave the dungeon" -- the base Class and the Advanced
      // Class (issue #62) share the identical ability text, same "two rulebook entries, one bonus"
      // OR'd-condition precedent as Grave Digger/Gravedigger. The Darkness spares a Miner outright
      // rather than killing them; the action they were attempting still fails (they're still out
      // of torches), but they're free to use the existing Retreat to Town button.
      pushLog(
        draft,
        "You're out of torches, but a lifetime underground taught you the way out. Retreat to Town before the Darkness finds you.",
      );
      return false;
    }
    if (trySurviveDeath(draft, rng, dungeonLog(draft))) return false; // still out of torches, but alive
    draft.alive = false;
    // Set explicitly rather than left null: every reader already treats null as the Darkness
    // (`deathCause ?? "darkness"`, `deathCause !== "combat"`), but the field exists precisely to
    // distinguish the two, and relying on the absence of a value made the one path that isn't
    // combat the only one that never says so.
    draft.deathCause = "darkness";
    pushLog(draft, DARKNESS_MESSAGE, "descend");
    leaveRemains(draft, segId);
    return false;
  }
  draft.torches -= cost;
  pushLog(draft, message);
  // "Your Hands" (issue #100): a Light globe is "worth a torch," so it's used up like one -- the
  // next spend of any size burns through it. This is the single place torches ever actually leave
  // the counter, which is why it's also the single place the globe can go out. A two-handed weapon
  // wielded under that light becomes unusable at the same instant, so it's benched here rather than
  // left as an illegal equipped state.
  if (cost > 0 && draft.lightActive) {
    draft.lightActive = false;
    const benched = benchUnusableWeapon(draft);
    if (benched) {
      pushLog(draft, `The conjured light gutters out; you stow the ${benched} to take up a torch.`);
    }
  }
  return true;
}

/** Builds a new segment (with Room Content/Monsters resolved if it's a room type) and reserves its id. */
export function buildSegment(
  draft: Draft<DungeonState>,
  type: SegmentType,
  box: { x: number; y: number; w: number; h: number; cx: number; cy: number },
  cameFromDir: SegmentState["cameFromDir"],
  doorCount: number,
  flavor: string | null,
  rng: RNG,
  isEntrance = false,
  /** Sewers (issue #30): the rolled row said this segment has a Floodgate. */
  hasFloodgate = false,
): Draft<SegmentState> {
  const id = draft.nextSegmentId;
  draft.nextSegmentId += 1;
  const doors: Draft<DoorState>[] = assignDirections(cameFromDir, doorCount).map((dir) => ({
    dir,
    opened: false,
    childId: null,
    leadsToLevel: null,
  }));
  // Sewers (issue #30). The forward door is the one opposite the way in, matching "each tunnel
  // segment continues the previous one"; an entrance tunnel (the 4-way manhole intersection) has no
  // way in, so every one of its doors continues a tunnel. The Floodgate, if any, is put on a
  // *different* door where possible -- a floodgate on the only way forward would dead-end the
  // tunnel behind a lock that can't be broken.
  if (type === "tunnel") {
    const forwardDir = cameFromDir ? OPPOSITE[cameFromDir] : null;
    for (const door of doors) {
      if (forwardDir === null || door.dir === forwardDir) door.continuesTunnel = true;
    }
  }
  if (hasFloodgate && doors.length > 0) {
    const gate = doors.find((d) => !d.continuesTunnel) ?? doors[0]!;
    gate.floodgate = true;
  }
  const extras = draft.dungeonTypeKey
    ? resolveRoomExtras(type, draft.dungeonTypeKey, rng, isEntrance)
    : undefined;
  return {
    id,
    type,
    ...box,
    cameFromDir,
    flavor,
    doors,
    isEntrance,
    ...(extras
      ? {
          roomContent: extras.roomContent,
          monsters: extras.monsters ?? undefined,
          secretPassageSearched: false,
          secretPassageResult: null,
          trapResult: null,
          chestOpened: false,
          chestResult: null,
        }
      : {}),
  };
}
