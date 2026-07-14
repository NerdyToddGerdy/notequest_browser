import { useState } from "react";
import type { DungeonState, SegmentState } from "../../../engine/dungeonState.ts";
import { rollDie } from "../../../engine/dice.ts";
import { TYPE_LABELS } from "../../../data/dungeonTypes.ts";
import { formatMonsterTemplate } from "../../../data/dungeonTables.ts";
import { DicePool } from "../DicePool/DicePool.tsx";
import { revealDelay } from "../../rollTiming.ts";
import styles from "./RoomInspector.module.css";

export interface RoomInspectorProps {
  state: DungeonState;
  onRollSecretPassage: (segId: number, roll: number, trapRoll: number | null) => void;
  onRollChest: (segId: number, dice: [number, number], trapRoll: number | null) => void;
  onCollectRemains: (segId: number) => void;
  /** Fires the instant a secret-passage or chest roll is confirmed as a trap -- before the extra
   * die rolls to decide *which* trap, so the warning lands as an ambush rather than after-the-fact
   * flavor text. */
  onTrapTriggered?: () => void;
}

function hasChest(seg: SegmentState): boolean {
  return !!seg.roomContent?.hasChest || seg.secretPassageResult === "You have found a hidden Chest!";
}

/** "The remains of Bram lie here — 5 coins, 2 Treasures, 1 Key." */
function describeRemains(remains: NonNullable<SegmentState["remains"]>): string {
  const parts: string[] = [];
  if (remains.coins > 0) parts.push(`${remains.coins} coin${remains.coins === 1 ? "" : "s"}`);
  if (remains.treasures > 0) parts.push(`${remains.treasures} Treasure${remains.treasures === 1 ? "" : "s"}`);
  if (remains.keys > 0) parts.push(`${remains.keys} Key${remains.keys === 1 ? "" : "s"}`);
  for (const item of remains.heldItems) parts.push(item.name);
  const who = remains.names.join(", ");
  return parts.length > 0 ? `The remains of ${who} lie here — ${parts.join(", ")}.` : `The remains of ${who} lie here.`;
}

/**
 * Rendered with `key={selectedSegId}` by the caller so its local die-roll
 * state resets cleanly whenever a different segment is selected.
 */
export function RoomInspector({
  state,
  onRollSecretPassage,
  onRollChest,
  onCollectRemains,
  onTrapTriggered,
}: RoomInspectorProps) {
  const [passageDice, setPassageDice] = useState<number[]>([1]);
  const [rollToken, setRollToken] = useState(0);
  const [revealing, setRevealing] = useState(false);

  const [chestDice, setChestDice] = useState<number[]>([1, 1]);
  const [chestRollToken, setChestRollToken] = useState(0);
  const [chestRevealing, setChestRevealing] = useState(false);

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
    // Dwarf: "When you roll to Find Secret Passages, roll two dice and discard the lowest" --
    // row 1 is the only bad outcome (it triggers a trap roll), so keeping the higher die is
    // strictly an advantage.
    const isDwarf = state.raceName === "Dwarf";
    const dice = isDwarf ? [rollDie(), rollDie()] : [rollDie()];
    const roll = Math.max(...dice);
    setPassageDice(dice);
    setRollToken((t) => t + 1);
    setRevealing(true);
    window.setTimeout(() => {
      setRevealing(false);
      const isTrap = roll === 1;
      if (isTrap) onTrapTriggered?.();
      const trapRoll = isTrap ? rollDie() : null;
      onRollSecretPassage(seg.id, roll, trapRoll);
    }, revealDelay(dice.length));
  }

  function handleOpenChest() {
    if (chestRevealing || !seg || seg.chestOpened || !hasChest(seg)) return;
    const dice: [number, number] = [rollDie(), rollDie()];
    setChestDice(dice);
    setChestRollToken((t) => t + 1);
    setChestRevealing(true);
    window.setTimeout(() => {
      setChestRevealing(false);
      const isTrap = dice[0] === 1 && dice[1] === 1;
      if (isTrap) onTrapTriggered?.();
      const trapRoll = isTrap ? rollDie() : null;
      onRollChest(seg.id, dice, trapRoll);
    }, revealDelay(2));
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

      {hasChest(seg) && (
        <div className={styles.row}>
          <span className={styles.label}>Chest</span>
          {seg.chestOpened ? (
            <p>{seg.chestResult}</p>
          ) : (
            <p className={styles.hint}>There&apos;s a chest here, waiting to be opened.</p>
          )}
        </div>
      )}

      {seg.remains && (
        <div className={styles.row}>
          <span className={styles.label}>Remains</span>
          <p>{describeRemains(seg.remains)}</p>
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
          <DicePool values={passageDice} rollToken={rollToken} size={40} />
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

      {hasChest(seg) && !seg.chestOpened && (
        <div className={styles.dieRow}>
          <DicePool values={chestDice} rollToken={chestRollToken} size={40} />
          <button
            className={styles.rollBtn}
            type="button"
            disabled={chestRevealing || !state.alive || !!state.combat}
            onClick={handleOpenChest}
          >
            Open Chest
          </button>
        </div>
      )}

      {seg.remains && (
        <div className={styles.dieRow}>
          <button
            className={styles.rollBtn}
            type="button"
            disabled={!state.alive || !!state.combat}
            onClick={() => onCollectRemains(seg.id)}
          >
            Recover Remains
          </button>
        </div>
      )}
    </div>
  );
}
