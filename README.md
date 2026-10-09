
# First Byte — Git and GitHub Mystery

Case FB-01. A morning briefing was filed, then vanished from the archive. Two fragments
survived — one only in this repository's history, one in a courier manifest. Recover both,
propose one conclusion that carries both facts, and merge it through two pull requests of
your own.

This repository is the **starter repository** a learner clones. It holds three areas:

| Area | Path | What it is |
| --- | --- | --- |
| Concept slides | `slides/` | Slidev deck on port 3030 |
| Progress dashboard | `dashboard/` | Progress and steps on port 3031 |
| Activity folder | `activity/case/` | Case evidence and the case summary you edit |

The app source is never something a learner needs to touch.

## Get the starter repository

```bash
git clone https://github.com/universitysjp/git-mystery.git
cd git-mystery
```

## Prerequisites

- Git, with an author identity configured
- [Bun](https://bun.sh) 1.1.0 or newer
- A code editor
- A GitHub account, signed in, able to authenticate a push

```bash
git --version
bun --version
git config --global user.name "Your Name"
git config --global user.email you@example.com
```

## Run the workshop app

```bash
bun install
bun run start
```

One command starts the slides on `http://127.0.0.1:3030` and the dashboard on
`http://127.0.0.1:3031`, waits for both to answer, and opens both in your browser.
Stopping the command stops both. If either port is occupied, the app says so and prints the
recovery command rather than moving to a different port.

## Commands

| Command | What it does |
| --- | --- |
| `bun run start` | Launch both local pages |
| `bun run dashboard` | Dashboard only, on 3031 |
| `bun run slides` | Slides only, on 3030 |
| `bun run seed` | Seed the case history (only on a fresh copy of the starter) |
| `bun run rehearse` | Drive every mission in throwaway repositories and report the outcome |
| `bun run sync-fonts` | Copy the Instrument Sans font file into both static folders |
| `bun run test` | Run the test suite in `tests/` |

## Learner flow

Missions run in a fixed order and share one identifier across the slides, the dashboard,
and the learner guide:

`M0` arrive · `M1` publish a baseline · `M2` inspect the case · `M3` make a local finding ·
`M4` save the finding · `M5` prepare two leads · `M6` open two pull requests ·
`M7` encounter and resolve · `M8` finish and retrieve

The dashboard shows the current mission, its checkpoint, and what to do next. Checkpoints
read from Git are labelled **verified**; GitHub steps are labelled **self-confirmed**,
because the app never touches your GitHub account.

The full follow-along guide is served locally at `http://127.0.0.1:3031/guide.html`.
It includes every mission and recovery help without revealing the mystery answers.
The [workshop overview and prerequisites](https://docs.icts.fyi/docs/en/workshops/first-byte-episode-1)
are on ICTS Docs.

## How progress is stored

Answers, self-confirmations, and captured checkpoints live in
`.workshop-state/progress.json`, which is git-ignored. Everything else is re-derived from
Git on every request, so restarting the app keeps your answers and recomputes your Git
state. Resetting progress never touches a case file or a commit.

The dashboard runs a fixed set of read-only Git commands with fixed argument arrays. It has
no shell, no user-supplied command strings, and no mutating command.

## Tests

```bash
bun run test
```

Tests drive real Git repositories and the dashboard's browser script:

- `tests/missions.test.mjs` — the history fixture, mission evaluation, and a full conflict
  rehearsal: two leads from one base, a real merge conflict on the designated line, a local
  resolution, and a final summary carrying both findings.
- `tests/server.test.mjs` — the dashboard HTTP surface against a temporary checkout and a
  bare remote: answers, checkpoints, self-confirmations, reset, malformed requests, and a
  check that nothing in the repository changed.
- `tests/startup.test.mjs` — the one start command, both ports answering, clean shutdown,
  and occupied-port errors for both servers.
- `tests/readiness.test.mjs` — wrong branch bases, checkpoint validation, PR flow,
  and unresolved conflict markers.
- `tests/dashboard.test.mjs` — usable mission controls, local guide navigation,
  and the completed dashboard in a DOM environment.

Build the slide deck with `bun run build:slides`.

Run the rehearsal on its own any time with `bun run rehearse`.

## Design

Both surfaces share one token set in `dashboard/public/tokens.css`, mirrored into
`slides/style.css`. `#4255ff` is the only saturated colour; everything else is a desaturated
gray or an off-white surface. Type is Instrument Sans, copied from Fontsource by
`bun run sync-fonts` so both pages render offline with no webfont request.

## Publishing the starter repository

```bash
bun run seed
```

`bun run seed` writes the authored clue-bearing history: four commits that open the case,
file the courier manifest, remove the sign-off line from the handover note, and add the
workshop app. The sign-off detail survives only inside the commit that removed it, which is
what `git log` and `git show` are for. Run it on a fresh copy only; it refuses to touch a
repository that already has commits.

## Licence and provenance

Instrument Sans is licensed under the SIL Open Font License 1.1. Slidev, UnoCSS, and Shiki
come from the checked-in lockfile.


>>>>>>> dff5f872cf11a801b219790ed78d8488351c891b
