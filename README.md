# NoteQuest (Browser)

A browser-based digital adaptation of **NoteQuest**, a solo, dice-driven, pen-and-paper dungeon-crawler board game by [Tiago Junges](https://www.drivethrurpg.com/en/product/365859/notequest-expanded-world?src=also_purchased). This project reimplements the rules from the official rulebook PDF (Core Book + Expanded World) as a playable single-page web app: roll up a character, crawl a procedurally-built dungeon room by room, and explore a wider hex-crawl world of cities, fortresses, and everything in between.

**Play it here:** https://nerdytoddgerdy.github.io/notequest_browser/

## This is an unofficial fan project

NoteQuest is a real, purchasable tabletop game — this is not it. It's a fan-made digital adaptation, built to transcribe and automate the pen-and-paper rules (dice rolls, table lookups, bookkeeping) rather than to replace the original work. No official assets, art, or text from the PDF are redistributed here; `docs/game-rules-reference.md` is this project's own transcription of the rules used as an implementation reference, and the purchased rulebook PDF itself is intentionally excluded from the repository (see `.gitignore`).

If you enjoy this, please support the original creator by picking up the real thing on [DriveThruRPG](https://www.drivethrurpg.com/en/product/365859/notequest-expanded-world?src=also_purchased).

## What's implemented

- **Character creation** — race/class rolls, starting equipment, spells.
- **The dungeon crawl** — procedurally generated levels, doors, traps, combat, torches and darkness, treasure and loot.
- **Hexploring the World** — a wider map of terrain, cities, fortresses, and ruins, with travel, Affinity, City Actions (Rest, Buy, Sell, Ask, Hire Boat, the Getting Money mini-games), and per-hex dungeon persistence.
- **The Graveyard** — a running record of every character lost, in a dungeon or otherwise.

See `CLAUDE.md` for a detailed architectural walkthrough of how the engine is built, and the repo's [issues](../../issues) for what's shipped versus still in progress.

## Development

```
npm install
npm run dev       # start the dev server
npm run build     # typecheck + production build
npm run test      # unit tests (vitest)
npm run test:e2e  # end-to-end tests (playwright)
npm run lint
```

Deployment to GitHub Pages happens automatically on every push to `main` (see `.github/workflows/deploy.yml`).
