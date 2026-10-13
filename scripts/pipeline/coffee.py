"""Bake a reproducible coffee draft: python3 scripts/pipeline/coffee.py SOURCE.csv.

Source is the pipe-delimited datascopeanalytics/coffee-blog archive. Review prose
is deliberately not included in the output. Matches are mentions, not ingredients
or verified sensory measurements; the full description includes finish/milk notes.
"""
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

FAMILIES = {
    'Cocoa & nuts': ('#cba27d', ['chocolate', 'cocoa', 'almond', 'hazelnut', 'walnut', 'pecan']),
    'Sweet': ('#e6c473', ['caramel', 'honey', 'vanilla', 'brown sugar', 'molasses']),
    'Fruit': ('#d88978', ['cherry', 'apricot', 'peach', 'plum', 'raisin', 'black currant', 'mango', 'pear']),
    'Citrus': ('#dfab50', ['orange', 'tangerine', 'lemon', 'grapefruit', 'bergamot']),
    'Floral': ('#bda6cc', ['jasmine', 'rose', 'honeysuckle', 'lilac']),
    'Spice & wood': ('#8bab9a', ['cedar', 'sandalwood', 'cinnamon', 'clove', 'tobacco']),
}
ALIASES = {'cocoa': r'cocoa|cacao|cacoa', 'black currant': r'black[ -]?currants?',
           'orange': r'oranges?|orangy', 'clove': r'cloves?', 'raisin': r'raisins?'}

def bake(source):
    raw = Path(source).read_bytes()
    rows = list(csv.DictReader(raw.decode('utf-8-sig').splitlines(), delimiter='|'))
    seen, records = set(), []
    vocabulary = [{ 'name': name, 'family': family, 'color': color }
                  for family, (color, names) in FAMILIES.items() for name in names]
    for row in rows:
        key = tuple(row.values())
        if key in seen:
            continue
        seen.add(key)
        description = row['description'].lower()
        notes = [n['name'] for n in vocabulary
                 if re.search(r'\b(?:' + ALIASES.get(n['name'], re.escape(n['name'])) + r')\b', description)]
        records.append({'id': len(records), 'name': row['coffee'], 'roaster': row['company'],
                        'origin': row['origin'], 'roast': row['roast'], 'notes': notes})
    result = {'source': 'https://github.com/datascopeanalytics/coffee-blog/blob/master/final/data/coffee_reviews.csv',
              'sha256': hashlib.sha256(raw).hexdigest(), 'sourceRows': len(rows),
              'duplicatesRemoved': len(rows)-len(records), 'vocabulary': vocabulary, 'records': records}
    target = Path(__file__).resolve().parents[2] / 'src/data/coffee.json'
    target.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n')
    print(f'{len(records)} unique review records; {result["duplicatesRemoved"]} duplicates removed; {len(vocabulary)} notes')

if __name__ == '__main__':
    bake(sys.argv[1])
