# The world map

Hexcrawl, travel, locations, events, portals, the Other Worlds, and climate.

Primary files: `src/engine/hexState.ts`, `hexReducer.ts`, `events.ts`, `portals.ts`, `locationEffects.ts`; `src/data/hexTables.ts`, `events.ts`, `otherWorlds.ts`, `locationEffects.ts`, `cityNames.ts`, `affinity.ts`; `src/ui/screens/WorldScreen/`.

## Model

`hexState.ts` models the map as a sparse `Record<string, HexTile>` keyed by `hexKey({q, r})` (axial, pointy-top), populated 6-at-a-time by `revealNeighborsInPlace()` on entering a new hex. `createInitialWorldState()` fixes the start at `{0,0}`, a human city on a plain.

`hexReducer.ts` is its own small state machine (`MOVE`, `STORM_RELOCATE`, `ASK_FOR_DUNGEON`, `HIRE_BOAT`), validated against `hexNeighbors()`, `isImpassable()`, Affinity and `bannedHexes` before mutating `player`/re-revealing neighbors.

`WorldScreen.tsx` renders the map as SVG. `App.tsx`'s `Screen` is `"world" | "dungeon"` (plus gated Character Creation); `world: WorldState | null` persists across characters.

**`WorldState` means "the map you're standing in"** — see Other Worlds below.

## Travel

**Provisions** are parallel to torches but a separate resource: `MAX_PROVISIONS` (20), `canBuyProvision`/`buyProvision` (1 coin), and `payTravelCost()`, which spends provisions first; any shortfall costs a flat 1 HP, **floored so running out alone can never kill the character**.

Travel cost resolution order in `WorldScreen.tsx`'s `handleTravel()`:

1. `resources.flyActive` — a true unconditional free move, checked before everything else (see [character.md](character.md)).
2. Elven Boots / Animal overrides (`animalTravelCostOverride()`, cheapest applicable wins; Griffin short-circuits even Elven Boots).
3. The Mammoth penalty (`animalTravelCostPenalty()`).
4. The Pandakhan/Centaur multiplier (`travelCostMultiplier()`).
5. The Hireling surcharge (+1 provision per move while employed).

**`arriveAt()`** is the extracted shared tail of both `handleTravel` paths (Fly and ordinary), which had been duplicated line-for-line. Location entry effects, the Event roll, realm hazards and `showTown` resetting all happen there.

### Affinity (#20 Stage 1, rules ~928-1089)

`src/data/affinity.ts`'s `hasAffinity(raceName, location)` implements "Table: Affinity" (14 rows, `DEFAULT_AFFINITY` fallback) — **a race with no Affinity can't even travel there** (`hexReducer.ts`'s `MOVE`, folded into `WorldScreen.tsx`'s `canTravelTo()`; `HexInspector` explains "You are not welcome here").

