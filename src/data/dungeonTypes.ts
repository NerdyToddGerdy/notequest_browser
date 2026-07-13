export type DungeonTypeKey = "palace" | "crypt" | "tomb" | "sanctuary" | "temple" | "prison";

export type SegmentType =
  | "corridor"
  | "staircase"
  | "room-small"
  | "room-medium"
  | "room-wide"
  | "room-large"
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
  type: SegmentType;
  doors: number;
  text: string;
  flavor?: string;
}

export interface SegmentsRow {
  staircase: SegmentsColumnResult;
  corridor: SegmentsColumnResult;
  room: SegmentsColumnResult;
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

/** Table: Dungeon Name, "first part" column (1d6) -- also selects the dungeon type. */
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

export const TYPE_LABELS: Record<SegmentType, string> = {
  corridor: "Corridor",
  staircase: "Staircase",
  "room-small": "Small Room",
  "room-medium": "Medium Room",
  "room-wide": "Wide Room",
  "room-large": "Large Room",
  final: "Final Room",
};
