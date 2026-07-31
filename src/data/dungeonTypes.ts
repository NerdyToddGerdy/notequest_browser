/** Deadly Dungeons (Expanded World, issue #30): "citadel"/"pyramid"/"ziggurat"/"necropolis" are the
 * first 4 of 12 new dungeon types, chosen because -- per the rulebook's own per-type Segments/
 * Trap/Room Content/Monsters/Reward/Boss tables -- they fit this app's existing data-driven shape
 * directly, unlike Sewers/Entrails/Cave (which use a different Tunnel-based Segments concept) or
 * Mega Dungeon (which needs a Faction-reskinning system this app doesn't have). */
export type DungeonTypeKey =
  | "palace"
  | "crypt"
  | "tomb"
  | "sanctuary"
  | "temple"
  | "prison"
  | "citadel"
  | "pyramid"
  | "ziggurat"
  | "necropolis"
  | "sewers"
  | "laboratory";

export type SegmentType =
  | "corridor"
  | "staircase"
  | "room-small"
  | "room-medium"
  | "room-wide"
  | "room-large"
  /** Citadel/Pyramid/Necropolis (issue #30): "Big room," a distinct size the rulebook prints
   * between "Wide room" and "Large hall with pillars" in these 3 types' own Segments tables --
   * genuinely new, not a reskin of an existing size (see `sizeFor()` in `dungeon.ts`). */
  | "room-big"
  /** Sewers (issue #30): "Tunnels work like corridors but you can't see the rest of it. Each tunnel
   * segment continues the previous one. In a tunnel you must roll to add Monster but not Content."
   * That last clause is why it isn't just a reskinned corridor -- a corridor rolls neither, a room
   * rolls both, and a tunnel sits between them. */
  | "tunnel"
  | "final";

export type DoorRollOutcome = "trap" | "locked" | "unlocked";

/** Table: Open a Door (1d6). Same for every dungeon type. */
export const OPEN_DOOR_TABLE: Record<number, DoorRollOutcome> = {
  1: "trap",
  2: "locked",
  3: "locked",
  4: "unlocked",
  5: "unlocked",
  6: "unlocked",
};

export interface SegmentsColumnResult {
  /** Sewers (issue #30): this segment has a Floodgate -- "works like normal doors but cannot be
   * destroyed, has no traps, and will always be locked." One of the new segment's own doors is
   * marked `DoorState.floodgate` when it's built. */
  floodgate?: boolean;
  type: SegmentType;
  doors: number;
  text: string;
  flavor?: string;
}

export interface SegmentsRow {
  staircase: SegmentsColumnResult;
  corridor: SegmentsColumnResult;
  room: SegmentsColumnResult;
  /** Sewers (issue #30) prints *two* tunnel columns where every other type has one per source
   * segment: "Following a Tunnel" (carrying on along it) and "Open from a Tunnel" (a side door).
   * The distinction is the whole character of the type -- following a tunnel yields more tunnel,
   * opening off it yields rooms -- so rather than flatten it, a tunnel's forward door is marked
   * `DoorState.continuesTunnel` when the segment is built, and `rollSegment()` picks the column
   * from that. Only Sewers sets these. */
  tunnelForward?: SegmentsColumnResult;
  tunnelSide?: SegmentsColumnResult;
}

export interface DungeonTypeDef {
  key: DungeonTypeKey;
  roll: number;
  name: string;
  entranceType: SegmentType;
  doors: number;
  entrance: string;
}

