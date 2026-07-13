import { useReducer, useState } from "react";
import { dungeonReducer } from "../../../engine/dungeonReducer.ts";
import { createInitialDungeonState, type DungeonAction, type DungeonState } from "../../../engine/dungeonState.ts";

// useReducer expects a strict (state, action) => state shape; dungeonReducer's
// extra (test-only) `rng` parameter is optional and defaults to Math.random,
// so this thin wrapper is enough to satisfy React's inferred dispatch type.
function reduceDungeon(state: DungeonState, action: DungeonAction): DungeonState {
  return dungeonReducer(state, action);
}
import { rollDie } from "../../../engine/dice.ts";
import { computeSpellUses } from "../../../engine/character.ts";
import type { CreatedCharacter } from "../../../data/types.ts";
import { DicePool } from "../../components/DicePool/DicePool.tsx";
import { CharacterSheet } from "../../components/CharacterSheet/CharacterSheet.tsx";
import { CombatPanel } from "../../components/CombatPanel/CombatPanel.tsx";
import { DungeonMap } from "../../components/DungeonMap/DungeonMap.tsx";
import { LevelTabs } from "../../components/LevelTabs/LevelTabs.tsx";
import { RoomInspector } from "../../components/RoomInspector/RoomInspector.tsx";
import { RollLog } from "../../components/RollLog/RollLog.tsx";
import { revealDelay } from "../../rollTiming.ts";
import styles from "./DungeonScreen.module.css";

export interface DungeonScreenProps {
  character: CreatedCharacter;
}

