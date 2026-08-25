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
