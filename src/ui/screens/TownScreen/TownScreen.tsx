import { useState } from "react";
import type { CreatedCharacter } from "../../../data/types.ts";
import { computeSpellUses } from "../../../engine/character.ts";
import { loadGraveyard } from "../../../engine/graveyard.ts";
import type { PendingDungeon } from "../../../engine/dungeonState.ts";
import {
  buyProvision,
  buyTorch,
  canBuyProvision,
  canBuyTorch,
  canRest,
  fixArmor,
  rest,
  sellItem,
  type AdventurerResources,
} from "../../../engine/town.ts";
import { CharacterSheet } from "../../components/CharacterSheet/CharacterSheet.tsx";
import { Equipment } from "../../components/Equipment/Equipment.tsx";
import { Pack } from "../../components/Pack/Pack.tsx";
import { RecordsPanel } from "../../components/RecordsPanel/RecordsPanel.tsx";
import styles from "./TownScreen.module.css";

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
  onUpdateResources: (resources: AdventurerResources) => void;
  onEnterDungeon: () => void;
  /** Toggles WorldScreen's map view back on -- this screen renders in its place while standing on
   * a City/Fortress hex, so "leaving" just means looking at the map again, not switching screens. */
  onExploreWorld: () => void;
}

export function TownScreen({
  character,
  resources,
  hasDungeon,
  dungeonGateCopy,
  dungeonHistory,
  onUpdateResources,
  onEnterDungeon,
  onExploreWorld,
}: TownScreenProps) {
  const maxSpellUses = computeSpellUses(character.spells, character.fixedGrants);
  const isCatPerson = character.race.name === "Cat-Person";
  const isBlacksmith = character.cls.name === "Blacksmith";
  const [graveyard] = useState(() => loadGraveyard());

  return (
    <div className={styles.page}>
      <header className={styles.wordmark}>
        <h1>NoteQuest</h1>
        <p className={styles.tagline}>The town, between one dungeon and the next.</p>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <main className={styles.sheet}>
            <div className={styles.sheetInner}>
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
                    <span className={styles.actionDesc}>+1 torch, up to a maximum of 10 carried.</span>
                  </button>
                  <button
                    className={styles.actionBtn}
                    type="button"
                    disabled={!canBuyProvision(resources)}
                    onClick={() => onUpdateResources(buyProvision(resources))}
                  >
                    <span className={styles.actionName}>Buy Provisions</span>
                    <span className={styles.actionCost}>1 coin</span>
                    <span className={styles.actionDesc}>+1 provision, up to a maximum of 20 carried.</span>
                  </button>
                </div>
                <p className={styles.sellNote}>
                  Sell items from your Pack for their listed worth in coins{isCatPerson ? " (doubled, Cat-Person)" : ""}, or
                  fix a damaged armor piece from your Equipment, for {isBlacksmith ? "1 torch (Blacksmith)" : "1 coin"}.
                </p>
              </section>

              <section className={styles.adventureSection}>
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
                  <p className={styles.gateCopy}>Leave the city behind and see what's out there.</p>
                  <button className={styles.ghostBtn} type="button" onClick={onExploreWorld}>
                    Explore the World
                  </button>
                </div>
              </section>
            </div>
          </main>

          <RecordsPanel graveyardEntries={graveyard} dungeons={dungeonHistory} />
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
          />
          <Equipment
            armor={resources.armor}
            weapon={resources.weapon}
            onFixArmor={(index) => onUpdateResources(fixArmor(resources, index, isBlacksmith))}
            isBlacksmith={isBlacksmith}
          />
          <Pack
            items={resources.heldItems}
            onSell={(index) => onUpdateResources(sellItem(resources, index, isCatPerson))}
          />
        </aside>
      </div>

      <footer className={styles.credit}>
        <p>NOTEQUEST · THE TOWN</p>
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
        <p className={styles.creditVersion}>v{__APP_VERSION__}</p>
      </footer>
    </div>
  );
}
