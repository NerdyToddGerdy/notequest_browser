import { useState } from "react";
import type { ArmorPiece, CombatState } from "../../../engine/dungeonState.ts";
import { ARMOR_PIECE_LABELS, type MonsterAbility } from "../../../data/dungeonTables.ts";
import { SPELL_TABLE } from "../../../data/spells.ts";
import { HEAL_AMOUNT, rollWeaponDamage } from "../../../engine/combat.ts";
import { Die } from "../Die/Die.tsx";
import { HEAL_PREVIEW_MS, revealDelay } from "../../rollTiming.ts";
import styles from "./CombatPanel.module.css";

export interface CombatPanelProps {
  combat: CombatState;
  hp: number;
  maxHp: number;
  weaponName: string;
  weaponFormula: string;
  armor: ArmorPiece[];
  /** Remaining uses per spell, keyed by its 1d6 Basic Spells table roll. */
  spellUses: Record<number, number>;
  /** Rinoceroid: "You can attack with your horn (Damage 1d6)" -- offered alongside the normal weapon. */
  isRinoceroid?: boolean;
  /** Slimemen: "If you engulf the body of an enemy, you regain all HP." */
  isSlimemen?: boolean;
  onAttack: (targetId: number, roll: number, useHorn?: boolean) => void;
  onCastSpell: (spellRoll: number, targetId?: number) => void;
  onResolveDamage: (absorbWith: "hp" | number) => void;
  onEngulfBody: () => void;
}

const HORN_FORMULA = "1d6";

/** Cold Ray and Lightning target one monster; Heal/Light/Fireball/Teleport don't. */
const TARGETED_SPELLS = new Set([4, 5]);

const ABILITY_LABELS: Record<MonsterAbility, string> = {
  stoneskin: "Stoneskin",
  loot: "Loot",
  explosive: "Explosive",
  firebreath: "Firebreath",
  horde: "Horde",
  intangible: "Intangible",
  sorcery: "Sorcery",
  deathtouch: "Deathtouch",
  undead: "Undead",
  necromancy: "Necromancy",
  weakness: "Weakness",
  regeneration: "Regeneration",
  paralyze: "Paralyze",
  poison: "Poison",
};

/** Summarized from `docs/game-rules-reference.md`'s Monster Abilities table, for the hover
 * tooltip on each ability tag -- not new copy, just condensed to a sentence. */
const ABILITY_DESCRIPTIONS: Record<MonsterAbility, string> = {
  stoneskin: "Ignores any damage of 3 or less.",
  loot: "After the fight, rolls for a coin, a Key, or a Treasure.",
  explosive: "On a roll of 1, self-destructs for damage equal to its current HP.",
  firebreath: "On a roll of 1, its next attack deals +10 damage.",
  horde: "On a roll of 1, an Orc (6 HP; 3 Damage) joins the fight.",
  intangible: "Takes no damage from an even-numbered hit.",
  sorcery: "On a roll of 1, its next attack gets a bonus die of damage.",
  deathtouch: "On a roll of 1, its next attack kills you outright.",
  undead: "On defeat, a roll of 1 revives it with 1 HP.",
  necromancy: "On a roll of 1, a Skeleton (4 HP; 1 Damage; Undead) joins the fight.",
  weakness: "On a roll of 6, it takes double damage.",
  regeneration: "On a roll of 1, it recovers 6 HP.",
  paralyze: "On a roll of 1, its next attack paralyzes you for 1d6 turns.",
  poison: "Its damage always bypasses armor.",
};