/** Table: Segments (1d6) -- identical across all six Core Book dungeon types. */
export const SEGMENTS_TABLE: Record<number, SegmentsRow> = {
  1: {
    staircase: { type: "corridor", doors: 1, text: "Corridor with another door." },
    corridor: { type: "room-small", doors: 1, text: "Small room with another door." },
    room: { type: "room-small", doors: 1, text: "Small room with another door." },
  },
  2: {
    staircase: { type: "corridor", doors: 2, text: "Corridor with two other doors." },
    corridor: { type: "room-medium", doors: 1, text: "Medium size room with another door." },
    room: { type: "room-medium", doors: 0, text: "Medium size room." },
  },
  3: {
    staircase: { type: "corridor", doors: 2, text: "Corridor with two other doors." },
    corridor: { type: "room-wide", doors: 1, text: "Wide room with another door." },
    room: { type: "room-wide", doors: 0, text: "Wide room." },
  },
  4: {
    staircase: { type: "corridor", doors: 2, text: "Corridor with two other doors." },
    corridor: { type: "room-wide", doors: 2, text: "Wide room with two other doors." },
    room: { type: "room-wide", doors: 0, text: "Wide room." },
  },
  5: {
    staircase: { type: "corridor", doors: 3, text: "Corridor with three other doors." },
    corridor: { type: "room-large", doors: 2, text: "Large room with two other doors." },
    room: {
      type: "room-large",
      doors: 0,
      text: "Large room with pillars.",
      flavor: "Pillars line the walls.",
    },
  },
  6: {
    staircase: { type: "corridor", doors: 3, text: "Corridor with three other doors." },
    corridor: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
    room: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
  },
};

/** Table: Secret Passage (1d6) -- identical across all six Core Book dungeon types. */
export const SECRET_PASSAGE_TABLE: Record<number, string> = {
  1: "You have activated a Trap!",
  2: "There's nothing here.",
  3: "There's nothing here.",
  4: "You have found a hidden Chest!",
  5: "You have found a hidden Chest!",
  6: "A secret door to a Staircase.",
};

/** Deadly Dungeons (issue #30): unlike the Core 6, each new dungeon type prints its own Segments
 * table -- some genuinely differ from `SEGMENTS_TABLE` (room-size progression, door counts), so
 * this can't reuse the "one shared table" precedent the way Secret Passage mostly still can (see
 * `SECRET_PASSAGE_TABLE_BY_TYPE` below). `rollSegment()` (`dungeon.ts`) checks this map first,
 * falling back to `SEGMENTS_TABLE` for the Core 6 (and for any new type that turns out to match it
 * exactly, sparing a redundant copy). Citadel and Pyramid's own printed tables are byte-for-byte
 * identical, so they share one object. */
const CITADEL_PYRAMID_SEGMENTS: Record<number, SegmentsRow> = {
  1: {
    staircase: { type: "corridor", doors: 1, text: "Corridor with another door." },
    corridor: { type: "room-small", doors: 1, text: "Small room with another door." },
    room: { type: "room-small", doors: 0, text: "Small room." },
  },
  2: {
    staircase: { type: "corridor", doors: 2, text: "Corridor with two other doors." },
    corridor: { type: "room-medium", doors: 1, text: "Medium size room with another door." },
    room: { type: "room-medium", doors: 0, text: "Medium size room." },
  },
  3: {
    staircase: { type: "corridor", doors: 2, text: "Corridor with two other doors." },
    corridor: { type: "room-medium", doors: 1, text: "Medium size room with another door." },
    room: { type: "room-medium", doors: 0, text: "Medium size room." },
  },
  4: {
    staircase: { type: "corridor", doors: 2, text: "Corridor with two other doors." },
    corridor: { type: "room-wide", doors: 2, text: "Wide room with two other doors." },
    room: { type: "room-big", doors: 0, text: "Big room." },
  },
  5: {
    staircase: { type: "corridor", doors: 3, text: "Corridor with three other doors." },
    corridor: { type: "room-wide", doors: 2, text: "Wide room with two other doors." },
    room: {
      type: "room-large",
      doors: 0,
      text: "Large hall with pillars.",
      flavor: "Pillars line the walls.",
    },
  },
  6: {
    staircase: { type: "corridor", doors: 3, text: "Corridor with three other doors." },
    corridor: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
    room: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
  },
};

