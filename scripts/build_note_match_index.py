#!/usr/bin/env python3
"""
Build a searchable index of all perfumes for Note Match.
"""

import json
from datetime import datetime

def main():
    # Load seed data
    with open('public/data/note-match/seed.json', 'r') as f:
        seed_data = json.load(f)
    
    # Load matches to know which perfumes have matches
    with open('public/data/note-match/matches.json', 'r') as f:
        matches_data = json.load(f)
    
    fragrances = seed_data['fragrances']
    matches = matches_data['matches']
    
    # Build index
    index = []
    for frag in fragrances:
        # Only include perfumes with 4+ notes
        if len(frag['notes']) >= 4:
            has_matches = frag['id'] in matches and len(matches[frag['id']]) > 0
            
            index.append({
                'id': frag['id'],
                'name': frag['name'],
                'brand': frag['brand'],
                'note_count': len(frag['notes']),
                'has_matches': has_matches,
                'match_count': len(matches.get(frag['id'], [])),
                'search_text': f"{frag['name']} {frag['brand']}".lower()
            })
    
    # Sort by brand, then name
    index.sort(key=lambda x: (x['brand'].lower(), x['name'].lower()))
    
    output = {
        "source": "note_match_index",
        "created_at": datetime.now().isoformat() + "Z",
        "total_perfumes": len(index),
        "perfumes_with_matches": sum(1 for x in index if x['has_matches']),
        "index": index
    }
    
    output_path = "public/data/note-match/index.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Wrote {output_path}")
    print(f"  Total perfumes: {len(index)}")
    print(f"  With matches: {output['perfumes_with_matches']}")

if __name__ == "__main__":
    main()
