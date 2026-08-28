#!/usr/bin/env python3
"""
Build the per-note record index that backs "perfumes with this note".

The pair index in public/data/fragrances/by-note/ stores every pair ONCE, under
the alphabetically-first note, because that halves its size. That shape answers
"which perfumes have both X and Y" in one fetch, but it cannot answer "which
perfumes have X" — half of X's pairs live in other notes' files, so a complete
answer would touch ~192 files / ~10 MB.

This script inverts that index into a per-note view, grouped by the scent
families the wheel's bar chart draws, and splits it into two pages so a phone
fetches ~20 KB up front and the long tail only if the reader asks for it.

FALLBACK ONLY. bake.py builds this index directly from the source CSV with
exact counts; prefer that whenever you have the CSV. This script exists for
when you do not: it needs no download, because every record it emits already
exists in the pair index. That also bounds it — the baker keeps only
`examplesPerPair` (4) records per pair, so both the lists AND the counts here
are notable examples rather than every match (`exhaustive: false`).

    python3 scripts/pipeline/note_index.py
"""

import json
import shutil
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAIRS = ROOT / "public/data/fragrances/by-note"
OUT = ROOT / "public/data/fragrances/by-note-index"
WHEEL = ROOT / "src/data/wheels/accord.json"

FAMILY_PAGE1 = 20   # records per family in page 1
ALL_PAGE1 = 40      # records in the headline list in page 1


def file_key(note):
    """Mirror the pair index's filename scheme (see fragranceMatches.js)."""
    from urllib.parse import quote
    return quote(note, safe="").replace("%", "_")


def main():
    wheel = json.loads(WHEEL.read_text())
    names, groups = wheel["names"], wheel["groups"]
    families = wheel["familyOrder"]
    matrix = wheel["matrices"]["all"]
    index_of = {n: i for i, n in enumerate(names)}
    on_wheel = set(names)

    # Invert the half-matrix into note -> partner -> records.
    partners_of = defaultdict(dict)
    for path in PAIRS.glob("*.json"):
        first = path.stem
        for second, rows in json.loads(path.read_text()).items():
            partners_of[first][second] = rows
            partners_of[second][first] = rows

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    written = page1_bytes = page2_bytes = 0
    for note in names:
        partners = partners_of.get(note, {})

        # Rank a perfume by the strength of the strongest pairing that surfaced
        # it, then by rating — so the best-known pairings lead each list.
        best = {}
        by_family = defaultdict(dict)
        for partner, rows in partners.items():
            if partner == note:
                continue
            weight = (
                matrix[index_of[note]][index_of[partner]]
                if partner in on_wheel
                else 0
            )
            for row in rows:
                key = (row[0], row[1])
                score = (weight, row[2] or 0)
                if key not in best or score > best[key][0]:
                    best[key] = (score, row)
                # Only notes drawn on the wheel own a bar on the chart.
                if partner in on_wheel:
                    fam = groups[partner]
                    if key not in by_family[fam] or score > by_family[fam][key][0]:
                        by_family[fam][key] = (score, row)

        def ranked(bucket):
            return [r for _, r in sorted(bucket.values(), key=lambda t: t[0], reverse=True)]

        all_rows = ranked(best)
        page1 = {
            "note": note,
            "total": len(all_rows),
            "held": len(all_rows),  # sampled build holds everything it counts
            "all": all_rows[:ALL_PAGE1],
            "families": {},
        }
        page2 = {"all": all_rows[ALL_PAGE1:], "families": {}}

        for fam in families:
            rows = ranked(by_family.get(fam, {}))
            page1["families"][fam] = {
                "total": len(rows),
                "held": len(rows),
                "top": rows[:FAMILY_PAGE1],
            }
            if len(rows) > FAMILY_PAGE1:
                page2["families"][fam] = rows[FAMILY_PAGE1:]

        has_more = bool(page2["all"] or page2["families"])
        page1["hasMore"] = has_more

        key = file_key(note)
        blob = json.dumps(page1, ensure_ascii=False, separators=(",", ":")) + "\n"
        (OUT / f"{key}.json").write_text(blob)
        page1_bytes += len(blob.encode())
        if has_more:
            blob2 = json.dumps(page2, ensure_ascii=False, separators=(",", ":")) + "\n"
            (OUT / f"{key}.2.json").write_text(blob2)
            page2_bytes += len(blob2.encode())
        written += 1

    meta = {
        "builtFrom": "public/data/fragrances/by-note",
        "notes": written,
        "familyPageSize": FAMILY_PAGE1,
        "allPageSize": ALL_PAGE1,
        "exhaustive": False,
        "note": (
            "Lists are the notable examples the pair index holds "
            "(examplesPerPair records per pair), not every matching perfume."
        ),
    }
    (OUT / "metadata.json").write_text(json.dumps(meta, indent=2) + "\n")

    print(f"notes written : {written}")
    print(f"page 1 total  : {page1_bytes/1048576:.1f} MB")
    print(f"page 2 total  : {page2_bytes/1048576:.1f} MB")


if __name__ == "__main__":
    main()
