"""
Note synonym normalization and accord-family mapping.
Hand-built from common perfume note variations.
"""

# Synonyms: variants that should be treated as the same note
NOTE_SYNONYMS = {
    # Spelling variants
    'oakmoss': 'oak moss',
    'vanille': 'vanilla',
    'cloves': 'clove',
    'woodsy notes': 'woody notes',
    
    # Geographic/type variants (cedar family)
    'virginia cedar': 'cedar',
    'cedarwood': 'cedar',
    'atlas cedar': 'cedar',
    'cedar wood': 'cedar',
    'texas cedar': 'cedar',
    
    # Iris family
    'orris': 'iris',
    'orris root': 'iris',
    'iris root': 'iris',
    
    # Citrus variants
    'sicilian lemon': 'lemon',
    'sicilian bergamot': 'bergamot',
    'calabrian bergamot': 'bergamot',
    'mandarin orange': 'mandarin',
    'sweet orange': 'orange',
    'citrus sinensis': 'orange',
    'bigarade': 'orange',
    'clementine': 'mandarin',
    
    # Floral variants
    'white rose': 'rose',
    'bulgarian rose': 'rose',
    'damask rose': 'rose',
    'turkish rose': 'rose',
    'may rose': 'rose',
    'candied rose': 'rose',
    'chinese osmanthus': 'osmanthus',
    'casablanca lily': 'lily',
    'almond blossom': 'almond',
    'apricot blossom': 'apricot',
    'banana blossom': 'banana',
    
    # Musk variants
    'white musk': 'musk',
    'abelmoschus moschatus': 'musk',
    'ambrette seed': 'musk',
    'ambrettolide': 'musk',
    
    # Wood variants
    'sandalwood': 'sandalwood',
    'australian sandalwood': 'sandalwood',
    'amberwood': 'cedar',
    'akigalawood': 'cedar',
    'camphorwood': 'cedar',
    
    # Vanilla variants
    'madagascar vanilla': 'vanilla',
    
    # Amber variants
    'ambroxan': 'amber',
    'ambrofix': 'amber',
    
    # Tea variants
    'black tea': 'green tea',
    
    # Fruit variants
    'apples': 'apple',
    'cherries': 'cherry',
    'black cherry': 'cherry',
    'blackberry fruit': 'blackberry',
    'apricot fruit': 'apricot',
    'blood grapefruit': 'grapefruit',
    'blueberry jam': 'blueberry',
    'candied fruit': 'fruit',
    
    # Berry variants
    'blackcurrant': 'black currant',
    'blackcurrant leaf': 'black currant',
    
    # Aquatic variants
    'sea notes': 'aquatic notes',
    'marine notes': 'aquatic notes',
    'ozonic notes': 'aquatic notes',
    'algal': 'aquatic notes',
    'aquaflora': 'aquatic notes',
    
    # Other
    'beeswax': 'honey',
    'beeswax absolute': 'honey',
    'anise seed': 'anise',
    'caraway': 'anise',
    'angelica root': 'angelica',
    'birch': 'leather',
    'autumnal leaves': 'green notes',
    'abies balsamea': 'fir',
    'acacia dealbata': 'mimosa',
}

