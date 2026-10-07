/**
 * The World map's geometry, colors and labels -- shared by `HexMap`, which draws it, and
 * `WorldScreen`, which names locations in its own panels. Split out of `WorldScreen.tsx` (#144).
 */
import type { LocationKind, Terrain } from "../../../data/hexTables.ts";
import type { HexCoord } from "../../../engine/hexState.ts";

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const HEX_SIZE = 44;

export function axialToPixel(c: HexCoord): { x: number; y: number } {
  return {
    x: HEX_SIZE * (Math.sqrt(3) * c.q + (Math.sqrt(3) / 2) * c.r),
    y: HEX_SIZE * (1.5 * c.r),
  };
}

export function hexPolygonPoints(center: { x: number; y: number }, size: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30); // pointy-top
    points.push(`${center.x + size * Math.cos(angle)},${center.y + size * Math.sin(angle)}`);
  }
  return points.join(" ");
}

export const TERRAIN_FILL: Record<Terrain, string> = {
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
export const LOCATION_LABEL: Record<LocationKind, string> = {
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

/** What a screen reader hears for one map hex (issue #143) -- the same facts the badges and outline
 * show sighted players, plus what Enter will do. */
export function hexAriaLabel(hex: {
  title: string;
  terrain: string | null;
  isPlayer: boolean;
  canTravelHere: boolean;
  dungeonStatus: string;
  noAffinityHere: boolean;
}): string {
  const parts = [hex.terrain ? `${hex.title}, ${hex.terrain}` : hex.title];
  if (hex.isPlayer) parts.push("you are here");
  if (hex.dungeonStatus === "beaten") parts.push("dungeon cleared");
  else if (hex.dungeonStatus !== "none") parts.push("dungeon");
  if (hex.noAffinityHere) parts.push("your race is not welcome");
  parts.push(hex.canTravelHere ? "press Enter to travel here" : "press Enter to inspect");
  return parts.join(", ");
}