const ZIGGURAT_SEGMENTS: Record<number, SegmentsRow> = {
  1: {
    staircase: { type: "corridor", doors: 1, text: "Corridor with another door." },
    corridor: { type: "room-small", doors: 1, text: "Small room with another door." },
    room: {
      type: "room-large",
      doors: 0,
      text: "Large hall with pillars.",
      flavor: "Pillars line the walls.",
    },
  },
  2: {
    staircase: { type: "corridor", doors: 1, text: "Corridor with another door." },
    corridor: { type: "room-medium", doors: 1, text: "Medium size room with another door." },
    room: {
      type: "room-large",
      doors: 0,
      text: "Large hall with pillars.",
      flavor: "Pillars line the walls.",
    },
  },
  3: {
    staircase: { type: "corridor", doors: 2, text: "Corridor with two other doors." },
    corridor: { type: "room-medium", doors: 1, text: "Medium size room with another door." },
    room: { type: "corridor", doors: 1, text: "Corridor with a door at the end." },
  },
  4: {
    staircase: { type: "corridor", doors: 2, text: "Corridor with two other doors." },
    corridor: { type: "room-medium", doors: 1, text: "Medium size room with another door." },
    room: { type: "corridor", doors: 1, text: "Corridor with a door at the end." },
  },
  5: {
    staircase: { type: "corridor", doors: 3, text: "Corridor with three other doors." },
    corridor: { type: "room-wide", doors: 2, text: "Wide room with two other doors." },
    room: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
  },
  6: {
    staircase: { type: "corridor", doors: 3, text: "Corridor with three other doors." },
    corridor: { type: "room-wide", doors: 2, text: "Wide room with two other doors." },
    room: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
  },
};

const NECROPOLIS_SEGMENTS: Record<number, SegmentsRow> = {
  1: {
    staircase: { type: "corridor", doors: 1, text: "Corridor with another door." },
    corridor: { type: "room-small", doors: 1, text: "Small room with another door." },
    room: { type: "room-small", doors: 0, text: "Small room." },
  },
  2: {
    staircase: { type: "corridor", doors: 2, text: "Corridor with two other doors." },
    corridor: { type: "room-medium", doors: 1, text: "Medium size room with another door." },
    room: { type: "room-medium", doors: 0, text: "Medium size room." },
  },
  3: {
    staircase: { type: "corridor", doors: 2, text: "Corridor with two other doors." },
    corridor: { type: "room-wide", doors: 2, text: "Wide room with two other doors." },
    room: { type: "room-big", doors: 0, text: "Big room." },
  },
  4: {
    staircase: { type: "corridor", doors: 3, text: "Corridor with three other doors." },
    corridor: { type: "room-wide", doors: 2, text: "Wide room with two other doors." },
    room: {
      type: "room-large",
      doors: 0,
      text: "Large hall with pillars.",
      flavor: "Pillars line the walls.",
    },
  },
  5: {
    staircase: { type: "corridor", doors: 3, text: "Corridor with three other doors." },
    corridor: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
    room: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
  },
  6: {
    staircase: { type: "corridor", doors: 3, text: "Corridor with three other doors." },
    corridor: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
    room: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
  },
};

/** Sewers (issue #30, rules 1815-1825). `staircase`/`corridor` are filled with the "Open from a
 * Tunnel" results purely so the row stays a complete `SegmentsRow` -- Sewers generates neither, so
 * neither column is ever consulted. */
