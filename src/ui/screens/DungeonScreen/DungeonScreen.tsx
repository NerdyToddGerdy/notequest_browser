import { useEffect, useReducer, useRef, useState } from "react";
import { dungeonReducer } from "../../../engine/dungeonReducer.ts";
import {
  createInitialDungeonState,
  isDungeonBeaten,
  type DungeonAction,
  type DungeonState,
  type PendingDungeon,
} from "../../../engine/dungeonState.ts";
import { addGraveyardEntry } from "../../../engine/graveyard.ts";

// useReducer expects a strict (state, action) => state shape; dungeonReducer's
// extra (test-only) `rng` parameter is optional and defaults to Math.random,
// so this thin wrapper is enough to satisfy React's inferred dispatch type.
function reduceDungeon(state: DungeonState, action: DungeonAction): DungeonState {
  return dungeonReducer(state, action);
}
import { rollDie } from "../../../engine/dice.ts";
import { computeSpellUses } from "../../../engine/character.ts";
import type { AdventurerResources } from "../../../engine/town.ts";
import type { CreatedCharacter } from "../../../data/types.ts";
import { Die } from "../../components/Die/Die.tsx";
import { DicePool } from "../../components/DicePool/DicePool.tsx";
import { CharacterSheet } from "../../components/CharacterSheet/CharacterSheet.tsx";
import { Equipment } from "../../components/Equipment/Equipment.tsx";
import { Pack } from "../../components/Pack/Pack.tsx";
import { CombatPanel } from "../../components/CombatPanel/CombatPanel.tsx";
import { DungeonMap } from "../../components/DungeonMap/DungeonMap.tsx";
import { LevelTabs } from "../../components/LevelTabs/LevelTabs.tsx";
import { RoomInspector } from "../../components/RoomInspector/RoomInspector.tsx";
import { RollLog } from "../../components/RollLog/RollLog.tsx";
import { revealDelay } from "../../rollTiming.ts";
import styles from "./DungeonScreen.module.css";

export interface DungeonScreenProps {
  character: CreatedCharacter;
  /** The character's current stats -- seeds a fresh dungeon roll, or either resume path below. */
  resources: AdventurerResources;
  /** This character's own paused dungeon, if they retreated from one earlier and it isn't beaten. */
  activeDungeon: PendingDungeon | null;
  /** A dead adventurer's abandoned dungeon the player picked up in Town, if any. */
  resumeDungeon: PendingDungeon | null;
  /** Sends the player back to Character Creation to roll a new adventurer -- this one is permadead. */
  onNewAdventurer: () => void;
  /** A voluntary retreat, alive -- back to Town with this run's current resources and map saved. */
  onReturnToTown: (runId: string, dungeon: DungeonState) => void;
  /** Fires whenever this run ends (death, retreat, or "Start a New Dungeon") so it can be resumed later if unbeaten. */
  onLeaveDungeon: (runId: string, dungeon: DungeonState, characterName: string) => void;
}

