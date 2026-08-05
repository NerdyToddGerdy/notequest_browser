# Town and economy

City actions, resources, money, selling, Buildings, Politics and Warfare.

Primary files: `src/engine/town.ts`, `arena.ts`, `buildings.ts`, `politics.ts`, `warfare.ts`; `src/data/buildings.ts`, `affinity.ts`, `hirelings.ts`; `src/ui/screens/TownScreen/`.

## Where Town lives

`TownScreen` is **not** a distinct `App.tsx` screen — it's a hex-generic component `WorldScreen` renders in full (map hidden) whenever the player is standing on any City/Fortress hex and has deliberately entered. See [world.md](world.md) for the `showTown` / `enteredFromTown` entry-and-exit rules.

`TownScreen` stays hex-agnostic, with one exception: `cityName`. It takes `hasDungeon` (true for City/Fortress/Ruins regardless of found-yet, false once beaten), `dungeonGateCopy`, `onEnterDungeon`, `onExploreWorld`, and `arrivalNote`.

## Resources

`App.tsx` lifts an `AdventurerResources` object (`src/engine/town.ts`) alongside `character` — `torches`/`hp`/`maxHp`/`coins`/`treasures`/`keys`/`heldItems`/`consumables`/`curiosities`/`armor`/`spareArmor`/`weapon`/`spareWeapons`/`spellUses`/`maxSpellUses`/`provisions`/`advancedClasses`/`animals`/`hireling`/`hirelingHp`/`buildings`/`mutations`/`milestones`/`travelStats`/`survivedRunIds`/`troops`/`flyActive`, everything a living character carries between dungeon and town.

Seeded on `onCharacterCreated` (which also resets `world.player` to `world.home` and always lands on `screen: "world"`), overwritten wholesale from the dungeon's own fields on `onReturnToTown(runId, dungeon)`.

**World/Town-only fields** — deliberately _not_ mirrored on `DungeonState`, because nothing inside a dungeon run changes them, and `handleReturnToTown` carries them from `prev`: `travelStats`, `survivedRunIds`, `troops`/`troopSources`, `flyActive`, `nextDungeonDamageBonus`.

**Fields carried from `dungeon` rather than `prev`** because they can change mid-run: `armLost`, `zombieRevivals`, `mutations`, `curiosities`, `milestones`.

## Core actions

`town.ts`'s `rest()`/`buyTorch()`/`buyProvision()`/`sellItem()`/`fixArmor()` are pure functions `TownScreen` calls, handing the result to `onUpdateResources`; `canRest()`/`canBuyTorch()`/`canBuyProvision()`/`canFixArmor()` gate the buttons (1 coin; torches capped at 10, provisions at 20).

`rest()` heals to `resources.maxHp` specifically — this only works because `maxHp` is threaded as its own field everywhere a dungeon is (re)constructed. It also restores spell uses to `resources.maxSpellUses` (see [character.md](character.md) for why that had to become genuinely persisted state).

Champion pays no coin cost to rest (`isChampion`). Blacksmith's `fixArmor()` takes 1 torch instead of 1 coin (`isBlacksmith`).

## Selling

### Pack items

`sellItem()` credits a `HeldItem`'s `worth`, **doubled in a Fortress** (#94, "If it is a Fortress, double this value") and doubled again for a Cat-Person/Merchant, **stacking to 4x**.

This is deliberately _not_ the "two entries, one bonus" case — one multiplier is a property of the place and the other of the seller. `TownScreen`'s sell note names whichever multipliers are actually in play.

### Selling gear (#117/#103)

`Equipment` had no sell action at all — `sellItem()` only ever touched `heldItems`, because `HeldItem` carries a `worth` and `ArmorPiece`/`EquippedWeapon` don't. **Two pricing formulas, both this project's own:**

