#!/usr/bin/env python3
"""
Rebuild seed dataset using ONLY Wikidata sources with proper provenance.
Remove the manual seed - all perfumes must have traceable CC0 sources.
"""

import json
import urllib.request
import urllib.parse
from datetime import datetime

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"

# Comprehensive query to get perfumes with notes
QUERY = """
SELECT DISTINCT ?perfume ?perfumeLabel ?brandLabel ?noteLabel WHERE {
  ?perfume wdt:P31 wd:Q131746.  # instance of perfume
  OPTIONAL { ?perfume wdt:P1056 ?brand. }
  
  # Get notes through different properties
  {
    ?perfume wdt:P5872 ?note.  # has characteristic (scent notes)
  } UNION {
    ?perfume wdt:P527 ?note.   # has part
    ?note wdt:P279* wd:Q105085470.  # subclass of perfume note
  }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 10000
"""

def fetch_wikidata():
    """Fetch perfume data from Wikidata."""
    params = {'query': QUERY, 'format': 'json'}
    url = f"{WIKIDATA_SPARQL}?{urllib.parse.urlencode(params)}"
    
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'NoteMatchWikidataOnly/1.0 (CC0)')
        
        print("Fetching from Wikidata (this may take 60-90 seconds)...")
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Wikidata error: {e}")
        return None

def normalize_note(note):
    """Normalize note names."""
    return note.lower().strip()

def main():
    print("Building Note Match seed dataset from Wikidata ONLY...")
    print("(Removed manual seed - all sources now traceable to Wikidata)\n")
    
    # Fetch from Wikidata
    wd_data = fetch_wikidata()
    
    if not wd_data or 'results' not in wd_data:
        print("Failed to fetch from Wikidata")
        return
    
    # Group by perfume
    perfume_data = {}
    for row in wd_data['results']['bindings']:
        p_uri = row['perfume']['value']
        p_id = f"wd:{p_uri.split('/')[-1]}"
        p_name = row.get('perfumeLabel', {}).get('value', '')
        p_brand = row.get('brandLabel', {}).get('value', '')
        p_note = row.get('noteLabel', {}).get('value', '')
        
        if p_id not in perfume_data:
            perfume_data[p_id] = {
                'id': p_id,
                'name': p_name,
                'brand': p_brand,
                'notes': set(),
                'source': 'wikidata',
                'source_id': p_uri.split('/')[-1],
                'source_url': p_uri,
                'retrieved_date': datetime.now().strftime('%Y-%m-%d')
            }
        
        if p_note:
            perfume_data[p_id]['notes'].add(normalize_note(p_note))
    
    print(f"✓ Fetched {len(perfume_data)} perfumes from Wikidata")
    
    # Filter: require 4+ notes and non-empty name
    fragrances = []
    for p_id, p_data in perfume_data.items():
        if len(p_data['notes']) >= 4 and p_data['name']:
            p_data['notes'] = sorted(list(p_data['notes']))
            fragrances.append(p_data)
    
    print(f"✓ Kept {len(fragrances)} perfumes with 4+ notes")
    
    # Collect all unique notes
    all_notes = set()
    for frag in fragrances:
        all_notes.update(frag['notes'])
    
    # Build output
    output = {
        "source": "wikidata_only",
        "license": "CC0 1.0 Universal",
        "created_at": datetime.now().isoformat() + "Z",
        "description": "Perfume dataset sourced exclusively from Wikidata for full CC0 provenance. Each record includes source_url and retrieved_date.",
        "count": len(fragrances),
        "note_count": len(all_notes),
        "fragrances": fragrances,
        "all_notes": sorted(list(all_notes))
    }
    
    # Write output
    import os
    output_path = "public/data/note-match/seed.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Wrote {output_path}")
    print(f"  Total perfumes: {len(fragrances)}")
    print(f"  Unique notes: {len(all_notes)}")
    
    # Show note count distribution
    note_counts = [len(f['notes']) for f in fragrances]
    print(f"  Note range: {min(note_counts)}-{max(note_counts)} notes per perfume")
    print(f"  Average: {sum(note_counts) / len(note_counts):.1f} notes")
    
    # Show some well-known examples if they exist
    print("\n  Known perfumes found:")
    known = ['Chanel No. 5', 'Angel', 'CK One', 'Shalimar', 'Cool Water']
    for frag in fragrances:
        if any(k.lower() in frag['name'].lower() for k in known):
            print(f"    - {frag['name']} ({frag['brand']}) - {len(frag['notes'])} notes - {frag['source_id']}")

if __name__ == "__main__":
    main()
