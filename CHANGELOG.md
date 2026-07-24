# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
