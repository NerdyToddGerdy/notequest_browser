import { useState } from "react";
import type { ArmorPiece, CombatState, Consumable } from "../../../engine/dungeonState.ts";
import {
  ABILITY_DESCRIPTIONS,
  ARMOR_PIECE_LABELS,
  type MonsterAbility,
} from "../../../data/dungeonTables.ts";
import type { SpellTableKey } from "../../../data/types.ts";
import { HIRELING_BY_NAME } from "../../../data/hirelings.ts";
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
  /** Snake (Animals, issue #26/#29/#67): "Attack deals Poison" -- true once the player owns one. */
  isSnakeOwner?: boolean;
  /** OPEN_TREASURE can be dispatched mid-fight and can itself fill the Pack (issue #82) -- while a
   * swap choice is pending (resolved from the sidebar Pack card, not this panel), every action
   * here is blocked the same way a pending armor-absorption choice already is. */
  hasPendingPackItem?: boolean;
  onAttack: (targetId: number, roll: number, useHorn?: boolean) => void;
  onCastSpell: (table: SpellTableKey, spellRoll: number, targetId?: number) => void;
  /** Held potions (issue #110) -- drinking one consumes the round exactly like casting a spell, so
   * they belong here beside the Cast buttons rather than only in the sidebar Pack, which this panel's
   * own overlay covers mid-fight. Every one of them is usable in a fight, Potion of Fury included. */
  consumables?: Consumable[];
  onUseConsumable?: (index: number) => void;
  /** Teleport needs a destination room first -- the parent screen owns that picker, so this just
   * signals "the player wants to flee" instead of dispatching CAST_SPELL directly. */
  onFlee: () => void;
  onResolveDamage: (absorbWith: "hp" | "hireling" | number) => void;
  onEngulfBody: () => void;
  /** Issue #84: an employed Hireling's own attack -- a free action that doesn't end the round,
   * dispatched separately from onAttack. */
  onHirelingAttack: (targetId: number, roll: number) => void;
  /** Issue #63: Goblin Helper's own "explode, dealing 5 damage to every monster" -- a one-time,
   * room-wide, free action that self-destructs the Hireling. */
  onHirelingExplode: () => void;
  /** Snake's own attack -- a free action that doesn't end the round, same shape as
   * `onHirelingAttack` but with no die to roll (Snake's damage is a flat 1, not a formula). */
  onAnimalAttack: (targetId: number) => void;
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
  isSnakeOwner = false,
  hasPendingPackItem = false,
  onAttack,
  onCastSpell,
  consumables = [],
  onUseConsumable,
  onFlee,
  onResolveDamage,
  onEngulfBody,
  onHirelingAttack,
  onHirelingExplode,
  onAnimalAttack,
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
  // Issue #84: deliberately not gated on `paralyzed` -- Paralyze's rulebook effect is on the
  // player specifically, and the reducer's own HIRELING_ATTACK gating agrees. `weaponFormula` is
  // absent for a Hireling with no weapon capable of attacking (see HirelingDef's own doc comment).
  const hirelingWeaponFormula = combat.hireling
    ? HIRELING_BY_NAME[combat.hireling.name]?.weaponFormula
    : undefined;
  const hirelingCanAct =
    !rolling &&
    !awaitingDamageChoice &&
    !hasPendingPackItem &&
    hp > 0 &&
    !!combat.hireling &&
    combat.hireling.hp > 0 &&
    !combat.hirelingAttackedThisRound &&
    !!hirelingWeaponFormula;
  // Issue #63: Goblin Helper's own explode -- fixed damage, no die roll needed, so this doesn't
  // share hirelingCanAct's weaponFormula requirement (Goblin Helper has none) or the once-per-
  // round cap (it only ever fires once, period -- the Hireling is gone afterward).
  const canExplode =
    !rolling &&
    !awaitingDamageChoice &&
    !hasPendingPackItem &&
    hp > 0 &&
    combat.hireling?.name === "Goblin Helper" &&
    combat.hireling.hp > 0;
  // Snake (Animals, issue #26/#29/#67): deliberately not gated on `paralyzed`, same reasoning as
  // hirelingCanAct -- and no weaponFormula/HP-of-its-own check, since a Snake can't be harmed or
  // lost, only ever a bonus attack.
  const canAnimalAttack =
    !rolling &&
    !awaitingDamageChoice &&
    !hasPendingPackItem &&
    hp > 0 &&
    isSnakeOwner &&
    !combat.animalAttackedThisRound;
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

  function rollAndHirelingAttack(targetId: number) {
    if (!hirelingCanAct || !hirelingWeaponFormula) return;
    const { rawRoll } = rollWeaponDamage(hirelingWeaponFormula);
    setDieValue(rawRoll);
    setRollToken((t) => t + 1);
    setRolling(true);
    window.setTimeout(() => {
      setRolling(false);
      onHirelingAttack(targetId, rawRoll);
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

      {combat.hireling && (
        <div className={styles.playerRow}>
          <div className={styles.playerLabel}>
            <span>{combat.hireling.name}</span>
          </div>
          <HpBar value={combat.hireling.hp} max={combat.hireling.maxHp} kind="player" />
          <span className={styles.hpText}>
            {combat.hireling.hp} / {combat.hireling.maxHp} HP
          </span>
        </div>
      )}

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
              {combat.hireling && hirelingWeaponFormula && (
                <button
                  type="button"
                  className={styles.attackBtn}
                  disabled={!hirelingCanAct}
                  onClick={() => rollAndHirelingAttack(monster.id)}
                >
                  {combat.hireling.name} Attacks
                </button>
              )}
              {isSnakeOwner && (
                <button
                  type="button"
                  className={styles.attackBtn}
                  disabled={!canAnimalAttack}
                  onClick={() => onAnimalAttack(monster.id)}
                >
                  Snake Attacks
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
                s.name === "Heal"
                  ? castHeal(s)
                  : s.name === "Teleport"
                    ? onFlee()
                    : onCastSpell(s.table, s.roll)
              }
            >
              {s.name === "Teleport" ? "Flee — " : ""}
              {s.name} ({s.uses})
            </button>
          ))}
        </div>
      )}

      {consumables.length > 0 && onUseConsumable && (
        <div className={styles.spellRow}>
          {consumables.map((item, index) => (
            <button
              key={index}
              type="button"
              className={styles.spellBtn}
              disabled={!canAct}
              title={item.text}
              onClick={() => onUseConsumable(index)}
            >
              Drink {item.name}
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

      {combat.hireling?.name === "Goblin Helper" && combat.hireling.hp > 0 && (
        <div className={styles.spellRow}>
          <button
            type="button"
            className={styles.spellBtn}
            disabled={!canExplode}
            title="Goblin Helper detonates, dealing 5 damage to every monster -- then it's gone for good."
            onClick={onHirelingExplode}
          >
            Goblin Helper Explodes
          </button>
        </div>
      )}

      {awaitingDamageChoice && (
        <div className={styles.paralyzed}>
          <p>
            Take {combat.pendingDamage} damage: your call -- absorb it with your HP, or a piece of
            armor.
          </p>
          <div className={styles.monsterActions}>
            <button
              type="button"
              className={styles.attackBtn}
              onClick={() => onResolveDamage("hp")}
            >
              HP ({hp}/{maxHp})
            </button>
            {combat.hireling && combat.hireling.hp > 0 && (
              <button
                type="button"
                className={styles.attackBtn}
                onClick={() => onResolveDamage("hireling")}
              >
                {combat.hireling.name} ({combat.hireling.hp}/{combat.hireling.maxHp})
              </button>
            )}
            {armor.map((piece, index) =>
              piece.hp > 0 ? (
                <button
                  key={index}
                  type="button"
                  className={styles.attackBtn}
                  onClick={() => onResolveDamage(index)}
                >
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
            You are paralyzed and cannot act ({combat.paralyzedTurns} turn
            {combat.paralyzedTurns > 1 ? "s" : ""} left)!
          </p>
          <button type="button" className={styles.attackBtn} onClick={handleContinueParalyzed}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
