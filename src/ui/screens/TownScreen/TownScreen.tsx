import { useState } from "react";
import type { CreatedCharacter } from "../../../data/types.ts";
import { isDungeonBeaten, type PendingDungeon } from "../../../engine/dungeonState.ts";
import { computeSpellUses } from "../../../engine/character.ts";
import { loadGraveyard } from "../../../engine/graveyard.ts";
import {
  buyTorch,
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
import { Graveyard } from "../../components/Graveyard/Graveyard.tsx";
import styles from "./TownScreen.module.css";

export interface TownScreenProps {
  character: CreatedCharacter;
  resources: AdventurerResources;
  /** This character's own paused dungeon, if they've retreated from one and it isn't beaten. */
  activeDungeon: PendingDungeon | null;
  /** Every other dungeon any character has ever touched, unbeaten (resumable) or beaten (a record). */
  dungeonHistory: PendingDungeon[];
  onUpdateResources: (resources: AdventurerResources) => void;
  onContinueActive: () => void;
  onResumeDungeon: (pending: PendingDungeon) => void;
  onRollNew: () => void;
}

/** Most-recently-touched first (mirroring the Graveyard's own `.reverse()`), with beaten dungeons
 * grouped after every unbeaten one -- Array.prototype.sort is stable, so reversing first preserves
 * recency order within each group. */
function sortDungeonHistory(history: PendingDungeon[]): PendingDungeon[] {
  return [...history]
    .reverse()
    .sort((a, b) => Number(isDungeonBeaten(a.dungeon)) - Number(isDungeonBeaten(b.dungeon)));
}

export function TownScreen({
  character,
  resources,
  activeDungeon,
  dungeonHistory,
  onUpdateResources,
  onContinueActive,
  onResumeDungeon,
  onRollNew,
}: TownScreenProps) {
  const maxSpellUses = computeSpellUses(character.spells, character.fixedGrants);
  const sortedHistory = sortDungeonHistory(dungeonHistory);
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
                    disabled={!canRest(resources)}
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
                </div>
                <p className={styles.sellNote}>
                  Sell items from your Pack for their listed worth in coins{isCatPerson ? " (doubled, Cat-Person)" : ""}, or
                  fix a damaged armor piece from your Equipment, for {isBlacksmith ? "1 torch (Blacksmith)" : "1 coin"}.
                </p>
              </section>

              <section className={styles.adventureSection}>
                <h2 className={styles.trackTitle}>Adventure</h2>

                {activeDungeon && (
                  <div className={styles.activeDungeonCard}>
                    <p className={styles.gateCopy}>
                      {activeDungeon.dungeon.dungeonName ?? "Your dungeon"} awaits — you left off on Level{" "}
                      {activeDungeon.dungeon.activeLevel + 1}.
                    </p>
                    <button className={styles.rollBtn} type="button" onClick={onContinueActive}>
                      Continue the Dungeon
                    </button>
                  </div>
                )}

                {sortedHistory.length > 0 && (
                  <section className={styles.historyPanel}>
                    <h3 className={styles.historyTitle}>Dungeon History</h3>
                    <p className={styles.historyNote}>
                      {sortedHistory.length} dungeon{sortedHistory.length === 1 ? "" : "s"} touched by adventurers
                      before you.
                    </p>
                    <ul className={styles.historyList}>
                      {sortedHistory.map((pd) => {
                        const beaten = isDungeonBeaten(pd.dungeon);
                        const name = pd.dungeon.dungeonName ?? "An unnamed dungeon";
                        return (
                          <li key={pd.id}>
                            {beaten ? (
                              <div className={styles.historyRow}>
                                <span className={styles.historyName}>{name}</span>
                                <span className={styles.historyMeta}>beaten by {pd.lastCharacterName}</span>
                                <span className={`${styles.historyStatus} ${styles.historyStatusDone}`}>
                                  Completed
                                </span>
                              </div>
                            ) : (
                              <button
                                className={`${styles.historyRow} ${styles.historyBtn}`}
                                type="button"
                                onClick={() => onResumeDungeon(pd)}
                              >
                                <span className={styles.historyName}>
                                  {name} — Level {pd.dungeon.activeLevel + 1}
                                </span>
                                <span className={styles.historyMeta}>last explored by {pd.lastCharacterName}</span>
                                <span className={styles.historyStatus}>Take up →</span>
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                <div className={styles.rollNewSection}>
                  <p className={styles.gateCopy}>Or set out for an entirely new dungeon.</p>
                  <button className={styles.ghostBtn} type="button" onClick={onRollNew}>
                    Roll for a New Dungeon
                  </button>
                </div>
              </section>
            </div>
          </main>

          <Graveyard entries={graveyard} />
        </div>

        <aside className={styles.side}>
          <CharacterSheet
            character={character}
            torches={resources.torches}
            hp={resources.hp}
            coins={resources.coins}
            treasures={resources.treasures}
            keys={resources.keys}
            weaponName={resources.weapon?.name}
            weaponFormula={resources.weapon?.formula}
            spellUses={resources.spellUses}
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
