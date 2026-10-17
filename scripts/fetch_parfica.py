#!/usr/bin/env python3
"""
Fetch Parfica CC0 open data for notes and brands.
Source: https://github.com/parfica/parfica-open-data
License: CC0 1.0 Universal (Public Domain)
"""

import json
import urllib.request
import sys
from datetime import datetime

PARFICA_BASE = "https://raw.githubusercontent.com/parfica/parfica-open-data/main"

def fetch_json(url):
    """Fetch JSON from URL with error handling."""
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return None

def main():
    output = {
        "source": "parfica/parfica-open-data",
        "license": "CC0 1.0 Universal",
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "notes": [],
        "brands": [],
        "fragrances": []
    }
    
    # Fetch notes
    print("Fetching Parfica notes...")
    notes_url = f"{PARFICA_BASE}/data/notes.json"
    notes_data = fetch_json(notes_url)
    if notes_data:
        output["notes"] = notes_data
        print(f"  ✓ Fetched {len(notes_data)} notes")
    
    # Fetch brands
    print("Fetching Parfica brands...")
    brands_url = f"{PARFICA_BASE}/data/brands.json"
    brands_data = fetch_json(brands_url)
    if brands_data:
        output["brands"] = brands_data
        print(f"  ✓ Fetched {len(brands_data)} brands")
    
    # Fetch fragrances (if available)
    print("Fetching Parfica fragrances...")
    fragrances_url = f"{PARFICA_BASE}/data/fragrances.json"
    fragrances_data = fetch_json(fragrances_url)
    if fragrances_data:
        output["fragrances"] = fragrances_data
        print(f"  ✓ Fetched {len(fragrances_data)} fragrances")
    
    # Write output
    output_path = "public/data/note-match/parfica.json"
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Wrote {output_path}")
    print(f"  Notes: {len(output['notes'])}")
    print(f"  Brands: {len(output['brands'])}")
    print(f"  Fragrances: {len(output['fragrances'])}")

if __name__ == "__main__":
    main()
