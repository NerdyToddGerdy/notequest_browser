import { useState } from "react";
import type { ArmorPiece, CombatState } from "../../../engine/dungeonState.ts";
import { ARMOR_PIECE_LABELS, type MonsterAbility } from "../../../data/dungeonTables.ts";
import { SPELL_TABLE } from "../../../data/spells.ts";
import { rollWeaponDamage } from "../../../engine/combat.ts";
import { Die } from "../Die/Die.tsx";
import { revealDelay } from "../../rollTiming.ts";
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
  onAttack: (targetId: number, roll: number) => void;
  onCastSpell: (spellRoll: number, targetId?: number) => void;
  onResolveDamage: (absorbWith: "hp" | number) => void;
}

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
  onAttack,
  onCastSpell,
  onResolveDamage,
}: CombatPanelProps) {
  const [dieValue, setDieValue] = useState(1);
  const [rollToken, setRollToken] = useState(0);
  const [rolling, setRolling] = useState(false);

  const paralyzed = combat.paralyzedTurns > 0;
  const awaitingDamageChoice = combat.pendingDamage !== null;
  const canAct = !rolling && !paralyzed && !awaitingDamageChoice;
  const knownSpellRolls = Object.entries(spellUses)
    .filter(([, uses]) => uses > 0)
    .map(([roll]) => Number(roll))
    .sort((a, b) => a - b);
  const targetedSpells = knownSpellRolls.filter((roll) => TARGETED_SPELLS.has(roll));
  const generalSpells = knownSpellRolls.filter((roll) => !TARGETED_SPELLS.has(roll));

  function rollAndAttack(targetId: number) {
    if (!canAct) return;
    const { rawRoll } = rollWeaponDamage(weaponFormula);
    setDieValue(rawRoll);
    setRollToken((t) => t + 1);
    setRolling(true);
    window.setTimeout(() => {
      setRolling(false);
      onAttack(targetId, rawRoll);
    }, revealDelay(1));
  }

  function handleContinueParalyzed() {
    const first = combat.monsters[0];
    if (!first) return;
    onAttack(first.id, 1);
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
        <HpBar value={hp} max={maxHp} kind="player" />
        <span className={styles.hpText}>
          {hp} / {maxHp} HP
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
                  <span key={ability} className={styles.tag}>
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
              {targetedSpells.map((spellRoll) => (
                <button
                  key={spellRoll}
                  type="button"
                  className={styles.spellBtn}
                  disabled={!canAct}
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
              onClick={() => onCastSpell(spellRoll)}
            >
              {spellRoll === 3 ? "Flee — " : ""}
              {SPELL_TABLE[spellRoll]!.name} ({spellUses[spellRoll]})
            </button>
          ))}
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
