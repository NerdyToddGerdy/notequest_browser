# Deferred work and documented simplifications

Collected so they aren't re-discovered as bugs. Each is a deliberate call, not an oversight.

## The two governing conventions

**Documented, deliberate simplification.** Where the rulebook references a system this app doesn't model, the effect is resolved as flavor-only text or a flat coin/HP value rather than inventing new infrastructure. Document the call at the site.

**No formal taxonomy, substring matching instead.** Monster "categories" (Undead, Vampire, insect/arachnid) and item bonuses against them are matched via case-insensitive substring checks against `MonsterTemplate.name` (`matchesTags()`), since the rulebook itself has no such system.

## Unbuilt dungeon types

**Mine and Cave** (plus their Underwater Cave / Volcanic Cave variants) are the remaining unbuilt types of the rulebook's set. `DUNGEON_TYPE_BY_TERRAIN` and the Ruins 2d6 table substitute thematically where they'd be rolled — usually Sewers, since both are tunnel complexes.

**Volcano is deliberately absent** from `LOCATION_EFFECTS`: its entire rulebook content is "Has a Volcanic Cave." Substituting some other dungeon would be a worse lie than saying so, so `LOCATION_EFFECT_NOTES` gives it a read-only `HexInspector` line instead — the hex explains what's there and why you can't enter. Same for Reef's `foundUnbuiltCave` flag.

**Unique dungeons** are tracked by the notional rulebook type (`UniqueDungeonKey`), **not** by the substitute currently built for them. Plains 12 (Entrails) and Plains 10-11 (Pyramid) share a `typeRoll`, so attaching the rule to the substitute would silently lock Pyramid out of the entire world. There's a test asserting this.

## No hand economy beyond `hands.ts`

`src/engine/hands.ts` implements the torch-occupies-a-hand rule (see [dungeon.md](dungeon.md)), but nothing models an off-hand or shield slot.

- `WeaponEntry.twoHanded` remains a **boolean, not a hand count**.
- **Ambidextrous / Multidextrous** dual-wielding is unbuilt for this reason.
- Blade Trap's roll-of-2 ("loses an arm") is real as `armLost`, but the Laboratory's Trap 1 severed hand and its Extra Hand Potion are both flavor.

## Spells with no "Cast" button

Rolled, tracked and displayed, but not castable — each blocked on a system this codebase doesn't have (ally-in-combat, temporary armor, a spell-picker UI):

Create Food, Summon Wolf, Summon Skeleton, Awakening, Summon Elemental, Stone Armor, Collapse, Open Portal, Reload Mana.

**A spell absent from `combat.ts`'s `KNOWN_CASTABLE_SPELL_NAMES` simply gets no Cast button anywhere** — that's the mechanism, not a bug.

## Flavor-only abilities

