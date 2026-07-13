import { useState } from "react";
import type { DungeonState } from "../../../engine/dungeonState.ts";
import { rollDie } from "../../../engine/dice.ts";
import { TYPE_LABELS } from "../../../data/dungeonTypes.ts";
import { formatMonsterTemplate } from "../../../data/dungeonTables.ts";
import { Die } from "../Die/Die.tsx";
import { revealDelay } from "../../rollTiming.ts";
import styles from "./RoomInspector.module.css";

export interface RoomInspectorProps {
  state: DungeonState;
  onRollSecretPassage: (segId: number, roll: number, trapRoll: number | null) => void;
}

/**
 * Rendered with `key={selectedSegId}` by the caller so its local die-roll
 * state resets cleanly whenever a different segment is selected.
 */
export function RoomInspector({ state, onRollSecretPassage }: RoomInspectorProps) {
  const [dieValue, setDieValue] = useState(1);
  const [rollToken, setRollToken] = useState(0);
  const [revealing, setRevealing] = useState(false);

  const level = state.levels[state.activeLevel];
  const seg = level?.segments.find((s) => s.id === state.selectedSegId) ?? null;

  if (!seg) {
    return (
      <div className={styles.panel}>
        <p className={styles.empty}>Click a room, corridor, or staircase to inspect it.</p>
      </div>
    );
  }

  function handleSearch() {
    if (revealing || !seg || seg.secretPassageSearched) return;
    const roll = rollDie();
    setDieValue(roll);
    setRollToken((t) => t + 1);
    setRevealing(true);
    window.setTimeout(() => {
      setRevealing(false);
      const trapRoll = roll === 1 ? rollDie() : null;
      onRollSecretPassage(seg.id, roll, trapRoll);
    }, revealDelay(1));
  }

  return (
    <div className={styles.panel}>
      <p className={styles.title}>
        Segment {seg.id} · {TYPE_LABELS[seg.type]}
      </p>
      {seg.flavor && <p className={styles.flavor}>{seg.flavor}</p>}

      {seg.roomContent && (
        <div className={styles.row}>
          <span className={styles.label}>Room Content</span>
          <p>{seg.roomContent.text}</p>
        </div>
      )}
      {seg.monsters && (
        <div className={styles.row}>
          <span className={styles.label}>{seg.type === "final" ? "Boss" : "Monsters"}</span>
          <p>
            {formatMonsterTemplate(seg.monsters)}
            {seg.monstersDefeated ? (seg.type === "final" ? " — defeated" : " — cleared") : ""}
          </p>
        </div>
      )}

      {seg.roomContent?.secretPassage && (
        <div className={styles.row}>
          <span className={styles.label}>Secret Passage</span>
          {seg.secretPassageSearched ? (
            <p>{seg.secretPassageResult}</p>
          ) : (
            <p className={styles.hint}>This room may hide a secret passage.</p>
          )}
        </div>
      )}

      {seg.trapResult && (
        <div className={`${styles.row} ${styles.trap}`}>
          <span className={styles.label}>Trap</span>
          <p>{seg.trapResult}</p>
        </div>
      )}

      {seg.roomContent?.secretPassage && !seg.secretPassageSearched && (
        <div className={styles.dieRow}>
          <Die value={dieValue} rollToken={rollToken} size={40} />
          <button
            className={styles.rollBtn}
            type="button"
            disabled={revealing || !state.alive || !!state.combat}
            onClick={handleSearch}
          >
            Find Secret Passage (1 torch)
          </button>
        </div>
      )}
    </div>
  );
}
