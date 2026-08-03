import { useEffect, useState } from "react";
import { CharacterCreationScreen } from "./ui/screens/CharacterCreationScreen/CharacterCreationScreen.tsx";
import { WorldScreen } from "./ui/screens/WorldScreen/WorldScreen.tsx";
import { DungeonScreen } from "./ui/screens/DungeonScreen/DungeonScreen.tsx";
import type { CreatedCharacter } from "./data/types.ts";
import { computeSpellUses } from "./engine/character.ts";
import { isDungeonBeaten, type DungeonState, type PendingDungeon } from "./engine/dungeonState.ts";
import {
  createInitialMilestones,
  createInitialTravelStats,
  type AdventurerResources,
} from "./engine/town.ts";
import {
  createInitialWorldState,
  findOrRevealCompatibleHome,
  hexKey,
  ownedBuildings,
  rollRuinsDungeon,
  withDungeonRunId,
  withSewerRunId,
  withUniqueDungeonPlaced,
  type WorldState,
} from "./engine/hexState.ts";
import { hasAffinity } from "./data/affinity.ts";
import { DUNGEON_TYPE_BY_TERRAIN, isOverworldTerrain, type Climate } from "./data/hexTables.ts";
/** Issue #99: the Sewers' own `DUNGEON_TYPES` roll number -- the Fortress sub-roll names the type
 * outright, so it bypasses `DUNGEON_TYPE_BY_TERRAIN` entirely. */
const SEWERS_TYPE_ROLL = 11;
import { rollDie } from "./engine/dice.ts";
import { clearSession, loadSession, saveSession } from "./engine/session.ts";
import { addGraveyardEntry, clearGraveyard, type TownDeathCause } from "./engine/graveyard.ts";
import { applyZombieRevival, rollMutation, zombieRevivalHp } from "./engine/mutations.ts";

// Home is just another hex, rendered by WorldScreen like any other City -- there's no separate
// "town" screen anymore (see per-hex dungeon persistence / Town-Square unification in CLAUDE.md).
type Screen = "world" | "dungeon";

