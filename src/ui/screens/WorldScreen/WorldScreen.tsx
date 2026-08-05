import { useMemo, useRef, useState } from "react";
import type { CreatedCharacter } from "../../../data/types.ts";
import {
  CITY_OR_FORTRESS,
  hasWaterWalk,
  isFortressLocation,
  isImpassable,
  isOverworldTerrain,
  locationHasDungeon,
  TERRAIN_LABEL,
  travelCost,
  travelCostMultiplier,
  type LocationKind,
  type Terrain,
} from "../../../data/hexTables.ts";
import { hasAffinity, CULTURE_BY_LOCATION, type CityCulture } from "../../../data/affinity.ts";
import {
  countMatchingNeighbors,
  findHexForRunId,
  hexDistance,
  hexKey,
  hexNeighbors,
  isBannedHex,
  politicalStatusFor,
  qualifiesForBuyingMount,
  qualifiesForTraining,
  withBannedHex,
  hasSewersBelow,
  withPlayerMovedTo,
  withPortalHere,
  withPortalTotal,
  type HexCoord,
  type HexTile,
  type WorldState,
} from "../../../engine/hexState.ts";
import type { CombatState } from "../../../engine/dungeonState.ts";
import type { SpellTableKey } from "../../../data/types.ts";
import { hexReducer } from "../../../engine/hexReducer.ts";
import {
  hasUnlootedRemains,
  isDungeonBeaten,
  type PendingDungeon,
} from "../../../engine/dungeonState.ts";
import type { TownDeathCause } from "../../../engine/graveyard.ts";
import { ANIMAL_BY_NAME, MOUNT_TABLE } from "../../../data/animals.ts";
import {
  animalTravelCostOverride,
  animalTravelCostPenalty,
  buyMount,
  trainAnimal,
} from "../../../engine/animals.ts";
import type { BuildingKind } from "../../../data/types.ts";
import {
  buildBuilding,
  canBuildBuilding,
  canWithdraw,
  depositItem,
  storedAt,
  withdrawItem,
} from "../../../engine/buildings.ts";
import { BUILDING_TABLE } from "../../../data/buildings.ts";
import {
  canAttemptPoliticalAffinity,
  resolvePoliticalAffinity,
  type PoliticalAffinityOutcome,
} from "../../../engine/politics.ts";
import {
  canAttack,
  canRecruitTroop,
  recruitTroop,
  resolveAttack,
  resolveStorming,
} from "../../../engine/warfare.ts";
import {
  canCastFly,
  canHireBoat,
  canUseForgottenGods,
  castFly,
  castSpell,
  hasElvenBoots,
  hasFeatheredBoots,
  hireBoat,
  payTravelCost,
  recordTravelStats,
  resolveThugLife,
  resolveForgottenGods,
  type AdventurerResources,
} from "../../../engine/town.ts";
import {
  applyEventEffect,
  eventAnimalAttack,
  eventCastSpell,
  eventUseConsumable,
  eventFightRound,
  eventHirelingAttack,
  eventResolveDamage,
  fleeEvent,
  type FighterIdentity,
  type WildFight,
  camouflageSpellName,
  canIgnoreEvent,
  canRerollEvent,
  ignoreEvent,
  rerollEvent,
  rollTravelEvent,
  startEventCombat,
  type TravelEventRoll,
} from "../../../engine/events.ts";
import { effectForLocation, resolveLocationEffect } from "../../../engine/locationEffects.ts";
import { LOCATION_EFFECT_NOTES } from "../../../data/locationEffects.ts";
import {
  applyRealmVictoryReward,
  currentRealm,
  currentRealmDef,
  isInOtherWorld,
  realmLabel,
  realmTerrainHazard,
  rollRealmEvent,
  switchRealm,
  type RealmHazard,
} from "../../../engine/realms.ts";
import { REALMS, type RealmEventRow } from "../../../data/otherWorlds.ts";
import {
  establishedPortal,
  resolvePortalOutcome,
  rollPortal,
  type PortalRoll,
} from "../../../engine/portals.ts";
import { CharacterSheet } from "../../components/CharacterSheet/CharacterSheet.tsx";
import { DicePool } from "../../components/DicePool/DicePool.tsx";
import { ConfirmDialog } from "../../components/ConfirmDialog/ConfirmDialog.tsx";
import { EventPanel } from "../../components/EventPanel/EventPanel.tsx";
import { HexInspector } from "../../components/HexInspector/HexInspector.tsx";
import { PortalPanel } from "../../components/PortalPanel/PortalPanel.tsx";
import { useZoomGesture } from "../../hooks/useZoomGesture.ts";
import { TownScreen } from "../TownScreen/TownScreen.tsx";
import { Footer } from "../../components/Footer/Footer.tsx";
import styles from "./WorldScreen.module.css";

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How many chained portals (roll 15's golden room, whose only exit is a second portal) are resolved
 * before the chain simply stops and reports where it left the player. A guard, not a rule -- the
 * chance of stacking even three is under 1%. */
const MAX_PORTAL_CHAIN = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface WorldScreenProps {
  character: CreatedCharacter;
  resources: AdventurerResources;
  world: WorldState;
  /** Every touched run, including the current character's own active one -- used for a lookup (is
   * the current hex's dungeon beaten?), not rendered as a list, so it deliberately isn't filtered
   * down. */
  dungeonHistory: PendingDungeon[];
  onUpdateResources: (resources: AdventurerResources) => void;
  onUpdateWorld: (world: WorldState) => void;
  /** Issue #133: `fromTown` records whether the descent started inside the Town Square, so the
   * return trip can land back there. Passed by the call site rather than derived, because this same
   * handler is reachable from both the town gate and `HexInspector` on a Ruins hex. */
  onEnterDungeon: (fromTown: boolean) => void;
  /** Portals (issue #21), the 3d6 roll of 7: "You appeared at the beginning of a new Dungeon but no
   * door to exit. In the Boss's room there will be a Portal." A separate entry point from
   * `onEnterDungeon` because it isn't tied to the hex the player is standing on at all -- the portal
   * drops them into a fresh run that App.tsx has to mint outside the normal per-hex flow. */
  onEnterNoExitDungeon: () => void;
  /** Issue #99: descend into the Sewers beneath a Fortress -- a second run on the same hex, so it
   * needs its own entry point rather than reusing `onEnterDungeon`, which stamps `dungeonRunId`. */
  onEnterSewers: () => void;
  /** Portals (issue #21): true when the player just stepped through a no-exit dungeon's Boss-room
   * Portal, so a fresh portal roll fires the moment this screen mounts rather than dumping them back
   * on the map with nothing happening. `onAutoPortalConsumed` clears it so it fires exactly once. */
  /** Laboratory's Special Rule (issue #30): what mutating on the way out did, shown once as a quiet
   * `HexInspector` line -- the same treatment a suppressed Event note gets, rather than a blocking
   * panel, since there's nothing to decide. */
  arrivalNote?: string | null;
  /** Issue #133: seeds `showTown` on mount, so a dungeon entered from the Town Square returns
   * there instead of dumping the player on the map outside a city they never left. Only ever true
   * coming back from a town-entered run; travel and every other arrival leave it false. */
  initialShowTown?: boolean;
  onArrivalNoteSeen?: () => void;
  autoPortalOnMount?: boolean;
  onAutoPortalConsumed?: () => void;
  /** A death outside a dungeon (Getting Money's Gamble/Thug Life/Arena, issue #58) -- App.tsx's own
   * Graveyard-recording + session-clearing handler, mirroring DungeonScreen's death effect. This
   * screen supplies `place` (the current hex's location label) so App.tsx doesn't need its own copy
   * of `LOCATION_LABEL`. */
  onCharacterDied: (cause: TownDeathCause, place: string) => void;
  onHardReset: () => void;
}

const HEX_SIZE = 44;

function axialToPixel(c: HexCoord): { x: number; y: number } {
  return {
    x: HEX_SIZE * (Math.sqrt(3) * c.q + (Math.sqrt(3) / 2) * c.r),
    y: HEX_SIZE * (1.5 * c.r),
  };
}

function hexPolygonPoints(center: { x: number; y: number }, size: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30); // pointy-top
    points.push(`${center.x + size * Math.cos(angle)},${center.y + size * Math.sin(angle)}`);
  }
  return points.join(" ");
}

const TERRAIN_FILL: Record<Terrain, string> = {
  plain: "#cbb686",
  mountain: "#6b5c46",
  forest: "#2f4a2e",
  swamp: "#4a5a3a",
  desert: "#d9b56a",
  water: "#2a4a5e",
  glacier: "#bfe3ec",
  tundra: "#8fa3ab",
  // Other Worlds (issue #105) -- each realm's palette reads as its own place at a glance: Hell hot
  // and dark, Pesadelum bruised, Candy World sugary.
  magma: "#8c2f14",
  seaOfBlood: "#5c1a1e",
  forestOfImpaled: "#3b2b39",
  plainOfThorns: "#5a4550",
  milkShakeSea: "#e6c9d8",
  lollipopForest: "#b5628f",
  marshmallowMountain: "#e8dcd2",
  caramelPlain: "#c98f4e",
};

/** City/Fortress/Ruins/Rocks and (since issue #21) Portal are interactive -- everything else
 * (Oasis/Volcano/Reef/Thin Ice/"nothing") renders as an inert flavor label, see CLAUDE.md's
 * Hexploring the World note. */
const LOCATION_LABEL: Record<LocationKind, string> = {
  orcCity: "Orc City",
  orcFortress: "Orc Fortress",
  goblinCity: "Goblin City",
  humanCity: "Human City",
  humanFortress: "Human Fortress",
  dwarvenCity: "Dwarven City",
  dwarvenFortress: "Dwarven Fortress",
  elvenCity: "Elven City",
  elvenFortress: "Elven Fortress",
  gnomeCity: "Gnome City",
  ruins: "Ruins",
  rocks: "Rocks",
  volcano: "Volcano",
  oasis: "Oasis",
  portal: "Portal",
  reef: "Reef",
  thinIce: "Thin Ice",
  nothing: "",
  // Other Worlds (issue #105).
  demonCity: "Demon City",
  cityOfSurvivors: "City of Survivors",
  denseFog: "Dense Fog",
  abandonedHouse: "Abandoned House",
  goblinFortress: "Goblin Fortress",
  chocolateCity: "Chocolate City",
  mandolateFortress: "Fortress of King Mandolate",
  peanuts: "",
};

