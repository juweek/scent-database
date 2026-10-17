#!/usr/bin/env python3
"""
Compute note-based similarity for all perfumes.
Implements weighted note vectors with IDF, cosine similarity.
"""

import json
import math
from collections import defaultdict
from datetime import datetime

def load_seed():
    """Load the seed dataset."""
    with open('public/data/note-match/seed.json', 'r') as f:
        return json.load(f)

def compute_idf(fragrances):
    """Compute IDF (inverse document frequency) for each note."""
    note_doc_freq = defaultdict(int)
    n_docs = len(fragrances)
    
    for frag in fragrances:
        notes_set = set(frag['notes'])
        for note in notes_set:
            note_doc_freq[note] += 1
    
    idf = {}
    for note, df in note_doc_freq.items():
        # Cap IDF so rare notes don't dominate
        idf[note] = min(math.log(n_docs / df), 3.0)
    
    return idf

def build_note_vector(notes, idf):
    """Build a weighted note vector."""
    vector = defaultdict(float)
    for note in notes:
        # Weight = IDF
        # (no tier weights since we don't have pyramid data)
        vector[note] = idf.get(note, 1.0)
    return dict(vector)

def cosine_similarity(vec1, vec2):
    """Compute cosine similarity between two vectors."""
    dot_product = sum(vec1.get(note, 0) * vec2.get(note, 0) for note in set(vec1) | set(vec2))
    
    mag1 = math.sqrt(sum(v * v for v in vec1.values()))
    mag2 = math.sqrt(sum(v * v for v in vec2.values()))
    
    if mag1 == 0 or mag2 == 0:
        return 0.0
    
    return dot_product / (mag1 * mag2)

def get_shared_notes(notes1, notes2):
    """Get shared notes between two perfumes."""
    return sorted(list(set(notes1) & set(notes2)))

def compute_match_percentage(similarity):
    """Convert similarity score (0-1) to percentage (0-100)."""
    return round(similarity * 100)

def get_match_band(percentage):
    """Get the match quality band."""
    if percentage >= 80:
        return "very_similar"
    elif percentage >= 60:
        return "similar"
    elif percentage >= 40:
        return "some_overlap"
    else:
        return "low"

def main():
    print("Computing note-based similarity matches...")
    
    # Load data
    seed_data = load_seed()
    fragrances = seed_data['fragrances']
    
    print(f"  Loaded {len(fragrances)} perfumes")
    
    # Filter: require 4+ notes
    fragrances = [f for f in fragrances if len(f['notes']) >= 4]
    print(f"  Filtered to {len(fragrances)} with 4+ notes")
    
    # Compute IDF
    idf = compute_idf(fragrances)
    print(f"  Computed IDF for {len(idf)} notes")
    
    # Build vectors for all fragrances
    vectors = {}
    for frag in fragrances:
        vectors[frag['id']] = build_note_vector(frag['notes'], idf)
    
    # Compute all pairwise similarities
    matches = {}
    for i, frag1 in enumerate(fragrances):
        frag1_matches = []
        
        for j, frag2 in enumerate(fragrances):
            if i == j:
                continue
            
            similarity = cosine_similarity(vectors[frag1['id']], vectors[frag2['id']])
            percentage = compute_match_percentage(similarity)
            
            # Only keep matches >= 40%
            if percentage >= 40:
                shared = get_shared_notes(frag1['notes'], frag2['notes'])
                
                frag1_matches.append({
                    'id': frag2['id'],
                    'name': frag2['name'],
                    'brand': frag2['brand'],
                    'similarity': round(similarity, 3),
                    'match_percentage': percentage,
                    'match_band': get_match_band(percentage),
                    'shared_notes': shared,
                    'shared_count': len(shared),
                    'total_notes': len(frag2['notes'])
                })
        
        # Sort by similarity descending
        frag1_matches.sort(key=lambda x: x['similarity'], reverse=True)
        
        # Keep top 20
        matches[frag1['id']] = frag1_matches[:20]
    
    # Build output
    output = {
        "source": "note_match_computed",
        "computed_at": datetime.now().isoformat() + "Z",
        "description": "Precomputed note-based similarity matches using IDF-weighted cosine similarity",
        "method": {
            "algorithm": "cosine_similarity",
            "weighting": "IDF",
            "min_notes": 4,
            "min_match": 40,
            "max_neighbors": 20
        },
        "perfume_count": len(fragrances),
        "note_count": len(idf),
        "matches": matches
    }
    
    # Write output
    output_path = "public/data/note-match/matches.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Wrote {output_path}")
    
    # Stats
    total_matches = sum(len(m) for m in matches.values())
    avg_matches = total_matches / len(matches) if matches else 0
    print(f"  Total match pairs: {total_matches}")
    print(f"  Average matches per perfume: {avg_matches:.1f}")
    
    # Distribution by band
    bands = defaultdict(int)
    for frag_matches in matches.values():
        for match in frag_matches:
            bands[match['match_band']] += 1
    
    print(f"\n  Match distribution:")
    for band in ['very_similar', 'similar', 'some_overlap']:
        print(f"    {band}: {bands[band]}")

if __name__ == "__main__":
    main()
