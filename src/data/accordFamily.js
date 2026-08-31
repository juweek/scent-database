/**
 * Accord → scent family, for colouring the main-accord bars.
 *
 * The source gives each perfume five ranked accords (mainaccord1..5) drawn from
 * an 84-word vocabulary. `pyramid.json`'s `accordFamily` already maps 55 of
 * them, because the pyramid wheel needed exactly that; the rest are listed here.
 *
 * PROVENANCE, since docs/FRAGRANCE-DATA.md is strict about this: these
 * assignments are OURS, not Fragrantica's. The ones below are the defensible
 * remainder — "gourmand" belongs with sweet, "terpenic" with herbal. Everything
 * genuinely unmappable is deliberately absent rather than forced: Fragrantica's
 * accord list includes "gasoline", "industrial glue", "brown scotch tape" and
 * "hot iron", which are real descriptions of real perfumes and belong to none
 * of our ten families. Those render neutral, which is the honest answer.
 */

const OURS = {
  spicy: 'spicy',
  'warm spicy': 'spicy',
  aldehydic: 'fresh',
  terpenic: 'herbal',
  cannabis: 'herbal',
  gourmand: 'sweet',
  cherry: 'fruity',
  oriental: 'amber',
  // Boozy accords sit with the sweet/gourmand register in every perfume that
  // carries them. Grouped, but flagged as a judgement call.
  rum: 'sweet',
  whiskey: 'sweet',
  wine: 'sweet',
  champagne: 'sweet',
  vodka: 'sweet',
  alcohol: 'sweet',
};

/**
 * Two family labels in `pyramid.json` that are not families.
 *
 * `accord.json` defines the canonical ten, but pyramid.json's `accordFamily`
 * and its per-tier `noteFamily` both emit twelve values — the extra two being
 * "green" and "white floral", which are accords that were never folded up.
 * They have no colour in the palette, so anything carrying them rendered a
 * flat grey with no legend entry: 42 notes across the pyramid tiers, plus
 * three accords.
 *
 * The mapping is not a new judgement call — it is the one `accord.json`
 * already made. It files "green notes" and galbanum under FRESH, and
 * tuberose, gardenia and jasmine under FLORAL. Normalising here makes the
 * accord wheel and the perfume chord agree with the note wheel instead of
 * quietly inventing an eleventh and twelfth family.
 */
const NORMALISE = {
  green: 'fresh',
  'white floral': 'floral',
};

/** Fold a possibly-stray family label into the canonical ten. */
export function normalizeFamily(family) {
  if (!family) return null;
  return NORMALISE[family] ?? family;
}

/**
 * Family for one accord, or null when we decline to classify it.
 * @param accordFamily pyramid.json's accord→family map, which carries 55
 */
export function familyOfAccord(accordFamily, accord) {
  return normalizeFamily(accordFamily?.[accord] ?? OURS[accord] ?? null);
}

export default OURS;