function HpBar({ value, max, kind }: { value: number; max: number; kind: "player" | "monster" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={styles.hpBar}>
      <div className={kind === "player" ? styles.hpFillPlayer : styles.hpFillMonster} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function CombatPanel({
  combat,
  hp,
  maxHp,
  weaponName,
  weaponFormula,
  armor,
  spellUses,
  isRinoceroid = false,
  isSlimemen = false,
  onAttack,
  onCastSpell,
  onResolveDamage,
  onEngulfBody,
}: CombatPanelProps) {
  const [dieValue, setDieValue] = useState(1);
  const [rollToken, setRollToken] = useState(0);
  const [rolling, setRolling] = useState(false);
  /** Set while a just-cast Heal's HP bump is being held on screen, before the same dispatch's
   * monster counter-attack (see CAST_SPELL in dungeonReducer.ts) lands on the same `hp` value --
   * otherwise the heal and the counter-attack cancel out in a single render and the heal never
   * visibly registers. Null once the real `hp` prop should be shown again. */
  const [healPreviewHp, setHealPreviewHp] = useState<number | null>(null);

  const paralyzed = combat.paralyzedTurns > 0;
  const awaitingDamageChoice = combat.pendingDamage !== null;
  const canAct = !rolling && !paralyzed && !awaitingDamageChoice;
  const knownSpellRolls = Object.entries(spellUses)
    .filter(([, uses]) => uses > 0)
    .map(([roll]) => Number(roll))
    .sort((a, b) => a - b);
  const targetedSpells = knownSpellRolls.filter((roll) => TARGETED_SPELLS.has(roll));
  const generalSpells = knownSpellRolls.filter((roll) => !TARGETED_SPELLS.has(roll));

  function rollAndAttack(targetId: number, useHorn = false) {
    if (!canAct) return;
    const { rawRoll } = rollWeaponDamage(useHorn ? HORN_FORMULA : weaponFormula);
    setDieValue(rawRoll);
    setRollToken((t) => t + 1);
    setRolling(true);
    window.setTimeout(() => {
      setRolling(false);
      onAttack(targetId, rawRoll, useHorn);
    }, revealDelay(1));
  }

  function handleContinueParalyzed() {
    const first = combat.monsters[0];
    if (!first) return;
    onAttack(first.id, 1);
  }

  function castHeal() {
    if (!canAct) return;
    setHealPreviewHp(Math.min(hp + HEAL_AMOUNT, maxHp));
    setRolling(true);
    window.setTimeout(() => {
      setRolling(false);
      setHealPreviewHp(null);
      onCastSpell(1);
    }, HEAL_PREVIEW_MS);
  }

  return (
    <div className={styles.panel}>
      <p className={styles.title}>Combat</p>

      <div className={styles.playerRow}>
        <div className={styles.playerLabel}>
          <span>You</span>
          <span className={styles.weapon}>
            {weaponName} ({weaponFormula})
          </span>
        </div>
        <HpBar value={healPreviewHp ?? hp} max={maxHp} kind="player" />
        <span className={styles.hpText}>
          {healPreviewHp ?? hp} / {maxHp} HP
        </span>
      </div>

      <ul className={styles.monsterList}>
        {combat.monsters.map((monster) => (
          <li key={monster.id} className={styles.monster}>
            <div className={styles.monsterHeader}>
              <span className={styles.monsterName}>{monster.name}</span>
              <span className={styles.hpText}>
                {monster.hp} / {monster.maxHp} HP
              </span>
            </div>
            <HpBar value={monster.hp} max={monster.maxHp} kind="monster" />
            {monster.abilities.length > 0 && (
              <div className={styles.tags}>
                {monster.abilities.map((ability) => (
                  <span key={ability} className={styles.tag} title={ABILITY_DESCRIPTIONS[ability]}>
                    {ABILITY_LABELS[ability]}
                  </span>
                ))}
              </div>
            )}
            <div className={styles.monsterActions}>
              <button
                type="button"
                className={styles.attackBtn}
                disabled={!canAct}
                onClick={() => rollAndAttack(monster.id)}
              >
                Attack
              </button>
              {isRinoceroid && (
                <button
                  type="button"
                  className={styles.attackBtn}
                  disabled={!canAct}
                  onClick={() => rollAndAttack(monster.id, true)}
                >
                  Horn ({HORN_FORMULA})
                </button>
              )}
              {targetedSpells.map((spellRoll) => (
                <button
                  key={spellRoll}
                  type="button"
                  className={styles.spellBtn}
                  disabled={!canAct}
                  title={SPELL_TABLE[spellRoll]!.effect}
                  onClick={() => onCastSpell(spellRoll, monster.id)}
                >
                  {SPELL_TABLE[spellRoll]!.name} ({spellUses[spellRoll]})
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {generalSpells.length > 0 && (
        <div className={styles.spellRow}>
          {generalSpells.map((spellRoll) => (
            <button
              key={spellRoll}
              type="button"
              className={spellRoll === 3 ? styles.fleeBtn : styles.spellBtn}
              disabled={!canAct}
              title={SPELL_TABLE[spellRoll]!.effect}
              onClick={() => (spellRoll === 1 ? castHeal() : onCastSpell(spellRoll))}
            >
              {spellRoll === 3 ? "Flee — " : ""}
              {SPELL_TABLE[spellRoll]!.name} ({spellUses[spellRoll]})
            </button>
          ))}
        </div>
      )}

      {isSlimemen && combat.engulfableBodies > 0 && (
        <div className={styles.spellRow}>
          <button
            type="button"
            className={styles.spellBtn}
            disabled={!canAct}
            title="Regain all HP -- consumes a fallen enemy's body."
            onClick={onEngulfBody}
          >
            Engulf Body ({combat.engulfableBodies})
          </button>
        </div>
      )}

      {awaitingDamageChoice && (
        <div className={styles.paralyzed}>
          <p>Take {combat.pendingDamage} damage: your call -- absorb it with your HP, or a piece of armor.</p>
          <div className={styles.monsterActions}>
            <button type="button" className={styles.attackBtn} onClick={() => onResolveDamage("hp")}>
              HP ({hp}/{maxHp})
            </button>
            {armor.map((piece, index) =>
              piece.hp > 0 ? (
                <button key={index} type="button" className={styles.attackBtn} onClick={() => onResolveDamage(index)}>
                  {piece.itemName ?? ARMOR_PIECE_LABELS[piece.piece]} ({piece.hp}/{piece.maxHp})
                </button>
              ) : null,
            )}
          </div>
        </div>
      )}

      {paralyzed && (
        <div className={styles.paralyzed}>
          <p>
            You are paralyzed and cannot act ({combat.paralyzedTurns} turn{combat.paralyzedTurns > 1 ? "s" : ""}{" "}
            left)!
          </p>
          <button type="button" className={styles.attackBtn} onClick={handleContinueParalyzed}>
            Continue
          </button>
        </div>
      )}

      {rolling && (
        <div className={styles.dieRow}>
          <Die value={dieValue} rollToken={rollToken} size={40} />
        </div>
      )}
    </div>
  );
}
