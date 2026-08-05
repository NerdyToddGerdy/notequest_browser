# UI, layout and persistence

Screens, shared components, the page layout, theme, and how state survives a reload.

Primary files: `src/App.tsx`, `src/ui/screens/`, `src/ui/components/`, `src/ui/theme/`, `src/engine/session.ts`.

## Navigation

`App.tsx` holds the only navigation state and switches between `CharacterCreationScreen`, `WorldScreen` and `DungeonScreen`. **There is no router.**

Flow: `CharacterCreationScreen` → `WorldScreen` (landing on home) → `DungeonScreen`, with `DungeonScreen` able to send the player back to World (voluntary retreat, alive) or to `CharacterCreationScreen` (death, via `onNewAdventurer` — permanent, no resurrection).

`TownScreen` isn't in that list — it's a hex-generic component `WorldScreen` renders in place of the map. See [world.md](world.md).

## Screens and shared components

Screens live in `src/ui/screens/<ScreenName>/`, one file + one CSS Module each.

**Shared components** in `src/ui/components/`:

- `Die`/`DicePool`
- `CharacterSheet` — a `CreatedCharacter` plus live stats, used in Town/World and the dungeon sidebar
- `Equipment`/`Pack` — each takes optional row-action buttons (`onFixArmor`/`onSell`)
- `Graveyard`, `RecordsPanel`, `DungeonsList`
- `TallyModal`
- `Footer`
- `EventPanel`, `CombatPanel`
- Dungeon-specific: `DungeonMap`, `LevelTabs`, `RoomInspector`, `RoomEntryPrompt`, `TeleportPicker`, `RollLog`
- `src/ui/rollTiming.ts` has the shared `revealDelay()` timing helper

### `CharacterSheet` is the status surface (#77)

`DungeonScreen` used to render `Hireling`/`Animals` as extra sidebar cards; `TownScreen` hid Hireling status entirely at a culture with no roster; `WorldScreen`'s map view showed nothing.

`CharacterSheet` gained `hireling?: string | null` / `animals?: string[]` props, rendered as extra `<li>` rows in its existing `.abilities` list (resolved via `HIRELING_BY_NAME`/`ANIMAL_BY_NAME` for full detail). `DungeonScreen`'s standalone status cards were removed outright. `TownScreen`'s own actionable `<Hireling roster=…>`/`<Animals buyableMounts=…>` (hiring/buying UI, not pure status) stay as-is.

**Advanced Classes list there too.** The sheet showed only the starting Class, so a character could own a dozen bought Advanced Classes — each paid for with coins and a requirement, several granting real combat abilities — with nothing anywhere listing them. `advancedClasses?: string[]` renders **one `<li>` per class**, not a joined line like `animals`/`mutations`, because each carries ability text worth reading exactly as the base Class does.

A `"None."` ability renders as *"No ability."* rather than being hidden — Race/Class can omit themselves silently since you always have exactly one, but **a class you paid for vanishing would read as a bug**. `hasImplementedAbility()` adds a muted "(flavor only)" note, mirroring the purchase list's own chip.

Stat buttons: "Kills" and "Curiosities" are `<button>`s opening `TallyModal` (dismiss-only, sorted highest-first). Curiosities is hidden at 0 — most characters never find one.

### `RecordsPanel`

What `CharacterCreationScreen`/`TownScreen` render for the Graveyard — a tab switcher between `Graveyard` and `DungeonsList` (fed `dungeonHistory` unfiltered), shown only once **both** have at least one entry; with just one populated, that one renders directly, no tab bar.

`DungeonsList`'s status reuses `isDungeonBeaten()`; its unrecovered-remains count uses `countUnlootedRemains()` (summing `remains.names.length` across every segment/level).

`TownScreen` renders it inside a `.recordsCol` beside Adventure in a two-column `.adventureRow` grid (collapsing to one column under 640px), only when `hasRecords`. `Graveyard`/`DungeonsList`/`RecordsPanel` all gained a `compact` prop for this (drops standalone border/shadow/padding, forces the row layout unconditionally via `.rowCompact`). `CharacterCreationScreen`'s usage is untouched (`compact` defaults false).

### `Die`

`src/ui/components/Die/Die.tsx` is a real 3D CSS cube (six absolutely-positioned faces, `rotateX`/`rotateY`), **not** an image swap. Driven by `value` (1-6) + `rollToken` (bump to re-trigger even on a repeated value) + optional `delayMs`/`size`. `DicePool` renders N `Die`s with staggered delays.

**Screens own the timing of when to reveal a result** (`revealDelay()`) — `Die` itself has no completion callback.

## Screen layout (v4.2.0)

World, Town and Dungeon share one grid: title over the left column, main view beneath it, character sidebar down the right (`3fr 2fr`), footer spanning both columns on the bottom row. Each `.page` is `height: 100dvh` and **never scrolls** — regions scroll internally instead. The Dungeon adds a row for Recent Rolls, capped at `22vh`, which is the only scrollbar on that screen.

