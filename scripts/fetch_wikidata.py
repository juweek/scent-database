#!/usr/bin/env python3
"""
Fetch perfume data from Wikidata with notes (P5872).
Source: Wikidata SPARQL Query Service
License: CC0 1.0 Universal (Public Domain)
"""

import json
import urllib.request
import urllib.parse
import sys
from datetime import datetime

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"

# SPARQL query to fetch perfumes with notes
QUERY = """
SELECT ?item ?itemLabel ?brandLabel ?notes WHERE {
  ?item wdt:P31 wd:Q131746;  # instance of: perfume
        wdt:P5872 ?notes.     # has characteristic: perfume notes
  OPTIONAL { ?item wdt:P1056 ?brand. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 500
"""

def fetch_wikidata():
    """Fetch perfume data from Wikidata SPARQL endpoint."""
    params = {
        'query': QUERY,
        'format': 'json'
    }
    
    url = f"{WIKIDATA_SPARQL}?{urllib.parse.urlencode(params)}"
    
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'NoteMatchBot/1.0 (Educational; CC0 data only)')
        
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching from Wikidata: {e}", file=sys.stderr)
        return None

def parse_notes(notes_str):
    """Parse comma/semicolon separated notes string."""
    if not notes_str:
        return []
    
    # Split by common delimiters
    import re
    notes = re.split(r'[,;]\s*', notes_str)
    return [n.strip().lower() for n in notes if n.strip()]

def main():
    print("Fetching perfume data from Wikidata...")
    print("(This may take 30-60 seconds)")
    
    data = fetch_wikidata()
    
    if not data or 'results' not in data:
        print("Failed to fetch data from Wikidata", file=sys.stderr)
        sys.exit(1)
    
    results = data['results']['bindings']
    print(f"✓ Fetched {len(results)} raw results")
    
    # Process results
    fragrances = []
    for row in results:
        item_id = row['item']['value'].split('/')[-1]
        name = row.get('itemLabel', {}).get('value', '')
        brand = row.get('brandLabel', {}).get('value', '')
        notes_raw = row.get('notes', {}).get('value', '')
        
        notes = parse_notes(notes_raw)
        
        if name and len(notes) >= 4:  # Require at least 4 notes
            fragrances.append({
                "id": f"wd:{item_id}",
                "name": name,
                "brand": brand,
                "notes": notes,
                "notes_raw": notes_raw,
                "source": "wikidata",
                "source_id": item_id
            })
    
    print(f"✓ Processed {len(fragrances)} perfumes with 4+ notes")
    
    # Write output
    output = {
        "source": "wikidata",
        "source_url": "https://query.wikidata.org/",
        "license": "CC0 1.0 Universal",
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "query": QUERY.strip(),
        "count": len(fragrances),
        "fragrances": fragrances
    }
    
    import os
    output_path = "public/data/note-match/wikidata.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Wrote {output_path}")
    print(f"  Total perfumes: {len(fragrances)}")
    if fragrances:
        note_counts = [len(f['notes']) for f in fragrances]
        print(f"  Note range: {min(note_counts)}-{max(note_counts)} per perfume")

if __name__ == "__main__":
    main()
