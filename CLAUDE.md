# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository has no source code yet. It currently contains only:
- `NOTEQUEST_EW_eng_12.pdf` — the rulebook for *NoteQuest: Expanded World* (by Tiago Junges), a solo pen-and-paper dungeon-crawler board game. Gameplay is driven entirely by dice rolls (d6) against lookup tables: character creation (race/class), procedural dungeon generation (rooms, corridors, staircases, doors, traps, monsters, treasure), and expansion systems (hexcrawl overworld, cities, portals, advanced classes, warfare, multiplayer).
- `.vscode/settings.json` — editor color theme only, no build/task config.

There is no `package.json`, framework, build tooling, test suite, or git repository initialized. Based on the repo name (`notequest_browser`), the intent is presumably a browser-based digital implementation/companion for this tabletop game, but no such implementation exists yet.

## Working in this repo

- Treat the PDF as the authoritative game-design source for any digitization work (rules, tables, dice mechanics) — don't invent rules not present in it.
- Once a project is scaffolded (framework chosen, source files added), update this file with real build/lint/test commands and architecture notes. Do not guess at a stack in the meantime.
