import { useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { hasAffinity } from "../../../data/affinity.ts";
import { TERRAIN_LABEL } from "../../../data/hexTables.ts";
import {
  hexKey,
  politicalStatusFor,
  type HexCoord,
  type HexTile,
  type WorldState,
} from "../../../engine/hexState.ts";
import { useZoomGesture } from "../../hooks/useZoomGesture.ts";
import { isArrowKey, nextCellInDirection } from "../../mapKeyboard.ts";
import {
  axialToPixel,
  clamp,
  HEX_SIZE,
  hexAriaLabel,
  hexPolygonPoints,
  LOCATION_LABEL,
  TERRAIN_FILL,
  type ViewBox,
} from "./hexGeometry.ts";
import styles from "./HexMap.module.css";

export interface HexMapProps {
  world: WorldState;
  raceName: string;
  selectedHex: HexCoord | null;
  neighborCoords: HexCoord[];
  canTravelTo: (tile: HexTile, coord: HexCoord) => boolean;
  dungeonInfoFor: (tile: HexTile | undefined) => {
    status: "none" | "found" | "unfinished" | "beaten";
    hasRemains: boolean;
  };
  onHexClick: (coord: HexCoord) => void;
  /** Zoom/pan and the keyboard tab stop are owned by `WorldScreen`, not here: visiting the Town
   * Square unmounts the map, and both have always survived that. */
  viewBoxOverride: ViewBox | null;
  onViewBoxOverrideChange: Dispatch<SetStateAction<ViewBox | null>>;
  focusKey: string | null;
  onFocusKeyChange: (key: string) => void;
}

/**
 * The World's hex map: drawing every known hex with its badges, wheel/pinch zoom, drag-to-pan, and
 * keyboard play. Split out of `WorldScreen.tsx` (issue #144) unchanged -- what a click on a hex
 * *does* is still decided by the screen, through `onHexClick`.
 */
export function HexMap({
  world,
  raceName,
  selectedHex,
  neighborCoords,
  canTravelTo,
  dungeonInfoFor,
  onHexClick,
  viewBoxOverride,
  onViewBoxOverrideChange,
  focusKey,
  onFocusKeyChange,
}: HexMapProps) {
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

  // Keyboard play (issue #143): the map is one tab stop, not one per hex -- tabbing through every
  // known hex would be unusable. The stop starts on the player, the arrow keys move it to the
  // nearest hex in that direction (moving focus only, never acting), and Enter/Space does exactly
  // what a click does. `focusKey` falls back to the player's hex whenever it points at nothing.
  const hexRefs = useRef(new Map<string, SVGGElement>());
  const mapCells = useMemo(
    () => pixels.map(({ coord, pixel }) => ({ key: hexKey(coord), x: pixel.x, y: pixel.y })),
    [pixels],
  );
  const tabStopKey =
    focusKey && mapCells.some((c) => c.key === focusKey) ? focusKey : hexKey(world.player);

  function handleHexKeyDown(e: React.KeyboardEvent<SVGGElement>, coord: HexCoord) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onHexClick(coord);
      return;
    }
    if (!isArrowKey(e.key)) return;
    e.preventDefault();
    const next = nextCellInDirection(mapCells, hexKey(coord), e.key);
    if (!next) return;
    onFocusKeyChange(next);
    hexRefs.current.get(next)?.focus();
  }
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
    onViewBoxOverrideChange((prev) => {
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
    onViewBoxOverrideChange({
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

  const viewBox = `${baseViewBox.x} ${baseViewBox.y} ${baseViewBox.w} ${baseViewBox.h}`;

  return (
    <>
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
          const noAffinityHere = !hasAffinity(raceName, tile.location);
          const key = hexKey(coord);
          const canTravelHere =
            neighborCoords.some((n) => n.q === coord.q && n.r === coord.r) &&
            canTravelTo(tile, coord);
          return (
            <g
              key={key}
              ref={(el) => {
                if (el) hexRefs.current.set(key, el);
                else hexRefs.current.delete(key);
              }}
              className={styles.clickableHex}
              role="button"
              tabIndex={key === tabStopKey ? 0 : -1}
              aria-label={hexAriaLabel({
                title: label || TERRAIN_LABEL[tile.terrain],
                terrain: label ? TERRAIN_LABEL[tile.terrain] : null,
                isPlayer,
                canTravelHere,
                dungeonStatus,
                noAffinityHere,
              })}
              onClick={() => onHexClick(coord)}
              onKeyDown={(e) => handleHexKeyDown(e, coord)}
              onFocus={() => onFocusKeyChange(key)}
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
                strokeDasharray={noAffinityHere && !isPlayer && !isSelected ? "4 2" : undefined}
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
                  <title>A fallen adventurer&apos;s remains are still here, unrecovered</title>
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
                    {political === "ally" ? "Allied" : political === "vassal" ? "Vassal" : "Enemy"}
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
          onClick={() => onViewBoxOverrideChange(null)}
        >
          Reset View
        </button>
      )}
    </>
  );
}