**No-Affinity map indicator** (#81): a hex the character's race has no `hasAffinity()` for gets a dashed `var(--danger)` outline on the hex polygon (all four corners were already claimed by other badges), overridden by the gold `isPlayer`/`isSelected` outlines.

### Hire Boat

`WorldState.hasBoat` (a `HIRE_BOAT` action, must be in a City/Fortress adjacent to water). `isImpassable()` takes it as an optional param; `MOVE` clears it the instant the player lands on non-water terrain.

### Map zoom and pan

`src/ui/hooks/useZoomGesture.ts` is a shared gesture-_detection_ hook (wheel + pinch → `onZoom({factor, clientX, clientY})`) used by both `DungeonMap` and `WorldScreen`, applied completely differently by each — `DungeonMap` uses CSS `transform: scale()` on `.canvas` clamped `[0.5, 2.5]`; `WorldScreen` resizes/repositions the SVG `viewBox`, clamped ~4 hexes to 1.5x natural fit. Both get click-drag panning via `DungeonMap`'s `didDrag` pointer-capture pattern.

`useZoomGesture` re-runs its attach effect on **every render** (not gated on `[ref]`) since `WorldScreen`'s `<svg>` doesn't exist until the map view first appears.

## Cities and towns

**Town is not a distinct `App.tsx` screen** — `TownScreen` is a hex-generic component `WorldScreen` renders in full (map hidden) whenever standing on any City/Fortress hex, home included. `WorldScreen` computes and hands down `hasDungeon`/`dungeonGateCopy`/`onEnterDungeon` for the current hex and `onExploreWorld`.

### Entering is an act, not a side effect (#122)

The flag used to be `showMap`, defaulting `false` and reset to `false` on every arrival — so travelling onto a city, creating a character (who lands on home), or returning from a dungeon all dumped the player into the Town Square with no chance to see the map.

It's inverted now: **`showTown` defaults `false`**, `arriveAt()` resets it `false`, and `HexInspector`'s **"Enter City"** button is the only way in. The name change is load-bearing — "am I _in_ the city" is the question the default now answers, where `showMap` read as "am I _voluntarily_ looking at the map."

- **One fixed label, always "Enter City"** — including at a Fortress, and including after the player has already been inside this visit. Confirmed as the ask; the old "Return to the City" described a player standing inside looking out, which is no longer the situation.
- **A city's dungeon gate lives in `TownScreen`**, and `HexInspector`'s own "Enter Dungeon" is passed `canEnterDungeon && !inCityOrFortress`, so the two are mutually exclusive by construction. Consequence: a City/Fortress dungeon is one click further in (map → Enter City → Enter Dungeon). Three e2e specs seed a `humanCity` hex and had to gain that click.
- **A portal that deposits you in a city (rolls 9/10) also stops at the map** — nothing sets `showTown`, so this falls out of the default rather than needing its own case.

### Exit returns you to where you entered from (#133)

A player-reported consequence of #122. `showTown` defaulting false on every remount meant a dungeon entered from the Town Square _exited to the map_, leaving the player outside a city they never left — broken for both a City/Fortress's own dungeon and the Sewers beneath a Fortress, while a Ruins dungeon (entered from `HexInspector`) was correctly unaffected.

`App.tsx`'s `enteredFromTown` records the entry path and seeds `WorldScreen`'s initial `showTown`. **It can't be derived from which handler fired** — `onEnterDungeon` is reachable from the town gate _and_ from `HexInspector` — so `WorldScreen` passes it at each call site (`onEnterDungeon(true)` for `TownScreen`, `(false)` for `HexInspector`); `onEnterSewers` is town-only by construction.

Deliberately excluded: a portal-created no-exit run (belongs to no hex, so `onEnterNoExitDungeon` clears it) and death or a fatal Laboratory mutation (both route through `handleNewAdventurer`, which clears it so the flag can't leak into the next character). **This does not weaken #122** — entering a city is still deliberate; it just already happened, before the descent.

**`arrivalNote` needed a `TownScreen` surface** as a direct consequence. It had only ever been passed to `HexInspector`, inside `WorldScreen`'s map branch, so once a town-entered dungeon returned to the Town Square a Laboratory beneath a city would have announced a _permanent mutation_ into a panel the player was no longer looking at. `TownScreen` takes `arrivalNote` and renders it with no `isInspectingCurrentTile` guard (unlike `HexInspector`'s copy), since it only ever renders for the hex the player is standing on.

### City/Fortress names (#49)

`HexTile.name` (optional, back-compat) fixes "every Human City looked the same" — `rollCityName()` combines two 1d6 rolls from a per-culture `src/data/cityNames.ts` table into a compound word, rolled inside `revealNeighborsInPlace()` **atomically with the hex's location**. Home is the one exception ("Haven," fixed not rolled).

Surfaced in the map hex label, `currentPlaceLabel` (dungeon gate copy prefix, Graveyard "place" field), `HexInspector`'s `cityName` prop, and `TownScreen`'s header (city name as the prominent heading, "Town Square" demoted to an eyebrow).

### A new character starts somewhere their race is welcome (#78)

`createInitialWorldState()`'s fixed Human-city `home` is correct for every race except Orc/Ogre (`RACE_AFFINITY`'s only `human: false` rows) — an Orc/Ogre who ever left Haven could never travel back, a guaranteed one-way loss of their starting city.

`findOrRevealCompatibleHome(world, raceName, rng)` (called by `handleCharacterCreated` whenever `!hasAffinity(...)`) searches the already-revealed map first (`findCompatibleCity()`, nearest City/Fortress with matching Affinity), then generates new territory outward ring-by-ring (`MAX_HOME_SEARCH_RINGS = 20` safety cap, falling back to `world.home`).