const SEWERS_SEGMENTS: Record<number, SegmentsRow> = {
  1: {
    tunnelForward: {
      type: "tunnel",
      doors: 1,
      text: "Tunnel that ends in a Floodgate.",
      floodgate: true,
    },
    tunnelSide: { type: "room-small", doors: 0, text: "A small room." },
    staircase: { type: "room-small", doors: 0, text: "A small room." },
    corridor: { type: "room-small", doors: 0, text: "A small room." },
    room: { type: "room-small", doors: 0, text: "A small room." },
  },
  2: {
    tunnelForward: {
      type: "tunnel",
      doors: 2,
      text: "Tunnel follows. Has a Floodgate.",
      floodgate: true,
    },
    tunnelSide: { type: "room-small", doors: 0, text: "A small room." },
    staircase: { type: "room-small", doors: 0, text: "A small room." },
    corridor: { type: "room-small", doors: 0, text: "A small room." },
    room: { type: "room-small", doors: 0, text: "A small room." },
  },
  3: {
    tunnelForward: {
      type: "tunnel",
      doors: 2,
      text: "Tunnel follows. Has a Floodgate.",
      floodgate: true,
    },
    tunnelSide: { type: "room-medium", doors: 0, text: "An average room." },
    staircase: { type: "room-medium", doors: 0, text: "An average room." },
    corridor: { type: "room-medium", doors: 0, text: "An average room." },
    room: { type: "room-medium", doors: 0, text: "An average room." },
  },
  4: {
    tunnelForward: { type: "tunnel", doors: 1, text: "Tunnel follows." },
    tunnelSide: {
      type: "room-medium",
      doors: 1,
      text: "A room with a Floodgate.",
      floodgate: true,
    },
    staircase: { type: "room-medium", doors: 1, text: "A room with a Floodgate.", floodgate: true },
    corridor: { type: "room-medium", doors: 1, text: "A room with a Floodgate.", floodgate: true },
    room: { type: "room-medium", doors: 0, text: "An average room." },
  },
  5: {
    tunnelForward: { type: "tunnel", doors: 1, text: "Tunnel follows making a curve." },
    tunnelSide: {
      type: "room-medium",
      doors: 1,
      text: "A room with a Floodgate.",
      floodgate: true,
    },
    staircase: { type: "room-medium", doors: 1, text: "A room with a Floodgate.", floodgate: true },
    corridor: { type: "room-medium", doors: 1, text: "A room with a Floodgate.", floodgate: true },
    room: { type: "tunnel", doors: 1, text: "A tunnel that goes on." },
  },
  6: {
    tunnelForward: { type: "tunnel", doors: 1, text: "Tunnel follows. Has a ladder." },
    tunnelSide: {
      type: "room-medium",
      doors: 1,
      text: "A room with a Floodgate.",
      floodgate: true,
    },
    staircase: { type: "room-medium", doors: 1, text: "A room with a Floodgate.", floodgate: true },
    corridor: { type: "room-medium", doors: 1, text: "A room with a Floodgate.", floodgate: true },
    room: { type: "tunnel", doors: 1, text: "A tunnel that goes on." },
  },
};

/** Sewers' own Secret Passage table (rules 1827-1836) -- differs from the shared one at rolls 5/6. */
const SEWERS_SECRET_PASSAGE: Record<number, string> = {
  1: "You have activated a Trap!",
  2: "There's nothing here.",
  3: "There's nothing here.",
  4: "There's nothing here.",
  5: "Found a hidden Treasure!",
  6: "There is a hidden door here.",
};

/** Laboratory (issue #30, rules 2235-2245). Its Corridor column matches the shared table, but its
 * Room column is entirely its own -- large halls, then corridors, then staircases, where every other
 * type's Room column produces rooms. */
const LABORATORY_SEGMENTS: Record<number, SegmentsRow> = {
  1: {
    staircase: { type: "corridor", doors: 1, text: "Corridor with another door." },
    corridor: { type: "room-small", doors: 1, text: "Small room with another door." },
    room: {
      type: "room-large",
      doors: 0,
      text: "Large hall with pillars.",
      flavor: "Pillars line the walls.",
    },
  },
  2: {
    staircase: { type: "corridor", doors: 1, text: "Corridor with another door." },
    corridor: { type: "room-medium", doors: 1, text: "Medium size room with another door." },
    room: {
      type: "room-large",
      doors: 0,
      text: "Large hall with pillars.",
      flavor: "Pillars line the walls.",
    },
  },
  3: {
    staircase: { type: "corridor", doors: 2, text: "Corridor with two other doors." },
    corridor: { type: "room-medium", doors: 1, text: "Medium size room with another door." },
    room: { type: "corridor", doors: 1, text: "Corridor with another door." },
  },
  4: {
    staircase: { type: "corridor", doors: 2, text: "Corridor with two other doors." },
    corridor: { type: "room-wide", doors: 2, text: "Wide room with two other doors." },
    room: { type: "corridor", doors: 1, text: "Corridor with another door." },
  },
  5: {
    staircase: { type: "corridor", doors: 3, text: "Corridor with three other doors." },
    corridor: { type: "room-wide", doors: 2, text: "Wide room with two other doors." },
    room: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
  },
  6: {
    staircase: { type: "corridor", doors: 3, text: "Corridor with three other doors." },
    corridor: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
    room: { type: "staircase", doors: 1, text: "Staircase with a door in the end." },
  },
};

