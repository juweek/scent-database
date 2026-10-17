# Note Match Provenance Report

## Data Source Verification (Follow-up #1)

### Manual Seed Removal
The original 12 "manual seed" perfumes have been **removed** and replaced with Wikidata-only data to ensure full CC0 provenance.

**Original manual seed perfumes status:**
- ✓ Chanel No. 5 → Found in Wikidata (Q820507) - No longer using manual seed
- ✓ Shalimar → Found in Wikidata (Q1159330) - No longer using manual seed
- ✗ Diorissimo → Not found in Wikidata - Removed
- ✗ Acqua di Gio → Not found in Wikidata - Removed
- ✓ Light Blue → Found in Wikidata (Q3832257) - No longer using manual seed
- ✓ Angel → Found in Wikidata (Q2849335) - No longer using manual seed
- ✓ Cool Water → Found in Wikidata (Q3689944) - No longer using manual seed
- ✓ CK One → Found in Wikidata (Q3648777) - No longer using manual seed
- ✗ Flowerbomb → Not found in Wikidata - Removed
- ✗ Black Opium → Not found in Wikidata - Removed
- ✗ Terre d'Hermes → Not found in Wikidata - Removed
- ✓ La Vie Est Belle → Found in Wikidata (Q65151692) - No longer using manual seed

**Result:** All data now sourced exclusively from Wikidata with full provenance.

### Current Dataset Provenance
- **Source**: Wikidata SPARQL Query Service
- **License**: CC0 1.0 Universal (Public Domain)
- **Query**: Instance of perfume (Q131746) with P5872 (has characteristic: scent notes)
- **Count**: 117 perfumes with 4+ notes
- **Unique notes**: 274 (after normalization: 227)

**Every record includes:**
- `source`: "wikidata"
- `source_id`: Wikidata entity QID (e.g., "Q3648777")
- `source_url`: Full Wikidata entity URL
- `retrieved_date`: ISO date of data fetch

**Example record with provenance:**
```json
{
  "id": "wd:Q3648777",
  "name": "CK One",
  "brand": "",
  "notes": [...],
  "source": "wikidata",
  "source_id": "Q3648777",
  "source_url": "http://www.wikidata.org/entity/Q3648777",
  "retrieved_date": "2026-10-17"
}
```

---

## Match Quality Improvement (Follow-up #3)

### Before Improvements (Original)
- Dataset: 129 perfumes (with manual seed)
- Perfumes with matches: 55 (43%)
- Total match pairs: 74
- Average matches per perfume: 0.6
- Score distribution:
  - Very similar (80%+): 0
  - Similar (60-79%): 0
  - Some overlap (40-59%): 74

### After Provenance Fix (Wikidata only, no improvements)
- Dataset: 117 perfumes (Wikidata only)
- Perfumes with matches: 15 (12.8%) ❌ Much worse
- Total match pairs: 52
- Average matches per perfume: 0.4

### After Note Normalization + Accord-Family Blending
- Dataset: 117 perfumes (Wikidata only)
- Perfumes with matches: 110 (94.0%) ✅ **7.3x improvement!**
- Total match pairs: 462 (**8.9x improvement**)
- Average matches per perfume: 3.9 (**9.8x improvement**)
- Score distribution:
  - Very similar (80%+): 0
  - Similar (60-79%): 4 ✅ **New!**
  - Some overlap (40-59%): 458

### Improvements Implemented

1. **Note Normalization (Synonym Mapping)**
   - Strips Wikidata descriptive phrases: "aroma of green tea" → "green tea"
   - Maps geographic variants: "calabrian bergamot" → "bergamot"
   - Maps scientific names: "citrus sinensis" → "orange"
   - Maps type variants: "cedar wood" → "cedar"
   - 80+ synonym mappings added

2. **Accord-Family Blending**
   - Hand-built 10 scent families (citrus, fresh, herbal, floral, fruity, sweet, spicy, amber, woody, musky)
   - Maps 100+ notes to families
   - Blended score: **70% note cosine + 30% family cosine**
   - Helps when perfumes use different names for similar notes
   - Helps sparse records with fewer listed notes

3. **IDF Weighting**
   - Prevents common notes (musk, bergamot, vanilla) from dominating
   - Computed separately for notes and families
   - Cap at 3.0 to prevent rare notes from overwhelming

### Result Summary
✅ Coverage increased from **43% → 12.8% → 94.0%**
✅ Average matches per perfume: **0.6 → 0.4 → 3.9**
✅ First "similar" (60-79%) matches appeared
✅ No invented data, no lowered honesty bands
✅ All improvements based on note semantics

---

## Screenshots (Follow-up #4)

Screenshots moved to `/opt/cursor/artifacts/screenshots/`:

- **empty-1280.png** (116 KB) - Landing page, desktop
- **empty-390.png** (81 KB) - Landing page, mobile
- **result-1280.png** (83 KB) - Match results (Chanel No. 5), desktop
- **result-390.png** (63 KB) - Match results, mobile
- **search-1280.png** (80 KB) - Search modal, desktop
- **search-390.png** (66 KB) - Search modal, mobile
- **not-found-1280.png** (111 KB) - No results state, desktop
- **not-found-390.png** (66 KB) - No results state, mobile

All captured at 1280x720 (desktop) and 390x844 (mobile iPhone 12 Pro).

---

## Recommended Demo Picks

**Best examples for filming:**

1. **CK One** (wd:Q3648777)
   - 14 notes
   - 3 matches (53%, 41%, 40%)
   - Matches: Anglomania, Boudoir Sin Garden, Santal 33
   - Good: Well-known unisex fragrance with clear matches

2. **Angel** (wd:Q2849335)
   - 17 notes
   - Has matches
   - Good: Iconic gourmand with rich note profile

3. **Cool Water** (wd:Q3689944)
   - 16 notes
   - Has matches
   - Good: Famous aquatic fragrance

---

## Changes in This Commit

**Added:**
- `scripts/note_synonyms.py` - Synonym mappings and accord families
- `scripts/rebuild_seed_wikidata_only.py` - Wikidata-only seed builder
- `scripts/verify_manual_seed_sources.py` - Provenance verification tool
- Screenshots in artifacts/

**Modified:**
- `scripts/compute_note_matches.py` - Added normalization + family blending
- `public/data/note-match/seed.json` - Now 117 perfumes, all Wikidata with provenance
- `public/data/note-match/matches.json` - Recomputed with improvements
- `public/data/note-match/index.json` - Updated with new match counts

**Removed:**
- Manual seed perfumes (now using Wikidata only)
- NOTE_MATCH_REPORT.md (as requested)

---

**Preview URL:** https://scent-database-git-cursor-note-match-8420-gourmet-data.vercel.app/note-match
(Note: Protected by Vercel SSO)
