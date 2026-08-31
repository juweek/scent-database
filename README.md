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
| `/wheel/accords` | ribbons + family band                   | ribbon weight · accord search · threshold · families  |
| `/wheel/pyramid` | ribbons + **accord band** + family band | pyramid layer · threshold · family bars               |
| `/perfume/:id`   | one perfume, three rings                | perfume search · ribbon weight · arrangement          |

A ribbon means two notes appear in the same fragrance; its width is how often.
It is **not** a claim that perfumers consider the pair good.

Searching a note on `/wheel/accord` ranks its partners and lists the perfumes
that carry it; selecting a family bar narrows both to perfumes carrying the
note _and_ a note from that family. The note stays selected when you pick a
family, so the two filters compose.

The partner ranking offers two orderings, because they disagree and the
disagreement is the finding. **Most often** is raw co-occurrence, and is mostly
musk, jasmine and sandalwood for every note, because those are in everything.
**Most distinctive** divides that by how common each note is on its own —
`lift = P(A,B) / P(A)P(B)` — which turns rose's list into carnation, aldehydes
and orris root, i.e. the vintage rose chypre. Picking a row pins the pair and
loads its perfumes, the same as tapping the ribbon.

Neither ordering is a recommendation. See "Two notes on reading this data"
below.

Every wheel supports the same interactions: hover or tap a ribbon for the
centre readout, tap a ribbon to pin its record-level perfume examples, select a
family bar or arc to isolate it, and tap empty space to clear. The pyramid's two
bands isolate independently — pick a family, then one accord inside it.

## The accords wheel

`/wheel/accords` sits at the grain between the ten families and the 140 notes,
and unlike either it uses **the source's own vocabulary** — `mainaccord1..5`,
which Fragrantica's community votes on. 56 accords survive a floor of 40
perfumes; 28 rarer ones are dropped.

Two matrices, kept in the same unit so the threshold slider stays meaningful:

- **together** — how many perfumes carry both accords.
- **beyond chance** — how many _more_ than independence predicts. Pairs rarer
  than chance clamp to zero and draw nothing, which is a finding rather than a
  gap: citrus and woody share 4,665 perfumes and are still 277 short of what
  independence would give.

The two disagree usefully. By raw count the top pairs are aromatic × woody and
citrus × woody, which is just "common things are common". Beyond chance, and by
lift, you get `aquatic × ozonic` at 12.6×, `earthy × mossy` at 10.1× and
`animalic × leather` at 7.5× — the marine genre, the chypre floor, and the
leather accord, found by counting.

**Rank weights the arc, not the ribbon.** Weighting ribbons by `mainaccord`
rank was built, measured and dropped: its top-20 pairs overlapped raw
co-occurrence 18 times out of 20, because an accord's rank correlates with how
common it is. Per accord it is genuinely informative — smoky averages position
3.71 and leads only 5% of perfumes, citrus averages 2.50 and leads 35% — so
`meanRank` and `leadShare` ride on each accord and the readout reports whether
an accord leads or supports.

The wheel's two matrices peak at 5,034 and 2,182, so its spec exposes a
`slider(view)`; `WheelPage` uses it to resize the threshold per view and clamps
the live value into range. Wheels without one keep their static slider.

## The perfume tab

`/perfume` is not a wheel. The three wheels aggregate 24,059 records into one
picture; this takes one record apart, and it answers a different question — is
_this_ combination ordinary or strange?

Four readings of one bottle, all from a single fetch:

- **Three rings.** Reading outward: the note, its family, and the tier the
  brand declared it in. Only the ring you **arrange by** merges into big clean
  arcs — the other stays segmented, which is honest about a note having one
  position and two overlapping memberships. `note → family` covers 91% of note
  instances (median 94% per perfume); the rest render neutral rather than being
  forced into a family.

  Every arc is live. Hovering or tapping a **note** arc reads out its three
  memberships — note, family, tier — plus the accord and how many of the 24,050
  perfumes carry it; a **family** or **tier** arc reads out its whole run.
  Clicking pins, clicking the same arc again unpins, and clicking empty space
  inside the diagram clears — the same gesture the wheels use.

  A fourth ring for the note's _accord_ was built and removed. At 84 accords it
  fragmented into segments too narrow to label on anything but a six-note
  perfume, and four stacked rings read as one striped smear rather than as a
  hierarchy. The accord is still on the page where it has room to be legible:
  in the centre readout on hover, and in the main-accord bars.

- **The chord.** Its notes, and the pairings between them. Inside one perfume
  every pair co-occurs exactly once, so ribbons are weighted by the whole
  catalogue instead: **conventional** is how many of the 24,050 perfumes pair
  those two notes, **distinctive** is how far that beats chance. A thick even
  web is a composition assembled from well-worn combinations; one bright ribbon
  is the unusual move. Same two readings, same arithmetic, as the note wheel's
  pairing panel.
- **The pyramid.** Top, heart and base as the brand declared them — three
  stacked bands rather than a triangle, because the tiers claim volatility, not
  proportion, and a taper would encode a quantity the data does not have.
- **The accord bars.** `mainaccord1..5`, coloured by family. Bar length is
  **rank**, not vote strength: the dataset carries the order Fragrantica
  publishes but not the weights it draws, and inventing them would be a lie in
  the shape of a chart.
- **Smells like this.** Jaccard over note sets. Concentration variants and
  flankers are budgeted separately, so Angel's list is Silver Light and River of
  Love rather than five other Angels — and Aventus turns up Club de Nuit
  Intense and Supremacy Silver, which is the metric finding real dupes.

The chord is **SVG**, deliberately unlike `src/viz/chordEngine.js`. That engine
exists because the accord wheel is ~10,000 ribbons; a perfume is at most 24
notes and 276 ribbons, and typically nine notes and 36, where SVG costs nothing
and gives hit testing, hover and crisp labels for free.

