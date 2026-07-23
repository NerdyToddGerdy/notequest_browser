import { useMemo, useRef, useState } from "react";
import type { CreatedCharacter } from "../../../data/types.ts";
import {
  CITY_OR_FORTRESS,
  hasWaterWalk,
  isFortressLocation,
  isImpassable,
  locationHasDungeon,
  travelCost,
  travelCostMultiplier,
  type LocationKind,
  type Terrain,
} from "../../../data/hexTables.ts";
import { hasAffinity, CULTURE_BY_LOCATION, type CityCulture } from "../../../data/affinity.ts";
import {
  countMatchingNeighbors,
  hexKey,
  hexNeighbors,
  isBannedHex,
  qualifiesForBuyingMount,
  qualifiesForTraining,
  withBannedHex,
  type HexCoord,
  type HexTile,
  type WorldState,
} from "../../../engine/hexState.ts";
import { hexReducer } from "../../../engine/hexReducer.ts";
import { hasUnlootedRemains, isDungeonBeaten, type PendingDungeon } from "../../../engine/dungeonState.ts";
import type { TownDeathCause } from "../../../engine/graveyard.ts";
import { ANIMAL_BY_NAME, MOUNT_TABLE } from "../../../data/animals.ts";
import { animalTravelCostOverride, animalTravelCostPenalty, buyMount, trainAnimal } from "../../../engine/animals.ts";
import {
  canHireBoat,
  castSpell,
  hasElvenBoots,
  hireBoat,
  payTravelCost,
  recordTravelStats,
  resolveThugLife,
  type AdventurerResources,
} from "../../../engine/town.ts";
import { CharacterSheet } from "../../components/CharacterSheet/CharacterSheet.tsx";
import { HexInspector } from "../../components/HexInspector/HexInspector.tsx";
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
  onEnterDungeon: () => void;
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
};

/** Only City/Fortress/Ruins/Rocks are interactive in this pass -- everything else (Portal/Oasis/
 * Volcano/Reef/Thin Ice/"nothing") renders as an inert flavor label, see CLAUDE.md's Hexploring
 * the World note. */
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
};

