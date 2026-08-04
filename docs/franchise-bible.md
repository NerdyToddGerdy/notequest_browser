# The GerdQuest Franchise Bible

The shared standard for every game published under the **GerdQuest** name.

Three titles are planned:

| Title                          | Shape                                          | Status            |
| ------------------------------ | ---------------------------------------------- | ----------------- |
| **GerdQuest: Realm of Depths** | Solo, dice-driven dungeon crawler and hexcrawl | Shipping (v4.0.0) |
| **GerdQuest: Idle Depths**     | Incremental / idle                             | Concept           |
| **GerdQuest: Isle Raid**       | Island conquest                                | Concept           |

**Two settled facts** that shape everything below:

1. **GerdQuest is currently a publisher label, not a shared universe** — like "Sid Meier's": a mark
   of who made it and what it feels like, not a promise that the games share a world. Shared lore is
   an open possibility rather than a rejected one; §8.1 sets out what adopting it would cost.
2. **Only _Realm of Depths_ adapts anyone else's rules.** _Idle Depths_ is original work _inspired
   by_ Clickpocalypse; _Isle Raid_ is original. §1.5 covers why "inspired by" and "adapted from" are
   different situations with different obligations.

---

## 1. The IP boundary

**This is the most important section in the document. Everything else is taste; this is not.**

