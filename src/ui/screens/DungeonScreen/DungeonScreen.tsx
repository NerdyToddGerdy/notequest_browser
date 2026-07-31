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
import { maxHeldItemsFor, type AdventurerResources } from "../../../engine/town.ts";
import type { CreatedCharacter } from "../../../data/types.ts";
import { Die } from "../../components/Die/Die.tsx";
import { DicePool } from "../../components/DicePool/DicePool.tsx";
import { CharacterSheet } from "../../components/CharacterSheet/CharacterSheet.tsx";
import { Equipment } from "../../components/Equipment/Equipment.tsx";
import { Pack } from "../../components/Pack/Pack.tsx";
import { CombatPanel } from "../../components/CombatPanel/CombatPanel.tsx";
import { TeleportPicker } from "../../components/TeleportPicker/TeleportPicker.tsx";
import { RoomEntryPrompt } from "../../components/RoomEntryPrompt/RoomEntryPrompt.tsx";
import { DungeonMap } from "../../components/DungeonMap/DungeonMap.tsx";
import { LevelTabs } from "../../components/LevelTabs/LevelTabs.tsx";
import { RoomInspector } from "../../components/RoomInspector/RoomInspector.tsx";
import { RollLog } from "../../components/RollLog/RollLog.tsx";
import { TrapToast } from "../../components/TrapToast/TrapToast.tsx";
import { ConfirmDialog } from "../../components/ConfirmDialog/ConfirmDialog.tsx";
import { Footer } from "../../components/Footer/Footer.tsx";
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
  /** World only: the dungeon type the current hex's terrain fates ("Table: Dungeon Type", by
   * terrain) -- overrides just the first of "Roll for Dungeon"'s 3 dice, so the type is determined
   * by where the player found it rather than free chance; the other two (name flavor) still roll
   * normally. Undefined for a Town-sourced entry, where every roll stays free. */
  forcedTypeRoll?: number;
  /** World only: an id App.tsx minted and already stamped onto the current hex's tile, so a fresh
   * roll's run can be found again later without DungeonScreen self-minting one it can't report back
   * before mount. Ignored whenever activeDungeon/resumeDungeon is set (those already carry their own
   * id). Undefined for a Town-sourced entry. */
  externalRunId?: string;
  /** Sends the player back to Character Creation to roll a new adventurer -- this one is permadead. */
  onNewAdventurer: () => void;
  /** Hirelings (issue #25) only: the mount-only effect below spends `resources.hireling` the
   * instant a genuinely fresh dungeon trip actually begins (see CLAUDE.md's Hirelings note) --
   * every other resource change during a run flows through `dispatch`/`onReturnToTown` instead. */
  onUpdateResources: (resources: AdventurerResources) => void;
  /** A voluntary retreat, alive -- back to Town with this run's current resources and map saved. */
  onReturnToTown: (runId: string, dungeon: DungeonState) => void;
  /** Fires whenever this run ends (death, retreat, or beating the Final Room) so it can be resumed later if unbeaten. */
  onLeaveDungeon: (runId: string, dungeon: DungeonState, characterName: string) => void;
  /** Portals (issue #21) roll of 7: this run has "no door to exit," so Retreat to Town is withheld
   * entirely until the Boss falls. Only ever true for a genuinely fresh, portal-created run. */
  noExit?: boolean;
  /** The Boss's-room Portal out of a `noExit` run -- replaces "Return to Town" on the victory panel,
   * and sends the player back to the World with another portal roll waiting. */
  onExitViaPortal: (runId: string, dungeon: DungeonState) => void;
  onHardReset: () => void;
}

