import { useState } from "react";
import { ABILITY_DESCRIPTIONS } from "../../../data/dungeonTables.ts";
import type { EventRow } from "../../../data/events.ts";
import { rollWeaponDamage } from "../../../engine/combat.ts";
import type { EventCombatState } from "../../../engine/events.ts";
import { Die } from "../Die/Die.tsx";
import { revealDelay } from "../../rollTiming.ts";
import styles from "./EventPanel.module.css";

/** Events on Travel (issue #91) -- the panel shown over the World map when a 2d6 arrival roll turns
 * up an Event. Three stages, driven entirely by what `WorldScreen` passes down:
 *
 * 1. **Choice** -- the Event is known but nothing has been spent or applied. This is the only moment
 *    Camouflage ("ignore an Event generated in a forest or swamp") and the Star Stone ("spend 1
 *    Provision to Reroll an Event") mean anything, so both are offered here, alongside Continue.
 * 2. **Fight** -- a monster Event the player chose to face. Deliberately a *simpler* panel than
 *    `CombatPanel`: no spells, no armor absorption, no Hireling/Animal actions, matching what
 *    `events.ts` actually models (see its module doc, and `arena.ts`'s identical scoping).
 * 3. **Resolved** -- a short outcome line plus Continue, so a Storm's relocation or a fight's loot
 *    is actually readable before the map redraws underneath it.
 */
export interface EventPanelProps {
  row: EventRow;
  /** The two raw dice that produced this Event, shown as real dice like every other roll in the app. */
  dice: [number, number];
  /** Non-null once the player has chosen to fight. */
  combat: EventCombatState | null;
  hp: number;
  maxHp: number;
  weaponName?: string;
  weaponFormula?: string;
  /** Set once the Event is fully resolved -- switches the panel to its outcome stage. */
  resolvedMessage: string | null;
  canIgnore: boolean;
  ignoreLabel: string;
  canReroll: boolean;
  onAccept: () => void;
  onIgnore: () => void;
  onReroll: () => void;
  /** Carries the rolled die up with the target, mirroring `CombatPanel`'s own `onAttack(id, roll)`:
   * this panel owns the roll so it can animate it, and the engine consumes that exact value. */
  onAttack: (targetId: number, roll: number) => void;
  onDismiss: () => void;
}

function HpBar({ value, max, kind }: { value: number; max: number; kind: "player" | "monster" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={styles.hpBar}>
      <div
        className={kind === "player" ? styles.hpFillPlayer : styles.hpFillMonster}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EventPanel({
  row,
  dice,
  combat,
  hp,
  maxHp,
  weaponName,
  weaponFormula,
  resolvedMessage,
  canIgnore,
  ignoreLabel,
  canReroll,
  onAccept,
  onIgnore,
  onReroll,
  onAttack,
  onDismiss,
}: EventPanelProps) {
  /** The player's own weapon die, animated exactly like CombatPanel's -- the reveal delay is purely
   * cosmetic, the round is already resolved by the time the die lands. */
  const [attackRoll, setAttackRoll] = useState<{ value: number; token: number } | null>(null);
  const [rolling, setRolling] = useState(false);

  function handleAttack(targetId: number) {
    if (rolling || !weaponFormula) return;
    setRolling(true);
    const { rawRoll } = rollWeaponDamage(weaponFormula);
    setAttackRoll((prev) => ({ value: rawRoll, token: (prev?.token ?? 0) + 1 }));
    window.setTimeout(() => {
      setRolling(false);
      onAttack(targetId, rawRoll);
    }, revealDelay(1));
  }

  const canAct = combat != null && combat.outcome === "ongoing" && hp > 0 && !rolling;

  return (
    <div className={styles.panel}>
      <p className={styles.eyebrow}>Event</p>

      {resolvedMessage ? (
        <>
          <p className={styles.flavor}>{resolvedMessage}</p>
          <button type="button" className={styles.primaryBtn} onClick={onDismiss}>
            Continue
          </button>
        </>
      ) : combat ? (
        <>
          <p className={styles.flavor}>{row.text}</p>

          <div className={styles.playerRow}>
            <div className={styles.playerLabel}>
              <span className={styles.playerName}>You</span>
              {weaponName && (
                <span className={styles.weapon}>
                  {weaponName} ({weaponFormula})
                </span>
              )}
            </div>
            <span className={styles.hpText}>
              {hp} / {maxHp} HP
            </span>
          </div>
          <HpBar value={hp} max={maxHp} kind="player" />

          {attackRoll && (
            <div className={styles.dieRow}>
              <Die value={attackRoll.value} rollToken={attackRoll.token} size={34} />
            </div>
          )}

          <ul className={styles.monsterList}>
            {combat.monsters.map((monster) => (
              <li key={monster.id} className={styles.monster}>
                <div className={styles.monsterHeader}>
                  <span className={monster.hp <= 0 ? styles.monsterNameDown : styles.monsterName}>
                    {monster.name}
                  </span>
                  <span className={styles.hpText}>
                    {monster.hp} / {monster.maxHp} HP
                  </span>
                </div>
                <HpBar value={monster.hp} max={monster.maxHp} kind="monster" />
                {monster.abilities.length > 0 && (
                  <div className={styles.tags}>
                    {monster.abilities.map((ability) => (
                      <span
                        key={ability}
                        className={styles.tag}
                        title={ABILITY_DESCRIPTIONS[ability]}
                      >
                        {ability}
                      </span>
                    ))}
                  </div>
                )}
                {monster.hp > 0 && (
                  <button
                    type="button"
                    className={styles.attackBtn}
                    disabled={!canAct || !weaponFormula}
                    onClick={() => handleAttack(monster.id)}
                  >
                    Attack
                  </button>
                )}
              </li>
            ))}
          </ul>

          {!weaponFormula && <p className={styles.warning}>You have no weapon to fight with.</p>}
        </>
      ) : (
        <>
          <div className={styles.dieRow}>
            <Die value={dice[0]} rollToken={1} size={30} />
            <Die value={dice[1]} rollToken={1} size={30} delayMs={90} />
          </div>
          <p className={styles.flavor}>{row.text}</p>

          <button type="button" className={styles.primaryBtn} onClick={onAccept}>
            {row.monsters ? "Fight" : "Continue"}
          </button>

          {canIgnore && (
            <button type="button" className={styles.secondaryBtn} onClick={onIgnore}>
              Cast {ignoreLabel} — slip past unseen
            </button>
          )}
          {canReroll && (
            <button type="button" className={styles.secondaryBtn} onClick={onReroll}>
              Star Stone — reroll (1 provision)
            </button>
          )}
        </>
      )}
    </div>
  );
}
