# Characters

Races, classes, spells, Advanced Classes, Hirelings, Animals, mutations, and death.

Primary files: `src/data/races.ts`, `classes.ts`, `spells.ts`, `names.ts`, `advancedClasses.ts`, `hirelings.ts`, `animals.ts`, `mutations.ts`; `src/engine/character.ts`, `advancedClasses.ts`, `mutations.ts`, `graveyard.ts`.

## Races

The Core Book's 2d6 `RACE_TABLE`, plus three additional 1d6 tables from the Expanded World (`UNCOMMON_RACE_TABLE`/`EXOTIC_RACE_TABLE`/`MONSTROUS_RACE_TABLE`, #22) picked _instead of_ the base roll — self-contained tables, not modifiers stacked on it.

`CharacterCreationScreen.tsx`'s `raceTable` state picks the active table (switching clears any roll already made). `rollRaceFromTable()` is the single entry point — `"core"` delegates to `rollRace()`, everything else is a flat 1d6 lookup. A handful of rows re-list a race already in `RACE_TABLE` verbatim and reuse that entry directly.

**Prohibited Races** (a fourth, non-canonical table) is deliberately not offered — so abilities that only appear there (Levent's "skip travel events", Aesir's weather immunity) are correctly absent from `races.ts` and not wired.

**Half-Human** resolves entirely at roll time inside `rollRaceFromTable()`: rolling it also rolls Core `rollRace()` and merges that race's `ability`/spell grants onto Half-Human's own name/HP, so downstream code only ever sees one coherent `RaceDef`. The extra roll's dice are appended (`[roll, ...inherited.dice]`) so `DicePool` animates all three (1d6 table row + 2d6 Core race).

### Mechanically hooked race abilities

The rest are flavor-only.

| Race               | Effect                                                                | Where                                                                                                               |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Patovsky, Sharkin  | Water-walking                                                         | `hasWaterWalk()`, `hexTables.ts`                                                                                    |
| Patovsky           | Can skip travel events                                                | `eventSkipReason()`, `events.ts` (**not** `hexTables.ts`) — Sharkin shares the water-walking but has no such clause |
| Pandakhan, Centaur | Travel-cost multiplier (2x / 0.5x, Centaur rounds up via `Math.ceil`) | `travelCostMultiplier()`                                                                                            |
| Ogre               | Unconditional +2 damage                                               | `attackBonus()`, alongside Grave Digger's Undead-only +2                                                            |
| Ogre               | Cannot use potions, scrolls, or wear armor                            | Enforced at every grant site — see "Unusable gear is sellable" below                                                |
| Samambro           | Death-survival roll (3+, survive at 1 HP)                             | `trySamambroSurvival()`, all seven `alive = false` sites                                                            |
| Goblin             | Roll of 1 on the damage die explodes for 5 room-wide                  | `PLAYER_ATTACK`, see [dungeon.md](dungeon.md)                                                                       |
| Halfling           | Move Silently rolls two dice, discards the lowest (except Boss)       | `RESOLVE_ROOM_ENTRY`                                                                                                |
| Dwarf              | Find Secret Passage rolls two dice, keeps the higher                  | `RoomInspector.tsx`                                                                                                 |
| Cat-Person         | Doubles sell value                                                    | `sellItem()`'s `isCatPerson` flag                                                                                   |
| Rinoceroid         | Horn attack (flat 1d6, no modifier, skips weapon effects)             | `PLAYER_ATTACK` with `useHorn`                                                                                      |
| Pumpkinkin         | 3 uses of Vimes                                                       | data, functional since #61                                                                                          |
| Corvino            | 5 random Advanced Spells                                              | data, functional since #61                                                                                          |

Fungoid's provision-heal stays flavor-only (provisions aren't tracked inside a dungeon run).

