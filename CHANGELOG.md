# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.2.1] - 2026-08-05

### Changed

- Internal only — nothing in the game changed. The contributor guide (`CLAUDE.md`) had grown to
  roughly 21,500 words in one file, most of it a running history of how each system came to be.
  It's now a ~1,500-word guide covering the project, the commands, the shared conventions and the
  traps, with the full design detail moved into six topic documents under `docs/architecture/`
  (dungeon, world, character, town and economy, UI, and deferred work). Nothing was discarded: the
  detail was redistributed, and the split was verified by checking every code identifier from the
  original against the new set.

## [4.2.0] - 2026-08-05

### Changed

- **Every screen is now a single page that fits your window.** The World, City and Dungeon used to
  scroll — sometimes in three places at once — and the Dungeon was the worst of it: the map, the
  sidebar and the page itself could all scroll independently. Each screen is now locked to the
  window, with one consistent layout: the title over the left column, the main view beneath it, the
  character sidebar running the full height beside it, and the footer across the bottom.
  - **The dungeon fits.** The map sizes to the space it's given and pans by dragging, as it always
    did — it just no longer has a scrollbar competing with the page. **Recent Rolls is the only
    scrollbar left** on that screen, and it's capped so a long transcript can't push the map away.
  - **The sidebar is wider** — two fifths of the screen rather than a narrow column — and still
    scrolls when a character has more to show than fits.
- **The whole screen is a sheet of paper now**, not a dark page with parchment cards floating on it.
  The frame the City used for its character sheet wraps the main column on every screen, stacked
  edges and all — which is what this game actually is: a record sheet on a table.
- **Recent Rolls is readable.** Its text was still coloured for the old dark background and had
  become nearly invisible on parchment.
- Taglines under each title are gone, along with the Dungeon's "Ledger" panel and the "Breaking a
  door…" note — all of it repeating what the screen already showed.

## [4.1.0] - 2026-08-05

### Changed

