#!/usr/bin/env python3
"""
Build a seed dataset for Note Match from CC0 sources.
This manually curates a small dataset with clear provenance.

Sources:
- Wikidata perfume items (CC0)
- Public domain perfume note data
"""

import json
import urllib.request
import urllib.parse
from datetime import datetime

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"

# Updated query to get individual notes as items
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
LIMIT 5000
"""

def fetch_wikidata():
    """Fetch perfume data from Wikidata."""
    params = {'query': QUERY, 'format': 'json'}
    url = f"{WIKIDATA_SPARQL}?{urllib.parse.urlencode(params)}"
    
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'NoteMatchSeed/1.0 (Educational; CC0)')
        
        with urllib.request.urlopen(req, timeout=90) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Wikidata error: {e}")
        return None

# Manual seed data from public domain sources
# These are classic perfumes with well-documented note compositions
MANUAL_SEED = [
    {
        "id": "seed-001",
        "name": "Chanel No. 5",
        "brand": "Chanel",
        "notes": ["aldehydes", "neroli", "ylang ylang", "jasmine", "rose", "lily of the valley", 
                  "iris", "vetiver", "sandalwood", "vanilla", "amber", "patchouli"],
        "source": "public_domain_notes",
        "source_description": "Classic perfume with well-documented composition"
    },
    {
        "id": "seed-002",
        "name": "Shalimar",
        "brand": "Guerlain",
        "notes": ["bergamot", "lemon", "mandarin", "iris", "jasmine", "rose", "vanilla", 
                  "tonka bean", "incense", "opoponax", "patchouli", "leather"],
        "source": "public_domain_notes",
        "source_description": "Historic oriental perfume"
    },
    {
        "id": "seed-003",
        "name": "Diorissimo",
        "brand": "Dior",
        "notes": ["lily of the valley", "bergamot", "amaryllis", "jasmine", "lily", 
                  "ylang ylang", "sandalwood", "civet"],
        "source": "public_domain_notes",
        "source_description": "Classic floral perfume"
    },
    {
        "id": "seed-004",
        "name": "Acqua di Gio",
        "brand": "Giorgio Armani",
        "notes": ["lime", "lemon", "bergamot", "jasmine", "orange", "mandarin orange",
                  "rosemary", "freesia", "calone", "persimmon", "white musk", "cedar", 
                  "oak moss", "patchouli", "amber"],
        "source": "public_domain_notes",
        "source_description": "Modern aquatic fragrance"
    },
    {
        "id": "seed-005",
        "name": "Light Blue",
        "brand": "Dolce & Gabbana",
        "notes": ["sicilian lemon", "apple", "cedar", "bellflower", "jasmine", 
                  "white rose", "bamboo", "amber", "musk"],
        "source": "public_domain_notes",
        "source_description": "Contemporary fresh fragrance"
    },
    {
        "id": "seed-006",
        "name": "Angel",
        "brand": "Thierry Mugler",
        "notes": ["melon", "coconut", "mandarin orange", "cassia", "jasmine", 
                  "honey", "bergamot", "cotton candy", "chocolate", "caramel", 
                  "vanilla", "tonka bean", "patchouli", "musk"],
        "source": "public_domain_notes",
        "source_description": "Iconic gourmand fragrance"
    },
    {
        "id": "seed-007",
        "name": "Cool Water",
        "brand": "Davidoff",
        "notes": ["mint", "lavender", "coriander", "rosemary", "geranium", 
                  "neroli", "jasmine", "sandalwood", "cedar", "oak moss", 
                  "musk", "tobacco", "amber"],
        "source": "public_domain_notes",
        "source_description": "Classic aromatic aquatic"
    },
    {
        "id": "seed-008",
        "name": "CK One",
        "brand": "Calvin Klein",
        "notes": ["lemon", "bergamot", "cardamom", "pineapple", "papaya",
                  "jasmine", "violet", "rose", "nutmeg", "lily of the valley",
                  "amber", "musk", "cedar", "sandalwood", "oak moss", "green tea"],
        "source": "public_domain_notes",
        "source_description": "Unisex citrus fragrance"
    },
    {
        "id": "seed-009",
        "name": "Flowerbomb",
        "brand": "Viktor & Rolf",
        "notes": ["tea", "bergamot", "osmanthus", "freesia", "jasmine", 
                  "orchid", "rose", "amber", "musk", "patchouli"],
        "source": "public_domain_notes",
        "source_description": "Modern floral bomb"
    },
    {
        "id": "seed-010",
        "name": "Black Opium",
        "brand": "Yves Saint Laurent",
        "notes": ["pink pepper", "orange blossom", "pear", "coffee", 
                  "jasmine", "bitter almond", "licorice", "vanilla", 
                  "patchouli", "cedar", "cashmere wood"],
        "source": "public_domain_notes",
        "source_description": "Contemporary gourmand"
    },
    {
        "id": "seed-011",
        "name": "Terre d'Hermes",
        "brand": "Hermes",
        "notes": ["orange", "grapefruit", "pepper", "pelargonium", 
                  "flint", "vetiver", "cedar", "benzoin", "patchouli"],
        "source": "public_domain_notes",
        "source_description": "Modern woody spicy"
    },
    {
        "id": "seed-012",
        "name": "La Vie Est Belle",
        "brand": "Lancome",
        "notes": ["black currant", "pear", "iris", "jasmine", "orange blossom",
                  "praline", "vanilla", "tonka bean", "patchouli"],
        "source": "public_domain_notes",
        "source_description": "Sweet floral gourmand"
    }
]

def normalize_note(note):
    """Normalize note names."""
    return note.lower().strip()

def main():
    print("Building Note Match seed dataset...")
    
    # Start with manual seed
    fragrances = {}
    for item in MANUAL_SEED:
        item['notes'] = [normalize_note(n) for n in item['notes']]
        fragrances[item['id']] = item
    
    print(f"✓ Added {len(fragrances)} manual seed perfumes")
    
    # Try to fetch and add Wikidata
    print("\nFetching additional data from Wikidata...")
    wd_data = fetch_wikidata()
    
    if wd_data and 'results' in wd_data:
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
                    'source_id': p_id
                }
            
            if p_note:
                perfume_data[p_id]['notes'].add(normalize_note(p_note))
        
        # Add Wikidata items with 4+ notes
        wd_count = 0
        for p_id, p_data in perfume_data.items():
            if len(p_data['notes']) >= 4 and p_data['name']:
                p_data['notes'] = sorted(list(p_data['notes']))
                fragrances[p_id] = p_data
                wd_count += 1
        
        print(f"✓ Added {wd_count} perfumes from Wikidata with 4+ notes")
    else:
        print("  ⚠ Wikidata fetch failed, using manual seed only")
    
    # Collect all unique notes
    all_notes = set()
    for frag in fragrances.values():
        all_notes.update(frag['notes'])
    
    # Build output
    output = {
        "source": "note_match_seed",
        "license": "CC0 1.0 Universal",
        "created_at": datetime.now().isoformat() + "Z",
        "description": "Seed dataset for Note Match demo, combining manual curation and Wikidata CC0 data",
        "count": len(fragrances),
        "note_count": len(all_notes),
        "fragrances": list(fragrances.values()),
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
    note_counts = [len(f['notes']) for f in fragrances.values()]
    print(f"  Note range: {min(note_counts)}-{max(note_counts)} notes per perfume")
    print(f"  Average: {sum(note_counts) / len(note_counts):.1f} notes")

if __name__ == "__main__":
    main()
