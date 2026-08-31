#!/usr/bin/env python3
"""Stamp per-note perfume totals into the accord wheel's JSON.

The chord matrix answers "how often do these two notes co-occur", but not
"how often does this note appear at all" — the diagonal is zeroed. Without the
per-note totals you can rank a note's partners by raw count, which just
resurfaces whatever notes are common everywhere (musk, jasmine, sandalwood).
With them the app can also rank by lift, which is what makes rose reveal
carnation and orris root rather than musk for the hundredth time.

The numbers already exist and are exact: bake.py wrote each note's true,
uncapped total into public/data/fragrances/by-note-index/<note>.json. This
script only inverts that back into one small object on the wheel, so it needs
no source CSV and can run any time.

Usage:
  python3 scripts/pipeline/note_totals.py        # or: npm run bake:totals
"""

import json
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
ACCORD = ROOT / "src" / "data" / "wheels" / "accord.json"
INDEX = ROOT / "public" / "data" / "fragrances" / "by-note-index"

# Key order the wheel JSON is written in. `totals` sits beside `counts`, the
# other denominator on the file.
ORDER = ["names", "groups", "familyOrder", "colors", "matrices", "counts", "totals", "aliases"]

# Spelling collisions in the upstream note vocabulary. Fragrantica's note names
# are community-edited, so the same material can arrive under two labels; both
# survive into the wheel as separate arcs with their counts split between them.
# Merging them would change the wheel itself (140 arcs becomes 136), which is a
# bigger call than this script should make — so we only record the pairs, and
# the pairings panel hides a note's own alias instead of recommending a note to
# itself under another name.
ALIASES = [
    ["vanilla", "vanille"],
    ["clove", "cloves"],
    ["oakmoss", "oak moss"],
    ["woody notes", "woodsy notes"],
]


def file_key(note):
    """Mirror of bake.py's partition filename scheme."""
    return quote(note, safe="-_.").replace("%", "_")


def main():
    accord = json.loads(ACCORD.read_text())
    names = accord["names"]

    totals = {}
    missing = []
    for note in names:
        path = INDEX / f"{file_key(note)}.json"
        if not path.exists():
            missing.append(note)
            continue
        totals[note] = json.loads(path.read_text())["total"]

    if missing:
        raise SystemExit(
            f"No per-note index for {len(missing)} note(s): {', '.join(missing[:8])}"
            f"{'…' if len(missing) > 8 else ''}\n"
            "Run `npm run bake:data -- --source /path/to/fra_cleaned.csv` first."
        )

    # Sanity check: a note cannot co-occur with a partner more often than it
    # appears at all. A breach means the matrix and the index were built from
    # different snapshots, and every lift computed from them would be wrong.
    matrix = accord["matrices"]["all"]
    for i, note in enumerate(names):
        worst = max(matrix[i])
        if worst > totals[note]:
            raise SystemExit(
                f"{note}: pairs with a partner {worst:,} times but the index says it "
                f"appears in only {totals[note]:,} perfumes. The wheel matrix and the "
                "note index are out of step — rebake both from one source."
            )

    known = set(names)
    accord["totals"] = totals
    accord["aliases"] = [pair for pair in ALIASES if all(note in known for note in pair)]

    ordered = {key: accord[key] for key in ORDER if key in accord}
    ordered.update({key: value for key, value in accord.items() if key not in ordered})
    ACCORD.write_text(json.dumps(ordered, ensure_ascii=False, separators=(",", ":")) + "\n")

    smallest = min(totals.items(), key=lambda item: item[1])
    largest = max(totals.items(), key=lambda item: item[1])
    print(
        f"Stamped totals for {len(totals)} notes into {ACCORD.relative_to(ROOT)} "
        f"({smallest[0]} {smallest[1]:,} … {largest[0]} {largest[1]:,}), "
        f"plus {len(accord['aliases'])} alias pair(s)."
    )


if __name__ == "__main__":
    main()
