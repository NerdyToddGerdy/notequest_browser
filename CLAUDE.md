# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project

**GerdQuest: Realm of Depths** — a browser-based digital adaptation of _NoteQuest_ (by Tiago Junges), a solo, dice-driven, pen-and-paper dungeon-crawler. Deploys to GitHub Pages (static, no backend).

`docs/game-rules-reference.md` is the authoritative transcription of the rulebook (Core Book + Expanded World) — **source of truth for any table, mechanic, or dice logic. Don't invent rules not present there.** The purchased rulebook PDF is intentionally untracked (`.gitignore`) since this repo is public.

**Scope**: v1 (Core Book) is complete. The project is in the Expanded World phase — hexcrawl, cities, politics, warfare, multiplayer, advanced classes. Treat open issues as active in-scope work, not premature.

`design/mockups/*.html` are standalone historical layout studies, not part of the build and not spec-of-record — the real code has diverged. Don't edit them expecting app changes.

### Two things that must not be renamed or find-and-replaced

- **The `notequest:` localStorage key prefix** (`session.ts`, `graveyard.ts`). These hold every player's entire save. Renaming without a read-old-write-new migration silently wipes everyone, experienced as the game deleting their character. The prefix is invisible to players, so a migration would be pure risk for zero benefit. Both keys carry a comment saying so.
- **The NoteQuest attribution.** The project was renamed from "NoteQuest (Browser)" as a display-name-only change (the repo slug, the Pages URL and `vite.config.ts`'s `base` are all untouched, so nothing external breaks). That makes the explicit credit carry all of the crediting the old name used to do implicitly. `Footer.tsx`'s credit block, the README's "this is not it" framing, and the "Source: NoteQuest Core Book" provenance comments on the rule tables all stay exactly as they are.

## Commands

```
npm run dev       # Vite dev server
npm run build     # tsc -b, then production build to dist/
npm run preview   # serve the production build
npm run lint      # eslint .
npm run format    # prettier --write .
npm run test      # vitest run
npm run test:watch
npm run test:e2e  # playwright test -- e2e/
```

Single test file: `npx vitest run src/engine/__tests__/character.test.ts`.
Reproduce a CI e2e run exactly: `CI=true npm run test:e2e`.

**Node**: 20.17 locally, CI pins 20.19 exactly. Some devDependencies want >=20.19, so `npm install` prints `EBADENGINE` warnings. Warnings only — install, build and test all work — but if a dependency install starts hard-failing, check that mismatch first.

## Versioning (required)

Every push to `main` requires a version bump: `package.json` + `package-lock.json` `version`, a new dated `CHANGELOG.md` section, and a matching `vX.Y.Z` git tag. `Major.Minor.Hotfix` — Hotfix for a bug fix with no user-visible feature change, Minor for a new feature, Major for a milestone or breaking change. **Applies even to a small direct-to-main fix.**

## Architecture

**Data-driven engine, not per-screen hardcoding.** Rules live as typed data in `src/data/`, keyed by dice-roll value (`RACE_TABLE[7]` for a 2d6 of 7). Pure logic lives in `src/engine/` and takes an injectable `RNG = () => number` (default `Math.random`) so tests pass a seeded generator (`src/test/mulberry32.ts`) and assert exact values rather than ranges. UI components consume `src/engine` and never re-implement roll logic themselves.

### Deep-dive docs

Read the relevant one before working in that area — each carries the design rationale, the confirmed product decisions, and the traps.

| Doc                                                                            | Covers                                                                                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [docs/architecture/dungeon.md](docs/architecture/dungeon.md)                   | Map generation, doors/torches/traps, combat and `fight.ts`, inventory and the Pack, the hand economy, remains and resuming, the 12 dungeon types |
| [docs/architecture/world.md](docs/architecture/world.md)                       | Hexcrawl, travel and Affinity, cities, dungeons on the map, location effects, Events on Travel, Portals, the Other Worlds, climate               |
| [docs/architecture/character.md](docs/architecture/character.md)               | Races, spells, the 45 Advanced Classes, Hirelings, Animals, mutations, death and the Graveyard                                                   |
| [docs/architecture/town-and-economy.md](docs/architecture/town-and-economy.md) | City actions, resources, money and selling, Buildings, storage, Politics, Warfare                                                                |
| [docs/architecture/ui.md](docs/architecture/ui.md)                             | Screens and shared components, the page layout, theme, session persistence, React traps                                                          |
| [docs/architecture/deferred.md](docs/architecture/deferred.md)                 | Everything deliberately unbuilt or simplified — check before "fixing" something that looks broken                                                |

### Recurring conventions

Referenced by name throughout the codebase — follow them rather than inventing a new approach.

- **Documented, deliberate simplification.** Where the rulebook references a system this app doesn't model, resolve as flavor-only text or a flat coin/HP value rather than inventing infrastructure. Document the call at the site. See [deferred.md](docs/architecture/deferred.md).
- **No formal taxonomy, substring/tag matching instead.** Monster "categories" (Undead, Vampire, insect) and bonuses against them are case-insensitive substring checks against `MonsterTemplate.name` (`matchesTags()`), because the rulebook has no category system.
- **Optional field, back-compat default.** New persisted fields on `WorldState`/`AdventurerResources`/`DungeonState` are typed optional and defaulted at the read site (`?? []` / `?? null`) so an old `localStorage` save doesn't crash the app. `session.ts`'s `loadSession()` back-fills as needed.
- **Reducer decides, UI mirrors.** Client-side checks (button disabling, `canTravelTo()`, `hasPendingRoomEntry()`) duplicate the reducer's own gating purely for UX responsiveness. The reducer/engine function is always the actual authority.
- **Acquire-once-permanent vs. expires-per-trip.** `advancedClasses`, `animals`, `buildings` and `mutations` persist for the character's life. `hireling` is deliberately different — spent the instant a fresh dungeon trip is entered, matching "you pay to face just one dungeon."
- **Two rulebook entries, one bonus, no double-counting.** Where a base Class and an Advanced Class (or a Race and a Hireling) grant the identical effect (Grave Digger/Gravedigger, Cat-Person/Merchant, Blacksmith/Blacksmith), the check is a single OR'd condition, never two stacking bonuses.
- **Its own engine module when no reducer owns it.** An effect that can touch `AdventurerResources`, `WorldState`, _and_ kill the character gets its own module (`events.ts`, `portals.ts`, `mutations.ts`, `locationEffects.ts`) and resolves in a screen off pure functions.
- **Structural seams over shared base types.** `fight.ts`'s `Fighter` and `hands.ts`'s `HandBearer` are satisfied structurally by both `DungeonState` and `AdventurerResources`, so shared logic never knows which it's holding.

### Code layout

- `src/data/` — rule tables: `races.ts`, `classes.ts`, `spells.ts`, `animals.ts`, `hirelings.ts`, `advancedClasses.ts`, `buildings.ts`, `affinity.ts`, `names.ts`, `cityNames.ts`, `mutations.ts`, `events.ts`, `otherWorlds.ts`, `locationEffects.ts`, `hexTables.ts`, `dungeonTypes.ts` (shared Segments/Secret Passage/Name tables), `dungeonTables.ts` (per-type Trap/Room/Monster/Reward/Boss tables).
- `src/engine/` — pure logic: `character.ts`, `dungeon.ts`, `dungeonState.ts`, `dungeonReducer.ts`, `combat.ts`, `fight.ts`, `hands.ts`, `hexState.ts`, `hexReducer.ts`, `town.ts`, `arena.ts`, `warfare.ts`, `politics.ts`, `buildings.ts`, `portals.ts`, `events.ts`, `mutations.ts`, `locationEffects.ts`, `advancedClasses.ts`, `session.ts`, `graveyard.ts`.
- `src/ui/screens/<ScreenName>/` — one file + one CSS Module each. `App.tsx` holds the only navigation state; there is no router.
- `src/ui/components/` — shared components. `src/ui/theme/` — tokens, self-hosted fonts, global CSS.

## Testing

Vitest, default environment `"node"`. `e2e/` holds Playwright specs (`playwright.config.ts`, `tsconfig.e2e.json`) — a separate suite from Vitest's `src/**/__tests__/`, for regressions only reachable end-to-end (localStorage session state → real rendered UI), not by testing pure reducer/engine functions in isolation. `vite.config.ts`'s `test.exclude` keeps Vitest from trying to run them (they use `@playwright/test`'s own `test`/`expect`, not Vitest's). `playwright.config.ts`'s `webServer` starts `npm run dev` automatically and reuses an already-running one locally (`reuseExistingServer: !process.env.CI`).

## Gotchas

- **`tsc`/`eslint` do not parse CSS module contents.** A malformed rule (an unclosed `@media`, say) passes both and surfaces only as a dev-server 500, failing every e2e spec at once. **If the whole suite fails on unrelated specs, check the CSS before the logic.**
- **jsdom currently throws `ERR_REQUIRE_ESM` as the global Vitest environment.** Opt individual component-test files in with a `// @vitest-environment jsdom` docblock rather than changing the global config.
- **CSS Module class names are readable, not hashed** (`"[name]__[local]"`, dev and prod alike). Safe only because every `*.module.css` basename is unique — keep it that way.
- **Immer deep-freezes `produce()` output.** Anything re-fed into new state must be `structuredClone()`d.
- **`StrictMode` runs effect cleanups once on mount**, against the initial state. Don't hang one-shot side effects off an unmount cleanup — use a real click handler, which can't double-fire.
- **ESLint's `react-hooks/rules-of-hooks` treats any `use`-prefixed function as a hook.** Plain engine functions are named `drinkConsumable()`, `resolveForgottenGods()` for exactly this reason.
- **`react-hooks/set-state-in-effect`**: apply outcomes in event handlers, not mount effects.

## Deployment and CI

`vite.config.ts` sets `base` conditionally on `process.env.GITHUB_ACTIONS` (`/notequest_browser/` in CI, `/` locally).

`.github/workflows/deploy.yml` ("CI and Deploy") runs lint → Vitest → build → Playwright on every push to `main` and every pull request, then deploys to Pages **only on a push**. The deliberate calls, none of which are discoverable from the YAML:

- **e2e lives in the `build` job**, not a parallel one, and runs **last**. The suite takes ~5s, so a separate job would spend longer re-doing checkout and `npm ci` than it could save — and being in `build` means `deploy` is already gated on it via `needs`. Running last means the cheap checks fail first and the slow browser download is only paid when they pass.
- `concurrency` is keyed `${{ github.workflow }}-${{ github.ref }}` rather than a single shared `pages` group, so a PR run can't cancel an in-flight deploy of `main`.
- The `deploy` job and the Pages-artifact upload are both `if: github.event_name != 'pull_request'` — a PR runs every check but publishes nothing, and a fork PR's read-only token never has to upload.
- On failure the Playwright HTML report (with the on-first-retry trace) uploads as an artifact — the only way to debug a CI-only failure.
- **Every action is pinned to a floating `@v5` major** so it runs on the Node 24 action runtime. `upload-pages-artifact` needed bumping even though the deprecation notice never named it — it's a _composite_ action calling `upload-artifact` internally, so the warning survived bumping only the directly-named ones.

`public/favicon.svg` is a hand-authored torch-flame SVG in the `tokens.css` palette, with hardcoded hex (a favicon can't read CSS custom properties).
