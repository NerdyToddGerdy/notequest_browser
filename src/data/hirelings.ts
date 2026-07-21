import type { CityCulture } from "./affinity.ts";
import type { HirelingDef } from "./types.ts";

/** Hirelings (Expanded World, `docs/game-rules-reference.md` lines 1569-1626, issue #25) -- paid
 * companions hired in a City/Fortress "to face just one dungeon," one roster per culture. Every
 * entry from the rulebook is authored here regardless of whether this app can give it a real
 * mechanical effect yet (see `src/engine/hirelings.ts`'s `HIRELING_ABILITY_HANDLERS` for which ones
 * do something today) -- an unimplemented ability still shows its real cost/HP/equipment/ability
 * text in the UI, just with no working effect, rather than being omitted outright. */
export const HIRELING_ROSTERS: Record<CityCulture, HirelingDef[]> = {
  human: [
    { name: "Torchbearer", cost: 10, hp: 10, equipmentText: "None", abilityText: "None and doesn't know how to fight." },
    { name: "Mercenary", cost: 30, hp: 14, equipmentText: "Club (1d6-2 damage)", abilityText: "None." },
  ],
  elven: [
    { name: "Elf Ranger", cost: 30, hp: 11, equipmentText: "Saber (1d6 damage)", abilityText: "Ignores Travel Events." },
    { name: "Elf Soldier", cost: 60, hp: 13, equipmentText: "Staff (1d6-2 damage)", abilityText: "Can cast 3 random Basic Spells." },
  ],
  dwarven: [
    { name: "Dwarf Miner", cost: 40, hp: 15, equipmentText: "Pickaxe (1d6-1 damage)", abilityText: "To Find Secret Passages, roll two dice." },
    { name: "Dwarf Soldier", cost: 50, hp: 16, equipmentText: "Axe (1d6+1 damage)", abilityText: "Deals +1 damage against Orcs and Goblins." },
  ],
  gnome: [
    { name: "Gnome Helper", cost: 30, hp: 7, equipmentText: "None", abilityText: "Can cast 4 random Basic Spells." },
  ],
  // "Table: Hireling — Orc or Goblin City or Fortress" -- one combined roster shared identically
  // between the two cultures, per the rulebook's own single table.
  goblin: [
    { name: "Goblin Helper", cost: 10, hp: 1, equipmentText: "None", abilityText: "It can explode at any time, dealing 5 damage." },
    { name: "Orc Soldier", cost: 50, hp: 17, equipmentText: "Gladio (1d6 damage)", abilityText: "None." },
    { name: "Cargo Ogre", cost: 80, hp: 40, equipmentText: "Can't use anything", abilityText: "Can carry 40 items (return it to you at the end)." },
  ],
  orc: [
    { name: "Goblin Helper", cost: 10, hp: 1, equipmentText: "None", abilityText: "It can explode at any time, dealing 5 damage." },
    { name: "Orc Soldier", cost: 50, hp: 17, equipmentText: "Gladio (1d6 damage)", abilityText: "None." },
    { name: "Cargo Ogre", cost: 80, hp: 40, equipmentText: "Can't use anything", abilityText: "Can carry 40 items (return it to you at the end)." },
  ],
};

/** "Table: Hireling — Human Fortress" -- additional to (not instead of) the base Human roster
 * above, offered only at a Human Fortress specifically (every other culture's single table already
 * applies to both its City and Fortress). */
export const HUMAN_FORTRESS_HIRELINGS: HirelingDef[] = [
  { name: "Jester", cost: 30, hp: 17, equipmentText: "None", abilityText: "Can clown." },
  { name: "Burglar", cost: 40, hp: 14, equipmentText: "Dagger (1d6-1 damage)", abilityText: "Open locks without wasting torches." },
  { name: "Bodyguard", cost: 60, hp: 16, equipmentText: "Shortsword (1d6 damage)", abilityText: "None." },
  { name: "Minstrel", cost: 60, hp: 16, equipmentText: "Mandolin (Two-handed)", abilityText: "Can play music in combat (+2 damage)." },
  { name: "Rent Wizard", cost: 80, hp: 14, equipmentText: "Staff (1d6-1 damage)", abilityText: "Can cast 4 random Basic Spells." },
  { name: "War Veteran", cost: 100, hp: 16, equipmentText: "Longsword (1d6+1 damage)", abilityText: "None." },
];

/** The roster available at the current hex -- `culture`/`isFortress` mirror the exact same signal
 * `TownScreen.tsx`'s `cultureActionFor()`/Hard Work gating already use. Empty for Ruins (`culture`
 * is `null` there, matching every other City Action). */
export function hirelingsFor(culture: CityCulture | null, isFortress: boolean): HirelingDef[] {
  if (!culture) return [];
  const base = HIRELING_ROSTERS[culture];
  if (culture === "human" && isFortress) return [...base, ...HUMAN_FORTRESS_HIRELINGS];
  return base;
}

/** Every roster entry, across every culture, keyed by name -- for resolving `resources.hireling`'s
 * bare name back into its full `HirelingDef` for display (a hireling's roster can be out of reach
 * once the player has moved on, so this can't just re-derive from the current hex's roster alone). */
export const HIRELING_BY_NAME: Record<string, HirelingDef> = Object.fromEntries(
  [...Object.values(HIRELING_ROSTERS).flat(), ...HUMAN_FORTRESS_HIRELINGS].map((def) => [def.name, def]),
);
