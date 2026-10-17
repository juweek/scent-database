# Note Match Data Pipeline

This directory contains scripts to build the Note Match dataset from CC0 sources.

## Data Sources

All data is CC0 (public domain):
- **Wikidata**: Perfume items with notes (P5872 property)
- **Manual seed**: Well-known perfumes with publicly documented notes

## Scripts

Run these in order to build the complete dataset:

### 1. Build seed dataset
```bash
python3 scripts/build_note_match_seed.py
```

Combines:
- Manual seed of 12 classic perfumes with well-documented notes
- Wikidata perfume items with 4+ notes
- Output: `public/data/note-match/seed.json`

### 2. Compute similarity matches
```bash
python3 scripts/compute_note_matches.py
```

Computes note-based similarity using:
- IDF-weighted note vectors
- Cosine similarity
- Top-20 neighbors per perfume
- Minimum 40% match threshold
- Output: `public/data/note-match/matches.json`

### 3. Build search index
```bash
python3 scripts/build_note_match_index.py
```

Creates a searchable index:
- All perfumes with 4+ notes
- Pre-computed search strings
- Match counts per perfume
- Output: `public/data/note-match/index.json`

## Run all steps

```bash
python3 scripts/build_note_match_seed.py && \
python3 scripts/compute_note_matches.py && \
python3 scripts/build_note_match_index.py
```

## Output Files

All output files are written to `public/data/note-match/`:

- `seed.json` - Complete perfume dataset with notes and provenance
- `matches.json` - Precomputed similarity matches for all perfumes
- `index.json` - Searchable index for the UI

## Provenance

Every record includes:
- `source`: Data source (wikidata, public_domain_notes, etc.)
- `source_id`: Original entity ID when applicable
- Timestamps for data fetches

## License

All source data is CC0 1.0 Universal (Public Domain).
Generated datasets inherit the CC0 license.
