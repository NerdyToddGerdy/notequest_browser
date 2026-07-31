import { ARMOR_PIECE_LABELS, describeItemEffect } from "../../../data/dungeonTables.ts";
import type { ArmorPiece, EquippedWeapon } from "../../../engine/dungeonState.ts";
import type { EquipmentSaleTarget } from "../../../engine/town.ts";
import styles from "./Equipment.module.css";

export interface EquipmentProps {
  armor: ArmorPiece[];
  weapon: EquippedWeapon | null;
  /** Found weapons not currently wielded -- see DungeonState.spareWeapons. */
  spareWeapons?: EquippedWeapon[];
  /** Set whenever wielding is available (both DungeonScreen and TownScreen) -- renders a "Wield"
   * button per spare weapon. */
  onWield?: (index: number) => void;
  /** Found armor pieces benched because their slot was already occupied -- see DungeonState.spareArmor. */
  spareArmor?: ArmorPiece[];
  /** Set whenever wielding is available (both DungeonScreen and TownScreen) -- renders a "Wield"
   * button per spare armor piece. */
  onWieldArmor?: (index: number) => void;
  /** Set only in Town -- rendering a Fix button per damaged piece and enabling the "Fix Armor" city action. */
  onFixArmor?: (index: number) => void;
  /** Blacksmith: "You can repair an armor by spending 1 Torch" instead of the usual 1 coin. */
  isBlacksmith?: boolean;
  /** Set only in Town (issue #117) -- renders a "Sell" button on every gear row. One callback for all
   * four lists rather than four props, since the target already names which list it came from. */
  onSell?: (target: EquipmentSaleTarget) => void;
  /** What a given row would fetch, used to label its Sell button so the price shown is the price
   * paid. Required alongside `onSell`; ignored without it. */
  saleWorth?: (target: EquipmentSaleTarget) => number | null;
}

/** A named piece has to say *where* it's worn (issue #116): `itemName` used to replace the slot
 * label outright, so "Helm of the Dead" gave the player no way to tell which of the five body slots
 * it occupied -- the exact thing a player reported being unable to check. */
function armorLabel(piece: ArmorPiece): string {
  const slot = ARMOR_PIECE_LABELS[piece.piece];
  return piece.itemName ? `${piece.itemName} (${slot})` : slot;
}

/** Worn armor pieces and an acquired weapon override -- see ArmorPiece/EquippedWeapon for how they're earned. */
export function Equipment({
  armor,
  weapon,
  spareWeapons = [],
  onWield,
  spareArmor = [],
  onWieldArmor,
  onFixArmor,
  isBlacksmith = false,
  onSell,
  saleWorth,
}: EquipmentProps) {
  if (armor.length === 0 && !weapon && spareWeapons.length === 0 && spareArmor.length === 0)
    return null;

  const weaponEffectText = weapon?.bonusEffect ? describeItemEffect(weapon.bonusEffect) : null;

  /** Rendered on every gear row in Town (issue #117). Omitted entirely rather than disabled when the
   * row can't be priced, since an unsellable row has nothing to explain. */
  function sellButton(target: EquipmentSaleTarget) {
    if (!onSell || !saleWorth) return null;
    const worth = saleWorth(target);
    if (worth === null) return null;
    return (
      <button type="button" className={styles.fixBtn} onClick={() => onSell(target)}>
        Sell ({worth}c)
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <h3>Equipment</h3>

      {weapon && (
        <p className={styles.weaponRow} title={weaponEffectText ?? undefined}>
          <span className={styles.weaponRowTop}>
            <span className={`${styles.weaponName} ${weaponEffectText ? styles.hasEffect : ""}`}>
              {weapon.name}
            </span>
            {sellButton({ list: "weapon", index: 0 })}
          </span>
          <span className={styles.weaponFormula}>
            {weapon.formula} damage{weapon.twoHanded ? " · Two-handed" : ""}
          </span>
        </p>
      )}

      {spareWeapons.length > 0 && (
        <>
          <h4 className={styles.subheading}>Spare Weapons</h4>
          <ul className={styles.list}>
            {spareWeapons.map((spare, index) => {
              const effectText = spare.bonusEffect ? describeItemEffect(spare.bonusEffect) : null;
              return (
                <li key={index} className={styles.spareRow} title={effectText ?? undefined}>
                  <div className={styles.spareRowTop}>
                    <span className={`${styles.name} ${effectText ? styles.hasEffect : ""}`}>
                      {spare.name}
                    </span>
                    {onWield && (
                      <button
                        type="button"
                        className={styles.fixBtn}
                        onClick={() => onWield(index)}
                      >
                        Wield
                      </button>
                    )}
                    {sellButton({ list: "spareWeapons", index })}
                  </div>
                  <span className={styles.weaponFormula}>
                    {spare.formula} damage{spare.twoHanded ? " · Two-handed" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {armor.length > 0 && (
        <>
          {/* Was the one unlabelled list here, so it read as a continuation of "Spare Weapons" above
              whenever no weapon was equipped -- part of the same "where is this worn?" confusion
              issue #116 reported. */}
          <h4 className={styles.subheading}>Worn Armor</h4>
          <ul className={styles.list}>
            {armor.map((piece, index) => {
              const label = armorLabel(piece);
              const needsFixing = piece.maxHp > 0 && piece.hp < piece.maxHp;
              const effectText = piece.effect ? describeItemEffect(piece.effect) : null;
              return (
                <li key={index} className={styles.row} title={effectText ?? undefined}>
                  <span className={`${styles.name} ${effectText ? styles.hasEffect : ""}`}>
                    {label}
                  </span>
                  {piece.maxHp > 0 && (
                    <span className={`${styles.hp} ${piece.hp <= 0 ? styles.destroyed : ""}`}>
                      {piece.hp}/{piece.maxHp} HP
                    </span>
                  )}
                  {onFixArmor && needsFixing && (
                    <button
                      type="button"
                      className={styles.fixBtn}
                      onClick={() => onFixArmor(index)}
                    >
                      Fix ({isBlacksmith ? "1 torch" : "1 coin"})
                    </button>
                  )}
                  {sellButton({ list: "armor", index })}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {spareArmor.length > 0 && (
        <>
          <h4 className={styles.subheading}>Spare Armor</h4>
          <ul className={styles.list}>
            {spareArmor.map((piece, index) => {
              const label = armorLabel(piece);
              const effectText = piece.effect ? describeItemEffect(piece.effect) : null;
              return (
                <li key={index} className={styles.spareRow} title={effectText ?? undefined}>
                  <div className={styles.spareRowTop}>
                    <span className={`${styles.name} ${effectText ? styles.hasEffect : ""}`}>
                      {label}
                    </span>
                    {onWieldArmor && (
                      <button
                        type="button"
                        className={styles.fixBtn}
                        onClick={() => onWieldArmor(index)}
                      >
                        Wield
                      </button>
                    )}
                    {sellButton({ list: "spareArmor", index })}
                  </div>
                  {piece.maxHp > 0 && (
                    <span className={`${styles.hp} ${piece.hp <= 0 ? styles.destroyed : ""}`}>
                      {piece.hp}/{piece.maxHp} HP
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