/** Laboratory's own Secret Passage table (rules 2247-2256) -- chests on 4-5 where the shared table
 * has other outcomes, and a staircase on 6. */
const LABORATORY_SECRET_PASSAGE: Record<number, string> = {
  1: "You have activated a Trap!",
  2: "There's nothing here.",
  3: "There's nothing here.",
  4: "Found a hidden Chest!",
  5: "Found a hidden Chest!",
  6: "Passage to a Staircase.",
};

/** Whether a Secret Passage result is the "hidden Chest" row, for the two places that offer the
 * chest (`dungeonReducer.ts`'s `ROLL_CHEST` guard and `RoomInspector`'s button).
 *
 * A substring check rather than string equality because the per-type tables use the rulebook's own
 * wording, and it isn't uniform -- the shared table says "You have found a hidden Chest!" while the
 * Laboratory's says "Found a hidden Chest!" (issue #30). Exact equality silently made the
 * Laboratory's chests unopenable; the same "no formal taxonomy, substring matching instead"
 * convention the monster tags use applies just as well here. */
export function isHiddenChestResult(result: string | null | undefined): boolean {
  return !!result && result.toLowerCase().includes("hidden chest");
}

export const SEGMENTS_TABLE_BY_TYPE: Partial<Record<DungeonTypeKey, Record<number, SegmentsRow>>> =
  {
    citadel: CITADEL_PYRAMID_SEGMENTS,
    pyramid: CITADEL_PYRAMID_SEGMENTS,
    ziggurat: ZIGGURAT_SEGMENTS,
    necropolis: NECROPOLIS_SEGMENTS,
    sewers: SEWERS_SEGMENTS,
    laboratory: LABORATORY_SEGMENTS,
  };

/** Deadly Dungeons (issue #30): Citadel's own Secret Passage table is explicitly printed in the
 * rulebook as "identical shape to Palace's" and Ziggurat's own printed table is byte-for-byte the
 * same as `SECRET_PASSAGE_TABLE` too -- both reuse it directly (no entry needed here). Pyramid and
 * Necropolis each print a genuinely different distribution (extra Trap/Chest/Staircase rows in
 * place of "There's nothing here"), so only those two need their own table. */
const PYRAMID_SECRET_PASSAGE: Record<number, string> = {
  1: "You have activated a Trap!",
  2: "You have activated a Trap!",
  3: "You have found a hidden Chest!",
  4: "You have found a hidden Chest!",
  5: "You have found a hidden Chest!",
  6: "A secret door to a Staircase.",
};

const NECROPOLIS_SECRET_PASSAGE: Record<number, string> = {
  1: "You have activated a Trap!",
  2: "You have activated a Trap!",
  3: "You have found a hidden Chest!",
  4: "You have found a hidden Chest!",
  5: "A secret door to a Staircase.",
  6: "A secret door to a Staircase.",
};

export const SECRET_PASSAGE_TABLE_BY_TYPE: Partial<Record<DungeonTypeKey, Record<number, string>>> =
  {
    pyramid: PYRAMID_SECRET_PASSAGE,
    necropolis: NECROPOLIS_SECRET_PASSAGE,
    sewers: SEWERS_SECRET_PASSAGE,
    laboratory: LABORATORY_SECRET_PASSAGE,
  };

