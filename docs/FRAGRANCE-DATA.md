# Fragrance data strategy

## What ships today

The visualization is a reproducible static build from version 3 of the
[Kaggle Fragrantica dataset](https://www.kaggle.com/datasets/olgagmiufana1/fragrantica-com-fragrance-dataset).
Kaggle currently reports that snapshot as last updated September 21, 2024 and
licensed CC BY-NC-SA 4.0. The aggregate wheel matrices load per route; the
record-level perfume examples are split into 251 note partitions and fetched
only when a visitor pins a ribbon.

Every refresh should record the upstream version, file checksum, license,
record count, vocabulary size, and pair count. `bake.py` writes those fields to
`public/data/fragrances/metadata.json` and fails early if the source schema
changes.

The CC BY-NC-SA license is the most important product constraint: it is
non-commercial and share-alike. Treat any commercial deployment or mixed-source
database as a licensing review, not as a routine engineering decision.

## Who actually writes this data

Every number on the wheels has passed through four hands, and only the last one
is ours. Knowing which hand set which field is the difference between reading
the wheel as perfumery and reading it as publishing.

**1. The brand, in marketing copy.** A perfume's note pyramid begins life in a
press release or a product page. Formulas are trade secrets — nobody outside
the house sees the actual materials or their proportions — so the pyramid is a
_description written to sell a bottle_, not a recipe. This has consequences
that survive all the way into the chord diagrams:

- Many notes name an impression rather than a material. "Sea notes", "rain",
  and "leather" have no single substance behind them.
- Conversely, materials that genuinely dominate modern formulas — hedione,
  Iso E Super, Ambroxan — are usually absent, because they are unglamorous to
  print. What the wheel shows is closer to _what perfume is sold as_ than to
  what is in the bottle.
- Nothing is quantitative. A note listed at 0.01% and one at 15% are the same
  fact here.

**2. Fragrantica's editors and community.** Fragrantica is a community
database. Its note lists are transcribed and edited from brand material by
staff and registered contributors; separately, logged-in users vote on the
"main accords" bars. So the note list is a crowd's transcription of marketing
copy, with the coverage and consistency you would expect from that: older and
niche releases are thinner, and the same material arrives under different
labels depending on who typed it. This is the origin of the spelling
collisions the wheel still carries — "oakmoss" (1,914 perfumes) and "oak moss"
(304) are the same lichen, and they co-occur in exactly zero records.

**3. The Kaggle scraper.** `fra_cleaned.csv` is a September 2024 scrape by
olgagmiufana1, which adds a parsing and encoding layer of its own — the
`--encoding cp1252` default in `bake.py` is a fossil of it. We pin the file's
SHA-256 in `metadata.json` so a given build is reproducible, but we did not
observe the scrape and cannot audit what it dropped.

**4. Us.** Three decisions in this repo are editorial, not upstream:

- **The ten scent families are ours.** `accord.json`'s `groups` maps each note
  to one of citrus, fresh, herbal, floral, fruity, sweet, spicy, amber, woody,
  musky. Fragrantica publishes a different taxonomy; we do not use it. These
  are judgement calls and some are arguable — we file leather under _musky_
  and oakmoss under _woody_.
- **A note gets exactly one family.** Real materials are not so obedient.
- **The wheel is truncated.** 252 notes are indexed; the accord wheel draws the
  140 most common, the pyramid wheel 130 per tier. A pairing's absence from the
  wheel is not evidence it does not exist.

Neither `accord.json` nor `pyramid.json` currently records _which_ of these
layers authored a given field. The durable model below says every fact should
carry `source`, `source_version`, and `license`; the classification layers do
not yet, and should before a second source is mixed in.

### Worked example: rose

What the pipeline holds for one note, and who decided each part.

```
rose
├── name           "rose"              ← brand copy, via Fragrantica editors
│   └── also on the wheel as "bulgarian rose", "damask rose", "turkish rose",
│       which we keep as separate arcs. They are marketing distinctions of one
│       flower; whether to merge them is an open editorial question.
├── family         "floral"            ← OURS (accord.json `groups`)
├── accord         "rose"              ← pyramid.json `noteAccord`, from
│                                        Fragrantica's 55 main-accord labels
├── total          6,133 perfumes      ← counted by bake.py, exact
├── tier                               ← brand copy, PER RECORD, not per note
│   ├── Top          ~1,667 pair-weight   rose as an opening note
│   ├── Middle      ~14,676 pair-weight   the usual placement
│   └── Base           ~214 pair-weight   rare, but it happens
└── pairings                           ← derived, not stated anywhere upstream
    ├── musk         3,467  (57%, 1.2x lift)   common everywhere
    └── carnation      461  ( 8%, 2.2x lift)   a real perfumery idea
```

Two things that example is doing:

**The tier is a property of the record, not of the material.** Rose is a heart
note in most perfumes that list it, an opening note in some, and a base note in
a couple hundred. Nothing measured that. Whoever wrote the press release
decided it, and the top/heart/base convention itself is a nineteenth-century
volatility metaphor that modern perfumery does not necessarily compose to.
`/wheel/pyramid` preserves the tiers because they are in the source;
`/wheel/accord` deliberately **discards** them — `bake.py` unions Top, Middle
and Base into one set per record before counting pairs, so a ribbon there means
"both notes were listed on this bottle", not "these two met in the heart".

**The family is ours and the pairings are derived.** "Floral" is our label on
rose, not Fragrantica's. And no source anywhere states "rose goes with
carnation" — that is arithmetic over 24,059 bottles, reporting what has been
sold, which is a record of fashion as much as of craft.

## Recommended source layers

1. **Open taxonomy and identifiers.** [Parfica Open Data](https://github.com/parfica/parfica-open-data)
   publishes a CC0 note taxonomy, note names, groups, and cleanly matched brand
   identifiers. It deliberately excludes commercial fragrance pyramids, which
   makes it useful as a provenance-safe vocabulary layer rather than a
   replacement for the current co-occurrence records.
2. **Brand and creator metadata.** Use the
   [Wikidata Query Service](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service)
   for stable QIDs, country, inception year, and perfumer links where present.
   Wikidata structured data is CC0. Bake and cache results; do not make the
   interactive app depend on a live SPARQL request.
3. **Product and ingredient-label data.** [Open Beauty Facts](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/tutorials/scanning-cosmetics-pet-food-and-other-products.md)
   can add barcodes and INCI lists. Its ODbL terms should remain a clearly
   attributed database layer because share-alike obligations differ from CC0.
   INCI ingredients are not perfume-note pyramids and should never be presented
   as if they were.
4. **Chemical enrichment.** [PubChem PUG REST](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest)
   can map specific aroma materials to CIDs, formulas, synonyms, and other
   chemical properties. It enriches notes; it does not identify which retail
   perfumes contain a note.
5. **Safety context.** The [IFRA Standards Library](https://ifrafragrance.org/understanding-standards)
   is a useful separately versioned safety layer for restricted, prohibited,
   or specified materials. It is technical reference data, not a recommendation
   engine and not a substitute for current professional safety assessment.

A second community database, Parfumo, is scoped separately in
[`PARFUMO.md`](PARFUMO.md) — including why the first step there is to bake it
as its own wheel and compare, rather than to merge it.

## Durable model

Use canonical entities (`fragrance`, `brand`, `note`, `material`, `person`) and
store each fact with `source`, `source_record_id`, `source_version`, `license`,
and `observed_at`. Keep aliases separate from canonical names. Do not collapse
marketing notes, INCI ingredients, and chemical substances into one field; the
relationships are many-to-many and often uncertain.

The safest ten-year architecture is still bake-and-publish: check upstream
versions on a schedule, rebuild immutable artifacts, compare validation metrics
with the prior manifest, review large diffs, then deploy. Live third-party APIs
should enrich the offline build, not sit on the critical rendering path.
