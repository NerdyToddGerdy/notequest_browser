import type { Terrain } from "../../../data/hexTables.ts";
import type { AnimalDef, BuildingKind } from "../../../data/types.ts";
import { canTrainAnimal } from "../../../engine/animals.ts";
import { canBuildBuilding } from "../../../engine/buildings.ts";
import { BUILDING_ORDER, BUILDING_TABLE, buildingCost } from "../../../data/buildings.ts";
import type { AdventurerResources } from "../../../engine/town.ts";
import type { PoliticalStatus } from "../../../engine/politics.ts";
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
  /** WorldScreen's own `canEnterDungeon` check (issue #59) -- always about the *current* tile
   * (you can only enter a dungeon on the hex you're standing on), so the button below only ever
   * renders when `isCurrentTile` is also true, not for some other hex merely being inspected. */
  canEnterDungeon: boolean;
  onEnterDungeon: () => void;
  /** Animals (issue #26): every animal/mount trainable at this hex right now (`WorldScreen`'s own
   * `qualifiesForTraining()` check) -- only ever non-empty for the current tile. */
  trainableAnimals: AnimalDef[];
  resources: AdventurerResources;
  onTrainAnimal: (name: string) => void;
  /** The last training attempt's outcome ("You trained a Dog!" / "The Dog slipped away."), same
   * always-visible-until-replaced precedent as TownScreen's Thug Life message. */
  trainResultMessage: string | null;
  /** Buildings (issue #27): true only for a hex with no `location` at all (a City/Fortress/Ruins/
   * etc. hex can never be built on) -- the gate this section lives behind. */
  isEmptyHex: boolean;
  /** Whichever building already sits here, if any (for showing "Upgrade to X" instead of "Build"). */
  currentBuilding?: BuildingKind;
  raceName: string;
  onBuildBuilding: (kind: BuildingKind) => void;
  /** Politics (issue #27): this hex's resolved Political Affinity outcome, if any -- shown for any
   * inspected City/Fortress hex, not gated on `isCurrentTile` (Political Affinity itself is only
   * ever *attempted* from TownScreen, standing on the current hex; this is read-only elsewhere). */
  politicalStatus: PoliticalStatus | null;
}

const POLITICAL_STATUS_COPY: Record<PoliticalStatus, string> = {
  ally: "Allied with you.",
  vassal: "A Vassal of your realm.",
  enemy: "Hostile to you.",
};

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
 * resolves all of this from its own currentTile/dungeonInfoFor() logic. Read-only for travel:
 * clicking a passable neighbor hex on the map travels there directly, so there's no separate
 * travel action here to gate -- but "Enter Dungeon" (issue #59) *does* live here, since unlike
 * travel it has no other affordance on the map itself, and previously lived in a disconnected
 * card below the map instead of next to the status this panel already displays. */
export function HexInspector({
  terrain,
  locationLabel,
  cityName,
  dungeonStatus,
  hasRemains,
  isCurrentTile,
  noAffinity,
  banned,
  canEnterDungeon,
  onEnterDungeon,
  trainableAnimals,
  resources,
  onTrainAnimal,
  trainResultMessage,
  isEmptyHex,
  currentBuilding,
  raceName,
  onBuildBuilding,
  politicalStatus,
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

      {politicalStatus && (
        <div className={styles.row}>
          <span className={styles.label}>Politics</span>
          <p>{POLITICAL_STATUS_COPY[politicalStatus]}</p>
        </div>
      )}

      {isCurrentTile && canEnterDungeon && (
        <div className={styles.actionRow}>
          <button className={styles.rollBtn} type="button" onClick={onEnterDungeon}>
            Enter Dungeon
          </button>
        </div>
      )}

      {hasRemains && (
        <div className={styles.row}>
          <span className={styles.label}>Remains</span>
          <p>A fallen adventurer&apos;s belongings are still here, unrecovered.</p>
        </div>
      )}

      {isCurrentTile && trainableAnimals.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>Train an Animal</span>
          {trainResultMessage && <p>{trainResultMessage}</p>}
          <ul className={styles.trainList}>
            {trainableAnimals.map((animal) => (
              <li key={animal.name} className={styles.trainRow}>
                <span>
                  {animal.name} (Dif {animal.dif})
                </span>
                <button
                  type="button"
                  className={styles.trainBtn}
                  disabled={!canTrainAnimal(resources, animal)}
                  onClick={() => onTrainAnimal(animal.name)}
                >
                  Train ({animal.isMount ? 8 : 4} provisions)
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isCurrentTile && isEmptyHex && (
        <div className={styles.row}>
          <span className={styles.label}>Build a Building</span>
          <ul className={styles.trainList}>
            {BUILDING_ORDER.map((kind) => {
              const def = BUILDING_TABLE[kind];
              const alreadyThis = currentBuilding === kind;
              const newCost = buildingCost(kind, terrain, raceName);
              const oldCost = currentBuilding ? buildingCost(currentBuilding, terrain, raceName) : 0;
              const cost = Math.max(0, newCost - oldCost);
              return (
                <li key={kind} className={styles.trainRow}>
                  <span>
                    {def.name} ({cost} coins{def.requirementText === "None." ? "" : `, ${def.requirementText}`})
                  </span>
                  <button
                    type="button"
                    className={styles.trainBtn}
                    disabled={
                      alreadyThis ||
                      !canBuildBuilding(
                        resources,
                        { terrain, location: null, building: currentBuilding },
                        kind,
                        terrain,
                        raceName,
                      )
                    }
                    onClick={() => onBuildBuilding(kind)}
                  >
                    {currentBuilding ? "Upgrade" : "Build"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