export function WorldScreen({
  character,
  resources,
  world,
  dungeonHistory,
  onUpdateResources,
  onUpdateWorld,
  onEnterDungeon,
  onCharacterDied,
  onHardReset,
}: WorldScreenProps) {
  /** True while voluntarily looking at the map from within a City/Fortress hex (via TownScreen's
   * "Explore the World") -- reset to false on every arrival, so landing anywhere shows "the
   * appropriate thing" (the city screen if it's a City/Fortress, the map otherwise) by default. */
  const [showMap, setShowMap] = useState(false);
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
  /** Null = today's auto-fit-everything behavior; set the instant the player zooms or drag-pans,
   * same "override until Reset View" shape DungeonMap's own `scale` state uses. */
  const [viewBoxOverride, setViewBoxOverride] = useState<ViewBox | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragOrigin = useRef<{ clientX: number; clientY: number; base: ViewBox; inverse: DOMMatrix } | null>(null);
  /** Mirrors DungeonMap's own ref: true once a pointer-down has moved past the click-vs-drag
   * threshold, checked (and reset) by the capturing click handler below so a drag-to-pan doesn't
   * also select whatever hex the pointer happened to release over. */
  const didDrag = useRef(false);
  const currentTile: HexTile | undefined = world.tiles[hexKey(world.player)];
  const neighborCoords = hexNeighbors(world.player);
  const inCityOrFortress = !!currentTile && currentTile.location != null && CITY_OR_FORTRESS.has(currentTile.location);
  /** "none" hexes never had a dungeonRunId/dungeonMarked stamped; otherwise a shared lookup for
   * both the gate copy (current hex only) and the per-hex map badges (every known hex) below.
   * "found" is a hex "Ask" has flagged (dungeonMarked) but the player has never actually stepped
   * onto -- "draw the dungeon on the map" happens at Ask time, not first entry, so there's nothing
   * "unfinished" about it yet. "unfinished" itself covers dungeonRunId being set (Enter Dungeon has
   * actually been used here) even before a PendingDungeon exists in dungeonHistory (which only
   * catches up once the player first leaves). */
  function dungeonInfoFor(tile: HexTile | undefined): {
    status: "none" | "found" | "unfinished" | "beaten";
    hasRemains: boolean;
  } {
    if (tile?.dungeonRunId) {
      const pending = dungeonHistory.find((pd) => pd.id === tile.dungeonRunId);
      if (pending) {
        return {
          status: isDungeonBeaten(pending.dungeon) ? "beaten" : "unfinished",
          hasRemains: hasUnlootedRemains(pending.dungeon),
        };
      }
      return { status: "unfinished", hasRemains: false };
    }
    if (tile?.dungeonMarked) return { status: "found", hasRemains: false };
    return { status: "none", hasRemains: false };
  }
  const currentDungeonStatus = dungeonInfoFor(currentTile).status;
  // Nothing left to do in an already-beaten dungeon -- RETURN_TO_DUNGEON/RESUME_DUNGEON would just
  // redisplay the existing victory panel, not let the Boss be re-fought or re-looted. A hex "Ask"
  // marked (dungeonMarked) offers the same button as a City/Fortress/Ruins hex does, even though it
  // has no location of its own -- see HexTile.dungeonMarked.
  const canEnterDungeon =
    !!currentTile &&
    (locationHasDungeon(currentTile.location) || !!currentTile.dungeonMarked) &&
    currentDungeonStatus !== "beaten";
  const dungeonGateCopy =
    currentDungeonStatus === "beaten"
      ? "the dungeon here has already been cleared."
      : currentDungeonStatus === "unfinished"
        ? "your unfinished dungeon is still here."
        : "a dungeon awaits here.";
  const culture: CityCulture | null =
    (currentTile?.location && CULTURE_BY_LOCATION[currentTile.location]) || null;
  const besideWater = neighborCoords.some((n) => world.tiles[hexKey(n)]?.terrain === "water");
  /** Animals (issue #26): both "train in the wild" and "buy a mount in a city" require the
   * *current* hex's own terrain to have at least 2 matching neighbors -- computed once and reused
   * by both qualification checks below. */
  const currentMatchingNeighbors = currentTile
    ? countMatchingNeighbors(world.tiles, world.player, currentTile.terrain)
    : 0;
  const trainableAnimals = currentTile
    ? Object.values(ANIMAL_BY_NAME).filter((a) =>
        qualifiesForTraining(currentTile, currentMatchingNeighbors, a),
      )
    : [];
  const buyableMounts = currentTile
    ? Object.values(MOUNT_TABLE).filter((m) =>
        qualifiesForBuyingMount(currentTile, currentMatchingNeighbors, m),
      )
    : [];
  const isFortress = isFortressLocation(currentTile?.location ?? null);
  // Prefers the hex's own generated name (issue #49, City/Fortress only -- see HexTile.name) over
  // the generic type label wherever one exists; falls back to the type label for a Ruins/other
  // location with no name of its own, or "the wilds" for a bare plain hex with no location at all.
  const currentPlaceLabel =
    currentTile?.name ?? (currentTile?.location ? LOCATION_LABEL[currentTile.location] : "the wilds");
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
      !isImpassable(tile.terrain, tile.location, world.hasBoat || hasWaterWalk(character.race.name)) &&
      hasAffinity(character.race.name, tile.location) &&
      !isBannedHex(world, coord)
    );
  }

  function handleTravel(coord: HexCoord) {
    const tile = world.tiles[hexKey(coord)];
    if (!tile || !canTravelTo(tile, coord)) return;
    // Elven Boots: "you can only spend 1 provision to move through forests." Combined with any
    // owned Animal/Mount's own per-terrain cap (issue #26) -- Griffin's unconditional "1 for any
    // land" always wins (checked first inside animalTravelCostOverride), otherwise the cheapest
    // applicable override wins.
    const elvenBootsOverride = tile.terrain === "forest" && hasElvenBoots(resources) ? 1 : null;
    const animalOverride = animalTravelCostOverride(resources.animals, tile.terrain);
    const overrides = [elvenBootsOverride, animalOverride].filter((v): v is number => v != null);
    const baseCost = overrides.length > 0 ? Math.min(...overrides) : travelCost(tile.terrain);
    // Mammoth: "you spend 1 extra provision per hex" -- a penalty, not a discount, so it's added on
    // top of whatever override/base cost above rather than competing with them.
    const withMammothPenalty = baseCost + animalTravelCostPenalty(resources.animals);
    // Pandakhan (2x)/Centaur (0.5x, rounded up so a move is never free) -- layered on top of the
    // base cost the same way Elven Boots' forest override already is.
    const cost = Math.max(1, Math.ceil(withMammothPenalty * travelCostMultiplier(character.race.name)));
    const afterCost = payTravelCost(resources, cost, !!resources.hireling);
    // Advanced Classes (issue #72): Lumberjack/Druid/Survivor/Pirate/Bard's lifetime travel
    // counters, describing whichever hex is actually being arrived at. `wasSailing` reads
    // `world.hasBoat` *before* MOVE potentially clears it (hexReducer.ts drops the boat the
    // instant the player lands on non-water terrain) -- true only while sailing onto more water.
    const isCity = tile.location != null && CITY_OR_FORTRESS.has(tile.location);
    onUpdateResources(
      recordTravelStats(afterCost, tile.terrain, isCity, hexKey(coord), world.hasBoat),
    );
    onUpdateWorld(hexReducer(world, { type: "MOVE", to: coord, raceName: character.race.name }));
    setShowMap(false);
    setSelectedHex(null); // describe the new current tile by default, not wherever was last inspected
    setTrainResultMessage(null);
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

  /** "You can buy mounts in a city that is on the appropriate terrain" -- always succeeds if
   * affordable, no roll involved, unlike training. */
  function handleBuyMount(name: string) {
    const mount = MOUNT_TABLE[name];
    if (!mount || !currentTile) return;
    if (!qualifiesForBuyingMount(currentTile, currentMatchingNeighbors, mount)) return;
    onUpdateResources(buyMount(resources, mount));
  }

  const inspectedCoord = selectedHex ?? world.player;
  const inspectedTile: HexTile | undefined = world.tiles[hexKey(inspectedCoord)];
  const isInspectingCurrentTile = inspectedCoord.q === world.player.q && inspectedCoord.r === world.player.r;
  const inspectedNoAffinity = !!inspectedTile && !hasAffinity(character.race.name, inspectedTile.location);
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
  // useZoomGesture below is a hook and must run every render, including while showMap is false and
  // TownScreen is what actually renders -- the resulting values are simply unused in that case.
  const knownCoords: HexCoord[] = useMemo(
    () =>
      Object.keys(world.tiles).map((key) => {
        const [q, r] = key.split(",").map(Number);
        return { q: q!, r: r! };
      }),
    [world.tiles],
  );
  const pixels = useMemo(() => knownCoords.map((c) => ({ coord: c, pixel: axialToPixel(c) })), [knownCoords]);
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
    dragOrigin.current = { clientX: e.clientX, clientY: e.clientY, base: baseViewBox, inverse: ctm.inverse() };
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
    setViewBoxOverride({ x: origin.base.x - deltaX, y: origin.base.y - deltaY, w: origin.base.w, h: origin.base.h });
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

  if (inCityOrFortress && !showMap) {
    return (
      <TownScreen
        character={character}
        resources={resources}
        // canEnterDungeon, not "already has a known dungeonRunId" -- a hex the player has never
        // entered a dungeon on yet still offers a fresh roll, same as the old Ruins card always did.
        hasDungeon={canEnterDungeon}
        dungeonGateCopy={dungeonGateCopy}
        dungeonHistory={dungeonHistory}
        culture={culture}
        cityName={currentPlaceLabel}
        showHireBoat={besideWater}
        askedDungeonKnown={askedDungeonKnown}
        isFortress={isFortress}
        buyableMounts={buyableMounts}
        onUpdateResources={onUpdateResources}
        onEnterDungeon={onEnterDungeon}
        onHireBoat={handleHireBoat}
        onBuyMount={handleBuyMount}
        onAsk={handleAsk}
        onThugLife={handleThugLife}
        onCharacterDied={(cause) => onCharacterDied(cause, currentPlaceLabel)}
        onExploreWorld={() => setShowMap(true)}
        onHardReset={onHardReset}
      />
    );
  }

  const viewBox = `${baseViewBox.x} ${baseViewBox.y} ${baseViewBox.w} ${baseViewBox.h}`;

  return (
    <div className={styles.page}>
      <header className={styles.wordmark}>
        <h1>NoteQuest</h1>
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
                const isSelected = !isPlayer && selectedHex != null && coord.q === selectedHex.q && coord.r === selectedHex.r;
                const label = tile.name ?? (tile.location ? LOCATION_LABEL[tile.location] : "");
                const { status: dungeonStatus, hasRemains } = dungeonInfoFor(tile);
                return (
                  <g key={hexKey(coord)} className={styles.clickableHex} onClick={() => handleHexClick(coord)}>
                    <polygon
                      points={hexPolygonPoints(pixel, HEX_SIZE - 2)}
                      fill={TERRAIN_FILL[tile.terrain]}
                      stroke={isPlayer ? "var(--gold-bright)" : isSelected ? "var(--gold)" : "rgba(0,0,0,0.4)"}
                      strokeWidth={isPlayer || isSelected ? 4 : 1.5}
                    />
                    {label && (
                      <text x={pixel.x} y={pixel.y + 4} textAnchor="middle" className={styles.hexLabel}>
                        {label}
                      </text>
                    )}
                    {dungeonStatus !== "none" && (
                      <text
                        x={pixel.x + 17}
                        y={pixel.y - 18}
                        textAnchor="middle"
                        className={dungeonStatus === "beaten" ? styles.dungeonBadgeCleared : styles.dungeonBadgeUnfinished}
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
                      <text x={pixel.x - 17} y={pixel.y - 18} textAnchor="middle" className={styles.remainsBadge}>
                        <title>A fallen adventurer&apos;s remains are still here, unrecovered</title>
                        💀
                      </text>
                    )}
                    {isPlayer && (
                      <text x={pixel.x} y={pixel.y - 14} textAnchor="middle" className={styles.playerLabel}>
                        You
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {viewBoxOverride && (
              <button type="button" className={styles.resetViewBtn} onClick={() => setViewBoxOverride(null)}>
                Reset View
              </button>
            )}

            {inspectedTile && (
              <div className={styles.hexInspectorOverlay}>
                <HexInspector
                  terrain={inspectedTile.terrain}
                  locationLabel={inspectedTile.location ? LOCATION_LABEL[inspectedTile.location] : ""}
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
                  onEnterDungeon={onEnterDungeon}
                  trainableAnimals={isInspectingCurrentTile ? trainableAnimals : []}
                  resources={resources}
                  onTrainAnimal={handleTrainAnimal}
                  trainResultMessage={trainResultMessage}
                />
              </div>
            )}
          </div>

          {inCityOrFortress && (
            <div className={styles.actionCard}>
              <p className={styles.gateCopy}>You're viewing the map from within the city.</p>
              <button className={styles.rollBtn} type="button" onClick={() => setShowMap(false)}>
                Return to the City
              </button>
            </div>
          )}

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
            canCastOutOfCombat
            onCastSpell={(table, spellRoll) => onUpdateResources(castSpell(resources, table, spellRoll))}
          />
        </aside>
      </div>

      <Footer screenLabel="THE WORLD" onHardReset={onHardReset} />
    </div>
  );
}
