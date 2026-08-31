#!/usr/bin/env python3
"""Build the per-perfume index behind /perfume — search, pyramid, accords, neighbours.

The wheels answer "what goes with what" across the whole catalogue. This answers
"what is in THIS bottle, and is that combination ordinary or strange" — which
needs a record-level view the other indexes deliberately do not keep. The pair
index holds four example perfumes per note pair; the note index holds a hundred
perfumes per note. Neither can reconstruct one perfume's full note list:
inverting them recovers a median of two notes per perfume, against a true
median of nine. Hence this baker, and hence its dependence on the source CSV.

Each record is SELF-SUFFICIENT: one fetch renders the whole page. That means
carrying some denormalised weight — every note's global total, every pair's
global count, and each neighbour's name — rather than making the browser
assemble a view out of five round trips. The duplication lives on disk, which
is cheap; the round trips would live on someone's phone, which is not.

Output (all under public/data/perfumes/):

  search/<char>.json    typeahead rows, sharded on the first character of the
                        name AND of the brand, so "chanel" and "coco" both hit
                        one small file
  record/<shard>.json   the perfumes themselves, 2-hex-digit shards of the id
  meta.json             counts, source checksum, and the knobs used

Usage:
  python3 scripts/pipeline/perfume_index.py --source /path/to/fra_cleaned.csv
"""

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import defaultdict
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "public" / "data" / "perfumes"

# Source column -> the tier index stored in each record's `tier` array.
TIERS = (("Top", 0), ("Middle", 1), ("Base", 2))

# Columns the file must have. Year, mainaccord*, Perfumer* and the rating pair
# are read when present and skipped when not, so a trimmed export still bakes.
REQUIRED = {"url", "Perfume", "Brand", "Top", "Middle", "Base"}


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Fragrantica fra_cleaned.csv")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--encoding", default="cp1252")
    parser.add_argument("--delimiter", default=";")
    parser.add_argument("--source-version", default="unknown")
    parser.add_argument("--license", default="CC BY-NC-SA 4.0")
    parser.add_argument("--similar", type=int, default=8, help="Lookalikes kept per perfume")
    parser.add_argument(
        "--variants", type=int, default=5, help="Same-line flankers kept, budgeted separately"
    )
    parser.add_argument(
        "--min-notes", type=int, default=3, help="A chord diagram needs three arcs"
    )
    parser.add_argument(
        "--max-notes",
        type=int,
        default=24,
        help="Notes drawn per perfume. Caps the stored pair triangle, which grows as n^2",
    )
    parser.add_argument(
        "--block-on",
        type=int,
        default=3,
        help="How many of a perfume's rarest notes seed its neighbour candidates",
    )
    return parser.parse_args()


def parse_float(value):
    try:
        return float((value or "").replace(",", "."))
    except (ValueError, AttributeError):
        return None


def parse_int(value):
    try:
        return int((value or "0").replace(",", "").strip() or 0)
    except (ValueError, AttributeError):
        return 0


def display_name(value):
    return " ".join((value or "Unknown").replace("-", " ").replace("_", " ").split()).title()


def perfume_id(url):
    """
    Stable short id. Fragrantica URLs end in the perfume's own numeric id, which
    is the best key available; anything unparseable falls back to a hash so the
    row still gets a home instead of being dropped.
    """
    match = re.search(r"-(\d+)\.html?$", url or "")
    return match.group(1) if match else hashlib.blake2s((url or "").encode(), digest_size=5).hexdigest()


def shard_of(pid):
    """2 hex digits — 256 record files, a hundred or so perfumes each."""
    return hashlib.blake2s(pid.encode(), digest_size=1).hexdigest()


def search_key(text):
    """First character a reader would type. Digits and symbols share one bucket."""
    for char in (text or "").lower():
        if char.isalnum():
            return char if char.isalpha() else "0"
    return "0"