- **Armor** — `Math.max(1, piece.maxHp)`. Not invented; it's the same basis #83 already uses when an Ogre sells a piece it can't wear. **Collector** floors it at 5 (`Math.max(5, base)`) rather than replacing it: a real upgrade on a Ring or Boots, no double-count on a Breastplate already worth 10. Confirmed with the user as the reading that satisfies both the class's flat "5 coins" and #117's "anyone should be able to unload a benched Breastplate."
- **Weapons** — `3 + modifier`, floored at 1, derived from the one number the rulebook gives them (the damage formula). #48 scoped weapon selling out precisely because no price data exists; this is the simplification that unblocks it.

`equipmentSaleWorth()`/`sellEquipment()` take one `EquipmentSaleTarget {list, index}` covering all four lists (`armor`/`spareArmor`/`weapon`/`spareWeapons`), so `Equipment` needs one `onSell` callback and one `saleWorth` labeller rather than four pairs. The Fortress/Merchant multipliers come from a shared `sellMultiplier()` **so a gear sale and a Pack sale can't drift apart**, and every path sets `hasSoldItem` (Merchant's own requirement).

Selling the _equipped_ weapon is allowed and safe — `weapon` is an override, so the character falls back to their class `weaponFormula`.

## Culture Actions (#20 Stage 1)

Six `town.ts` functions implement one bonus City Action per culture (Human/Dwarf/Elf/Gnome/Goblin/Orc) — mostly flavor-only coin sinks. `TownScreen.tsx` renders whichever matches the hex's culture (`cultureActionFor()`).

- **Elf's Elven Boots** is the one real mechanical effect (`hasElvenBoots()`, forest travel drops to 1 provision).
- **Dwarf's Lamp** is gated on `ownsLamp()` (#109) — a permanent unique item, so a second one is meaningless by definition; without the check a Dwarf with coins could buy an unbounded pile of them, each eating a Pack slot. The Lamp's real effect lives in [dungeon.md](dungeon.md)'s hand economy.
- **Gnome's `learnRandomSpell()`** is the shape every later spell-grant ability copied.

Realm cities deliberately have no culture, so `cultureActionFor(undefined)` degrades to nothing.

## City Square tabs (#76/#88)

`.actionGrid` had grown to ~14 flat buttons, so `TownScreen.tsx`'s `activeActionTab` groups them:

| Tab         | Actions                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| Tavern      | Rest, Brew                                                                |
| Shop        | Buy Torches, Buy Provisions                                               |
| Job Board   | Ask, Political Affinity, Recruit Troop, Attack, Culture Action, Hire Boat |
| Underground | Hard Work, Gamble, Thug Life, Arena                                       |

Always shown (confirmed with the user over a threshold fallback) — every tab is guaranteed at least one unconditional action.

**#88 extended this to Advanced Classes/Hireling/Animals/Buildings**, which used to be always-rendered stacked sections below Adventure, reintroducing the scroll problem one level down. `"advancedClasses"` is unconditionally appended; `"hireling"`/`"animals"`/`"buildings"` only when their roster/list is non-empty. `.actionGrid` is wrapped in `isOriginalActionTab`; the other four render as plain siblings when active. If the active tab disappears (e.g. travel to a hex with no roster), it resets to `"tavern"` during render. Heading renamed "City Actions" → "City Square."

