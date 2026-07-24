import { useState } from "react";
import type { AnimalDef, CreatedCharacter } from "../../../data/types.ts";
import type { CityCulture } from "../../../data/affinity.ts";
import { loadGraveyard, type TownDeathCause } from "../../../engine/graveyard.ts";
import type { PendingDungeon } from "../../../engine/dungeonState.ts";
import { acquireAdvancedClass } from "../../../engine/advancedClasses.ts";
import { hirelingsFor } from "../../../data/hirelings.ts";
import { canHireHireling, hireHireling } from "../../../engine/hirelings.ts";
import {
  resolveArenaRound,
  startArena,
  type ArenaRoundResult,
  type ArenaState,
} from "../../../engine/arena.ts";
import {
  brewHealthPotion,
  buyElvenBoots,
  buyLamp,
  buyOrcGladio,
  buyProvision,
  buyTorch,
  canBrewHealthPotion,
  canBuyElvenBoots,
  canBuyLamp,
  canBuyOrcGladio,
  canBuyProvision,
  canBuyTorch,
  canDrinkVerdosaPotion,
  canHardWork,
  canHireBoat,
  canLearnRandomSpell,
  canRemoveCurse,
  canRest,
  castSpell,
  drinkVerdosaPotion,
  fixArmor,
  gamble,
  hardWork,
  learnRandomSpell,
  removeCurse,
  rest,
  sellItem,
  wieldWeapon,
  type AdventurerResources,
  type ThugLifeResult,
} from "../../../engine/town.ts";
import type { PoliticalAffinityOutcome, PoliticalStatus } from "../../../engine/politics.ts";
import { AdvancedClasses } from "../../components/AdvancedClasses/AdvancedClasses.tsx";
import { Hireling } from "../../components/Hireling/Hireling.tsx";
import { Animals } from "../../components/Animals/Animals.tsx";
import { Buildings } from "../../components/Buildings/Buildings.tsx";
import { CharacterSheet } from "../../components/CharacterSheet/CharacterSheet.tsx";
import { Equipment } from "../../components/Equipment/Equipment.tsx";
import { Pack } from "../../components/Pack/Pack.tsx";
import { RecordsPanel } from "../../components/RecordsPanel/RecordsPanel.tsx";
import { Footer } from "../../components/Footer/Footer.tsx";
import styles from "./TownScreen.module.css";

interface CultureAction {
  name: string;
  cost: string;
  desc: string;
  disabled: boolean;
  apply: (resources: AdventurerResources) => AdventurerResources;
}

/** "Different Cultures" (`docs/game-rules-reference.md` lines 941-952) -- one bonus City Action
 * per culture, on top of the base Rest/Buy/Sell/Fix set. See each `town.ts` function's own comment
 * for why some of these resolve as flavor-only (no Curse/hand-economy/day-passage system exists in
 * this codebase). */
function cultureActionFor(
  culture: CityCulture | null,
  resources: AdventurerResources,
  isOgre: boolean,
): CultureAction | null {
  switch (culture) {
    case "human":
      return {
        name: "Remove Curse",
        cost: "200 coins",
        desc: "Eliminate a Curse or Cursed Item.",
        disabled: !canRemoveCurse(resources),
        apply: removeCurse,
      };
    case "dwarven":
      return {
        name: "Buy Lamp",
        cost: "40 coins",
        desc: "A Dwarven Lamp -- lets you use both hands in combat.",
        disabled: !canBuyLamp(resources),
        apply: buyLamp,
      };
    case "elven":
      return {
        name: "Buy Elven Boots",
        cost: "60 coins",
        desc: "2 HP armor -- only 1 provision to move through forests while worn.",
        disabled: !canBuyElvenBoots(resources),
        apply: buyElvenBoots,
      };
    case "gnome":
      return {
        name: "Learn a Spell",
        cost: "80 coins",
        desc: "Learn a random Basic Spell.",
        disabled: !canLearnRandomSpell(resources),
        apply: (r) => learnRandomSpell(r),
      };
    case "goblin":
      return {
        name: "Verdosa Potion",
        cost: "30 coins",
        desc: "Roll a die: 3+ heals to full HP, otherwise you'll be itchy for a day.",
        disabled: !canDrinkVerdosaPotion(resources, isOgre),
        apply: (r) => drinkVerdosaPotion(r).resources,
      };
    case "orc":
      return {
        name: "Buy Orc Gladio",
        cost: "70 coins",
        desc: "A weapon (1d6+1 damage), replacing whatever you're currently carrying.",
        disabled: !canBuyOrcGladio(resources),
        apply: buyOrcGladio,
      };
    default:
      return null;
  }
}