/** Table: Dungeon Name, "first part" column (1d6) -- also selects the dungeon type. Keys 1-6 are
 * the real rulebook's own "Dungeon Name" table (Core Book, genuinely capped at 6 rows); keys 7+
 * are Deadly Dungeons types (issue #30), reachable only via `DUNGEON_TYPE_BY_TERRAIN`'s wider
 * per-terrain roll (`hexTables.ts`) -- every dungeon entry in this app is terrain-fated now (see
 * CLAUDE.md's "Terrain-based Dungeon Type" note), so a bare key beyond 6 is never reached by the
 * "Roll for Dungeon" ritual's own free first die, only by `forcedTypeRoll`. */
export const DUNGEON_TYPES: Record<number, DungeonTypeDef> = {
  1: {
    key: "palace",
    roll: 1,
    name: "The Palace",
    entranceType: "room-large",
    doors: 4,
    entrance:
      "You open the beautiful entrance door and find a giant hall -- two doors on each side, and a staircase at its center.",
  },
  2: {
    key: "crypt",
    roll: 2,
    name: "The Crypt",
    entranceType: "staircase",
    doors: 1,
    entrance:
      "Hidden inside a small, isolated mausoleum, a staircase leads down into the dark. At the end of it, a door.",
  },
  3: {
    key: "tomb",
    roll: 3,
    name: "The Tomb",
    entranceType: "corridor",
    doors: 3,
    entrance:
      "Behind the great stone door, a long corridor runs on: a door at the end, two more on the sides.",
  },
  4: {
    key: "sanctuary",
    roll: 4,
    name: "The Sanctuary",
    entranceType: "staircase",
    doors: 1,
    entrance:
      "Through the ruined trapdoor beneath the altar, a dark staircase descends. At the end of it, a door.",
  },
  5: {
    key: "temple",
    roll: 5,
    name: "The Temple",
    entranceType: "corridor",
    doors: 4,
    entrance:
      "Behind the incredible stone entrance, an empty corridor holds four more doors, two on each side.",
  },
  6: {
    key: "prison",
    roll: 6,
    name: "The Prison",
    entranceType: "staircase",
    doors: 1,
    entrance:
      "Beneath a pile of rubble, a reinforced trapdoor opens onto a staircase down. At the end of it, a door.",
  },
  7: {
    key: "citadel",
    roll: 7,
    name: "The Citadel",
    entranceType: "room-large",
    doors: 6,
    entrance:
      "Two statues of dwarfs brandishing their axes stand outside the heavy stone door. Inside, a huge, long room holds a dry fountain, 3 doors on each side.",
  },
  8: {
    key: "pyramid",
    roll: 8,
    name: "The Pyramid",
    entranceType: "staircase",
    doors: 1,
    entrance:
      "A large carved rock covers the entrance. Inside, a long staircase descends into darkness, a metal door waiting at the bottom.",
  },
  9: {
    key: "ziggurat",
    roll: 9,
    name: "The Ziggurat",
    entranceType: "room-large",
    doors: 4,
    entrance:
      "A dark well leads into darkness, a rope on its side. You descend for more than twenty meters until you reach a large square room, one door on each wall.",
  },
  10: {
    key: "necropolis",
    roll: 10,
    name: "The Necropolis",
    entranceType: "staircase",
    doors: 1,
    entrance:
      "Beyond the heavy metal double doors, the smell of death grows stronger. A long, dark staircase leads straight down to a metal door.",
  },
  12: {
    key: "laboratory",
    roll: 12,
    name: "The Laboratory",
    entranceType: "staircase",
    doors: 1,
    entrance:
      "An abandoned tower in ruins. Inside, a large trapdoor already stands open over a stairway slick with slime and creeping plants. At the bottom, a rusty metal door.",
  },
  11: {
    key: "sewers",
    roll: 11,
    name: "The Sewers",
    entranceType: "tunnel",
    doors: 4,
    entrance:
      "Down a dirty metal ladder through a manhole, you arrive at an intersection of four water-logged tunnels. Everything here is stinking, dark, shallow water.",
  },
};

