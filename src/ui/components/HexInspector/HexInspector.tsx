import type { Terrain } from "../../../data/hexTables.ts";
import styles from "./HexInspector.module.css";

export interface HexInspectorProps {
  terrain: Terrain;
  /** Already resolved via WorldScreen's LOCATION_LABEL, empty string if the hex has no location. */
  locationLabel: string;
  /** The hex's own generated name (issue #49, `HexTile.name`) -- City/Fortress only, undefined for
   * everything else (Ruins, a bare terrain hex, or a pre-#49 persisted hex with none rolled). Takes
   * over as the panel's headline in place of `locationLabel`/`TERRAIN_LABEL`, which still show below
   * in the Location/Terrain rows regardless. */
  cityName?: string;
  dungeonStatus: "none" | "found" | "unfinished" | "beaten";
  hasRemains: boolean;
  isCurrentTile: boolean;
  /** True when this is a City/Fortress hex the player's race has no Affinity for -- explains why a
   * neighboring hex like this can't be traveled to (see `hasAffinity()`, `data/affinity.ts`). */
  noAffinity: boolean;
  /** True when a failed Thug Life escape has permanently barred this hex -- explains why a
   * neighboring hex like this can't be traveled to, the same way `noAffinity` does (see
   * `WorldState.bannedHexes`). */
  banned: boolean;
}

const TERRAIN_LABEL: Record<Terrain, string> = {
  plain: "Plain",
  mountain: "Mountain",
  forest: "Forest",
  swamp: "Swamp",
  desert: "Desert",
  water: "Water",
  glacier: "Glacier",
  tundra: "Tundra",
};

const DUNGEON_STATUS_COPY: Record<HexInspectorProps["dungeonStatus"], string> = {
  none: "No dungeon found here yet.",
  found: "A dungeon has been found nearby -- not yet explored.",
  unfinished: "An unfinished dungeon is here.",
  beaten: "The dungeon here has already been cleared.",
};

/** Bottom-right overlay describing whichever hex is currently selected on the map, mirroring
 * RoomInspector's role/positioning for the dungeon map. Purely presentational -- WorldScreen
 * resolves all of this from its own currentTile/dungeonInfoFor() logic. Read-only: clicking a
 * passable neighbor hex on the map travels there directly, so there's no separate travel action
 * here to gate. */
export function HexInspector({
  terrain,
  locationLabel,
  cityName,
  dungeonStatus,
  hasRemains,
  isCurrentTile,
  noAffinity,
  banned,
}: HexInspectorProps) {
  return (
    <div className={styles.panel}>
      <p className={styles.title}>{cityName || locationLabel || TERRAIN_LABEL[terrain]}</p>
      {isCurrentTile && <p className={styles.flavor}>You are here.</p>}

      <div className={styles.row}>
        <span className={styles.label}>Terrain</span>
        <p>{TERRAIN_LABEL[terrain]}</p>
      </div>

      {locationLabel && (
        <div className={styles.row}>
          <span className={styles.label}>Location</span>
          <p>{locationLabel}</p>
        </div>
      )}

      {noAffinity && (
        <div className={styles.row}>
          <span className={styles.label}>Affinity</span>
          <p>You are not welcome here.</p>
        </div>
      )}

      {banned && (
        <div className={styles.row}>
          <span className={styles.label}>Banned</span>
          <p>You fled the guards here and can never return.</p>
        </div>
      )}

      <div className={styles.row}>
        <span className={styles.label}>Dungeon</span>
        <p>{DUNGEON_STATUS_COPY[dungeonStatus]}</p>
      </div>

      {hasRemains && (
        <div className={styles.row}>
          <span className={styles.label}>Remains</span>
          <p>A fallen adventurer&apos;s belongings are still here, unrecovered.</p>
        </div>
      )}
    </div>
  );
}