export default function App() {
  // Loaded once, on mount -- the pieces below seed themselves from it and then live as their own
  // independent state, same as before persistence ezxisted. `screen`/`selectedRunId` deliberately
  // aren't part of this: they're transient navigation state, not worth remembering (a reload just
  // resumes wherever world.player physically was, since that itself is persisted).
  const [initialSession] = useState(() => loadSession());
  const [character, setCharacter] = useState<CreatedCharacter | null>(initialSession.character);
  const [resources, setResources] = useState<AdventurerResources | null>(initialSession.resources);
  const [screen, setScreen] = useState<Screen>("world");
  /** This character's own paused dungeon, if any -- looked up in dungeonHistory below. */
  const [activeRunId, setActiveRunId] = useState<string | null>(initialSession.activeRunId);
  /** Which dungeon World's "Enter Dungeon" sent the player into -- their own active one, an
   * abandoned one they picked up, or null for a fresh roll. Read once when DungeonScreen mounts. */
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [dungeonHistory, setDungeonHistory] = useState<PendingDungeon[]>(
    initialSession.dungeonHistory,
  );
  /** The World map -- shared across every character, not reset by `handleNewAdventurer` (only the
   * player's own position is, in handleCharacterCreated). Created lazily on first use. */
  const [world, setWorld] = useState<WorldState | null>(initialSession.world);
  /** Set right before switching to "dungeon" from World's "Enter Dungeon" -- the current hex's
   * terrain fates the dungeon type ("Table: Dungeon Type, by terrain"), passed through to
   * DungeonScreen as `forcedTypeRoll`. Null for every Town-sourced entry, where the roll stays free. */
  const [forcedTypeRoll, setForcedTypeRoll] = useState<number | null>(null);
  /** Set right before switching to "dungeon" from World's "Enter Dungeon", only on a hex with no
   * dungeon found yet -- DungeonScreen can't report its self-minted runId back before mount, so
   * this id is minted here instead and stamped onto the hex immediately (see onEnterDungeon), then
   * passed down as `externalRunId` so DungeonScreen uses this one instead of self-minting. */
  const [worldFreshRunId, setWorldFreshRunId] = useState<string | null>(null);
  /** Portals (issue #21) roll of 7: the next dungeon entered has no exit until its Boss falls, and
   * offers a Portal out instead of "Return to Town." Set alongside `worldFreshRunId` by
   * `onEnterNoExitDungeon`, cleared on the way back out (see `handleReturnToTown`), and threaded into
   * `DungeonScreen`'s mount-time initializer the same way `forcedTypeRoll` is. */
  const [noExitRun, setNoExitRun] = useState(false);
  /** Set when a no-exit run's Boss-room Portal is used, so `WorldScreen` immediately rolls a fresh
   * portal on arrival rather than dropping the player back onto the map with nothing happening. */
  const [pendingPortalOnArrival, setPendingPortalOnArrival] = useState(false);
  /** Laboratory's Special Rule (issue #30): what the mutation did on the way out, shown once on the
   * World screen. Cleared by `WorldScreen` when the player travels. */
  const [arrivalNote, setArrivalNote] = useState<string | null>(null);

  // Persists the whole session in one blob whenever any piece of it changes -- mirrors
  // addGraveyardEntry's "mutate then persist immediately" behavior, just via an effect instead
  // of inline at each call site, since several setters above would otherwise each need their own.
  useEffect(() => {
    saveSession({ character, resources, dungeonHistory, activeRunId, world });
  }, [character, resources, dungeonHistory, activeRunId, world]);

  // A freshly created character always arrives in town first, never straight into a dungeon --
  // that's just World's home hex now, so this resets world.player back to home (world terrain,
  // discovery, and hex dungeon-ties all persist across characters; only the marker resets, so a
  // new adventurer starts fresh at the city rather than wherever the last one's body was left).
  // Issue #78: a race with no Affinity for home's Human City (today, only Orc/Ogre) can't stand
  // there at all -- findOrRevealCompatibleHome() finds (or generates) a compatible city instead.
  // Every other race's behavior here is completely unchanged.
  /** Issue #101: `climate` is only consulted when this is the very first world -- `WorldState`
   * outlives characters, so a later adventurer inherits the continent rather than re-choosing it.
   * `CharacterCreationScreen` hides the control in that case (see `needsWorldClimate`). */
  function handleCharacterCreated(newCharacter: CreatedCharacter, climate: Climate = "hot") {
    setCharacter(newCharacter);
    setResources({
      torches: newCharacter.torches,
      hp: newCharacter.totalHp,
      maxHp: newCharacter.totalHp,
      coins: newCharacter.coins,
      treasures: 0,
      keys: 0,
      heldItems: [],
      consumables: [],
      armor: [],
      weapon: null,
      spareWeapons: [],
      spareArmor: [],
      spellUses: computeSpellUses(newCharacter.spells, newCharacter.fixedGrants),
      maxSpellUses: computeSpellUses(newCharacter.spells, newCharacter.fixedGrants),
      monsterKills: 0,
      bossKills: 0,
      killsByName: {},
      killsByAbility: {},
      provisions: 20,
      advancedClasses: [],
      hireling: null,
      hirelingHp: null,
      curiosities: {},
      animals: [],
      milestones: createInitialMilestones(),
      // Issue #121: a Castle stands on a world hex, and the world outlives its builder -- so a new
      // character inherits whatever is already on the map. Coins, troops and travel counters still
      // die with the previous one; this is the one thing that doesn't.
      buildings: world ? ownedBuildings(world) : [],
      troops: 0,
      troopSources: [],
      travelStats: createInitialTravelStats(),
      survivedRunIds: [],
      flyActive: false,
      catatonic: false,
      mutations: [],
      zombieRevivals: 0,
      nextDungeonDamageBonus: 0,
      // "Your Hands" (issue #100): a new adventurer arrives with both arms, whatever happened to
      // the last one.
      armLost: false,
    });
    setActiveRunId(null);
    setWorld((prev) => {
      const w = prev ?? createInitialWorldState(Math.random, climate);
      const homeTile = w.tiles[hexKey(w.home)];
      if (hasAffinity(newCharacter.race.name, homeTile?.location ?? null)) {
        return { ...w, player: w.home };
      }
      const { world: revealed, coord } = findOrRevealCompatibleHome(w, newCharacter.race.name);
      return { ...revealed, player: coord };
    });
    setScreen("world");
  }

  function handleNewAdventurer() {
    setCharacter(null);
    setResources(null);
    setActiveRunId(null);
    setScreen("world");
  }

  // A death outside a dungeon (Getting Money's Gamble/Thug Life/Arena, issue #58) -- Town/World's
  // own equivalent of DungeonScreen's death-recording effect, except there's no DungeonState/
  // useEffect to key off here, so WorldScreen/TownScreen call this directly the instant a losing
  // roll comes back. `place` is whatever hex the death happened on (WorldScreen's own location
  // label), standing in for `dungeon` on a GraveyardEntry that isn't about a dungeon at all.
  function handleTownDeath(cause: TownDeathCause, place: string) {
    if (!character || !resources) return;
    // The zombie mutation (Laboratory, issue #30) saves a character out here too, not just inside a
    // dungeon -- `dungeonReducer.ts`'s own `tryZombieRevival` covers the seven in-dungeon death
    // sites, and this single funnel covers every death that isn't one of them (Gamble's life bet,
    // Thug Life, the Arena, a travel Event, a Portal, a realm's hazards, and a fatal mutation
    // itself). Checked before anything is written to the Graveyard, since a revived character never
    // died at all.
    const revivalHp = zombieRevivalHp(resources);
    if (revivalHp !== null) {
      setResources(applyZombieRevival(resources, revivalHp));
      setArrivalNote(
        `Rotten flesh knits itself back together -- you rise again with ${revivalHp} HP.`,
      );
      return;
    }
    addGraveyardEntry({
      name: character.name,
      dungeon: place,
      causeOfDeath: cause,
      race: character.race.name,
      cls: character.cls.name,
      monsterKills: resources.monsterKills,
      bossKills: resources.bossKills,
      advancedClasses: resources.advancedClasses,
      curiosities: resources.curiosities,
    });
    handleNewAdventurer();
  }

  // Settings' "Reset Everything" (issue #50) -- wipes both localStorage keys this app writes to
  // and every piece of in-memory state App itself owns, landing back on Character Creation with
  // a totally blank slate: no character, no Graveyard, no dungeon ever found, no World map.
  function handleHardReset() {
    clearSession();
    clearGraveyard();
    setCharacter(null);
    setResources(null);
    setActiveRunId(null);
    setSelectedRunId(null);
    setDungeonHistory([]);
    setWorld(null);
    setForcedTypeRoll(null);
    setWorldFreshRunId(null);
    setScreen("world");
  }

  // A voluntary, alive retreat -- captures the run's current resources so City Actions can act on
  // them, and remembers the runId so re-entering that hex's dungeon jumps straight back in later.
  function handleReturnToTown(runId: string, dungeon: DungeonState) {
    setNoExitRun(false);
    // Laboratory's Special Rule (issue #30): "any hero or creature that leaves this dungeon will
    // mutate." Fired here, the one place a *living* character leaves a dungeon -- and it can kill,
    // so it has to run where the death handler lives. `handleLeaveDungeon`'s unmount cleanup is the
    // wrong hook: it also fires on death, and a corpse doesn't mutate on the way out.
    const mutating = dungeon.dungeonTypeKey === "laboratory" && dungeon.alive;
    setResources((prev) => ({
      torches: dungeon.torches,
      hp: dungeon.hp,
      maxHp: dungeon.maxHp,
      coins: dungeon.coins,
      treasures: dungeon.treasures,
      keys: dungeon.keys,
      heldItems: dungeon.heldItems,
      // Undrunk potions come back out with everything else the character was carrying (issue #110).
      consumables: dungeon.consumables ?? [],
      armor: dungeon.armor,
      weapon: dungeon.weapon,
      spareWeapons: dungeon.spareWeapons,
      spareArmor: dungeon.spareArmor,
      spellUses: dungeon.spellUses,
      maxSpellUses: dungeon.maxSpellUses,
      monsterKills: dungeon.monsterKills,
      bossKills: dungeon.bossKills,
      killsByName: dungeon.killsByName,
      killsByAbility: dungeon.killsByAbility,
      // Provisions aren't tracked on DungeonState at all (irrelevant inside a dungeon) -- carried
      // over untouched from whatever it was before this trip started.
      provisions: prev?.provisions ?? 20,
      advancedClasses: dungeon.advancedClasses,
      // Hirelings (issue #25) expire per dungeon trip, unlike advancedClasses -- a still-unbeaten
      // retreat keeps this trip's Hireling attached (so a later RETURN_TO_DUNGEON picks it back up),
      // but a beaten dungeon spends it for good, same as starting a genuinely new trip would need a
      // fresh hire.
      hireling: isDungeonBeaten(dungeon) ? null : dungeon.hireling,
      // ...and its remaining HP comes with it (issue #114), so pausing in Town is not a free heal for
      // the hired help the way Rest is for the character.
      hirelingHp: isDungeonBeaten(dungeon) ? null : (dungeon.hirelingHp ?? null),
      // Curiosities (issues #109/#115) are permanent per character, like mutations -- carried from the
      // dungeon, since that's where they're found.
      curiosities: dungeon.curiosities ?? prev?.curiosities ?? {},
      // Animals (issue #26) persist permanently once acquired, same as advancedClasses -- no
      // isDungeonBeaten gate needed here (unlike hireling, they don't expire).
      animals: dungeon.animals,
      // Milestones (issue #70) persist permanently once set, same as advancedClasses/animals.
      milestones: dungeon.milestones,
      // Buildings (issue #27) persist permanently once built, same as advancedClasses/animals.
      buildings: dungeon.buildings,
      // Warfare (issue #28) troops aren't tracked on DungeonState at all (nothing inside a dungeon
      // run needs them) -- carried over untouched, same as provisions/travelStats below.
      troops: prev?.troops ?? 0,
      troopSources: prev?.troopSources ?? [],
      // Travel stats (issue #72) aren't tracked on DungeonState at all (nothing inside a dungeon
      // run needs them) -- carried over untouched, same as provisions above.
      travelStats: prev?.travelStats ?? createInitialTravelStats(),
      // Miner (issue #62): a live retreat -- whether voluntary or after beating the Boss -- counts
      // as having survived this run, so long as a dungeon actually existed here (dungeon.levels.length
      // > 0 excludes clicking "Back to Town" straight off the pre-roll screen). Deduplicated by
      // runId so repeatedly retreating from (and re-entering) the very same still-unfinished run
      // can't inflate this -- same reasoning as `travelStats.citiesVisited`'s own dedup.
      survivedRunIds:
        dungeon.levels.length > 0 && !(prev?.survivedRunIds ?? []).includes(runId)
          ? [...(prev?.survivedRunIds ?? []), runId]
          : (prev?.survivedRunIds ?? []),
      // Fly (issue #61) isn't tracked on DungeonState at all (nothing inside a dungeon run needs
      // it) -- carried over untouched, same as provisions/travelStats/troops above.
      flyActive: prev?.flyActive ?? false,
      catatonic: false,
      // Laboratory's mutations (issue #30) are permanent per character, like advancedClasses --
      // carried over untouched, then possibly added to by the Special Rule just below.
      mutations: dungeon.mutations ?? prev?.mutations ?? [],
      // Carried from the *dungeon*, not `prev`: the zombie mutation can fire mid-run and
      // increment there, and that halving must not be forgotten on the way out.
      zombieRevivals: dungeon.zombieRevivals ?? prev?.zombieRevivals ?? 0,
      // Ziggurat's Effect of the Forgotten Gods (issue #30): already consumed into
      // dungeon.runDamageBonus the moment this trip started (see DungeonScreen.tsx), so this is
      // always 0 by the time a retreat/return happens -- carried over the same way flyActive is.
      nextDungeonDamageBonus: prev?.nextDungeonDamageBonus ?? 0,
      // "Your Hands" (issue #100): carried from the *dungeon* for the same reason `zombieRevivals`
      // is -- a Blade Trap takes the arm mid-run, and that has to survive the walk home.
      armLost: dungeon.armLost ?? prev?.armLost ?? false,
    }));
    setActiveRunId(
      dungeon.alive && dungeon.levels.length > 0 && !isDungeonBeaten(dungeon) ? runId : null,
    );
    setScreen("world");

    // The mutation itself. Rolled against `resources` (which is what the updater above saw as `prev`)
    // so the outcome can be applied and, if fatal, routed to the death handler -- neither of which is
    // safe to do inside a setState updater.
    if (mutating && resources) {
      const result = rollMutation({
        ...resources,
        hp: dungeon.hp,
        maxHp: dungeon.maxHp,
      });
      if (result.died) {
        setArrivalNote(null);
        handleTownDeath("mutation", "the Laboratory");
        return;
      }
      setResources((prev) => (prev ? { ...prev, ...result.resources } : prev));
      setArrivalNote(`You mutate on the way out: ${result.message}`);
    }
  }

  // Called whenever a dungeon run ends (death, a voluntary retreat, or beating the Final Room),
  // with whatever the dungeon looked like at that moment. Only a run
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
    return (
      <CharacterCreationScreen
        onCharacterCreated={handleCharacterCreated}
        needsWorldClimate={world === null}
        dungeonHistory={dungeonHistory}
        onHardReset={handleHardReset}
      />
    );
  }

  const activeDungeon = dungeonHistory.find((pd) => pd.id === activeRunId) ?? null;

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
        onHardReset={handleHardReset}
        onCharacterDied={handleTownDeath}
        onEnterDungeon={() => {
          const key = hexKey(resolvedWorld.player);
          const tile = resolvedWorld.tiles[key];
          if (!tile) return; // the Enter Dungeon button only ever shows on a known, dungeon-bearing tile
          if (tile.dungeonRunId) {
            // Found here before -- resume the exact same dungeon. Which of RETURN_TO_DUNGEON
            // (still this character's own paused run) vs. RESUME_DUNGEON (someone else's abandoned
            // one) applies is entirely decided below by whether this equals activeRunId.
            setForcedTypeRoll(null);
            setWorldFreshRunId(null);
            setSelectedRunId(tile.dungeonRunId);
          } else {
            // First time finding a dungeon here. "The dungeon you find depends on the terrain" --
            // fates just the type-roll die; DungeonScreen still animates its own "Roll for Dungeon"
            // ritual for it. Mint this run's id now (DungeonScreen would otherwise self-mint one on
            // mount, too late for World to learn it) and stamp it onto the hex right away -- always
            // safe, since there's no way to leave DungeonScreen before a dungeon actually exists.
            // Other Worlds (issue #105) have no dungeons -- the realm scope stops at survival, and
            // there's no dungeon-type row for Magma or a Caramel Plain. `WorldScreen` hides the
            // button there; this is the reducer-side half of the same gate.
            if (!isOverworldTerrain(tile.terrain)) return;
            // Issue #98: a Ruins hex rolls its *own* 2d6 table, not the generic 1d6 terrain one --
            // a different spread entirely, plus the once-per-world asterisk rule. Falls back to the
            // terrain table if the Ruins sits on terrain that table has no column for (which
            // LOCATION_TABLE never generates today).
            const ruins =
              tile.location === "ruins" ? rollRuinsDungeon(resolvedWorld, tile.terrain) : null;
            setForcedTypeRoll(ruins?.typeRoll ?? DUNGEON_TYPE_BY_TERRAIN[tile.terrain][rollDie()]!);
            const newRunId = crypto.randomUUID();
            setWorldFreshRunId(newRunId);
            let nextWorld = withDungeonRunId(resolvedWorld, resolvedWorld.player, newRunId);
            if (ruins?.placed) nextWorld = withUniqueDungeonPlaced(nextWorld, ruins.placed);
            setWorld(nextWorld);
            setSelectedRunId(null);
          }
          setScreen("dungeon");
        }}
        arrivalNote={arrivalNote}
        onArrivalNoteSeen={() => setArrivalNote(null)}
        autoPortalOnMount={pendingPortalOnArrival}
        onAutoPortalConsumed={() => setPendingPortalOnArrival(false)}
        onEnterSewers={() => {
          // Issue #99: "A Fortress may also have an extra dungeon to explore... Sewers under the
          // fortress." A second, independent run on the same hex, so it stamps `sewerRunId` rather
          // than `dungeonRunId` and forces the Sewers type roll (11) instead of consulting the
          // terrain table -- the rulebook names the type outright here.
          const tile = resolvedWorld.tiles[hexKey(resolvedWorld.player)];
          if (!tile) return;
          if (tile.sewerRunId) {
            setForcedTypeRoll(null);
            setWorldFreshRunId(null);
            setSelectedRunId(tile.sewerRunId);
          } else {
            setForcedTypeRoll(SEWERS_TYPE_ROLL);
            const newRunId = crypto.randomUUID();
            setWorldFreshRunId(newRunId);
            setWorld(withSewerRunId(resolvedWorld, resolvedWorld.player, newRunId));
            setSelectedRunId(null);
          }
          setScreen("dungeon");
        }}
        onEnterNoExitDungeon={() => {
          // Portals (issue #21) roll of 7. Deliberately *not* stamped onto any hex: this dungeon
          // isn't tied to geography (the portal dropped the character in from nowhere), so no
          // `withDungeonRunId` and no `forcedTypeRoll` -- the type roll stays free, since there's no
          // terrain to fate it. Everything else matches a first-time hex entry.
          const newRunId = crypto.randomUUID();
          setForcedTypeRoll(null);
          setWorldFreshRunId(newRunId);
          setSelectedRunId(null);
          setNoExitRun(true);
          setScreen("dungeon");
        }}
      />
    );
  }

  // Only one of these is ever non-null: DungeonScreen's mount-time initializer uses whichever
  // is set to decide between RETURN_TO_DUNGEON (own run, exact resources) and RESUME_DUNGEON
  // (an abandoned run, fresh resources) -- see the two very different resume paths in CLAUDE.md.
  const isOwnRun = selectedRunId !== null && selectedRunId === activeRunId;
  const resumeDungeon = isOwnRun
    ? null
    : (dungeonHistory.find((pd) => pd.id === selectedRunId) ?? null);

  return (
    <DungeonScreen
      character={character}
      resources={resources}
      activeDungeon={isOwnRun ? activeDungeon : null}
      resumeDungeon={resumeDungeon}
      forcedTypeRoll={forcedTypeRoll ?? undefined}
      externalRunId={worldFreshRunId ?? undefined}
      noExit={noExitRun}
      onExitViaPortal={(runId, dungeon) => {
        // Portals (issue #21): the Boss's-room Portal out of a no-exit run. Banks the run exactly as
        // "Return to Town" would, then arms WorldScreen to roll a fresh portal the moment it mounts.
        handleReturnToTown(runId, dungeon);
        setPendingPortalOnArrival(true);
      }}
      onNewAdventurer={handleNewAdventurer}
      onUpdateResources={setResources}
      onReturnToTown={handleReturnToTown}
      onLeaveDungeon={handleLeaveDungeon}
      onHardReset={handleHardReset}
    />
  );
}
