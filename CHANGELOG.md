# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