- **Advanced Classes you can actually buy now sit at the top of the list** (#132). With 45 classes
  costing anywhere from 10 to 6000 coins, cost order alone scattered the handful you could act on
  through a very long list of ones you couldn't. The list is now grouped — **Available now**, then
  **Not yet**, then **Acquired** — still cheapest-first within each group, with a heading at each
  boundary so it's obvious where one ends and the next begins.
  - "Not yet" deliberately covers both "not enough coins" and "requirement not met", because both
    are things you're playing _toward_. Classes you already own sit below them: an achievement worth
    seeing, but nothing left to decide.

## [4.0.1] - 2026-08-05

### Fixed

- **Leaving a dungeon beneath a city drops you back in the city again** (#133) — you entered from the
  Town Square, and came out standing on the map _outside_ it, having to click "Enter City" to get
  back where you started. The round trip was broken for every dungeon reachable only from inside a
  town: a City or Fortress's own dungeon, and the Sewers beneath a Fortress.
  - The rule now is simply **exit returns you to wherever you entered from.** A dungeon entered from
    the Town Square returns there; a Ruins dungeon, entered from the map, still returns to the map.
  - This doesn't undo v3.1.0's change — entering a city is still always a deliberate act. You just
    already did it deliberately, before you went down the stairs.
  - A Laboratory beneath a city now tells you about your mutation in the Town Square. It was
    previously announced only on the map, so leaving one under a city would have told you nothing.

## [4.0.0] - 2026-08-04

A major version for a change of identity rather than of mechanics: the project is now **GerdQuest: Realm of Depths**.

### Added

- **The character sheet lists every class you have, not just the one you started with.** You can buy
  up to 45 Advanced Classes, each costing coins and a requirement, and none of them appeared anywhere
  on the sheet — so a Gravedigger's +2 against Undead or a Necromancer's Death Spells were invisible
  once bought. Each now gets its own line alongside your starting Class, with its ability text.
  Classes whose ability does nothing mechanical yet are marked "flavor only", the same way the
  purchase list already marks them.

### Changed

- **The project is renamed to GerdQuest: Realm of Depths** (#113). "NoteQuest (Browser)" described what this started
  as — a transcription of one rulebook's dungeon crawl — rather than what it has become, with a
  hexcrawl, cities, politics, warfare, four Other Worlds and a pile of systems of its own. The new
  name is deliberately its own thing.
  - **Nothing about the credit changes, and that is the point.** GerdQuest: Realm of Depths remains an unofficial
    fan-made adaptation of NoteQuest by Tiago Junges, it is not affiliated with or endorsed by him,
    and the original is still very much worth buying. The old name did some of the crediting simply
    by existing; now that it doesn't, the explicit credit in the footer and the README carries all of
    it. A distinct name plus prominent attribution is a better posture than a borrowed name, because
    it can no longer read as though this might be official.
  - **Your save is untouched.** This is a display-name change only — the site URL is the same, and
    the browser storage your character, world map and Graveyard live in is deliberately unchanged.
    Nothing needs migrating and nothing is lost.

### Fixed

- **A hex could permanently forget its dungeon** (#123) — reported as "returned to town, tried to go
  back to the dungeon, it created a new dungeon." Entering a dungeon and then backing out of the
  "Roll for Dungeon" screen without rolling left the hex pointing at a run that had been discarded.
  From then on _every_ visit to that hex rolled a brand-new dungeon and immediately forgot it, so the
  hex could never be resumed again — and nothing on screen hinted anything was wrong, because by then
  you had genuinely played a dungeon there.
  - Backing out without rolling now leaves the hex exactly as it found it.
  - A hex whose dungeon can't be found is treated as an unexplored one and re-linked to whatever is
    rolled there next, so **saves already broken by this repair themselves** on the next visit rather
    than staying stuck forever.
  - The Sewers beneath a Fortress had the identical fault and is fixed the same way.

## [3.2.0] - 2026-08-03

### Added

- **Buildings can store your things** (#102) — the deferred half of #27. A House, Tower, Palace,
  Castle, City or Fortress is now somewhere to leave the items and potions you don't want to carry,
  which is the first real answer to a Pack that only holds ten things.
  - **Capacity is unlimited**, in every building, exactly as the rulebook has it — "you can store any
    number of items found in dungeons." What varies between buildings is not how much they hold but
    how well they hold it.
  - **Thieves.** Every time you come home from a dungeon, each building holding something rolls a
    die against its Defense; roll higher and a random item is gone. A House (Defense 2) loses
    something four times in six. A Castle (5) only on a 6. A **City or Fortress is never robbed at
    all** — a 1d6 can't beat Defense 6 — so the top of the table buys certainty rather than volume.
  - **What you store outlives you.** A successor inherits the vault along with the estate, the same
    reasoning #121 used for the buildings themselves.
  - **An enemy army takes it all.** If a Declared Enemy destroys one of your buildings (#28), what
    was inside is looted with it — which is what keeps a stash from being strictly safer than
    carrying.
  - Storing and taking happen at the building, on the map panel; the Town Square's "My Buildings"
    card shows what you left where. Potions can be stored too, since they share the same Pack slots.

## [3.1.0] - 2026-08-03

### Added

- **One world, both climates** (#107) — a world used to be hot _or_ cold, chosen once at Character
  Creation before you had seen anything, and that choice permanently locked out a large share of the
  game. In a hot world you could never reach a **Ziggurat** (and therefore never the Effect of the
  Forgotten Gods), never train a **Polar Bear** or **Mammoth**, never find **Thin Ice**, and never
  see the Yeti, Blizzard or Cracked Ice travel events. In a cold one you could never reach a
  **Pyramid** or **Necropolis**, never train a **Camel** or **Raptor**, never find an **Oasis**, and
  never obtain **Hotep** — so #62's "45/45 Advanced Classes" was really 44/45.
  - Climate is now a property of _where you are_, not of the save. Travel roughly 8 hexes north or
    south of your homeland and the land turns: tundra and glacier one way, swamp and desert the
    other. The boundary wanders rather than running in a straight line.
  - The Character Creation picker still matters — it now chooses which band your homeland sits in,
    rather than deciding the whole continent for every character who will ever live there.
  - **Existing saves gain the missing half of the map for free.** Nothing needs migrating and no
    hard reset is required; the cold (or warm) territory has simply been out there all along,
    waiting for someone to walk far enough. Land you have already explored is untouched.
- **"Your Hands"** (#100) — one hand holds your torch, so a two-handed weapon needs another source
  of light. This was the rulebook system that several already-authored things had been quietly
  waiting on, and building it turns all of them real at once:
  - **Two-handed weapons are actually two-handed.** `twoHanded` had been parsed, stored, threaded
    through every weapon-grant site and printed on the item card since the beginning — and never once
    checked. A Halberd now needs a free hand before you can wield it.
  - **The Dwarven Lamp does something.** The Dwarf city action promised "lets you use both hands in
    combat" and delivered a 40-coin keepsake. Carrying it now frees the torch hand for good.
  - **The Torchbearer has a real job.** Its roster entry read "None." even though the rulebook names
    _hiring someone to hold the torch_ as the first way around the rule. Ten coins, and your hands
    are free for the trip.
  - **The Light spell frees a hand, not just a torch slot.** "Worth a torch (does not use a hand)"
    was only ever half-implemented. The globe now does the torch's job until it's spent — and it's
    spent like a torch, on the next thing that costs one.
  - **A Blade Trap can take your arm.** The roll-of-2 had been flavor text for want of a hand economy
    to enforce it. It's permanent, no light source gives it back, and a two-hander you were holding
    goes into your pack on the spot.
  - Wielding stays unrestricted in Town — the rule is scoped to "when exploring a dungeon" — so
    anything you can't hold is benched on the way in rather than blocked at the shop counter. It
    waits in your spare weapons until you have a light, exactly like a weapon found underground.

### Changed

- **Cities are entered, not fallen into** (#122) — standing on a City or Fortress hex used to replace
  the map with the Town Square automatically, so travelling onto a city, rolling a new character, or
  walking out of a dungeon all dumped you inside with no chance to look at the map first. You now
  always arrive on the map, and go in through an "Enter City" button on the hex panel. Same button,
  same label, every time. A portal that drops you at a city stops at the map too.

## [3.0.0] - 2026-08-01

A major version because combat itself was rebuilt: there is now **one** combat engine, shared by
dungeons, the wilderness and the Arena, instead of three parallel implementations that quietly
disagreed about what a character is.

### Fixed

- **Wilderness encounters no longer strip your character** (#120) — an Event fight took only your HP
  and a weapon formula, so armor, spells, attack bonuses, magic-weapon effects, your Hireling, your
  Snake and your potions all silently vanished. That was inherited from the Arena, where it was a
  defensible choice because you _choose_ to enter. An Event fires unbidden and offered exactly one
  button, so a player was forced into a fight without the character they had built, and lost one to a
  Wyvern. A wilderness fight is now the same fight a dungeon room is.
- **A wilderness fight can be left** (#120) — there was no flee, no retreat, no way out at all. Now
  there's always an exit, costing a provision when you have one and free when you don't.
- **Survival abilities work outside a dungeon** (#120) — Samambro's resilience, a Raven's return and
  the zombie mutation never fired on the World map. They do now, everywhere.
- **The blade trap shows the die that kills you** (#112) — a 1-in-6 that ends the run was rolled
  silently inside the engine while a _different_ die animated on screen. It's shown now, like every
  other consequential roll in the game.

### Changed

- **Buildings outlive their builder** (#121) — a Castle stands on a world hex, and the world outlives
  every character, so a new adventurer now inherits whatever is already on the map, along with the
  Boss-kill tax it pays. Coins, troops and travel counters still die with you. Two players in a row
  saved for the late game and never reached it; this is the one thing that carries over.
- The Arena runs the shared engine too, so your attack bonuses, weapon effects and spells come with
  you into the pit. It keeps its own "you fight alone" shape — no Hireling — deliberately.

## [2.56.0] - 2026-07-31

### Added

- **A consumable inventory** (#110) — potions are no longer drunk the instant they're found. A Health
  Potion found at full HP, a Mana Potion with every spell untouched, a Potion of Luminescence at 10
  torches, and a Potion of Fury outside a fight were all simply wasted; they now go into your Pack, and
  you choose when to drink them. Covers the Health and Mana Potions, the Potion of Fury, the Potion of
  Luminescence, the Sewers' torch bundle, the Ziggurat's Addictive Sweet Drink and Strange Fruit, and
  the Laboratory's Luminescence Potion.
  - Potions share the Pack's 10 slots with sellable items, per the rulebook's "up to 10 items in your
    backpack" — so Cargo Ogre's 40 and Monkey's +1 apply to them too.
  - Drinkable anywhere: in a dungeon (consuming the combat round, exactly like casting a spell), in
    Town, and on the World map. A Potion of Fury is shown disabled rather than hidden where there's no
    fight to buff.
  - A fallen character's undrunk potions are left in their remains for a later adventurer to recover.
  - An Ogre still can't use potions and still sells them instead — that path is unchanged.
  - If your Pack is completely full when a potion is found, it's drunk on the spot rather than lost —
    the old behaviour, as a fallback rather than the rule.

## [2.55.0] - 2026-07-31

### Added

- **Selling armor and weapons** (#117) — `Equipment` gained a Sell button on every row: worn armor,
  spare armor, the equipped weapon and spare weapons. Neither carried a price before, which is why no
  sell path existed. Armor is worth its HP (a Breastplate 10, a Ring 1), reusing the same formula an
  Ogre's unusable-armor sale already used; a weapon is priced off its damage formula, so a Dagger
  (1d6-1) fetches 2 and a Halberd (1d6+3) fetches 6. Both stack with the Fortress and
  Cat-Person/Merchant multipliers exactly like a Pack sale. Selling the equipped weapon is safe — it's
  an override, so your class weapon takes back over.
- **Collector is real** (#103) — "Sell a piece of armor for 5 coins" now floors every armor sale at 5,
  so cheap pieces are worth more to a Collector while a Breastplate already worth 10 isn't
  double-counted.
- **Assassin is real** (#103) — "Deals 3 times damage on your first attack" triples the first weapon
  hit of each fight. Read as the first hit of the fight rather than against each monster, and it
  applies to a Rinoceroid's horn too, since it's the character's own training rather than a weapon
  effect. A paralyzed turn isn't an attack, so the opening strike survives it.

### Changed

- The equipped weapon's Equipment row is stacked rather than a single line, so name, damage and the
  new Sell button all fit in the sidebar.

## [2.54.0] - 2026-07-31

### Fixed

- **Hirelings healed to full at the start of every fight** (#114) — a Hireling's HP was re-derived
  from the roster table each time combat began, so one hire bought unlimited damage absorption for a
  whole dungeon trip. Its current HP now persists across fights and across a trip paused in Town;
  resting heals the character, never the hired help.
- **Magic item names showed a literal `[Armor]` placeholder** (#116) — an item's name is now
  substituted with the concrete piece it rolled, so "Centurion's `[Armor]`" is "Centurion's Boots."
  Weapons keep their own name too, instead of being renamed to the bare base weapon.
- **Equipment didn't say where armor was worn** (#116) — a named piece showed its name and nothing
  else, hiding which of the five body slots it occupied. Rows now read "Centurion's Helm (Helm)", and
  the worn-armor list has a heading of its own.
- **Found items vanished** (#109) — a Wonder with no mechanical effect (Goblin Whistle, Lamp,
  Salamander Potion, Potion of the Helping hand) was announced in the log and then granted nothing at
  all. It's now recorded in Curiosities.
- **The Dwarven Lamp could be bought over and over** (#109) — 40 coins and a Pack slot each time, for
  an item that is unique by definition. One per character now.

### Added

- **Curiosities** (#115) — a running tally of the odd things that have happened to you, on the
  Adventurer sheet next to Kills and opening the same kind of breakdown modal. A player finished a run
  with "4 arms and 3 tails" and had no way to look at it; now they do, and the Graveyard records it as
  an epitaph.
- **A "flavor only" marker on unimplemented Advanced Class abilities** (#111) — Ambidextrous,
  Multidextrous, Collector, Assassin, Ghostbuster, Cook and Emperor charge coins and grant their HP
  bonus, but their ability text describes something this app doesn't do yet. A player bought
  Ambidextrous and spent an evening hunting for a dual-wield control that was never built.

## [2.53.0] - 2026-07-31

### Added

- **The Laboratory** (#30) — the 6th Deadly Dungeons type, with its own Segments, Secret Passage,
  Trap, Room Content, Monsters, Reward and Boss tables. Its Room column is the notable shape: large
  halls, then corridors, then staircases, never a room. Reachable from Forest roll 5 and the Ruins
  2d6 table's 8-9 band on Plains and Forest, all three of which previously substituted a Palace.
- **Mutations** — the Laboratory's Special Rule: "any hero or creature that leaves this dungeon will
  mutate." A full three-column Mutation table (`src/data/mutations.ts`), rolled on the way out of a
  Laboratory run, with every mechanically-expressible outcome real: max-HP swings, a horn attack,
  immunity to Poison, and losing the ability to wear armor (or just boots). Recorded permanently on
  the character and shown on the Adventurer sheet.
- **The zombie mutation** — dying returns you at half your maximum HP, then half of that again each
  subsequent death, until halving reaches nothing. Honored at every death in the game, in a dungeon
  or out of it, and a mutation can now be a cause of death in its own right.
- **A Potions reward column** — the Laboratory prints one where every other type prints Magic Item.
  The Mutation Potion rolls the mutation table without waiting for you to leave; an Ogre sells any
  potion instead of drinking it.

### Fixed

- A Chest found through a Secret Passage was unopenable in any dungeon whose Secret Passage table
  words that row differently from the shared one — the check was exact string equality.

## [2.52.0] - 2026-07-30

### Added

- Arriving at a special hex now actually does something (#98):
  - **Oasis** -- roll a die. Four or less and it was a mirage; five or
    six and you drink your fill, recovering all lost HP.
  - **Thin Ice** -- roll a die. On a 1 the ice gives out and you drown.
  - **Reef** -- on a 1 you run aground and lose a provision; on a 3 or
    more you spot an Underwater Cave, though there's no way in yet.
  - **Volcano** now says what's down there (a Volcanic Cave) instead of
    being a bare label -- that dungeon type isn't built yet.
- Ruins use their own dungeon table (#98), which is quite different
  from the one every other hex uses -- so a ruin on the plains turns up
  a different spread of dungeons than the plains around it.
- Two dungeons in that table are unique: once one has appeared in your
  world, rolling it again rolls something else instead.
- A new Graveyard cause of death, "Fell Through the Ice."

## [2.51.0] - 2026-07-29

### Added

- Dungeons now use the Expanded World's richer naming table (#101):
  four parts instead of two, with the dungeon's own type sitting in
  the middle -- "The Cursed Palace of the Frost Queen". 4,096 possible
  names, up from 36. Dungeons you've already found keep their names.
- You can now choose a Frozen world (#101). The choice is offered once,
  when the world is first made -- every adventurer after you inherits
  the same continent. A frozen world finally makes glacier and tundra
  terrain, Thin Ice, and the Events table's Cracked Ice row reachable;
  all of it was written but unusable before.

## [2.50.0] - 2026-07-28

### Added

- Fortresses can have Sewers underneath them (#99). Every fortress
  rolls once, when you first find it, and on a 3 or more there's a
  manhole in the courtyard -- a second, completely separate dungeon on
  the same hex, alongside whatever the fortress itself holds. It's the
  only place in the rules where one hex has two dungeons.

## [2.49.0] - 2026-07-28

### Added

- The Sewers (part of #30): a new dungeon type under the fortresses,
  and the strangest one yet. There is no Boss and no Final Room --
  you finish a Sewer by finding the metal ladder and climbing out.
- Tunnels: long, dark stretches you can't see the end of. Monsters
  lurk in them, but there's nothing to find, and moving silently is
  twice as likely to give you away.
- Floodgates: doors that are always locked, never trapped, and cannot
  be broken down. Pick them, or find a key.
- Two cursed rewards -- Tetanus armor that costs you HP, and a Ring of
  Bad Luck.
- The last two Advanced Classes are now obtainable, closing #62 at
  45 of 45: Janitor (clear a Sewer) and Hotep (kill 3 mummies).

## [2.48.0] - 2026-07-28

### Added

- The Master key now works: it opens any locked door, in any dungeon,
  without spending a torch or a key -- and it is never used up (#95).
  An Ogre keeps it rather than selling it, since a key isn't armor, a
  potion or a scroll.

## [2.47.1] - 2026-07-28

### Changed

- Ran Prettier across the whole repo. The config and the `format`
  script were always there; they had just never been run, so any file
  anyone formatted picked up unrelated churn. Formatting only -- no
  behavior change, and `.git-blame-ignore-revs` keeps this commit out
  of `git blame`.

## [2.47.0] - 2026-07-28

### Added

- The four Other Worlds (#105): Hell, the Underworld, Pesadelum and
  Candy World. A portal can now actually send you to one -- the rows
  that used to be silently re-rolled are all live.
- Each world is its own map, generated from its own terrain, location
  and event tables, and remembers where you left it if you go back.
- Terrain that hurts: Magma (6d6, and it will not spare you), the Sea
  of Blood (3 damage and it throws you somewhere else), the Plain of
  Thorns, and the Forest of the Impaled, which can leave you unable to
  move for a turn.
- Each world has its own reward for killing the right thing: Magic
  Items in Hell (and a Portal where the Infernal Baron falls), the way
  home from anywhere for beating Death, the Dream Potion in Pesadelum
  (drink it to reverse your HP -- 34 becomes 43), and a candy treasure
  for every monster you put down in Candy World.
- A new Graveyard cause of death, "Died in Another World."

### Changed

- Dungeons, buildings, politics, warfare, Ask and animal training are
  overworld-only. You are a visitor in the other worlds -- though
  their cities still let you rest and buy.

## [2.46.3] - 2026-07-28

### Changed

- Finished the CI runtime upgrade started in 2.46.2: the deprecation
  warning survived it, because `upload-pages-artifact` is a composite
  action that calls the old `upload-artifact` internally. Bumped it
  and `deploy-pages` to v5 as well (#106).

No app behavior change.

## [2.46.2] - 2026-07-28

### Changed

- CI now uses the v5 majors of checkout, setup-node, and
  upload-artifact, which run on the Node 24 action runtime -- the v4
  versions targeted the deprecated Node 20 and were being
  force-upgraded by the runner, with a deprecation warning on every
  run (#106).

No app behavior change.

## [2.46.1] - 2026-07-27

### Changed

- The Playwright end-to-end tests now run in CI on every push and
  every pull request, instead of only when someone remembered to run
  them locally (#104). A pull request runs the full check suite but
  never publishes; only a push to main deploys.
- On failure, CI uploads the Playwright HTML report (with a trace) so
  a failure that only happens there can actually be diagnosed.
- CI pins Node 20.19 -- the version some devDependencies actually
  ask for -- rather than resolving to whatever the latest 20.x is.

No app behavior change.

## [2.46.0] - 2026-07-27

### Added

- Keys finally do something: a locked door now offers "Use a Key"
  alongside Pick Lock and Break Door -- it costs no torch and makes no
  noise (#95). The Master Key is still flavor-only.
- Selling in a Fortress pays double, per the rulebook. It stacks with
  a Cat-Person's or Merchant's own markup, so selling there as one
  pays quadruple (#94).
- Breaking a door is remembered, and noise now carries through a
  broken door into the next segment -- monsters over there are
  alerted, and get the first strike when you finally walk in (#96).

### Fixed

- The Ziggurat's Forgotten Gods damage bonus is no longer lost when
  you leave a dungeon and come back to the same run (#93).
- Entering a dungeon with no torches no longer left you on -1 torches
  and somehow still alive. The entry torch is now spent like every
  other one, and "Roll for Dungeon" is disabled when you have none,
  so you're turned back at the gate instead of killed on the
  threshold (#92).

## [2.45.0] - 2026-07-27

### Added

- Portals (#21, stage 1): a Portal hex can now be entered. Going
  through rolls 3d6 on the rulebook's "Going through the Portal"
  table -- there is no turning back, and a portal remembers where it
  leads once you've been through it.
- Twelve of the sixteen outcomes are live: vanishing from existence,
  a future where every city lies in ruins, a dungeon with no way out
  but the Boss's room, the nearest town or nearest human city, any
  hex you choose, a whole new reality, a world where every plain you
  find turns out to be water, the Slimemen's city in the clouds, and
  a golden room with 300 coins and a second portal in it.
- The four Other Worlds (Hell, Pesadelum, Underworld, Candy World)
  are written down but not yet reachable -- a portal that pulls
  toward one says so and searches again. They arrive in stage 2.
- A new Graveyard cause of death, "Vanished from Existence."

## [2.44.0] - 2026-07-27

### Added

- Events on Travel (#91): entering a wilderness hex now rolls 2d6, and
  on a 6 or less something happens -- a monster to fight, weather that
  costs you provisions or HP, a storm that carries you to another hex,
  or (on a glacier) the ice giving way. Each terrain has its own set of
  outcomes, straight from the rulebook's Events table.
- Event fights are real, interactive fights out on the World map,
  reusing the same combat rules as the Arena.
- Five abilities that were previously decorative now work, because
  there are finally Events for them to act on: the Camouflage spell
  (ignore an Event in a forest or swamp), the Star Stone (spend 1
  provision to reroll an Event), the Elf Ranger hireling and the
  Patovsky race (never have Events at all), and the second half of the
  Fly spell (a Fly move skips its Event).
- A new Graveyard cause of death, "Lost on the Road," for a character
  who dies to an Event.

### Changed

- Both travel paths (ordinary and Fly) now share one arrival routine
  instead of duplicating it, so they can't drift apart.

## [2.43.0] - 2026-07-27

### Added

- Deadly Dungeons (part of #30): 4 new dungeon types -- Citadel,
  Pyramid, Ziggurat, and Necropolis -- each with its own full set of
  Trap/Room Content/Monster/Reward/Boss tables, reachable via the
  World map's terrain-based dungeon roll (Mountain, Desert,
  Tundra/Glacier, and Swamp hexes respectively).
- Citadel and Necropolis bosses guard a bonus "Hallows" item the
  instant they fall.
- Necropolis's Boss is assembled from three combined dice tables
  (a modifier, a creature, and a second modifier) rather than a flat
  roll, per its own "Table: Boss."
- Ziggurat's "Effect of the Forgotten Gods" is a new standing action
  usable at the Ziggurat's own hex on the World map (1 provision,
  1d6 for a random effect: lightning damage, nothing, an Owl
  companion, a damage bonus for your next dungeon run, or a
  permanent HP boost).

## [2.42.0] - 2026-07-26

### Added

- Snake now actually fights: "Attack deals Poison" is a real free
  action ("Snake Attacks" in the Combat panel, once per round,
  alongside your own Attack) dealing its flat 1 damage to a monster
  -- reusing the same free-action pattern Hirelings got in #84,
  generalized to Animals for the first time (part of #29 and #67).

## [2.41.0] - 2026-07-26

### Added

- Goblin's race ability is now real: rolling a 1 on your damage die
  makes you explode, dealing 5 damage to every monster in the room
  instead of a normal single-target hit (confirmed with the user:
  monsters only, not the Goblin themselves, mirroring the Hireling
  Goblin Helper's own explosion) (part of #60).

## [2.40.0] - 2026-07-26

### Added

- The Fly spell (Advanced 6) is now castable -- "your next move costs
  no Provisions," armed by a new "Cast Fly" action in the World map's
  hex inspector and consumed by the very next move, bypassing every
  other travel-cost modifier (Elven Boots, Animals, race multipliers,
  Hireling surcharge) for a truly free hex (part of #61).

## [2.39.0] - 2026-07-26

### Added

- Monkey now has a real ability: "it can carry an extra item" raises
  the Pack's capacity by 1, stacking with Cargo Ogre's own raised cap
  (41 total, not 40) rather than replacing it (part of #67).

## [2.38.0] - 2026-07-26

### Added

- Raven now has a real ability: "if you die, roll a die -- 4 or more
  and you come back with 1 HP," reusing the Samambro race ability's
  exact death-survival mechanism at all 7 death sites (#67).

## [2.37.0] - 2026-07-26

### Changed

- Moved "Return to the City" from its own standalone card below the
  World map into `HexInspector`, alongside every other current-tile
  action (Enter Dungeon, Train an Animal, Build a Building, Recruit
  Troop) -- it now lives right next to the Dungeon status row it was
  previously disconnected from (#89).

## [2.36.0] - 2026-07-26

### Added

- The Miner Advanced Class is now acquirable -- "survived two dungeons"
  tracks distinct dungeon runs retreated-from-alive or beaten, so the
  requirement can no longer be farmed by repeatedly leaving and
  re-entering the same unfinished run. Acquiring it grants the
  identical "leave the dungeon instead of dying to the Darkness"
  ability the base Miner Class already had (#62).

## [2.35.1] - 2026-07-26

### Changed

- Condensed `CLAUDE.md` to stay under the editor's 150k-character
  limit -- consolidated recurring per-feature justifications into a
  single reference list instead of restating them inline throughout.
  No app behavior change.

## [2.35.0] - 2026-07-25

### Added

- "Buy Max Torches" and "Buy Max Provisions" buttons in Town Square's
  Shop tab, filling up to the cap (10/20) in one click instead of
  buying one at a time -- limited by the cap or your coin purse,
  whichever runs out first (#90).

## [2.34.0] - 2026-07-25

### Changed

- Removed the redundant "My Animals" list -- current animals are
  already shown on the Adventurer card. The Animals tab in Town
  Square is now just "Buy a Mount," and only appears where one is
  actually buyable (#85).

## [2.33.0] - 2026-07-25

### Changed

- Advanced Classes, Hireling, Animals, and Buildings are now tabs
  in Town Square's City Square area instead of separate sections
  stacked below it, cutting scroll length and fixing "Hire a
  Hireling" reading as grouped with the Tavern tab (#88).

## [2.32.0] - 2026-07-24

### Added

- Cargo Ogre now actually raises your Pack capacity to 40 items
  while employed, instead of the usual 10 (#63).
- Goblin Helper can now be detonated mid-fight, dealing 5 damage to
  every monster in the room -- a one-time ability that destroys the
  Hireling in the process (#63).

## [2.31.0] - 2026-07-24

### Added

- Hirelings now actually fight: a hired companion has real HP shown
  in combat, and a free "Attacks" action usable alongside your own
  Attack each round -- it can also absorb a monster's counter-attack
  as a third option next to HP and armor (#84).

## [2.30.0] - 2026-07-24

### Fixed

- Orc and Ogre characters no longer start at (and eventually lose
  access to) the Human home city their race is banned from -- a
  new character now lands at a compatible Orc/Goblin city instead,
  found on the already-explored map or generated if none exists
  yet (#78).

## [2.29.0] - 2026-07-24

### Changed

- The City Actions grid is now split into themed tabs (Tavern,
  Shop, Job Board, Underground) instead of one crowded flat list
  of up to 14 buttons (#76).

## [2.28.0] - 2026-07-24

### Changed

- Hireling/Animal status now shows permanently on the Adventurer
  card, instead of separate cards that could vanish depending on
  the screen (or never show at all on the World map) (#77).

## [2.27.0] - 2026-07-24

### Added

- Gear an Ogre can't use (unusable armor, potions, and scrolls) is
  now sold as a coin-valued Pack item instead of vanishing outright
  when found (#83).

## [2.26.0] - 2026-07-24

### Added

- Armor now enforces "can't use more than one identical piece" --
  a duplicate-slot find is benched as Spare Armor instead of
  stacking, with its own "Wield" button to swap it in later (#82).
- The Pack is now capped at 10 items, matching the rulebook's Load
  Limit. A find that doesn't fit prompts an interactive swap
  (discard something to make room, or leave the new item behind),
  and a free "Discard" button lets you drop an item anytime, in the
  dungeon or in Town (#82).

## [2.25.0] - 2026-07-24

### Added

- The Dungeons list now sorts unfinished dungeons before cleared
  ones, and within each group by distance from your current
  position (#80). Each entry also gets a "Locate" button that shows
  where it is on the hex map, without traveling there (#79).
- Hexes your character's race has no Affinity for now show a
  dashed, danger-colored outline on the world map, instead of only
  being discoverable by trying to travel there (#81).

## [2.24.0] - 2026-07-23

### Added

- Warfare (#28): recruit troops at an owned Castle/City/Fortress or a
  Vassal, then march them (and optionally yourself) to attack a
  City/Fortress hex. Winning lets you Annex it as a Vassal or Loot
  it for a flat coin payout (razing it to Ruins); losing spends the
  troops for nothing, and joining the battle risks dying outright on
  a natural 1. Every attack also checks Declared Enemies -- hexes
  that failed their Political Affinity roll can send troops to
  destroy your own nearest building in retaliation.

## [2.23.0] - 2026-07-23

### Added

- Buildings and Politics (#27): spend accumulated coins to build a
  House, Tower, Palace, Castle, City, or Fortress on an empty hex
  (upgrading an already-built hex only costs the difference), and
  roll Political Affinity at any City/Fortress to win it as an ally
  or a Vassal, or make it a permanent enemy. Owning a Palace/Castle/
  City/Fortress now credits coins whenever a Dungeon Boss falls.
  This unlocks the Noble, Knight, Lord, King, and Emperor Advanced
  Classes, unbuildable since #23 first shipped.

## [2.22.0] - 2026-07-23

### Added

- Ogre's "Cannot use potions, scrolls or wear armor" restriction is
  now enforced (#60), the second half of an ability that previously
  only granted the +2 damage bonus. Potions, scrolls, and armor
  found in a dungeon (or bought/brewed in Town) simply have no
  effect for an Ogre; weapons are unaffected.

## [2.21.0] - 2026-07-23

### Added

- Samambro's race ability is now real (#60): "when you die, roll a
  die -- 3 or more and you come back to life with 1 HP" is checked
  at every way a character can die in a dungeon, rather than being
  flavor text with no effect.

## [2.20.0] - 2026-07-23

### Added

- 6 more New Spells are now castable (#61, Tier 2): Vimes and
  Paralyze silence one or every monster in the room for several
  turns; Ethereal Body reduces all damage taken for the rest of the
  fight; Magic Shield conjures a stacking, independently-depleting
  damage-absorbing barrier; Absorb Soul and Fire of the Dead grant
  bonus HP or torches per monster killed once the fight is won.

## [2.19.0] - 2026-07-22

### Added

- 4 more New Spells are now castable (#61): Natural Cure (Heal, but
  12 HP), Insect Rain and Magic Blast (Fireball/Lightning at
  different damage), and Banish the Dead (destroys every Undead
  monster in the room, bypassing their revival roll).

### Fixed

- Spell uses granted after Character Creation -- by an Advanced
  Class, a Hireling, Gnome's Culture Action, or a Magic Scroll --
  never appeared in the Spells list, and were silently erased the
  next time the character rested (#75). A persisted per-spell max is
  now tracked and kept in sync at every grant site instead of being
  recomputed from creation-time data alone.
- A character's displayed max HP never reflected any Advanced Class
  HP bonus, always showing the value from Character Creation instead
  of the current, live maximum.

## [2.18.0] - 2026-07-22

### Added

- Helsing and Bugcatcher are now acquirable Advanced Classes (#71),
  each requiring a curated aggregate kill count (2 vampire-type
  monsters; 10 spiders/scorpions/wasps) since no single monster name
  answers the requirement on its own. Both also grant their real
  +1-damage abilities in combat. Hotep stays unbuildable -- no
  mummy-type monster exists in any dungeon type yet.

## [2.17.1] - 2026-07-22

### Fixed

- Added a favicon (#74) -- a hand-authored torch-flame SVG in the
  game's own gold/ember palette, referenced from `index.html`. The
  browser tab previously showed a generic default icon.

## [2.17.0] - 2026-07-22

### Added

- Avenger and Lich are now acquirable Advanced Classes (#73). Avenger
  requires any recorded Graveyard death; Lich requires a past character
  who died while holding the Necromancer class, tracked via a new
  optional `advancedClasses` field on each Graveyard entry.

## [2.16.0] - 2026-07-21

### Added

- 6 more Advanced Classes -- Lumberjack, Druid, Survivor, Pirate, Bard,
  Cook -- are now acquirable (#72), each requiring a lifetime World-map
  travel counter (forests/deserts crossed, territories sailed, distinct
  cities visited, or provisions spent on the road).

### Fixed

- 6 Advanced Classes acquired in v2.15.0 (#70) did nothing beyond their
  flat HP bonus, since their abilities were never actually wired up:
  Scholar/Necromancer/Necromaster's spell grants, Merchant's doubled
  sell value, Blacksmith's torch-for-armor-repair, and Thief's
  torch-free lockpicking are now all real.

## [2.15.0] - 2026-07-21

### Added

- 9 more Advanced Classes -- Collector, Scholar, Merchant, Necromancer,
  Blacksmith, Gladiator, Thief, Necromaster, Assassin -- are now
  actually acquirable (#70), each requiring only a small one-time
  achievement flag/counter (used a spell or scroll, sold an item, cast
  Cold Ray, had an armor piece destroyed, fought in an Arena, opened
  4 locks) or, for Collector/Necromaster/Assassin, nothing beyond
  state the game already tracks.

## [2.14.3] - 2026-07-21

### Fixed

- A monster whose count is rolled from dice (e.g. "1d6 Goblins") now
  displays and logs correctly in the singular when the roll actually
  comes up 1 (#65) -- previously it stayed pluralized ("Goblins")
  everywhere its name showed up, even for a single monster.
  Goblinator's Advanced Class requirement now sums both the singular
  and plural kill-count forms, so a run with several solo-Goblin kills
  no longer silently undercounts toward it.

## [2.14.2] - 2026-07-21

### Fixed

- Known spells that need combat (Teleport, Cold Ray, Lightning,
  Fireball) now show a disabled "Cast" button out of combat, with a
  "Requires combat" tooltip, instead of vanishing entirely (#64) --
  the same treatment already given to a spell that's simply out of
  uses, now carried through to this last case too.

## [2.14.1] - 2026-07-21

### Fixed

- A dead-end Final Room victory (the Boss found because no stairs
  were ever found on that level, rather than the normal depth-3
  descent) now correctly counts as beating the dungeon (#69). It
  previously kept showing "unfinished" everywhere -- the World map,
  Town, and Records -- even after the Boss was defeated, since
  `isDungeonBeaten()` only ever checked the first segment of a level
  and this path places the Final Room at a different index.
  `isDungeonBeaten()` no longer depends on the level-level flag that
  was also missing, so a dungeon already saved by an earlier build now
  reads as cleared immediately too, with no action needed.

## [2.14.0] - 2026-07-21

### Added

- Animals (#26): 19 companions across Domesticated Animals and
  Mounts, trained in the wild or (Mounts only) bought outright in a
  qualifying city, persisting permanently once acquired. Owl/Giant
  Wolf/Camel/Raptor/Goat/Llama discount their own terrain's travel
  cost, Griffin discounts every terrain unconditionally, Mammoth adds
  a travel penalty instead, and Dog blocks "Move Silently" entirely
  in the dungeon. Every other entry is listed with its real
  Dif/cost/terrain/HP/Dmg/ability text but has no mechanical effect
  yet. An animal is cosmetic once acquired -- this app doesn't model
  it as a real combatant (no live HP tracking, no death).

## [2.13.0] - 2026-07-21

### Added

- Hirelings (#25): 16 paid companions hired in a City/Fortress for
  one dungeon trip at a time, one roster per culture. Burglar
  (no-torch lock-picking), Minstrel (+2 combat damage), Dwarf Miner
  (2-dice Secret Passage rolls), Dwarf Soldier (+1 vs. Orcs/Goblins),
  and Rent Wizard/Elf Soldier/Gnome Helper (random Basic Spell grants)
  all have a real, working ability; every other hireling is listed
  with its real cost/HP/equipment/ability text but has no mechanical
  effect yet. A Hireling is cosmetic once hired -- this app doesn't
  model it as a real combatant (no live HP tracking, no death) --
  and expires the moment its dungeon trip is actually beaten, unlike
  Advanced Classes' permanent stacking.

## [2.12.0] - 2026-07-20

### Added

- Advanced Classes (#23): 45 purchasable classes a character can
  stack on top of their Race/Class, each with a coin cost and an HP
  bonus -- Ruthless, Goblinator, Gravedigger, Orcslayer, Dragonslayer,
  Guard, Ghostbuster, Ambidextrous, Mage, Warrior, Multidextrous,
  Cleric, Paladin, Anti-Paladin, Elementalist, Champion, Alchemist,
  and Arcane are fully acquirable today, with real requirement checks
  against kills/bosses/known-spells/the Graveyard and (where the
  rulebook specifies one) a real ability -- spell grants, +2 damage
  vs. Undead, a free Rest, an instant Health Potion. Every other class
  is listed for flavor with its real cost/requirement/ability text,
  disabled with a "not yet trackable" reason until its prerequisite
  system (Buildings, Arena history, per-terrain travel counts, ...)
  exists.

### Fixed

- A session saved before Advanced Classes existed no longer crashes
  the app on load -- `loadSession()` now back-fills the missing field.

### Added

- New Spells (#24): three additional 1d6 spell tables (Nature, Death,
  Elemental) plus a 2d6 Advanced table, granted by a race ability, an
  Advanced Class, or a Magic Item -- never a free player choice the
  way Race tables are. Heal, Light, Teleport, Cold Ray, Lightning,
  and Fireball (including Elemental's re-listed copies of the latter
  three) are fully castable; every other new spell rolls, tracks
  uses, and displays correctly but has no mechanical effect yet.
  Spell identity widened to a `table:roll` composite key throughout
  the engine, since the new tables reuse Basic Spells' own roll
  numbers.

## [2.10.0] - 2026-07-20

### Added

- New Races (#22): three additional 1d6 race tables (Uncommon,
  Exotic, Monstrous) selectable in Character Creation instead of the
  Core Book's 2d6 table, adding 18 new playable races -- Pumpkinkin,
  Half-Human, Samambro, Corvino, Patovsky, Pandakhan, Sharkin, Goblin,
  Orc, Centaur, Fungoid, and Ogre. Half-Human rerolls a Core race and
  inherits its ability. Patovsky/Sharkin can walk on water,
  Pandakhan/Centaur have a travel-cost multiplier, and Ogre deals +2
  damage -- real mechanics, not just flavor text. Prohibited Races
  (the rulebook's own explicitly non-canonical joke table) is not
  included.

## [2.9.2] - 2026-07-20

### Fixed

- "Enter Dungeon" for a dungeon found nearby (via Ask, or on Ruins)
  now lives inside the Hex Inspector info box, next to the status it
  already displays for that hex, instead of a disconnected card below
  the map that read as "no way to enter it" (#59).

## [2.9.1] - 2026-07-20

### Changed

- CSS Module class names are now readable in devtools (e.g.
  `Die-module__die`) instead of opaque hashes, in both dev and the
  production build (#57).

## [2.9.0] - 2026-07-20

### Added

- Cities and Fortresses now have their own generated names (#49),
  e.g. "Ironhold" instead of an indistinguishable "Human City" --
  shown on the World map, in HexInspector, and as Town Square's own
  heading. Your home city is always "Haven."

## [2.8.1] - 2026-07-20

### Added

- README explaining what this project is, that it's an unofficial
  fan-made adaptation of the NoteQuest tabletop game/PDF, and how to
  run it locally.

## [2.8.0] - 2026-07-20

### Added

- Getting Money: Thug Life and Fighting in the Arena (#58), completing
  the set alongside Hard Work and Gamble. Thug Life robs a traveler
  (2d6 in a City, 3d6 in a Fortress) for a chance at coins, a
  Treasure, getting caught and permanently banned from that city, or
  killed outright. The Arena (Fortress only) pits you against a
  randomly rolled Champion for a real fight -- win 20 coins, lose and
  your character dies.

## [2.7.0] - 2026-07-20

### Added

- Getting Money: Hard Work and Gamble City Actions (#58). Hard Work
  permanently trades 1 max HP for 1d6+1 coins (City only). Gamble
  spends a coin for a shot at 6 more, or -- if you're broke -- bets
  your life on the same roll. A death here is recorded to the
  Graveyard just like a death in a dungeon, the first way to die
  outside one. Thug Life and Arena are still to come.

## [2.6.0] - 2026-07-20

### Added

- "Ask" City Action: in a City or Fortress, ask about the nearest
  dungeon. Rolls a hex side and finds the first neighboring hex
  that's land with no location, marking it on the map as a known,
  enterable dungeon -- without ever setting foot there first.

## [2.5.0] - 2026-07-19

### Changed

- A second staircase down to an already-discovered level now opens
  directly onto that level's existing entrance, instead of creating a
  new, physically disconnected entry point on its map.

## [2.4.2] - 2026-07-19

### Fixed

- TeleportPicker listed every destination room but never showed which
  room the player was actually fleeing from -- there was no "you are
  here" reference point. It now shows a "Fleeing from Level X --
  [Type] (Segment N)" line above the destination list.

## [2.4.1] - 2026-07-19

### Fixed

- A dungeon's entrance room could still ambush the player with fresh
  monsters when resumed by a new character (`RESUME_DUNGEON`) -- the
  "Monster table re-roll on return" mechanic had no exemption for the
  entrance, undoing #43's guarantee that the very first room is always
  safe.

## [2.4.0] - 2026-07-19

### Added

- Settings: a "Reset Everything" action (confirmation-gated) on every
  screen's footer, wiping the character, Graveyard, every dungeon ever
  found, and the World map -- for a player who wants a genuinely clean
  slate, not just a new adventurer.

### Fixed

- Teleporting mid-fight into a room that (per the Monster re-roll rule)
  had just gotten fresh monsters could drop the player straight into a
  second, un-signaled fight instead of the safety it was meant to be.
- Potion of Fury's combat-damage bonus was silently discarded when used
  outside of combat, with no feedback that anything happened.
- Heal's "Cast" button vanished the instant its uses ran out instead of
  staying visible and disabled, making it look like the spell had
  disappeared rather than just being spent.

## [2.3.0] - 2026-07-19

### Added

- Race Affinity: a race with no Affinity for a City/Fortress's culture
  can't travel onto that hex at all -- explained on the Hex Inspector
  ("You are not welcome here.").
- One bonus City Action per culture (Human/Dwarf/Elf/Gnome/Goblin/Orc)
  on top of Rest/Buy Torches/Buy Provisions -- Elven Boots (real: forest
  travel drops to 1 provision) and Learn a Spell/Buy Orc Gladio are
  fully mechanical; Remove Curse/Buy Lamp/Verdosa Potion resolve as
  flavor or a straightforward heal check, since this app has no
  Curse/hand-economy/day-passage systems for them to hook into.
- Hire Boat: in a City/Fortress next to water, spend 1 coin to cross
  water normally until stepping onto dry land again.

## [2.2.1] - 2026-07-18

### Fixed

- The World map's own view had no footer (credit line, version number)
  at all, unlike every other screen.
- Heal and Light could only be cast from a dungeon's "Cast" button --
  Town and the World map had no way to cast either, despite both being
  documented as usable anytime.
- A dungeon already beaten by defeating its Boss could still be entered
  via "Start a New Dungeon" mid-fight, letting a losing combat be
  abandoned consequence-free -- it also reset the character's real
  HP/kills/spells to hardcoded defaults on every use, combat or not.
  The button is removed entirely: a hex's dungeon is meant to be a
  fixed, persistent place, not something to re-roll on a whim.

## [2.2.0] - 2026-07-17

### Added

- A spare weapons inventory: finding a new weapon no longer silently
  discards whatever's equipped -- it's held as a spare instead, with a
  "Wield" action to swap it in explicitly (both in the dungeon sidebar and
  in Town). (#48)
- In Town Square, the Graveyard/Dungeons history now rides beside the
  Adventure section as a second column instead of its own separate card
  below it, and shows entries in two side-by-side columns.

### Fixed

- A dungeon beaten by defeating its Boss could become re-enterable again
  if you reloaded the page (or just closed the tab) from the victory
  screen without clicking "Return to Town" first -- the win is now saved
  the instant the Boss falls, not only once you leave the dungeon screen.

## [2.1.1] - 2026-07-17

### Fixed

- Clicking a passable, in-range hex on the world map travels there immediately
  again, matching the behavior from before the Hex Inspector existed -- it had
  started requiring an extra "Travel Here" click instead. Clicking any other
  known hex still falls back to selecting it for inspection.
- The Scholar class's name was misspelled "Schoolar" throughout.

## [2.1.0] - 2026-07-17

### Added

- A `RoomInspector`-style Hex Inspector on the world map: click any known hex
  to see its terrain, location, and dungeon status, with a "Travel Here"
  button to actually move there.
- Wheel and two-finger pinch zoom on both the dungeon map and the hex map,
  plus click-drag panning on the hex map (the dungeon map already had it).

## [2.0.0] - 2026-07-16

Hexploring the World: the Expanded World's hex-travel system is now the
primary way to find and resume dungeons, replacing Town's own dedicated
dungeon-rolling entirely. Major version bump for the resulting break in the
established Town/dungeon flow.

### Added

- A hex-by-hex world map, explored one ring at a time from a starting city,
  with Provisions as a new, dungeon-independent travel resource.
- The dungeon you find is fated by the hex's own terrain (Table: Dungeon
  Type, by terrain) instead of a free roll.
- Per-hex dungeon persistence: a dungeon stays tied to the hex it was found
  on -- "drawing it on the map" -- and is only resumable by physically
  traveling back there, whether it's your own paused run or a previous
  adventurer's abandoned one. Unfinished and cleared dungeons, plus any
  still-unrecovered remains, show as map badges.
- Every City/Fortress hex, home included, now opens the same unified "Town
  Square" screen (City Actions, Adventure, your character) instead of home
  having its own separate screen and every other city getting a smaller
  card next to the map.
- Secret passages can now reveal a real, descendable staircase instead of
  just flavor text.

### Fixed

- Casting a spell (Flee included) or opening a Treasure mid-combat silently
  did nothing for the rest of a fight once "Attack First" had been chosen.
- Teleport now actually moves the character to a real, already-discovered,
  monster-free room instead of just clearing combat in place.
- The Combat panel's dice roll now shows right under your HP, instead of
  getting pushed out of view at the bottom of the panel with several
  monsters in a fight.

## [1.0.1] - 2026-07-16

### Fixed

- Casting a spell (Flee included) or opening a Treasure mid-combat silently
  did nothing for the rest of a fight once "Attack First" had been chosen --
  `hasPendingRoomEntry()` never cleared once combat started, so it kept
  blocking those two actions for the whole encounter instead of just the
  moment before the fight began.
- Teleport now actually moves the character to a real, already-discovered,
  monster-free room instead of just clearing combat in place -- picking a
  destination from the Combat panel's Flee button reopens the same room's
  "Monsters Ahead" prompt otherwise, since nothing had moved.

## [1.0.0] - 2026-07-14

The full Core Book rule set is now implemented end to end -- this is the first
release with nothing from the Core Book still stubbed out.

### Added

- Move Silently: opening a door quietly no longer forces an immediate fight.
  Choose to Attack First (free, as before) or spend 1 torch to try slipping
  past the room's monsters entirely, with a per-monster detection roll and
  Halfling's "roll two, discard the lowest" advantage. A room you've sneaked
  past wakes up if you make noise there afterward.

## [0.1.0] - 2026-07-14

Initial playable release: the full Core Book solo dungeon-crawl loop, from
character creation through death (or victory).

### Added

- Character creation: race/class dice rolls, Basic Spells, and a 3D dice-roll UI.
- Procedural dungeon generation across all six Core Book dungeon types (Palace,
  Crypt, Tomb, Sanctuary, Temple, Prison), built door by door as you explore.
- Combat: weapon attacks, every monster special ability, the six Basic Spells,
  armor damage-absorption, and the Final Room Boss fight.
- Doors, locks, traps, secret passages, and torches/Darkness as the game's core
  resource and fail state.
- Chests and openable Treasures, including the full Armor & Weapon system
  (Wonders, Magic Items, and a per-dungeon-type Weapon table for all six types).
- Town: City Actions (Rest, Buy Torches, Fix Armor, Sell), and picking up a
  paused or abandoned dungeon to resume.
- The Graveyard: a persistent record of fallen adventurers (race, class, cause
  of death, kills), shown on both Character Creation and Town.
- Session persistence: the current character, resources, and dungeon list
  survive a page reload.
- Hover tooltips explaining monster abilities, spell effects, and equipped-item
  effects; click-and-drag panning on the dungeon map.
- Deployment to GitHub Pages via GitHub Actions.

### Fixed

- The Heal spell's HP gain is now visible as its own step before a mid-combat
  counter-attack lands, instead of the two netting out invisibly in one render.
- Weapon attacks blocked by Stoneskin or Intangible now say why, instead of a
  generic "fails to harm" message.

[Unreleased]: https://github.com/NerdyToddGerdy/notequest_browser/compare/v2.1.1...HEAD
[2.1.1]: https://github.com/NerdyToddGerdy/notequest_browser/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/NerdyToddGerdy/notequest_browser/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/NerdyToddGerdy/notequest_browser/compare/v1.0.1...v2.0.0
[1.0.1]: https://github.com/NerdyToddGerdy/notequest_browser/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/NerdyToddGerdy/notequest_browser/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/NerdyToddGerdy/notequest_browser/releases/tag/v0.1.0
