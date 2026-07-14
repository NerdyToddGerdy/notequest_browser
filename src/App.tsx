import { useEffect, useState } from "react";
import { CharacterCreationScreen } from "./ui/screens/CharacterCreationScreen/CharacterCreationScreen.tsx";
import { TownScreen } from "./ui/screens/TownScreen/TownScreen.tsx";
import { DungeonScreen } from "./ui/screens/DungeonScreen/DungeonScreen.tsx";
import type { CreatedCharacter } from "./data/types.ts";
import { computeSpellUses } from "./engine/character.ts";
import { isDungeonBeaten, type DungeonState, type PendingDungeon } from "./engine/dungeonState.ts";
import type { AdventurerResources } from "./engine/town.ts";
import { loadSession, saveSession } from "./engine/session.ts";

type Screen = "town" | "dungeon";

export default function App() {
  // Loaded once, on mount -- the four pieces below seed themselves from it and then live as
  // their own independent state, same as before persistence existed. `screen`/`selectedRunId`
  // deliberately aren't part of this: they're transient navigation state, not worth remembering.
  const [initialSession] = useState(() => loadSession());
  const [character, setCharacter] = useState<CreatedCharacter | null>(initialSession.character);
  const [resources, setResources] = useState<AdventurerResources | null>(initialSession.resources);
  const [screen, setScreen] = useState<Screen>("town");
  /** This character's own paused dungeon, if any -- looked up in pendingDungeons below. */
  const [activeRunId, setActiveRunId] = useState<string | null>(initialSession.activeRunId);
  /** Which dungeon Town sent the player into -- their own active one, an abandoned one they
   * picked up, or null for a fresh roll. Read once when DungeonScreen mounts. */
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [dungeonHistory, setDungeonHistory] = useState<PendingDungeon[]>(initialSession.dungeonHistory);

  // Persists the whole session in one blob whenever any piece of it changes -- mirrors
  // addGraveyardEntry's "mutate then persist immediately" behavior, just via an effect instead
  // of inline at each call site, since several setters above would otherwise each need their own.
  useEffect(() => {
    saveSession({ character, resources, dungeonHistory, activeRunId });
  }, [character, resources, dungeonHistory, activeRunId]);

  // A freshly created character always arrives in Town first, never straight into a dungeon.
  function handleCharacterCreated(newCharacter: CreatedCharacter) {
    setCharacter(newCharacter);
    setResources({
      torches: newCharacter.torches,
      hp: newCharacter.totalHp,
      maxHp: newCharacter.totalHp,
      coins: newCharacter.coins,
      treasures: 0,
      keys: 0,
      heldItems: [],
      armor: [],
      weapon: null,
      spellUses: computeSpellUses(newCharacter.spells, newCharacter.fixedGrants),
      monsterKills: 0,
      bossKills: 0,
    });
    setActiveRunId(null);
    setScreen("town");
  }

  function handleNewAdventurer() {
    setCharacter(null);
    setResources(null);
    setActiveRunId(null);
    setScreen("town");
  }

  // A voluntary, alive retreat -- captures the run's current resources so Town's City Actions
  // can act on them, and remembers the runId so "Continue" can jump straight back in later.
  function handleReturnToTown(runId: string, dungeon: DungeonState) {
    setResources({
      torches: dungeon.torches,
      hp: dungeon.hp,
      maxHp: dungeon.maxHp,
      coins: dungeon.coins,
      treasures: dungeon.treasures,
      keys: dungeon.keys,
      heldItems: dungeon.heldItems,
      armor: dungeon.armor,
      weapon: dungeon.weapon,
      spellUses: dungeon.spellUses,
      monsterKills: dungeon.monsterKills,
      bossKills: dungeon.bossKills,
    });
    setActiveRunId(dungeon.alive && dungeon.levels.length > 0 && !isDungeonBeaten(dungeon) ? runId : null);
    setScreen("town");
  }

  // Called whenever a dungeon run ends (death, a voluntary retreat, "Start a New Dungeon", or
  // beating the Final Room), with whatever the dungeon looked like at that moment. Only a run
  // that never went anywhere is dropped; everything else is kept (or re-saved, if it was already
  // a resumed run) -- unbeaten ones so a later character can pick up where this one left off,
  // beaten ones as a historical record shown in Town (see PendingDungeon's doc comment).
  function handleLeaveDungeon(runId: string, dungeon: DungeonState, characterName: string) {
    setDungeonHistory((prev) => {
      const withoutCurrent = prev.filter((pd) => pd.id !== runId);
      if (dungeon.levels.length === 0) return withoutCurrent;
      return [...withoutCurrent, { id: runId, dungeon, lastCharacterName: characterName }];
    });
  }

  if (!character || !resources) {
    return <CharacterCreationScreen onCharacterCreated={handleCharacterCreated} />;
  }

  const activeDungeon = dungeonHistory.find((pd) => pd.id === activeRunId) ?? null;

  if (screen === "town") {
    return (
      <TownScreen
        character={character}
        resources={resources}
        activeDungeon={activeDungeon}
        dungeonHistory={dungeonHistory.filter((pd) => pd.id !== activeRunId)}
        onUpdateResources={setResources}
        onContinueActive={() => {
          setSelectedRunId(activeRunId);
          setScreen("dungeon");
        }}
        onResumeDungeon={(pending) => {
          setSelectedRunId(pending.id);
          setScreen("dungeon");
        }}
        onRollNew={() => {
          setSelectedRunId(null);
          setScreen("dungeon");
        }}
      />
    );
  }

  // Only one of these is ever non-null: DungeonScreen's mount-time initializer uses whichever
  // is set to decide between RETURN_TO_DUNGEON (own run, exact resources) and RESUME_DUNGEON
  // (an abandoned run, fresh resources) -- see the two very different resume paths in CLAUDE.md.
  const isOwnRun = selectedRunId !== null && selectedRunId === activeRunId;
  const resumeDungeon = isOwnRun ? null : (dungeonHistory.find((pd) => pd.id === selectedRunId) ?? null);

  return (
    <DungeonScreen
      character={character}
      resources={resources}
      activeDungeon={isOwnRun ? activeDungeon : null}
      resumeDungeon={resumeDungeon}
      onNewAdventurer={handleNewAdventurer}
      onReturnToTown={handleReturnToTown}
      onLeaveDungeon={handleLeaveDungeon}
    />
  );
}