const POLITICAL_STATUS_DESC: Record<PoliticalStatus, string> = {
  ally: "Already allied with you.",
  vassal: "Already a Vassal of your realm.",
  enemy: "Already your enemy -- nothing more to do here.",
};

export interface TownScreenProps {
  character: CreatedCharacter;
  resources: AdventurerResources;
  /** True whenever the current hex (home or any other City/Fortress/Ruins) can offer a dungeon at
   * all -- WorldScreen's own canEnterDungeon check. Covers both a fresh roll (never entered here
   * before) and resuming a known one (own active run or someone else's abandoned one, resolved
   * identically either way by App.tsx's isOwnRun derivation) -- dungeonGateCopy is what actually
   * distinguishes the three cases in the copy shown alongside the button. */
  hasDungeon: boolean;
  dungeonGateCopy: string;
  /** Every dungeon any character has touched -- shown read-only via RecordsPanel's Dungeons tab. */
  dungeonHistory: PendingDungeon[];
  /** Which culture (if any) the current City/Fortress hex belongs to -- `null` for Ruins, which
   * has no City Actions at all (see CLAUDE.md's Town Square unification note). */
  culture: CityCulture | null;
  /** The current hex's own generated name (issue #49) -- WorldScreen's own `currentPlaceLabel`,
   * already preferring `HexTile.name` over the generic type label. Breaks this screen's previous
   * "any City/Fortress is interchangeable" framing (see the culture prop above): every city now
   * has a stable identity of its own, surfaced in the header in place of the old universal "Town
   * Square" heading. */
  cityName: string;
  /** True only when the current hex is a City/Fortress adjacent to water -- `WorldScreen`'s own
   * `besideWater` check, so this screen stays hex-agnostic about *which* hex, same as `hasDungeon`
   * above. Purely structural (can this hex offer the action at all); affordability is `TownScreen`'s
   * own `canHireBoat(resources)` check on the button itself, same as every other City Action here
   * (always shown once structurally possible, only ever *disabled* for being unaffordable). */
  showHireBoat: boolean;
  /** WorldScreen's own check across this hex's six neighbors -- true once one of them already has
   * a dungeon found (marked or actually run), disabling Ask ("if you don't already have a dungeon
   * in any adjacent hex, roll 1d6"). */
  askedDungeonKnown: boolean;
  /** True for a Fortress, false for a City/Ruins -- `WorldScreen`'s own `isFortressLocation()`
   * check. Hard Work is City-only per the rulebook's own wording (unlike everything else in
   * "Cities and Fortresses," which the rulebook applies to both) -- see `town.ts`'s `hardWork()`. */
  isFortress: boolean;
  /** Animals (issue #26): every Mount buyable at this specific hex right now (`WorldScreen`'s own
   * `qualifiesForBuyingMount()` check, culture-agnostic -- only the hex's own terrain matters). */
  buyableMounts: AnimalDef[];
  /** Politics (issue #27): this hex's own resolved Political Affinity outcome, if any --
   * `WorldScreen`'s own `politicalStatusFor(world, world.player)`. */
  politicalStatus: PoliticalStatus | null;
  /** Whether Political Affinity can even be attempted here right now -- `WorldScreen`'s own
   * `canAttemptPoliticalAffinity()` check (already a City/Fortress, per `hasDungeon`'s sibling
   * gating, so this is really just "not already resolved"). */
  canPoliticalAffinity: boolean;
  onUpdateResources: (resources: AdventurerResources) => void;
  onEnterDungeon: () => void;
  onHireBoat: () => void;
  onBuyMount: (name: string) => void;
  onAsk: () => void;
  /** Resolved by `WorldScreen` (not here) since a single roll can touch both `resources` and
   * `WorldState` (a permanent hex ban) -- this screen only ever sees an `AdventurerResources`, so
   * it can't apply the ban itself. Returns the result so this screen can show what happened. */
  onThugLife: () => ThugLifeResult;
  /** Same "resolved by WorldScreen" split as `onThugLife` -- Political Affinity touches both
   * `resources` (milestones) and `WorldState` (the resolved status). `null` if the action wasn't
   * actually available (defense in depth; the button is already disabled in that case). */
  onPoliticalAffinity: () => PoliticalAffinityOutcome | null;
  /** A death outside a dungeon (Gamble's life-bet, Thug Life today; Arena to follow) -- forwarded
   * up to App.tsx via WorldScreen, which supplies `place` itself (see WorldScreenProps). */
  onCharacterDied: (cause: TownDeathCause) => void;
  /** Toggles WorldScreen's map view back on -- this screen renders in its place while standing on
   * a City/Fortress hex, so "leaving" just means looking at the map again, not switching screens. */
  onExploreWorld: () => void;
  onHardReset: () => void;
}