**Deliberately out of scope**: per-race starting locations (Orc/Ogre/Exotic races' rulebook-specified alternate starts). Every new race starts at `world.home` except via `findOrRevealCompatibleHome()` — see [world.md](world.md). `RACE_AFFINITY`'s old combined `"Orc/Ogre"` row was split into separate exact-name rows.

### Unusable gear is sellable instead of vanishing (#83)

Every Ogre "cannot use" site rolls the item as normal and sells it via `addHeldItem()` instead of discarding:

- `resolveMagicItem()`'s armor branch: worth `Math.max(1, base.maxHp)`.
- `resolveWonder()`: a trinket sells for its own `grantsHp`; a potion/scroll-shaped effect for a flat `OGRE_UNUSABLE_TREASURE_WORTH` (3 coins).
- `applyRoomContentReward()`'s `magicScrolls` bundles the whole roll into one `HeldItem` rather than one per scroll.
- `OPEN_TREASURE`'s `healAll`/`restoreAllSpells`/`randomSpell` cases get hardcoded item names ("Health Potion"/"Mana Potion"/"Magic Scroll").
- `COLLECT_REMAINS` leaves a fallen adventurer's armor behind in the remains rather than force-selling — confirmed as intentional.

Outside a dungeon, `town.ts`'s `canDrinkVerdosaPotion()`/`canBrewHealthPotion()` take an `isOgre` parameter to disable those buttons.

## Random names (#40)

A v1-scoped extra, not a rulebook mechanic. `FIRST_NAME_TABLE`/`LAST_NAME_TABLE` (`src/data/names.ts`) are `Record<RaceName, Record<1-6, string>>` (all 11 Core races authored) plus a shared `"default"` fallback. `rollName()` rolls one die into each; the "Random Name" button fills the field directly (no animation), freely editable after. Every New Race falls back to `"default"`.

## Spells

`DungeonState.spellUses` is a `Record<string, remainingUses>` seeded by `computeSpellUses()`, keyed by `character.ts`'s composite `spellKey(table, roll)` string — **not a bare roll**, because the five spell tables reuse 1-6/2-12 numbers. `parseSpellKey()` is the inverse.

`rollSpellFromTable(table, rng)` is the one roll function for all five tables. `computeSpellRequirements()`'s `randomSlotsByTable: Partial<Record<SpellTableKey, number>>` exists because a race and class can grant random spells from _different_ tables at once.

### New Spells (#24)

Three more 1d6 tables (`NATURE_SPELL_TABLE`, `DEATH_SPELL_TABLE`, `ELEMENTAL_SPELL_TABLE`) plus a 2d6 `ADVANCED_SPELL_TABLE` — never a free player choice, always _granted_ by a race/class/item. Every spell-identity site widened to the composite key; `SpellDef`/`FixedSpellGrant` carry `table: SpellTableKey`.

**Why `CAST_SPELL` dispatches by spell name, not `(table, roll)`**: several New Spells rows are the identical Core spell re-listed under a different table (Elemental's Cold Ray/Lightning/Fireball == Basic's). `combat.ts`'s `KNOWN_CASTABLE_SPELL_NAMES`/`TARGETED_SPELL_NAMES`/`COMBAT_ONLY_SPELL_NAMES`/`OUT_OF_COMBAT_SPELL_NAMES` match against `SpellDef.name` so both copies share one `CAST_SPELL` case. **A spell not in `KNOWN_CASTABLE_SPELL_NAMES` simply gets no "Cast" button anywhere.**

### Casting

All six Basic Spells go through `CAST_SPELL`, which also carries `table: SpellTableKey`. Heal/Light are usable anytime (`OUT_OF_COMBAT_SPELL_NAMES`, matched by name); `town.ts`'s `canCastSpell()`/`castSpell()` mirror the math for Town/World, which have no reducer to dispatch against. Cold Ray/Lightning/Fireball require an active fight, rendered as extra `CombatPanel` buttons.

The "Cast" button always renders for an eligible spell, `disabled` (not omitted) at 0 uses. Spell damage runs through `resolveSpellDamage()` (shares Stoneskin/Intangible filtering with `resolvePlayerAttack()` but never triggers roll-of-1/6 abilities, since it's a fixed value). Casting mid-fight consumes the round like `PLAYER_ATTACK`, except Cold Ray flags `skipNextAttack` and Teleport ends combat immediately. Uses, once spent, stay spent within a run — recovering requires Town's Rest.

### What's mechanically real

Heal, Light, Teleport, Cold Ray, Lightning, Fireball, plus (#61) Natural Cure, Insect Rain, Magic Blast, Banish the Dead, Vimes, Paralyze, Ethereal Body, Magic Shield, Absorb Soul, Fire of the Dead, and Fly. Camouflage is real since #91 but is offered on `EventPanel` itself, not via the shared `CAST_SPELL` pipeline.

**Tier 1** (#61): Natural Cure (Nature 1, 12 HP, mirrors Heal, also out of combat), Insect Rain (Nature 6/Advanced 2, 7 room-wide, mirrors Fireball), Magic Blast (Advanced 10, 12 single-target, no freeze, mirrors Lightning). **Banish the Dead** (Death 3) is genuinely new: destroys every Undead outright via `handleMonsterDefeat()`'s `bypassRevival` param.

**Tier 2** (#61): six spells needing new `CombatState`/`CombatMonsterState` fields, all resolved instantly on cast (round still ends normally).

- **Vimes** (Nature 2, targeted, 1d6 turns) / **Paralyze** (Advanced 5, room-wide, fixed 2 turns) both set `CombatMonsterState.silencedTurns`, decremented once per round in `applyMonsterTurn()`.
- **Ethereal Body** (Death 1/Advanced 12) sets `CombatState.damageReduction` (-1 per hit _including_ poison, applied before the poison/absorbable split — deliberately reduces poison too, reading "all damage" literally).
- **Magic Shield** (Advanced 8, stackable) pushes onto `CombatState.shields: number[]`, drained oldest-first against `absorbableDamage` before the armor-or-HP choice; poison bypasses it like armor.
- **Absorb Soul** (Death 2, 5 HP/kill) / **Fire of the Dead** (Death 4, 2 torches/kill) set boolean flags paid out by `finishIfVictorious()` off `combat.engulfableBodies` (Slimemen's existing kill counter, reused rather than tracked twice).

**Fly** (Advanced 6) is deliberately **not** routed through the shared `CAST_SPELL` pipeline, since that pipeline's "Cast" button also renders inside a dungeon, where Fly's effect (Provisions, a World-map-only resource) means nothing. Instead `town.ts`'s bespoke `canCastFly()`/`castFly()` arms `AdventurerResources.flyActive` and spends the use immediately. `WorldScreen.tsx`'s `handleTravel()` checks it **first**, before any other travel-cost machinery — a true unconditional free move, not just the cheapest of several competing overrides — then clears the flag. Fly's "…and activate Event" half is read as the `without` distributing across both clauses, so a Fly move skips the Event roll entirely.

### Deferred spells

Create Food, Summon Wolf/Skeleton, Awakening, Summon Elemental, Stone Armor, Collapse, Open Portal, Reload Mana are rolled, tracked and displayed but have no "Cast" button — each blocked on a system this codebase doesn't have (ally-in-combat, temporary armor, a spell-picker UI).

### Spell uses granted after Character Creation (#75)

`CharacterSheet`, `rest()`, and Mana Potion used to compute max uses via `computeSpellUses(character.spells, character.fixedGrants)` — fixed at creation, so any spell granted _later_ (Advanced Classes, Hirelings, Gnome's culture action, Magic Scrolls) never appeared, and worse, `rest()`'s `{...maxSpellUses}` full-replace silently wiped later grants back down every Rest (also silently undoing Anti-Paladin's Heal-zeroing).

Fixed with a genuinely persisted `maxSpellUses: Record<string, number>` on both `AdventurerResources`/`DungeonState`, bumped by the same amount at every grant site alongside `spellUses`. `rest()`/`canRest()` read `resources.maxSpellUses` directly. `loadSession()` back-fills an old save by taking the **higher** of the creation-time computation or whatever `spellUses` already holds.

Related bug fixed in the same pass: `CharacterSheet` always displayed `character.totalHp` (also creation-time) as the max-HP denominator — fixed via a `maxHp` prop falling back to `character.totalHp`.

## Advanced Classes (#23)

45 purchasable classes, each with coin cost / requirement / HP bonus / ability, authored in `ADVANCED_CLASS_TABLE` (keyed by name — bought, not rolled).

`src/engine/advancedClasses.ts`'s `REQUIREMENT_CHECKS` covers classes answerable from state the game already tracks (kill counters, spells, Graveyard, another owned class, armor) plus one-time milestone flags. `AdventurerResources.advancedClasses: string[]` (mirrored on `DungeonState`) is the acquired list; `canAcquireAdvancedClass()`/`acquireAdvancedClass()` gate on not-owned + affordable + requirement, spend coins, bump `hp`/`maxHp` by a flat `hpBonus`, and apply the ability via a per-class switch.

**All 45 are trackable** (#62 closed) — `isAdvancedClassTrackable()` returning false is currently unreachable, kept for the same reason its matching `reason` branch is.

### Ordering (#132)

`AdvancedClasses.tsx` groups by a 4-tier rank (buyable → blocked-but-reachable → owned → untrackable) and sorts by cost _within_ each — the same "group first, keep the secondary order" shape as `sortDungeonsForDisplay()`. Cost-ascending alone scattered the few actionable rows through 45 spanning 10-6000 coins.

**The rank is computed once per class in a `map` before the `.sort()`** — deliberately not inside the comparator, which runs O(n log n) times and would re-walk `REQUIREMENT_CHECKS` (some of which sum kill tallies or scan the Graveyard). A heading renders at each group boundary, since ordering alone leaves the boundary invisible across 45 rows.

### Milestones (#70)

`AdventurerResources.milestones`/`DungeonState.milestones: AdvancedClassMilestones` bundles `hasCastSpell`/`hasCastColdRay`/`hasSoldItem`/`hasHadArmorDestroyed`/`hasFoughtInArena`/`locksOpened`/`vassalCount`/`talkedToKing`/`clearedASewer` — threaded permanently like `advancedClasses`.

- `hasCastSpell` — set by both `CAST_SPELL` success and Magic Scroll redemption (Scholar's "spell or scroll").
- `hasCastColdRay` — only in the `"Cold Ray"` case (Necromancer's exact requirement).
- `hasHadArmorDestroyed` — `RESOLVE_DAMAGE` when a piece hits 0.
- `locksOpened` — `RESOLVE_DOOR_LOCK`'s pick-lock branch (not break-door).
- `hasSoldItem`/`hasFoughtInArena` — set directly by `sellItem()` / `TownScreen.tsx`'s `handleStartArena()`.
- Collector needs no new state (checks `resources.armor` has all 5 real slots).

### Notable requirement implementations

- **Chained requirements**: Paladin ("Knight or Cleric"), Anti-Paladin ("Paladin"), Necromaster (Necromancer + Lich-substring kill), Assassin (Thief + `bossKills >= 1`), Knight (Noble).
- **Avenger and Lich** (#73), confirmed with the user as product-design calls: Avenger = "a previous character exists in the Graveyard" (the same signal as Gravedigger's check). Lich's literal text is a paradox (the buyer is alive) — read as "did _any_ past character die while holding Necromancer," needing `GraveyardEntry.advancedClasses?: string[]` recorded at both death sites.
- **Helsing and Bugcatcher** (#71): aggregate kill counts with no single exact name/tag — `sumKillsByName()` sums a curated list (`VAMPIRE_MONSTER_NAMES`, `BUG_MONSTER_NAMES`, the latter deliberately excluding Giant Leech as a worm not a bug, confirmed with the user). Both also gained a real `attackBonus()` condition (+1 vs their target tags) the #70/#72 audit found missing.
- **Hotep** ("killed 3 mummies") uses `sumKillsByName()` over Pyramid's three mummy names, including the Mummified Priestess on a _name_ reading rather than a tag one — she is a mummy the table calls a mummy, even though she carries Sorcery rather than Undead.
- **Janitor** ("killed all creatures from a Sewer") reads as `milestones.clearedASewer`, set by climbing out — rooms are generated lazily as doors open, so there is no fixed population "all creatures" could mean, and getting out is the rulebook's own definition of having done the place.
- **Miner** (#62) — "survived two dungeons" — `AdventurerResources.survivedRunIds: string[]` (World/Town-only, not mirrored on `DungeonState`) collects distinct runIds from `handleReturnToTown`, deduplicated so repeatedly retreating from the same run can't inflate it, and gated on `dungeon.levels.length > 0`. The Advanced Class shares base-Class Miner's identical ability via a widened OR.
- **Travel counters** (#72) for Lumberjack/Druid/Survivor/Pirate/Bard/Cook: `AdventurerResources.travelStats: TravelStats` (`forestsCrossed`/`desertsCrossed`/`territoriesSailed`/`citiesVisited`/`provisionsSpentTotal`) — World/Town-only. `citiesVisited` de-duplicates hex keys (distinct cities, not arrivals). `provisionsSpentTotal` tallies inside `payTravelCost()` off the shortfall-aware spend value. `territoriesSailed` only counts a water hex crossed while `hasBoat` was true _before_ the move (water-walking doesn't count).
- **Noble/Lord/King/Emperor/Knight** were unblocked by #27 — see [town-and-economy.md](town-and-economy.md). Noble reads `talkedToKing` (set on any Political Affinity attempt at a Fortress, success or fail — "talking" is the act, not a required success); Lord and King read an owned Castle / City; Emperor reads an owned Fortress plus `vassalCount >= 3`; Knight chains on Noble (which meant widening Paladin's own OR to actually check both branches once Knight became real).

### Real abilities

Spell-grant abilities (Mage/Cleric/Paladin/Anti-Paladin/Elementalist/Arcane/Scholar/Necromancer/Necromaster/Druid/Bard) call `rollSpellFromTable()`/`spellKey()` exactly like `town.ts`'s Gnome `learnRandomSpell()`. Anti-Paladin's "loses all Healing spells" zeroes just Heal (`basic:1`), the only spell in this codebase that currently heals.

Others: Champion's "no coin cost to recover" (`isChampion` in `canRest()`/`rest()`); Alchemist's "50 coins → 1 Health Potion" (`canBrewHealthPotion()`/`brewHealthPotion()`, healing to full immediately); Pirate's "ignores Poison" (`applyMonsterTurn()`'s poison tally short-circuits into the normal absorbable pool); Knight's "Gain a Horse" (pushes `"Horse"` onto `resources.animals` if there's a free slot and no Mount already owned); Merchant/Blacksmith/Thief reuse existing Cat-Person/Blacksmith/Locksmith ORs.

**Assassin's opening strike** (#103): `CombatState.playerHasAttacked` (optional, so a fight persisted mid-combat before this reads as false) gates a 3x multiplier inside `attackMultiplier()` — placed **before** its `isHorn` early return, since this is a class ability rather than an equipped weapon's effect, so a Rinoceroid's horn gets it too. `PLAYER_ATTACK` captures `isFirstAttack` and sets the flag in one place near the top rather than at each of the handler's several exits, so no branch can forget to spend it; a paralyzed turn returns above that point, which is correct — being unable to act isn't attacking. Read as the first hit **of the fight**, not against each monster (confirmed with the user: the plainer reading, the cheaper flag, and a per-monster version would take 3x on every Horde spawn). Logged explicitly, since a tripled hit otherwise looks like a lucky roll and the class costs 200 coins plus a Boss kill.

**Collector** (#103) floors armor sale value at 5 (`Math.max(5, base)`) rather than replacing it: a real upgrade on a Ring or Boots, no double-count on a Breastplate already worth 10.

### Flavor-only abilities look real (#111)

Ambidextrous/Multidextrous/Collector/Assassin/Ghostbuster/Cook/Emperor pass their requirement checks, charge coins, grant their HP bonus — and (originally) did nothing. `hasImplementedAbility()`, backed by `FLAVOR_ONLY_ABILITIES`, drives a "flavor only" chip in the purchase list.

**Kept in the engine, not on `ADVANCED_CLASS_TABLE`**: it's a fact about this app rather than the rulebook, and it has to stay in step with `applyAdvancedClassAbility()`'s own `switch`, which sits right above it. Classes whose text is literally "None." are deliberately excluded — they already say they do nothing. This is the buyable-but-inert counterpart to `isAdvancedClassTrackable()`'s unbuyable-but-visible.

## Hirelings (#25)

16 paid companions, one roster per culture, hired "to face just one dungeon" — `HIRELING_ROSTERS`/`HUMAN_FORTRESS_HIRELINGS`, looked up via `hirelingsFor(culture, isFortress)`.

**Expires per trip**, unlike Advanced Classes: `AdventurerResources.hireling`/`DungeonState.hireling: string | null`. `RESUME_DUNGEON` never carries it; `RETURN_TO_DUNGEON` carries it exactly; a genuinely fresh entry consumes `resources.hireling` into the new run, then a mount-only effect clears it. `handleReturnToTown` sets `hireling: isDungeonBeaten(dungeon) ? null : dungeon.hireling`.

`payTravelCost()` takes a `hasHireling` flag adding a flat +1 provision per move while employed.

### Real abilities

Burglar (ORs into Locksmith's free-pick check), Minstrel (+2 damage via `attackBonus()`), Dwarf Soldier (+1 vs Orcs/Goblins via `matchesTags()`), Dwarf Miner (two dice for Secret Passages, widening the Dwarf-race check), Rent Wizard/Elf Soldier/Gnome Helper (random Basic Spell uses via `grantSpellUses()`, applied once at hire time, no revoke-on-expiry), Elf Ranger (ignores Travel Events, real since #91).

**Cargo Ogre** ("carry 40 items") — `town.ts`'s `maxHeldItemsFor(hireling, animals)` returns 40 while employed, the single chokepoint every cap check goes through. No special "return at the end" handling needed — the cap just reverts when the hire expires.

**Goblin Helper** ("explode, dealing 5 damage") — confirmed with the user as a genuine one-time detonation (5 damage to every monster, the Hireling destroyed). `HIRELING_EXPLODE` reuses the room-wide damage loop, gated to `combat.hireling?.name === "Goblin Helper"`, free and doesn't end the round, fires only once (self-clears `hireling`).

### Hirelings actually fight (#84)

The first ally-in-combat concept in this codebase, scoped narrowly (both forks confirmed with the user).

`HirelingDef.weaponFormula?: string` is the roll-able version of `equipmentText`, omitted for Hirelings whose text says they can't fight or whose contribution is already a passive player-attack bonus (Minstrel). `CombatState` gains `hireling: {name; hp; maxHp} | null` (a copy, seeded in `startCombat()`) and `hirelingAttackedThisRound`.

- **A free action that doesn't end the round** — not bundled into `PLAYER_ATTACK`, not a round-consuming alternative. `HIRELING_ATTACK {targetId, roll}` capped once/round, reset at the top of `applyMonsterTurn()`. Deliberately **not** gated on the player's own paralysis. Resolution reuses `resolveSpellDamage()`.
- **A third `RESOLVE_DAMAGE` option**: `hasUsableArmor(draft) || (combat.hireling && combat.hireling.hp > 0)` widens the defer-to-`pendingDamage` check; `absorbWith` widens to `"hireling"`. A Hireling at 0 HP is gone for good — clears the top-level `hireling` too.
- The Arena has no Hireling concept at all.

### A Hireling is not a free meat shield (#114)

`DungeonState.hireling` was a bare name, so `startCombat()` reseeded the fighting copy's HP from `HIRELING_BY_NAME`'s static value on _every_ encounter — one 10-coin Torchbearer bought unlimited absorption for a whole trip, since the player chooses per hit what absorbs and could simply take the last one themselves.

`DungeonState.hirelingHp`/`AdventurerResources.hirelingHp` now persist it: set at hire time, seeded (and clamped to the roster's own HP) in `startCombat()`, written back at `RESOLVE_DAMAGE` — the single place a Hireling's HP ever drops — and cleared alongside `hireling` when it falls or the trip is beaten. Optional on `DungeonState` with a `?? def.hp` read, so a pre-#114 save starts at full exactly once.

**Rest deliberately doesn't heal it**: the rulebook's Rest is about the character, and a free heal for the hired help is the whole bug.

### Deferred (#63)

Torchbearer/Mercenary/Bodyguard/War Veteran/Orc Soldier are "None."; Jester's "can clown" has no clear rule.

## Animals (#26)

19 companions across Domesticated/Mounts tables (`ANIMAL_BY_NAME`) — trained in the wild, or (Mounts only) bought in a qualifying city. Unlike Hirelings, persists **permanently** once acquired (`AdventurerResources.animals`/`DungeonState.animals: string[]`, `MAX_ANIMALS = 3`).

`hp`/`damage` are recorded but mostly unused — every real ability is a travel-cost hook or one dungeon rule.

**One shared qualification check**: "empty hex, ≥2 same-terrain neighbors" (training) vs. "a city on the right terrain, also with ≥2 same-terrain neighbors" (buying a Mount) — `countMatchingNeighbors()`/`qualifiesForTraining()`/`qualifiesForBuyingMount()` in `hexState.ts`. Buying a Mount is **culture-agnostic** (only terrain matters).

**Training spends provisions regardless of outcome**: `trainAnimal()` — pay 4 (8 for a Mount), roll ≥ the animal's Dif to succeed, mirroring Gamble/Thug Life's "pay then roll" shape. Buying a Mount has no roll.

### Real abilities (13 of 19)

- **Travel cost**: Owl/Giant Wolf/Camel/Raptor/Goat/Llama cap specific terrain cost (`animalTravelCostOverride()`, cheapest applicable wins); Griffin's "1 provision anywhere" short-circuits everything else including Elven Boots; Mammoth adds a penalty on top (`animalTravelCostPenalty()`); Horse is approximated as a flat 1-provision Plains cost (not the rulebook's every-other-hex-free).
- **Dog** blocks Move Silently entirely (`RESOLVE_ROOM_ENTRY`'s `"moveSilently"` no-ops, mirrored by `RoomEntryPrompt.tsx`).
- **Raven** (#67) — "If you die, roll a die. If it's 4 or more, you come back" — reuses Samambro's exact death-survival shape (`tryRavenSurvival()`), checked immediately after it at the same 7 sites, so a character with both gets two independent rolls.
- **Monkey** (#67) — "carry an extra item" — `maxHeldItemsFor()` adds a flat +1 on top of whichever base cap applies (stacks with Cargo Ogre's 40, giving 41) rather than replacing it.
- **Snake actually fights** — "Attack deals Poison" reuses `HIRELING_ATTACK`'s exact free-action shape via `ANIMAL_ATTACK {targetId}` and `CombatState.animalAttackedThisRound`, gated on `draft.animals.includes("Snake")`. Deliberately **no** HP/absorption slot for the Snake itself: the rulebook never describes an Animal being harmed or dying in combat, so this is purely a bonus attack, not a second combatant that can be lost. "Deals Poison" is read as an ordinary flat hit (poison's rulebook significance is specifically about bypassing the _player's_ armor, meaningless when an animal attacks a monster). Also no `roll` field, unlike `HIRELING_ATTACK` — `AnimalDef.damage` is a flat number, so there's no die to animate.

### Deferred (#67)

Cat/Wolf/Polar Bear ("None."), Tiger (moot, nothing models dungeon-presence to restrict), Eagle (no reveal-more-than-one-ring mechanism), Dolphin (near-moot — no `LocationKind` ever generates on Water).

## Mutations

The Laboratory's Special Rule fires on **leaving** — "any hero or creature that leaves this dungeon will mutate."

**The Mutation table lives outside every existing owner.** `src/data/mutations.ts` + `src/engine/mutations.ts` are their own modules because the roll happens in `App.tsx`'s `handleReturnToTown` — after `DungeonScreen` has unmounted, before Town does anything — and because a fatal row can kill the character, which only `App` can act on.

Three columns where the Common one is mostly a gateway: a 1 sends you to Fatal, a 6 to Rare, so four of six Common rows are harmless and the dangerous ones are only reached indirectly. `rollMutationEntry()` walks the table (bounded at 2 steps by its own shape — neither Rare nor Fatal redirects further) and `rollMutation()` applies the terminal entry to an `AdventurerResources`. The walk is split out because the Mutation Potion rolls the same table from inside `dungeonReducer.ts`, which has a `DungeonState` draft and no `AdventurerResources` at all.

**Every mechanically-expressible row is real, OR'd into the mechanism that already does that thing** (confirmed with the user):

| Row                  | Reuses                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Rare 3 / Fatal 4     | `maxHp` ±, floored at 1 like Hard Work's own cost                                                             |
| Rare 4 (horns)       | Rinoceroid's `useHorn` attack                                                                                 |
| Rare 5 (green blood) | Pirate's poison bypass                                                                                        |
| Fatal 5 (bubbles)    | Ogre's "cannot wear armor", via a `cannotWearArmor()` OR in the reducer and `town.ts`'s `canWearArmorPiece()` |
| Fatal 6 (extra toe)  | the same idea narrowed to one slot                                                                            |

Armor **already worn** is kept rather than stripped when bubbles land — the rule says you cannot wear armor, and confiscating what's equipped is a harsher reading than the text supports (the same call `COLLECT_REMAINS` makes). The five purely cosmetic rows (poodle tail, navel eye, beard, changed sex, extra arm) are recorded and displayed but flavor-only, each documented at its row.

**The zombie row is the third member of the Samambro/Raven survival family** — see [dungeon.md](dungeon.md) for the full ordering.

**Mutations are permanent per character**, like `advancedClasses`: `AdventurerResources.mutations: string[]` (mirrored on `DungeonState`, threaded through both resume paths — a `RESUME_DUNGEON` character brings _their own_, never the dead one's), stored as stable ids and described back through `MUTATION_BY_ID`. Surfaced as a `CharacterSheet` status row and, once, as `App.tsx`'s `arrivalNote`.

## Death and the Graveyard

`src/engine/graveyard.ts` was the first piece of state to survive a reload; `session.ts` later generalized the pattern. `loadGraveyard()`/`addGraveyardEntry()` read/write a JSON array under `notequest:graveyard`, both taking an injectable `storage: Storage` (the same injection pattern as the RNG) so tests run in Vitest's Node environment.

`DungeonScreen` records an entry in a `useEffect` keyed on `state.alive` flipping false; `CharacterCreationScreen`/`TownScreen` load it once on mount.

**Death outside a dungeon**: Gamble's life-bet, Thug Life, and Arena were the first. `GraveyardEntry.causeOfDeath` covers `"combat"|"darkness"|"gamble"|"thug-life"|"arena"|"warfare"|"event"|"portal"|"thin-ice"|"mutation"`; `graveyard.ts` exports the non-dungeon subset as `TownDeathCause`. The `dungeon` field doubles as "place" for these. `App.tsx`'s `handleTownDeath(cause, place)` writes the entry then reuses `handleNewAdventurer()`. `place` comes from `WorldScreen` (already computing a location label); `TownScreen` only calls a pre-bound `onCharacterDied(cause)`.

`GraveyardEntry` also carries `advancedClasses?: string[]` (for Lich's requirement) and `curiosities` (as an epitaph), both optional for back-compat.

## Curiosities (#109/#115)

`resolveWonder()`'s else-if chain had no arm for a pure-flavor Wonder with no `grantsHp`, so Goblin Whistles, Lamps, Salamander Potions and Potions of the Helping Hand were announced in the log and then dropped entirely — "vanish into the void," in the report's words.

They now land in `DungeonState.curiosities`/`AdventurerResources.curiosities`, a `Record<name, count>` tally with `killsByName`'s exact shape and lifecycle (permanent per character; `RESUME_DUNGEON` gives the arriving character their own). **A tally rather than a list of trinkets because the repeats are the point**: a player asked to see "4 arms and 3 tails," which a flat list of four identical rows wouldn't convey.

Surfaced as a `CharacterSheet` stat button (hidden at 0 — most characters never find one) opening `TallyModal`, and copied into `GraveyardEntry.curiosities`. The Laboratory's flavor potions feed the same tally.
