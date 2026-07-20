import { useState } from "react";
import type { CreatedCharacter } from "../../../data/types.ts";
import { SPELL_TABLE } from "../../../data/spells.ts";
import { computeSpellUses } from "../../../engine/character.ts";
import { KillBreakdownModal } from "../KillBreakdownModal/KillBreakdownModal.tsx";
import styles from "./CharacterSheet.module.css";

export interface CharacterSheetProps {
  character: CreatedCharacter;
  /** Live torch count in the current run; falls back to the character's starting amount outside a dungeon. */
  torches?: number;
  /** Live HP in the current run; falls back to the character's full HP outside a dungeon. */
  hp?: number;
  /** Live coin count in the current run; falls back to the character's starting amount outside a dungeon. */
  coins?: number;
  /** Live Treasure count in the current run; 0 outside a dungeon (Treasures are only ever found there). */
  treasures?: number;
  /** Live Key count in the current run; 0 outside a dungeon (Keys are only ever found there). */
  keys?: number;
  /** Total monsters defeated (any/Boss combined) -- the stat row's own displayed count; falls back
   * to 0 for a brand-new character with no kills yet. */
  monsterKills?: number;
  /** Per-monster-name breakdown backing the "Kills" stat's modal -- see DungeonState.killsByName. */
  killsByName?: Record<string, number>;
  /** Live Provisions count while exploring the World map; omitted entirely (not shown) anywhere
   * else, since provisions have no meaning in Town or a dungeon. */
  provisions?: number;
  /** An acquired weapon's name, overriding the character's class weapon; falls back to it outside
   * a dungeon or if none has been found yet. */
  weaponName?: string;
  /** The acquired weapon's damage formula, paired with `weaponName` above. */
  weaponFormula?: string;
  /** Remaining uses per spell in the current run; falls back to the character's starting uses outside a dungeon. */
  spellUses?: Record<number, number>;
  /** Whether Heal/Light can be cast right now (in a dungeon, alive, not mid-fight). */
  canCastOutOfCombat?: boolean;
  onCastSpell?: (spellRoll: number) => void;
}

/** Heal and Light are the only spells that mean anything outside a fight; the rest need a target or a flee. */
const CASTABLE_OUT_OF_COMBAT = new Set([1, 2]);

export function CharacterSheet({
  character,
  torches,
  hp,
  coins,
  treasures,
  keys,
  provisions,
  weaponName,
  weaponFormula,
  spellUses,
  canCastOutOfCombat,
  onCastSpell,
  monsterKills,
  killsByName,
}: CharacterSheetProps) {
  const [showKills, setShowKills] = useState(false);
  const maxSpellUses = computeSpellUses(character.spells, character.fixedGrants);
  const liveSpellUses = spellUses ?? maxSpellUses;
  const spellRolls = Object.keys(maxSpellUses)
    .map(Number)
    .sort((a, b) => a - b);
  const hasSpells = spellRolls.length > 0;
  const torchCount = torches ?? character.torches;
  const hpValue = hp ?? character.totalHp;
  const coinCount = coins ?? character.coins;
  const treasureCount = treasures ?? 0;
  const keyCount = keys ?? 0;
  const killCount = monsterKills ?? 0;
  const displayWeaponName = weaponName ?? character.cls.weapon;
  const displayWeaponFormula = weaponFormula ?? character.cls.weaponDamage;

  return (
    <>
      <div className={styles.card}>
        <h3 className={styles.heading}>Adventurer</h3>
        <p className={styles.name}>{character.name}</p>
        <p className={styles.subtitle}>
          The {character.race.name} {character.cls.name}
        </p>

        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>HP</span>
            <span
              className={`${styles.statValue} ${hpValue <= character.totalHp / 4 ? styles.warn : ""}`}
            >
              {hpValue} / {character.totalHp}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Weapon</span>
            <span className={styles.statValue}>
              {displayWeaponName} ({displayWeaponFormula})
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Torches</span>
            <span className={`${styles.statValue} ${torchCount <= 2 ? styles.warn : ""}`}>
              {torchCount}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Coins</span>
            <span className={styles.statValue}>{coinCount}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Treasures</span>
            <span className={styles.statValue}>{treasureCount}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Keys</span>
            <span className={styles.statValue}>{keyCount}</span>
          </div>
          <button
            type="button"
            className={styles.statClickable}
            onClick={() => setShowKills(true)}
            title="See the per-monster breakdown"
          >
            <span className={styles.statLabel}>Kills</span>
            <span className={styles.statValue}>{killCount}</span>
          </button>
          {provisions != null && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Provisions</span>
              <span className={`${styles.statValue} ${provisions <= 2 ? styles.warn : ""}`}>
                {provisions}
              </span>
            </div>
          )}
        </div>

        <ul className={styles.abilities}>
          {character.race.ability !== "None." && (
            <li>
              <strong>{character.race.name}:</strong> {character.race.ability}
            </li>
          )}
          {character.cls.ability !== "None." && (
            <li>
              <strong>{character.cls.name}:</strong> {character.cls.ability}
            </li>
          )}
        </ul>

        {hasSpells && (
          <>
            <p className={styles.spellsHeading}>Spells</p>
            <ul className={styles.spellList}>
              {spellRolls.map((roll) => {
                const spell = SPELL_TABLE[roll];
                if (!spell) return null;
                const max = maxSpellUses[roll] ?? 0;
                const remaining = liveSpellUses[roll] ?? 0;
                // Rendered whenever this spell is *eligible* to cast here, even at 0 remaining
                // uses -- disabled (not omitted) in that case, so "out of uses right now" reads
                // differently from "not castable here at all" instead of looking identical.
                const canCastHere =
                  CASTABLE_OUT_OF_COMBAT.has(roll) && !!canCastOutOfCombat && !!onCastSpell;
                return (
                  <li key={roll}>
                    <div className={styles.spellHeader}>
                      <span className={styles.spellName}>{spell.name}</span>
                      <span className={styles.spellUses}>
                        {remaining} / {max} uses
                      </span>
                    </div>
                    {spell.effect}
                    {canCastHere && (
                      <button
                        type="button"
                        className={styles.castBtn}
                        disabled={remaining <= 0}
                        onClick={() => onCastSpell!(roll)}
                      >
                        Cast
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      {showKills && (
        <KillBreakdownModal killsByName={killsByName ?? {}} onClose={() => setShowKills(false)} />
      )}
    </>
  );
}
