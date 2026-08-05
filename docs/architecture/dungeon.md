# The dungeon

Everything that happens below ground: map generation, doors, torches, combat, inventory, and the six built dungeon types' own rules.

Primary files: `src/engine/dungeon.ts`, `dungeonState.ts`, `dungeonReducer.ts`, `combat.ts`, `fight.ts`, `hands.ts`; `src/data/dungeonTypes.ts`, `dungeonTables.ts`.

## Structure and generation

A dungeon is a tree of `levels[]`, each holding `segments[]` (rooms/corridors/tunnels/staircases, positioned in an abstract pixel coordinate space for the map) and `connectors[]`.

`dungeon.ts` holds two kinds of pure logic, kept deliberately separate in the file:

1. **Rules** — table rolls, and `classifyDoorOpen()`, which decides whether opening a door is an ordinary roll, a staircase descent, the automatic depth-3 Final Room, the "no stairs ever found" dead-end Final Room, or a second staircase reusing an already-discovered level or Final Room.
2. **Spatial layout** — `placeChild`'s collision-avoiding placement algorithm. This is **not** a NoteQuest rule, just this project's own way of drawing a coherent map.

`dungeonReducer.ts` applies `classifyDoorOpen()`'s result via Immer (`produce`).

**The reducer takes an extra `rng` parameter** (for silent Room Content/Monsters rolls), so it can't be passed directly to React's `useReducer` — `DungeonScreen.tsx` wraps it in a 2-arg `reduceDungeon`.

