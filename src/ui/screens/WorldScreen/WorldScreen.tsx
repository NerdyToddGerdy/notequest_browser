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
import { computeSpellUses } from "../../../engine/character.ts";
import { hasUnlootedRemains, isDungeonBeaten, type PendingDungeon } from "../../../engine/dungeonState.ts";
import {
  buyProvision,
  buyTorch,
  canBuyProvision,
  canBuyTorch,
  canRest,
  fixArmor,
  payTravelCost,
  rest,
  sellItem,
  type AdventurerResources,
} from "../../../engine/town.ts";
import { CharacterSheet } from "../../components/CharacterSheet/CharacterSheet.tsx";
import { Equipment } from "../../components/Equipment/Equipment.tsx";
import { Pack } from "../../components/Pack/Pack.tsx";
import styles from "./WorldScreen.module.css";

export interface WorldScreenProps {
  character: CreatedCharacter;
  resources: AdventurerResources;
  world: WorldState;
  /** Every touched run, including the current character's own active one -- unlike Town's own prop,
   * this is used for a lookup (is the current hex's dungeon beaten?), not rendered as a list, so it
   * deliberately isn't filtered down. */
  dungeonHistory: PendingDungeon[];
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
  dungeonHistory,
  onUpdateResources,
  onUpdateWorld,
  onReturnToTown,
  onEnterDungeon,
}: WorldScreenProps) {
  const currentTile: HexTile | undefined = world.tiles[hexKey(world.player)];
  const neighborCoords = hexNeighbors(world.player);
  const canEnterDungeon = !!currentTile && locationHasDungeon(currentTile.location);
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
  const dungeonGateCopy =
    currentDungeonStatus === "beaten"
      ? "the dungeon here has already been cleared."
      : currentDungeonStatus === "unfinished"
        ? "your unfinished dungeon is still here."
        : "a dungeon awaits here.";
  const maxSpellUses = computeSpellUses(character.spells, character.fixedGrants);
  const isCatPerson = character.race.name === "Cat-Person";
  const isBlacksmith = character.cls.name === "Blacksmith";

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
                const { status: dungeonStatus, hasRemains } = dungeonInfoFor(tile);
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
          </div>

          {canEnterDungeon && currentTile?.location && (
            <div className={styles.actionCard}>
              <p className={styles.gateCopy}>
                {LOCATION_LABEL[currentTile.location]}: {dungeonGateCopy}
              </p>
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

          {inCityOrFortress && (
            <>
              <div className={styles.actionCard}>
                <h2 className={styles.trackTitle}>City Actions</h2>
                <div className={styles.actionGrid}>
                  <button
                    className={styles.actionBtn}
                    type="button"
                    disabled={!canRest(resources)}
                    onClick={() => onUpdateResources(rest(resources, maxSpellUses))}
                  >
                    <span className={styles.actionName}>Rest</span>
                    <span className={styles.actionCost}>1 coin</span>
                    <span className={styles.actionDesc}>Recover your HP and spent spells.</span>
                  </button>
                  <button
                    className={styles.actionBtn}
                    type="button"
                    disabled={!canBuyTorch(resources)}
                    onClick={() => onUpdateResources(buyTorch(resources))}
                  >
                    <span className={styles.actionName}>Buy Torches</span>
                    <span className={styles.actionCost}>1 coin</span>
                    <span className={styles.actionDesc}>+1 torch, up to a maximum of 10 carried.</span>
                  </button>
                  <button
                    className={styles.actionBtn}
                    type="button"
                    disabled={!canBuyProvision(resources)}
                    onClick={() => onUpdateResources(buyProvision(resources))}
                  >
                    <span className={styles.actionName}>Buy Provisions</span>
                    <span className={styles.actionCost}>1 coin</span>
                    <span className={styles.actionDesc}>+1 provision, up to a maximum of 20 carried.</span>
                  </button>
                </div>
                <p className={styles.sellNote}>
                  Sell items from your Pack for their listed worth in coins
                  {isCatPerson ? " (doubled, Cat-Person)" : ""}, or fix a damaged armor piece from your
                  Equipment, for {isBlacksmith ? "1 torch (Blacksmith)" : "1 coin"}.
                </p>
              </div>
              <Equipment
                armor={resources.armor}
                weapon={resources.weapon}
                onFixArmor={(index) => onUpdateResources(fixArmor(resources, index, isBlacksmith))}
                isBlacksmith={isBlacksmith}
              />
              <Pack
                items={resources.heldItems}
                onSell={(index) => onUpdateResources(sellItem(resources, index, isCatPerson))}
              />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
