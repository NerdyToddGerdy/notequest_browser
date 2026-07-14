# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/NerdyToddGerdy/notequest_browser/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/NerdyToddGerdy/notequest_browser/releases/tag/v0.1.0
