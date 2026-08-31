#!/usr/bin/env python3
"""Bake the accord wheel — Fragrantica's own 84 accords, and how they combine.

The three existing wheels sit at two levels of grain: ten families we authored,
and 140 individual notes. This is the level in between, and it is the source's
own vocabulary rather than ours — `mainaccord1..5`, which Fragrantica's
community votes on. 84 accords, 1,708 pairs, 4.94 accords per perfume.

TWO MATRICES, because they disagree and the disagreement is the point:

  together     raw co-occurrence. How many perfumes carry both accords.
  beyondChance observed minus expected — how many MORE perfumes carry both than
               would if the two were chosen independently.

Both are in units of perfumes, which matters: the wheel's threshold slider
filters on matrix value, so a ratio like lift would make it meaningless. Lift is
still reported in the readout, where a number needs no common unit.

Pairs that co-occur LESS than chance clamp to zero and draw no ribbon. That is a
real finding, not a gap — citrus and woody appear together 4,665 times and are
still 277 short of what independence predicts.

RANK IS A PROPERTY OF THE ACCORD, NOT THE PAIR. Weighting ribbons by rank was
tested and dropped: its top-20 pairs overlap raw co-occurrence 18 times out of
20, because an accord's rank correlates with how common it is. Per accord it is
genuinely informative — smoky has a mean rank of 3.71 and leads only 5% of the
time, citrus 2.50 and leads 35% — so `meanRank` rides on each accord instead,
and the wheel reports whether an accord leads or supports.

Usage:
  python3 scripts/pipeline/accord_wheel.py --source /path/to/fra_cleaned.csv
"""

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "data" / "wheels" / "accords.json"
MAX_ACCORDS = 5


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=OUT)
    parser.add_argument("--encoding", default="cp1252")
    parser.add_argument("--delimiter", default=";")
    parser.add_argument("--source-version", default="unknown")
    parser.add_argument(
        "--min-perfumes",
        type=int,
        default=40,
        help="Accords carried by fewer perfumes are dropped: an arc nobody can hit is noise",
    )
    return parser.parse_args()


def load_taxonomy():
    """
    accord -> family, and the family palette, from the wheels already baked.

    pyramid.json maps 55 of the 84; src/data/accordFamily.js carries the
    defensible remainder we authored. Anything still unmapped keeps a null
    family and renders neutral — see docs/FRAGRANCE-DATA.md on why we decline to
    classify "gasoline" and "brown scotch tape".
    """
    accord = json.loads((ROOT / "src/data/wheels/accord.json").read_text())
    pyramid = json.loads((ROOT / "src/data/wheels/pyramid.json").read_text())

    ours = {}
    source = (ROOT / "src/data/accordFamily.js").read_text()
    block = re.search(r"const OURS = \{(.*?)\n\};", source, re.S)
    if block:
        for key, value in re.findall(r"'?([a-z ]+)'?:\s*'([a-z]+)'", block.group(1)):
            ours[key.strip()] = value

    mapping = dict(pyramid["accordFamily"])
    for key, value in ours.items():
        mapping.setdefault(key, value)

    # pyramid.json emits twelve family labels where accord.json defines ten.
    # "green" and "white floral" are accords that were never folded up, and
    # they carry no colour. Fold them the way accord.json already folds their
    # notes — green notes to fresh, tuberose to floral. Mirrored in
    # src/data/accordFamily.js; the two must agree.
    normalise = {"green": "fresh", "white floral": "floral"}
    mapping = {k: normalise.get(v, v) for k, v in mapping.items()}

    canonical = set(accord["familyOrder"])
    stray = {v for v in mapping.values() if v not in canonical}
    if stray:
        raise SystemExit(f"accord->family produced non-families: {sorted(stray)}")

    return mapping, accord["colors"], accord["familyOrder"]


def main():
    args = parse_args()
    if not args.source.exists():
        raise SystemExit(f"Source file not found: {args.source}")

    accord_family, colors, family_order = load_taxonomy()

    records = []
    with args.source.open(encoding=args.encoding, newline="", errors="replace") as handle:
        reader = csv.DictReader(handle, delimiter=args.delimiter)
        columns = [f"mainaccord{i}" for i in range(1, MAX_ACCORDS + 1)]
        missing = [c for c in columns if c not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit(f"Source is missing {', '.join(missing)}")
        for row in reader:
            accords = []
            for column in columns:
                value = (row.get(column) or "").strip().lower()
                if value and value not in accords:
                    accords.append(value)
            if len(accords) >= 2:
                records.append(accords)

    population = len(records)
    totals = Counter()
    rank_sum = Counter()
    rank_first = Counter()
    pair_counts = Counter()
    for accords in records:
        for position, accord in enumerate(accords, start=1):
            totals[accord] += 1
            rank_sum[accord] += position
            if position == 1:
                rank_first[accord] += 1
        for first, second in combinations(sorted(accords), 2):
            pair_counts[(first, second)] += 1

    names = sorted(
        (a for a, c in totals.items() if c >= args.min_perfumes),
        key=lambda a: (family_order.index(accord_family[a]) if accord_family.get(a) in family_order else 99, a),
    )
    dropped = len(totals) - len(names)
    index = {name: i for i, name in enumerate(names)}
    size = len(names)

    together = [[0] * size for _ in range(size)]
    beyond = [[0] * size for _ in range(size)]
    for (first, second), count in pair_counts.items():
        if first not in index or second not in index:
            continue
        i, j = index[first], index[second]
        expected = totals[first] * totals[second] / population
        # Clamped: a pair rarer than chance draws nothing rather than a negative
        # ribbon. Rounded because the engine and the slider both work in whole
        # perfumes.
        excess = max(0, round(count - expected))
        together[i][j] = together[j][i] = count
        beyond[i][j] = beyond[j][i] = excess

    data = {
        "names": names,
        "groups": {name: accord_family.get(name) for name in names},
        "familyOrder": family_order,
        "colors": colors,
        "matrices": {"together": together, "beyondChance": beyond},
        "counts": {"together": population, "beyondChance": population},
        "totals": {name: totals[name] for name in names},
        # Where this accord tends to land in the perfume's own ranking, and how
        # often it is the headline. The spread is real: citrus leads 35% of the
        # time, smoky 5%.
        "meanRank": {name: round(rank_sum[name] / totals[name], 2) for name in names},
        "leadShare": {name: round(rank_first[name] / totals[name], 3) for name in names},
        "metadata": {
            "source": "olgagmiufana1/fragrantica-com-fragrance-dataset",
            "sourceVersion": args.source_version,
            "sourceSha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
            "license": "CC BY-NC-SA 4.0",
            "population": population,
            "accordsKept": size,
            "accordsDropped": dropped,
            "minPerfumes": args.min_perfumes,
            "accordFamilyIsOurs": True,
        },
    }

    args.out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    unmapped = [n for n in names if not accord_family.get(n)]
    peak = max(max(row) for row in beyond)
    print(
        f"Wrote {size} accords ({dropped} dropped under {args.min_perfumes} perfumes) "
        f"from {population:,} records to {args.out.relative_to(ROOT)}.\n"
        f"  together peaks at {max(max(r) for r in together):,}; beyondChance at {peak:,}.\n"
        f"  {len(unmapped)} accord(s) with no family: {', '.join(unmapped) or 'none'}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
