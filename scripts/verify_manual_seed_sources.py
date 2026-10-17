#!/usr/bin/env python3
"""
Verify and update manual seed perfumes with proper provenance.
Each record needs a real, citable source: brand official page or Wikidata QID.
"""

import json
import urllib.request
import urllib.parse
from datetime import datetime

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"

# Query to find perfumes by name and get their QIDs and notes
def search_wikidata_by_name(name):
    """Search for a perfume by name in Wikidata."""
    query = f"""
    SELECT ?item ?itemLabel ?brandLabel ?notes WHERE {{
      ?item wdt:P31 wd:Q131746.  # instance of perfume
      ?item rdfs:label ?label.
      FILTER(CONTAINS(LCASE(?label), "{name.lower()}"))
      OPTIONAL {{ ?item wdt:P1056 ?brand. }}
      OPTIONAL {{ ?item wdt:P5872 ?notes. }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    LIMIT 5
    """
    
    params = {'query': query, 'format': 'json'}
    url = f"{WIKIDATA_SPARQL}?{urllib.parse.urlencode(params)}"
    
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'NoteMatchProvenance/1.0')
        
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data['results']['bindings']
    except Exception as e:
        print(f"  Error searching for {name}: {e}")
        return []

# Perfumes to verify with known Wikidata presence
PERFUMES_TO_CHECK = [
    "Chanel No. 5",
    "Shalimar",
    "Diorissimo",
    "Acqua di Gio",
    "Light Blue",
    "Angel",
    "Cool Water",
    "CK One",
    "Flowerbomb",
    "Black Opium",
    "Terre d'Hermes",
    "La Vie Est Belle"
]

def main():
    print("Verifying manual seed perfume provenance...\n")
    
    verified = []
    
    for perfume_name in PERFUMES_TO_CHECK:
        print(f"Searching: {perfume_name}")
        results = search_wikidata_by_name(perfume_name)
        
        if results:
            for result in results:
                qid = result['item']['value'].split('/')[-1]
                name = result.get('itemLabel', {}).get('value', '')
                brand = result.get('brandLabel', {}).get('value', '')
                
                print(f"  ✓ Found: {name} ({brand}) - {qid}")
                verified.append({
                    'search': perfume_name,
                    'qid': qid,
                    'name': name,
                    'brand': brand,
                    'url': result['item']['value']
                })
                break
        else:
            print(f"  ✗ Not found in Wikidata")
        
        print()
    
    # Write results
    with open('/tmp/wikidata_verified.json', 'w') as f:
        json.dump(verified, f, indent=2)
    
    print(f"\n✓ Verified {len(verified)} of {len(PERFUMES_TO_CHECK)} perfumes")
    print(f"  Results saved to /tmp/wikidata_verified.json")

if __name__ == "__main__":
    main()
