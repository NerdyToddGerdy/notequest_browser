import { useState } from "react";
import type { ArmorPiece, CombatState } from "../../../engine/dungeonState.ts";
import { ARMOR_PIECE_LABELS, type MonsterAbility } from "../../../data/dungeonTables.ts";
import type { SpellTableKey } from "../../../data/types.ts";
import { parseSpellKey, SPELL_TABLE_BY_KEY } from "../../../engine/character.ts";
import {
  HEAL_AMOUNT,
  KNOWN_CASTABLE_SPELL_NAMES,
  rollWeaponDamage,
  TARGETED_SPELL_NAMES,
} from "../../../engine/combat.ts";
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
  /** Remaining uses per spell, keyed by `character.ts`'s `spellKey(table, roll)` composite (issue
   * #24) -- may include spells from tables besides Basic, but only ones in
   * `KNOWN_CASTABLE_SPELL_NAMES` (matched by name, not table) ever render a button here; see that
   * set's own doc comment for why. */
  spellUses: Record<string, number>;
  /** Rinoceroid: "You can attack with your horn (Damage 1d6)" -- offered alongside the normal weapon. */
  isRinoceroid?: boolean;
  /** Slimemen: "If you engulf the body of an enemy, you regain all HP." */
  isSlimemen?: boolean;
  /** OPEN_TREASURE can be dispatched mid-fight and can itself fill the Pack (issue #82) -- while a
   * swap choice is pending (resolved from the sidebar Pack card, not this panel), every action
   * here is blocked the same way a pending armor-absorption choice already is. */
  hasPendingPackItem?: boolean;
  onAttack: (targetId: number, roll: number, useHorn?: boolean) => void;
  onCastSpell: (table: SpellTableKey, spellRoll: number, targetId?: number) => void;
  /** Teleport needs a destination room first -- the parent screen owns that picker, so this just
   * signals "the player wants to flee" instead of dispatching CAST_SPELL directly. */
  onFlee: () => void;
  onResolveDamage: (absorbWith: "hp" | number) => void;
  onEngulfBody: () => void;
}

const HORN_FORMULA = "1d6";

/** One castable spell the character actually knows, resolved from a `spellUses` composite key
 * back to its table/roll/name/effect/remaining-uses -- see `spellKey()`/`parseSpellKey()`. */
interface KnownSpell {
  key: string;
  table: SpellTableKey;
  roll: number;
  name: string;
  effect: string;
  uses: number;
}

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
  hasPendingPackItem = false,
  onAttack,
  onCastSpell,
  onFlee,
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
  // hp > 0 is a second line of defense against a dead player still being able to act -- the
  // reducer already clears `combat` to null on every death (see dungeonReducer.ts), which is what
  // actually stops this panel from rendering at all, but this guards the actions directly too in
  // case a future death path forgets to clear it.
  const canAct = !rolling && !paralyzed && !awaitingDamageChoice && !hasPendingPackItem && hp > 0;
  // Only spells `KNOWN_CASTABLE_SPELL_NAMES` actually has a real CAST_SPELL case for render a
  // button at all -- see that set's own doc comment (combat.ts). Matched by name, not (table,
  // roll), so Elemental's Cold Ray/Lightning/Fireball reuse the same button/handler as Basic's.
  const knownSpells: KnownSpell[] = Object.entries(spellUses)
    .filter(([, uses]) => uses > 0)
    .map(([key, uses]) => {
      const { table, roll } = parseSpellKey(key);
      const spell = SPELL_TABLE_BY_KEY[table]?.[roll];
      return spell ? { key, table, roll, name: spell.name, effect: spell.effect, uses } : null;
    })
    .filter((s): s is KnownSpell => s !== null && KNOWN_CASTABLE_SPELL_NAMES.has(s.name))
    .sort((a, b) => a.key.localeCompare(b.key));
  const targetedSpells = knownSpells.filter((s) => TARGETED_SPELL_NAMES.has(s.name));
  const generalSpells = knownSpells.filter((s) => !TARGETED_SPELL_NAMES.has(s.name));

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

  function castHeal(spell: KnownSpell) {
    if (!canAct) return;
    setHealPreviewHp(Math.min(hp + HEAL_AMOUNT, maxHp));
    setRolling(true);
    window.setTimeout(() => {
      setRolling(false);
      setHealPreviewHp(null);
      onCastSpell(spell.table, spell.roll);
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

      {rolling && (
        <div className={styles.dieRow}>
          <Die value={dieValue} rollToken={rollToken} size={40} />
        </div>
      )}

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
              {targetedSpells.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={styles.spellBtn}
                  disabled={!canAct}
                  title={s.effect}
                  onClick={() => onCastSpell(s.table, s.roll, monster.id)}
                >
                  {s.name} ({s.uses})
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {generalSpells.length > 0 && (
        <div className={styles.spellRow}>
          {generalSpells.map((s) => (
            <button
              key={s.key}
              type="button"
              className={s.name === "Teleport" ? styles.fleeBtn : styles.spellBtn}
              disabled={!canAct}
              title={s.effect}
              onClick={() =>
                s.name === "Heal" ? castHeal(s) : s.name === "Teleport" ? onFlee() : onCastSpell(s.table, s.roll)
              }
            >
              {s.name === "Teleport" ? "Flee — " : ""}
              {s.name} ({s.uses})
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

    </div>
  );
}
