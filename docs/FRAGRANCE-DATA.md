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
