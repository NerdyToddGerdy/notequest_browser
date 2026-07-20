import { useMemo, useRef, useState } from "react";
import type { CreatedCharacter } from "../../../data/types.ts";
import {
  CITY_OR_FORTRESS,
  isImpassable,
  locationHasDungeon,
  travelCost,
  type LocationKind,
  type Terrain,
} from "../../../data/hexTables.ts";
import { hasAffinity, CULTURE_BY_LOCATION, type CityCulture } from "../../../data/affinity.ts";
import { hexKey, hexNeighbors, type HexCoord, type HexTile, type WorldState } from "../../../engine/hexState.ts";
import { hexReducer } from "../../../engine/hexReducer.ts";
import { hasUnlootedRemains, isDungeonBeaten, type PendingDungeon } from "../../../engine/dungeonState.ts";
import {
  canHireBoat,
  castSpell,
  hasElvenBoots,
  hireBoat,
  payTravelCost,
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
  /** "none" hexes never had a dungeonRunId stamped; otherwise a shared lookup for both the gate
   * copy (current hex only) and the per-hex map badges (every known hex) below. */
  function dungeonInfoFor(tile: HexTile | undefined): {
    status: "none" | "unfinished" | "beaten";
    hasRemains: boolean;
  } {
    if (!tile?.dungeonRunId) return { status: "none", hasRemains: false };
    const pending = dungeonHistory.find((pd) => pd.id === tile.dungeonRunId);
    if (!pending) return { status: "none", hasRemains: false };
    return {
      status: isDungeonBeaten(pending.dungeon) ? "beaten" : "unfinished",
      hasRemains: hasUnlootedRemains(pending.dungeon),
    };
  }
  const currentDungeonStatus = dungeonInfoFor(currentTile).status;
  // Nothing left to do in an already-beaten dungeon -- RETURN_TO_DUNGEON/RESUME_DUNGEON would just
  // redisplay the existing victory panel, not let the Boss be re-fought or re-looted.
  const canEnterDungeon =
    !!currentTile && locationHasDungeon(currentTile.location) && currentDungeonStatus !== "beaten";
  const dungeonGateCopy =
    currentDungeonStatus === "beaten"
      ? "the dungeon here has already been cleared."
      : currentDungeonStatus === "unfinished"
        ? "your unfinished dungeon is still here."
        : "a dungeon awaits here.";
  const culture: CityCulture | null =
    (currentTile?.location && CULTURE_BY_LOCATION[currentTile.location]) || null;
  const besideWater = neighborCoords.some((n) => world.tiles[hexKey(n)]?.terrain === "water");

  /** A hex is travelable if it's passable (respecting a hired boat on water) *and* the character's
   * race has Affinity for whatever City/Fortress culture is there (non-city hexes are always
   * `true` for the latter -- see `hasAffinity()`). */
  function canTravelTo(tile: HexTile): boolean {
    return !isImpassable(tile.terrain, tile.location, world.hasBoat) && hasAffinity(character.race.name, tile.location);
  }

  function handleTravel(coord: HexCoord) {
    const tile = world.tiles[hexKey(coord)];
    if (!tile || !canTravelTo(tile)) return;
    // Elven Boots: "you can only spend 1 provision to move through forests."
    const cost = tile.terrain === "forest" && hasElvenBoots(resources) ? 1 : travelCost(tile.terrain);
    onUpdateResources(payTravelCost(resources, cost));
    onUpdateWorld(hexReducer(world, { type: "MOVE", to: coord, raceName: character.race.name }));
    setShowMap(false);
    setSelectedHex(null); // describe the new current tile by default, not wherever was last inspected
  }

  const inspectedCoord = selectedHex ?? world.player;
  const inspectedTile: HexTile | undefined = world.tiles[hexKey(inspectedCoord)];
  const isInspectingCurrentTile = inspectedCoord.q === world.player.q && inspectedCoord.r === world.player.r;
  const inspectedNoAffinity = !!inspectedTile && !hasAffinity(character.race.name, inspectedTile.location);

  /** Clicking a passable, in-range neighbor travels immediately; anything else (out of range,
   * impassable, no Affinity, or the player's own tile) just selects it for HexInspector to
   * describe. */
  function handleHexClick(coord: HexCoord) {
    const tile = world.tiles[hexKey(coord)];
    const isNeighbor = neighborCoords.some((n) => n.q === coord.q && n.r === coord.r);
    if (tile && isNeighbor && canTravelTo(tile)) {
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
        showHireBoat={besideWater}
        onUpdateResources={onUpdateResources}
        onEnterDungeon={onEnterDungeon}
        onHireBoat={handleHireBoat}
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
                const label = tile.location ? LOCATION_LABEL[tile.location] : "";
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
                        <title>{dungeonStatus === "beaten" ? "Dungeon cleared" : "Unfinished dungeon"}</title>
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
                  dungeonStatus={dungeonInfoFor(inspectedTile).status}
                  hasRemains={dungeonInfoFor(inspectedTile).hasRemains}
                  isCurrentTile={isInspectingCurrentTile}
                  noAffinity={inspectedNoAffinity}
                />
              </div>
            )}
          </div>

          {/* City/Fortress hexes handle their own "Enter Dungeon" via TownScreen -- this card is
           * only for a dungeon-bearing hex reached without a city on it (Ruins) or while
           * voluntarily viewing the map from inside a city (see "Return to the City" below). */}
          {canEnterDungeon && !inCityOrFortress && currentTile?.location && (
            <div className={styles.actionCard}>
              <p className={styles.gateCopy}>
                {LOCATION_LABEL[currentTile.location]}: {dungeonGateCopy}
              </p>
              <button className={styles.rollBtn} type="button" onClick={onEnterDungeon}>
                Enter Dungeon
              </button>
            </div>
          )}

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
            coins={resources.coins}
            treasures={resources.treasures}
            keys={resources.keys}
            provisions={resources.provisions}
            weaponName={resources.weapon?.name}
            weaponFormula={resources.weapon?.formula}
            spellUses={resources.spellUses}
            monsterKills={resources.monsterKills}
            killsByName={resources.killsByName}
            canCastOutOfCombat
            onCastSpell={(spellRoll) => onUpdateResources(castSpell(resources, spellRoll))}
          />
        </aside>
      </div>

      <Footer screenLabel="THE WORLD" onHardReset={onHardReset} />
    </div>
  );
}
