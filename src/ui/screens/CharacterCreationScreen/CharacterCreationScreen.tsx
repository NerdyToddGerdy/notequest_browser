import { useMemo, useState } from "react";
import { DicePool } from "../../components/DicePool/DicePool.tsx";
import { RecordsPanel } from "../../components/RecordsPanel/RecordsPanel.tsx";
import {
  computeSpellRequirements,
  computeTotalHp,
  rollClass,
  rollName,
  rollRaceFromTable,
  rollSpellFromTable,
  SPELL_TABLE_BY_KEY,
  type RaceTableKey,
} from "../../../engine/character.ts";
import { loadGraveyard } from "../../../engine/graveyard.ts";
import type { PendingDungeon } from "../../../engine/dungeonState.ts";
import type { ClassDef, CreatedCharacter, RaceDef, SpellDef, SpellTableKey } from "../../../data/types.ts";
import { revealDelay } from "../../rollTiming.ts";
import { Footer } from "../../components/Footer/Footer.tsx";
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

/** One rolled spell keeps its own dice alongside it (1 for a flat 1d6 table, 2 for Advanced's
 * 2d6), rather than just the `SpellDef`, so the result list can show "d6 → 3" or "2d6 → 8"
 * correctly regardless of which table it came from. */
interface RolledSpell {
  spell: SpellDef;
  dice: number[];
}

interface SpellRollState {
  values: number[];
  rollToken: number;
  entries: RolledSpell[] | null;
  revealing: boolean;
}

const initialSpellRoll: SpellRollState = { values: [], rollToken: 0, entries: null, revealing: false };

/** "New Races" (issue #22) -- Prohibited Races is deliberately not offered here, see races.ts. */
const RACE_TABLE_LABELS: Record<RaceTableKey, string> = {
  core: "Core",
  uncommon: "Uncommon",
  exotic: "Exotic",
  monstrous: "Monstrous",
};

/** "New Spells" (issue #24) -- which table(s) `spellRequirements.randomSlotsByTable` owes rolls
 * from. Never a player choice (see `computeSpellRequirements`'s own doc comment) -- this is purely
 * a display label for whichever table(s) a race/class grant already picked. */
const SPELL_TABLE_LABELS: Record<SpellTableKey, string> = {
  basic: "Basic",
  nature: "Nature",
  death: "Death",
  elemental: "Elemental",
  advanced: "Advanced",
};

export interface CharacterCreationScreenProps {
  /** The character heads to Town next, not straight into a dungeon -- see App.tsx's screen state. */
  onCharacterCreated: (character: CreatedCharacter) => void;
  /** Every dungeon any character has touched -- shown here read-only, alongside the Graveyard, via
   * RecordsPanel's tab switcher. */
  dungeonHistory: PendingDungeon[];
  onHardReset: () => void;
}