def flanker_key(name):
    """
    Normalised stem for spotting concentration variants.

    "Poison", "Poison Eau De Cologne" and "Poison Esprit De Parfum" are the same
    perfume in different strengths. By note overlap they are a perfume's nearest
    neighbours by a mile, and as a recommendation they are useless — so they are
    flagged here and shown apart from genuine lookalikes in the UI.
    """
    stem = name.lower()
    stem = re.sub(
        r"\b(eau de parfum|eau de toilette|eau de cologne|eau fraiche|esprit de parfum|"
        r"parfum|perfume|extrait|elixir|intense|absolu|absolue|extreme|edp|edt|edc|"
        r"limited edition|collector edition|eau)\b",
        " ",
        stem,
    )
    return re.sub(r"[^a-z0-9]+", "", stem)


def same_line(brand_a, stem_a, brand_b, stem_b):
    """
    Is one of these the other's flanker rather than a genuine lookalike?

    Two shapes, both from the same house. A CONCENTRATION variant shares the
    stem outright once "eau de parfum" and friends are stripped. A FLANKER
    extends the original's name — Angel, Angel Glamorama, Angel Passion Star —
    and by note overlap those crowd out every real match; Angel's eight nearest
    neighbours were five of its own flankers before this existed.

    The prefix arm needs a floor, or a house with a two-letter perfume would
    swallow half its own catalogue; four characters is enough to stop that
    without missing real flankers.
    """
    if brand_a != brand_b:
        return False
    if stem_a == stem_b:
        return True
    shorter, longer = sorted((stem_a, stem_b), key=len)
    return len(shorter) >= 4 and longer.startswith(shorter)


def read_source(args):
    """Yield (optional_columns, accord_columns, perfumer_columns) then each row."""
    with args.source.open(encoding=args.encoding, newline="", errors="replace") as handle:
        reader = csv.DictReader(handle, delimiter=args.delimiter)
        fields = reader.fieldnames or []
        missing = REQUIRED.difference(fields)
        if missing:
            raise SystemExit(
                f"Source schema is missing: {', '.join(sorted(missing))}\n"
                f"Found: {', '.join(fields)}"
            )
        accords = sorted(
            (c for c in fields if c.lower().startswith("mainaccord")),
            key=lambda c: parse_int(re.sub(r"\D", "", c)),
        )
        perfumers = sorted(c for c in fields if c.lower().startswith("perfumer"))
        yield accords, perfumers
        for row in reader:
            yield row


def ordered_notes(row, limit):
    """
    A perfume's notes in source order — top, then heart, then base — deduped,
    with the tier each note was FIRST listed under. Source order is meaningful
    (the first note is the one the brand leads with), so it is preserved rather
    than sorted.
    """
    notes, tiers, seen = [], [], set()
    for column, tier in TIERS:
        for raw in (row.get(column) or "").split(","):
            note = raw.strip().lower()
            if note and note not in seen:
                seen.add(note)
                notes.append(note)
                tiers.append(tier)
    return notes[:limit], tiers[:limit]


