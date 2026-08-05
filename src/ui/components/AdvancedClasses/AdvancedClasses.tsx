import { ADVANCED_CLASS_TABLE } from "../../../data/advancedClasses.ts";
import type { CreatedCharacter } from "../../../data/types.ts";
import {
  canAcquireAdvancedClass,
  hasImplementedAbility,
  isAdvancedClassTrackable,
  meetsAdvancedClassRequirement,
  type AdvancedClassContext,
} from "../../../engine/advancedClasses.ts";
import type { GraveyardEntry } from "../../../engine/graveyard.ts";
import type { AdventurerResources } from "../../../engine/town.ts";
import styles from "./AdvancedClasses.module.css";

export interface AdvancedClassesProps {
  character: CreatedCharacter;
  resources: AdventurerResources;
  /** World-scoped, same as everywhere else the Graveyard is read -- see Gravedigger's requirement. */
  graveyard: GraveyardEntry[];
  onAcquire: (name: string) => void;
}

/** Shown next to any ability this app doesn't implement (issue #111) -- a player bought Ambidextrous
 * and went looking for a dual-wield control that doesn't exist, which is the cost of an unimplemented
 * ability being indistinguishable from a working one. */
const FLAVOR_ABILITY_NOTE =
  "This ability isn't implemented yet -- the class still costs coins and grants its HP bonus.";

/**
 * Grouping rank (issue #132). Cost-ascending alone scattered the handful of classes you can act on
 * through 45 rows spanning 10 to 6000 coins, so rank leads and cost breaks ties within each group --
 * the same "group first, preserve the secondary order" shape as `sortDungeonsForDisplay()`.
 *
 * Four tiers rather than the two the ask strictly needs, because "can't buy this" covers three very
 * different situations and only one of them is noise:
 *
 *  0. buyable right now -- the only rows that are actionable
 *  1. blocked, but reachable: short of coins, or the requirement isn't met yet. Both can change, so
 *     these are what a player is saving or playing *toward*
 *  2. already acquired -- an achievement, not a failure, so it sits above the noise rather than
 *     being lumped in with it
 *  3. not trackable in this version (`isAdvancedClassTrackable()`) -- permanently unbuyable, so
 *     pure noise for a purchasing decision, and the only group that genuinely belongs at the bottom
 *
 * Note tier 3 is **currently empty**: #62 closed at 45/45 trackable, so nothing lands there today.
 * It's kept rather than dropped for the same reason the matching "Requirement not yet trackable in
 * this version" `reason` branch below is kept -- `isAdvancedClassTrackable()` is still the gate any
 * newly-authored class would fail, and a rank that silently sorted such a class in among the
 * buyable ones would be worse than one that never fires.
 */
const GROUPS = [
  { rank: 0, label: "Available now" },
  { rank: 1, label: "Not yet" },
  { rank: 2, label: "Acquired" },
  { rank: 3, label: "Not in this version" },
] as const;

/** Advanced Classes (Expanded World, issue #23) -- every rulebook entry is listed for flavor and
 * completeness, always visible and `disabled` (not omitted) with an explanatory reason when it
 * can't be acquired right now, matching the established always-visible-but-disabled precedent
 * (`Ask`, spell "Cast" buttons). Ordered by the grouping above, then by cost ascending within each
 * group for a natural sense of progression (issue #132 amended this rationale rather than replacing
 * it -- cost order is still what orders the rows you can actually act on). */
export function AdvancedClasses({
  character,
  resources,
  graveyard,
  onAcquire,
}: AdvancedClassesProps) {
  const ctx: AdvancedClassContext = { character, resources, graveyard };
  // Resolved once per class, before sorting -- deliberately *not* inside the comparator, which runs
  // O(n log n) times and would re-walk REQUIREMENT_CHECKS (some of which sum kill tallies or scan
  // the Graveyard) for every comparison. This is the same single pass the render used to do inline.
  const entries = Object.values(ADVANCED_CLASS_TABLE)
    .map((def) => {
      const owned = resources.advancedClasses.includes(def.name);
      const trackable = isAdvancedClassTrackable(def.name);
      const meetsRequirement = trackable && meetsAdvancedClassRequirement(def.name, ctx);
      const canAcquire = canAcquireAdvancedClass(ctx, def.name);
      const reason = owned
        ? "Already acquired."
        : !trackable
          ? "Requirement not yet trackable in this version."
          : !meetsRequirement
            ? "Requirement not met."
            : resources.coins < def.cost
              ? "Not enough coins."
              : null;
      const rank = canAcquire ? 0 : owned ? 2 : !trackable ? 3 : 1;
      return { def, canAcquire, reason, rank };
    })
    .sort((a, b) => a.rank - b.rank || a.def.cost - b.def.cost);

  return (
    <div className={styles.panel}>
      <h3>Advanced Classes</h3>
      <ul className={styles.list}>
        {entries.map(({ def, canAcquire, reason, rank }, index) => {
          // A header whenever the group changes. Ordering alone leaves the boundary invisible across
          // 45 rows -- the per-row `reason` distinguishes them textually, but only once you're
          // already reading a row, which is exactly the scanning problem this issue is about.
          const startsGroup = index === 0 || entries[index - 1]!.rank !== rank;
          return (
            <li key={def.name} className={styles.row}>
              {startsGroup && (
                <p className={styles.groupHeading}>{GROUPS.find((g) => g.rank === rank)?.label}</p>
              )}
              <div className={styles.rowTop}>
                <span className={styles.name}>{def.name}</span>
                <span className={styles.hpBonus}>
                  {def.hpBonus > 0 ? `+${def.hpBonus} HP` : ""}
                </span>
                <button
                  type="button"
                  className={styles.acquireBtn}
                  disabled={!canAcquire}
                  onClick={() => onAcquire(def.name)}
                >
                  Acquire ({def.cost} coins)
                </button>
              </div>
              <p className={styles.requirement}>{def.requirementText}</p>
              <p className={styles.ability}>
                {def.abilityText}
                {!hasImplementedAbility(def.name) && (
                  <span className={styles.flavorTag} title={FLAVOR_ABILITY_NOTE}>
                    flavor only
                  </span>
                )}
              </p>
              {reason && <p className={styles.reason}>{reason}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
