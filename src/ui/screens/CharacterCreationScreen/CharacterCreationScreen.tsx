import { useMemo, useState } from "react";
import { DicePool } from "../../components/DicePool/DicePool.tsx";
import { Graveyard } from "../../components/Graveyard/Graveyard.tsx";
import {
  computeSpellRequirements,
  computeTotalHp,
  rollClass,
  rollRace,
  rollSpell,
} from "../../../engine/character.ts";
import { loadGraveyard } from "../../../engine/graveyard.ts";
import type { PendingDungeon } from "../../../engine/dungeonState.ts";
import { SPELL_TABLE } from "../../../data/spells.ts";
import type { ClassDef, CreatedCharacter, RaceDef, SpellDef } from "../../../data/types.ts";
import { revealDelay } from "../../rollTiming.ts";
import styles from "./CharacterCreationScreen.module.css";

const STARTING_TORCHES = 10;
const STARTING_COINS = 0;
const SEAL_TO_DESCEND_MS = 1100;

interface RollState<T> {
  values: number[];
  rollToken: number;
  entry: T | null;
  revealing: boolean;
}

function initialRoll<T>(diceCount: number): RollState<T> {
  return { values: Array(diceCount).fill(1) as number[], rollToken: 0, entry: null, revealing: false };
}

interface SpellRollState {
  values: number[];
  rollToken: number;
  entries: SpellDef[] | null;
  revealing: boolean;
}

const initialSpellRoll: SpellRollState = { values: [], rollToken: 0, entries: null, revealing: false };

export interface CharacterCreationScreenProps {
  pendingDungeons: PendingDungeon[];
  onDescend: (character: CreatedCharacter, resumeDungeon: PendingDungeon | null) => void;
}