export function DungeonScreen({ character }: DungeonScreenProps) {
  const [state, dispatch] = useReducer(reduceDungeon, character, (c) =>
    createInitialDungeonState(c.torches, c.totalHp, c.cls.weaponDamage, computeSpellUses(c.spells, c.fixedGrants)),
  );
  const [diceValues, setDiceValues] = useState<number[]>([1, 1, 1]);
  const [diceRollToken, setDiceRollToken] = useState(0);
  const [rollingDungeon, setRollingDungeon] = useState(false);

  const hasDungeon = state.levels.length > 0;
  const bossDefeated = state.levels.some(
    (lvl) => lvl.isFinalRoomLevel && lvl.segments[0]?.type === "final" && lvl.segments[0]?.monstersDefeated,
  );

  function handleRollDungeon() {
    if (rollingDungeon) return;
    const rolls = [rollDie(), rollDie(), rollDie()];
    setDiceValues(rolls);
    setDiceRollToken((t) => t + 1);
    setRollingDungeon(true);
    window.setTimeout(() => {
      setRollingDungeon(false);
      dispatch({ type: "ROLL_DUNGEON", typeRoll: rolls[0]!, secondRoll: rolls[1]!, thirdRoll: rolls[2]! });
    }, revealDelay(3));
  }

  return (
    <div className={styles.page}>
      <header className={styles.wordmark}>
        <h1>NoteQuest</h1>
        <p className={styles.tagline}>The dungeon is built as you explore it.</p>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <main className={styles.sheet}>
            <div className={styles.sheetInner}>
              <span className={styles.sheetLabel}>Dungeon Log</span>

              {!hasDungeon ? (
                <section>
                  <h2 className={styles.trackTitle}>
                    <span className={styles.dieBadge}>3d6</span>Roll for Dungeon
                  </h2>
                  <p className={styles.gateCopy}>
                    One die picks the dungeon&apos;s type, two more shape its name. The dungeon is built as
                    you explore it — door by door, from here on out.
                  </p>
                  <div className={styles.diceRow}>
                    <DicePool values={diceValues} rollToken={diceRollToken} />
                  </div>
                  <button className={styles.rollBtn} type="button" disabled={rollingDungeon} onClick={handleRollDungeon}>
                    Roll for Dungeon
                  </button>
                </section>
              ) : (
                <section className={styles.dungeonHeader}>
                  <p className={styles.dungeonEyebrow}>Level {state.activeLevel + 1}</p>
                  <h2 className={styles.dungeonName}>{state.dungeonName}</h2>
                  <p className={styles.dungeonEntrance}>{state.entranceFlavor}</p>
                  <button className={styles.ghostBtn} type="button" onClick={() => dispatch({ type: "RESET" })}>
                    Start a New Dungeon
                  </button>
                </section>
              )}

              {!state.alive && state.deathCause === "combat" && (
                <div className={styles.deathPanel}>
                  <p className={styles.deathTitle}>{character.name} Has Fallen</p>
                  <p>Overwhelmed in combat, {character.name} goes down. The dungeon keeps what it took.</p>
                </div>
              )}
              {!state.alive && state.deathCause !== "combat" && (
                <div className={styles.deathPanel}>
                  <p className={styles.deathTitle}>The Darkness Devours You</p>
                  <p>
                    {character.name}&apos;s torch has burned out with no way to relight it. The dungeon keeps
                    what it took.
                  </p>
                </div>
              )}
              {state.alive && bossDefeated && (
                <div className={styles.victoryPanel}>
                  <p className={styles.victoryTitle}>The Dungeon Boss Falls</p>
                  <p>{character.name} stands victorious over the dungeon&apos;s master. The depths grow quiet.</p>
                </div>
              )}
            </div>
          </main>

          {hasDungeon && (
            <>
              <LevelTabs
                count={state.levels.length}
                activeLevel={state.activeLevel}
                onSwitchLevel={(levelIndex) => dispatch({ type: "SWITCH_LEVEL", levelIndex })}
              />
              {state.combat && (
                <CombatPanel
                  combat={state.combat}
                  hp={state.hp}
                  maxHp={state.maxHp}
                  weaponName={character.cls.weapon}
                  weaponFormula={character.cls.weaponDamage}
                  spellUses={state.spellUses}
                  onAttack={(targetId, roll) => dispatch({ type: "PLAYER_ATTACK", targetId, roll })}
                  onCastSpell={(spellRoll, targetId) => dispatch({ type: "CAST_SPELL", spellRoll, targetId })}
                />
              )}
              <DungeonMap
                state={state}
                onDoorResolved={(segId, doorIdx, roll, wasNoisy) =>
                  dispatch({ type: "OPEN_DOOR", segId, doorIdx, roll, wasNoisy })
                }
                onResolveLock={(segId, doorIdx, doorRoll, trapRoll, lockChoice) =>
                  dispatch({ type: "RESOLVE_DOOR_LOCK", segId, doorIdx, doorRoll, trapRoll, lockChoice })
                }
                onSelectSegment={(segId) => dispatch({ type: "SELECT_SEGMENT", segId })}
                onSwitchLevel={(levelIndex) => dispatch({ type: "SWITCH_LEVEL", levelIndex })}
              />
              <RoomInspector
                key={state.selectedSegId ?? "none"}
                state={state}
                onRollSecretPassage={(segId, roll, trapRoll) =>
                  dispatch({ type: "ROLL_SECRET_PASSAGE", segId, roll, trapRoll })
                }
              />
              <RollLog entries={state.log} />
            </>
          )}

          <p className={styles.scopeNote}>
            Breaking a door or setting off a trap alerts monsters beyond it, letting them strike first — the
            armor system isn&apos;t modeled yet.
          </p>
        </div>

        <aside className={styles.side}>
          <CharacterSheet
            character={character}
            torches={state.torches}
            hp={state.hp}
            coins={state.coins}
            spellUses={state.spellUses}
            canCastOutOfCombat={hasDungeon && state.alive && !state.combat}
            onCastSpell={(spellRoll) => dispatch({ type: "CAST_SPELL", spellRoll })}
          />

          {hasDungeon && (
            <div className={styles.statsCard}>
              <h3>Ledger</h3>
              <dl>
                <dt>Segments</dt>
                <dd>{state.stats.segments}</dd>
                <dt>Corridors</dt>
                <dd>{state.stats.corridors}</dd>
                <dt>Rooms</dt>
                <dd>{state.stats.rooms}</dd>
                <dt>Staircases</dt>
                <dd>{state.stats.staircases}</dd>
                <dt>Doors remaining</dt>
                <dd>{state.stats.doorsRemaining}</dd>
                <dt>Levels</dt>
                <dd>{state.levels.length}</dd>
                <dt>Final Rooms</dt>
                <dd>{state.stats.finalRooms}</dd>
              </dl>
            </div>
          )}
        </aside>
      </div>

      <footer className={styles.credit}>NOTEQUEST · THE DUNGEON</footer>
    </div>
  );
}