**The main column is a sheet of paper.** `global.css`'s `.screen-sheet` (shared, not per-module) gives it the parchment surface, double inset border, ruled lines, and two rotated pseudo-element copies behind it for the stacked-paper edges. It wraps the **left column only** — the sidebar sits beside it on the dark "table".

**`overflow: visible` is load-bearing** on the sheet, because those rotated pseudo-elements are outside its box and any clipping ancestor erases the stack. The cost is that **every ancestor between the sheet and its scroll region needs an explicit `min-height: 0`** — without it, content spills *over* the footer and makes the Settings button unclickable, which is exactly how this broke twice during the build (`TownScreen`'s `.sheet` and its `.page` padding).

## Theme

`src/ui/theme/`:

- `tokens.css` — palette/fonts as CSS custom properties
- `fonts.css` — self-hosted `@font-face` (Metamorphous, Spectral, JetBrains Mono; all OFL, **no CDN**)
- `global.css` — resets + body background, imported once in `main.tsx`

Component styling uses CSS Modules; shared tokens/fonts are global.

`public/favicon.svg` is a hand-authored torch-flame SVG in the `tokens.css` palette, with **hardcoded hex** — a favicon can't read CSS custom properties.

### CSS Module class names (#57)

`vite.config.ts`'s `css.modules.generateScopedName` is `"[name]__[local]"` — readable, not a hash. **Safe only because every `*.module.css` basename is unique** (each is named after its component). Applied uniformly to dev and production. Keep basenames unique.

## Session persistence

`src/engine/session.ts` persists `character`, `resources`, `dungeonHistory`, `activeRunId` as one `SessionState` blob under `notequest:session` (the same injectable-`storage` pattern as `graveyard.ts`).

`App.tsx` seeds four `useState` calls from one `loadSession()` on mount, then one `useEffect` re-persists the whole blob on any change.

**`screen`/`selectedRunId` aren't persisted** — a reload resumes wherever `world.player` physically was, or Character Creation if there's no character.

`handleNewAdventurer` nulls `character`/`resources`/`activeRunId` (leaving `dungeonHistory` untouched) — the persistence effect handles the rest.

**`loadSession()` back-fills** every optional field added over time (`advancedClasses ?? []`, `animals ?? []`, `hireling ?? null`, `flyActive ?? false`, and `maxSpellUses` by taking the higher of the creation-time computation or whatever `spellUses` already holds). This is the "optional field, back-compat default" convention's single most important site.

### Settings hard reset (#50)

`session.ts`/`graveyard.ts` export `clearSession()`/`clearGraveyard()` (same injectable-`storage` shape, wrapped in try/catch). `App.tsx`'s `handleHardReset()` calls both, resets every App-owned state field, and lands on `screen: "world"` (harmless — `character` is null, so the next render falls to Character Creation).

Note `clearSession()` only clears what's on disk at that instant — the persistence effect immediately re-writes `notequest:session` with `EMPTY_SESSION`'s shape, which round-trips fine.

UI: the shared `Footer` component, replacing 4 near-identical inline footers — takes `screenLabel` and `onHardReset`, and owns its own `ConfirmDialog`-gated "Settings" button. Rendered by all four screens (`WorldScreen` needs it threaded since it renders `TownScreen` in place rather than switching screens).

## React gotchas that bit this codebase

- **The dungeon reducer takes an extra `rng` parameter**, so it can't be passed directly to `useReducer` — `DungeonScreen.tsx` wraps it in a 2-arg `reduceDungeon`.
- **`StrictMode` runs effect cleanups once on mount.** `DungeonScreen`'s unmount cleanup guard (`stateRef.current.levels.length > 0`) is load-bearing beyond "don't save an empty run" — hanging any other side effect off it fires against the *initial* state on the way in. See [world.md](world.md)'s stamp/desync note.
- **`react-hooks/set-state-in-effect`**: apply outcomes in event handlers, not mount effects. The Portal panel's reveal-then-apply split exists precisely for this.
- **`react-hooks/rules-of-hooks` treats any `use`-prefixed function as a hook.** Plain engine functions are named `drinkConsumable()`, `resolveForgottenGods()` for exactly this reason.
- **`useZoomGesture` re-runs its attach effect on every render** (not gated on `[ref]`) since `WorldScreen`'s `<svg>` doesn't exist until the map view first appears.
- **Immer deep-freezes `produce()` output**, so anything re-fed into new state must be `structuredClone()`d — both dungeon resume paths do.
- **An overlay that lives inside a card can unmount mid-outcome.** Both the Portal panel and Warfare's `attackMessage` are lifted to `WorldScreen` because a successful outcome swaps the whole screen on the next render.
