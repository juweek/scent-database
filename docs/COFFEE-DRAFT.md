# Coffee chords draft

Local route: `/coffee`. Run `npm run dev` and open that route. The perfume landing
page and sitemap are unchanged. This draft has not been published.

## Data and rebuilding

Source: https://github.com/datascopeanalytics/coffee-blog/blob/master/final/data/coffee_reviews.csv

Download the raw pipe-delimited CSV, then run:

```sh
python3 scripts/pipeline/coffee.py /path/to/coffee_reviews.csv
```

The bake produces `src/data/coffee.json`: 2,581 source rows, 21 exact duplicates
removed, 2,560 review records, and a hand-selected 33-term vocabulary. The source
SHA-256 is stored with the output. No original review prose is shipped.

Word-boundary matches scan the entire description, including finish and milk
assessments. Each note counts at most once per review. Aliases are explicit in
the baker. Negation is not modeled. Repeated products with different descriptions
remain separate reviews, so every count is labeled reviews rather than coffees.
Zero-match reviews remain in the population used for lift.

Common mode uses pair counts. Distinctive mode uses
`lift = pairCount * recordCount / (sourceTotal * targetTotal)`, within the selected
roast. Both modes require the selected minimum support; distinctive mode only
shows lift above one. Low-support findings still need editorial inspection.

The CSV is historical and not a catalog of currently available products. Public
access does not establish commercial reuse permission; resolve upstream rights
or substitute an authorized partner catalog before commercial publication.

## Next useful iteration

Audit extracted notes against original reviews, especially negation, cocoa vs.
chocolate, and milk assessments. Decide whether the unit should be a review or a
unique product. Replace the historical source with a partner catalog if the goal
is shopping. Keep vocabulary, records, family colors, and provenance together so
another domain can reuse the interaction without inheriting coffee assumptions.

The draft reuses `ChordWheel` and the existing canvas engine. Its counting model
is separate in `src/data/coffeeModel.js`; filtered counts are computed locally.