Ribbon weights span three orders of magnitude, so they are drawn on a
compressive scale — without it the rare pairing is a sub-pixel sliver and the
diagram says nothing. In distinctive mode lift is additionally damped toward 1
by how little support it has, so a pair seen 15 times cannot outshout one seen
485 times.

## Architecture

```
src/wheels/<slug>.js   the spec: bands, controls, readout, constants
src/viz/chordEngine.js the canvas engine — layout, draw, hit test (no React)
src/viz/ChordWheel.jsx React wrapper: owns interaction state, wires pointers
src/components/Controls.jsx  Toggle · Slider · Search · FamilyBars
src/pages/WheelPage.jsx composes stage + controls + perfume matches
src/data/fragranceMatches.js lazily fetches one record partition after selection
src/data/noteMatches.js       per-note perfume lists, paged (see below)
src/data/notePairings.js      ranks a note's partners (count and lift)
src/data/perfumeIndex.js      search + one perfume's record (see /perfume)
src/pages/PerfumePage.jsx     chord + pyramid + accord bars + lookalikes
src/viz/PerfumeChord.jsx      the single-perfume chord, in SVG
scripts/pipeline/bake.py validates and builds the record partitions
scripts/pipeline/note_totals.py stamps per-note totals onto the accord wheel
scripts/pipeline/perfume_index.py builds the per-perfume index
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

`src/data/wheels/accord.json` also carries a `totals` object — the true number
of perfumes behind each of the 140 notes — because the matrix diagonal is
zeroed and lift needs that denominator. `npm run bake:totals` regenerates it by
reading the per-note index, so it needs no CSV and can run any time; it also
refuses to write if a pair count ever exceeds a note's own total, which is what
a mismatched matrix and index look like. It rides in the lazily-loaded accord
chunk (+2.5 KB), so the other wheels pay nothing for it.

Without the source CSV, `python3 scripts/pipeline/note_index.py` rebuilds the
per-note index by inverting the pair files already in the repo. That needs no
download, but it inherits the pair index's `examplesPerPair` cap, so its lists
are notable examples rather than every match (`exhaustive: false` in its
`metadata.json`). The baker records its input checksum, version, license, and
validation counts in `public/data/fragrances/metadata.json`.

`npm run bake:accords -- --source /path/to/fra_cleaned.csv --source-version 3`
rebuilds `src/data/wheels/accords.json` (20 KB, its own lazy chunk).

The perfume tab has its own index under `public/data/perfumes/`, built by
`npm run bake:perfumes -- --source /path/to/fra_cleaned.csv --source-version 3`.
Records are **self-sufficient**: each carries its own note totals, its own pair
counts, and its neighbours' names, so the whole page renders from one fetch
(~35 KB gzipped) instead of five round trips. That costs disk — 28 MB, roughly
doubling `public/` — which is the deliberate trade. If the repo size ever
matters more than the build being reproducible from a checkout, gitignore
`public/data/perfumes/` and bake it in CI instead.

See [`docs/FRAGRANCE-DATA.md`](docs/FRAGRANCE-DATA.md) for licensing constraints,
who authors each layer of this data, open enrichment sources, and the long-term
refresh model. [`docs/PARFUMO.md`](docs/PARFUMO.md) scopes adding a second
community database.

## Two notes on reading this data

**The family vocabulary had two impostors.** `accord.json` defines ten
families, but `pyramid.json` emitted twelve — the extras being `green` and
`white floral`, which are accords that were never folded up. They carry no
colour in the palette, so anything using them rendered flat grey with no legend
entry: 42 notes across the pyramid tiers plus three accords.
`src/data/accordFamily.js` now normalises them into the ten, following the call
`accord.json` had already made (green notes and galbanum are _fresh_; tuberose,
gardenia and jasmine are _floral_). The accord baker refuses to write if a
non-family ever appears again.

**A ribbon is co-occurrence, not endorsement.** It says two notes were listed
on the same bottle. That record is as much a history of marketing copy and
community editing as of perfumery — see
[`docs/FRAGRANCE-DATA.md`](docs/FRAGRANCE-DATA.md) for who actually writes
these note lists.

**Two files disagree about note families.** `accord.json` states a note's
family directly; `pyramid.json` derives it from the note's accord. They
disagree on **45 of the 140 notes they share** — pyramid makes bergamot
"spicy" via the fresh-spicy accord, and neroli "floral". `accord.json` wins in
`src/data/noteTaxonomy.js`, because it is what the Notes wheel actually draws;
pyramid fills in the other 112 notes. Without that precedence the perfume chord
colours bergamot spicy while the wheel two tabs over colours it citrus.

**The note vocabulary has spelling collisions.** "oakmoss" and "oak moss" are
both arcs on the wheel, as are vanilla/vanille, clove/cloves, and woody
notes/woodsy notes. A record uses one spelling or the other, essentially never
both — oak moss and oakmoss co-occur zero times in 24,059 perfumes. That splits
their counts, and it inflates lift between minority spellings: `oak moss ×
vanille` scores 6.3x, while the majority pair `oakmoss × vanilla` scores 0.84x.
The 6.3x is measuring who typed the record, not what the perfumer did.

Merging them would change the wheel itself (140 arcs becomes 136), so the
pipeline only records the collisions, in `accord.json`'s `aliases`. The
pairings panel drops a note's own alias from its ranking and says in the panel
that the other spelling exists.

## Deploying

`vercel.json` rewrites all paths to `index.html` so `/wheel/accord` deep-links
work. Static build, no serverless functions, no secrets.
See `docs/EMBEDDING.md` for iframe embedding.
