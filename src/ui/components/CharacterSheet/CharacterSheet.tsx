import type { CreatedCharacter } from "../../../data/types.ts";
import { SPELL_TABLE } from "../../../data/spells.ts";
import { computeSpellUses } from "../../../engine/character.ts";
import styles from "./CharacterSheet.module.css";

export interface CharacterSheetProps {
  character: CreatedCharacter;
  /** Live torch count in the current run; falls back to the character's starting amount outside a dungeon. */
  torches?: number;
  /** Live HP in the current run; falls back to the character's full HP outside a dungeon. */
  hp?: number;
  /** Live coin count in the current run; falls back to the character's starting amount outside a dungeon. */
  coins?: number;
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
  spellUses,
  canCastOutOfCombat,
  onCastSpell,
}: CharacterSheetProps) {
  const maxSpellUses = computeSpellUses(character.spells, character.fixedGrants);
  const liveSpellUses = spellUses ?? maxSpellUses;
  const spellRolls = Object.keys(maxSpellUses)
    .map(Number)
    .sort((a, b) => a - b);
  const hasSpells = spellRolls.length > 0;
  const torchCount = torches ?? character.torches;
  const hpValue = hp ?? character.totalHp;
  const coinCount = coins ?? character.coins;

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>Adventurer</h3>
      <p className={styles.name}>{character.name}</p>
      <p className={styles.subtitle}>
        The {character.race.name} {character.cls.name}
      </p>

      <div className={styles.statRow}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>HP</span>
          <span className={`${styles.statValue} ${hpValue <= character.totalHp / 4 ? styles.warn : ""}`}>
            {hpValue} / {character.totalHp}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Weapon</span>
          <span className={styles.statValue}>
            {character.cls.weapon} ({character.cls.weaponDamage})
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Torches</span>
          <span className={`${styles.statValue} ${torchCount <= 2 ? styles.warn : ""}`}>{torchCount}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Coins</span>
          <span className={styles.statValue}>{coinCount}</span>
        </div>
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
              const canCast = CASTABLE_OUT_OF_COMBAT.has(roll) && !!canCastOutOfCombat && !!onCastSpell && remaining > 0;
              return (
                <li key={roll}>
                  <div className={styles.spellHeader}>
                    <span className={styles.spellName}>{spell.name}</span>
                    <span className={styles.spellUses}>
                      {remaining} / {max} uses
                    </span>
                  </div>
                  {spell.effect}
                  {canCast && (
                    <button type="button" className={styles.castBtn} onClick={() => onCastSpell!(roll)}>
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
  );
}
