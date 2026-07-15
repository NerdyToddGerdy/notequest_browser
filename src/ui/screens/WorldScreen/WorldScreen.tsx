import type { CreatedCharacter } from "../../../data/types.ts";
import {
  CITY_OR_FORTRESS,
  isImpassable,
  locationHasDungeon,
  travelCost,
  type LocationKind,
  type Terrain,
} from "../../../data/hexTables.ts";
import { hexKey, hexNeighbors, type HexCoord, type HexTile, type WorldState } from "../../../engine/hexState.ts";
import { hexReducer } from "../../../engine/hexReducer.ts";
import { buyProvision, canBuyProvision, payTravelCost, type AdventurerResources } from "../../../engine/town.ts";
import { CharacterSheet } from "../../components/CharacterSheet/CharacterSheet.tsx";
import styles from "./WorldScreen.module.css";

export interface WorldScreenProps {
  character: CreatedCharacter;
  resources: AdventurerResources;
  world: WorldState;
  onUpdateResources: (resources: AdventurerResources) => void;
  onUpdateWorld: (world: WorldState) => void;
  onReturnToTown: () => void;
  onEnterDungeon: () => void;
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
  onUpdateResources,
  onUpdateWorld,
  onReturnToTown,
  onEnterDungeon,
}: WorldScreenProps) {
  const currentTile: HexTile | undefined = world.tiles[hexKey(world.player)];
  const neighborCoords = hexNeighbors(world.player);
  const canEnterDungeon = !!currentTile && locationHasDungeon(currentTile.location);
  const canBuyHere = !!currentTile && currentTile.location != null && CITY_OR_FORTRESS.has(currentTile.location);

  function handleTravel(coord: HexCoord) {
    const tile = world.tiles[hexKey(coord)];
    if (!tile || isImpassable(tile.terrain, tile.location)) return;
    onUpdateResources(payTravelCost(resources, travelCost(tile.terrain)));
    onUpdateWorld(hexReducer(world, { type: "MOVE", to: coord }));
    if (coord.q === world.home.q && coord.r === world.home.r) onReturnToTown();
  }

  const knownCoords: HexCoord[] = Object.keys(world.tiles).map((key) => {
    const [q, r] = key.split(",").map(Number);
    return { q: q!, r: r! };
  });
  const pixels = knownCoords.map((c) => ({ coord: c, pixel: axialToPixel(c) }));
  const minX = Math.min(...pixels.map((p) => p.pixel.x)) - HEX_SIZE;
  const maxX = Math.max(...pixels.map((p) => p.pixel.x)) + HEX_SIZE;
  const minY = Math.min(...pixels.map((p) => p.pixel.y)) - HEX_SIZE;
  const maxY = Math.max(...pixels.map((p) => p.pixel.y)) + HEX_SIZE;
  const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;

  return (
    <div className={styles.page}>
      <header className={styles.wordmark}>
        <h1>NoteQuest</h1>
        <p className={styles.tagline}>The world beyond the city walls.</p>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <div className={styles.mapCard}>
            <svg className={styles.mapSvg} viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
              {pixels.map(({ coord, pixel }) => {
                const tile = world.tiles[hexKey(coord)]!;
                const isPlayer = coord.q === world.player.q && coord.r === world.player.r;
                const isNeighbor = neighborCoords.some((n) => n.q === coord.q && n.r === coord.r);
                const passable = !isImpassable(tile.terrain, tile.location);
                const clickable = isNeighbor && passable;
                const label = tile.location ? LOCATION_LABEL[tile.location] : "";
                return (
                  <g
                    key={hexKey(coord)}
                    className={clickable ? styles.clickableHex : undefined}
                    onClick={clickable ? () => handleTravel(coord) : undefined}
                  >
                    <polygon
                      points={hexPolygonPoints(pixel, HEX_SIZE - 2)}
                      fill={TERRAIN_FILL[tile.terrain]}
                      stroke={isPlayer ? "var(--gold-bright)" : "rgba(0,0,0,0.4)"}
                      strokeWidth={isPlayer ? 4 : 1.5}
                    />
                    {label && (
                      <text x={pixel.x} y={pixel.y + 4} textAnchor="middle" className={styles.hexLabel}>
                        {label}
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
          </div>

          {canEnterDungeon && currentTile?.location && (
            <div className={styles.actionCard}>
              <p className={styles.gateCopy}>{LOCATION_LABEL[currentTile.location]}: a dungeon awaits here.</p>
              <button className={styles.rollBtn} type="button" onClick={onEnterDungeon}>
                Enter Dungeon
              </button>
            </div>
          )}

          <p className={styles.scopeNote}>
            Click a lit, neighboring hex to travel there. Water and Rocks can't be crossed yet --
            boats are a City action for another day.
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
          />

          {canBuyHere && (
            <div className={styles.buyCard}>
              <button
                className={styles.ghostBtn}
                type="button"
                disabled={!canBuyProvision(resources)}
                onClick={() => onUpdateResources(buyProvision(resources))}
              >
                Buy Provisions (1 coin)
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
