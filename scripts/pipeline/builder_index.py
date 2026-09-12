#!/usr/bin/env python3
"""Build the inverted index behind the Note Builder.

The other indexes answer "what pairs with X". None of them can answer "which
perfumes carry ALL of X, Y and Z", because none stores a full note -> perfume
posting list: by-note/ keeps four examples per PAIR, by-note-index/ caps at a
hundred per note. So the builder gets its own index.

Built from the SOURCE CSV, not from public/data/perfumes/record/. Those records
cap each note list at 24 notes, which quietly costs 236 perfumes some of their
notes — enough that rose x musk comes out 3,417 there against the wheel's 3,467.
A builder that disagrees with the wheel about the same pair is worse than no
builder, so this one reads the same column the wheel does.

Two ideas carry the size:

  1. Perfumes are numbered by DESCENDING quality (rating x log10(reviews)), the
     same ranking bake.py uses. Posting lists are therefore sorted best-first
     for free, an intersection comes out best-first for free, and the first
     page of results is the lowest indices in the match — which almost always
     live in the first card shard.

  2. Posting lists are delta-encoded. Gaps compress roughly 2.6x better than
     absolute indices (550 KB -> 208 KB gzipped over the whole catalogue).

Cards (the names) are sharded so a page of results costs one small fetch
instead of a megabyte. Filtering and the suggestion list need no cards at all.

Usage:
  python3 scripts/pipeline/builder_index.py --source /path/to/fra_cleaned.csv
"""

import argparse
import csv
import hashlib
import json
import math
import re
import shutil
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT / "scripts/pipeline/raw/fra_cleaned.csv"
OUT = ROOT / "public/data/builder"

# Perfumes per card shard. 2,000 keeps a shard near 25 KB gzipped while
# leaving the whole visible first page inside shard 0 for any common note.
SHARD = 2000

# A note carried by one or two perfumes cannot be filtered on usefully and
# would pad the vocabulary the search reads. Three is the floor.
MIN_PERFUMES = 3


def quality(record):
    """bake.py's ranking: a good rating from many voters beats both alone."""
    return (record["rating"] or 0) * math.log10((record["ratings"] or 0) + 10)


def perfume_id(url):
    """perfume_index.py's id, verbatim — these links have to land on /perfume/<id>."""
    match = re.search(r"-(\d+)\.html?$", url or "")
    return (
        match.group(1)
        if match
        else hashlib.blake2s((url or "").encode(), digest_size=5).hexdigest()
    )


def display_name(value):
    return " ".join((value or "Unknown").replace("-", " ").replace("_", " ").split()).title()


def parse_notes(value):
    return {note.strip().lower() for note in (value or "").split(",") if note.strip()}


def parse_float(value):
    try:
        return float((value or "").replace(",", "."))
    except ValueError:
        return None


def parse_int(value):
    try:
        return int(float((value or "").replace(",", ".")))
    except ValueError:
        return 0


def read_source(path, encoding):
    records = []
    with path.open(newline="", encoding=encoding, errors="replace") as handle:
        for row in csv.DictReader(handle, delimiter=";"):
            url = row.get("url")
            if not url:
                continue
            notes = set()
            for column in ("Top", "Middle", "Base"):
                notes |= parse_notes(row.get(column))
            if not notes:
                continue
            records.append(
                {
                    "id": perfume_id(url),
                    "name": display_name(row.get("Perfume")),
                    "brand": display_name(row.get("Brand")),
                    "rating": parse_float(row.get("Rating Value")),
                    "ratings": parse_int(row.get("Rating Count")),
                    "notes": sorted(notes),
                }
            )
    return records


def main():
    args = parse_args()
    records = read_source(args.source, args.encoding)
    # Same id can appear twice if the source carries a duplicate row; the
    # better-reviewed one wins, so a link never lands on the weaker twin.
    best = {}
    for record in records:
        if record["id"] not in best or quality(record) > quality(best[record["id"]]):
            best[record["id"]] = record
    records = sorted(best.values(), key=quality, reverse=True)

    postings = defaultdict(list)
    for index, record in enumerate(records):
        for note in record["notes"]:
            postings[note].append(index)

    # Frequency order, so the vocabulary's own order is a useful default and
    # the client can slice "most common notes" without sorting.
    notes = sorted(
        (n for n, rows in postings.items() if len(rows) >= MIN_PERFUMES),
        key=lambda n: (-len(postings[n]), n),
    )

    def delta(rows):
        out, previous = [], 0
        for value in rows:
            out.append(value - previous)
            previous = value
        return out

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "cards").mkdir(parents=True)

    index_payload = {
        "perfumes": len(records),
        "shard": SHARD,
        "shards": math.ceil(len(records) / SHARD),
        "notes": notes,
        # Counts travel separately so the client can label the vocabulary
        # without walking 236,000 deltas first.
        "counts": [len(postings[n]) for n in notes],
        "postings": [delta(postings[n]) for n in notes],
        "encoding": "postings are gap-encoded; perfume index is quality rank, 0 = best",
    }
    write(OUT / "index.json", index_payload)

    brands_all = sorted({r["brand"] for r in records})
    brand_index = {b: i for i, b in enumerate(brands_all)}
    for shard in range(index_payload["shards"]):
        block = records[shard * SHARD : (shard + 1) * SHARD]
        used = sorted({brand_index[r["brand"]] for r in block})
        local = {global_id: i for i, global_id in enumerate(used)}
        write(
            OUT / "cards" / f"{shard}.json",
            {
                # Struct-of-arrays, and brands as indexes into a per-shard
                # dictionary: 2,000 perfumes share far fewer brands.
                "id": [r["id"] for r in block],
                "name": [r["name"] for r in block],
                "brand": [local[brand_index[r["brand"]]] for r in block],
                "brands": [brands_all[g] for g in used],
                "rating": [r.get("rating") for r in block],
                "ratings": [r.get("ratings") for r in block],
            },
        )

    total = sum(p.stat().st_size for p in OUT.rglob("*.json"))
    print(
        f"Indexed {len(records):,} perfumes over {len(notes):,} notes "
        f"({sum(len(postings[n]) for n in notes):,} postings) into "
        f"{index_payload['shards']} card shards, {total / 1e6:.2f} MB on disk."
    )


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--encoding", default="cp1252")
    return parser.parse_args()


def write(path, payload):
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False))


if __name__ == "__main__":
    main()