**Removed the redundant "My Animals" list** (#85): `Animals.tsx` used to render its own ownership list _and_ "Buy a Mount," duplicating `CharacterSheet`'s Animals status line. It now renders only "Buy a Mount," returning `null` once `buyableMounts.length === 0` — hence its tab needing conditional inclusion. The same audit found `Hireling.tsx`'s old `if (!roster)` read-only branch was genuinely unreachable dead code and removed it; `roster`/`canHire`/`onHire` are now required props.

## Getting Money (#58)

Hard Work / Gamble / Thug Life live in `town.ts`; Arena gets its own `arena.ts`.

- **Hard Work** is City-only (`isFortressLocation()` gates it out, and gates in "Fight in the Arena" instead) — permanently takes 1 HP out of `maxHp`, which can never reach 0.
- **Gamble** is two sub-games selected by `resources.coins` itself (never a separate action) — `gamble()` returns a `GambleResult` with `outcome: "won"|"lost"|"survivedLifeBet"|"diedLifeBet"`, leaving `resources` untouched on death (`App.tsx` alone holds the authority to clear the session).
- **Thug Life** — `resolveThugLife()` returns a `ThugLifeResult` with `died`/`banned` flags, mirroring Gamble's death-signaling split. 2d6 in a City, 3d6 in a Fortress. The 5-7 "jail" row can go either way from one follow-up roll (`died: true` if the HP loss would hit 0, else `banned: true`). **The ban is world-scoped**: `WorldState.bannedHexes` (optional, `isBannedHex()`), checked by `MOVE` and `canTravelTo()` at the same tier as `isImpassable()`. Resolved in `WorldScreen.tsx`'s `handleThugLife()` (it touches both `resources` and `WorldState`) since `TownScreen` only sees `resources`. The player isn't forcibly evicted on a ban, only blocked from future entry.

### Fighting in the Arena (Fortress-only)

`src/engine/arena.ts` reuses `combat.ts`'s pure `resolvePlayerAttack()`/`resolveMonsterTurn()` directly rather than `dungeonReducer.ts`'s `CombatState` (which is shaped around segments/loot/armor-choice, none of which Arena has).

`ArenaState = { champion; outcome }` — no armor absorption, no spells, no equipped-weapon bonus effect, just the base formula. Since #120 it runs on `fight.ts`'s `fightRound()`.

**`resolveArenaRound()`'s one real bugfix**: Explosive can defeat the champion _and_ kill the player in the same blast — the death check must run **before** the victory check even though `atk.monsterDefeated` is already known.

`TownScreen.tsx` owns the fight's UI as local state, un-animated, swapping in for City Actions. Victory credits 20 coins; defeat calls `onCharacterDied("arena", place)`.

## Buildings and Politics (#27, rules 1668-1721)

Spending coins to build House/Tower/Palace/Castle/City/Fortress on an empty hex (`BUILDING_TABLE`), and a Political Affinity roll at any City/Fortress making it an ally, Vassal, or permanent enemy (`src/engine/politics.ts`). Unlocked Noble/Knight/Lord/King/Emperor, previously permanently unbuildable.

### Buildings

`buildingCost(kind, terrain, raceName)` doubles off-Plains, exempting Dwarf/Mountain and Elf/Forest. `buildingRequirementMet()` gates Palace/Castle on Noble, City on Lord, Fortress on King. Only on an empty hex (`tile.location === null`; a built-on hex still reads "empty" for re-upgrading). Upgrading costs only the difference (`max(0, newCost - oldCost)`, with no protection against a 0-cost "downgrade" edge case — a documented simplification).

`canBuildBuilding()`/`buildBuilding()` (`src/engine/buildings.ts`) spend the cost, update `resources.buildings`, and stamp `world.tiles[hexKey].building` via `withBuilding()`. Surfaced as a "Build a Building" list in `HexInspector` (gated `isCurrentTile && tile.location === null`), a read-only "My Buildings" card in `TownScreen`, and a 🏛 map badge.

**Boss-kill tax**: owning Palace/Castle/City/Fortress credits `buildingTaxTotal(kinds)`'s sum the instant a Boss falls, inside `finishIfVictorious()`'s existing `isBoss` branch. This is why `buildings` is mirrored on `DungeonState` (unlike `travelStats`).

### Buildings outlive their builder (#121)

`tile.building` was always world-scoped while `AdventurerResources.buildings` was a per-character copy that died with its owner — an odd split, and the reason two characters in a row saved for the late game and never reached it.

`hexState.ts`'s `ownedBuildings(world)` derives the list from the map, and `handleCharacterCreated` seeds a new character from it, making `resources.buildings` a **view** rather than a second source of truth.

Confirmed with the user: **buildings persist, coins and troops don't** — a successor inherits the estate and its Boss-kill tax, but no army and no money, so permadeath still costs everything you were carrying.

### Buildings' storage (#102, rules 1687-1689)

"In a building you can store any number of items found in dungeons. However, whenever you leave a dungeon roll a die. If it drops a number greater than the building's Defense value, a random item has been stolen."

**Two things the rulebook settles that the issue had assumed otherwise**, both worth knowing:

1. **Capacity is unlimited** — `defense` is the only stat that scales across the table, so a House holds exactly as much as a Fortress and simply loses things far more often. There is no per-kind capacity.
2. **The theft roll is a plain 1d6 against Defense**, which means **a City (6) and a Fortress (12) can never be robbed at all** — the top of the table buys certainty rather than volume. `theftRiskCopy()` (`HexInspector`) states the odds plainly for exactly that reason.

**Storage lives on `HexTile.storedItems`/`storedConsumables`, not on `OwnedBuilding`** — since #121 `resources.buildings` is a derived view, so storing there would be storing in a projection. Tile-scoping also delivers both confirmed rules for free: contents **outlive the character** who stored them (the vault is part of the estate, exactly as the building is), and `withoutBuilding()` takes them along when a Declared Enemy razes the place — an army sacks what it destroys, which is what stops a stash being strictly safer than carrying.

**The Pack cap applies on the way out, never on the way in.** `depositItem()` has no capacity check at all; `withdrawItem()` gates on `canWithdraw()`. That asymmetry _is_ the feature — a vault is how you get around a full Pack.

**Potions are storable too** (confirmed with the user), kept as their own list mirroring how `heldItems`/`consumables` already sit side by side everywhere else. `resolveStorageTheft()` picks its victim across both lists together, so a stash of potions is exactly as exposed as one of sellables.

**One roll per building that actually holds something** — each has its own Defense, so the rule can only be read per-building; an empty building is skipped rather than rolling for nothing. Fired from `App.tsx`'s `handleReturnToTown`, the same funnel the Laboratory's mutation uses and for the same reason (it is the one place a _living_ character leaves a dungeon), and deliberately **after** it, so a fatal mutation skips theft entirely — a character who dies on the way out has no homecoming to be robbed on. A character who dies in the dungeon likewise leaves the stash intact for their successor.

UI: deposit/withdraw in `HexInspector` (standing on the building — there's no remote depositing, and `canUseStorage()` enforces it), read-only "N items stored" per row in `TownScreen`'s "My Buildings" card, which is the "what did I leave where" view you want from a city on the far side of the map.

### Politics

`POLITICAL_AFFINITY_TABLE`/`DEFAULT_POLITICAL_AFFINITY`/`politicalAffinityTarget()` (`src/data/affinity.ts`, rules 1706-1720) — a numeric Race×Culture 2d6 target, **a genuinely different table from the boolean `RACE_AFFINITY`**. Races the rulebook's own table omits (Cat-Person/Rinoceroid/Lightbugster) fall back to the default rather than an invented number.

`resolvePoliticalAffinity()` rolls at a City/Fortress with no status yet — success is an ally (or Vassal), failure a permanent enemy. `WorldState.politicalStatus?: Record<string, "ally"|"vassal"|"enemy">` (optional back-compat), **one resolution per hex ever**.

Resolved in `WorldScreen.tsx`'s `handlePoliticalAffinity()` (touches both `resources` and `WorldState`); surfaced as a "Political Affinity" button in `TownScreen` and a read-only "Politics" row + 🤝/👑/🗡 badge in `HexInspector`.

**Vassals**: a City (never Fortress) becomes a Vassal instead of a plain ally if the roll succeeds AND the player holds Lord/King AND owns a Castle/City/Fortress within 3 hexes (`hexDistance()`, `parseHexKey()`). King's range is filled in by direct analogy to Lord's rulebook-specified case (a documented scoping call). A successful Vassal roll increments `milestones.vassalCount`.

## Warfare (#28, rules 1722-1763)

Recruiting troops at owned Castle/City/Fortress or Vassals, marching them (plus optionally the character) to attack a City/Fortress, then choosing to Annex or Loot on success. Reuses #27's target Defense numbers and the Political Affinity roll/table directly.

- **Mustering**: `canRecruitTroop()`/`recruitTroop()` — 200 coins at an owned Castle/City/Fortress or a Vassal, capped at one unspent troop per source hex. `AdventurerResources.troops`/`troopSources` are World/Town-only.
- **Attacking**: `resolveAttack()` always spends _everything_ in `resources.troops` at once, plus an optional `joinBattle` toggle (one bonus die; **a natural 1 kills the character, but only if the battle is lost**). Rolls `troops` d6 (+1 if joining) vs Defense (City 6, Fortress 12).
- **Declared Enemies**: resolved inside the same `resolveAttack()` call regardless of its own outcome — for every `"enemy"` hex (excluding the one just attacked), 1d6; 1-3 sends that many troops against the player's own nearest owned building (tie-broken by lowest Defense). A win destroys it via `withoutBuilding()` (reverting to a plain, re-buildable empty hex, **not** Ruins). Skipped if the player owns no buildings.
- **Storming**: on a successful attack, `resolveStorming()` offers **Annex** (re-rolls Political Affinity at +2; success grants Vassal unconditionally, bypassing the peaceful path's Lord/King-within-3 check — "won militarily"; failure auto-falls-through to Loot) or **Loot** directly (`withRazedToRuins()`, flat coins via `stormingLootPayout()` — 600 City / 1000 Fortress).
- Attacking your own Vassal is blocked (`canAttack()`) — any other City/Fortress is fair game regardless of status.

**UI**: "Recruit Troop" in `HexInspector` (owned building) and as a `TownScreen` City Action (Vassal hex). "Attack"/"Attack (Join Battle)" as City Action buttons; a won attack swaps the whole City Actions section for the Annex/Loot choice. A `"lost-death"` result calls `onCharacterDied("warfare")`.

**`attackMessage`/`pendingStorm` are lifted to `WorldScreen`**, not `TownScreen`-local, since a winning Loot razes the target to Ruins and unmounts `TownScreen` on the next render before any locally-held message could show. This is the same failure mode the Portal panel documents.

## Effect of the Forgotten Gods (Ziggurat)

The one genuinely novel Deadly Dungeons mechanic — a standing action usable at the Ziggurat's own hex on the World map, **not** something read from inside a dungeon run.

Two pieces of new state: `DungeonState.runDamageBonus` (a whole-_run_ damage bonus, distinct from `CombatState.playerDamageBonus`) and `AdventurerResources.nextDungeonDamageBonus` (armed by the hex action, consumed into `runDamageBonus` the next time a _fresh_ dungeon is entered — the same per-trip consumption shape `hireling` established).

`town.ts`'s `canUseForgottenGods()`/`resolveForgottenGods()` — **named to avoid ESLint's `react-hooks/rules-of-hooks` flagging a `use`-prefixed plain function as a hook** — spend 1 provision unconditionally, then roll 1d6: lightning damage (floored at 1 HP, can't kill), nothing, an unconditional Owl (bypassing `MAX_ANIMALS`), +1 stacking `nextDungeonDamageBonus` (two rolls), or +4 HP/maxHp permanently.

Surfaced via `HexInspector` props (`showForgottenGods`/`canUseForgottenGodsHere`/`onForgottenGods`/`forgottenGodsMessage`), gated on the current hex's own dungeon actually being Ziggurat-typed (`WorldScreen.tsx`'s `dungeonTypeKeyFor()`, resolved from `dungeonHistory` via the hex's `dungeonRunId`).

See [dungeon.md](dungeon.md) for why `RETURN_TO_DUNGEON` restores `runDamageBonus` from the persisted run rather than an action field.
