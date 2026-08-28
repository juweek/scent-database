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
    parser.add_argument(
        "--note-limit",
        type=int,
        default=100,
        help="Perfumes retained per note, and per note x family bucket (counts stay exact)",
    )
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
    return notes, accord


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


def keep(heap, candidate, limit):
    """Bounded top-N by (quality, rating count)."""
    if len(heap) < limit:
        heapq.heappush(heap, candidate)
    elif candidate[:2] > heap[0][:2]:
        heapq.heapreplace(heap, candidate)


def ranked(heap):
    return [item[3] for item in sorted(heap, key=lambda item: item[:2], reverse=True)]


def write_note_index(out_dir, families, note_totals, note_family_totals, note_heaps,
                     note_family_heaps, family_page1=20, all_page1=40):
    """
    Per-note lists, split into two pages so a phone fetches ~3 KB gzipped up
    front and the long tail only when a reader opens a list. Mirrors the shape
    scripts/pipeline/note_index.py builds without the source CSV — but these
    lists are exhaustive, and `total` is the true number of perfumes carrying
    the note rather than a sample.
    """
    index_dir = out_dir / "by-note-index"
    index_dir.mkdir(parents=True, exist_ok=True)
    for note, heap in note_heaps.items():
        all_rows = ranked(heap)
        page1 = {
            "note": note,
            "total": note_totals[note],  # true count of perfumes carrying the note
            "held": len(all_rows),
            "all": all_rows[:all_page1],
            "families": {},
        }
        page2 = {"all": all_rows[all_page1:], "families": {}}
        for family in families:
            rows = ranked(note_family_heaps[note].get(family, []))
            page1["families"][family] = {
                "total": note_family_totals[note].get(family, 0),  # true, uncapped
                "held": len(rows),  # how many we actually carry
                "top": rows[:family_page1],
            }
            if len(rows) > family_page1:
                page2["families"][family] = rows[family_page1:]

        page1["hasMore"] = bool(page2["all"] or page2["families"])
        key = file_key(note)
        dump = lambda obj: json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"
        (index_dir / f"{key}.json").write_text(dump(page1))
        if page1["hasMore"]:
            (index_dir / f"{key}.2.json").write_text(dump(page2))
    return len(note_heaps)


def main():
    args = parse_args()
    if args.limit < 1:
        raise SystemExit("--limit must be at least 1")
    if not args.source.exists():
        raise SystemExit(f"Source file not found: {args.source}")

    vocabulary, accord = app_vocabulary()
    groups = accord["groups"]
    families = accord["familyOrder"]
    on_wheel = set(accord["names"])
    # Pair -> min-heap of (quality, rating count, sequence, record).
    heaps = defaultdict(list)
    # Note -> min-heap, and note -> family -> min-heap. Unlike the pair index
    # these see every record, so the lists they produce are exhaustive.
    note_heaps = defaultdict(list)
    note_family_heaps = defaultdict(lambda: defaultdict(list))
    note_totals = defaultdict(int)
    # Counted separately from the heaps: the heaps are capped, these are not,
    # so the UI can say "top 100 of 1,203" instead of reporting the cap as the
    # total.
    note_family_totals = defaultdict(lambda: defaultdict(int))
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

            drawn = notes & on_wheel
            for note in drawn:
                sequence += 1
                candidate = (quality, rating_count, sequence, record)
                note_totals[note] += 1
                keep(note_heaps[note], candidate, args.note_limit)
                for family in {groups[other] for other in drawn if other != note}:
                    note_family_totals[note][family] += 1
                    keep(note_family_heaps[note][family], candidate, args.note_limit)

    by_note = defaultdict(dict)
    for (first, second), heap in heaps.items():
        ranked = sorted(heap, key=lambda item: item[:2], reverse=True)
        by_note[first][second] = [item[3] for item in ranked]

    note_dir = args.out_dir / "by-note"
    note_dir.mkdir(parents=True, exist_ok=True)
    for first, partners in by_note.items():
        path = note_dir / f"{file_key(first)}.json"
        path.write_text(json.dumps(partners, ensure_ascii=False, separators=(",", ":")) + "\n")

    notes_indexed = write_note_index(
        args.out_dir, families, note_totals, note_family_totals, note_heaps, note_family_heaps
    )

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
        "noteIndex": {
            "notes": notes_indexed,
            "perNoteLimit": args.note_limit,
            "exhaustive": True,
        },
    }
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(
        f"Indexed {record_count:,} fragrances across {len(heaps):,} pairs "
        f"into {len(by_note):,} lazy files, plus {notes_indexed:,} per-note indexes."
    )


if __name__ == "__main__":
    main()