export function DungeonScreen({
  character,
  resources,
  activeDungeon,
  resumeDungeon,
  forcedTypeRoll,
  externalRunId,
  onNewAdventurer,
  onUpdateResources,
  onReturnToTown,
  onLeaveDungeon,
  noExit = false,
  onExitViaPortal,
  onHardReset,
}: DungeonScreenProps) {
  const [runId] = useState(
    () => activeDungeon?.id ?? resumeDungeon?.id ?? externalRunId ?? crypto.randomUUID(),
  );
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
        spareWeapons: resources.spareWeapons,
        spareArmor: resources.spareArmor,
        weaponFormula: character.cls.weaponDamage,
        spellUses: resources.spellUses,
        characterName: character.name,
        raceName: character.race.name,
        className: character.cls.name,
        mutations: resources.mutations,
        zombieRevivals: resources.zombieRevivals,
        monsterKills: resources.monsterKills,
        bossKills: resources.bossKills,
        killsByName: resources.killsByName,
        killsByAbility: resources.killsByAbility,
        advancedClasses: resources.advancedClasses,
        hireling: resources.hireling,
        animals: resources.animals,
        milestones: resources.milestones,
        maxSpellUses: resources.maxSpellUses,
        buildings: resources.buildings,
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
        maxSpellUses: resources.maxSpellUses,
        characterName: character.name,
        raceName: character.race.name,
        className: character.cls.name,
        mutations: resources.mutations,
        zombieRevivals: resources.zombieRevivals,
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
      character.race.name,
      character.cls.name,
      resources.killsByName,
      resources.killsByAbility,
      resources.spareWeapons,
      resources.advancedClasses,
      resources.hireling,
      resources.animals,
      resources.milestones,
      resources.maxSpellUses,
      resources.buildings,
      resources.spareArmor,
      resources.nextDungeonDamageBonus,
      noExit,
      // Laboratory (issue #30): mutations and the zombie counter follow the character into the run --
      // all three mechanically-real mutations are read inside the dungeon.
      resources.mutations,
      resources.zombieRevivals,
    );
  });
  const [diceValues, setDiceValues] = useState<number[]>(() => Array<number>(10).fill(1));
  const [diceRollToken, setDiceRollToken] = useState(0);
  const [rollingDungeon, setRollingDungeon] = useState(false);
  const [treasureDie, setTreasureDie] = useState(1);
  const [treasureRollToken, setTreasureRollToken] = useState(0);
  const [openingTreasure, setOpeningTreasure] = useState(false);
  /** Bumped by DungeonMap/RoomInspector the instant any of the 3 trap-firing rolls (a door lock,
   * a secret passage, an empty chest) is confirmed as a trap -- 0 means "never fired yet", so
   * TrapToast stays unmounted until the first one. */
  const [trapToastToken, setTrapToastToken] = useState(0);
  const triggerTrapToast = () => setTrapToastToken((t) => t + 1);
  /** True while the player is holding a pointer down outside the combat card itself (see
   * handlePeekStart) -- fades the card and backdrop out so the map beneath is fully visible
   * without actually leaving or pausing the fight. */
  const [peeking, setPeeking] = useState(false);
  /** True once Flee is clicked, before a destination room is chosen -- swaps the Combat panel for
   * TeleportPicker in the same overlay slot. Purely local UI sequencing (CAST_SPELL isn't
   * dispatched, and no spell use is spent, until an actual destination is picked). */
  const [pickingTeleport, setPickingTeleport] = useState(false);
  /** True while the mid-run "Retreat to Town" confirmation is up -- only that button (see #36)
   * routes through here; the pre-roll "Back to Town" gate and the post-Boss victory panel's
   * "Return to Town" call `onReturnToTown` directly, since neither has already-cleared rooms that
   * could re-populate by the time the player comes back. */
  const [confirmingRetreat, setConfirmingRetreat] = useState(false);

  function handlePeekStart(e: React.PointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return; // pointerdown landed on the card, not the backdrop
    setPeeking(true);
  }
  useEffect(() => {
    if (!peeking) return;
    const stop = () => setPeeking(false);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [peeking]);

  const hasDungeon = state.levels.length > 0;
  const bossDefeated = isDungeonBeaten(state);
  const currentSeg =
    state.levels[state.activeLevel]?.segments.find((s) => s.id === state.currentSegId) ?? null;
  // Mirrors the reducer's hasPendingRoomEntry: a quiet arrival revealed monsters, but the player
  // hasn't yet chosen Attack First vs. Move Silently (RESOLVE_ROOM_ENTRY). `state.alive` matters
  // here specifically because dying to that same room's monsters (a lost fight never marks
  // monstersDefeated) would otherwise leave this true forever, showing "Monsters Ahead" right
  // alongside the death panel -- the reducer's own RESOLVE_ROOM_ENTRY handler already no-ops once
  // dead, so this was purely a decorative render bug, not a way to act after death.
  const pendingRoomEntry =
    state.alive &&
    !!currentSeg?.monsters &&
    !currentSeg.monstersDefeated &&
    !currentSeg.sneakedPast;

  // Hirelings (issue #25) expire per dungeon trip: a genuinely fresh entry (neither
  // activeDungeon nor resumeDungeon, i.e. the lazy initializer above took its third,
  // createInitialDungeonState branch) spends whatever's in resources.hireling into this run's
  // own state.hireling, so it can't be reused to enter a *later*, different dungeon without
  // paying again. Runs once on mount only -- RETURN_TO_DUNGEON's resumed trip already carries
  // its own hireling through the reducer, so this must not fire for that case. Ziggurat's
  // Effect of the Forgotten Gods (issue #30) is consumed the same way, into state.runDamageBonus.
  useEffect(() => {
    if (
      !activeDungeon &&
      !resumeDungeon &&
      (resources.hireling || resources.nextDungeonDamageBonus > 0)
    ) {
      onUpdateResources({ ...resources, hireling: null, nextDungeonDamageBonus: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      advancedClasses: state.advancedClasses,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.alive]);

  // Persists the beaten dungeon to dungeonHistory the moment the boss actually falls, not just
  // on unmount below -- a reload (or just closing the tab) from the victory screen, before ever
  // clicking "Return to Town", would otherwise lose the win entirely: dungeonHistory would still
  // hold the pre-victory snapshot, so World's own beaten-check would wrongly let the player back
  // in to resume the old fight. Only re-runs when `bossDefeated` actually flips, same as the
  // Graveyard effect above.
  useEffect(() => {
    if (!bossDefeated) return;
    onLeaveDungeon(runId, state, character.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossDefeated]);

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

  function handleRollDungeon() {
    if (rollingDungeon || state.torches < 1) return;
    // One die picks the type -- fated by the hex's terrain when arriving from World
    // (`forcedTypeRoll`), free chance otherwise, same ritual either way. The Expanded World's
    // dungeon-name table (issue #101) then wants a *3d6 total per column*, not one die per column:
    // its rows run 3-18. So nine more dice are rolled and animated alongside, in three groups of
    // three, and each group's sum indexes one column.
    const typeRoll = forcedTypeRoll ?? rollDie();
    const nameDice = Array.from({ length: 9 }, () => rollDie());
    const nameRolls: [number, number, number] = [
      nameDice[0]! + nameDice[1]! + nameDice[2]!,
      nameDice[3]! + nameDice[4]! + nameDice[5]!,
      nameDice[6]! + nameDice[7]! + nameDice[8]!,
    ];
    setDiceValues([typeRoll, ...nameDice]);
    setDiceRollToken((t) => t + 1);
    setRollingDungeon(true);
    window.setTimeout(() => {
      setRollingDungeon(false);
      dispatch({ type: "ROLL_DUNGEON", typeRoll, nameRolls });
    }, revealDelay(10));
  }

  function handleOpenTreasure() {
    if (openingTreasure || state.treasures <= 0 || !!state.pendingPackItem) return;
    const roll = rollDie();
    setTreasureDie(roll);
    setTreasureRollToken((t) => t + 1);
    setOpeningTreasure(true);
    window.setTimeout(() => {
      setOpeningTreasure(false);
      dispatch({ type: "OPEN_TREASURE", roll });
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
          {(!hasDungeon || bossDefeated) && (
            <main className={styles.sheet}>
              <div className={styles.sheetInner}>
                <span className={styles.sheetLabel}>Dungeon Log</span>

                {!hasDungeon && (
                  <section>
                    <h2 className={styles.trackTitle}>
                      <span className={styles.dieBadge}>1d6 + 3×3d6</span>Roll for Dungeon
                    </h2>
                    <p className={styles.gateCopy}>
                      One die picks the dungeon&apos;s type; nine more — three per column — shape
                      its name. The dungeon is built as you explore it, door by door, from here on
                      out.
                    </p>
                    <div className={styles.diceRow}>
                      <DicePool values={diceValues} rollToken={diceRollToken} />
                    </div>
                    {/* Issue #92: entering costs a torch, so blocking here beats letting the reducer
                        kill them on the threshold -- especially for a Miner, whose whole ability is
                        surviving an empty torch bag. */}
                    {state.torches < 1 && (
                      <p className={styles.gateCopy}>
                        You have no torches. Go back to town and buy one before entering the dark.
                      </p>
                    )}
                    <div className={styles.headerActions}>
                      <button
                        className={styles.rollBtn}
                        type="button"
                        disabled={rollingDungeon || state.torches < 1}
                        onClick={handleRollDungeon}
                      >
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

                {state.alive && bossDefeated && (
                  <div className={styles.victoryPanel}>
                    <p className={styles.victoryTitle}>
                      {state.exitUsed ? "Out, and Breathing Air" : "The Dungeon Boss Falls"}
                    </p>
                    <p>
                      {state.exitUsed
                        ? `${character.name} climbs the ladder and shoulders the manhole aside. Whatever is still down there can stay there.`
                        : `${character.name} stands victorious over the dungeon's master. The depths grow quiet.`}
                    </p>
                    {state.noExit ? (
                      <>
                        <p>
                          A Portal stands open where the Boss fell — the only way out of this place.
                        </p>
                        <button
                          className={styles.deathBtn}
                          type="button"
                          onClick={() => onExitViaPortal(runId, state)}
                        >
                          Step through the Portal
                        </button>
                      </>
                    ) : (
                      <button
                        className={styles.deathBtn}
                        type="button"
                        onClick={() => onReturnToTown(runId, state)}
                      >
                        Return to Town
                      </button>
                    )}
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
                    dispatch({
                      type: "RESOLVE_DOOR_LOCK",
                      segId,
                      doorIdx,
                      doorRoll,
                      trapRoll,
                      lockChoice,
                    })
                  }
                  onSelectSegment={(segId) => dispatch({ type: "SELECT_SEGMENT", segId })}
                  onSwitchLevel={(levelIndex, segId) =>
                    dispatch({ type: "SWITCH_LEVEL", levelIndex, segId })
                  }
                  onTrapTriggered={triggerTrapToast}
                />
                <TrapToast token={trapToastToken} />
                {!state.combat && !pendingRoomEntry && (
                  <div className={styles.roomInspectorOverlay}>
                    <RoomInspector
                      key={state.selectedSegId ?? "none"}
                      state={state}
                      onRollSecretPassage={(segId, roll, trapRoll) =>
                        dispatch({ type: "ROLL_SECRET_PASSAGE", segId, roll, trapRoll })
                      }
                      onRollChest={(segId, dice, trapRoll) =>
                        dispatch({ type: "ROLL_CHEST", segId, dice, trapRoll })
                      }
                      onCollectRemains={(segId) => dispatch({ type: "COLLECT_REMAINS", segId })}
                      onClimbOut={(segId) => dispatch({ type: "CLIMB_OUT", segId })}
                      onTrapTriggered={triggerTrapToast}
                    />
                  </div>
                )}
                {!state.combat && pendingRoomEntry && currentSeg && (
                  <div className={styles.combatOverlay}>
                    <div className={styles.combatOverlayInner}>
                      <RoomEntryPrompt
                        torches={state.torches}
                        hasDog={state.animals.includes("Dog")}
                        onAttack={() =>
                          dispatch({
                            type: "RESOLVE_ROOM_ENTRY",
                            segId: currentSeg.id,
                            choice: "attack",
                          })
                        }
                        onMoveSilently={() =>
                          dispatch({
                            type: "RESOLVE_ROOM_ENTRY",
                            segId: currentSeg.id,
                            choice: "moveSilently",
                          })
                        }
                      />
                    </div>
                  </div>
                )}
                {state.combat && (
                  <div
                    className={`${styles.combatOverlay} ${peeking ? styles.peeking : ""}`}
                    onPointerDown={handlePeekStart}
                    title="Hold to peek at the map"
                  >
                    <div className={styles.combatOverlayInner}>
                      {pickingTeleport ? (
                        <TeleportPicker
                          levels={state.levels}
                          excludeSegId={state.combat.segId}
                          onSelect={(levelIndex, segId) => {
                            dispatch({
                              type: "CAST_SPELL",
                              table: "basic",
                              spellRoll: 3,
                              destLevel: levelIndex,
                              destSegId: segId,
                            });
                            setPickingTeleport(false);
                          }}
                          onCancel={() => setPickingTeleport(false)}
                        />
                      ) : (
                        <CombatPanel
                          combat={state.combat}
                          hp={state.hp}
                          maxHp={state.maxHp}
                          weaponName={state.weapon?.name ?? character.cls.weapon}
                          weaponFormula={state.weapon?.formula ?? character.cls.weaponDamage}
                          armor={state.armor}
                          spellUses={state.spellUses}
                          isRinoceroid={character.race.name === "Rinoceroid"}
                          isSlimemen={character.race.name === "Slimemen"}
                          isSnakeOwner={state.animals.includes("Snake")}
                          hasPendingPackItem={!!state.pendingPackItem}
                          onAttack={(targetId, roll, useHorn) =>
                            dispatch({ type: "PLAYER_ATTACK", targetId, roll, useHorn })
                          }
                          onCastSpell={(table, spellRoll, targetId) =>
                            dispatch({ type: "CAST_SPELL", table, spellRoll, targetId })
                          }
                          onFlee={() => setPickingTeleport(true)}
                          onResolveDamage={(absorbWith) =>
                            dispatch({ type: "RESOLVE_DAMAGE", absorbWith })
                          }
                          onEngulfBody={() => dispatch({ type: "ENGULF_BODY" })}
                          onHirelingAttack={(targetId, roll) =>
                            dispatch({ type: "HIRELING_ATTACK", targetId, roll })
                          }
                          onHirelingExplode={() => dispatch({ type: "HIRELING_EXPLODE" })}
                          onAnimalAttack={(targetId) =>
                            dispatch({ type: "ANIMAL_ATTACK", targetId })
                          }
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
              <RollLog entries={state.log} />
            </>
          )}

          <p className={styles.scopeNote}>
            Breaking a door or setting off a trap alerts monsters beyond it, letting them strike
            first.
          </p>
        </div>

        <aside className={styles.side}>
          {hasDungeon && (
            <div className={styles.statsCard}>
              <section className={styles.dungeonHeader}>
                <p className={styles.dungeonEyebrow}>Level {state.activeLevel + 1}</p>
                <h2 className={styles.dungeonName}>{state.dungeonName}</h2>
                <p className={styles.dungeonEntrance}>{state.entranceFlavor}</p>
                {state.alive && !state.combat && !state.pendingPackItem && !state.noExit && (
                  <div className={styles.headerActions}>
                    <button
                      className={styles.ghostBtn}
                      type="button"
                      onClick={() => setConfirmingRetreat(true)}
                    >
                      Retreat to Town
                    </button>
                  </div>
                )}
                {/* Portals (issue #21): "no door to exit" -- the way out is the Boss's room, so there
                    is deliberately no Retreat here, only an explanation of why. */}
                {state.alive && state.noExit && !bossDefeated && (
                  <p className={styles.dungeonEntrance}>
                    The portal left no door behind it. The only way out is through the Boss.
                  </p>
                )}
              </section>
            </div>
          )}

          <div className={styles.adventurerArea}>
            <CharacterSheet
              character={character}
              torches={state.torches}
              hp={state.hp}
              maxHp={state.maxHp}
              coins={state.coins}
              treasures={state.treasures}
              keys={state.keys}
              weaponName={state.weapon?.name}
              weaponFormula={state.weapon?.formula}
              spellUses={state.spellUses}
              maxSpellUses={state.maxSpellUses}
              canCastOutOfCombat={hasDungeon && state.alive && !state.combat}
              onCastSpell={(table, spellRoll) => dispatch({ type: "CAST_SPELL", table, spellRoll })}
              monsterKills={state.monsterKills}
              killsByName={state.killsByName}
              hireling={state.hireling}
              animals={state.animals}
              mutations={state.mutations}
            />

            {!state.alive && state.deathCause === "combat" && (
              <div className={styles.deathOverlay}>
                <p className={styles.deathTitle}>{character.name} Has Fallen</p>
                <p>
                  Overwhelmed in combat, {character.name} goes down. The dungeon keeps what it took.
                </p>
                <p className={styles.deathNote}>
                  {character.name} is laid to rest in the Graveyard.
                </p>
                <button className={styles.deathBtn} type="button" onClick={onNewAdventurer}>
                  Roll a New Adventurer
                </button>
              </div>
            )}
            {!state.alive && state.deathCause !== "combat" && (
              <div className={styles.deathOverlay}>
                <p className={styles.deathTitle}>The Darkness Devours You</p>
                <p>
                  {character.name}&apos;s torch has burned out with no way to relight it. The
                  dungeon keeps what it took.
                </p>
                <p className={styles.deathNote}>
                  {character.name} is laid to rest in the Graveyard.
                </p>
                <button className={styles.deathBtn} type="button" onClick={onNewAdventurer}>
                  Roll a New Adventurer
                </button>
              </div>
            )}
          </div>

          {state.treasures > 0 && state.alive && (
            <div className={styles.statsCard}>
              <h3>Treasure</h3>
              <div className={styles.treasureRow}>
                <Die value={treasureDie} rollToken={treasureRollToken} size={36} />
                <button
                  className={styles.rollBtn}
                  type="button"
                  disabled={openingTreasure || !!state.pendingPackItem}
                  onClick={handleOpenTreasure}
                >
                  Open a Treasure ({state.treasures})
                </button>
              </div>
            </div>
          )}

          <Equipment
            armor={state.armor}
            weapon={state.weapon}
            spareWeapons={state.spareWeapons}
            onWield={(index) => dispatch({ type: "WIELD_WEAPON", index })}
            spareArmor={state.spareArmor}
            onWieldArmor={(index) => dispatch({ type: "WIELD_ARMOR", index })}
          />

          <Pack
            items={state.heldItems}
            pendingItem={state.pendingPackItem}
            onDiscard={(index) => dispatch({ type: "DISCARD_ITEM", index })}
            onResolveSwap={(discardIndex) => dispatch({ type: "RESOLVE_PACK_SWAP", discardIndex })}
            maxItems={maxHeldItemsFor(state.hireling, state.animals)}
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

      <Footer screenLabel="THE DUNGEON" onHardReset={onHardReset} />

      {confirmingRetreat && (
        <ConfirmDialog
          title="Retreat to Town?"
          message="Leaving may let monsters move back into rooms you've already cleared. Retreat anyway?"
          confirmLabel="Retreat"
          onConfirm={() => {
            setConfirmingRetreat(false);
            onReturnToTown(runId, state);
          }}
          onCancel={() => setConfirmingRetreat(false)}
        />
      )}
    </div>
  );
}
