#!/usr/bin/env python3
"""Fetch a bounded, resumable Fragella enrichment sample. Python standard library only."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'scripts/pipeline/raw/fragella'
BASE = 'https://api.fragella.com/api/v1/'


def normalize(value):
    value = unicodedata.normalize('NFKD', str(value or '')).casefold()
    return ''.join(c for c in value if c.isalnum() and not unicodedata.combining(c))


ALIASES = {'christiandior': 'dior', 'thierrymugler': 'mugler', 'gianniversace': 'versace'}


def brand_key(value):
    key = normalize(value)
    return ALIASES.get(key, key)


def match_record(local, candidates):
    # Never select a fuzzy top result automatically: flankers are distinct perfumes.
    exact = [r for r in candidates if normalize(r.get('Name')) == normalize(local['name'])
             and brand_key(r.get('Brand')) == brand_key(local['brand'])]
    compatible = [r for r in exact if not local.get('year') or not r.get('Year')
                  or str(local['year']) == str(r['Year'])]
    if len(exact) == 1 and len(compatible) == 1:
        return 'matched', compatible[0]
    return ('review' if candidates else 'not_found'), None


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)


def api_key():
    if os.environ.get('FRAGELLA_API_KEY'):
        return os.environ['FRAGELLA_API_KEY'].strip()
    path = ROOT / '.env.local'
    if path.exists():
        for line in path.read_text().splitlines():
            match = re.match(r'^\s*(?:export\s+)?FRAGELLA_API_KEY\s*=\s*(.*?)\s*$', line)
            if match:
                return match[1].strip('\"\'')
    return None


def request(endpoint, key, allow_not_found=False):
    req = Request(BASE + endpoint, headers={'x-api-key': key, 'Accept': 'application/json', 'User-Agent': 'fragrance-react/0.1'})
    try:
        with urlopen(req, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        if error.code == 404 and allow_not_found:
            return []
        # Do not print headers, credentials or response bodies.
        raise RuntimeError(f'Fragella HTTP {error.code}; stopped. Completed responses are cached.') from None
    except (URLError, TimeoutError, ValueError):
        raise RuntimeError('Fragella network/JSON error; stopped. Rerun to resume.') from None


def candidates_from(payload):
    rows = payload if isinstance(payload, list) else payload.get('data') if isinstance(payload, dict) else None
    if not isinstance(rows, list) or any(not isinstance(r, dict) or not r.get('_id')
                                          or not r.get('Name') or not r.get('Brand') for r in rows):
        raise RuntimeError('Unexpected Fragella fragrance response; not cached.')
    return rows


def catalog(scope, ids):
    records = {}
    for path in sorted((ROOT / 'public/data/perfumes/record').glob('*.json')):
        records.update(json.loads(path.read_text()))
    if ids:
        missing = set(ids) - records.keys()
        if missing:
            raise ValueError('Unknown local IDs: ' + ', '.join(sorted(missing)))
        return [records[pid] for pid in dict.fromkeys(ids)]
    if scope == 'featured':
        meta = json.loads((ROOT / 'public/data/perfumes/meta.json').read_text())
        return [records[row[0]] for row in meta['featured']]
    return sorted(records.values(), key=lambda r: (-int(r.get('ratings') or 0), r['id']))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scope', choices=['featured', 'catalog'], default='featured')
    parser.add_argument('--ids', nargs='+', help='Existing local perfume IDs')
    parser.add_argument('--max-requests', type=int, default=12, help='Search request budget per invocation (plus one usage check)')
    parser.add_argument('--delay', type=float, default=1.0, help='Seconds between requests')
    parser.add_argument('--dry-run', action='store_true', help='Plan without a key, writes or requests')
    parser.add_argument('--refresh', action='store_true', help='Refetch previously saved searches within the request budget')
    args = parser.parse_args()
    if args.max_requests < 1 or args.delay < 0:
        parser.error('max-requests must be positive and delay nonnegative')
    rows = catalog(args.scope, args.ids)
    planned = []
    for row in rows:
        query = f"{row['brand']} {row['name']}"
        endpoint = 'fragrances?' + urlencode({'search': query, 'limit': 10})
        path = RAW / 'responses' / (hashlib.sha256(endpoint.encode()).hexdigest() + '.json')
        planned.append((row, endpoint, path))
    pending = sum(args.refresh or not path.exists() for _, _, path in planned)
    print(f'{len(rows)} local perfumes; {pending} searches pending; at most {min(pending, args.max_requests)} searches + one usage check.')
    if args.dry_run:
        for row, _, _ in planned[:12]:
            print(f"  {row['id']}: {row['brand']} — {row['name']}")
        return
    key = api_key()
    if not key:
        raise RuntimeError('Set FRAGELLA_API_KEY in .env.local or your shell environment. Never use VITE_FRAGELLA_API_KEY.')
    budget = args.max_requests
    if pending:
        usage = request('usage', key)
        remaining = usage.get('usage', {}).get('requests_remaining') if isinstance(usage, dict) else None
        if not isinstance(remaining, int) or isinstance(remaining, bool):
            raise RuntimeError('Usage response did not report an integer requests_remaining; stopped before searches.')
        budget = min(budget, max(0, remaining - 1))  # Reserve one request; no automatic overages.
        print(f'Reported requests remaining: {remaining}; search budget: {budget}.')
    report_path = RAW / 'matches.json'
    report = json.loads(report_path.read_text()) if report_path.exists() else {'source': BASE, 'records': {}}
    calls = 0
    for row, endpoint, path in planned:
        if path.exists() and not args.refresh:
            cached = json.loads(path.read_text())
            candidates = candidates_from(cached['response'])
        else:
            if calls >= budget:
                continue
            time.sleep(args.delay)
            payload = request(endpoint, key, allow_not_found=True)
            calls += 1
            candidates = candidates_from(payload)
            cached = {'endpoint': endpoint, 'fetchedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'response': payload}
            save(path, cached)
        status, match = match_record(row, candidates)
        report['records'][row['id']] = {
            'local': {k: row.get(k) for k in ('id', 'name', 'brand', 'year')},
            'status': status, 'fragellaId': match['_id'] if match else None,
            'fetchedAt': cached['fetchedAt'], 'responseFile': str(path.relative_to(ROOT)),
            'candidateIds': [r['_id'] for r in candidates],
            'enrichment': match,
        }
        save(report_path, report)
        print(f"{row['id']}: {status}")
    print(f'{calls} search requests made. Local match report: {report_path}')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, OSError) as error:
        raise SystemExit(str(error))
