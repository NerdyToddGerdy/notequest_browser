import { useState } from "react";
import type { CreatedCharacter } from "../../../data/types.ts";
import type { CityCulture } from "../../../data/affinity.ts";
import { computeSpellUses } from "../../../engine/character.ts";
import { loadGraveyard } from "../../../engine/graveyard.ts";
import type { PendingDungeon } from "../../../engine/dungeonState.ts";
import {
  buyElvenBoots,
  buyLamp,
  buyOrcGladio,
  buyProvision,
  buyTorch,
  canBuyElvenBoots,
  canBuyLamp,
  canBuyOrcGladio,
  canBuyProvision,
  canBuyTorch,
  canDrinkVerdosaPotion,
  canHireBoat,
  canLearnRandomSpell,
  canRemoveCurse,
  canRest,
  castSpell,
  drinkVerdosaPotion,
  fixArmor,
  learnRandomSpell,
  removeCurse,
  rest,
  sellItem,
  wieldWeapon,
  type AdventurerResources,
} from "../../../engine/town.ts";
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
function cultureActionFor(culture: CityCulture | null, resources: AdventurerResources): CultureAction | null {
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
        disabled: !canDrinkVerdosaPotion(resources),
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
  onUpdateResources: (resources: AdventurerResources) => void;
  onEnterDungeon: () => void;
  onHireBoat: () => void;
  onAsk: () => void;
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
  showHireBoat,
  askedDungeonKnown,
  onUpdateResources,
  onEnterDungeon,
  onHireBoat,
  onAsk,
  onExploreWorld,
  onHardReset,
}: TownScreenProps) {
  const maxSpellUses = computeSpellUses(character.spells, character.fixedGrants);
  const isCatPerson = character.race.name === "Cat-Person";
  const isBlacksmith = character.cls.name === "Blacksmith";
  const [graveyard] = useState(() => loadGraveyard());
  const hasRecords = graveyard.length > 0 || dungeonHistory.length > 0;
  const cultureAction = cultureActionFor(culture, resources);

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

              <span className={styles.sheetLabel}>Town Square</span>

              <section className={styles.actions}>
                <h2 className={styles.trackTitle}>City Actions</h2>
                <div className={styles.actionGrid}>
                  <button
                    className={styles.actionBtn}
                    type="button"
                    disabled={!canRest(resources, maxSpellUses)}
                    onClick={() => onUpdateResources(rest(resources, maxSpellUses))}
                  >
                    <span className={styles.actionName}>Rest</span>
                    <span className={styles.actionCost}>1 coin</span>
                    <span className={styles.actionDesc}>Recover your HP and spent spells.</span>
                  </button>
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
                </div>
                <p className={styles.sellNote}>
                  Sell items from your Pack for their listed worth in coins
                  {isCatPerson ? " (doubled, Cat-Person)" : ""}, or fix a damaged armor piece from
                  your Equipment, for {isBlacksmith ? "1 torch (Blacksmith)" : "1 coin"}.
                </p>
              </section>

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
                      <RecordsPanel graveyardEntries={graveyard} dungeons={dungeonHistory} compact />
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>
        </div>

        <aside className={styles.side}>
          <CharacterSheet
            character={character}
            torches={resources.torches}
            hp={resources.hp}
            coins={resources.coins}
            treasures={resources.treasures}
            keys={resources.keys}
            provisions={resources.provisions}
            weaponName={resources.weapon?.name}
            weaponFormula={resources.weapon?.formula}
            spellUses={resources.spellUses}
            monsterKills={resources.monsterKills}
            killsByName={resources.killsByName}
            canCastOutOfCombat
            onCastSpell={(spellRoll) => onUpdateResources(castSpell(resources, spellRoll))}
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