# Accord families: map each note to a scent family
# Based on traditional perfume classification
ACCORD_FAMILIES = {
    # Citrus
    'citrus': ['lemon', 'bergamot', 'orange', 'grapefruit', 'mandarin', 'lime', 
               'yuzu', 'petitgrain', 'neroli', 'tangerine', 'blood orange', 'citrus'],
    
    # Fresh/Aquatic
    'fresh': ['mint', 'calone', 'aquatic notes', 'water notes', 'green tea', 
              'cucumber', 'bamboo', 'aldehydes', 'green notes', 'tea'],
    
    # Herbal/Aromatic
    'herbal': ['lavender', 'rosemary', 'basil', 'thyme', 'sage', 'bay leaf',
               'tarragon', 'marjoram', 'clary sage', 'geranium', 'coriander',
               'angelica', 'anise', 'artemesia fragrance'],
    
    # Floral
    'floral': ['rose', 'jasmine', 'lily of the valley', 'iris', 'ylang ylang',
               'tuberose', 'gardenia', 'narcissus', 'freesia', 'lily', 'peony',
               'magnolia', 'orange blossom', 'osmanthus', 'orchid',
               'violet', 'mimosa', 'carnation', 'heliotrope', 'amaryllis',
               'honeysuckle', 'hyacinth', 'wisteria', 'frangipani'],
    
    # Fruity
    'fruity': ['apple', 'pear', 'peach', 'apricot', 'plum', 'berries', 
               'strawberry', 'raspberry', 'blackberry', 'black currant',
               'red berries', 'pineapple', 'papaya', 'coconut', 'melon',
               'watermelon', 'fig', 'persimmon', 'cherry', 'banana',
               'blueberry', 'fruit', 'rhubarb', 'guava', 'passionfruit',
               'lychee', 'kiwi', 'pomegranate'],
    
    # Sweet/Gourmand
    'sweet': ['vanilla', 'tonka bean', 'caramel', 'chocolate', 'honey',
              'praline', 'cotton candy', 'almond', 'bitter almond', 'hazelnut',
              'coffee', 'licorice', 'marshmallow', 'sugar', 'rum', 'cognac',
              'cream', 'milk', 'butter', 'toffee'],
    
    # Spicy
    'spicy': ['pepper', 'pink pepper', 'black pepper', 'cinnamon', 'nutmeg',
              'cardamom', 'clove', 'ginger', 'star anise', 'cassia', 'saffron',
              'coriander seed', 'cumin', 'allspice'],
    
    # Amber/Oriental
    'amber': ['amber', 'benzoin', 'labdanum', 'frankincense', 'myrrh',
              'incense', 'opoponax', 'styrax', 'coumarin', 'balsam', 'resin',
              'elemi', 'galbanum resin'],
    
    # Woody
    'woody': ['cedar', 'sandalwood', 'vetiver', 'oak moss', 'patchouli',
              'cypress', 'pine', 'fir', 'juniper', 'guaiac wood', 'agarwood',
              'oud', 'cashmeran', 'cashmere wood', 'flint', 'pelargonium',
              'ebony', 'mahogany', 'redwood', 'driftwood'],
    
    # Musky/Animalic
    'musky': ['musk', 'civet', 'castoreum', 'ambergris', 'leather', 'tobacco',
              'suede', 'birch tar', 'ash', 'smoke']
}

def normalize_note(note):
    """
    Normalize a note name by:
    1. Stripping Wikidata descriptive phrases
    2. Applying synonym mapping
    Returns the canonical form.
    """
    note = note.lower().strip()
    
    # Strip common Wikidata descriptive prefixes/suffixes
    prefixes = ['aroma of ', 'scent of ', 'smell of ', 'fragrance of ', 'odour of ']
    suffixes = [' aroma', ' scent', ' smell', ' fragrance', ' odour', ' note', ' notes',
                ' fragrance note', ' smell (generic)', ' (generic)', ' wood (generic)']
    
    for prefix in prefixes:
        if note.startswith(prefix):
            note = note[len(prefix):]
            break
    
    for suffix in suffixes:
        if note.endswith(suffix):
            note = note[:-len(suffix)]
            break
    
    note = note.strip()
    
    # Apply synonym mapping
    return NOTE_SYNONYMS.get(note, note)

def get_note_family(note):
    """
    Get the accord family for a note.
    Returns family name or None if not mapped.
    """
    note = normalize_note(note)
    for family, notes in ACCORD_FAMILIES.items():
        if note in notes:
            return family
    return None

def get_all_note_families(notes):
    """
    Get all families present in a list of notes.
    Returns dict of {family: [notes in that family]}
    """
    families = {}
    for note in notes:
        family = get_note_family(note)
        if family:
            if family not in families:
                families[family] = []
            families[family].append(note)
    return families
