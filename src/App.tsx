import { useEffect, useState } from "react";
import { CharacterCreationScreen } from "./ui/screens/CharacterCreationScreen/CharacterCreationScreen.tsx";
import { TownScreen } from "./ui/screens/TownScreen/TownScreen.tsx";
import { WorldScreen } from "./ui/screens/WorldScreen/WorldScreen.tsx";
import { DungeonScreen } from "./ui/screens/DungeonScreen/DungeonScreen.tsx";
import type { CreatedCharacter } from "./data/types.ts";
import { computeSpellUses } from "./engine/character.ts";
import { isDungeonBeaten, type DungeonState, type PendingDungeon } from "./engine/dungeonState.ts";
import type { AdventurerResources } from "./engine/town.ts";
import { createInitialWorldState, hexKey, withDungeonRunId, type WorldState } from "./engine/hexState.ts";
import { DUNGEON_TYPE_BY_TERRAIN } from "./data/hexTables.ts";
import { rollDie } from "./engine/dice.ts";
import { loadSession, saveSession } from "./engine/session.ts";

type Screen = "town" | "world" | "dungeon";

export default function App() {
  // Loaded once, on mount -- the pieces below seed themselves from it and then live as their own
  // independent state, same as before persistence existed. `screen`/`selectedRunId`/`returnScreen`
  // deliberately aren't part of this: they're transient navigation state, not worth remembering
  // (a reload always lands back on Town, same as today).
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
  /** The World map -- shared across every character, not reset by `handleNewAdventurer`, same as
   * `dungeonHistory`. Created lazily the first time "Venture into the World" is pressed. */
  const [world, setWorld] = useState<WorldState | null>(initialSession.world);
  /** Which screen a dungeon trip should return to once it ends -- Town's "Roll for a New Dungeon"
   * and World's "Enter Dungeon" both lead to the same DungeonScreen, so this is set right before
   * switching to `"dungeon"` and consulted by `handleReturnToTown` instead of hardcoding `"town"`. */
  const [returnScreen, setReturnScreen] = useState<"town" | "world">("town");
  /** Set right before switching to "dungeon" from World's "Enter Dungeon" -- the current hex's
   * terrain fates the dungeon type ("Table: Dungeon Type, by terrain"), passed through to
   * DungeonScreen as `forcedTypeRoll`. Null for every Town-sourced entry, where the roll stays free. */
  const [forcedTypeRoll, setForcedTypeRoll] = useState<number | null>(null);
  /** Set right before switching to "dungeon" from World's "Enter Dungeon", only on a hex with no
   * dungeon found yet -- DungeonScreen can't report its self-minted runId back before mount, so
   * this id is minted here instead and stamped onto the hex immediately (see onEnterDungeon), then
   * passed down as `externalRunId` so DungeonScreen uses this one instead of self-minting. */
  const [worldFreshRunId, setWorldFreshRunId] = useState<string | null>(null);

  // Persists the whole session in one blob whenever any piece of it changes -- mirrors
  // addGraveyardEntry's "mutate then persist immediately" behavior, just via an effect instead
  // of inline at each call site, since several setters above would otherwise each need their own.
  useEffect(() => {
    saveSession({ character, resources, dungeonHistory, activeRunId, world });
  }, [character, resources, dungeonHistory, activeRunId, world]);

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
      provisions: 20,
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
  // Lands back on whichever of Town/World the dungeon trip started from.
  function handleReturnToTown(runId: string, dungeon: DungeonState) {
    setResources((prev) => ({
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
      // Provisions aren't tracked on DungeonState at all (irrelevant inside a dungeon) -- carried
      // over untouched from whatever it was before this trip started.
      provisions: prev?.provisions ?? 20,
    }));
    setActiveRunId(dungeon.alive && dungeon.levels.length > 0 && !isDungeonBeaten(dungeon) ? runId : null);
    setScreen(returnScreen);
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
    // A dungeon tied to a specific hex (see per-hex dungeon persistence) is only resumable by
    // physically traveling back to that hex in World -- excluded here so a fresh character can't
    // jump straight into a predecessor's hex-found dungeon from Town's list, same as they'd have
    // to actually find it the first time. Doesn't affect activeDungeon/"Continue the Dungeon",
    // which is the same still-living character picking up their own run, hex or not.
    const worldTiedRunIds = new Set(
      Object.values(world?.tiles ?? {})
        .map((t) => t.dungeonRunId)
        .filter((id): id is string => id != null),
    );
    return (
      <TownScreen
        character={character}
        resources={resources}
        activeDungeon={activeDungeon}
        dungeonHistory={dungeonHistory.filter((pd) => pd.id !== activeRunId && !worldTiedRunIds.has(pd.id))}
        onUpdateResources={setResources}
        onContinueActive={() => {
          setSelectedRunId(activeRunId);
          setReturnScreen("town");
          setScreen("dungeon");
        }}
        onResumeDungeon={(pending) => {
          setSelectedRunId(pending.id);
          setReturnScreen("town");
          setScreen("dungeon");
        }}
        onRollNew={() => {
          setSelectedRunId(null);
          setReturnScreen("town");
          setScreen("dungeon");
        }}
        onEnterWorld={() => {
          setWorld((prev) => prev ?? createInitialWorldState());
          setScreen("world");
        }}
      />
    );
  }

  if (screen === "world") {
    const resolvedWorld = world ?? createInitialWorldState();
    return (
      <WorldScreen
        character={character}
        resources={resources}
        world={resolvedWorld}
        dungeonHistory={dungeonHistory}
        onUpdateResources={setResources}
        onUpdateWorld={setWorld}
        onReturnToTown={() => setScreen("town")}
        onEnterDungeon={() => {
          const key = hexKey(resolvedWorld.player);
          const tile = resolvedWorld.tiles[key];
          if (!tile) return; // the Enter Dungeon button only ever shows on a known, dungeon-bearing tile
          if (tile.dungeonRunId) {
            // Found here before -- resume the exact same dungeon. Which of RETURN_TO_DUNGEON
            // (still this character's own paused run) vs. RESUME_DUNGEON (someone else's abandoned
            // one) applies is entirely decided below by whether this equals activeRunId, same as
            // Town's own "Continue"/"Dungeon History" resume paths.
            setForcedTypeRoll(null);
            setWorldFreshRunId(null);
            setSelectedRunId(tile.dungeonRunId);
          } else {
            // First time finding a dungeon here. "The dungeon you find depends on the terrain" --
            // fates just the type-roll die; DungeonScreen still animates its own "Roll for Dungeon"
            // ritual for it. Mint this run's id now (DungeonScreen would otherwise self-mint one on
            // mount, too late for World to learn it) and stamp it onto the hex right away -- always
            // safe, since there's no way to leave DungeonScreen before a dungeon actually exists.
            setForcedTypeRoll(DUNGEON_TYPE_BY_TERRAIN[tile.terrain][rollDie()]!);
            const newRunId = crypto.randomUUID();
            setWorldFreshRunId(newRunId);
            setWorld(withDungeonRunId(resolvedWorld, resolvedWorld.player, newRunId));
            setSelectedRunId(null);
          }
          setReturnScreen("world");
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
      // Scoped to a World-sourced trip via returnScreen (set alongside forcedTypeRoll, right
      // before switching to "dungeon") rather than a separate reset, so a later Town-sourced
      // "Roll for a New Dungeon" can never accidentally inherit a stale forced roll.
      forcedTypeRoll={returnScreen === "world" ? (forcedTypeRoll ?? undefined) : undefined}
      externalRunId={returnScreen === "world" ? (worldFreshRunId ?? undefined) : undefined}
      onNewAdventurer={handleNewAdventurer}
      onReturnToTown={handleReturnToTown}
      onLeaveDungeon={handleLeaveDungeon}
      onRunIdChanged={(newRunId) => {
        // "Start a New Dungeon" mid-run mints its own fresh id, bypassing externalRunId entirely
        // (that prop is only consulted once, at mount) -- re-tie the hex the player is standing on
        // to it, same as a first-ever "Enter Dungeon" does, so the abandoned dungeon doesn't stay
        // the one "on the map" once a different one gets explored (and beaten) in its place.
        if (returnScreen !== "world" || !world) return;
        setWorld(withDungeonRunId(world, world.player, newRunId));
      }}
    />
  );
}