export function CharacterCreationScreen({
  onCharacterCreated,
  dungeonHistory,
  onHardReset,
}: CharacterCreationScreenProps) {
  const [name, setName] = useState("");
  const [raceTable, setRaceTable] = useState<RaceTableKey>("core");
  const [race, setRace] = useState<RollState<RaceDef>>(() => initialRoll(2));
  const [cls, setCls] = useState<RollState<ClassDef>>(() => initialRoll(2));
  // "New Spells" (issue #24) -- keyed by table rather than one flat roll, since a race and class
  // can (rarely) owe random slots from two different tables at once (e.g. Corvino's 5 random
  // Advanced Spells alongside a Scholar's 3 random Basic ones) -- see computeSpellRequirements().
  const [spellRolls, setSpellRolls] = useState<Partial<Record<SpellTableKey, SpellRollState>>>({});
  const [sealed, setSealed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [graveyard] = useState(() => loadGraveyard());

  const spellRequirements = useMemo(
    () => computeSpellRequirements(race.entry, cls.entry),
    [race.entry, cls.entry],
  );
  const requiredSpellTables = Object.keys(spellRequirements.randomSlotsByTable) as SpellTableKey[];

  // A reroll of either race or class can change how many spells (and from which table) are owed,
  // so any previously-rolled random spells no longer apply. Adjusting state during render (React's
  // documented pattern for this) instead of an effect avoids an extra commit-then-reset render pass.
  const [spellsResetFor, setSpellsResetFor] = useState<{ race: RaceDef | null; cls: ClassDef | null }>({
    race: race.entry,
    cls: cls.entry,
  });
  if (spellsResetFor.race !== race.entry || spellsResetFor.cls !== cls.entry) {
    setSpellsResetFor({ race: race.entry, cls: cls.entry });
    setSpellRolls({});
  }

  function handleRollRace() {
    if (race.revealing || sealed) return;
    const { dice, entry } = rollRaceFromTable(raceTable);
    setRace((prev) => ({ values: dice, rollToken: prev.rollToken + 1, entry: null, revealing: true }));
    window.setTimeout(() => {
      setRace((prev) => ({ ...prev, entry, revealing: false }));
      setAnnouncement(`Race rolled: ${entry.name} on a ${dice.reduce((a, b) => a + b, 0)}.`);
    }, revealDelay(dice.length));
  }

  // "New Races" (issue #22) -- switching tables is a fresh choice ("Instead of rolling a race on
  // the base table, you can choose one of these tables"), not a modifier stacked onto whatever was
  // already rolled, so any current race roll is cleared along with it. The Core table rolls 2d6;
  // every other table is 1d6 (Half-Human's own bonus reroll aside -- see rollRaceFromTable()).
  function handleSelectRaceTable(table: RaceTableKey) {
    if (sealed || table === raceTable) return;
    setRaceTable(table);
    setRace(initialRoll(table === "core" ? 2 : 1));
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

  // Not a rulebook mechanic (issue #40) -- rolls into the name field directly, still freely
  // editable afterward like typing one in by hand. Uses the rolled race's own name table once one
  // exists, so re-rolling after Race changes gives an on-theme result; "default" beforehand.
  function handleRollName() {
    if (sealed) return;
    const { entry } = rollName(race.entry?.name ?? "default");
    setName(entry);
  }

  function handleRollSpells(table: SpellTableKey) {
    const current = spellRolls[table];
    const count = spellRequirements.randomSlotsByTable[table] ?? 0;
    if (count === 0 || current?.revealing || current?.entries != null || sealed) return;
    const rolls = Array.from({ length: count }, () => rollSpellFromTable(table));
    const values = rolls.flatMap((r) => r.dice);
    const entries = rolls.map((r) => ({ spell: r.entry, dice: r.dice }));
    setSpellRolls((prev) => ({
      ...prev,
      [table]: { values, rollToken: (prev[table]?.rollToken ?? 0) + 1, entries: null, revealing: true },
    }));
    window.setTimeout(() => {
      setSpellRolls((prev) => ({ ...prev, [table]: { ...prev[table]!, entries, revealing: false } }));
      setAnnouncement(
        `Rolled ${entries.length} ${SPELL_TABLE_LABELS[table]} Spell${entries.length > 1 ? "s" : ""}.`,
      );
    }, revealDelay(values.length));
  }

  const totalHp = race.entry && cls.entry ? computeTotalHp(race.entry, cls.entry) : null;
  const weaponText = cls.entry ? `${cls.entry.weapon} (${cls.entry.weaponDamage})` : null;
  const spellsSatisfied = requiredSpellTables.every((table) => spellRolls[table]?.entries != null);
  const hasName = name.trim().length > 0;
  const canBegin = hasName && race.entry !== null && cls.entry !== null && spellsSatisfied && !sealed;

  function handleBegin() {
    if (!canBegin || !race.entry || !cls.entry) return;
    setSealed(true);
    const rolledSpells = requiredSpellTables.flatMap(
      (table) => spellRolls[table]?.entries?.map((r) => r.spell) ?? [],
    );
    const character: CreatedCharacter = {
      name: name.trim(),
      race: race.entry,
      cls: cls.entry,
      totalHp: computeTotalHp(race.entry, cls.entry),
      spells: rolledSpells,
      fixedGrants: spellRequirements.fixedGrants,
      torches: STARTING_TORCHES,
      coins: STARTING_COINS,
    };
    window.setTimeout(() => onCharacterCreated(character), SEAL_TO_DESCEND_MS);
  }

  const spellsNoteText = useMemo(() => {
    const parts: string[] = [];
    for (const table of requiredSpellTables) {
      const count = spellRequirements.randomSlotsByTable[table]!;
      parts.push(`Roll ${count} random ${SPELL_TABLE_LABELS[table]} Spell${count > 1 ? "s" : ""}.`);
    }
    for (const grant of spellRequirements.fixedGrants) {
      const spell = SPELL_TABLE_BY_KEY[grant.table][grant.spellRoll];
      if (spell) parts.push(`${spell.name} is granted outright (${grant.uses} uses).`);
    }
    return parts.length > 0 ? parts.join(" ") : "This build carries no spells — steel and nerve only.";
    // requiredSpellTables is derived from spellRequirements every render, so depending on the
    // latter alone already covers both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spellRequirements]);

  const beginStatusText =
    sealed && race.entry && cls.entry
      ? `${name.trim()}, the ${race.entry.name} ${cls.entry.name} — ${computeTotalHp(race.entry, cls.entry)} HP, ${STARTING_TORCHES} torches, ${STARTING_COINS} coins. The town awaits.`
      : !sealed && !hasName && (race.entry || cls.entry)
        ? "Name your adventurer before setting out."
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
              <button
                type="button"
                className={styles.nameRollBtn}
                data-testid="name-roll-btn"
                disabled={sealed}
                onClick={handleRollName}
              >
                Random Name
              </button>
            </span>
          </div>

          <div className={styles.tracks}>
            <section>
              <h2 className={styles.trackTitle}>
                <span className={styles.trackIndex}>{raceTable === "core" ? "2d6" : "1d6"}</span>Race
              </h2>
              <div className={styles.raceTableRow} data-testid="race-table-row">
                {(Object.keys(RACE_TABLE_LABELS) as RaceTableKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={raceTable === key ? styles.raceTableBtnActive : styles.raceTableBtn}
                    data-testid={`race-table-${key}`}
                    disabled={sealed}
                    onClick={() => handleSelectRaceTable(key)}
                  >
                    {RACE_TABLE_LABELS[key]}
                  </button>
                ))}
              </div>
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
                    {race.entry.name} · {race.values.reduce((a, b) => a + b, 0)}
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
                  {requiredSpellTables.length > 0
                    ? requiredSpellTables
                        .map((t) => `${spellRequirements.randomSlotsByTable[t]}${t === "advanced" ? "x2d6" : "d6"}`)
                        .join(" + ")
                    : "—"}
                </span>
                Spells
              </h2>
              <p className={styles.spellsNote}>{spellsNoteText}</p>

              {requiredSpellTables.map((table) => {
                const rollState = spellRolls[table] ?? initialSpellRoll;
                return (
                  <div key={table} className={styles.spellTableRoll}>
                    <DicePool values={rollState.values} rollToken={rollState.rollToken} size={40} />
                    <button
                      className={styles.rollBtn}
                      type="button"
                      data-testid={`spells-roll-btn-${table}`}
                      disabled={rollState.revealing || rollState.entries !== null || sealed}
                      onClick={() => handleRollSpells(table)}
                    >
                      {rollState.entries
                        ? `${SPELL_TABLE_LABELS[table]} Spells Rolled`
                        : `Roll for ${SPELL_TABLE_LABELS[table]} Spells`}
                    </button>
                  </div>
                );
              })}

              {(spellRequirements.fixedGrants.length > 0 ||
                requiredSpellTables.some((table) => spellRolls[table]?.entries)) && (
                <ul className={styles.spellList} data-testid="spell-list">
                  {spellRequirements.fixedGrants.map((grant, index) => {
                    const spell = SPELL_TABLE_BY_KEY[grant.table][grant.spellRoll];
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
                  {requiredSpellTables.flatMap((table) =>
                    (spellRolls[table]?.entries ?? []).map((rolled, index) => (
                      <li key={`rolled-${table}-${index}`}>
                        <span className={styles.spellName}>{rolled.spell.name}</span>
                        <span className={styles.spellFx}>{rolled.spell.effect}</span>
                        <br />
                        <span className={styles.spellTag}>
                          {rolled.dice.length > 1 ? "2d6" : "d6"} → {rolled.dice.reduce((a, b) => a + b, 0)}
                        </span>
                      </li>
                    )),
                  )}
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
              onClick={() => handleBegin()}
            >
              {sealed ? "Character Sealed" : "Set Out for Town"}
            </button>
            <p className={styles.beginStatus} data-testid="begin-status" aria-live="polite">
              {beginStatusText}
            </p>
          </footer>
        </div>
      </main>

      {/* No WorldState/player position exists here to sort dungeons by distance (issue #80) --
          reversed for recency instead (most recently touched first), same fallback DungeonsList
          used unconditionally before that issue. */}
      <RecordsPanel graveyardEntries={graveyard} dungeons={[...dungeonHistory].reverse()} />

      <Footer screenLabel="CHARACTER CREATION" onHardReset={onHardReset} />

      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