/** Table: Dungeon Name, "second part" and "third part" columns (1d6 each) -- flavor only. */
export const DUNGEON_NAME_SECOND: Record<number, string> = {
  1: "of the Secret",
  2: "of the Broken",
  3: "of the Eternal",
  4: "of the Cold",
  5: "of the Flaming",
  6: "of the Dying",
};

export const DUNGEON_NAME_THIRD: Record<number, string> = {
  1: "Horrors",
  2: "Curse",
  3: "Rest",
  4: "Hero",
  5: "Vow",
  6: "Darkness",
};

/** "Table: Dungeon Name -- extra parts" (Expanded World, `docs/game-rules-reference.md` lines
 * 1002-1024, issue #101). Replaces the Core Book's two 1d6 columns above with three **3d6** columns
 * -- note the 3-18 index range, which is why each column needs its own 3d6 roll rather than a single
 * die. 16 x 16 x 16 = 4,096 names against the old table's 36.
 *
 * The rulebook's format is `[Part 2] + [Dungeon Type] + [Part 3] + [Part 4]`, with the type sitting
 * *inside* the name rather than leading it -- so "The Cursed" + "Palace" + "of the Frost" + "Queen".
 * `DUNGEON_TYPES[n].name` already carries its own leading "The " ("The Palace"), which is stripped
 * when composing (see `composeDungeonName()`), or every name would read "The Cursed The Palace...".
 *
 * The Core Book's `DUNGEON_NAME_SECOND`/`DUNGEON_NAME_THIRD` above are kept, not deleted: names are
 * persisted on `PendingDungeon` as plain strings, so existing saves keep whatever they were given,
 * and those tables remain the honest record of what produced them. */
export const DUNGEON_NAME_PART2: Record<number, string> = {
  3: "The Sacred",
  4: "The Pale",
  5: "The Deceitful",
  6: "The Bloody",
  7: "The Sinister",
  8: "The Misty",
  9: "The Secret",
  10: "The Lost",
  11: "The Cursed",
  12: "The Abandoned",
  13: "The Evil",
  14: "The Grimy",
  15: "The Ruined",
  16: "The Twisted",
  17: "The Stinky",
  18: "The Demonic",
};

export const DUNGEON_NAME_PART3: Record<number, string> = {
  3: "of the Heavenly",
  4: "of the Sacred",
  5: "of the Lucky",
  6: "of the Bloody",
  7: "of the Gloomy",
  8: "of the Dark",
  9: "of the Ethernal",
  10: "of the Dead",
  11: "of the Frost",
  12: "of the Flaming",
  13: "of the Night",
  14: "of the Radiant",
  15: "of the Raging",
  16: "of the Unlucky",
  17: "of the Feathered",
  18: "of the Demonic",
};

export const DUNGEON_NAME_PART4: Record<number, string> = {
  3: "Angels",
  4: "Statues",
  5: "Serpent",
  6: "Road",
  7: "Sadness",
  8: "Vale",
  9: "Silence",
  10: "King",
  11: "Queen",
  12: "Horror",
  13: "Death",
  14: "Path",
  15: "Sorceress",
  16: "Soldier",
  17: "Hound",
  18: "Hell",
};

/** Joins the four parts. `typeName` arrives as e.g. "The Palace"; its leading article is dropped so
 * Part 2's own "The ..." leads the name instead, per the rulebook's format. */
export function composeDungeonName(
  typeName: string,
  part2Roll: number,
  part3Roll: number,
  part4Roll: number,
): string {
  const bareType = typeName.replace(/^The\s+/i, "");
  const parts = [
    DUNGEON_NAME_PART2[part2Roll],
    bareType,
    DUNGEON_NAME_PART3[part3Roll],
    DUNGEON_NAME_PART4[part4Roll],
  ];
  return parts.filter(Boolean).join(" ");
}

export const TYPE_LABELS: Record<SegmentType, string> = {
  corridor: "Corridor",
  staircase: "Staircase",
  "room-small": "Small Room",
  "room-medium": "Medium Room",
  "room-wide": "Wide Room",
  "room-large": "Large Room",
  "room-big": "Big Room",
  tunnel: "Tunnel",
  final: "Final Room",
};