export function TownScreen({
  character,
  resources,
  hasDungeon,
  dungeonGateCopy,
  dungeonHistory,
  culture,
  cityName,
  showHireBoat,
  askedDungeonKnown,
  isFortress,
  buyableMounts,
  politicalStatus,
  canPoliticalAffinity,
  onUpdateResources,
  onEnterDungeon,
  onHireBoat,
  onBuyMount,
  onAsk,
  onThugLife,
  onPoliticalAffinity,
  onCharacterDied,
  onExploreWorld,
  onHardReset,
}: TownScreenProps) {
  // Merchant's "sell items for double the value" is the identical bonus Cat-Person already grants
  // -- same "two rulebook entries, one bonus" precedent as Grave Digger/Gravedigger, just OR'd
  // into the existing flag rather than a second boolean the caller would have to combine itself.
  const isCatPerson =
    character.race.name === "Cat-Person" || resources.advancedClasses.includes("Merchant");
  // Blacksmith (base Class) and Blacksmith (Advanced Class, issue #72) grant the identical
  // "repair an armor by spending 1 Torch instead of a coin" -- same dual-source-one-bonus shape.
  const isBlacksmith =
    character.cls.name === "Blacksmith" || resources.advancedClasses.includes("Blacksmith");
  const isChampion = resources.advancedClasses.includes("Champion");
  const isAlchemist = resources.advancedClasses.includes("Alchemist");
  // Ogre (New Races, issue #60): "Cannot use potions, scrolls or wear armor."
  const isOgre = character.race.name === "Ogre";
  const [graveyard] = useState(() => loadGraveyard());
  const hasRecords = graveyard.length > 0 || dungeonHistory.length > 0;
  const cultureAction = cultureActionFor(culture, resources, isOgre);
  const hirelingRoster = hirelingsFor(culture, isFortress);
  // Thug Life's outcome text (issue #58) -- unlike every other City Action's static desc, this one
  // has 5 different narrative outcomes (killed/jail-death/fled+banned/coins/treasure) worth telling
  // the player about explicitly, especially "banned" -- otherwise there'd be no way to learn why a
  // city they can see on the map suddenly refuses to let them back in. Reset to null on a fresh
  // mount only (a new City Action outcome per hex visit, not persisted).
  const [thugLifeMessage, setThugLifeMessage] = useState<string | null>(null);
  // Political Affinity's outcome text (issue #27) -- same always-visible-until-replaced precedent
  // as thugLifeMessage above.
  const [politicalAffinityMessage, setPoliticalAffinityMessage] = useState<string | null>(null);
  // "Fighting in The Arena" (issue #58, Fortress-only) -- non-null while a fight is underway;
  // `arenaLog` is a running line-per-round narration, since a fight can take several rounds unlike
  // every other City Action's single die roll. Both reset to their empty state only by starting a
  // fresh fight (RETURN_TO_CITY_ACTIONS below just closes the panel, keeping the log visible until
  // the next fight overwrites it -- there's no reason to erase a just-finished fight's story).
  const [arena, setArena] = useState<ArenaState | null>(null);
  const [arenaLog, setArenaLog] = useState<string[]>([]);

  function describeArenaRound(result: ArenaRoundResult, championName: string): string {
    if (result.events.some((e) => e.kind === "explosive")) {
      return `${championName} explodes! You catch the blast.`;
    }
    if (result.state.outcome === "victory") return `${championName} falls. Victory!`;
    if (result.died) return `${championName} strikes you down.`;
    return `You strike ${championName}. It hits back.`;
  }

  function handleStartArena() {
    setArena(startArena());
    setArenaLog([]);
    if (!resources.milestones.hasFoughtInArena) {
      onUpdateResources({
        ...resources,
        milestones: { ...resources.milestones, hasFoughtInArena: true },
      });
    }
  }

  function handleArenaAttack() {
    if (!arena) return;
    const weaponFormula = resources.weapon?.formula ?? character.cls.weaponDamage;
    const result = resolveArenaRound(arena, resources.hp, weaponFormula);
    const championName = arena.champion.name;
    setArena(result.state);
    setArenaLog((prev) => [...prev, describeArenaRound(result, championName)]);
    if (result.died) {
      onCharacterDied("arena");
      return;
    }
    const coins = result.state.outcome === "victory" ? resources.coins + 20 : resources.coins;
    onUpdateResources({ ...resources, hp: result.hp, coins });
  }

  // "Gamble" (issue #58): which of the rulebook's two sub-games runs is decided by resources.coins
  // itself (see town.ts's gamble()) -- a losing life-bet is the first way to die outside a dungeon,
  // so this can't just be a one-line onClick like every other City Action here.
  function handleGamble() {
    const result = gamble(resources);
    if (result.outcome === "diedLifeBet") {
      onCharacterDied("gamble");
      return;
    }
    onUpdateResources(result.resources);
  }

  function handleAcquireAdvancedClass(name: string) {
    onUpdateResources(acquireAdvancedClass({ resources, character, graveyard }, name));
  }

  function handleHireHireling(name: string) {
    onUpdateResources(hireHireling(resources, name, culture, isFortress));
  }

  // "Thug Life" -- resources/world are already applied by WorldScreen's onThugLife() by the time
  // this returns (died: true is the one exception, where App.tsx's death flow has already fired
  // and this screen is about to unmount); all that's left here is turning the outcome into copy.
  function handleThugLife() {
    const result: ThugLifeResult = onThugLife();
    if (result.died) return;
    switch (result.outcome) {
      case "fled":
        setThugLifeMessage(
          "Caught! You lost some blood escaping, and you're banned from here for good.",
        );
        break;
      case "coins":
        setThugLifeMessage(`You made off with ${result.amount} coins.`);
        break;
      case "treasure":
        setThugLifeMessage("You made off with a Treasure!");
        break;
    }
  }

  // Political Affinity -- resources/world are already applied by WorldScreen's
  // onPoliticalAffinity() by the time this returns; all that's left here is turning the outcome
  // into copy, same split as handleThugLife above.
  function handlePoliticalAffinity() {
    const outcome = onPoliticalAffinity();
    if (!outcome) return;
    setPoliticalAffinityMessage(
      outcome.status === "vassal"
        ? "They pledge themselves as your Vassal!"
        : outcome.status === "ally"
          ? "They welcome your friendship."
          : "They have become your enemy.",
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <main className={styles.sheet}>
            <div className={styles.sheetInner}>
              <header className={styles.wordmark}>
                <h1>NoteQuest</h1>
                <p className={styles.tagline}>The town, between one dungeon and the next.</p>
              </header>

              <p className={styles.cityEyebrow}>Town Square</p>
              <span className={styles.sheetLabel}>{cityName}</span>

              {arena ? (
                <section className={styles.actions}>
                  <h2 className={styles.trackTitle}>The Arena</h2>
                  <div className={styles.arenaCard}>
                    <p className={styles.gateCopy}>
                      {arena.champion.name} -- {arena.champion.hp} / {arena.champion.maxHp} HP
                    </p>
                    <ul className={styles.arenaLog}>
                      {arenaLog.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                    {arena.outcome === "ongoing" ? (
                      <button className={styles.rollBtn} type="button" onClick={handleArenaAttack}>
                        Attack
                      </button>
                    ) : (
                      <button
                        className={styles.rollBtn}
                        type="button"
                        onClick={() => setArena(null)}
                      >
                        Return to City Actions
                      </button>
                    )}
                  </div>
                </section>
              ) : (
                <section className={styles.actions}>
                  <h2 className={styles.trackTitle}>City Actions</h2>
                  <div className={styles.actionGrid}>
                    <button
                      className={styles.actionBtn}
                      type="button"
                      disabled={!canRest(resources, isChampion)}
                      onClick={() => onUpdateResources(rest(resources, isChampion))}
                    >
                      <span className={styles.actionName}>Rest</span>
                      <span className={styles.actionCost}>{isChampion ? "Free (Champion)" : "1 coin"}</span>
                      <span className={styles.actionDesc}>Recover your HP and spent spells.</span>
                    </button>
                    {isAlchemist && (
                      <button
                        className={styles.actionBtn}
                        type="button"
                        disabled={!canBrewHealthPotion(resources, isAlchemist, isOgre)}
                        onClick={() => onUpdateResources(brewHealthPotion(resources))}
                      >
                        <span className={styles.actionName}>Brew Health Potion</span>
                        <span className={styles.actionCost}>50 coins</span>
                        <span className={styles.actionDesc}>Heal to full HP (Alchemist).</span>
                      </button>
                    )}
                    <button
                      className={styles.actionBtn}
                      type="button"
                      disabled={!canBuyTorch(resources)}
                      onClick={() => onUpdateResources(buyTorch(resources))}
                    >
                      <span className={styles.actionName}>Buy Torches</span>
                      <span className={styles.actionCost}>1 coin</span>
                      <span className={styles.actionDesc}>
                        +1 torch, up to a maximum of 10 carried.
                      </span>
                    </button>
                    <button
                      className={styles.actionBtn}
                      type="button"
                      disabled={!canBuyProvision(resources)}
                      onClick={() => onUpdateResources(buyProvision(resources))}
                    >
                      <span className={styles.actionName}>Buy Provisions</span>
                      <span className={styles.actionCost}>1 coin</span>
                      <span className={styles.actionDesc}>
                        +1 provision, up to a maximum of 20 carried.
                      </span>
                    </button>
                    <button
                      className={styles.actionBtn}
                      type="button"
                      disabled={askedDungeonKnown}
                      onClick={onAsk}
                    >
                      <span className={styles.actionName}>Ask</span>
                      <span className={styles.actionCost}>Free</span>
                      <span className={styles.actionDesc}>
                        {askedDungeonKnown
                          ? "A dungeon is already known nearby."
                          : "Ask about the nearest dungeon."}
                      </span>
                    </button>
                    <button
                      className={styles.actionBtn}
                      type="button"
                      disabled={!canPoliticalAffinity}
                      onClick={handlePoliticalAffinity}
                    >
                      <span className={styles.actionName}>Political Affinity</span>
                      <span className={styles.actionCost}>Free</span>
                      <span className={styles.actionDesc}>
                        {politicalAffinityMessage ??
                          (politicalStatus
                            ? POLITICAL_STATUS_DESC[politicalStatus]
                            : "Roll to win this place's allegiance.")}
                      </span>
                    </button>
                    {cultureAction && (
                      <button
                        className={styles.actionBtn}
                        type="button"
                        disabled={cultureAction.disabled}
                        onClick={() => onUpdateResources(cultureAction.apply(resources))}
                      >
                        <span className={styles.actionName}>{cultureAction.name}</span>
                        <span className={styles.actionCost}>{cultureAction.cost}</span>
                        <span className={styles.actionDesc}>{cultureAction.desc}</span>
                      </button>
                    )}
                    {showHireBoat && (
                      <button
                        className={styles.actionBtn}
                        type="button"
                        disabled={!canHireBoat(resources)}
                        onClick={onHireBoat}
                      >
                        <span className={styles.actionName}>Hire Boat</span>
                        <span className={styles.actionCost}>1 coin</span>
                        <span className={styles.actionDesc}>
                          Cross water normally until you step onto dry land again.
                        </span>
                      </button>
                    )}
                    {!isFortress && (
                      <button
                        className={styles.actionBtn}
                        type="button"
                        disabled={!canHardWork(resources)}
                        onClick={() => onUpdateResources(hardWork(resources))}
                      >
                        <span className={styles.actionName}>Hard Work</span>
                        <span className={styles.actionCost}>Free</span>
                        <span className={styles.actionDesc}>
                          Permanently lose 1 max HP, gain 1d6+1 coins.
                        </span>
                      </button>
                    )}
                    <button className={styles.actionBtn} type="button" onClick={handleGamble}>
                      <span className={styles.actionName}>Gamble</span>
                      <span className={styles.actionCost}>
                        {resources.coins >= 1 ? "1 coin" : "Your life"}
                      </span>
                      <span className={styles.actionDesc}>
                        {resources.coins >= 1
                          ? "Roll a 6 to win 6 coins, otherwise nothing."
                          : "No coins left -- roll a 6 to survive and earn 5, or die."}
                      </span>
                    </button>
                    <button className={styles.actionBtn} type="button" onClick={handleThugLife}>
                      <span className={styles.actionName}>Thug Life</span>
                      <span className={styles.actionCost}>Risky</span>
                      <span className={styles.actionDesc}>
                        {thugLifeMessage ??
                          `Rob a traveler (${isFortress ? "3d6" : "2d6"}) -- could pay off, or get you killed or banned.`}
                      </span>
                    </button>
                    {isFortress && (
                      <button className={styles.actionBtn} type="button" onClick={handleStartArena}>
                        <span className={styles.actionName}>Fight in the Arena</span>
                        <span className={styles.actionCost}>Deadly</span>
                        <span className={styles.actionDesc}>
                          Face an unknown Champion. Win: 20 coins. Lose: you die.
                        </span>
                      </button>
                    )}
                  </div>
                  <p className={styles.sellNote}>
                    Sell items from your Pack for their listed worth in coins
                    {isCatPerson
                      ? ` (doubled, ${character.race.name === "Cat-Person" ? "Cat-Person" : "Merchant"})`
                      : ""}
                    , or fix a damaged armor piece from your Equipment, for{" "}
                    {isBlacksmith
                      ? `1 torch (${character.cls.name === "Blacksmith" ? "Blacksmith" : "Advanced Class"})`
                      : "1 coin"}
                    .
                  </p>
                </section>
              )}

              <section className={styles.adventureSection}>
                <div className={hasRecords ? styles.adventureRow : undefined}>
                  <div>
                    <h2 className={styles.trackTitle}>Adventure</h2>

                    {hasDungeon && (
                      <div className={styles.activeDungeonCard}>
                        <p className={styles.gateCopy}>{dungeonGateCopy}</p>
                        <button className={styles.rollBtn} type="button" onClick={onEnterDungeon}>
                          Enter Dungeon
                        </button>
                      </div>
                    )}

                    <div className={styles.rollNewSection}>
                      <p className={styles.gateCopy}>
                        Leave the city behind and see what's out there.
                      </p>
                      <button className={styles.ghostBtn} type="button" onClick={onExploreWorld}>
                        Explore the World
                      </button>
                    </div>
                  </div>

                  {hasRecords && (
                    <div className={styles.recordsCol}>
                      <RecordsPanel
                        graveyardEntries={graveyard}
                        dungeons={dungeonHistory}
                        compact
                      />
                    </div>
                  )}
                </div>
              </section>

              <section className={styles.adventureSection}>
                <AdvancedClasses
                  character={character}
                  resources={resources}
                  graveyard={graveyard}
                  onAcquire={handleAcquireAdvancedClass}
                />
              </section>

              {hirelingRoster.length > 0 && (
                <section className={styles.adventureSection}>
                  <Hireling
                    hireling={resources.hireling}
                    roster={hirelingRoster}
                    canHire={(name) => canHireHireling(resources, name, culture, isFortress)}
                    onHire={handleHireHireling}
                  />
                </section>
              )}

              <section className={styles.adventureSection}>
                <Animals
                  animals={resources.animals}
                  buyableMounts={buyableMounts}
                  resources={resources}
                  onBuyMount={onBuyMount}
                />
              </section>

              {resources.buildings.length > 0 && (
                <section className={styles.adventureSection}>
                  <Buildings buildings={resources.buildings} />
                </section>
              )}
            </div>
          </main>
        </div>

        <aside className={styles.side}>
          <CharacterSheet
            character={character}
            torches={resources.torches}
            hp={resources.hp}
            maxHp={resources.maxHp}
            coins={resources.coins}
            treasures={resources.treasures}
            keys={resources.keys}
            provisions={resources.provisions}
            weaponName={resources.weapon?.name}
            weaponFormula={resources.weapon?.formula}
            spellUses={resources.spellUses}
            maxSpellUses={resources.maxSpellUses}
            monsterKills={resources.monsterKills}
            killsByName={resources.killsByName}
            canCastOutOfCombat
            onCastSpell={(table, spellRoll) => onUpdateResources(castSpell(resources, table, spellRoll))}
          />
          <Equipment
            armor={resources.armor}
            weapon={resources.weapon}
            spareWeapons={resources.spareWeapons}
            onWield={(index) => onUpdateResources(wieldWeapon(resources, index))}
            onFixArmor={(index) => onUpdateResources(fixArmor(resources, index, isBlacksmith))}
            isBlacksmith={isBlacksmith}
          />
          <Pack
            items={resources.heldItems}
            onSell={(index) => onUpdateResources(sellItem(resources, index, isCatPerson))}
          />
        </aside>
      </div>

      <Footer screenLabel="THE TOWN" onHardReset={onHardReset} />
    </div>
  );
}
