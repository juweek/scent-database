#!/usr/bin/env python3
"""Build the record-level fragrance index consumed by the explorer.

The chord matrices stay in small, eagerly imported JSON chunks. Perfume names
are partitioned by the alphabetically first note in a pair, so selecting one
ribbon downloads one small file instead of the full source dataset.

Usage:
  python3 scripts/pipeline/bake.py --source /path/to/fra_cleaned.csv
"""

import argparse
import csv
import hashlib
import heapq
import json
import math
from collections import defaultdict
from itertools import combinations
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "public" / "data" / "fragrances"


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Fragrantica fra_cleaned.csv")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--limit", type=int, default=4, help="Examples retained per note pair")
    parser.add_argument("--encoding", default="cp1252")
    parser.add_argument("--source-version", default="unknown")
    parser.add_argument("--license", default="CC BY-NC-SA 4.0")
    return parser.parse_args()


def app_vocabulary():
    accord = json.loads((ROOT / "src/data/wheels/accord.json").read_text())
    pyramid = json.loads((ROOT / "src/data/wheels/pyramid.json").read_text())
    notes = set(accord["names"])
    for tier in pyramid["tiers"].values():
        notes.update(tier["names"])
    return notes


def parse_notes(value):
    return {note.strip().lower() for note in (value or "").split(",") if note.strip()}


def parse_float(value):
    try:
        return float((value or "").replace(",", "."))
    except ValueError:
        return None


def parse_int(value):
    try:
        return int((value or "0").replace(",", ""))
    except ValueError:
        return 0


def display_name(value):
    return " ".join((value or "Unknown").replace("-", " ").replace("_", " ").split()).title()


def file_key(note):
    return quote(note, safe="-_.").replace("%", "_")


def main():
    args = parse_args()
    if args.limit < 1:
        raise SystemExit("--limit must be at least 1")
    if not args.source.exists():
        raise SystemExit(f"Source file not found: {args.source}")

    vocabulary = app_vocabulary()
    # Pair -> min-heap of (quality, rating count, sequence, record).
    heaps = defaultdict(list)
    record_count = 0
    sequence = 0

    with args.source.open(encoding=args.encoding, newline="") as source:
        rows = csv.DictReader(source, delimiter=";")
        required = {"url", "Perfume", "Brand", "Rating Value", "Rating Count", "Top", "Middle", "Base"}
        missing = required.difference(rows.fieldnames or [])
        if missing:
            raise SystemExit(f"Source schema is missing: {', '.join(sorted(missing))}")

        for row in rows:
            notes = set()
            for column in ("Top", "Middle", "Base"):
                notes.update(parse_notes(row.get(column)))
            notes.intersection_update(vocabulary)
            if len(notes) < 2:
                continue

            rating = parse_float(row.get("Rating Value"))
            rating_count = parse_int(row.get("Rating Count"))
            quality = (rating or 0) * math.log10(rating_count + 10)
            # Compact positional rows keep 27k lazy pair indexes deployable:
            # [display name, brand, rating, source URL].
            if not row.get("url"):
                continue
            record = [
                display_name(row.get("Perfume")),
                display_name(row.get("Brand")),
                round(rating, 2) if rating is not None else None,
                row.get("url"),
            ]
            record_count += 1

            for pair in combinations(sorted(notes), 2):
                sequence += 1
                candidate = (quality, rating_count, sequence, record)
                heap = heaps[pair]
                if len(heap) < args.limit:
                    heapq.heappush(heap, candidate)
                elif candidate[:2] > heap[0][:2]:
                    heapq.heapreplace(heap, candidate)

    by_note = defaultdict(dict)
    for (first, second), heap in heaps.items():
        ranked = sorted(heap, key=lambda item: item[:2], reverse=True)
        by_note[first][second] = [item[3] for item in ranked]

    note_dir = args.out_dir / "by-note"
    note_dir.mkdir(parents=True, exist_ok=True)
    for first, partners in by_note.items():
        path = note_dir / f"{file_key(first)}.json"
        path.write_text(json.dumps(partners, ensure_ascii=False, separators=(",", ":")) + "\n")

    metadata = {
        "source": "olgagmiufana1/fragrantica-com-fragrance-dataset",
        "sourceVersion": args.source_version,
        "sourceFile": args.source.name,
        "sourceSha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
        "license": args.license,
        "recordsUsed": record_count,
        "notesIndexed": len(vocabulary),
        "pairsIndexed": len(heaps),
        "examplesPerPair": args.limit,
        "recordSchema": ["name", "brand", "rating", "url"],
        "partition": "alphabetically first note",
    }
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(
        f"Indexed {record_count:,} fragrances across {len(heaps):,} pairs "
        f"into {len(by_note):,} lazy files."
    )


if __name__ == "__main__":
    main()
