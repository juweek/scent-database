# The Accord Wheel

Three interactive chord diagrams of perfume note pairings, drawn from the
Fragrantica dataset (24,059 fragrances). Ported from three standalone HTML
prototypes onto the [Gourmet Data template](../gourmet-data-template).

```sh
npm install
npm run start    # → http://localhost:5173
npm run build
npm run preview
```

`npm run start` and `npm run dev` are the same thing — both run Vite.

## The three wheels

| Route            | Rings                                   | Controls                                              |
| ---------------- | --------------------------------------- | ----------------------------------------------------- |
| `/wheel/accord`  | ribbons + family band                   | fragrance set · note search · threshold · family bars |
| `/wheel/family`  | ribbons + family band                   | fragrance set · ribbon weight · family bars           |
| `/wheel/pyramid` | ribbons + **accord band** + family band | pyramid layer · threshold · family bars               |

A ribbon means two notes appear in the same fragrance; its width is how often.
It is **not** a claim that perfumers consider the pair good.

Searching a note on `/wheel/accord` lists the perfumes that carry it; selecting
a family bar narrows that list to perfumes carrying the note _and_ a note from
that family. The note stays selected when you pick a family, so the two filters
compose.

Every wheel supports the same interactions: hover or tap a ribbon for the
centre readout, tap a ribbon to pin its record-level perfume examples, select a
family bar or arc to isolate it, and tap empty space to clear. The pyramid's two
bands isolate independently — pick a family, then one accord inside it.

## Architecture

```
src/wheels/<slug>.js   the spec: bands, controls, readout, constants
src/viz/chordEngine.js the canvas engine — layout, draw, hit test (no React)
src/viz/ChordWheel.jsx React wrapper: owns interaction state, wires pointers
src/components/Controls.jsx  Toggle · Slider · Search · FamilyBars
src/pages/WheelPage.jsx composes stage + controls + perfume matches
src/data/fragranceMatches.js lazily fetches one record partition after selection
src/data/noteMatches.js       per-note perfume lists, paged (see below)
scripts/pipeline/bake.py validates and builds the record partitions
```

Adding a fourth wheel = one JSON in `src/data/wheels/`, one spec in
`src/wheels/`, one entry in `src/data/wheels.js`. Nothing else changes.

A spec declares its `bands` (radius, width, hit radius, alpha rules), its
`controls`, a `resolve(view)` that returns `{ names, matrix, colorOf, … }`, and
a `readout()`. The engine reads only that.

### Two things worth knowing

**Interaction state lives in a ref, not `useState`.** Pointer moves repaint at
animation-frame rate; re-rendering React on every move would drop frames. Only
the centre readout is pushed back into React. The occasional travelling pulse
uses a separate transparent canvas, so it never redraws thousands of ribbons.

**Canvas, not SVG.** At 140 notes a chord diagram is ~10,000 ribbons — as SVG
that is 10,000 DOM nodes, which is what made the prototypes stutter. The canvas
keeps a fixed logical size and is scaled by CSS; hit testing converts through
the measured rect, so CSS scaling can't desync it.

## Dependencies

Five at runtime: `react`, `react-dom`, `react-router-dom`, `d3-chord`,
`d3-array`. The prototypes used exactly four d3 functions (`chord`, `ribbon`,
`min`, `descending`), so the monolithic `d3` was never needed. Both d3 packages
are dynamic-imported by submodule, and each wheel's JSON and spec are their own
chunks — a visitor downloads only the wheel they open.

No Tailwind, no webfonts, no CSS framework: `src/index.css` is the prototypes'
own stylesheet with system font stacks in place of Fraunces/Inter.

## Data

Baked static JSON in `src/data/wheels/`. No API, no key, nothing to keep
running. Record-level perfume examples live in 251 small partitions under
`public/data/fragrances/by-note/` and load only after a ribbon is pinned.

That pair index stores each pair **once**, under the alphabetically first note,
which halves its size but means it cannot answer "which perfumes have this
note" — half of a note's pairs live in other notes' files, so a full answer
would touch ~192 files / ~10 MB. `public/data/fragrances/by-note-index/` holds
the inverted per-note view instead: page 1 (~2.6 KB gzipped) carries the
headline list and the top 20 of every family, and `<note>.2.json` holds the
long tail, fetched only when a reader taps "show more". Rebuild
them with `npm run bake:data -- --source /path/to/fra_cleaned.csv
--source-version 3`, which also writes the per-note index.

Counts there are **exact** — 6,133 perfumes carry rose, 5,324 of them alongside
a floral note — because the baker sees every record. The record _lists_ are
capped by `--note-limit` (100), since no one scrolls five thousand rows in a
sidebar: each entry carries both `total` (true) and `held` (retained), and the
UI says "showing the top 100 of 5,324" rather than reporting the cap as fact.
Raise the flag if you want deeper lists; it only grows page 2.

Without the source CSV, `python3 scripts/pipeline/note_index.py` rebuilds the
per-note index by inverting the pair files already in the repo. That needs no
download, but it inherits the pair index's `examplesPerPair` cap, so its lists
are notable examples rather than every match (`exhaustive: false` in its
`metadata.json`). The baker records its input checksum, version, license, and
validation counts in `public/data/fragrances/metadata.json`.

See [`docs/FRAGRANCE-DATA.md`](docs/FRAGRANCE-DATA.md) for licensing constraints,
open enrichment sources, and the long-term refresh model.

## Deploying

`vercel.json` rewrites all paths to `index.html` so `/wheel/accord` deep-links
work. Static build, no serverless functions, no secrets.
See `docs/EMBEDDING.md` for iframe embedding.
