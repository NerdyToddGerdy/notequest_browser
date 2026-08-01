import type { EventRow } from "../../../data/events.ts";
import { Die } from "../Die/Die.tsx";
import type { ArmorPiece, CombatState, Consumable } from "../../../engine/dungeonState.ts";
import type { SpellTableKey } from "../../../data/types.ts";
import { CombatPanel } from "../CombatPanel/CombatPanel.tsx";
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
  combat: CombatState | null;
  /** Everything a real fight needs, threaded straight through to `CombatPanel` (issue #120). */
  armor: ArmorPiece[];
  spellUses: Record<string, number>;
  consumables?: Consumable[];
  isRinoceroid?: boolean;
  isSnakeOwner?: boolean;
  onCastSpell: (table: SpellTableKey, spellRoll: number, targetId?: number) => void;
  onResolveDamage: (absorbWith: "hp" | "hireling" | number) => void;
  onHirelingAttack?: (targetId: number, roll: number) => void;
  onAnimalAttack?: (targetId: number) => void;
  onUseConsumable?: (index: number) => void;
  /** Issue #120: the exit an Event never had. */
  onFlee: () => void;
  /** Newest-first transcript of the fight so far. */
  log: string[];
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
  armor,
  spellUses,
  consumables,
  isRinoceroid,
  isSnakeOwner,
  onCastSpell,
  onResolveDamage,
  onHirelingAttack,
  onAnimalAttack,
  onUseConsumable,
  onFlee,
  log,
}: EventPanelProps) {
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
        // Issue #120: the fight itself is the dungeon's own `CombatPanel` now, so a wilderness
        // encounter offers exactly what a dungeon room does -- armor absorption, spells, the
        // Hireling, the Snake, potions -- instead of a single Attack button against a naked
        // character. This panel keeps only what's specific to an Event: the flavour line above, and
        // Camouflage/Star Stone/Continue in the choice stage below.
        <>
          <p className={styles.flavor}>{row.text}</p>
          <CombatPanel
            combat={combat}
            hp={hp}
            maxHp={maxHp}
            weaponName={weaponName ?? "Fists"}
            weaponFormula={weaponFormula ?? "1d6"}
            armor={armor}
            spellUses={spellUses}
            isRinoceroid={isRinoceroid}
            isSnakeOwner={isSnakeOwner}
            consumables={consumables}
            onUseConsumable={onUseConsumable}
            onAttack={onAttack}
            onCastSpell={onCastSpell}
            onResolveDamage={onResolveDamage}
            onHirelingAttack={onHirelingAttack}
            onAnimalAttack={onAnimalAttack}
            onFlee={onFlee}
            fleeLabel="Flee — 1 provision"
          />
          {log.length > 0 && (
            <ul className={styles.log}>
              {log.slice(0, 5).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
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
