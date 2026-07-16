import { TYPE_LABELS } from "../../../data/dungeonTypes.ts";
import { isTeleportDestination } from "../../../engine/dungeon.ts";
import type { LevelState } from "../../../engine/dungeonState.ts";
import styles from "./TeleportPicker.module.css";

export interface TeleportPickerProps {
  levels: LevelState[];
  /** The segment the player is fleeing from -- never itself a valid destination. */
  excludeSegId: number;
  onSelect: (levelIndex: number, segId: number) => void;
  onCancel: () => void;
}

/**
 * "You teleport to any empty room" -- shown in place of the Combat panel once Flee is clicked, so
 * the player can pick which already-discovered, monster-free room to reappear in (see
 * `isTeleportDestination`) rather than casting the spell blind. The room whose fight is being fled
 * stays exactly as it was -- its monsters are still there, just no longer fighting -- so it's
 * deliberately excluded from its own destination list.
 */
export function TeleportPicker({ levels, excludeSegId, onSelect, onCancel }: TeleportPickerProps) {
  const destinations = levels.flatMap((level, levelIndex) =>
    level.segments
      .filter((seg) => isTeleportDestination(seg, excludeSegId))
      .map((seg) => ({ levelIndex, segId: seg.id, type: seg.type })),
  );

  return (
    <div className={styles.panel}>
      <p className={styles.title}>Cast Teleport</p>
      <p className={styles.copy}>Choose an already-explored, empty room to reappear in.</p>
      {destinations.length === 0 ? (
        <p className={styles.copy}>There&apos;s nowhere to go yet -- explore more of the dungeon first.</p>
      ) : (
        <ul className={styles.destList}>
          {destinations.map(({ levelIndex, segId, type }) => (
            <li key={`${levelIndex}-${segId}`}>
              <button type="button" className={styles.destBtn} onClick={() => onSelect(levelIndex, segId)}>
                Level {levelIndex + 1} — {TYPE_LABELS[type]} (Segment {segId})
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={styles.cancelBtn} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