def main():
    args = parse_args()
    if not args.source.exists():
        raise SystemExit(f"Source file not found: {args.source}")

    stream = read_source(args)
    accord_cols, perfumer_cols = next(stream)
    print(
        f"Optional columns — accords: {accord_cols or 'none'}; perfumers: {perfumer_cols or 'none'}",
        file=sys.stderr,
    )

    perfumes = {}
    note_totals = defaultdict(int)
    pair_counts = defaultdict(int)
    note_members = defaultdict(list)
    skipped_thin = skipped_dupe = truncated = 0

    for row in stream:
        url = (row.get("url") or "").strip()
        if not url:
            continue

        notes, tiers = ordered_notes(row, args.max_notes)
        if len(notes) < args.min_notes:
            skipped_thin += 1
            continue
        if len(notes) == args.max_notes:
            truncated += 1

        pid = perfume_id(url)
        if pid in perfumes:
            skipped_dupe += 1
            continue

        accords = []
        for column in accord_cols:
            value = (row.get(column) or "").strip().lower()
            if value and value not in accords:
                accords.append(value)

        perfumers = []
        for column in perfumer_cols:
            value = (row.get(column) or "").strip()
            if value and value.lower() not in {"unknown", "n/a", "-", ""} and value not in perfumers:
                perfumers.append(display_name(value))

        record = {
            "id": pid,
            "name": display_name(row.get("Perfume")),
            "brand": display_name(row.get("Brand")),
            "url": url,
            "notes": notes,
            "tier": tiers,
            "accords": accords,
        }
        rating = parse_float(row.get("Rating Value"))
        if rating is not None:
            record["rating"] = round(rating, 2)
        if parse_int(row.get("Rating Count")):
            record["ratings"] = parse_int(row.get("Rating Count"))
        year = parse_int(row.get("Year"))
        if 1700 < year < 2100:
            record["year"] = year
        if perfumers:
            record["perfumers"] = perfumers

        perfumes[pid] = record
        for note in notes:
            note_totals[note] += 1
            note_members[note].append(pid)
        for first, second in combinations(sorted(notes), 2):
            pair_counts[(first, second)] += 1

    print(
        f"Read {len(perfumes):,} perfumes ({skipped_thin:,} under {args.min_notes} notes, "
        f"{skipped_dupe:,} duplicate ids, {truncated:,} truncated at {args.max_notes}).",
        file=sys.stderr,
    )
    print(f"{len(note_totals):,} distinct notes, {len(pair_counts):,} distinct pairs.", file=sys.stderr)

    attach_weights(perfumes, note_totals, pair_counts)
    if args.similar > 0:
        attach_neighbours(perfumes, note_members, args)

    write_output(perfumes, note_totals, pair_counts, args, accord_cols, perfumer_cols)


def attach_weights(perfumes, note_totals, pair_counts):
    """
    Give every record the numbers its own diagram needs.

    `total[i]` is how many perfumes in the whole catalogue carry notes[i], and
    `pairs` is the upper triangle of global co-occurrence over `notes`, row-major
    (0-1, 0-2, …, 1-2, …). Both are catalogue-wide, not about this bottle: within
    one perfume every pair co-occurs exactly once, so a ribbon has to be weighted
    by how often that combination is reached for everywhere else. That is what
    makes one thin ribbon in a thick web legible as the unusual move.
    """
    for record in perfumes.values():
        notes = record["notes"]
        record["total"] = [note_totals[note] for note in notes]
        record["pairs"] = [
            pair_counts[tuple(sorted((notes[i], notes[j])))]
            for i in range(len(notes))
            for j in range(i + 1, len(notes))
        ]


def attach_neighbours(perfumes, note_members, args):
    """
    Nearest perfumes by Jaccard over note sets.

    24,050 records is 289 million pairs, almost all of which share nothing. Each
    perfume is therefore compared only against perfumes sharing one of its
    RAREST notes: a genuine neighbour nearly always shares something uncommon,
    while blocking on "musk" would drag in ten thousand records and rank none of
    them. This is a recall trade, not an exact answer, and meta.json says so.

    Names are denormalised into each entry so rendering eight neighbours costs
    no extra fetches.
    """
    sets = {pid: set(record["notes"]) for pid, record in perfumes.items()}
    rarity = {note: len(members) for note, members in note_members.items()}
    stems = {pid: flanker_key(record["name"]) for pid, record in perfumes.items()}
    total = len(perfumes)

    for index, (pid, own) in enumerate(sets.items(), 1):
        if index % 4000 == 0:
            print(f"  neighbours {index:,}/{total:,}", file=sys.stderr)

        seeds = sorted(own, key=lambda note: rarity.get(note, 0))[: args.block_on]
        candidates = set()
        for note in seeds:
            candidates.update(note_members[note])
        candidates.discard(pid)

        mine = perfumes[pid]
        scored = []
        for other in candidates:
            theirs = sets[other]
            shared = len(own & theirs)
            if shared < 2:
                continue
            scored.append((shared / len(own | theirs), shared, other))

        # Budgeted separately, because they answer different questions. Angel's
        # top four by raw score are all Angel flankers; if they competed for the
        # same slots, "smells like this" would be a list of the same perfume.
        scored.sort(reverse=True)
        lookalikes, variants = [], []
        for score, shared, other in scored:
            that = perfumes[other]
            is_variant = same_line(mine["brand"], stems[pid], that["brand"], stems[other])
            bucket = variants if is_variant else lookalikes
            cap = args.variants if is_variant else args.similar
            if len(bucket) >= cap:
                if len(lookalikes) >= args.similar and len(variants) >= args.variants:
                    break
                continue
            bucket.append(
                [other, that["name"], that["brand"], round(score, 3), shared, 1 if is_variant else 0]
            )
        mine["similar"] = lookalikes + variants