export function WorldScreen({
  character,
  resources,
  world,
  dungeonHistory,
  onUpdateResources,
  onUpdateWorld,
  onEnterDungeon,
  onEnterNoExitDungeon,
  onEnterSewers,
  arrivalNote,
  initialShowTown = false,
  onArrivalNoteSeen,
  autoPortalOnMount = false,
  onAutoPortalConsumed,
  onCharacterDied,
  onHardReset,
}: WorldScreenProps) {
  /** True while actually inside a City/Fortress's Town Square (entered via HexInspector's "Enter
   * City"). False by default and reset to false on every arrival, so standing on a city hex shows
   * the *map* -- entering is a deliberate act, never a side effect of being there (issue #122).
   * This is the inverse of the old `showMap` flag, whose default made travelling onto a city,
   * creating a character, or returning from a dungeon all dump the player straight into town with
   * no chance to look at the map first. The flag reads better this way round too: "am I *in* the
   * city," not "am I *voluntarily* looking at the map." */
  const [showTown, setShowTown] = useState(initialShowTown);
  /** Which known hex HexInspector describes -- null falls back to wherever the player is standing.
   * Clicking a passable, in-range neighbor travels there directly (unchanged from before
   * HexInspector existed); clicking any other known hex -- out of range, impassable, or the
   * player's own tile -- just selects it for inspection instead, mirroring RoomInspector/
   * state.selectedSegId's own selected-vs-current split. */
  const [selectedHex, setSelectedHex] = useState<HexCoord | null>(null);
  /** Animals (issue #26): the outcome text of the last "Train an Animal" attempt, shown in
   * HexInspector the same way TownScreen's Thug Life outcome text works -- reset on arrival, same
   * as `selectedHex`. */
  const [trainResultMessage, setTrainResultMessage] = useState<string | null>(null);
  /** Ziggurat's Effect of the Forgotten Gods (issue #30) -- same always-visible-until-replaced
   * precedent as trainResultMessage, reset on arrival alongside it. */
  const [forgottenGodsMessage, setForgottenGodsMessage] = useState<string | null>(null);
  /** Warfare (issue #28): lifted up here (not left as TownScreen-local state, unlike
   * thugLifeMessage/politicalAffinityMessage) because a winning Loot razes the target hex to
   * Ruins, which flips `inCityOrFortress` false and unmounts `TownScreen` on the very next
   * render -- state living there would vanish before ever being shown. Reset on arrival, same as
   * `trainResultMessage`. `pendingStorm` swaps TownScreen's whole City Actions section for the
   * Annex/Loot choice while a won Attack awaits it. */
  const [attackMessage, setAttackMessage] = useState<string | null>(null);
  const [pendingStorm, setPendingStorm] = useState(false);
  /** Events on Travel (issue #91) -- non-null from the moment an arrival roll turns up an Event until
   * the player dismisses its outcome, and rendered as a modal-ish overlay over the map rather than a
   * HexInspector row, since it genuinely blocks: the effect isn't applied and the fight isn't joined
   * until the player chooses (Camouflage/Star Stone both need that window). `combat` is null during
   * the choice stage and set once the player commits to fighting; `resolvedMessage` switches the
   * panel to its final outcome line. Deliberately *not* persisted -- reloading mid-Event drops it,
   * the same call `DungeonState.pendingPackItem`'s resume path makes. */
  const [travelEvent, setTravelEvent] = useState<{
    roll: Extract<TravelEventRoll, { kind: "event" }>;
    combat: CombatState | null;
    /** Newest-first combat transcript, so a wilderness fight is as readable as a dungeon one (#120). */
    log?: string[];
    resolvedMessage: string | null;
  } | null>(null);
  /** The skip reason ("You slip through unnoticed...") or nothing -- shown as a quiet HexInspector
   * line rather than a blocking panel, since a suppressed Event needs no decision. Deliberately not
   * used for the ordinary "nothing happened" 7+ result, which is the common case on most moves and
   * would be pure noise. */
  const [eventNote, setEventNote] = useState<string | null>(null);
  /** Other Worlds (issue #105): a terrain hazard fired on arrival (Magma's 6d6, the Sea of Blood's
   * shove, the Plain of Thorns, the Forest of the Impaled's catatonia). Resolved before the realm's
   * own Event roll, since Magma can kill you first. */
  const [realmHazard, setRealmHazard] = useState<RealmHazard | null>(null);
  /** A realm's own 2d6 Event, in the same three stages `travelEvent` uses. Kept separate rather than
   * widened into `travelEvent` because the two draw from different tables and different effect
   * unions -- merging them would mean a discriminant on every field. */
  /** Location entry effects (issue #98): the outcome of arriving on an Oasis / Thin Ice / Reef hex.
   * Mutually exclusive with `travelEvent` by construction -- an Event only rolls on a hex with no
   * location at all, and every one of these has one. */
  const [locationEffect, setLocationEffect] = useState<{ roll: number; message: string } | null>(
    null,
  );
  const [realmEvent, setRealmEvent] = useState<{
    row: RealmEventRow;
    dice: [number, number];
    combat: CombatState | null;
    log?: string[];
    resolvedMessage: string | null;
  } | null>(null);
  /** Portals (issue #21). `pendingPortalConfirm` gates the irreversible step ("there is no turning
   * back"); `portal` then holds the resolved trip until dismissed. `awaitDestination` is only ever
   * true for rolls 11/14, which need a chosen hex before anything moves. Not persisted, same call as
   * `travelEvent`. */
  const [pendingPortalConfirm, setPendingPortalConfirm] = useState(false);
  const [portal, setPortal] = useState<{
    roll: PortalRoll;
    /** False until the player acknowledges the roll -- see `handleStepThroughPortal` for why the
     * reveal and the application are two steps rather than one. */
    applied: boolean;
    resolvedMessage: string | null;
    awaitDestination: boolean;
  } | null>(() =>
    // Stepping out of a no-exit dungeon's Boss-room Portal (roll of 7) lands here with another portal
    // already waiting. Seeded lazily at mount -- WorldScreen remounts whenever App switches back from
    // the dungeon -- rather than in an effect, which would mean a setState cascade on first render.
    autoPortalOnMount
      ? { roll: rollPortal(), applied: false, resolvedMessage: null, awaitDestination: false }
      : null,
  );
  /** Null = today's auto-fit-everything behavior; set the instant the player zooms or drag-pans,
   * same "override until Reset View" shape DungeonMap's own `scale` state uses. */
  const [viewBoxOverride, setViewBoxOverride] = useState<ViewBox | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragOrigin = useRef<{
    clientX: number;
    clientY: number;
    base: ViewBox;
    inverse: DOMMatrix;
  } | null>(null);
  /** Mirrors DungeonMap's own ref: true once a pointer-down has moved past the click-vs-drag
   * threshold, checked (and reset) by the capturing click handler below so a drag-to-pan doesn't
   * also select whatever hex the pointer happened to release over. */
  const didDrag = useRef(false);
  const currentTile: HexTile | undefined = world.tiles[hexKey(world.player)];
  const neighborCoords = hexNeighbors(world.player);
  const inCityOrFortress =
    !!currentTile && currentTile.location != null && CITY_OR_FORTRESS.has(currentTile.location);
  /** "none" hexes never had a dungeonRunId/dungeonMarked stamped; otherwise a shared lookup for
   * both the gate copy (current hex only) and the per-hex map badges (every known hex) below.
   * "found" is a hex "Ask" has flagged (dungeonMarked) but the player has never actually stepped
   * onto -- "draw the dungeon on the map" happens at Ask time, not first entry, so there's nothing
   * "unfinished" about it yet. "unfinished" itself covers dungeonRunId being set (Enter Dungeon has
   * actually been used here) even before a PendingDungeon exists in dungeonHistory (which only
   * catches up once the player first leaves). */
  /** Describes one run by id -- shared by a hex's own dungeon and (issue #99) the Sewers beneath a
   * Fortress, which is a genuinely separate run on the same hex. */
  function runInfoFor(runId: string | undefined): {
    status: "none" | "unfinished" | "beaten";
    hasRemains: boolean;
  } {
    if (!runId) return { status: "none", hasRemains: false };
    const pending = dungeonHistory.find((pd) => pd.id === runId);
    if (!pending) return { status: "unfinished", hasRemains: false };
    return {
      status: isDungeonBeaten(pending.dungeon) ? "beaten" : "unfinished",
      hasRemains: hasUnlootedRemains(pending.dungeon),
    };
  }

  function dungeonInfoFor(tile: HexTile | undefined): {
    status: "none" | "found" | "unfinished" | "beaten";
    hasRemains: boolean;
  } {
    if (tile?.dungeonRunId) return runInfoFor(tile.dungeonRunId);
    if (tile?.dungeonMarked) return { status: "found", hasRemains: false };
    return { status: "none", hasRemains: false };
  }

  /** Issue #99: the Sewers under this Fortress, if it rolled any. Deliberately separate from
   * `dungeonInfoFor` -- both can be present on the same hex, which is unique to Fortresses. */
  function sewersInfoFor(tile: HexTile | undefined) {
    if (!hasSewersBelow(tile)) return null;
    return runInfoFor(tile?.sewerRunId);
  }
  const currentDungeonStatus = dungeonInfoFor(currentTile).status;
  // Ziggurat's Effect of the Forgotten Gods (issue #30): only meaningful once this hex's own
  // dungeon has actually been entered at least once (dungeonHistory only gets an entry via
  // handleLeaveDungeon) -- "in the hexagon of this dungeon, but outside the dungeon" already
  // implies having been inside and left, so a hex merely `dungeonMarked` (Ask, never entered)
  // correctly never qualifies either.
  function dungeonTypeKeyFor(tile: HexTile | undefined) {
    if (!tile?.dungeonRunId) return null;
    return dungeonHistory.find((pd) => pd.id === tile.dungeonRunId)?.dungeon.dungeonTypeKey ?? null;
  }
  // Nothing left to do in an already-beaten dungeon -- RETURN_TO_DUNGEON/RESUME_DUNGEON would just
  // redisplay the existing victory panel, not let the Boss be re-fought or re-looted. A hex "Ask"
  // marked (dungeonMarked) offers the same button as a City/Fortress/Ruins hex does, even though it
  // has no location of its own -- see HexTile.dungeonMarked.
  /** Other Worlds (issue #105): the realm scope stops at survival, so the systems that key per-hex
   * data by a bare `hexKey` -- dungeons, Buildings, Politics, Warfare -- plus Ask and Animal
   * training are all overworld-only. One flag gates every one of them, and `App.tsx`'s dungeon
   * handler re-checks independently (reducer decides, UI mirrors). */
  const inRealm = isInOtherWorld(world);
  const realmName = realmLabel(currentRealm(world));
  const canEnterDungeon =
    !inRealm &&
    !!currentTile &&
    (locationHasDungeon(currentTile.location) || !!currentTile.dungeonMarked) &&
    currentDungeonStatus !== "beaten";
  const dungeonGateCopy =
    currentDungeonStatus === "beaten"
      ? "the dungeon here has already been cleared."
      : currentDungeonStatus === "unfinished"
        ? "your unfinished dungeon is still here."
        : "a dungeon awaits here.";
  /** Issue #99: the Fortress's own second dungeon. Offered until it's been cleared, exactly like the
   * hex's primary one -- and never in a realm, where dungeons don't operate at all (issue #105). */
  const currentSewers = sewersInfoFor(currentTile);
  const hasSewers = !inRealm && currentSewers != null && currentSewers.status !== "beaten";
  const sewersGateCopy =
    currentSewers?.status === "unfinished"
      ? "your unfinished business in the sewers is still down there."
      : "a manhole in the courtyard drops into the sewers below.";
  const culture: CityCulture | null =
    (currentTile?.location && CULTURE_BY_LOCATION[currentTile.location]) || null;
  const besideWater = neighborCoords.some((n) => world.tiles[hexKey(n)]?.terrain === "water");
  /** Animals (issue #26): both "train in the wild" and "buy a mount in a city" require the
   * *current* hex's own terrain to have at least 2 matching neighbors -- computed once and reused
   * by both qualification checks below. */
  const currentMatchingNeighbors = currentTile
    ? countMatchingNeighbors(world.tiles, world.player, currentTile.terrain)
    : 0;
  const trainableAnimals =
    currentTile && !isInOtherWorld(world)
      ? Object.values(ANIMAL_BY_NAME).filter((a) =>
          qualifiesForTraining(currentTile, currentMatchingNeighbors, a),
        )
      : [];
  const buyableMounts =
    currentTile && !isInOtherWorld(world)
      ? Object.values(MOUNT_TABLE).filter((m) =>
          qualifiesForBuyingMount(currentTile, currentMatchingNeighbors, m),
        )
      : [];
  const isFortress = isFortressLocation(currentTile?.location ?? null);
  /** Portals' rolls 11/14 ("you go to whatever hexagon you want"): every revealed hex the player could
   * legally stand in, nearest first. Bounded to known geography for the same reason
   * `findNearestTown()` is -- you cannot choose a hex that doesn't exist yet. Impassable hexes are
   * excluded (a portal won't set you down inside Rocks or open water), but a Thug-Life-banned hex
   * deliberately *is* offered: that ban is about being turned away at a city gate, and arriving by
   * portal isn't that. */
  const portalDestinationList = useMemo(
    () =>
      Object.entries(world.tiles)
        .filter(
          ([key, tile]) =>
            key !== hexKey(world.player) && !isImpassable(tile.terrain, tile.location, false),
        )
        .map(([key, tile]) => {
          const coord = { q: Number(key.split(",")[0]), r: Number(key.split(",")[1]) };
          const locationLabel = tile.location ? LOCATION_LABEL[tile.location] : "";
          return {
            coord,
            tile,
            distance: hexDistance(world.player, coord),
            label: tile.name ?? (locationLabel || TERRAIN_LABEL[tile.terrain]),
          };
        })
        .sort((a, b) => a.distance - b.distance),
    [world.tiles, world.player],
  );
  // Prefers the hex's own generated name (issue #49, City/Fortress only -- see HexTile.name) over
  // the generic type label wherever one exists; falls back to the type label for a Ruins/other
  // location with no name of its own, or "the wilds" for a bare plain hex with no location at all.
  const currentPlaceLabel =
    currentTile?.name ??
    (currentTile?.location ? LOCATION_LABEL[currentTile.location] : "the wilds");
  /** "If you don't already have a dungeon in any adjacent hex" -- gates the Ask button itself
   * (always rendered by TownScreen, disabled once true, same "visible but disabled" precedent as
   * every other City Action here) rather than the reducer alone, so the UI can explain why. */
  const askedDungeonKnown = neighborCoords.some((n) => {
    const t = world.tiles[hexKey(n)];
    return !!t?.dungeonRunId || !!t?.dungeonMarked;
  });

  /** A hex is travelable if it's passable (respecting a hired boat on water, or Patovsky/Sharkin's
   * own water-walking -- see `hasWaterWalk()`), the character's race has Affinity for whatever
   * City/Fortress culture is there (non-city hexes are always `true` for the latter -- see
   * `hasAffinity()`), and it isn't a hex Thug Life has permanently banned this world from. */
  function canTravelTo(tile: HexTile, coord: HexCoord): boolean {
    return (
      !isImpassable(
        tile.terrain,
        tile.location,
        world.hasBoat || hasWaterWalk(character.race.name),
      ) &&
      hasAffinity(character.race.name, tile.location) &&
      !isBannedHex(world, coord)
    );
  }

  /** Everything that happens on arrival regardless of what the move cost -- extracted so the Fly
   * path and the ordinary path can't drift apart (they were duplicated line-for-line before Events
   * on Travel gave them a third thing to keep in sync). `rollEvent` is false only for a Fly move:
   * "Can move through any land without spending any Provision and activate Event" is read as the
   * `without` distributing across both clauses, i.e. Fly skips the Event too (issue #91 documents
   * why -- a limited-use spell burying a drawback in its own text is the less coherent reading, and
   * the rulebook is a translation where that elision is idiomatic). */
  function arriveAt(
    coord: HexCoord,
    tile: HexTile,
    updated: AdventurerResources,
    rollEvent: boolean,
  ) {
    onUpdateResources(updated);
    onUpdateWorld(hexReducer(world, { type: "MOVE", to: coord, raceName: character.race.name }));
    setShowTown(false); // arriving anywhere lands on the map, city or not (issue #122)
    setSelectedHex(null); // describe the new current tile by default, not wherever was last inspected
    setTrainResultMessage(null);
    setForgottenGodsMessage(null);
    setAttackMessage(null);
    setPendingStorm(false);
    setTravelEvent(null);
    setEventNote(null);
    setLocationEffect(null);
    // A mutation note describes the trip that just ended, so the next move clears it.
    onArrivalNoteSeen?.();

    if (!rollEvent) return;

    // Other Worlds (issue #105) roll on their *own* Event table, and do so on every hex rather than
    // only location-less ones -- a realm's Location table is rolled unconditionally, so "has a
    // location" carries none of the meaning it does on the overworld. Terrain hazards fire first:
    // Magma's 6d6 can kill you before anything else gets a turn.
    const realmDef = currentRealmDef(world);
    if (realmDef) {
      const hazard = realmTerrainHazard(tile.terrain);
      if (hazard) {
        setRealmHazard(hazard);
        return; // the hazard panel resolves, then rolls this realm's Event itself
      }
      rollRealmEventInto(realmDef);
      return;
    }

    // Location entry effects (issue #98) -- Oasis/Thin Ice/Reef roll the moment you arrive. Checked
    // before the Event roll below, which only ever applies to a hex with *no* location, so the two
    // can never both fire.
    const entry = effectForLocation(tile.location);
    if (entry) {
      const outcome = resolveLocationEffect(entry, updated);
      if (outcome.died) {
        onCharacterDied("thin-ice", tile.location ? LOCATION_LABEL[tile.location] : "the wilds");
        return;
      }
      onUpdateResources(outcome.resources);
      setLocationEffect({ roll: outcome.roll, message: outcome.message });
      return;
    }

    // "Whenever you enter a hex that doesn't have a location, roll 2d6."
    if (tile.location !== null || !isOverworldTerrain(tile.terrain)) return;
    const roll = rollTravelEvent(updated, character.race.name, tile.terrain);
    if (roll.kind === "skipped") setEventNote(roll.reason);
    else if (roll.kind === "event") setTravelEvent({ roll, combat: null, resolvedMessage: null });
    // "none" (7+) is the common case and deliberately silent -- see `eventNote`.
  }

  function handleTravel(coord: HexCoord) {
    const tile = world.tiles[hexKey(coord)];
    if (!tile || !canTravelTo(tile, coord)) return;
    // Fly (New Spells, Advanced 6, issue #61): "without spending any Provision" -- read literally,
    // a true free move that bypasses every other cost consideration below (Elven Boots/Animal
    // overrides, the Mammoth penalty, the Pandakhan/Centaur multiplier, and the Hireling surcharge)
    // rather than just becoming the cheapest of several competing overrides.
    if (resources.flyActive) {
      const afterCost = payTravelCost(resources, 0, false);
      const isCity = tile.location != null && CITY_OR_FORTRESS.has(tile.location);
      arriveAt(
        coord,
        tile,
        recordTravelStats(
          { ...afterCost, flyActive: false },
          tile.terrain,
          isCity,
          hexKey(coord),
          world.hasBoat,
        ),
        false,
      );
      return;
    }
    // Elven Boots: "you can only spend 1 provision to move through forests." Combined with any
    // owned Animal/Mount's own per-terrain cap (issue #26) -- Griffin's unconditional "1 for any
    // land" always wins (checked first inside animalTravelCostOverride), otherwise the cheapest
    // applicable override wins.
    const elvenBootsOverride = tile.terrain === "forest" && hasElvenBoots(resources) ? 1 : null;
    // Feathered Boots (Ziggurat Wonder, issue #30): "Spend 1 provision on swamps" -- identical
    // shape to Elven Boots, just swamp instead of forest.
    const featheredBootsOverride =
      tile.terrain === "swamp" && hasFeatheredBoots(resources) ? 1 : null;
    const animalOverride = animalTravelCostOverride(resources.animals, tile.terrain);
    const overrides = [elvenBootsOverride, featheredBootsOverride, animalOverride].filter(
      (v): v is number => v != null,
    );
    const baseCost = overrides.length > 0 ? Math.min(...overrides) : travelCost(tile.terrain);
    // Mammoth: "you spend 1 extra provision per hex" -- a penalty, not a discount, so it's added on
    // top of whatever override/base cost above rather than competing with them.
    const withMammothPenalty = baseCost + animalTravelCostPenalty(resources.animals);
    // Pandakhan (2x)/Centaur (0.5x, rounded up so a move is never free) -- layered on top of the
    // base cost the same way Elven Boots' forest override already is.
    const cost = Math.max(
      1,
      Math.ceil(withMammothPenalty * travelCostMultiplier(character.race.name)),
    );
    const afterCost = payTravelCost(resources, cost, !!resources.hireling);
    // Advanced Classes (issue #72): Lumberjack/Druid/Survivor/Pirate/Bard's lifetime travel
    // counters, describing whichever hex is actually being arrived at. `wasSailing` reads
    // `world.hasBoat` *before* MOVE potentially clears it (hexReducer.ts drops the boat the
    // instant the player lands on non-water terrain) -- true only while sailing onto more water.
    const isCity = tile.location != null && CITY_OR_FORTRESS.has(tile.location);
    arriveAt(
      coord,
      tile,
      recordTravelStats(afterCost, tile.terrain, isCity, hexKey(coord), world.hasBoat),
      true,
    );
  }

  /** Animals (issue #26): "go to the appropriate terrain... spend 4 provisions [8 for a mount] and
   * roll a die." Re-validates the hex qualifies (defense in depth, same "reducer/handler
   * re-checks, UI is only a convenience" precedent HIRE_BOAT/ASK_FOR_DUNGEON already establish)
   * before spending anything. */
  function handleTrainAnimal(name: string) {
    const animal = ANIMAL_BY_NAME[name];
    if (!animal || !currentTile) return;
    if (!qualifiesForTraining(currentTile, currentMatchingNeighbors, animal)) return;
    const result = trainAnimal(resources, animal);
    onUpdateResources(result.resources);
    setTrainResultMessage(result.trained ? `You trained a ${name}!` : `The ${name} slipped away.`);
  }

  /** Ziggurat's Effect of the Forgotten Gods (issue #30) -- re-validates the hex still qualifies
   * (defense in depth, same "reducer/handler re-checks, UI is only a convenience" precedent every
   * other hex action here already establishes) before spending anything. */
  function handleForgottenGods() {
    if (dungeonTypeKeyFor(currentTile) !== "ziggurat") return;
    const result = resolveForgottenGods(resources);
    onUpdateResources(result.resources);
    setForgottenGodsMessage(result.message);
  }

  // --- Events on Travel (issue #91) -------------------------------------------------------------

  /** The player accepts the Event: a monster row becomes a fight, anything else applies immediately.
   * Nothing was spent or applied before this point, which is exactly what makes Camouflage and the
   * Star Stone meaningful. */
  function handleAcceptEvent() {
    if (!travelEvent) return;
    const row = travelEvent.roll.row;

    if (row.monsters) {
      setTravelEvent({ ...travelEvent, combat: startEventCombat(row, resources) });
      return;
    }

    const result = applyEventEffect(resources, row.effect!);
    if (result.died) {
      onCharacterDied("event", currentPlaceLabel);
      return;
    }
    onUpdateResources(result.resources);
    if (result.relocate) {
      onUpdateWorld(hexReducer(world, { type: "STORM_RELOCATE", raceName: character.race.name }));
    }
    setTravelEvent({ ...travelEvent, resolvedMessage: `${row.text} ${result.message}` });
  }

  /** Camouflage (Nature 3): "Can ignore an Event generated in a forest or swamp territory." */
  function handleIgnoreEvent() {
    if (!travelEvent) return;
    const terrain = travelEvent.roll.terrain;
    if (!canIgnoreEvent(resources, terrain)) return;
    onUpdateResources(ignoreEvent(resources, terrain));
    setTravelEvent({
      ...travelEvent,
      resolvedMessage: `You melt into the ${terrain} and the danger passes you by.`,
    });
  }

  /** Star Stone (Ziggurat Wonder): "Spend 1 Provision to Reroll an Event." A reroll into 7+ ends the
   * Event outright; a reroll into another Event simply replaces the pending one (and can be rerolled
   * again, as long as provisions last). */
  function handleRerollEvent() {
    if (!travelEvent) return;
    const result = rerollEvent(resources, character.race.name, travelEvent.roll.terrain);
    onUpdateResources(result.resources);
    if (result.roll.kind === "event") {
      setTravelEvent({ roll: result.roll, combat: null, resolvedMessage: null });
    } else {
      setTravelEvent({
        ...travelEvent,
        resolvedMessage: "The Star Stone flares, and the moment passes.",
      });
    }
  }

  /** Race and class aren't carried on `AdventurerResources`, so a fight is handed them separately
   * (issue #120) -- see `events.ts`'s `FighterIdentity`. */
  const fighterIdentity: FighterIdentity = {
    raceName: character.race.name,
    className: character.cls.name,
  };

  /** Applies whatever a wilderness fight action produced. Every one of them returns the same shape,
   * so victory/defeat/ongoing is handled once rather than at each call site (issue #120). */
  function applyWildFight(
    fight: WildFight,
    deathCause: "event" | "realm",
    place: string,
    onOngoing: (fight: WildFight) => void,
    onVictory: (fight: WildFight) => void,
  ) {
    if (fight.died) {
      onCharacterDied(deathCause, place);
      return;
    }
    onUpdateResources(fight.resources);
    if (fight.combat.outcome === "victory") onVictory(fight);
    else onOngoing(fight);
  }

  function handleEventAttack(targetId: number, roll: number) {
    if (!travelEvent?.combat) return;
    const weaponFormula = resources.weapon?.formula ?? character.cls.weaponDamage;
    applyWildFight(
      eventFightRound(
        resources,
        fighterIdentity,
        travelEvent.combat,
        targetId,
        roll,
        weaponFormula,
      ),
      "event",
      currentPlaceLabel,
      (f) => setTravelEvent({ ...travelEvent, combat: f.combat, log: f.log }),
      (f) =>
        setTravelEvent({
          ...travelEvent,
          combat: f.combat,
          log: f.log,
          resolvedMessage: "You survive the encounter.",
        }),
    );
  }

  function handleEventResolveDamage(absorbWith: "hp" | "hireling" | number) {
    if (!travelEvent?.combat) return;
    applyWildFight(
      eventResolveDamage(resources, fighterIdentity, travelEvent.combat, absorbWith),
      "event",
      currentPlaceLabel,
      (f) => setTravelEvent({ ...travelEvent, combat: f.combat, log: f.log }),
      (f) => setTravelEvent({ ...travelEvent, combat: f.combat, log: f.log }),
    );
  }

  function handleEventHirelingAttack(targetId: number, roll: number) {
    if (!travelEvent?.combat) return;
    const f = eventHirelingAttack(resources, fighterIdentity, travelEvent.combat, targetId, roll);
    onUpdateResources(f.resources);
    setTravelEvent({ ...travelEvent, combat: f.combat, log: f.log });
  }

  function handleEventAnimalAttack(targetId: number) {
    if (!travelEvent?.combat) return;
    const f = eventAnimalAttack(resources, fighterIdentity, travelEvent.combat, targetId);
    onUpdateResources(f.resources);
    setTravelEvent({ ...travelEvent, combat: f.combat, log: f.log });
  }

  function handleEventCastSpell(table: SpellTableKey, spellRoll: number, targetId?: number) {
    if (!travelEvent?.combat) return;
    applyWildFight(
      eventCastSpell(resources, fighterIdentity, travelEvent.combat, table, spellRoll, targetId),
      "event",
      currentPlaceLabel,
      (f) => setTravelEvent({ ...travelEvent, combat: f.combat, log: f.log }),
      (f) =>
        setTravelEvent({
          ...travelEvent,
          combat: f.combat,
          log: f.log,
          resolvedMessage: "You survive the encounter.",
        }),
    );
  }

  /** Drinking a held potion mid-Event (issue #110) -- the same round-consuming action as a spell. */
  function handleEventUseConsumable(index: number) {
    if (!travelEvent?.combat) return;
    applyWildFight(
      eventUseConsumable(resources, fighterIdentity, travelEvent.combat, index),
      "event",
      currentPlaceLabel,
      (f) => setTravelEvent({ ...travelEvent, combat: f.combat, log: f.log }),
      (f) => setTravelEvent({ ...travelEvent, combat: f.combat, log: f.log }),
    );
  }

  /** Issue #120: the exit that didn't exist. An Event is mandatory; a fight you can't leave isn't. */
  function handleEventFlee() {
    if (!travelEvent) return;
    const fled = fleeEvent(resources);
    onUpdateResources(fled.resources);
    setTravelEvent({ ...travelEvent, combat: null, resolvedMessage: fled.message });
  }

  // --- Other Worlds (issue #105) -----------------------------------------------------------------

  /** Rolls the realm's own 2d6 Event and puts it on screen. Split out so both the ordinary arrival
   * path and the hazard panel's "continue" can call it -- a hazard resolves first, then the Event. */
  function rollRealmEventInto(realm: NonNullable<ReturnType<typeof currentRealmDef>>) {
    const roll = rollRealmEvent(realm);
    if (!roll.row) return; // 7+ -- "Nothing happens...", deliberately silent like the overworld's
    setRealmEvent({ row: roll.row, dice: roll.dice, combat: null, resolvedMessage: null });
  }

  /** Applies a resolved terrain hazard, then hands off to the realm's Event roll. Magma can kill
   * outright, which is why it resolves before anything else gets a turn. */
  function handleResolveRealmHazard() {
    const hazard = realmHazard;
    const realmDef = currentRealmDef(world);
    setRealmHazard(null);
    if (!hazard || !realmDef) return;

    const effect = hazard.effect;
    if (effect.kind === "loseHp") {
      // Unlike every other HP cost outside a dungeon, Magma is *not* floored at 1 -- the rulebook
      // gives it a flat 6d6 with no survival clause, and a realm that can kill you is the point.
      const hp = resources.hp - effect.amount;
      if (hp <= 0) {
        onCharacterDied("realm", realmLabel(currentRealm(world)));
        return;
      }
      onUpdateResources({ ...resources, hp });
    } else if (effect.kind === "catatonic") {
      onUpdateResources({ ...resources, catatonic: true });
    } else if (effect.kind === "moveToRandomAdjacent") {
      const damaged = effect.damage ? Math.max(1, resources.hp - effect.damage) : resources.hp;
      onUpdateResources({ ...resources, hp: damaged });
      onUpdateWorld(hexReducer(world, { type: "STORM_RELOCATE", raceName: character.race.name }));
    }
    rollRealmEventInto(realmDef);
  }

  /** Accepting a realm Event: a monster row becomes a fight, anything else applies immediately. */
  function handleAcceptRealmEvent() {
    if (!realmEvent) return;
    const row = realmEvent.row;
    if (row.monsters) {
      setRealmEvent({
        ...realmEvent,
        combat: startEventCombat({ text: row.text, monsters: row.monsters }, resources),
      });
      return;
    }
    const effect = row.effect;
    if (!effect) {
      setRealmEvent({ ...realmEvent, resolvedMessage: "" });
      return;
    }
    if (effect.kind === "ancientSoul") {
      // "If you want to help him, roll 1d6. If it's 6 his soul will follow you and resurrect when he
      // returns to the world of the living." Modelled as a straight reward on a 6 -- there's no
      // NPC-follower concept to carry, so the resurrection is paid out immediately as the HP a
      // rescued companion would represent. A documented simplification.
      const roll = 1 + Math.floor(Math.random() * 6);
      const helped = roll === 6;
      if (helped)
        onUpdateResources({ ...resources, hp: resources.maxHp, coins: resources.coins + 50 });
      setRealmEvent({
        ...realmEvent,
        resolvedMessage: helped
          ? "His soul follows you out, and something of him stays behind in you — you are made whole, and 50 coins richer."
          : "His soul slips away to hell, and you are alone again.",
      });
      return;
    }
    if (effect.kind === "catatonic") {
      onUpdateResources({ ...resources, catatonic: true });
      setRealmEvent({ ...realmEvent, resolvedMessage: "You lose your next move." });
      return;
    }
    if (effect.kind === "moveToRandomAdjacent") {
      const damaged = effect.damage ? Math.max(1, resources.hp - effect.damage) : resources.hp;
      onUpdateResources({ ...resources, hp: damaged });
      onUpdateWorld(hexReducer(world, { type: "STORM_RELOCATE", raceName: character.race.name }));
      setRealmEvent({ ...realmEvent, resolvedMessage: "You come to somewhere else entirely." });
      return;
    }
    const applied = applyEventEffect(resources, effect);
    if (applied.died) {
      onCharacterDied("realm", realmLabel(currentRealm(world)));
      return;
    }
    onUpdateResources(applied.resources);
    if (applied.relocate) {
      onUpdateWorld(hexReducer(world, { type: "STORM_RELOCATE", raceName: character.race.name }));
    }
    setRealmEvent({ ...realmEvent, resolvedMessage: applied.message });
  }

  /** One round of a realm Event fight -- the same shared core, crediting each realm's own victory
   * reward (issue #105). */
  function handleRealmEventAttack(targetId: number, roll: number) {
    if (!realmEvent?.combat) return;
    const weaponFormula = resources.weapon?.formula ?? character.cls.weaponDamage;
    const place = realmLabel(currentRealm(world));
    applyWildFight(
      eventFightRound(resources, fighterIdentity, realmEvent.combat, targetId, roll, weaponFormula),
      "realm",
      place,
      (f) => setRealmEvent({ ...realmEvent, combat: f.combat, log: f.log }),
      (f) => {
        const template = realmEvent.row.monsters!;
        const reward = applyRealmVictoryReward(f.resources, currentRealm(world), template.name);
        onUpdateResources(reward.resources);
        if (reward.opensPortalHere) onUpdateWorld(withPortalHere(world, world.player));
        setRealmEvent({
          ...realmEvent,
          combat: f.combat,
          log: f.log,
          resolvedMessage: reward.message,
        });
      },
    );
  }

  function handleRealmResolveDamage(absorbWith: "hp" | "hireling" | number) {
    if (!realmEvent?.combat) return;
    applyWildFight(
      eventResolveDamage(resources, fighterIdentity, realmEvent.combat, absorbWith),
      "realm",
      realmLabel(currentRealm(world)),
      (f) => setRealmEvent({ ...realmEvent, combat: f.combat, log: f.log }),
      (f) => setRealmEvent({ ...realmEvent, combat: f.combat, log: f.log }),
    );
  }

  function handleRealmCastSpell(table: SpellTableKey, spellRoll: number, targetId?: number) {
    if (!realmEvent?.combat) return;
    applyWildFight(
      eventCastSpell(resources, fighterIdentity, realmEvent.combat, table, spellRoll, targetId),
      "realm",
      realmLabel(currentRealm(world)),
      (f) => setRealmEvent({ ...realmEvent, combat: f.combat, log: f.log }),
      (f) => setRealmEvent({ ...realmEvent, combat: f.combat, log: f.log }),
    );
  }

  function handleRealmHirelingAttack(targetId: number, roll: number) {
    if (!realmEvent?.combat) return;
    const f = eventHirelingAttack(resources, fighterIdentity, realmEvent.combat, targetId, roll);
    onUpdateResources(f.resources);
    setRealmEvent({ ...realmEvent, combat: f.combat, log: f.log });
  }

  function handleRealmAnimalAttack(targetId: number) {
    if (!realmEvent?.combat) return;
    const f = eventAnimalAttack(resources, fighterIdentity, realmEvent.combat, targetId);
    onUpdateResources(f.resources);
    setRealmEvent({ ...realmEvent, combat: f.combat, log: f.log });
  }

  function handleRealmUseConsumable(index: number) {
    if (!realmEvent?.combat) return;
    applyWildFight(
      eventUseConsumable(resources, fighterIdentity, realmEvent.combat, index),
      "realm",
      realmLabel(currentRealm(world)),
      (f) => setRealmEvent({ ...realmEvent, combat: f.combat, log: f.log }),
      (f) => setRealmEvent({ ...realmEvent, combat: f.combat, log: f.log }),
    );
  }

  function handleRealmFlee() {
    if (!realmEvent) return;
    const fled = fleeEvent(resources);
    onUpdateResources(fled.resources);
    setRealmEvent({ ...realmEvent, combat: null, resolvedMessage: fled.message });
  }

  // --- Portals (issue #21) ----------------------------------------------------------------------

  /** Applies one settled portal roll against explicit resources/world, so a chained roll can build on
   * what the previous one just produced rather than the stale props this render closed over.
   * `stampOrigin` is false for a chained roll -- "once you've established where a portal leads" is
   * about the portal *hex*, and the golden room's second portal isn't one, so only the first is
   * remembered. `depth` bounds a golden-room-into-golden-room chain. */
  function applyPortalRoll(
    roll: PortalRoll,
    fromResources: AdventurerResources,
    fromWorld: WorldState,
    stampOrigin: boolean,
    depth = 0,
  ) {
    const from = fromWorld.player;
    // Stamped before resolving, since a `newMap` outcome discards these tiles wholesale -- writing it
    // afterwards would either stamp a tile that no longer exists or need its own special case.
    const stamped = stampOrigin ? withPortalTotal(fromWorld, from, roll.total) : fromWorld;
    const result = resolvePortalOutcome(roll.row.outcome, fromResources, stamped, from);

    if (result.died) {
      onCharacterDied("portal", currentPlaceLabel);
      return;
    }

    onUpdateResources(result.resources);
    onUpdateWorld(result.world);

    if (result.awaitDestination) {
      setPortal({ roll, applied: true, resolvedMessage: null, awaitDestination: true });
      return;
    }
    if (result.enterNoExitDungeon) {
      setPortal(null);
      onEnterNoExitDungeon();
      return;
    }
    if (result.enterOtherWorld) {
      // Issue #105: the map is swapped wholesale. Done here rather than in `resolvePortalOutcome`
      // because generating a realm on a first visit needs an RNG, and that function is a pure
      // outcome classifier.
      const moved = switchRealm(result.world, result.enterOtherWorld, Math.random);
      onUpdateWorld(moved);
      setPortal({
        roll,
        applied: true,
        resolvedMessage: REALMS[result.enterOtherWorld].arrivalFlavor,
        awaitDestination: false,
      });
      return;
    }
    if (result.chainAnotherPortal && depth < MAX_PORTAL_CHAIN) {
      // The golden room's coins are already credited; its second portal is the only way out, so it's
      // rolled and resolved right here against the state this outcome just produced.
      const next = rollPortal();
      applyPortalRoll(next, result.resources, result.world, false, depth + 1);
      return;
    }
    setPortal({ roll, applied: true, resolvedMessage: result.message, awaitDestination: false });
  }

  /** "Once you've established where a portal leads, you don't need to roll again for it" -- a hex with
   * a remembered `portalTotal` reuses it instead of rolling. The roll is only *revealed* here; nothing
   * is applied until the player acknowledges it (see `handleStepThroughPortal`). */
  function handleEnterPortal() {
    setPendingPortalConfirm(false);
    const remembered = currentTile?.portalTotal;
    const roll = (remembered != null ? establishedPortal(remembered) : null) ?? rollPortal();
    setPortal({ roll, applied: false, resolvedMessage: null, awaitDestination: false });
  }

  /** Applies the revealed roll. Split from `handleEnterPortal` so the outcome is *shown* before it
   * takes effect -- not a choice (the ConfirmDialog already covered "no turning back," and the dice
   * have already fallen), just an acknowledgment. Keeping it a click rather than an effect is also
   * what lets the no-exit dungeon's arrival portal seed itself at mount without a setState cascade. */
  function handleStepThroughPortal() {
    if (!portal || portal.applied) return;
    // Clears App's one-shot arrival flag, so a later remount of this screen doesn't seed a second
    // portal out of nowhere. A no-op for an ordinary portal, where the flag was never set.
    onAutoPortalConsumed?.();
    const remembered = currentTile?.portalTotal;
    applyPortalRoll(
      portal.roll,
      resources,
      world,
      remembered == null && currentTile?.location === "portal",
    );
  }

  /** Rolls 11/14: the player picked where the portal opens. */
  function handleChoosePortalDestination(coord: HexCoord) {
    const tile = world.tiles[hexKey(coord)];
    onUpdateWorld(withPlayerMovedTo(world, coord, Math.random));
    setPortal((prev) =>
      prev
        ? {
            ...prev,
            awaitDestination: false,
            resolvedMessage: tile?.name
              ? `You step out in ${tile.name}.`
              : "You step out somewhere new.",
          }
        : prev,
    );
  }

  /** "You can buy mounts in a city that is on the appropriate terrain" -- always succeeds if
   * affordable, no roll involved, unlike training. */
  function handleBuyMount(name: string) {
    const mount = MOUNT_TABLE[name];
    if (!mount || !currentTile) return;
    if (!qualifiesForBuyingMount(currentTile, currentMatchingNeighbors, mount)) return;
    onUpdateResources(buyMount(resources, mount));
  }

  /** Buildings (issue #27): only ever buildable on the hex the player is standing on (an empty
   * hex, per `qualifiesForBuilding()`), so this always targets `world.player` rather than whichever
   * hex `HexInspector` happens to be describing. Re-validates defensively, same
   * "handler re-checks, engine function is real authority" precedent as `handleTrainAnimal`. */
  function handleBuildBuilding(kind: BuildingKind) {
    if (
      !currentTile ||
      !canBuildBuilding(resources, currentTile, kind, currentTile.terrain, character.race.name)
    ) {
      return;
    }
    const result = buildBuilding(
      resources,
      world,
      world.player,
      kind,
      currentTile.terrain,
      character.race.name,
    );
    onUpdateResources(result.resources);
    onUpdateWorld(result.world);
  }

  /** Buildings' storage (issue #102): how much sits in each owned building, for `TownScreen`'s
   * read-only "My Buildings" card -- the "what did I leave where" view you want from a city on the
   * far side of the map. */
  const storedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [key, tile] of Object.entries(world.tiles)) {
      if (!tile.building) continue;
      const total = (tile.storedItems?.length ?? 0) + (tile.storedConsumables?.length ?? 0);
      if (total > 0) counts[key] = total;
    }
    return counts;
  }, [world.tiles]);

  /** Buildings' storage (issue #102): moves one item between the Pack and the building standing on
   * the player's own hex. Both directions touch `resources` *and* `world`, so they're resolved here
   * rather than in the panel, the same shape `handleBuildBuilding` above uses. Always acts on
   * `world.player` -- the engine refuses a hex with no building anyway, but storage is a
   * stand-here action and shouldn't read from `inspectedCoord`. */
  function handleStorage(
    direction: "deposit" | "withdraw",
    list: "heldItems" | "consumables",
    index: number,
  ) {
    const move = direction === "deposit" ? depositItem : withdrawItem;
    const result = move(resources, world, world.player, list, index);
    onUpdateResources(result.resources);
    onUpdateWorld(result.world);
  }

  /** Politics (issue #27): touches both `resources` (Lord/King Vassal-eligibility check,
   * `talkedToKing`/`vassalCount` milestones) and `world` (the resolved status itself), same
   * "resolved here, not in TownScreen" shape as `handleThugLife`. Returns the outcome so TownScreen
   * can render it as message text; `null` if the action isn't actually available right now
   * (the button is already disabled in that case, this is just defense in depth). */
  function handlePoliticalAffinity(): PoliticalAffinityOutcome | null {
    if (
      !currentTile ||
      !culture ||
      !canAttemptPoliticalAffinity(world, world.player, currentTile)
    ) {
      return null;
    }
    const outcome = resolvePoliticalAffinity(
      resources,
      world,
      character.race.name,
      world.player,
      culture,
      isFortress,
    );
    onUpdateResources(outcome.resources);
    onUpdateWorld(outcome.world);
    return outcome;
  }

  /** Warfare (issue #28): always targets `world.player` -- recruiting only ever happens where
   * you're standing, same "handler re-checks, engine function is real authority" shape as
   * `handleTrainAnimal`. Reachable from both `HexInspector` (an owned Castle/City/Fortress) and
   * `TownScreen` (a Vassal hex) -- either way the underlying check/mutation is identical. */
  function handleRecruitTroop() {
    if (!currentTile || !canRecruitTroop(resources, world, world.player, currentTile)) return;
    onUpdateResources(recruitTroop(resources, world, world.player, currentTile));
  }

  /** Warfare (issue #28): touches both `resources` (troops spent, Declared Enemies possibly
   * destroying an owned building) and `world` (that building's tile, if any) -- same "resolved
   * here, not in TownScreen" shape as `handlePoliticalAffinity`/`handleThugLife`. A `"lost-death"`
   * result still applies everything (troops/retaliation already happened) before handing off to
   * the death flow, mirroring `handleThugLife`'s own die-mid-action precedent. The outcome message
   * is computed and stored here (not left to `TownScreen`) since a winning Loot razes the target
   * to Ruins, unmounting `TownScreen` before it could ever show a message of its own. */
  function handleAttack(joinBattle: boolean) {
    if (!currentTile || !canAttack(world, world.player, currentTile)) return;
    const outcome = resolveAttack(resources, world, world.player, isFortress, joinBattle);
    onUpdateResources(outcome.resources);
    onUpdateWorld(outcome.world);
    if (outcome.status === "lost-death") {
      onCharacterDied("warfare", currentPlaceLabel);
      return;
    }
    const retaliationNote =
      outcome.retaliation.length > 0
        ? ` Meanwhile, an enemy destroyed your ${outcome.retaliation.map((r) => BUILDING_TABLE[r.kind].name).join(", ")}.`
        : "";
    if (outcome.status === "won") {
      setPendingStorm(true);
      setAttackMessage(`Victory! Choose what to do with the conquered place.${retaliationNote}`);
    } else {
      setPendingStorm(false);
      setAttackMessage(`The attack failed.${retaliationNote}`);
    }
  }

  /** Warfare (issue #28): the Storming follow-up choice after a won Attack -- always resolves
   * against `world.player` too, since the character can't have moved between winning the battle
   * and picking Annex/Loot. */
  function handleResolveStorming(choice: "annex" | "loot") {
    if (!culture) return;
    const outcome = resolveStorming(
      resources,
      world,
      character.race.name,
      world.player,
      culture,
      choice,
    );
    onUpdateResources(outcome.resources);
    onUpdateWorld(outcome.world);
    setPendingStorm(false);
    setAttackMessage(
      choice === "annex"
        ? outcome.annexed
          ? "They pledge themselves as your Vassal!"
          : "The people refused -- you looted the place instead."
        : "You razed the place to Ruins.",
    );
  }

  /** Issue #79: shows -- doesn't travel to, see `DungeonsList`'s own doc comment for why that
   * distinction is deliberate -- where a dungeon from the Dungeons list is, by selecting its hex
   * the same way clicking it on the map directly would. A no-op if the run isn't on the map at all --
   * which a portal-created no-exit run (issue #21, roll of 7) genuinely never is, since nothing ever
   * stamps it onto a hex. */
  function handleLocateDungeon(runId: string) {
    const coord = findHexForRunId(world, runId);
    if (!coord) return;
    setShowTown(false);
    setSelectedHex(coord);
  }

  /** Issue #80: "closest to farthest," measured from the player's own current position --
   * `DungeonsList`'s own `sortDungeonsForDisplay()` then layers its unfinished-before-cleared
   * grouping on top of this order (a stable sort, so this ordering survives within each group). A
   * dungeon with no hex at all sorts last -- a portal-created no-exit run (issue #21, roll of 7) is
   * permanently in that category, since it exists nowhere on the map. */
  const sortedDungeonHistory = useMemo(
    () =>
      [...dungeonHistory].sort((a, b) => {
        const coordA = findHexForRunId(world, a.id);
        const coordB = findHexForRunId(world, b.id);
        const distA = coordA ? hexDistance(world.player, coordA) : Infinity;
        const distB = coordB ? hexDistance(world.player, coordB) : Infinity;
        return distA - distB;
      }),
    [dungeonHistory, world],
  );

  const inspectedCoord = selectedHex ?? world.player;
  const inspectedTile: HexTile | undefined = world.tiles[hexKey(inspectedCoord)];
  const isInspectingCurrentTile =
    inspectedCoord.q === world.player.q && inspectedCoord.r === world.player.r;
  const inspectedNoAffinity =
    !!inspectedTile && !hasAffinity(character.race.name, inspectedTile.location);
  const inspectedBanned = isBannedHex(world, inspectedCoord);

  /** Clicking a passable, in-range neighbor travels immediately; anything else (out of range,
   * impassable, no Affinity, or the player's own tile) just selects it for HexInspector to
   * describe. */
  function handleHexClick(coord: HexCoord) {
    const tile = world.tiles[hexKey(coord)];
    const isNeighbor = neighborCoords.some((n) => n.q === coord.q && n.r === coord.r);
    if (tile && isNeighbor && canTravelTo(tile, coord)) {
      handleTravel(coord);
    } else {
      setSelectedHex(coord);
    }
  }

  function handleHireBoat() {
    if (!canHireBoat(resources)) return;
    onUpdateResources(hireBoat(resources));
    onUpdateWorld(hexReducer(world, { type: "HIRE_BOAT" }));
  }

  function handleAsk() {
    if (askedDungeonKnown) return;
    onUpdateWorld(hexReducer(world, { type: "ASK_FOR_DUNGEON" }));
  }

  /** "Thug Life" -- unlike every other City Action, this can touch *both* resources (coins/
   * Treasures/HP) and WorldState (a permanent ban) from the same die roll, so it's resolved once
   * here (not in TownScreen, which only ever gets an `AdventurerResources`) and applied to
   * whichever of the two actually changed. Returns the result so TownScreen can show what happened
   * -- this screen doesn't otherwise track any per-action outcome text. */
  function handleThugLife(): ReturnType<typeof resolveThugLife> {
    const result = resolveThugLife(resources, isFortress);
    if (result.died) {
      onCharacterDied("thug-life", currentPlaceLabel);
      return result;
    }
    onUpdateResources(result.resources);
    if (result.banned) onUpdateWorld(withBannedHex(world, world.player));
    return result;
  }

  // Computed unconditionally (mirroring DungeonMap's own useMemo-before-early-return shape) since
  // useZoomGesture below is a hook and must run every render, including while showTown is true and
  // TownScreen is what actually renders -- the resulting values are simply unused in that case.
  const knownCoords: HexCoord[] = useMemo(
    () =>
      Object.keys(world.tiles).map((key) => {
        const [q, r] = key.split(",").map(Number);
        return { q: q!, r: r! };
      }),
    [world.tiles],
  );
  const pixels = useMemo(
    () => knownCoords.map((c) => ({ coord: c, pixel: axialToPixel(c) })),
    [knownCoords],
  );
  const naturalViewBox: ViewBox = useMemo(() => {
    const minX = Math.min(...pixels.map((p) => p.pixel.x)) - HEX_SIZE;
    const maxX = Math.max(...pixels.map((p) => p.pixel.x)) + HEX_SIZE;
    const minY = Math.min(...pixels.map((p) => p.pixel.y)) - HEX_SIZE;
    const maxY = Math.max(...pixels.map((p) => p.pixel.y)) + HEX_SIZE;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [pixels]);
  const baseViewBox = viewBoxOverride ?? naturalViewBox;

  // Zoom (wheel + pinch, see useZoomGesture) -- shrinks/grows the SVG viewBox around the client-space
  // focal point, converted to SVG user-space via getScreenCTM().inverse() (correctly accounts for
  // preserveAspectRatio letterboxing). Clamped between ~4 hexes wide and 1.5x the natural full-fit
  // width so zooming out can never show *less* structure than "lost, reset" already covers via the
  // Reset View button.
  useZoomGesture(svgRef, ({ factor, clientX, clientY }) => {
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const focal = pt.matrixTransform(ctm.inverse());
    setViewBoxOverride((prev) => {
      const base = prev ?? naturalViewBox;
      const minW = HEX_SIZE * Math.sqrt(3) * 4;
      const maxW = naturalViewBox.w * 1.5;
      const newW = clamp(base.w / factor, minW, maxW);
      const ratio = newW / base.w;
      const newH = base.h * ratio;
      return {
        x: focal.x - (focal.x - base.x) * ratio,
        y: focal.y - (focal.y - base.y) * ratio,
        w: newW,
        h: newH,
      };
    });
  });

  // Click-and-drag panning (mouse only -- there's no native scroll to fall back on for an inline SVG
  // the way DungeonMap's `.scroll` div gets for touch, but that's out of scope here same as there).
  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    dragOrigin.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      base: baseViewBox,
      inverse: ctm.inverse(),
    };
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const origin = dragOrigin.current;
    const svg = svgRef.current;
    if (!origin || !svg) return;
    const dx = e.clientX - origin.clientX;
    const dy = e.clientY - origin.clientY;
    if (!didDrag.current && Math.hypot(dx, dy) > 4) {
      didDrag.current = true;
      // Deferred until movement is confirmed, same reasoning as DungeonMap: capturing on
      // pointerdown itself would retarget the eventual click away from whatever hex it lands on.
      svg.setPointerCapture(e.pointerId);
    }
    if (!didDrag.current) return;
    const startPt = svg.createSVGPoint();
    startPt.x = origin.clientX;
    startPt.y = origin.clientY;
    const curPt = svg.createSVGPoint();
    curPt.x = e.clientX;
    curPt.y = e.clientY;
    const startUser = startPt.matrixTransform(origin.inverse);
    const curUser = curPt.matrixTransform(origin.inverse);
    const deltaX = curUser.x - startUser.x;
    const deltaY = curUser.y - startUser.y;
    setViewBoxOverride({
      x: origin.base.x - deltaX,
      y: origin.base.y - deltaY,
      w: origin.base.w,
      h: origin.base.h,
    });
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    dragOrigin.current = null;
    if (svgRef.current?.hasPointerCapture(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
  }

  function handleClickCapture(e: React.MouseEvent<SVGSVGElement>) {
    if (didDrag.current) {
      didDrag.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }

  /** Other Worlds (issue #105) -- the hazard and the realm's own Event share the portal overlay's
   * slot, since all three are interruptions that must be resolved before the map is usable again. */
  const locationOverlay = locationEffect ? (
    <div className={styles.portalOverlay}>
      <div className={styles.realmPanel}>
        <p className={styles.realmEyebrow}>
          {currentTile?.location ? LOCATION_LABEL[currentTile.location] : "Arrival"}
        </p>
        <div className={styles.locationDieRow}>
          <DicePool values={[locationEffect.roll]} rollToken={locationEffect.roll} size={34} />
        </div>
        <p className={styles.realmFlavor}>{locationEffect.message}</p>
        <button type="button" className={styles.realmBtn} onClick={() => setLocationEffect(null)}>
          Continue
        </button>
      </div>
    </div>
  ) : null;

  const realmOverlay = realmHazard ? (
    <div className={styles.portalOverlay}>
      <div className={styles.realmPanel}>
        <p className={styles.realmEyebrow}>{realmName}</p>
        <p className={styles.realmFlavor}>{realmHazard.text}</p>
        <button type="button" className={styles.realmBtn} onClick={handleResolveRealmHazard}>
          Continue
        </button>
      </div>
    </div>
  ) : realmEvent ? (
    <div className={styles.portalOverlay}>
      <EventPanel
        row={{ text: realmEvent.row.text, monsters: realmEvent.row.monsters }}
        dice={realmEvent.dice}
        combat={realmEvent.combat}
        hp={resources.hp}
        maxHp={resources.maxHp}
        weaponName={resources.weapon?.name ?? character.cls.weapon}
        weaponFormula={resources.weapon?.formula ?? character.cls.weaponDamage}
        resolvedMessage={realmEvent.resolvedMessage}
        // Camouflage and the Star Stone are overworld Events-on-Travel abilities; a realm's own
        // Event table is a different thing the rulebook gives no way to dodge.
        canIgnore={false}
        ignoreLabel=""
        canReroll={false}
        onAccept={handleAcceptRealmEvent}
        onIgnore={() => {}}
        onReroll={() => {}}
        armor={resources.armor}
        spellUses={resources.spellUses}
        consumables={resources.consumables}
        isRinoceroid={character.race.name === "Rinoceroid"}
        isSnakeOwner={resources.animals.includes("Snake")}
        onCastSpell={handleRealmCastSpell}
        onResolveDamage={handleRealmResolveDamage}
        onHirelingAttack={handleRealmHirelingAttack}
        onAnimalAttack={handleRealmAnimalAttack}
        onUseConsumable={handleRealmUseConsumable}
        onFlee={handleRealmFlee}
        log={realmEvent.log ?? []}
        onAttack={handleRealmEventAttack}
        onDismiss={() => setRealmEvent(null)}
      />
    </div>
  ) : null;

  /** Portals (issue #21) -- rendered in *both* branches below, as a viewport-level modal. A portal can
   * deposit the player inside a City/Fortress (rolls 9/10), which flips this screen to `TownScreen`
   * wholesale; an overlay living inside the map card would unmount before the outcome could be read. */
  const portalOverlay = portal ? (
    <div className={styles.portalOverlay}>
      <PortalPanel
        roll={portal.roll}
        applied={portal.applied}
        resolvedMessage={portal.resolvedMessage}
        destinations={portal.awaitDestination ? portalDestinationList : []}
        onStepThrough={handleStepThroughPortal}
        onChooseDestination={handleChoosePortalDestination}
        onDismiss={() => setPortal(null)}
      />
    </div>
  ) : null;

  if (inCityOrFortress && showTown) {
    return (
      <>
        <TownScreen
          character={character}
          resources={resources}
          // canEnterDungeon, not "already has a known dungeonRunId" -- a hex the player has never
          // entered a dungeon on yet still offers a fresh roll, same as the old Ruins card always did.
          hasDungeon={canEnterDungeon}
          dungeonGateCopy={dungeonGateCopy}
          hasSewers={hasSewers}
          sewersGateCopy={sewersGateCopy}
          onEnterSewers={onEnterSewers}
          dungeonHistory={sortedDungeonHistory}
          culture={culture}
          cityName={currentPlaceLabel}
          showHireBoat={!inRealm && besideWater}
          askedDungeonKnown={inRealm || askedDungeonKnown}
          isFortress={isFortress}
          buyableMounts={buyableMounts}
          politicalStatus={politicalStatusFor(world, world.player)}
          canPoliticalAffinity={
            !inRealm && canAttemptPoliticalAffinity(world, world.player, currentTile)
          }
          canRecruitTroop={!inRealm && canRecruitTroop(resources, world, world.player, currentTile)}
          canAttack={!inRealm && canAttack(world, world.player, currentTile)}
          attackMessage={attackMessage}
          pendingStorm={pendingStorm}
          onUpdateResources={onUpdateResources}
          onEnterDungeon={() => onEnterDungeon(true)}
          onHireBoat={handleHireBoat}
          onBuyMount={handleBuyMount}
          onAsk={handleAsk}
          onThugLife={handleThugLife}
          onPoliticalAffinity={handlePoliticalAffinity}
          onRecruitTroop={handleRecruitTroop}
          onAttack={handleAttack}
          onResolveStorming={handleResolveStorming}
          onLocateDungeon={handleLocateDungeon}
          storedCounts={storedCounts}
          arrivalNote={arrivalNote}
          onCharacterDied={(cause) => onCharacterDied(cause, currentPlaceLabel)}
          onExploreWorld={() => setShowTown(false)}
          onHardReset={onHardReset}
        />
        {portalOverlay}
        {realmOverlay}
        {locationOverlay}
      </>
    );
  }

  const viewBox = `${baseViewBox.x} ${baseViewBox.y} ${baseViewBox.w} ${baseViewBox.h}`;

  return (
    <div className={styles.page}>
      <header className={styles.wordmark}>
        <h1>
          <small>GerdQuest</small>
          Realm of Depths
        </h1>
        <p className={styles.tagline}>The world beyond the city walls.</p>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <div className={styles.mapCard}>
            <svg
              ref={svgRef}
              className={styles.mapSvg}
              viewBox={viewBox}
              preserveAspectRatio="xMidYMid meet"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClickCapture={handleClickCapture}
            >
              {pixels.map(({ coord, pixel }) => {
                const tile = world.tiles[hexKey(coord)]!;
                const isPlayer = coord.q === world.player.q && coord.r === world.player.r;
                const isSelected =
                  !isPlayer &&
                  selectedHex != null &&
                  coord.q === selectedHex.q &&
                  coord.r === selectedHex.r;
                const label = tile.name ?? (tile.location ? LOCATION_LABEL[tile.location] : "");
                const { status: dungeonStatus, hasRemains } = dungeonInfoFor(tile);
                const political = politicalStatusFor(world, coord);
                // Issue #81: no corner slot left uncrowded (dungeon/remains/building/political
                // badges already claim all four) -- a forbidden hex instead gets its own dashed,
                // danger-colored outline, visible at a glance without adding a 5th tiny glyph.
                const noAffinityHere = !hasAffinity(character.race.name, tile.location);
                return (
                  <g
                    key={hexKey(coord)}
                    className={styles.clickableHex}
                    onClick={() => handleHexClick(coord)}
                  >
                    {noAffinityHere && <title>Your race is not welcome here</title>}
                    <polygon
                      points={hexPolygonPoints(pixel, HEX_SIZE - 2)}
                      fill={TERRAIN_FILL[tile.terrain]}
                      stroke={
                        isPlayer
                          ? "var(--gold-bright)"
                          : isSelected
                            ? "var(--gold)"
                            : noAffinityHere
                              ? "var(--danger)"
                              : "rgba(0,0,0,0.4)"
                      }
                      strokeWidth={isPlayer || isSelected ? 4 : noAffinityHere ? 2.5 : 1.5}
                      strokeDasharray={
                        noAffinityHere && !isPlayer && !isSelected ? "4 2" : undefined
                      }
                    />
                    {label && (
                      <text
                        x={pixel.x}
                        y={pixel.y + 4}
                        textAnchor="middle"
                        className={styles.hexLabel}
                      >
                        {label}
                      </text>
                    )}
                    {dungeonStatus !== "none" && (
                      <text
                        x={pixel.x + 17}
                        y={pixel.y - 18}
                        textAnchor="middle"
                        className={
                          dungeonStatus === "beaten"
                            ? styles.dungeonBadgeCleared
                            : styles.dungeonBadgeUnfinished
                        }
                      >
                        <title>
                          {dungeonStatus === "beaten"
                            ? "Dungeon cleared"
                            : dungeonStatus === "found"
                              ? "A dungeon has been found here"
                              : "Unfinished dungeon"}
                        </title>
                        {dungeonStatus === "beaten" ? "✓" : "⚔"}
                      </text>
                    )}
                    {hasRemains && (
                      <text
                        x={pixel.x - 17}
                        y={pixel.y - 18}
                        textAnchor="middle"
                        className={styles.remainsBadge}
                      >
                        <title>
                          A fallen adventurer&apos;s remains are still here, unrecovered
                        </title>
                        💀
                      </text>
                    )}
                    {tile.building && (
                      <text
                        x={pixel.x + 17}
                        y={pixel.y + 18}
                        textAnchor="middle"
                        className={styles.buildingBadge}
                      >
                        <title>{tile.building}</title>
                        🏛
                      </text>
                    )}
                    {political && (
                      <text
                        x={pixel.x - 17}
                        y={pixel.y + 18}
                        textAnchor="middle"
                        className={styles.politicalBadge}
                      >
                        <title>
                          {political === "ally"
                            ? "Allied"
                            : political === "vassal"
                              ? "Vassal"
                              : "Enemy"}
                        </title>
                        {political === "ally" ? "🤝" : political === "vassal" ? "👑" : "🗡"}
                      </text>
                    )}
                    {isPlayer && (
                      <text
                        x={pixel.x}
                        y={pixel.y - 14}
                        textAnchor="middle"
                        className={styles.playerLabel}
                      >
                        You
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {viewBoxOverride && (
              <button
                type="button"
                className={styles.resetViewBtn}
                onClick={() => setViewBoxOverride(null)}
              >
                Reset View
              </button>
            )}

            {/* Events on Travel (issue #91) -- takes the overlay slot outright while pending, since
                it's a genuine interruption (nothing is spent or applied until it's resolved) and
                inspecting other hexes mid-Event would only invite dispatching actions into it. */}
            {travelEvent ? (
              <div className={styles.eventOverlay}>
                <EventPanel
                  row={travelEvent.roll.row}
                  dice={travelEvent.roll.dice}
                  combat={travelEvent.combat}
                  hp={resources.hp}
                  maxHp={resources.maxHp}
                  weaponName={resources.weapon?.name ?? character.cls.weapon}
                  weaponFormula={resources.weapon?.formula ?? character.cls.weaponDamage}
                  resolvedMessage={travelEvent.resolvedMessage}
                  canIgnore={canIgnoreEvent(resources, travelEvent.roll.terrain)}
                  ignoreLabel={camouflageSpellName()}
                  canReroll={canRerollEvent(resources)}
                  onAccept={handleAcceptEvent}
                  onIgnore={handleIgnoreEvent}
                  onReroll={handleRerollEvent}
                  armor={resources.armor}
                  spellUses={resources.spellUses}
                  consumables={resources.consumables}
                  isRinoceroid={character.race.name === "Rinoceroid"}
                  isSnakeOwner={resources.animals.includes("Snake")}
                  onCastSpell={handleEventCastSpell}
                  onResolveDamage={handleEventResolveDamage}
                  onHirelingAttack={handleEventHirelingAttack}
                  onAnimalAttack={handleEventAnimalAttack}
                  onUseConsumable={handleEventUseConsumable}
                  onFlee={handleEventFlee}
                  log={travelEvent.log ?? []}
                  onAttack={handleEventAttack}
                  onDismiss={() => setTravelEvent(null)}
                />
              </div>
            ) : (
              inspectedTile && (
                <div className={styles.hexInspectorOverlay}>
                  <HexInspector
                    terrain={inspectedTile.terrain}
                    locationLabel={
                      inspectedTile.location ? LOCATION_LABEL[inspectedTile.location] : ""
                    }
                    cityName={inspectedTile.name}
                    dungeonStatus={dungeonInfoFor(inspectedTile).status}
                    hasRemains={dungeonInfoFor(inspectedTile).hasRemains}
                    isCurrentTile={isInspectingCurrentTile}
                    noAffinity={inspectedNoAffinity}
                    banned={inspectedBanned}
                    // City/Fortress hexes handle their own "Enter Dungeon" via TownScreen -- excluded
                    // here too (even while voluntarily viewing the map from inside one, see "Return
                    // to the City" below) so there's exactly one entry point for that case, not two.
                    canEnterDungeon={canEnterDungeon && !inCityOrFortress}
                    onEnterDungeon={() => onEnterDungeon(false)}
                    trainableAnimals={isInspectingCurrentTile ? trainableAnimals : []}
                    resources={resources}
                    onTrainAnimal={handleTrainAnimal}
                    trainResultMessage={trainResultMessage}
                    isEmptyHex={!inRealm && inspectedTile.location === null}
                    currentBuilding={inspectedTile.building}
                    raceName={character.race.name}
                    onBuildBuilding={handleBuildBuilding}
                    politicalStatus={politicalStatusFor(world, inspectedCoord)}
                    canRecruitTroopHere={
                      !inRealm &&
                      isInspectingCurrentTile &&
                      canRecruitTroop(resources, world, inspectedCoord, inspectedTile)
                    }
                    onRecruitTroop={handleRecruitTroop}
                    warfareMessage={isInspectingCurrentTile ? attackMessage : null}
                    inCityOrFortress={inCityOrFortress}
                    onEnterCity={() => setShowTown(true)}
                    stored={storedAt(world, inspectedCoord)}
                    packHasRoom={canWithdraw(resources)}
                    onDeposit={(list, index) => handleStorage("deposit", list, index)}
                    onWithdraw={(list, index) => handleStorage("withdraw", list, index)}
                    canCastFly={canCastFly(resources)}
                    flyActive={resources.flyActive}
                    onCastFly={() => onUpdateResources(castFly(resources))}
                    showForgottenGods={
                      isInspectingCurrentTile && dungeonTypeKeyFor(inspectedTile) === "ziggurat"
                    }
                    canUseForgottenGodsHere={canUseForgottenGods(resources)}
                    onForgottenGods={handleForgottenGods}
                    forgottenGodsMessage={isInspectingCurrentTile ? forgottenGodsMessage : null}
                    eventNote={
                      // Issue #98: a Volcano's only content is a Volcanic Cave (#30), so it has
                      // nothing to roll -- but the hex says what's there rather than leaving the
                      // label inert. Shown for any inspected Volcano, current tile or not; an actual
                      // arrival note (issue #91's suppressed Event) wins on the tile you're on.
                      (isInspectingCurrentTile ? (arrivalNote ?? eventNote) : null) ??
                      (inspectedTile.location
                        ? LOCATION_EFFECT_NOTES[inspectedTile.location]
                        : null) ??
                      null
                    }
                    canEnterPortal={isInspectingCurrentTile && inspectedTile.location === "portal"}
                    portalEstablished={inspectedTile.portalTotal != null}
                    onEnterPortal={() => setPendingPortalConfirm(true)}
                  />
                </div>
              )
            )}
          </div>

          <p className={styles.scopeNote}>
            Click a neighboring hex to travel there. Click any other known hex to inspect it. Rocks
            can't be crossed; Water needs a hired boat first, and only lasts until you step onto dry
            land again.
          </p>
        </div>

        <aside className={styles.side}>
          <CharacterSheet
            character={character}
            torches={resources.torches}
            hp={resources.hp}
            maxHp={resources.maxHp}
            coins={resources.coins}
            treasures={resources.treasures}
            keys={resources.keys}
            provisions={resources.provisions}
            weaponName={resources.weapon?.name}
            weaponFormula={resources.weapon?.formula}
            spellUses={resources.spellUses}
            maxSpellUses={resources.maxSpellUses}
            monsterKills={resources.monsterKills}
            killsByName={resources.killsByName}
            hireling={resources.hireling}
            animals={resources.animals}
            mutations={resources.mutations}
            armLost={resources.armLost}
            advancedClasses={resources.advancedClasses}
            curiosities={resources.curiosities}
            canCastOutOfCombat
            onCastSpell={(table, spellRoll) =>
              onUpdateResources(castSpell(resources, table, spellRoll))
            }
          />
        </aside>
      </div>

      {/* Portals (issue #21) -- gated behind a confirmation because "when going through a portal
          there is no turning back," and one of the sixteen outcomes deletes the character outright. */}
      {pendingPortalConfirm && (
        <ConfirmDialog
          title="Step through the portal?"
          message={
            currentTile?.portalTotal != null
              ? "You have been through this portal before, and know where it comes out."
              : "There is no turning back, and no telling where you will come out — or whether you will come out at all."
          }
          confirmLabel="Step Through"
          cancelLabel="Stay"
          onConfirm={handleEnterPortal}
          onCancel={() => setPendingPortalConfirm(false)}
        />
      )}

      {portalOverlay}
      {realmOverlay}
      {locationOverlay}

      <Footer screenLabel="THE WORLD" onHardReset={onHardReset} />
    </div>
  );
}