**`world.home`'s own meaning is untouched** — only _where this one new character gets placed_ changes.

## HexInspector

The map's equivalent of `RoomInspector` — a `.hexInspectorOverlay` card describing the selected hex. Clicking a hex travels immediately if it's a valid neighbor; it only falls back to selecting-for-inspection (`selectedHex`) otherwise.

Every current-tile action lives here, each combined internally with `isCurrentTile`: Enter City, Enter Dungeon (#59, non-City/Fortress hexes), Train an Animal, Build a Building, Recruit Troop, Cast Fly, storage deposit/withdraw, Effect of the Forgotten Gods, and Return to the City (#89, previously its own `.actionCard` in `WorldScreen.tsx` outside this panel entirely).

`inCityOrFortress` and `canEnterDungeon` are mutually exclusive by construction, so at most one of those two action rows ever renders.

## Dungeons on the map

### Terrain-based Dungeon Type

`DUNGEON_TYPE_BY_TERRAIN` (`src/data/hexTables.ts`) maps terrain to a 1d6 table of dungeon types, per the rulebook's real "Table: Dungeon Type (1d6, by terrain)." It reaches all built types — Mountain 4 → Citadel, Desert 5-6 → Pyramid, Tundra/Glacier 5-6 → Ziggurat, Swamp 6 → Necropolis, Swamp 5 → Sewers, Forest 5 → Laboratory, and (since #138) Mountain 5 → Mine with Mountain 6 / Forest 6 → Cave. Nothing is thematically substituted here any more.

`App.tsx`'s `onEnterDungeon` rolls the hex's terrain-fated type once, stored as `forcedTypeRoll`; `handleRollDungeon` uses it for just the first of 3 dice.

### The Ruins 2d6 table

`RUINS_DUNGEON_TYPE` is genuinely different from `DUNGEON_TYPE_BY_TERRAIN`: 2d6, banded rows, its own spread, and columns for exactly the four terrains `LOCATION_TABLE` puts Ruins on (Plains/Mountain/Forest/Tundra — no Swamp/Desert row is needed). `App.tsx` uses it for a Ruins hex and the terrain table for everything else. Its 2-4 band is Cave on every column since #138; the remaining substitutions name Entrails and the Mega Dungeon, which #139/#140 haven't built.

**Unique dungeons** ("once you put one on your map it can't appear again — if rolled again, roll again") are tracked by the **notional rulebook type** (`UniqueDungeonKey`: `"entrails"`/`"megaDungeon"`) on `WorldState.uniqueDungeonsPlaced`, _not_ by the substitute currently built for it. That distinction is load-bearing: Plains 12 (Entrails) and Plains 10-11 (Pyramid) currently share a `typeRoll`, so attaching the rule to the substitute would silently lock Pyramid out of the entire world. `rollRuinsDungeon()` owns the bounded re-roll. There's a test asserting exactly this.

### Per-hex dungeon persistence

`HexTile.dungeonRunId` remembers which `PendingDungeon` was found on a hex — set once on first entry, never cleared. `onEnterDungeon` checks the current tile first; if set, it just selects that run (the existing `isOwnRun` derivation picks `RETURN_TO_DUNGEON` vs `RESUME_DUNGEON`). On a first visit the run id is minted in `App.tsx` (`worldFreshRunId`, passed as `externalRunId`) rather than `DungeonScreen` self-minting, since World needs the id up front to stamp the hex immediately.

`dungeonGateCopy` comes from `dungeonInfoFor()` (`dungeonHistory` + `isDungeonBeaten()`/`hasUnlootedRemains()`); ⚔/✓ and 💀 map badges render independently. **A hex's dungeon, once drawn, stays that hex's dungeon for good** — no re-roll action exists.

**The stamp and `dungeonHistory` can desync, and used to do so permanently** (#123, player-reported). The stamp is written at _click_ time, before the run has rolled anything, so backing out of the pre-roll gate left the hex pointing at a run `handleLeaveDungeon` had just discarded for having no levels. Every later visit then resolved that id to neither `activeDungeon` nor `resumeDungeon`, and `DungeonScreen`'s mount initializer fell through to its `crypto.randomUUID()` arm — rolling a fresh dungeon under an id the hex never learned, forever.

Two halves fix it, and both are needed:

1. `handleReturnToTown` calls `withoutRunIdStamp()` when `levels.length === 0` (**prevention**).
2. `isResolvableRunId()` treats an unresolvable stamp as a first-time find so the next roll re-stamps over it (**repair**, which is what heals already-broken saves).

`sewerRunId` is the same code shape and got the same treatment — `withoutRunIdStamp()` clears whichever of the two slots holds the id.

**Why the un-stamp lives in `handleReturnToTown` and not the unmount cleanup**: `DungeonScreen`'s cleanup guard (`stateRef.current.levels.length > 0`) is load-bearing beyond "don't save an empty run" — under `StrictMode` that cleanup also runs once on _mount_, against the initial state. Hanging the un-stamp off it wiped the stamp of every dungeon on the way in. A real click handler can't double-fire; an effect cleanup can.

### Two dungeons on one hex (#99)

"A Fortress may also have an extra dungeon to explore: roll a die, on a 3 or more it has Sewers under the fortress" — the only place the rulebook puts two distinct dungeons on the same hex.

`HexTile.sewersRoll` is rolled **once, when the Fortress is first revealed** (alongside its `rollCityName()`, the same "settle everything about a hex the moment it exists" precedent), so it's a fixed fact rather than something re-rolled per visit. `hasSewersBelow()` is the only reader, defaulting a pre-#99 hex to _no_ sewers rather than rolling late.

`HexTile.sewerRunId` sits **alongside** `dungeonRunId`, not instead of it, and `App.tsx`'s `onEnterSewers` stamps that one and forces the Sewers type roll directly (the rulebook names the type, so `DUNGEON_TYPE_BY_TERRAIN` is bypassed). `dungeonInfoFor()` was split: `runInfoFor(runId)` describes one run, and the hex-level helpers call it for each of the two. `TownScreen` renders a second gate, "Descend into the Sewers."

### "Ask"

"Roll 1d6 … dungeon appears in that hex; if Water/City/Ruins, go clockwise to the next hex until land with no location."

`HexTile.dungeonMarked` is a separate flag from `dungeonRunId` because it draws the dungeon on the map _before_ the player has traveled there or a `PendingDungeon` exists (that still only happens once "Enter Dungeon" is later used). `findAskedDungeonHex()` walks `HEX_DIRECTIONS` clockwise from a rolled side across the current hex's six neighbors; `withDungeonMarked()` mirrors `withDungeonRunId()`.

`hexReducer.ts`'s `ASK_FOR_DUNGEON` no-ops outside a City/Fortress or if any neighbor already has `dungeonRunId`/`dungeonMarked`. `dungeonInfoFor()` gained a fourth status, `"found"` (marked but no run yet), distinct from `"unfinished"` (a run exists) — same ⚔ badge, different copy.

### Records and locating

`RecordsPanel` (`src/ui/components/RecordsPanel/`) is a tab switcher between `Graveyard` and `DungeonsList`, shown only once _both_ have at least one entry; with just one populated, that one renders directly, no tab bar.

`sortDungeonsForDisplay()` (`dungeonState.ts`) stably sorts unfinished-before-cleared, preserving whatever secondary order it's handed — `WorldScreen.tsx` pre-sorts by hex-distance from `world.player` (`findHexForRunId()` + `hexDistance()`); `CharacterCreationScreen` reverses its own raw history for recency.

**Clicking an entry never warps or travels to it** — its optional "Locate" button (#79) only shows where it is on the map, reusing `findHexForRunId()` then the same `showMap`/`selectedHex` state a direct map click drives. A portal-created run has no hex, sorts last, and can't be located.

**A hex-tied dungeon is resumable only by physically traveling back to its hex** — no shortcut exists, including for the current character's own active run. An earlier "Continue the Dungeon" shortcut was removed (#44) as contradicting the intended design.

## Location entry effects and the Ruins table (#98)

Rules 898-907 and 1073-1090. Arriving at a special hex now rolls something. `src/data/locationEffects.ts` + `src/engine/locationEffects.ts`:

- **Oasis** — 1d6: 4 or less a mirage, 5-6 recovers all lost HP.
- **Thin Ice** — a 1 kills outright, no survival clause (the second such effect after Magma; `causeOfDeath: "thin-ice"`).
- **Reef** — a 1 runs you aground for 1 provision, a 2 does nothing (the rulebook's own gap), 3+ finds an Underwater Cave. **The one entry effect unreachable on foot** — it only generates on water, so it needs a hired boat, and is covered by engine tests rather than a browser run for that reason.

Fired from `arriveAt()` and **mutually exclusive with Events on Travel by construction**: an Event only rolls on a hex with _no_ location, and every one of these has one.

**Volcano is still absent from `LOCATION_EFFECTS`** — its entire rulebook content is "Has a Volcanic Cave," which is a dungeon, not a roll. It used to need a read-only `HexInspector` line explaining why you couldn't go in; since #138 built the Cave family, both it and a Reef lead into a real dungeon via `LOCATION_FORCED_DUNGEON_TYPE`, and `LOCATION_EFFECT_NOTES` is now empty. Reef is the one location with **both** an entry roll and a dungeon underneath it.

## Events on Travel (#91, rules 908-926)

"Whenever you enter a hex that doesn't have a location, roll 2d6. If it's 7 or more, nothing happened." The last unbuilt piece of the hexcrawl, and the thing several already-shipped abilities were silently waiting on (Camouflage, Star Stone, Elf Ranger, Patovsky, Fly's second clause).

- **A band lookup, not a per-total table.** The printed columns are outcome _bands_ ("Result 2", "Result 3 or 4", "Result 5 or 6"), so `EVENT_TABLE` is `Record<Terrain, Record<EventBand, EventRow>>` with `EventBand = 2 | 34 | 56` and `eventBandFor(total)` mapping into it (`null` for 7+, which never reaches the table).
- Monster rows reuse `MonsterTemplate` unchanged; non-monster rows carry a typed `EventEffect` (`loseProvisions`/`loseHp`/`moveToRandomHex`/`instantDeath`) rather than free text. **`EventRow.text` is deliberately narrative-only**: the rulebook's parenthetical mechanical clause is dropped, since `applyEventEffect()` reports what was _actually_ lost (which differs once flooring applies) — otherwise the panel read "you lose 2 HP. You lose 2 HP."
- **`src/engine/events.ts` is its own module** because an Event can touch `AdventurerResources`, `WorldState`, _and_ kill the character, so no existing reducer owns it.
- **Nothing is spent or applied until the player chooses** — that window is the whole point, since both avoidance abilities are reactive. `EventPanel` has three stages: _choice_ (Fight/Continue, plus Camouflage and Star Stone when available), _fight_, and _resolved_. It takes the overlay slot outright while pending (`.eventOverlay`, dimming the map) rather than sitting in `HexInspector`, because it genuinely interrupts.
- **`resolveEventRound()` takes the caller's `rawRoll`**, not one it rolls itself — the same split `PLAYER_ATTACK` uses, because `EventPanel` animates that die and the value the player watches land has to be the one that resolved. (Arena can roll internally precisely because `TownScreen` renders its fight un-animated.)
- **A 7+ result is deliberately silent** — it's the common case and a "nothing happened" line on most moves would be pure noise. A _suppressed_ Event (Patovsky/Elf Ranger) instead sets `eventNote`, a quiet read-only `HexInspector` row, so the ability stays legible.
- **Storm gets its own `STORM_RELOCATE` hex action** rather than reusing `MOVE`, whose adjacency guard would reject a non-neighbor destination. It draws only from _known_ tiles (inventing new territory would let a storm reveal land the player never explored) and still honors impassability/Affinity/`bannedHexes`, so a storm can't beach the player somewhere they could never legally stand.
- **A wilderness fight can be fled** (`fleeEvent()`), costing one provision and free when you have none — so it's never the provisions that trap you. Deliberately an addition rather than a transcription: the rulebook says nothing about avoiding a travel encounter, and the justification is that the encounter itself is mandatory. **A fight you can neither avoid nor leave isn't a decision.**
- **Loot's two definitions**: the Events section's footnote says "1d6-1 coins," but the Monster Abilities table's own canonical Loot row (rules 239) is the 6/5/else split `rollLoot()` already implements everywhere else. One definition beats two, so the canonical one wins — a documented call, not a transcription slip.
- Since #120, `EventPanel` keeps only what's Event-specific and renders `CombatPanel` for the fight itself, so the wilderness offers exactly what a dungeon room does. See [dungeon.md](dungeon.md).

## Portals (#21, rules 1091-1116)

Stepping onto a `location: "portal"` hex and rolling 3d6 on "Going through the Portal." Stage 1 built the 12 outcomes resolvable on a single map; #105 made all sixteen reachable — `rollPortal()` no longer re-rolls, `establishedPortal()` no longer refuses a world total (a portal that led to Hell keeps leading to Hell), and `PortalRoll.skippedWorlds` is vestigial.

- **A portal is fixed geography, not a slot machine**: "once you've established where a portal leads, you don't need to roll again for it" — `HexTile.portalTotal` remembers the settled 3d6 total forever, and `establishedPortal(total)` replays it. This is also the handle that makes every rare outcome testable without controlling `Math.random`.
- **`src/engine/portals.ts` is its own module** for the same reason `events.ts` is: an outcome can rewrite `WorldState` wholesale, move the player, credit coins, send them into a dungeon, or end the character. `resolvePortalOutcome()` deliberately does _not_ stamp `portalTotal` — the caller does, because a `newMap` outcome discards the very tiles the stamp would be written into.
- **Reveal, then apply**: `handleEnterPortal` only _shows_ the roll; `handleStepThroughPortal` applies it. Not a choice (the `ConfirmDialog` already covered "no turning back" and the dice have fallen) — an acknowledgment. This shape keeps application in an event handler: the earlier design applied on mount via a `useEffect`, which is a genuine setState cascade (ESLint's `react-hooks/set-state-in-effect` flags it), and it lets the no-exit dungeon's arrival portal seed itself through `useState`'s lazy initializer instead.
- **The panel is a viewport-level modal**, rendered in _both_ of `WorldScreen`'s branches (`.portalOverlay`, not the map-scoped `.eventOverlay`). Rolls 9/10 deposit the player inside a City/Fortress, which flips the whole screen to `TownScreen` — an overlay living in the map card unmounted mid-outcome, the exact failure Warfare's own lifted `attackMessage` already documents.
- **New `hexState.ts` helpers**, all reusable beyond portals: `withPlayerMovedTo()` (arbitrary non-adjacent move + neighbor reveal, since `MOVE`'s adjacency guard would reject it), `findNearestTown(world, from, humanOnly)` (searching only _revealed_ tiles), `withAllCitiesRazed()`, `withNewReality()`, `withPortalTotal()`.
- **`WorldState.plainsRevealAsWater`** (roll 13) is a curse on _future_ generation only — "whenever you reveal a Plain," not "every plain becomes water" — applied inside `nextTerrain()`, the one chokepoint every newly-revealed tile goes through. It survives `withNewReality()`: the curse is on the traveler's eyes, not any one world.
- **Roll 15 chains.** A doorless golden room's only exit is a second portal, so the coins are credited and `applyPortalRoll` recurses on a fresh roll (bounded by `MAX_PORTAL_CHAIN`, resolving against the state the previous outcome produced rather than the stale props the render closed over).
- **Roll 7's exit-less dungeon** is the one outcome needing `DungeonScreen`: `DungeonState.noExit` withholds "Retreat to Town" entirely until the Boss falls, and the victory panel then offers "Step through the Portal" (`onExitViaPortal`) instead of "Return to Town", which banks the run and arms `WorldScreen` to roll another portal on arrival. Deliberately **not** a hex-tied run — nothing stamps a `dungeonRunId`, so it never appears on the map and can't be resumed by traveling, which is the honest reading of "no door to exit."
- **Rolls 11/14 need a destination**, so `resolvePortalOutcome` returns `awaitDestination` and moves nothing; the panel lists every revealed, passable hex (nearest first). Bounded to known geography for the same reason `findNearestTown` is. **A Thug-Life-banned hex deliberately _is_ offered**: that ban is about being turned away at a gate, and arriving by portal isn't that. Roll 14 (the Slimemen's cloud city) is mechanically the same picker with different framing — no cloud-city hex is modeled, a documented simplification.
- **Deliberate calls**: roll 6 spares the player's own `building`s (they aren't `LocationKind` cities, and razing someone's Castle as a side effect of a roll the rulebook doesn't mention would be a harsher rule than it states); roll 12 keeps `AdventurerResources.buildings` even though the hexes are gone, so the Boss-kill tax survives rather than silently confiscating an investment; rolls 9/10 with no qualifying city on the revealed map simply fail ("the portal spits you back out where you stood") rather than stranding the player or inventing a city.

## Other Worlds (#105, rules 1119-1290)

The four realms a portal can strand you in — Hell, the Underworld, Pesadelum, Candy World. Each is _"a new map, using the tables below"_: its own Terrain (1d6), Location (1d6) and Event (2d6) tables in `src/data/otherWorlds.ts`, sharing none of the overworld's data.

### Scoped to survival

Confirmed with the user. Terrain, locations, events, hazards, per-world rewards and portals home are real; **dungeons, Buildings, Politics, Warfare, Ask and Animal training are overworld-only** — you're a visitor.

That isn't squeamishness: `HexTile.dungeonRunId`, `bannedHexes` and `politicalStatus` are all keyed by a bare `hexKey`, so two realms' `"0,0"` would silently collide. One `inRealm` flag in `WorldScreen` gates every one of them, and `App.tsx`'s dungeon handler re-checks independently (reducer decides, UI mirrors).

### State shape

**`WorldState` still means "the map you're standing in"** — that's what kept all ~22 of its consumers working untouched. `realm` says which one, `stashedRealms` holds the others' `tiles`/`player`/`home`/`hasBoat`, and `switchRealm()` swaps them. Returning to a realm puts you back exactly where you left it.

`climate`/`bannedHexes`/`politicalStatus`/`plainsRevealAsWater` deliberately **aren't** stashed — they belong to the traveller or the overworld.

**`Terrain` split into `OverworldTerrain | RealmTerrain`** rather than simply widened, so the overworld-only tables (`EVENT_TABLE`, `DUNGEON_TYPE_BY_TERRAIN`) stay exhaustive over exactly what they can see instead of growing meaningless Magma and Caramel Plain rows. `isOverworldTerrain()` is the narrowing predicate; the compiler found every site that needed to declare which case it was in.

Three of the four realms **reuse** ordinary Mountain/Plain/Water/Swamp for their mundane hexes — that's the rulebook's own choice, and it means travel cost and passability already worked for them.

### Generation

`revealRealmNeighborsInPlace()` differs from the overworld in two real ways: terrain doesn't depend on the neighbouring hex's terrain (the realm tables are flat 1d6 lookups, not a from-this-terrain matrix), and a location is rolled **unconditionally** — the overworld first rolls "is there anything here?" and only consults its table on a 6. Magma is the exception the rulebook names: "There are no locations here."

### Terrain hazards

Fire on arrival, **before** the realm's own Event roll, because Magma can kill you first:

- **Magma** — 6d6, the only HP cost in the game with **no survival floor**. The rulebook gives it no clause, and a realm that can kill you is the point.
- **Sea of Blood** — 3 damage plus a shove to a random adjacent hex.
- **Plain of Thorns** — 1 damage.
- **Forest of the Impaled** — a 1-in-6 "catatonic," read as **losing your next move** (`AdventurerResources.catatonic`), confirmed with the user, since a 1-in-6 instant death on terrain a Sea of Blood can shove you onto would be brutal.

### Realm cities

They're in `CITY_OR_FORTRESS`, so `TownScreen` renders and Rest and Buy work while stranded — "City of Survivors (like Human City)" is meant to be refuge. But they deliberately have **no `CULTURE_BY_LOCATION` entry**: culture drives hireling rosters and Culture Actions, neither of which exists in Hell, and `hirelingsFor(undefined)`/`cultureActionFor(undefined)` both degrade to nothing. `affinity.test.ts` asserts both halves of that invariant.

### Per-world rewards

`applyRealmVictoryReward()`, matched on monster _name_ per the usual no-taxonomy convention:

- **Hell** — the Demon Lord/Infernal Baron grant 1d6 Palace Magic Items as sellable `HeldItem`s, since `resolveMagicItem()` operates on a `DungeonState` draft that doesn't exist out here. The Baron's death calls `withPortalHere()`, the only place a hex _gains_ a location mid-play.
- **Underworld** — beating Death unlocks any hex in any world.
- **Pesadelum** — the Tentacle drops the **Dream Potion** (`reverseHp()`: 34 → 43, capped at `maxHp`; single digits reverse to themselves).
- **Candy World** — rolls its own 2d6 Treasure per monster killed. The rulebook prints only rows 2-6, so 7+ grants nothing, matching every other 7+ row rather than inventing five rewards.

### Documented simplifications

The Dracolich's "D8" is flattened to 4 (every `MonsterTemplate` carries a flat `damage`); the ancient soul's "resurrect when he returns to the world of the living" pays out immediately as a full heal + 50 coins, since there's no NPC-follower concept to carry; Underworld's Dense Fog is modelled as a location, and its "spend 1 provision to wait for it to dissipate" clause is what makes it _conditionally_ impassable unlike Rocks.

## Climate transitions (#107)

One world contains both bands, so travelling far enough changes the environment.

**Not a rulebook mechanic** — the rulebook prints Hot and Cold as two alternative tables for two kinds of continent (rules 854-874) and never describes a boundary inside one map. This is the project's own extension, same tier as `placeChild`'s collision-avoiding dungeon layout, and it exists because #101's world-scoping left 3 of the 10 built dungeon types (Ziggurat/Pyramid/Necropolis), 4 Animals, 2 locations, 4 Event rows and 1 Advanced Class (Hotep) unreachable in any given save.

- **Climate is a pure function of position** (`climateAt(coord, home, homeClimate)`), which is the whole reason this needed **no new persisted state**: nothing to migrate, no per-tile field, and two neighbours can never disagree about their own climate depending on which was revealed first. That reveal-order dependence is exactly what killed the per-tile-drift alternative. It also means **an existing save simply gains the other half of the map** rather than needing a hard reset.
- **`COLD_LATITUDE = 8` is a pacing number, not a rules one** (provisions cap at 20 and cost 1-3/hex, so ~8 is one full load in good terrain, a resupply in bad — confirmed with the user against a 5/8/12 spread). A hot world puts the temperate middle on home's own row with cold in **both** directions; a cold world puts home on a pole, anchoring the middle at `2 * COLD_LATITUDE` so home sits as deep inside its band as a hot-world home does rather than balanced on the edge of it.
- **`boundaryWobble(q)`** perturbs the threshold by ±2 via two summed sines — a pure function of `q`, no seed and no stored state, so the line reads as geography instead of the straight row of hexes a raw latitude test draws. There's a test asserting the first cold row genuinely differs across `q`.
- **`nextTerrain()` is now total**, which was prerequisite work rather than polish. Its lookup used to be safe only _by construction_ (every tile came from it against one fixed climate); with both bands in one map, a `swamp` parent read against `COLD_TERRAIN_TABLE` returns `undefined` — the `!` guards the roll index, not the terrain key — and that `undefined` would flow into a `HexTile.terrain` and on into `DUNGEON_TYPE_BY_TERRAIN`/`EVENT_TABLE`. A parent whose terrain has no column in the target band now resolves against **its own** band instead (`terrainBelongsToClimate()`), degrading to one extra hex of the old climate rather than an invalid tile. The four shared terrains (`plain`/`mountain`/`forest`/`water`) are what make a transition possible at all.
- **`revealNeighborsInPlace()` takes `climateOf: (coord) => Climate`**, resolved per _neighbour_ rather than one world-wide value — all five call sites (`withPlayerMovedTo`, `findOrRevealCompatibleHome`, `createInitialWorldState`, `MOVE`, `STORM_RELOCATE`) pass a `climateAt`-bound closure. `worldClimateAt(world, coord)` is the bound form.
- **`findOrRevealCompatibleHome()` is the one path that can already cross a boundary** — it expands up to 20 rings, well past `COLD_LATITUDE`. Deliberately left as-is: an Orc/Ogre whose nearest compatible city lies in the cold simply starts there, and per-neighbour climate keeps the terrain coherent on the way out.
- The map needed **no change** — `WorldScreen`'s terrain palette already had distinct glacier/tundra colours, so the transition surfaces itself. Realm terrain never reaches `nextTerrain()`, but the fallback is total for it anyway rather than only for every _reachable_ input.

**Climate is chosen once at Character Creation, and only when no world exists yet** (`needsWorldClimate={world === null}`), since `WorldState` outlives every character. It now means "which band home sits in," not "the whole map's climate."
