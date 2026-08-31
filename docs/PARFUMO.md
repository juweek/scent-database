# Scoping a second source: Parfumo

Status: **scoping, nothing built.** No Parfumo data is in the repo. This
records what adding it would involve, in the order the decisions have to be
made, so the expensive questions get answered before any code.

Read [`FRAGRANCE-DATA.md`](FRAGRANCE-DATA.md) first — particularly "Who
actually writes this data". Parfumo is a second community of the same kind, not
an independent measurement, and most of what follows exists because of that.

## What it is

The [Parfumo Fragrance Dataset](https://www.kaggle.com/datasets/olgagmiufana1/parfumo-fragrance-dataset)
is a scrape of Parfumo.com by olgagmiufana1 — the same person who produced the
Fragrantica CSV this project already uses. It is also mirrored, as a plain CSV
on GitHub, by
[TidyTuesday 2024-12-10](https://github.com/rfordatascience/tidytuesday/blob/main/data/2024/2024-12-10/readme.md),
which is the easier fetch (no Kaggle account).

Columns:

```
Number  Name  Brand  Release_Year  Concentration  Rating_Value  Rating_Count
Main_Accords  Top_Notes  Middle_Notes  Base_Notes  Perfumers  URL
```

Against what we hold today, three of those are new and load-bearing:

| Column          | What it unlocks                                                         |
| --------------- | ----------------------------------------------------------------------- |
| `Release_Year`  | A wheel that moves through time — when oud arrived, when aldehydes left |
| `Perfumers`     | One nose's signature pairings as a chord diagram                        |
| `Concentration` | Disambiguates flankers, which is what makes a perfume-level join viable |

`Main_Accords` is a fourth: an independent editorial grouping we can check our
own ten families against, rather than a replacement for them.

## Phase 0 — the license question. Blocking.

**Do not bake anything until this is answered.** The Fragrantica source is
CC BY-NC-SA 4.0: non-commercial _and_ share-alike. The Parfumo dataset's
license is not stated on the TidyTuesday readme, and we have not read it off
the Kaggle page directly (Kaggle blocks automated fetches — someone has to open
it in a browser).

Three outcomes, with different amounts of work behind them:

1. **Compatible or more permissive** → proceed, attribute both, keep the
   share-alike obligation on the published artifacts.
2. **Incompatible or unstated** → do not merge the two into one database. A
   separate, separately-licensed, separately-attributed Parfumo wheel is still
   fine, and Phase 1 below is designed so that it is the default outcome rather
   than a fallback.
3. **Explicitly restrictive** → stop. Use Parfica Open Data (CC0) for
   vocabulary only.

Note that outcome 2 costs almost nothing relative to outcome 1, and answers the
most interesting question anyway (see Phase 1). Resist the urge to treat a
merged record table as the goal.

## Phase 1 — bake it as its own wheel. Do this first.

Cheapest step, highest information. No joins, no crosswalk, no license mixing:
run the existing pipeline over the Parfumo CSV and produce a parallel set of
matrices. Then ask whether the two communities agree.

`bake.py` currently hardcodes one schema — `;` delimiter, `cp1252`, and the
column names `Perfume` / `Brand` / `Rating Value` / `Rating Count` / `Top` /
`Middle` / `Base` / `url`. The change is a source profile, not a rewrite:

```python
SOURCES = {
    "fragrantica": {
        "delimiter": ";", "encoding": "cp1252",
        "name": "Perfume", "brand": "Brand", "url": "url",
        "rating": "Rating Value", "ratings": "Rating Count",
        "tiers": ("Top", "Middle", "Base"),
    },
    "parfumo": {
        "delimiter": ",", "encoding": "utf-8",
        "name": "Name", "brand": "Brand", "url": "URL",
        "rating": "Rating_Value", "ratings": "Rating_Count",
        "tiers": ("Top_Notes", "Middle_Notes", "Base_Notes"),
        "year": "Release_Year", "perfumers": "Perfumers",
    },
}
```

Two details that will bite:

- **Rating scales almost certainly differ.** Fragrantica is out of 5; Parfumo
  is believed to be out of 10. `bake.py`'s `quality` score and the `best`
  matrix's `>= 4.0` cutoff both assume 5. Verify before ranking anything, and
  normalise in the adapter rather than at the call sites.
- **`--note-limit`, `--limit`, and the 140-note truncation are tuned to a
  24k-record corpus.** Re-check them against Parfumo's record count rather than
  inheriting them.

### The payoff: cross-source agreement

Once both matrices exist, compute lift on each independently and compare the
rankings for the same note. That gives a confidence signal nothing else can:

- **High lift in both** → a real, community-independent pairing.
- **High lift in one only** → an artifact of that site's editing conventions.

We already know this failure mode exists inside a _single_ source: on the
current wheel, `oak moss × vanille` scores 6.3x while the majority-spelling
equivalent `oakmoss × vanilla` scores 0.84x, because minority spellings cluster
in the same records. A second community is the cleanest available test for how
much of any given ranking is perfumery and how much is transcription.

This is publishable on its own — "pairings both databases agree on" is a better
claim than anything either makes alone — and it needs no record-level join.

## Phase 2 — the note vocabulary crosswalk

Required before any comparison is meaningful, because the two sites will not
spell notes the same way, and _ours does not even spell them consistently with
itself_.

Deliverable: a checked-in table, not code.

```csv
raw_label,source,canonical_note,decided_by,note
oak moss,fragrantica,oakmoss,juweek,spelling variant
oakmoss,fragrantica,oakmoss,juweek,majority spelling
vanille,fragrantica,vanilla,juweek,spelling variant
bulgarian rose,fragrantica,?,,marketing origin distinction — merge or keep?
```

Use [Parfica Open Data](https://github.com/parfica/parfica-open-data) (CC0) as
the canonical spine where it has coverage, so the vocabulary layer carries a
clean license regardless of what Phase 0 decides about the records.

Two classes of decision hide in here, and they should be recorded separately:

- **Spelling variants** — `oak moss`/`oakmoss`. Uncontroversial merges. Four
  are already identified and recorded in `accord.json`'s `aliases`; the
  pairings panel suppresses them, but the arcs are still split.
- **Marketing distinctions** — `bulgarian rose`/`damask rose`/`turkish rose`.
  Merging these is an editorial claim about perfumery, not a data cleanup.
  Decide deliberately and write down who decided.

Doing Phase 2 fixes the existing wheel whether or not Parfumo ever lands. That
makes it the safest thing to build next after Phase 1.

## Phase 3 — perfume-level entity resolution

Only needed if the goal is merged per-perfume records. Hardest phase; defer
until Phases 1 and 2 have paid for themselves.

Match key: normalised `brand` + normalised `name` + `Release_Year`, with
`Concentration` splitting flankers. Expect an incomplete join — brand renames,
reissues, regional exclusives, and the flanker problem ("Eau de Parfum" vs
"Intense" vs "Elixir", sometimes in the name field and sometimes not) all
resist matching. **Budget for a match rate well under 100% and design the UI to
say so**, in the same voice the note lists already use ("showing the top 100 of
5,324").

Before this phase, adopt the per-fact provenance model already described in
`FRAGRANCE-DATA.md` — `source`, `source_record_id`, `source_version`,
`license`, `observed_at`. Retrofitting it after a merge is much worse than
adding it before. Start by backfilling it onto the classification layers we
author ourselves, which carry no provenance at all today.

## Phase 4 — what the merged data unlocks

Sequenced by ratio of interest to effort:

1. **Time slider on the accord wheel** (needs `Release_Year` only — available
   from Phase 1, no join required). Watch oud arrive and aldehydes recede.
   This is the single best return in the whole document.
2. **Perfumer wheel** (needs `Perfumers` only — also Phase 1). One nose's
   pairings against the field.
3. **Accord cross-check** (needs `Main_Accords` + Phase 2). Does our ten-family
   grouping survive contact with an independent taxonomy?
4. **Merged co-occurrence matrix** (needs Phase 3 + a clean Phase 0). The
   obvious goal, and the least interesting one — it mostly buys sample size,
   and sample size is not what is limiting these wheels.

## Open questions

- [ ] What license does the Kaggle Parfumo dataset actually carry? _(blocking)_
- [ ] How many records, after the same `>= 2 notes` filter `bake.py` applies?
- [ ] Is `Rating_Value` on a 1–10 scale?
- [ ] How much do the two note vocabularies overlap once normalised?
- [ ] Do we want merged records at all, or two sources kept deliberately apart
      and compared? _(Phase 1 may well answer this by making the comparison the
      more interesting product.)_