export function DungeonScreen({
  character,
  resources,
  activeDungeon,
  resumeDungeon,
  onNewAdventurer,
  onReturnToTown,
  onLeaveDungeon,
}: DungeonScreenProps) {
  const [runId, setRunId] = useState(() => activeDungeon?.id ?? resumeDungeon?.id ?? crypto.randomUUID());
  const [state, dispatch] = useReducer(reduceDungeon, undefined, () => {
    if (activeDungeon) {
      return dungeonReducer(createInitialDungeonState(), {
        type: "RETURN_TO_DUNGEON",
        dungeon: activeDungeon.dungeon,
        torches: resources.torches,
        hp: resources.hp,
        maxHp: resources.maxHp,
        coins: resources.coins,
        treasures: resources.treasures,
        keys: resources.keys,
        heldItems: resources.heldItems,
        armor: resources.armor,
        weapon: resources.weapon,
        weaponFormula: character.cls.weaponDamage,
        spellUses: resources.spellUses,
        characterName: character.name,
        monsterKills: resources.monsterKills,
        bossKills: resources.bossKills,
      });
    }
    if (resumeDungeon) {
      return dungeonReducer(createInitialDungeonState(), {
        type: "RESUME_DUNGEON",
        dungeon: resumeDungeon.dungeon,
        torches: resources.torches,
        hp: resources.hp,
        maxHp: resources.maxHp,
        weaponFormula: character.cls.weaponDamage,
        spellUses: resources.spellUses,
        characterName: character.name,
      });
    }
    return createInitialDungeonState(
      resources.torches,
      resources.hp,
      character.cls.weaponDamage,
      resources.spellUses,
      character.name,
      resources.coins,
      resources.treasures,
      resources.keys,
      resources.heldItems,
      resources.maxHp,
      resources.armor,
      resources.weapon,
      resources.monsterKills,
      resources.bossKills,
    );
  });
  const [diceValues, setDiceValues] = useState<number[]>([1, 1, 1]);
  const [diceRollToken, setDiceRollToken] = useState(0);
  const [rollingDungeon, setRollingDungeon] = useState(false);
  const [treasureDie, setTreasureDie] = useState(1);
  const [treasureRollToken, setTreasureRollToken] = useState(0);
  const [openingTreasure, setOpeningTreasure] = useState(false);

  const hasDungeon = state.levels.length > 0;
  const bossDefeated = isDungeonBeaten(state);

  // Records the character in the Graveyard exactly once per death (the effect only re-runs
  // when `alive` actually flips, not on every render while the death panel stays up).
  useEffect(() => {
    if (state.alive) return;
    addGraveyardEntry({
      name: character.name,
      dungeon: state.dungeonName ?? "an unknown dungeon",
      causeOfDeath: state.deathCause ?? "darkness",
      race: character.race.name,
      cls: character.cls.name,
      monsterKills: state.monsterKills,
      bossKills: state.bossKills,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.alive]);

  // Saves this run's current progress (if it's gone anywhere and isn't beaten) the moment this
  // screen unmounts, whatever the reason -- death, a voluntary retreat, or a brand new character
  // navigating away. Refs (kept fresh via their own effects, since writing to a ref during
  // render itself isn't allowed) let the unmount cleanup below read the *latest* state without
  // re-subscribing on every dispatch.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const runIdRef = useRef(runId);
  useEffect(() => {
    runIdRef.current = runId;
  });
  useEffect(() => {
    return () => {
      if (stateRef.current.levels.length > 0) {
        onLeaveDungeon(runIdRef.current, stateRef.current, character.name);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStartNewDungeon() {
    if (hasDungeon) {
      onLeaveDungeon(runId, state, character.name);
    }
    setRunId(crypto.randomUUID());
    dispatch({ type: "RESET" });
  }

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

  function handleOpenTreasure() {
    if (openingTreasure || state.treasures <= 0) return;
    const roll = rollDie();
    setTreasureDie(roll);
    setTreasureRollToken((t) => t + 1);
    setOpeningTreasure(true);
    window.setTimeout(() => {
      setOpeningTreasure(false);
      dispatch({ type: "OPEN_TREASURE", roll, maxSpellUses: computeSpellUses(character.spells, character.fixedGrants) });
    }, revealDelay(1));
  }

  return (
    <div className={styles.page}>
      <header className={styles.wordmark}>
        <h1>NoteQuest</h1>
        <p className={styles.tagline}>The dungeon is built as you explore it.</p>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {(!hasDungeon || !state.alive || bossDefeated) && (
            <main className={styles.sheet}>
              <div className={styles.sheetInner}>
                <span className={styles.sheetLabel}>Dungeon Log</span>

                {!hasDungeon && (
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
                    <div className={styles.headerActions}>
                      <button className={styles.rollBtn} type="button" disabled={rollingDungeon} onClick={handleRollDungeon}>
                        Roll for Dungeon
                      </button>
                      <button
                        className={styles.ghostBtn}
                        type="button"
                        disabled={rollingDungeon}
                        onClick={() => onReturnToTown(runId, state)}
                      >
                        Back to Town
                      </button>
                    </div>
                  </section>
                )}

                {!state.alive && state.deathCause === "combat" && (
                  <div className={styles.deathPanel}>
                    <p className={styles.deathTitle}>{character.name} Has Fallen</p>
                    <p>Overwhelmed in combat, {character.name} goes down. The dungeon keeps what it took.</p>
                    <p className={styles.deathNote}>{character.name} is laid to rest in the Graveyard.</p>
                    <button className={styles.deathBtn} type="button" onClick={onNewAdventurer}>
                      Roll a New Adventurer
                    </button>
                  </div>
                )}
                {!state.alive && state.deathCause !== "combat" && (
                  <div className={styles.deathPanel}>
                    <p className={styles.deathTitle}>The Darkness Devours You</p>
                    <p>
                      {character.name}&apos;s torch has burned out with no way to relight it. The dungeon keeps
                      what it took.
                    </p>
                    <p className={styles.deathNote}>{character.name} is laid to rest in the Graveyard.</p>
                    <button className={styles.deathBtn} type="button" onClick={onNewAdventurer}>
                      Roll a New Adventurer
                    </button>
                  </div>
                )}
                {state.alive && bossDefeated && (
                  <div className={styles.victoryPanel}>
                    <p className={styles.victoryTitle}>The Dungeon Boss Falls</p>
                    <p>{character.name} stands victorious over the dungeon&apos;s master. The depths grow quiet.</p>
                    <button
                      className={styles.deathBtn}
                      type="button"
                      onClick={() => onReturnToTown(runId, state)}
                    >
                      Return to Town
                    </button>
                  </div>
                )}
              </div>
            </main>
          )}

          {hasDungeon && (
            <>
              <LevelTabs
                count={state.levels.length}
                activeLevel={state.activeLevel}
                onSwitchLevel={(levelIndex) => dispatch({ type: "SWITCH_LEVEL", levelIndex })}
              />
              <div className={styles.mapArea}>
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
                <div className={styles.roomInspectorOverlay}>
                  <RoomInspector
                    key={state.selectedSegId ?? "none"}
                    state={state}
                    onRollSecretPassage={(segId, roll, trapRoll) =>
                      dispatch({ type: "ROLL_SECRET_PASSAGE", segId, roll, trapRoll })
                    }
                    onRollChest={(segId, dice, trapRoll) => dispatch({ type: "ROLL_CHEST", segId, dice, trapRoll })}
                    onCollectRemains={(segId) => dispatch({ type: "COLLECT_REMAINS", segId })}
                  />
                </div>
              </div>
              {state.combat && (
                <CombatPanel
                  combat={state.combat}
                  hp={state.hp}
                  maxHp={state.maxHp}
                  weaponName={state.weapon?.name ?? character.cls.weapon}
                  weaponFormula={state.weapon?.formula ?? character.cls.weaponDamage}
                  armor={state.armor}
                  spellUses={state.spellUses}
                  onAttack={(targetId, roll) => dispatch({ type: "PLAYER_ATTACK", targetId, roll })}
                  onCastSpell={(spellRoll, targetId) => dispatch({ type: "CAST_SPELL", spellRoll, targetId })}
                  onResolveDamage={(absorbWith) => dispatch({ type: "RESOLVE_DAMAGE", absorbWith })}
                />
              )}
              <RollLog entries={state.log} />
            </>
          )}

          <p className={styles.scopeNote}>
            Breaking a door or setting off a trap alerts monsters beyond it, letting them strike first.
          </p>
        </div>

        <aside className={styles.side}>
          {hasDungeon && (
            <div className={styles.statsCard}>
              <section className={styles.dungeonHeader}>
                <p className={styles.dungeonEyebrow}>Level {state.activeLevel + 1}</p>
                <h2 className={styles.dungeonName}>{state.dungeonName}</h2>
                <p className={styles.dungeonEntrance}>{state.entranceFlavor}</p>
                {state.alive && (
                  <div className={styles.headerActions}>
                    {!state.combat && (
                      <button className={styles.ghostBtn} type="button" onClick={() => onReturnToTown(runId, state)}>
                        Retreat to Town
                      </button>
                    )}
                    <button className={styles.ghostBtn} type="button" onClick={handleStartNewDungeon}>
                      Start a New Dungeon
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}

          <CharacterSheet
            character={character}
            torches={state.torches}
            hp={state.hp}
            coins={state.coins}
            treasures={state.treasures}
            keys={state.keys}
            spellUses={state.spellUses}
            canCastOutOfCombat={hasDungeon && state.alive && !state.combat}
            onCastSpell={(spellRoll) => dispatch({ type: "CAST_SPELL", spellRoll })}
          />

          {state.treasures > 0 && state.alive && (
            <div className={styles.statsCard}>
              <h3>Treasure</h3>
              <div className={styles.treasureRow}>
                <Die value={treasureDie} rollToken={treasureRollToken} size={36} />
                <button
                  className={styles.rollBtn}
                  type="button"
                  disabled={openingTreasure}
                  onClick={handleOpenTreasure}
                >
                  Open a Treasure ({state.treasures})
                </button>
              </div>
            </div>
          )}

          <Equipment armor={state.armor} weapon={state.weapon} />

          <Pack items={state.heldItems} />

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

      <footer className={styles.credit}>
        <p>NOTEQUEST · THE DUNGEON</p>
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
    </div>
  );
}