def write_output(perfumes, note_totals, pair_counts, args, accord_cols, perfumer_cols):
    out = args.out_dir
    (out / "search").mkdir(parents=True, exist_ok=True)
    (out / "record").mkdir(parents=True, exist_ok=True)
    dump = lambda obj: json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"

    shards = defaultdict(dict)
    for pid, record in perfumes.items():
        shards[shard_of(pid)][pid] = record
    for shard, group in shards.items():
        (out / "record" / f"{shard}.json").write_text(dump(group))

    # A perfume is filed under its name's initial AND its brand's, so typing
    # either finds it after one fetch.
    search = defaultdict(list)
    for pid, record in perfumes.items():
        row = [pid, record["name"], record["brand"], record.get("year") or 0]
        for key in {search_key(record["name"]), search_key(record["brand"])}:
            search[key].append(row)
    for key, rows in search.items():
        rows.sort(key=lambda r: (r[2], r[1]))
        (out / "search" / f"{key}.json").write_text(dump(rows))

    # Somewhere to start from on an empty search box. Ranked by rating count,
    # which is a proxy for "a reader will recognise this" — deliberately not by
    # rating, which would surface obscure perfumes with four glowing reviews.
    featured = sorted(perfumes.values(), key=lambda r: -r.get("ratings", 0))[:12]

    counts = sorted(len(r["notes"]) for r in perfumes.values())
    meta = {
        "source": "olgagmiufana1/fragrantica-com-fragrance-dataset",
        "sourceVersion": args.source_version,
        "sourceFile": args.source.name,
        "sourceSha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
        "license": args.license,
        "perfumes": len(perfumes),
        "distinctNotes": len(note_totals),
        "distinctPairs": len(pair_counts),
        "recordShards": len(shards),
        "searchShards": len(search),
        "minNotes": args.min_notes,
        "maxNotes": args.max_notes,
        "notesPerPerfume": {"min": counts[0], "median": counts[len(counts) // 2], "max": counts[-1]},
        "accordColumns": accord_cols,
        "perfumerColumns": perfumer_cols,
        "featured": [
            [r["id"], r["name"], r["brand"], r.get("year") or 0] for r in featured
        ],
        "recordSchema": {
            "notes": "source order: top, then heart, then base, deduped",
            "tier": "0 top, 1 heart, 2 base — the tier a note was FIRST listed under",
            "total": "catalogue-wide count of perfumes carrying notes[i]",
            "pairs": "upper triangle of catalogue-wide co-occurrence over notes, row-major",
            "similar": "[id, name, brand, jaccard, sharedNotes, isConcentrationVariant]",
        },
        "similar": {
            "perPerfume": args.similar,
            "variantsPerPerfume": args.variants,
            "metric": "jaccard over note sets",
            "blocking": f"{args.block_on} rarest notes",
            # Stated plainly: the UI must not imply these are the true nearest
            # neighbours across the whole catalogue.
            "exhaustive": False,
        },
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")

    try:
        where = out.relative_to(ROOT)
    except ValueError:
        where = out
    print(
        f"Wrote {len(perfumes):,} perfumes into {len(shards)} record shards and "
        f"{len(search)} search shards under {where}."
    )


if __name__ == "__main__":
    main()
