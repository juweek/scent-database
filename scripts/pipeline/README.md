# Fragrance data pipeline

The deployed app remains static. Heavy source rows are converted at build time
into two layers:

1. `src/data/wheels/*.json` — aggregate matrices loaded per wheel.
2. `public/data/fragrances/by-note/*.json` — small, record-level partitions
   fetched only after a visitor selects a ribbon.

Build the second layer from Kaggle's `fra_cleaned.csv`:

```sh
npm run bake:data -- --source /path/to/fra_cleaned.csv --source-version 3
```

The file is semicolon-delimited, Windows-1252 encoded, and uses comma decimal
separators. `bake.py` handles those source quirks, limits its vocabulary to the
notes currently used by the app, and keeps the four strongest-rated examples
per note pair. Records use the compact positional schema documented in
`public/data/fragrances/metadata.json`. The raw CSV is not committed.

For repeatable refreshes, pin the Kaggle dataset version in CI, keep its checksum
with the run metadata, execute the baker, validate record and pair counts against
the previous version, and publish only after reviewing unexpectedly large diffs.

## Fragella enrichment (local only)

Requires Python 3; no extra packages. Put `FRAGELLA_API_KEY=...` in the project's
ignored `.env.local` file, or export that environment variable. See `.env.example`.
Never use a `VITE_` prefix for a secret.

```sh
# Preview the 12 featured perfumes; no network or credentials needed.
npm run fetch:fragella -- --dry-run
# Fetch the featured sample, with at most 12 searches plus one quota check.
npm run fetch:fragella
# Fetch selected existing local perfume IDs.
npm run fetch:fragella -- --ids 31861 611 --max-requests 2
npm run test:fragella
```

Responses and `matches.json` are saved under `scripts/pipeline/raw/fragella/`,
which is ignored by Git and outside the deployed public directory. Each response
includes its request endpoint and UTC fetch time. Full response fields (including
notes, accords, images, performance, season/occasion rankings and price) are kept
as supplied. Image URLs are saved, not downloaded. Existing Kaggle records and
wheel statistics are not modified. Fragella ratings remain separate from the
original dataset's ratings; descriptive accord strengths are not numeric percentages.

Only a unique normalized name/brand match without a conflicting year is linked
automatically. A small explicit brand alias map handles Dior/Mugler/Versace naming.
Missing years are tolerated. These are provisional links, not verified identities;
review them before publishing. Fuzzy results and variants are marked `review`,
with candidate IDs and raw responses available for inspection. Empty/404 searches
are recorded as `not_found`. No fuzzy match silently overwrites source data.

Rerun to resume: cached searches consume no requests. `--refresh` replaces cached
responses within the per-run budget. HTTP errors (including 429) stop the run
without retries, preserving completed responses. The quota check reserves one
request and bounds searches by remaining quota; concurrent clients can still
consume that same quota. An unrecognized quota response stops before searches.

For larger enrichment, after checking your plan's storage allowance:

```sh
npm run fetch:fragella -- --scope catalog --max-requests 100 --dry-run
npm run fetch:fragella -- --scope catalog --max-requests 100
```

Catalog mode prioritizes perfumes by existing rating count, and resumes in that
order. Each run's request budget is explicit; repeated runs accumulate data.
There is no bulk database-export endpoint in the documented API. Searches use
`/fragrances?search=...&limit=10`; results may omit the intended perfume, so
`review` does not imply absence from Fragella.

[Fragella docs](https://api.fragella.com/docs.html) document the search limits.
[Terms §3.3](https://api.fragella.com/terms-of-use.html) restrict storing large
portions of API data unless permitted by your plan. Confirm that allowance before
catalog-scale imports. This script does not infer storage rights from quota.
Live server-side fetching and publication of enrichment are separate next steps.