A second staircase down to an already-discovered level (`reuse-normal`) links straight to that level's own entrance (`segments[0]`) rather than building anything new (#54) — the same "one shared destination" shape as `reuse-final`. Neither rolls, and neither shows up in `bumpStatsForNewSegment`'s tallies (see `DungeonMap`'s `AUTOMATIC_KINDS`).

### Positional movement

`DungeonState.currentSegId` (where the player physically stands) is distinct from `selectedSegId` (what `RoomInspector` displays). `SELECT_SEGMENT` keeps them in lockstep, only succeeding for a *reachable* segment.

`reachableSegIds()` (`dungeon.ts`) computes the fog-of-war boundary: `currentSegId` plus everything connected by an already-opened door, walked bidirectionally. Segments outside it render greyed out and can't be selected; `OPEN_DOOR`/`RESOLVE_DOOR_LOCK` guard `action.segId === state.currentSegId` server-side. `currentSegId` auto-advances the moment a door opens into a new segment. `SWITCH_LEVEL` (an already-opened staircase) also moves the player, validated the same way.

A level other than wherever `currentSegId` sits ends up with an empty reachable set as an emergent property — so `LevelTabs` doubles as free, read-only history browsing.

### Secret passages

A Secret Passage roll of 6 builds a real, descendable `type: "staircase"` segment via `buildSecretPassageStaircase()` — the door itself is brand new (appended, already `opened: true`), placed in whichever cardinal direction the room doesn't already have a door. It only silently no-ops for a fully-4-doored entrance.

`isHiddenChestResult()` (`dungeonTypes.ts`) replaced two exact-string comparisons against `"You have found a hidden Chest!"`. The per-type Secret Passage tables carry the rulebook's own wording and it isn't uniform — the Laboratory's says "Found a hidden Chest!" — which silently made its Secret Passage chests unopenable. It's a substring check, following the "no formal taxonomy, substring matching instead" convention.

## Torches and doors

`DungeonState.torches`/`alive` track the resource that actually matters.

Every door first rolls the shared `OPEN_DOOR_TABLE` (trap/locked/unlocked) via `RESOLVE_DOOR_LOCK`, *before* `OPEN_DOOR` runs; only "unlocked" (or a resolved lock/trap) proceeds to the Segments-table roll.

**All torch spending flows through the reducer's `spendTorches()` helper**, which flips `alive` to `false` (the Darkness, setting `deathCause = "darkness"` explicitly rather than leaving it null) instead of going negative — **including the dungeon-entry torch** (#92), which used to be a bare decrement that could drive the counter negative for anyone with a 0-torch survival ability (Miner/Samambro/Raven). It's charged before anything is built, so a failed spend leaves no half-made dungeon, and `DungeonScreen` also disables "Roll for Dungeon" at 0 torches. `MAX_TORCHES` is imported rather than open-coded at the four torch-granting sites.

`DungeonMap.tsx`'s door-click handler mirrors the reducer's math client-side purely to decide whether to animate further dice — the reducer is the sole authority on death.

### Locks, keys and broken doors

Locked doors show "Pick Lock (1 torch) / Use a Key / Break Door (free)". Breaking a door or setting off a trap alerts monsters beyond it.

**Keys** (#95) are the quiet third option — `LockChoice: "useKey"` spends one of `DungeonState.keys`, no torch and no noise, and counts toward Thief's `locksOpened` (its requirement is "opened at least 4 locks," and a key opens the lock; breaking the door destroys it without ever opening it, which is why that branch still doesn't count). "Keys found in one dungeon do not open doors in another" holds for free — keys live on `DungeonState`, and `RESUME_DUNGEON` resets them.

The **Master key** ("opens any door in any dungeon") is a standing `ItemEffect`, `opensAnyLock` — never consumed, unlike `trapImmunity`, and spending nothing at all, so the same prompt works at 0 keys (the button reads "Master Key" instead of "Use a Key (N)"). Closest precedent is `doubleChestCoins`: a permanent property of a carried item read at one decision point. It is also the first Wonder that fits neither side of #83's wear-it-or-sell-it split — a key is not armor, a potion or a scroll, none of the three things an Ogre "cannot use" — so `resolveWonder()`'s Ogre check carries a deliberately narrow exemption naming that one effect rather than widening the rule.

**Broken doors** (#96) are remembered on `DoorState.broken` and carry an alarm **one hop** — "communication between the segments," not a transitive flood-fill. `alertThroughBrokenDoors()` walks both directions (doors live only on the parent segment, so neighbors are collected the same way `reachableSegIds()` does) and marks each neighbor `SegmentState.alerted`. Only one `CombatState` exists at a time, so an alerted group can't fight from across the map; instead `startCombat()` reads `alerted` as `wasNoisy` when the player finally walks in, giving them the first strike, and consumes the flag.

### Traps

`TrapEntry` carries `torchCost`, `damage` (flat HP, e.g. Acid Spout), `bladeTrap` (roll 1 kills outright, 2 "loses an arm"), `monsters` (an ambush, always noisy), plus the Deadly Dungeons additions `destroysArmor` (zeros a random *usable* armor piece's HP, sets the `hasHadArmorDestroyed` milestone), `rollsMonsterTable` (springs a fresh 2d6 Monster-table encounter), and `torchCostDice` (a variable dice-rolled cost).

All three trap-firing sites (`RESOLVE_DOOR_LOCK`, `ROLL_SECRET_PASSAGE`, `ROLL_CHEST`'s empty-chest trap) funnel through `resolveTrapOutcome()`, which checks a `trapImmunity` item first before falling through to `applyTrapEffect()`. `trapImmunity` blocks the whole trap including torch cost, and is one-shot consumed.

**The blade trap's kill die is shown** (#112): a 1-in-6 that ends the run outright was rolled silently inside `applyTrapEffect()` while `DungeonMap` animated the *trap-table* die — so the sequence read "a trap!", then a die that wasn't the one that mattered, then a dead character. The roll now comes in on the action (`bladeRoll`, beside the existing `trapRoll`) at all three firing sites, animated first by whichever UI fired it. `applyTrapEffect` still rolls its own when none is passed, so tests and non-animating callers are unaffected. **The die is resolved once**, not per-branch — the roll of 1 (death) and the roll of 2 (the arm) are two outcomes of the *same* die, and re-reading `bladeRoll ?? rollDie(rng)` would roll a second one for any caller that doesn't animate.

## Combat

`src/engine/combat.ts` is pure and RNG-injected like the rest of the engine; `dungeonReducer.ts` is the only thing that mutates `DungeonState.combat`/`hp`/`coins`.

### One combat engine (#120)

`src/engine/fight.ts` is the shared core every fight runs on — a dungeon room, a hex in the wilderness, an Arena bout.

**Why it exists.** Combat lived inside `dungeonReducer.ts`, reading and writing a `Draft<DungeonState>` directly, so a fight could only happen in a dungeon. `events.ts` (#91) and `arena.ts` (#58) each grew a smaller parallel implementation that took `hp` and a weapon formula and nothing else — silently dropping armor absorption, spells, attack bonuses, weapon `bonusEffect`, the Hireling, animals, potions and all three death-survival abilities. For the Arena that was defensible (you choose to enter). For an Event it wasn't: the encounter is mandatory and offered one button, so the player was forced into a fight without the character they'd built.

**The seam is `Fighter`** — the character-side state a fight reads. `DungeonState` and `AdventurerResources` both satisfy it structurally, so nothing in the core knows which it's holding. The two fields `AdventurerResources` lacks (`raceName`/`className`, which live on `CreatedCharacter`) are threaded in per-fight as a `FighterIdentity` rather than duplicated into the persisted blob — a run outlives the screen that created it, a single Event doesn't.

**What deliberately stays out**: segments, remains, loot-per-segment, `alive`/`deathCause`, the Graveyard. The core reports `died` and lets the caller decide what that means — the dungeon leaves remains and flips `alive`, the World writes a Graveyard entry. Same split `payOutVictory()` makes: shared loot and deferred victory triggers in the core, Treasures and the building tax in the dungeon.

`dungeonReducer.ts` keeps its own orchestration and delegates the rules — thin wrappers (`attackBonus`, `applyMonsterTurn`, …) exist so its ~40 call sites read unchanged. Events and the Arena use `fightRound()`, the core's own whole-round orchestrator.

**Teleport is the one spell the core can't own** (it needs a destination segment), so `castCombatSpell()` handles every other spell once and each caller does Teleport itself. In the wilderness the equivalent escape is fleeing.

**UI**: `EventPanel` keeps only what's Event-specific (the flavour line, Camouflage/Star Stone/Continue) and renders `CombatPanel` for the fight itself, so the wilderness offers exactly what a dungeon room does. `CombatPanel`'s dungeon-only handlers (`onEngulfBody`, `onHirelingExplode`, `onAnimalAttack`) became optional, and it gained a standing `fleeLabel` button distinct from Teleport.

`events.ts` borrows Immer's `produce` — the only place outside the dungeon reducer that does. The core mutates drafts, and rebuilding `{resources, combat}` by hand at every call site would be far more error-prone.

### The round

`buildSegment()` creates a room, and if `resolveRoomExtras()` rolled a `MonsterTemplate`, `startCombatIfMonsters()` spawns a `CombatState` — except the entrance itself, exempt from Monsters entirely (a deliberate balance call): `resolveRoomExtras()` still rolls the Monsters dice for RNG-consumption parity but discards the result.

`wasNoisy` (a broken door or fired trap) decides whether the monsters get the first attack.

Once `state.combat` is non-null, door/passage/level actions all no-op. `PLAYER_ATTACK` is one full round per dispatch:

1. `resolvePlayerAttack()` resolves the hit (Stoneskin/Intangible/Weakness, plus a roll-of-1 special ability — Explosive short-circuits into an immediate self-destruct bypassing normal damage math).
2. The reducer applies events (Firebreath/Sorcery queue `bonusDamage`; Deathtouch/Paralyze queue onto the monster's own next attack; Regeneration heals immediately; Horde/Necromancy always spawn a fixed extra monster).
3. `checkUndeadRevival()` on any newly-defeated Undead (skipped if the player holds `ignoresMonsterAbility: "undead"`).
4. `applyMonsterTurn()` closes the round: splits damage into `poisonDamage` (bypasses armor, hits `hp` immediately) and `absorbableDamage` (deferred to `combat.pendingDamage` if the player has usable armor/Hireling, else straight to `hp`), then consumes queued Paralyze/Deathtouch.

Paralysis (`combat.paralyzedTurns`) skips the player's next N `PLAYER_ATTACK` dispatches; monsters still act.

Victory (`finishIfVictorious()`) rolls `rollLoot()` per Loot-tagged monster killed, credits `coins`, marks the segment `monstersDefeated`, clears `combat`.

`CombatPanel.tsx` rolls the player's weapon die and dispatches `PLAYER_ATTACK` with the raw roll — the reducer applies the modifier/bonus effects. When `combat.pendingDamage` is set, it renders an absorption chooser (HP / armor piece / Hireling) dispatching `RESOLVE_DAMAGE`; other actions no-op until resolved.

### Free actions that don't end the round

`HIRELING_ATTACK`, `ANIMAL_ATTACK` and `HIRELING_EXPLODE` are each capped once per round by a flag (`hirelingAttackedThisRound`, `animalAttackedThisRound`) reset at the top of `applyMonsterTurn()` — the one chokepoint every round-ending action already calls. Deliberately **not** gated on the player's own paralysis. Resolution reuses `resolveSpellDamage()` (fixed/rolled value, defense abilities apply, no roll-of-1/6 triggers).

See [character.md](character.md) for the Hireling and Animal ability details.

### Death

Hitting 0 HP sets `alive = false`/`deathCause = "combat"` (vs `"darkness"`) and clears `draft.combat = null` at all four death sites — `CombatPanel`'s own `canAct` also checks `hp > 0` directly as a second line of defense. `DungeonScreen.tsx` uses `deathCause` to pick the death message.

**Death survival abilities** are checked in order at all seven in-dungeon `draft.alive = false` sites: Samambro's `trySamambroSurvival()` (roll 3+, survive at 1 HP), Raven's `tryRavenSurvival()` (roll 4+, identical shape — a character with both gets two independent rolls), then `tryZombieRevival()`. The zombie row is deliberately **not** a roll — it always fires while there's HP left to halve (`maxHp / 2^(revivals+1)`), so the rollable chances are spent first and it finally stops saving you when that floors to 0. `rng` is threaded through `spendTorches()`/`applyMonsterTurn()` for this.

`App.tsx`'s `handleTownDeath` is the single funnel for every death that isn't one of those seven (Gamble's life bet, Thug Life, Arena, a travel Event, a Portal, a realm hazard, a fatal mutation) and re-checks zombie revival there.

### Kill tallies

`handleMonsterDefeat()`'s non-revived-kill branch tallies `killsByName` (lowercased monster name) and `killsByAbility` (one increment per ability) alongside `monsterKills`/`bossKills` — added to unblock Advanced Classes' kill-count requirements (Ruthless's "10 Imps," Ghostbuster's "10 intangible beings"). All follow the same lifecycle everywhere.

`CharacterSheet`'s "Kills" stat is a `<button>` opening `TallyModal` (dismiss-only, listing `killsByName` highest-first — generalized from the Kills-only `KillBreakdownModal` when Curiosities needed the identical thing).

**Singular monster names** (#65): `MonsterTemplate.singularName` (only set where `count` could resolve to 1: Goblins, Bats, Skeleton Soldiers, Giant Rats, Scorpions, Cultists, Serpents, Imps) gives `spawnMonsters()` the correct name for a lone survivor. Goblins/Bats/Skeleton Soldiers were consolidated into shared `GOBLINS`/`BATS`/`SKELETON_SOLDIERS_SWARM` constants. `killsByName` genuinely splits "goblin" from "goblins" — Goblinator (`>= 20` Goblins) sums both forms.

### Move Silently

A quiet arrival into a room with monsters no longer auto-starts combat — `finishRoomSegment()` only does that for a noisy one. Instead it waits for `RESOLVE_ROOM_ENTRY`:

- **Attack First** (free, this app's old default outcome)
- **Move Silently** (1 torch; one die per monster resolved server-side — any 1 means detected and monsters attack first, otherwise `sneakedPast` and combat never starts)

`hasPendingRoomEntry()` blocks every other action until the choice is made. A `sneakedPast` room's monsters wake (`wakeSneakedPastMonsters()`) if a later noisy action happens there; `rerollMonstersIfNeeded()`/`restoreMapFromPersisted()` both treat it as still-occupied.

Halfling's "roll two dice, discard the lowest (except Boss)" applies server-side in the same case; Boss rooms never reach `RESOLVE_ROOM_ENTRY` at all. Owning a Dog blocks Move Silently entirely. In a Sewers tunnel, detection is on a 1 *or* a 2 — composed with Halfling's discard rather than overriding it.

`RoomEntryPrompt` is the UI, rendered in place of `RoomInspector` while pending. Both `DungeonScreen.tsx`/`DungeonMap.tsx` also check `state.alive` directly, since dying to that room's monsters never marks `monstersDefeated` and would otherwise reshow the prompt alongside the death panel.

### Teleport

"Teleport to any empty room" is the one spell whose `CAST_SPELL` action carries extra fields (`destLevel`/`destSegId`). Clicking "Flee — Teleport" in `CombatPanel` swaps the panel for `TeleportPicker`, listing every discovered "empty" room via `isTeleportDestination()` (`dungeon.ts`) — a room segment excluding the current combat one, no undefeated/`sneakedPast` monsters, and not `needsMonsterReroll` either, since arriving immediately calls `rerollMonstersIfNeeded()`, which would otherwise spring a fresh fight right after fleeing.

Only picking a room dispatches `CAST_SPELL`; Cancel spends no use. The fled room's `CombatState` doesn't persist — `rerollMonstersIfNeeded()`'s "still waiting" branch resumes it, full HP, if later reselected. `TeleportPicker` also shows a non-interactive "Fleeing from Level X — [Type] (Segment N)" reference line (#56).

### The Boss fight

Each dungeon type's `DUNGEON_TABLES[key].boss` (`Record<1-6, MonsterTemplate>`) is rolled once via `resolveBoss()` in both the `descend-final` and `dead-end-final` cases — no Content/Monsters roll alongside it, only the Boss. Fed through `startCombatIfMonsters()` with an `isBoss` flag on `CombatState`; `finishIfVictorious()` grants a flat 2d6 Treasures instead of the normal Loot table.

**Necropolis's Boss is a 3-part combinator, not a flat table**: `NECROPOLIS_BOSS_PART1`/`PART2`/`PART3` (modifier/creature/modifier) are each rolled independently and combined by `resolveNecropolisBoss()` into one `MonsterTemplate`. `DUNGEON_TABLES.<type>.boss` is therefore optional (only Necropolis omits it), and `resolveBoss()` branches on `dungeonKey === "necropolis"` before the flat-table fallback.

`dungeonHistory` is persisted the instant `bossDefeated` flips true via its own `useEffect` (not only on unmount / "Return to Town" click) — a hard reload from the victory screen kills the JS before the unmount cleanup ever runs, and World's beaten-check would otherwise still read the pre-victory snapshot on next load.

## Rewards and inventory

### Room Content rewards

`RoomContentEntry.reward` (`coins`/`treasures`/`magicScrolls`/`magicItems`, each carrying a `MonsterCount`) flags rows describing an automatic, mechanically-applied reward. `applyRoomContentReward()` resolves it the moment the room is built: `coins`/`treasures` credit directly (optional `multiplier`), `magicScrolls` grants that many random Basic Spell uses, `magicItems` rolls that many via `resolveMagicItem()`. `finishRoomSegment()` composes this with `startCombatIfMonsters()` at all 4 real room-building sites (reward first, then combat) — the 2 Final-Room/Boss sites are untouched.

### Chests and Loot

`RoomContentEntry.hasChest` flags rows describing an actual Chest (vs passive, unapplied flavor text like "1d6 coins on the floor"); a chest can also come from a Secret Passage roll. `RoomInspector` offers a free "Open Chest" action rolling two dice — higher becomes coins, lower becomes Treasures, unless both are 1 (empty, rolls on the Trap table instead).

### Opening a Treasure

Each dungeon type's `DUNGEON_TABLES[key].treasure` (`Record<1-6, RewardOutcome>`) models the per-dungeon Reward table. Rows redirecting to Wonders/Magic Item/Weapon/Potions (`RewardEffect.kind: "rerollColumn"`) resolve a second `rollDie()` into that column. Repeated rows are shared constants (`HEALTH_POTION`, `MAGIC_SCROLL`, …).

`OPEN_TREASURE` is usable anytime via a die-roll bar whenever `treasures > 0`; mid-combat it consumes the round like `CAST_SPELL`. `restoreAllSpells` (Tomb's Mana Potion) restores to `DungeonState.maxSpellUses` directly. "Worth N Coins in town" outcomes push a `HeldItem` (`{name, worth}`) onto `heldItems`, since there's no town to sell in mid-dungeon.

### Armor and weapons

"Table: Armor" (1d6: Ring 0 HP / Bracelets 2 / Boots 3 / Shoulderpads 3 / Helm 4 / Breastplate 10) is one shared `ARMOR_TABLE`; "Table: Weapon" differs per dungeon type.

Every Wonder/Magic Item ability is an `ItemEffect` — a small reusable vocabulary: `extraHp`, `weaponDamageBonus`, `damageBonusVsTag`, `damageMultiplierVsTag`, `ignoresMonsterAbility`, `trapImmunity`, `doubleChestCoins`, `combatDamageBonus`, `grantsTorches`, `randomSpell`, `lifesteal`, `instantKillOnRoll`, `opensAnyLock`, `flavor`. Tag matching is a case-insensitive substring check against `MonsterTemplate.name`.

`ignoresMonsterAbility` covers two shapes: abilities used against the player (`dungeonReducer.ts`'s `ignoresAbility()`) and the player's own attack being defensively blocked (`combat.ts`'s `applyDefensiveAbilities()`, threaded via `resolvePlayerAttack()`'s `ignoreAbilities`). `MagicItemEntry.fixedFormula` overrides the base-table-then-bonus shape for uniquely-named weapons.

**Acquiring** (`resolveWonder()`/`resolveMagicItem()`, called from `OPEN_TREASURE`'s `rerollColumn`): a Wonder either grants its own HP-bearing item or, with no HP of its own, becomes a `DungeonState.armor` entry at `hp: 0, maxHp: 0` (equipped/visible, never offered as absorption) — except `combatDamageBonus` (Potion of Fury), added directly to `combat.playerDamageBonus` if a fight is active, logged as wasted if not. A Magic Item is "[Armor] of X" or "[Weapon] of X": rolls the base table for the concrete piece, layers the effect on top.

**Magic Item names are templates** (#116). `MagicItemEntry.name`/`text` carry "[Armor] of Royalty" because the concrete piece isn't known until the base table is rolled — so the player used to see a literal `[Armor] of the Dead`. `substituteItemPlaceholder()` (`dungeonTables.ts`) fills it in at grant time, in the stored name *and* the log line. The weapon branches gained the same treatment: a rolled Magic Item weapon used to be renamed to the bare base weapon ("Whip"), discarding its identity; it's now "Whip of Destruction". A test asserts no authored `magicItem` row can reintroduce an unsubstituted placeholder.

**Wearing**: `DungeonState.armor: ArmorPiece[]`/`weapon: EquippedWeapon | null` (mirrored on `AdventurerResources`/`FallenAdventurer`) thread through every construction site like `heldItems`. `RESUME_DUNGEON` does **not** carry them — they become remains instead.

**Spare weapons** (#48): every weapon grant pushes onto `spareWeapons` instead of overwriting `weapon`, since a weapon can appear automatically just from opening a door (no interrupting choice prompt). `WIELD_WEAPON {index}` swaps a spare in, pushing the old one back; `town.ts`'s `wieldWeapon()` mirrors it.

**Armor slot uniqueness** (#82): `addArmorPiece()`/`addArmorPieces()` are the single chokepoint replacing all raw `draft.armor.push()` sites — a piece for an already-occupied one of `REAL_ARMOR_SLOTS` (5 real slots; Ring/`wonderItem` are exempt) benches into `spareArmor`. `WIELD_ARMOR {index}`/`wieldArmor()` has to find-and-displace *that spare's own slot*, not just whatever's currently equipped.

`Equipment` renders armor as `armorLabel()` — "Centurion's Helm (Helm)", since `itemName` used to *replace* the slot rather than accompany it, so a named piece said nothing about where it was worn.

### The Pack

`MAX_HELD_ITEMS = 10` (`town.ts`). Exactly two sites push to `heldItems` (`OPEN_TREASURE`'s heldValue cases, `COLLECT_REMAINS`), both check the cap first. Held potions share the same slots — `packUsed()`/`packIsFull()` (reducer) and `packUsedSlots()` (town) count `heldItems.length + consumables.length`, so Cargo Ogre's 40 and Monkey's +1 apply to potions for free.

**The interactive swap**: `pendingPackItem: HeldItem | null` holds an item that didn't fit. `isActionBlocked(state)` (`hasPendingRoomEntry(state) || pendingPackItem != null`) replaced every `hasPendingRoomEntry()` call site. `OPEN_TREASURE` at a full Pack sets it instead of pushing (the Treasure is still spent). `COLLECT_REMAINS` takes as many as fit; overflow becomes `pendingPackItem` plus a shrunken `seg.remains`, nothing lost. `RESOLVE_PACK_SWAP {discardIndex | "decline"}` resolves it and is deliberately exempt from `isActionBlocked` (it's what clears the block). `DISCARD_ITEM {index}` lets a player drop anything anytime. Not threaded through either resume path (always `null`) — safe since Retreat is gated on `!pendingPackItem`.

### A consumable inventory (#110)

Potions used to fire at the instant of discovery, so a Health Potion found at full HP was wasted and a Potion of Fury found outside a fight was *explicitly discarded*. A player described it as drinking every potion they found "like a potion fiend." The fix gives the player the one decision that makes a potion interesting: *when*.

The rulebook is not silent here, which is what made this a UX fix rather than an invented rule: "up to 10 items in your backpack" (rules 200), the Laboratory's "Load up to 3 potions" (2305), and the "if you drink it" phrasing on both the Dream Potion (1249) and the Verdosa Potion (951).

- **`Consumable {name, text, effect}`** on `DungeonState.consumables`/`AdventurerResources.consumables`. `ConsumableEffect` is a **union of `Extract`s over the existing `RewardEffect`/`ItemEffect`** rather than a third vocabulary — a potion does exactly what it did before, just later.
- `isHoldableRewardEffect()`/`isHoldableItemEffect()` decide what gets held, and the rule is uniform: **an effect whose value depends on timing.** That's `healAll`/`restoreAllSpells`/`restoreRandomSpellUse`/`grantTorchesRoll` and `healAmount`/`grantsTorches`/`combatDamageBonus`. A `grantTorchesRoll` bundle rolls its dice when *used*, not when found.
- A completely full Pack **falls back to drinking on the spot** rather than opening `pendingPackItem`'s swap prompt: that prompt trades one `HeldItem` for another and has no notion of a consumable, so overflow degrades to the pre-#110 behavior instead of losing the find.
- **`applyConsumable()`** holds every effect branch, moved verbatim from the discovery sites. `USE_CONSUMABLE` is deliberately *not* gated on `!state.combat` (holding a Health Potion for a fight is the point) and instead **consumes the round**. `DISCARD_CONSUMABLE` *is* gated like `DISCARD_ITEM` — dropping a bottle isn't a combat action.
- **Two UI homes**: `Pack` renders a "Potions" section (Use/Discard, with Potion of Fury *disabled* rather than hidden where there's no fight), and `CombatPanel` renders "Drink X" beside the Cast buttons, because its overlay covers the sidebar Pack mid-fight.
- **Ogre and remains both hold.** `resolveWonder()`'s Ogre branch runs *before* the hold check and `OGRE_RESTRICTED_REWARD_KINDS` covers the two Treasure rows that are really potions. `leaveRemains()`/`COLLECT_REMAINS` carry potions like `heldItems`, taking them after sellables with whatever room is left.
- **Deliberately not moved**: `trapImmunity` (Potion of Luck) already worked as a held-then-consumed standing item on `armor`, and migrating it would risk existing saves for no player-visible gain.

Town/World has its own implementation (`drinkConsumable()`/`canDrinkConsumable()`) for the same reason `castSpell()` mirrors `CAST_SPELL` — no reducer to dispatch against and no round to consume. Named `drink…` because ESLint treats a `use`-prefixed function as a hook.

## Your Hands (#100)

Rules 226-230: "one hand must hold the torch, so you cannot fight with a Two-Handed weapon without another source of light in place. Losing an arm in a trap has the same effect."

`src/engine/hands.ts` is the hand economy, and it exists because five separate authored-but-inert things were all waiting on this one rule: `WeaponEntry.twoHanded` (parsed, stored, threaded, displayed, never checked), the Dwarf Lamp culture action (a 40-coin sink whose UI copy already promised "lets you use both hands"), the Torchbearer Hireling (roster text "None." despite the rulebook naming *hiring someone to hold the torch* as workaround #1), Blade Trap's roll-of-2, and the Light spell's "(does not use a hand)" clause.

- **Its own module, with its own seam.** `HandBearer` is satisfied structurally by both `DungeonState` and `AdventurerResources` — the same trick `fight.ts`'s `Fighter` uses. It isn't part of `fight.ts` because the state spans a run *and* a character between runs, and because enforcement touches `spareWeapons`, which `Fighter` deliberately doesn't carry. `ownsLamp()`/`DWARF_LAMP_NAME` moved here from `town.ts` (re-exported there) since the Lamp is now read against a `DungeonState` too.
- **`armLost` is an absolute veto, checked before every light source.** "Losing an arm has the same effect" as holding the torch — so a one-armed character *with* a Lamp still has one usable hand and still can't two-hand anything. Permanent, mirrored on both types like `mutations`, carried out of a run from `dungeon.armLost` (not `prev`'s), since a Blade Trap takes it mid-run.
- **`lightActive` expires on the next torch spent** (confirmed with the user over a whole-run duration): the globe is "worth a torch," so it's used up like one. `spendTorches()` is the single place torches ever leave the counter, which makes it the single place the globe can go out. Run-scoped only.
- **Wielding is unrestricted in Town** (confirmed with the user, reading "when exploring a dungeon" literally). That forces the other half of the design: `benchUnusableWeapon()` is the single chokepoint for "hands just stopped being free," and it runs at dungeon entry (all three construction paths), after `spendTorches()` clears the globe, and after the Blade Trap takes an arm. Benching rather than dropping reuses #48's answer — an unusable weapon waits in `spareWeapons` until it isn't.
- **`WIELD_WEAPON` is the enforcement point**, and logs `twoHandedBlockReason()` rather than silently no-opping; `Equipment`'s `twoHandedBlockReason` prop disables the button and shows the same copy, passed only by `DungeonScreen`.

## Remains and resuming

**Remains**: `DungeonState.characterName` labels whose they are. `leaveRemains()` fires at every death site and drops the dying character's coins/treasures/keys/heldItems/consumables/armor/weapon onto `SegmentState.remains`, merging if an earlier death already left something. `RoomInspector` shows a free "Recover Remains" button dispatching `COLLECT_REMAINS`.

`COLLECT_REMAINS` leaves a fallen adventurer's armor behind in the remains rather than force-selling — confirmed as intentional, not a bug.

**Resuming an unbeaten dungeon**: dying (or leaving) doesn't erase a dungeon. `App.tsx` lifts `dungeonHistory: PendingDungeon[]`, keyed by a `runId`. Progress is captured generically in an unmount cleanup (reading the latest state via a ref) — it fires regardless of *why* the screen unmounted, so `handleLeaveDungeon` just drops a run that never went anywhere (`levels.length === 0`) and otherwise upserts. **Beaten runs are kept too**, as historical record (`isDungeonBeaten()` computed on demand).

From `selectedRunId === activeRunId`, App derives which resume path `DungeonScreen`'s mount-time `useReducer` initializer takes. Both land in `restoreMapFromPersisted()` for the shared map-copying/monster-respawn logic:

- **`RESUME_DUNGEON`** — a *new* character taking over a *dead* one's map. Resets every character-specific field to the new character's own starting `resources`, forces `activeLevel`/`selectedSegId` back to the entrance (`resetToEntrance: true`). The dead character's belongings stay as recoverable `remains`, not inherited.
- **`RETURN_TO_DUNGEON`** — the *same living* character returning. Carries `resources` over *exactly* (including coins/treasures/keys/heldItems), `resetToEntrance: false`. Also restores `runDamageBonus` from the **persisted run** rather than an action field (#93) — it belongs to the run, not the character, and `createInitialDungeonState()`'s positional arg list would otherwise silently default it to 0 on every resume.

Both `structuredClone()` the incoming persisted `DungeonState` (Immer deep-freezes `produce()` output) and carry an explicit `maxHp` field — `createInitialDungeonState()`'s `startingHp` param historically only set *current* HP, which broke "retreat below full HP, then come back."

**Monster table re-roll on return**: `restoreMapFromPersisted()` flags every built, empty/cleared room-type segment `needsMonsterReroll` — except a just-respawned interrupted fight, and the entrance (#55, guaranteed empty and would otherwise reroll into a fight the instant a `RESUME_DUNGEON` character lands). Resolved lazily by `SELECT_SEGMENT` (`rerollMonstersIfNeeded()`) the next time that room is actually viewed, not eagerly, since only one `CombatState` slot exists. Only `monsters`/`monstersDefeated` are touched, not room content/chests/passages.

Both paths reset `currentSegId`/`selectedSegId` to `activeLevel`'s entry segment — a walk back is still required, so Monster re-roll can't be silently bypassed. An interrupted fight is the one exception.

## Race and class abilities inside a dungeon

`DungeonState.raceName`/`className` (plain strings, matched exactly) thread through every dungeon construction site alongside `characterName`, so the reducer can gate ability checks without the full `CreatedCharacter`. Client-side-resolvable abilities (`TownScreen`, `RoomInspector`) read `character.race`/`character.cls` directly.

- **Combat**: Grave Digger's +2 checks `monster.abilities.includes("undead")` (an ability, not a name match). Cook's +1 coin (except Undead) and Slimemen's `engulfableBodies` tracking live in `handleMonsterDefeat()`. Rinoceroid's horn is a second per-monster `CombatPanel` button (`PLAYER_ATTACK` with `useHorn: true`) — flat 1d6, no modifier, skips equipped-weapon effects, but general combat buffs still apply.
- **Goblin's explosion**: `PLAYER_ATTACK` checks `raceName === "Goblin" && action.roll === 1` right after resolving the target, and if true entirely replaces the normal single-target hit with a room-wide `resolveSpellDamage(monster, 5)` loop (the same shape Fireball/Insect Rain/`HIRELING_EXPLODE` use), then still runs the same `finishIfVictorious()`/`applyMonsterTurn()` tail. The ambiguity that blocked this ("does it also hurt the Goblin?") was confirmed with the user: **monsters only** — mirroring Goblin Helper's own explosion, not the Explosive monster ability's player-facing precedent.
- **Doors/torches**: Locksmith's free lock-picking and Lumberjack's torch-from-breaking-a-door live in `RESOLVE_DOOR_LOCK`. Miner's "leave the dungeon if out of torches" is a `spendTorches()` special case — the failed action just fails, leaving the character alive at 0 torches to Retreat normally.
- **Dwarf** (`RoomInspector.tsx`, client-side): Find Secret Passage rolls two dice, keeps the higher.

## Dungeon types

`DUNGEON_TYPES` holds 10 built types. Keys 1-6 are the Core Book's own capped "Dungeon Name" table; 7-10 (Citadel/Pyramid/Ziggurat/Necropolis) are reachable only via `DUNGEON_TYPE_BY_TERRAIN`'s wider roll. Sewers is 11 and Laboratory 12.

**Segments and Secret Passage tables are genuinely per-type, not shared** — contrary to an early assumption. `SEGMENTS_TABLE_BY_TYPE`/`SECRET_PASSAGE_TABLE_BY_TYPE` (`dungeonTypes.ts`, both `Partial<Record<DungeonTypeKey, …>>`) hold only the types whose table actually differs, falling back to the shared `SEGMENTS_TABLE`/`SECRET_PASSAGE_TABLE` when absent (Citadel/Pyramid share one; the Core 6 need no entry). `rollSegment()` and the Secret Passage lookup both take/derive a `dungeonKey`.

### Deadly Dungeons (#30, rules 1902-2438)

Citadel, Pyramid, Ziggurat, Necropolis — chosen first of the rulebook's 8 unbuilt types since they fit the data-driven architecture most directly. Confirmed with the user to build the full "Special Rules" layer, not just the core tables.

New shapes introduced: `SegmentType` `"room-big"`; `ItemEffect`/`RewardEffect` kinds `rerollBaseTable`, `healAmount`, `restoreRandomSpellUse`; `WonderEntry`/`MagicItemEntry` fields `grantsWeapon`, `fixedArmor`, `twoHanded`, `grantsSpells`.

**Post-Boss bonus loot ("Hallows")**: Citadel ("Dwarf Hallows") and Necropolis ("Forgotten Hallows") each roll one extra item the instant their Boss falls — `DungeonTypeTables.bossBonusLoot?: Record<1-6, BonusLootEntry>` (a discriminated union: `weapon`/`armor`/`trinket`), granted by `finishIfVictorious()` via `grantBonusLoot()`.

**Ziggurat's "Effect of the Forgotten Gods"** is the one genuinely novel mechanic — a standing action usable at the Ziggurat's own hex on the World map, not something read from inside a run. See [town-and-economy.md](town-and-economy.md).

### Sewers (#30, rules 1809-1907)

The 5th Deadly Dungeons type and structurally the most different — the first with **no Boss and no Final Room**, the first with **Tunnels**, and the first with doors that can't be broken.

- **No Final Room.** `classifyDoorOpen()` derives `hasFinalRoom = dungeonTypeKey !== "sewers"` and gates all three Final-Room paths on it. A run finishes by **climbing out**: Room Content 10's metal ladder sets `DungeonState.exitUsed`, and `isDungeonBeaten()` accepts that in place of a cleared Final Room. Putting it in `isDungeonBeaten()` rather than at the ~8 call sites means the map badge, gate copy, `DungeonsList`, Miner's `survivedRunIds` and the Hireling's per-trip expiry all agree without any of them knowing Sewers exists.
- **Tunnels** are a genuinely new `SegmentType`, not a reskinned corridor: "in a tunnel you must roll to add Monster but not Content" puts them between a corridor (neither) and a room (both). `resolveRoomExtras()` still rolls the Content dice and discards them, for RNG parity.
- **Two tunnel columns.** Sewers prints "Following a Tunnel" and "Open from a Tunnel" where every other type has one column per source segment. A tunnel's forward door — the one opposite `cameFromDir` — is marked `DoorState.continuesTunnel` when the segment is built, and `rollSegment()` picks the column from it. An entrance tunnel (the 4-way manhole) has no way in, so all four doors continue tunnels. Consequence: the 1-door tunnel rows have *only* a forward door, so rooms are reached solely through the 2-door rows — sewers really are mostly tunnel.
- **Floodgates**: "works like normal doors but cannot be destroyed, has no traps, and will always be locked." `DoorState.floodgate` makes `RESOLVE_DOOR_LOCK` override the door roll to `"locked"` outright (rather than filter it — a floodgate has no trap or unlocked outcome to fall through to) and refuse `breakDoor`; `DungeonMap` omits the Break option entirely. Placed on a *non*-forward door where one exists, since a floodgate on the only way on would seal the tunnel behind an unbreakable lock.
- New shapes: `RoomContentEntry.isExit`, `RewardEffect.grantTorchesRoll` (a rolled torch grant, vs the Wonders column's flat `grantsTorches` `ItemEffect`), `SegmentsColumnResult.floodgate`.
- Its printed Armor table is byte-for-byte the shared `ARMOR_TABLE`, so unlike Pyramid there's no deviation to note.

### Laboratory (#30, rules 2230-2336)

The 6th Deadly Dungeons type, and the only one whose Special Rule fires on **leaving** — "any hero or creature that leaves this dungeon will mutate." See [character.md](character.md) for the Mutation table.

**A fourth Reward column.** Laboratory prints Treasure/Wonders/**Potions** where every other type prints Treasure/Wonders/Magic Item, so `RewardEffect.rerollColumn` widened to include `"potions"` and `DungeonTypeTables.potions?: Record<1-6, PotionEntry>` is new. `resolvePotion()` is its own resolver rather than being squeezed into `resolveWonder()`'s trinket-or-HP shape — every row is drunk on the spot, which is exactly why an Ogre sells it instead. Its `magicItem` table is required but unreachable by construction (nothing in its own tables redirects there), so it falls back to the Palace's, as its `weapon` column already does.

Its Room column is the notable table shape — it produces large halls, then corridors, then staircases, never a room.

## Dungeon names

The Expanded World's **3d6 dungeon-name table** (rules 1002-1024) replaces the Core Book's two 1d6 columns: `DUNGEON_NAME_PART2`/`PART3`/`PART4`, 16 rows each, indexed **3-18** — which is the detail that matters, since it means each column needs its own 3d6 total rather than one die. `ROLL_DUNGEON` carries `nameRolls: [number, number, number]` (three totals, not three dice); `DungeonScreen` rolls and animates 1 type die + 9 name dice.

The format puts the type *inside* the name — `composeDungeonName()` strips `DUNGEON_TYPES[n].name`'s leading "The " so Part 2's own article leads instead, giving "The Cursed Palace of the Frost Queen" rather than "The Cursed The Palace…". 4,096 combinations against the old 36.

The Core Book's `DUNGEON_NAME_SECOND`/`THIRD` are **kept, not deleted** — names persist on `PendingDungeon` as plain strings, so old saves keep theirs and those tables remain the honest record of what produced them.