**Advanced Classes** (#111): Ambidextrous, Multidextrous, Collector, Assassin, Ghostbuster, Cook, Emperor pass their requirement checks, charge coins and grant their HP bonus but originally did nothing. `hasImplementedAbility()` (backed by `FLAVOR_ONLY_ABILITIES`) drives a "flavor only" chip in the purchase list and on `CharacterSheet`. **It must stay in step with `applyAdvancedClassAbility()`'s own `switch`, which sits right above it.** Classes whose text is literally "None." are deliberately excluded — they already say they do nothing.

**Hirelings** (#63): Torchbearer, Mercenary, Bodyguard, War Veteran, Orc Soldier are "None."; Jester's "can clown" has no clear rule.

**Animals** (#67): Cat, Wolf, Polar Bear ("None."); Tiger (moot — nothing models dungeon-presence to restrict); Eagle (no reveal-more-than-one-ring mechanism); Dolphin (near-moot — no `LocationKind` ever generates on Water).

**Races**: Fungoid's provision-heal (provisions aren't tracked inside a dungeon run). Everything not listed in [character.md](character.md)'s hooked-abilities table.

**Mutations**: the five purely cosmetic rows (poodle tail, navel eye, beard, changed sex, extra arm) are recorded and displayed but do nothing.

## Prohibited Races

A fourth, non-canonical race table this project deliberately doesn't offer. Abilities that appear only there — **Levent** ("You can skip travel events") and **Aesir** ("immune to weather effects") — are correctly absent from `races.ts` and not wired to anything.

## Invented pricing formulas

No rulebook price data exists for gear, so these are this project's own:

| Thing | Formula | Basis |
| --- | --- | --- |
| Armor | `Math.max(1, piece.maxHp)` | The basis #83 already used when an Ogre sells a piece it can't wear |
| Armor, with Collector | `Math.max(5, base)` | Floors rather than replaces, so no double-count on a Breastplate already worth 10 |
| Weapons | `3 + modifier`, floored at 1 | Derived from the one number the rulebook gives a weapon — its damage formula |

Fortress and Merchant multipliers stack to 4x and share one `sellMultiplier()` so a gear sale and a Pack sale can't drift apart.

## Per-mechanic simplifications

### Combat and monsters

- **Ability-conditioned weapon bonuses** (e.g. "+3 damage against Firebreath creatures") are flavor-only, since `damageBonusVsTag` matches monster *names*, not abilities.
- **Pyramid's Boss row** ("Eternal Queen and her 10 Mummified Soldiers") simplifies to just the Queen — the single-`MonsterTemplate` Boss architecture can't represent two distinct monster types in one Boss fight.
- **The Dracolich's "D8"** is flattened to 4; every `MonsterTemplate` carries a flat `damage`.
- **Snake's "Attack deals Poison"** is read as an ordinary flat hit. Poison's rulebook significance is specifically about bypassing the *player's* armor, which is meaningless when an animal is attacking a monster.
- **The Arena** has no Hireling concept at all, and no armor absorption, spells or equipped-weapon bonus effect — you choose to enter.
- **Loot has two rulebook definitions.** The Events section's footnote says "1d6-1 coins"; the Monster Abilities table's canonical row (rules 239) is the 6/5/else split `rollLoot()` implements. One definition beats two, so the canonical one wins.

### Dungeon rooms

- **Sewers Room Content 2's** "spend 1 torch to leave the room" is flavor — nothing models *leaving* a room as a costed action.
- **Sewers Room Content 5's** 8-crate investigation loop is flavor — no UI drives a per-crate sub-roll.
- **Sewers Room Content 11's** trapdoor to a Laboratory is flavor — the type exists, but nothing models a trapdoor between two runs.
- **Laboratory Room Content 9's** "if you drink, roll on the Potion table" is flavor — an optional action with a sub-roll and no UI to drive it.
- **The Ring of Bad Luck's** "reroll the 6" needs an attack-reroll hook that doesn't exist. (Tetanus Armor's "-2 HP" *is* real as `extraHp: -2` — these are the game's first negative rewards.)
- **The Zombie Potion's** "returns with 1 HP max" is flavor, since the Mutation table's own zombie row is the reachable one and two subtly different revive rules would be worse than one.
- **The Distant Place Potion and Purification Potion** have no reachable hook (the Portal picker and a "cursed" item state, respectively).
- **The Laboratory's Leather Breastplate** "load up to 3 potions" has no per-item potion cap to enforce.
- **Pyramid's own printed Armor table** (which deviates from the shared `ARMOR_TABLE`) is left unimplemented.

### World

- **Roll 14's cloud city** (the Slimemen's) is mechanically the ordinary destination picker with different framing — no cloud-city hex is modeled.
- **Underworld's "spend 1 provision to wait for the fog to dissipate"** is what makes Dense Fog *conditionally* impassable, unlike Rocks.
- **The ancient soul's** "resurrect when he returns to the world of the living" pays out immediately as a full heal + 50 coins — there's no NPC-follower concept to carry.
- **Candy World's Treasure table** prints only rows 2-6, so 7+ grants nothing, matching every other 7+ row rather than inventing five rewards.
- **Horse** is approximated as a flat 1-provision Plains cost, not the rulebook's every-other-hex-free.
- **Building upgrades** cost `max(0, newCost - oldCost)`, with no protection against a 0-cost "downgrade" edge case.
- **King's Vassal range** is filled in by direct analogy to Lord's rulebook-specified case.
- **Per-race starting locations** (Orc/Ogre/Exotic races' rulebook-specified alternate starts) are out of scope. Every race starts at `world.home` except via `findOrRevealCompatibleHome()`, which exists to solve a different problem (a race that can't travel back to its own start).

### Realms

- **Dungeons, Buildings, Politics, Warfare, Ask and Animal training are overworld-only.** Not squeamishness: `dungeonRunId`, `bannedHexes` and `politicalStatus` are keyed by a bare `hexKey`, so two realms' `"0,0"` would collide.
- **Realm cities have no culture**, so hireling rosters and Culture Actions degrade to nothing. `affinity.test.ts` asserts both halves.

## Extensions this project invented

Not in the rulebook at all — flagged so they aren't mistaken for transcription:

- **`placeChild`'s collision-avoiding dungeon layout** — the rulebook has no map-drawing algorithm.
- **Climate transitions** (`climateAt`, `COLD_LATITUDE`, `boundaryWobble`). The rulebook prints Hot and Cold as two alternative continents and never describes a boundary inside one map. See [world.md](world.md) for why it exists.
- **Fleeing a wilderness fight** (`fleeEvent()`). The rulebook says nothing about avoiding a travel encounter; the justification is that the encounter itself is mandatory, and a fight you can neither avoid nor leave isn't a decision.
- **Random character names** (`src/data/names.ts`).
- **The consumable inventory's timing rule** — though the rulebook does supply the backpack cap and "if you drink it" phrasing that made it a UX fix rather than an invented rule.