_Realm of Depths_ is an **unofficial fan adaptation of NoteQuest**, a commercial tabletop game by
[Tiago Junges](https://www.drivethrurpg.com/en/product/365859/notequest-expanded-world?src=also_purchased).
Its races, classes, monsters, spells, dungeon tables and dice logic are **his work, not yours**.
`docs/game-rules-reference.md` is explicitly a transcription used as an implementation reference.

### The rule

> **NoteQuest-derived content stays inside _Realm of Depths_. It does not propagate to any other
> GerdQuest title, and it is never presented as part of "the GerdQuest universe."**

### Why this matters more under a franchise name than it did before

A single fan project that credits its source is a well-understood, well-tolerated thing. A _franchise_
implies a body of work with a common owner. If _Idle Depths_ inherits Realm of Depths' bestiary, or
if marketing describes "the world of GerdQuest" while that world is NoteQuest's, two bad things
happen at once: a second unlicensed derivative is created, and the original author's material gets
absorbed into someone else's brand identity. That is a materially worse posture than the project has
today, and it would be caused by the rename rather than by any new code.

### Safe to share across all three titles

- The **GerdQuest** name and title convention (§2)
- **Visual identity** — palette, typography, the die, layout motifs (§3)
- **Voice and tone** (§4)
- **Design vocabulary** — the _kinds_ of mechanic that feel like a GerdQuest game (§5)
- **Technical conventions** — stack, hosting, persistence, versioning discipline (§6)
- Any **original fiction** invented for the franchise

### Never shared

- Race, class, monster, spell, trap, treasure or terrain **tables** from NoteQuest
- The **specific rules** — 2d6 race generation, the torch/Darkness rule as written, Affinity,
  Advanced Class requirements, the Other Worlds, the dungeon-type tables
- **Named content** — Samambro, Pumpkinkin, the Slimemen, Pesadelum, Vimes, and so on
- The rulebook PDF, which stays `.gitignore`d, and the transcription in `docs/`

### 1.5 "Inspired by" is not "adapted from"

The two sibling titles sit on the _safe_ side of a line _Realm of Depths_ sits on the other side of,
and the distinction is worth stating because it decides who needs crediting.

**_Realm of Depths_ is an adaptation.** It implements NoteQuest's actual tables — the same rows, the
same dice, the same names. There is a transcription of the rulebook in this repo. That is derivative
work, and it carries a real attribution obligation, discharged by the credit block and the README.

**_Idle Depths_ is inspired by [Clickpocalypse II](https://play.google.com/store/apps/details?id=com.minmaxia.c2)**
— a retro idle dungeon crawler where an auto-exploring party clears maps, levels up and loots with
minimal clicking. Taking that _shape_ — a party that adventures without you, progression you check
in on — is taking a genre, and genres aren't owned. No attribution is required and none should be
implied.

The line between them, in practice:

| Safe — a genre or a feel                        | Not safe — someone's expression                    |
| ----------------------------------------------- | -------------------------------------------------- |
| "An idle party that clears dungeons on its own" | Copying its class list, item names or upgrade tree |
| "Progression you check back in on"              | Reproducing its specific numbers or formulas       |
| A retro/pixel presentation                      | Its art, sprites or UI layout                      |

Keep _Idle Depths_ firmly in the left column and it owes nobody anything. The moment a specific
table, name or curve is lifted, it changes category — and the bible's answer to that is the same as
for _Realm of Depths_: credit it plainly, prominently, and permanently.

### Attribution rules

1. Every title that adapts NoteQuest carries the credit block **prominently and permanently** — the
   footer on every screen, plus the README. See `src/ui/components/Footer/Footer.tsx`.
2. The credit is now the **only** disambiguator in _Realm of Depths_, for two compounding reasons:
   "GerdQuest" shares NoteQuest's own `word + Quest` shape, and the earlier "Nerdy Gerdy's"
   possessive — which made the fan-work status obvious at a glance — was dropped when GerdQuest
   became a series prefix. **Do not trim the credit line.** It is load-bearing, and the code says so.
3. Titles that adapt nothing carry **no** NoteQuest credit. Crediting a source you didn't use implies
   a relationship that doesn't exist.
4. If a shared GerdQuest landing page is ever built, it must not imply that _Realm of Depths_' rules
   are original franchise material.

---

## 2. Naming

### The convention

```
GerdQuest: <Two Words>
```

Two-word subtitles, title case, no articles. Established by all three titles:

- Realm of Depths _(three words, but "of" is a joint — reads as two beats)_
- Idle Depths
- Isle Raid

### The accident worth keeping

**Idle** and **Isle** are anagrams. **Depths** recurs across two titles. Neither was planned, but
both read as intentional, and a franchise benefits from looking designed. Two options for extending
this:

- **Shared noun** — a recurring second word (_Depths_) that marks the "core" line, with side titles
  free of it. This is how _Isle Raid_ already reads: a spin-off, not a mainline entry.
- **Anagram play** — a deliberate wink in future titles. Cheap, memorable, and nobody has to notice
  it for the names to work.

Pick one consciously rather than letting it drift.

### The wordmark

One `<h1>` containing both halves, so the accessible name and document title are the complete phrase:

```html
<h1>
  <small>GerdQuest</small>
  Realm of Depths
</h1>
```

The series prefix renders **small, uppercase, letter-spaced** above the installment name, which takes
the display size. The prefix is visually constant across titles; only the second line changes. Style
lives in each screen's `.module.css` under `.wordmark h1 small`.

### Availability discipline — non-negotiable for a new title

The name **Dicebound** was chosen, applied across the codebase, and only then discovered to be a
Google Play game — plus roughly five others. Several later candidates died the same way:
**Tallowmark** was itself a browser roguelite on GitHub; **Lampblack** was a solo RPG zine;
**Emberwick** a cozy idle RPG. The near-misses were all _in this exact genre_.

Before committing to any name, check **all** of:

| Where        | How                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------- |
| Steam        | `store.steampowered.com/search/?term=<name>`                                              |
| itch.io      | `itch.io/search?q=<name>`                                                                 |
| Google Play  | `play.google.com/store/search?q=<name>&c=apps`                                            |
| Web at large | plain search, in quotes                                                                   |
| GitHub       | `gh api "search/repositories?q=<name>+in:name" --jq .total_count`                         |
| npm          | `curl -so /dev/null -w "%{http_code}" https://registry.npmjs.org/<name>` — 404 means free |
| Domains      | `.com` / `.io` / `.app`                                                                   |

A hit in a **different** medium (a band, a paper size, a Kaijudo card) is usually survivable. A hit
in **games — especially dice, roguelike, solo-RPG or idle** — is not: that's the audience that will
search for you and find someone else.

**GerdQuest**, **Realm of Depths**, **Idle Depths** and **Isle Raid** should each be re-checked
before any public launch; only the first two have been verified, and availability rots.

---

## 3. Visual identity

The house look is **a character sheet lit by torchlight in a dark stone room**. Warm parchment
foreground on near-black, gold for anything interactive, red reserved for harm.

### Palette

Source of truth: `src/ui/theme/tokens.css`.

| Token                  | Value                 | Use                                        |
| ---------------------- | --------------------- | ------------------------------------------ |
| `--bg-0`               | `#0a0807`             | Page background, near-black                |
| `--bg-1`               | `#17110d`             | Raised dark surfaces                       |
| `--torch-core`         | `#ffc06a`             | Brightest flame                            |
| `--torch-mid`          | `#d9791f`             | Flame body, glows                          |
| `--ember`              | `#b8481f`             | Dying flame                                |
| `--gold`               | `#b8862f`             | Borders, labels, interactive affordance    |
| `--gold-bright`        | `#e0ac48`             | Wordmark, emphasis                         |
| `--parchment`          | `#e9ddc2`             | Primary paper surface                      |
| `--parchment-2` / `-3` | `#ddcca2` / `#cbb686` | Stacked-sheet layers, dividers             |
| `--ink`                | `#2a2016`             | Body text on parchment                     |
| `--ink-soft`           | `#5a4b38`             | Secondary text                             |
| `--danger`             | `#a63c1d`             | Damage, death, warnings                    |
| `--focus`              | `#f2c265`             | Focus ring — always visible, never removed |

**Committed dark:** `color-scheme: dark`, and `:root[data-theme="light"]` deliberately resolves to
the same values. This is one lit scene, not a document that should invert. A GerdQuest game does not
ship a light mode.

### Typography

All self-hosted `woff2`, all OFL, **no CDN**.

| Role             | Face                         | Used for                         |
| ---------------- | ---------------------------- | -------------------------------- |
| `--font-display` | **Metamorphous**             | Wordmark, headings, buttons      |
| `--font-body`    | **Spectral** (400/400i/600)  | Prose, flavour, descriptions     |
| `--font-mono`    | **JetBrains Mono** (400/700) | Numbers, stats, labels, eyebrows |

The split is semantic and worth preserving: **display for voice, body for fiction, mono for
anything a player counts.** HP, coins, torches and dice totals are always mono, tabular-lined.

### Motifs

- **The stacked sheet** — the parchment card sits on two rotated copies of itself
  (`.sheet::before` / `::after`), so the page looks like paper on a table.
- **The die** — `src/ui/components/Die/Die.tsx` is a real 3D CSS cube with six positioned faces, not
  an image swap. Driven by `value` + `rollToken`. **Reuse it verbatim in every title.** It is the
  single most recognisable asset the franchise owns.
- **Eyebrow + title** — a small mono uppercase label above a display-font heading. Used by the
  wordmark, the Town Square header, and section titles.
- **Ruled paper** — a repeating linear-gradient rule line behind sheet content.

---

## 4. Voice

Wry, plain, and honest about the odds. Never epic, never cute.

Real lines from the shipping game:

> _A weak adventurer, after fame and fortune. Good luck — you're gonna need it._
> _The dungeon is built as you explore it._
> _The town, between one dungeon and the next._
> _The darkness devours you. Without a torch, there is no way forward._
> _The blade finds its mark. The dungeon keeps what it took._

Rules of the voice:

- **State the mechanic.** "The dungeon is built as you explore it" is a tagline _and_ a spec.
- **Don't soften death.** No "unlucky!", no exclamation marks. The dungeon keeps what it took.
- **Second person, present tense.**
- **Em dashes for the turn**, not ellipses.
- **Tell the player the real odds** when it costs nothing — e.g. a House "loses a random item four
  times in six." Concealing probability isn't tension, it's just worse information.

---

## 5. Design vocabulary

A GerdQuest game doesn't have to share a world. It should share these instincts. A new title should
hit **at least three**.

1. **The d6 is the engine.** Everything resolves on ordinary dice, and the player can see the table.
   No hidden float multipliers.
2. **A resource that runs out and kills you.** Torches in _Realm of Depths_ — the depleting thing
   _is_ the timer, and the tension is entirely "one more room?"
3. **Permadeath, with a record of the dead.** Loss is permanent and the game remembers. The Graveyard
   lists every fallen character; their belongings stay where they fell for a successor to recover.
4. **Bookkeeping made visible.** These are pen-and-paper games with the arithmetic automated, not
   hidden. Show the roll, show the modifier, show the table row.
5. **The world outlives the character.** The map, the buildings, the dungeons you left unfinished all
   persist across lives. What you carried does not.
6. **Honest simplification.** Where a rule can't be modelled, it resolves as flavour and _says so_ in
   a comment, rather than being silently dropped.

### Applying these to the announced titles

**Idle Depths** — inspired by Clickpocalypse II's auto-exploring party. The natural fit is (2) and
(3): a depleting resource as the whole clock, and runs that genuinely _end_ rather than
soft-resetting into a prestige currency.

But (1) and (4) are where it earns the GerdQuest name rather than joining a crowded shelf. Idle games
almost universally hide their maths behind opaque multipliers and big-number notation; a GerdQuest
idle game should do the opposite — **show the die, show the table row, show why that hit landed.**
The party adventures without you, and when you check back the log tells you in plain language what
was rolled and what it cost. That is the same instinct that makes _Realm of Depths_ a transcription
rather than a black box, applied to a genre that doesn't usually get it.

Consequence worth planning for: visible tables mean the numbers must survive being looked at. Idle
progression usually leans on curves that are only tolerable _because_ they're hidden.

Naming caution: **Emberwick**, a cozy idle RPG about lanterns and gloom, already exists — the
idle-RPG shelf is exactly where §2's availability check matters most.

**Isle Raid** — (5) is the obvious spine: islands you take stay taken, across whoever leads the
raid. _Realm of Depths_ already proved this shape in `WorldState` (world-scoped) versus
`AdventurerResources` (character-scoped); the same split maps cleanly onto islands versus raiders.
(1) and (6) carry over unchanged. (2) probably becomes supply rather than light.

---

## 6. Technical conventions

Inherited from _Realm of Depths_ and worth keeping unless a title has a real reason to differ.

- **Stack** — React + TypeScript + Vite. Strict TS; `npm run build` typechecks before bundling.
- **Hosting** — static by default. _Realm of Depths_ ships to GitHub Pages, with `vite.config.ts`
  setting `base` conditionally on `process.env.GITHUB_ACTIONS`. **This is a starting point, not a
  franchise constraint** — see "Backends" below.
- **Persistence** — local-first. `localStorage`, one JSON blob per concern.
  **Never rename a storage key without a read-old-write-new migration.** _Realm of Depths_ keeps the
  historical `notequest:` prefix through two renames precisely because the keys hold every player's
  save; the prefix is invisible, so migrating it would be pure risk. Both keys carry a comment.
- **Engine / UI split** — pure logic in `src/engine/`, taking an injectable `RNG = () => number` so
  tests seed deterministically. UI never re-implements a roll.
- **Data-driven** — game tables live as typed data in `src/data/`, keyed by roll value. New content
  is a data edit, not a new code path.
- **Testing** — Vitest for engine logic; Playwright for anything that only exists end-to-end
  (persisted state → real rendered UI). **A regression test must be shown to fail against the
  unfixed code before it is kept.**
- **Versioning** — every push to `main` requires a version bump, a dated `CHANGELOG.md` section, and
  a matching `vX.Y.Z` tag. Major / Minor / Hotfix. History stays linear: rebase-merge, one release
  commit per version, tag on that commit.
- **`CLAUDE.md`** — each repo keeps a living architecture document explaining not just what the code
  does but _why the decisions were made_, including simplifications and rejected alternatives. This
  is the single highest-leverage convention in the project; carry it to every title.

### Backends

**A GerdQuest game may have a backend.** Static hosting is where _Realm of Depths_ started, not a
rule the franchise is bound by — and it isn't even permanent for that title: issues #119 (a global
cross-player Graveyard) and #6 (sharing open dungeons between players) both require one, and #29's
multiplayer work points the same way. _Isle Raid_, being a conquest game, is the likeliest of the
three to want one from the start.

What **is** a rule is the shape a backend takes, and #119 already settled it for the flagship:

> **The game must remain fully playable with the network down, or the backend gone entirely.**

Local state stays authoritative; the server augments. In _Realm of Depths_ that means
`notequest:graveyard` remains the player's own real history and the global board is an additional,
opt-in view over the top. Apply the same test to any new service: _if this endpoint 500s forever,
can someone still play the game they installed?_ If the answer is no, the feature has been built
in the wrong place.

Three reasons that principle is worth keeping even when a backend exists:

1. **These are single-player games at heart.** A dungeon crawl, an idle party and an island campaign
   are all things one person does alone. A server that gates solo play adds a failure mode without
   adding a feature.
2. **A static site is an artifact; a service is a commitment.** The moment there's a backend there
   are costs, uptime, backups, abuse handling and a privacy posture. Worth paying deliberately for
   leaderboards and shared worlds — not by accident for something that could have been local.
3. **Local-first survives you losing interest.** A static build keeps working untouched for years.
   Anything behind a server stops the day the bill does, so the part players own should not be
   behind it.

Practical notes for whenever the first one lands:

- **Identity** — #119 chose an anonymous UUID over accounts. Prefer that: no passwords, no email, no
  personal data to protect, and nothing to migrate if the service is retired.
- **Never make the backend the only copy** of anything a player would be upset to lose.
- **Keep it optional in the UI**, so a network failure degrades to a missing panel and not a broken
  screen.
- If a shared service ever spans titles (one global board across all three), that's a **franchise**
  service and belongs in a shared repo — see §8.3 and §8.4.

---

## 7. The titles

### GerdQuest: Realm of Depths — shipping

Solo, dice-driven dungeon crawler and hexcrawl. Browser, single-page, currently static.

Roll a character, descend into a procedurally-built dungeon room by room, and explore a hex world of
cities, fortresses, politics, warfare and four Other Worlds. Torches are the clock; death is
permanent; the world persists for whoever comes next.

- **Origin** — unofficial NoteQuest adaptation. **See §1. This is the only title with that status.**
- **Was** "NoteQuest (Browser)". Renamed in #113 once it had accumulated enough of its own systems.
- Repo slug and Pages URL deliberately unchanged by the rename.
- **Backend planned, not present.** #119 (global Graveyard) and #6 (shared open dungeons) will add
  the first one; both are scoped as opt-in augmentation over authoritative local state (§6).

### GerdQuest: Idle Depths — concept

Incremental / idle. A party that adventures while you're away.

- **Origin** — original work, _inspired by_ Clickpocalypse II (§1.5). Not derivative; carries no
  attribution obligation, and must not carry a NoteQuest credit.
- **The differentiator** — visible dice and visible tables in a genre that hides them (§5).

**Open:** setting; what the depleting resource is; whether a run ends permanently or prestiges;
whether the party is one character or several.

### GerdQuest: Isle Raid — concept

Island conquest.

**Open:** solo or multiplayer; real-time or turn-based; whether conquest persists across leaders (§5.5
suggests it should); how raids resolve — dice, per §5.1.

---

## 8. Open decisions

Listed so they're decided deliberately rather than by accident.

1. **Publisher label or shared universe?** Currently a label, with lore an open option. If you do
   pursue it, three things follow:
   - It must be built from **original** fiction (§1). _Realm of Depths_' world is the one place it
     cannot come from, which is awkward, because that's the only title with a world so far.
   - The cheapest honest version is **a shared frame, not a shared map** — a recurring narrator,
     archivist or cartographer figure who has _recorded_ all three, rather than three games set in
     one place. That connects them without asserting anything about anyone's setting, and it suits a
     franchise whose house style is already about bookkeeping and records (§5.4).
   - _Isle Raid_ and _Idle Depths_ are both greenfield, so lore invented for them is unencumbered.
     Start there rather than retrofitting the flagship.
2. ~~**Is _Idle Depths_ NoteQuest-derived?**~~ **Resolved** — no. Original work inspired by
   Clickpocalypse II; see §1.5.
3. **Where does this document live?** Currently `docs/` in the _Realm of Depths_ repo — versioned
   alongside the flagship, but odd for a document governing three projects. A `gerdquest` org, or a
   small shared repo, would be a better long-term home.
4. **Shared code.** The `Die` component, the theme tokens and the fonts are the obvious candidates
   for a small shared package. Not worth extracting until the second title actually starts.
5. **Naming pattern** — recurring _Depths_ for mainline titles, or anagram play, or neither (§2).
6. **A franchise landing page**, and whether it can describe all three without implying NoteQuest's
   content is franchise material (§1, rule 4).
