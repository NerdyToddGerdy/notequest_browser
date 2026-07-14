import { ARMOR_PIECE_LABELS, describeItemEffect } from "../../../data/dungeonTables.ts";
import type { ArmorPiece, EquippedWeapon } from "../../../engine/dungeonState.ts";
import styles from "./Equipment.module.css";

export interface EquipmentProps {
  armor: ArmorPiece[];
  weapon: EquippedWeapon | null;
  /** Set only in Town -- rendering a Fix button per damaged piece and enabling the "Fix Armor" city action. */
  onFixArmor?: (index: number) => void;
}

/** Worn armor pieces and an acquired weapon override -- see ArmorPiece/EquippedWeapon for how they're earned. */
export function Equipment({ armor, weapon, onFixArmor }: EquipmentProps) {
  if (armor.length === 0 && !weapon) return null;

  const weaponEffectText = weapon?.bonusEffect ? describeItemEffect(weapon.bonusEffect) : null;

  return (
    <div className={styles.panel}>
      <h3>Equipment</h3>

      {weapon && (
        <p className={styles.weaponRow} title={weaponEffectText ?? undefined}>
          <span className={`${styles.weaponName} ${weaponEffectText ? styles.hasEffect : ""}`}>{weapon.name}</span>
          <span className={styles.weaponFormula}>
            {weapon.formula} damage{weapon.twoHanded ? " · Two-handed" : ""}
          </span>
        </p>
      )}

      {armor.length > 0 && (
        <ul className={styles.list}>
          {armor.map((piece, index) => {
            const label = piece.itemName ?? ARMOR_PIECE_LABELS[piece.piece];
            const needsFixing = piece.maxHp > 0 && piece.hp < piece.maxHp;
            const effectText = piece.effect ? describeItemEffect(piece.effect) : null;
            return (
              <li key={index} className={styles.row} title={effectText ?? undefined}>
                <span className={`${styles.name} ${effectText ? styles.hasEffect : ""}`}>{label}</span>
                {piece.maxHp > 0 && (
                  <span className={`${styles.hp} ${piece.hp <= 0 ? styles.destroyed : ""}`}>
                    {piece.hp}/{piece.maxHp} HP
                  </span>
                )}
                {onFixArmor && needsFixing && (
                  <button type="button" className={styles.fixBtn} onClick={() => onFixArmor(index)}>
                    Fix (1 coin)
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