export function CharacterCreationScreen({ pendingDungeons, onDescend }: CharacterCreationScreenProps) {
  const [name, setName] = useState("");
  const [race, setRace] = useState<RollState<RaceDef>>(() => initialRoll(2));
  const [cls, setCls] = useState<RollState<ClassDef>>(() => initialRoll(2));
  const [spells, setSpells] = useState<SpellRollState>(initialSpellRoll);
  const [sealed, setSealed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [graveyard] = useState(() => loadGraveyard());

  const spellRequirements = useMemo(
    () => computeSpellRequirements(race.entry, cls.entry),
    [race.entry, cls.entry],
  );

  // A reroll of either race or class can change how many spells are owed, so
  // any previously-rolled random spells no longer apply. Adjusting state
  // during render (React's documented pattern for this) instead of an effect
  // avoids an extra commit-then-reset render pass.
  const [spellsResetFor, setSpellsResetFor] = useState<{ race: RaceDef | null; cls: ClassDef | null }>({
    race: race.entry,
    cls: cls.entry,
  });
  if (spellsResetFor.race !== race.entry || spellsResetFor.cls !== cls.entry) {
    setSpellsResetFor({ race: race.entry, cls: cls.entry });
    setSpells(initialSpellRoll);
  }

  function handleRollRace() {
    if (race.revealing || sealed) return;
    const { dice, entry } = rollRace();
    setRace((prev) => ({ values: dice, rollToken: prev.rollToken + 1, entry: null, revealing: true }));
    window.setTimeout(() => {
      setRace((prev) => ({ ...prev, entry, revealing: false }));
      setAnnouncement(`Race rolled: ${entry.name} on a ${dice[0]! + dice[1]!}.`);
    }, revealDelay(dice.length));
  }

  function handleRollClass() {
    if (cls.revealing || sealed) return;
    const { dice, entry } = rollClass();
    setCls((prev) => ({ values: dice, rollToken: prev.rollToken + 1, entry: null, revealing: true }));
    window.setTimeout(() => {
      setCls((prev) => ({ ...prev, entry, revealing: false }));
      setAnnouncement(`Class rolled: ${entry.name} on a ${dice[0]! + dice[1]!}.`);
    }, revealDelay(dice.length));
  }

  function handleRollSpells() {
    if (spells.revealing || spells.entries !== null || sealed || spellRequirements.randomSlots === 0) return;
    const rolls = Array.from({ length: spellRequirements.randomSlots }, () => rollSpell());
    const values = rolls.map((r) => r.dice[0]!);
    const entries = rolls.map((r) => r.entry);
    setSpells((prev) => ({ values, rollToken: prev.rollToken + 1, entries: null, revealing: true }));
    window.setTimeout(() => {
      setSpells((prev) => ({ ...prev, entries, revealing: false }));
      setAnnouncement(`Rolled ${values.length} Basic Spell${values.length > 1 ? "s" : ""}.`);
    }, revealDelay(values.length));
  }

  const totalHp = race.entry && cls.entry ? computeTotalHp(race.entry, cls.entry) : null;
  const weaponText = cls.entry ? `${cls.entry.weapon} (${cls.entry.weaponDamage})` : null;
  const spellsSatisfied = spellRequirements.randomSlots === 0 || spells.entries !== null;
  const hasName = name.trim().length > 0;
  const canBegin = hasName && race.entry !== null && cls.entry !== null && spellsSatisfied && !sealed;

  function handleBegin(resumeDungeon: PendingDungeon | null = null) {
    if (!canBegin || !race.entry || !cls.entry) return;
    setSealed(true);
    const character: CreatedCharacter = {
      name: name.trim(),
      race: race.entry,
      cls: cls.entry,
      totalHp: computeTotalHp(race.entry, cls.entry),
      spells: spells.entries ?? [],
      fixedGrants: spellRequirements.fixedGrants,
      torches: STARTING_TORCHES,
      coins: STARTING_COINS,
    };
    window.setTimeout(() => onDescend(character, resumeDungeon), SEAL_TO_DESCEND_MS);
  }

  const spellsNoteText = useMemo(() => {
    const parts: string[] = [];
    if (spellRequirements.randomSlots > 0) {
      parts.push(
        `Roll ${spellRequirements.randomSlots} random Basic Spell${spellRequirements.randomSlots > 1 ? "s" : ""}.`,
      );
    }
    for (const grant of spellRequirements.fixedGrants) {
      const spell = SPELL_TABLE[grant.spellRoll];
      if (spell) parts.push(`${spell.name} is granted outright (${grant.uses} uses).`);
    }
    return parts.length > 0 ? parts.join(" ") : "This build carries no spells — steel and nerve only.";
  }, [spellRequirements]);

  const beginStatusText =
    sealed && race.entry && cls.entry
      ? `${name.trim()}, the ${race.entry.name} ${cls.entry.name} — ${computeTotalHp(race.entry, cls.entry)} HP, ${STARTING_TORCHES} torches, ${STARTING_COINS} coins. The dungeon awaits.`
      : !sealed && !hasName && (race.entry || cls.entry)
        ? "Name your adventurer before descending."
        : "";

  return (
    <div className={styles.page}>
      <header className={styles.wordmark}>
        <h1>NoteQuest</h1>
        <p className={styles.tagline}>
          A weak adventurer, after fame and fortune. Good luck — you&apos;re gonna need it.
        </p>
      </header>

      <main className={styles.sheet} aria-label="Character creation sheet">
        <div className={styles.sheetInner}>
          <div className={styles.sheetHead}>
            <span className={styles.sheetLabel}>Adventurer&apos;s Ledger</span>
            <span className={styles.nameLine}>
              <label htmlFor="adv-name">
                Name<span className={styles.required}>*</span>
              </label>
              <input
                id="adv-name"
                type="text"
                placeholder="required"
                maxLength={24}
                autoComplete="off"
                required
                data-testid="name-input"
                value={name}
                disabled={sealed}
                onChange={(event) => setName(event.target.value)}
              />
            </span>
          </div>

          <div className={styles.tracks}>
            <section>
              <h2 className={styles.trackTitle}>
                <span className={styles.trackIndex}>2d6</span>Race
              </h2>
              <DicePool values={race.values} rollToken={race.rollToken} />
              <button
                className={styles.rollBtn}
                type="button"
                data-testid="race-roll-btn"
                disabled={race.revealing || sealed}
                onClick={handleRollRace}
              >
                {race.entry ? "Reroll Race" : "Roll for Race"}
              </button>
              {race.entry && (
                <div className={styles.resultCard} data-testid="race-result">
                  <p className={styles.resultName}>
                    {race.entry.name} · {race.values[0]! + race.values[1]!}
                  </p>
                  <dl className={styles.resultStats}>
                    <div>
                      <dt>HP</dt>
                      <dd>{race.entry.hp}</dd>
                    </div>
                  </dl>
                  <p className={styles.resultAbility}>{race.entry.ability}</p>
                </div>
              )}
            </section>

            <section>
              <h2 className={styles.trackTitle}>
                <span className={styles.trackIndex}>2d6</span>Class
              </h2>
              <DicePool values={cls.values} rollToken={cls.rollToken} />
              <button
                className={styles.rollBtn}
                type="button"
                data-testid="class-roll-btn"
                disabled={cls.revealing || sealed}
                onClick={handleRollClass}
              >
                {cls.entry ? "Reroll Class" : "Roll for Class"}
              </button>
              {cls.entry && (
                <div className={styles.resultCard} data-testid="class-result">
                  <p className={styles.resultName}>
                    {cls.entry.name} · {cls.values[0]! + cls.values[1]!}
                  </p>
                  <dl className={styles.resultStats}>
                    <div>
                      <dt>HP</dt>
                      <dd>+{cls.entry.hpBonus}</dd>
                    </div>
                    <div>
                      <dt>Weapon</dt>
                      <dd>
                        {cls.entry.weapon} ({cls.entry.weaponDamage})
                      </dd>
                    </div>
                  </dl>
                  <p className={styles.resultAbility}>{cls.entry.ability}</p>
                </div>
              )}
            </section>
          </div>

          {(race.entry || cls.entry) && (
            <section className={styles.trackSpells}>
              <h2 className={styles.trackTitle}>
                <span className={styles.trackIndex}>
                  {spellRequirements.randomSlots > 0 ? `${spellRequirements.randomSlots}d6` : "—"}
                </span>
                Basic Spells
              </h2>
              <p className={styles.spellsNote}>{spellsNoteText}</p>

              {spellRequirements.randomSlots > 0 && (
                <>
                  <DicePool values={spells.values} rollToken={spells.rollToken} size={40} />
                  <button
                    className={styles.rollBtn}
                    type="button"
                    data-testid="spells-roll-btn"
                    disabled={spells.revealing || spells.entries !== null || sealed}
                    onClick={handleRollSpells}
                  >
                    {spells.entries ? "Spells Rolled" : "Roll for Spells"}
                  </button>
                </>
              )}

              {(spellRequirements.fixedGrants.length > 0 || spells.entries) && (
                <ul className={styles.spellList} data-testid="spell-list">
                  {spellRequirements.fixedGrants.map((grant, index) => {
                    const spell = SPELL_TABLE[grant.spellRoll];
                    if (!spell) return null;
                    return (
                      <li key={`fixed-${index}`}>
                        <span className={styles.spellName}>{spell.name}</span>
                        <span className={styles.spellFx}>{spell.effect}</span>
                        <br />
                        <span className={styles.spellTag}>
                          GRANTED · {grant.uses} USES
                        </span>
                      </li>
                    );
                  })}
                  {spells.entries?.map((spell, index) => (
                    <li key={`rolled-${index}`}>
                      <span className={styles.spellName}>{spell.name}</span>
                      <span className={styles.spellFx}>{spell.effect}</span>
                      <br />
                      <span className={styles.spellTag}>d6 → {spells.values[index]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <footer className={styles.ledger}>
            <div className={styles.ledgerRow}>
              <div className={styles.ledgerItem}>
                <span className={styles.lLabel}>Total HP</span>
                <span className={styles.lValue}>{totalHp ?? "—"}</span>
              </div>
              <div className={styles.ledgerItem}>
                <span className={styles.lLabel}>Weapon</span>
                <span className={styles.lValue}>{weaponText ?? "—"}</span>
              </div>
              <div className={styles.ledgerItem}>
                <span className={styles.lLabel}>Torches</span>
                <span className={styles.lValue}>10</span>
              </div>
              <div className={styles.ledgerItem}>
                <span className={styles.lLabel}>Coins</span>
                <span className={styles.lValue}>0</span>
              </div>
            </div>
            <button
              className={styles.beginBtn}
              type="button"
              data-testid="begin-btn"
              disabled={!canBegin}
              onClick={() => handleBegin(null)}
            >
              {sealed ? "Character Sealed" : "Descend Into the Dungeon"}
            </button>
            <p className={styles.beginStatus} data-testid="begin-status" aria-live="polite">
              {beginStatusText}
            </p>

            {pendingDungeons.length > 0 && (
              <div className={styles.resumeSection}>
                <p className={styles.resumeLabel}>Or take up an unfinished dungeon:</p>
                <ul className={styles.resumeList}>
                  {pendingDungeons.map((pd) => (
                    <li key={pd.id}>
                      <button
                        className={styles.resumeBtn}
                        type="button"
                        disabled={!canBegin}
                        onClick={() => handleBegin(pd)}
                      >
                        <span className={styles.resumeName}>
                          {pd.dungeon.dungeonName ?? "An unnamed dungeon"} — Level {pd.dungeon.activeLevel + 1}
                        </span>
                        <span className={styles.resumeMeta}>last explored by {pd.lastCharacterName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </footer>
        </div>
      </main>

      <Graveyard entries={graveyard} />

      <footer className={styles.credit}>
        <p>NOTEQUEST · CHARACTER CREATION</p>
        <p className={styles.creditSub}>
          NoteQuest was created by Tiago Junges — this is an unofficial fan-made adaptation. Support the
          original on{" "}
          <a
            className={styles.creditLink}
            href="https://www.drivethrurpg.com/en/product/365859/notequest-expanded-world?src=also_purchased"
            target="_blank"
            rel="noopener noreferrer"
          >
            DriveThruRPG
          </a>
          .
        </p>
      </footer>

      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
