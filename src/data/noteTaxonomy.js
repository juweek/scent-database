/**
 * note → accord → family, merged from the wheel JSON we already ship.
 *
 * Three levels of grain, and the perfume chord draws a band for each:
 *
 *   note     "oak moss"        1,668 distinct across the catalogue
 *   accord   "mossy"           84 in the source's own vocabulary
 *   family   "woody"           our ten (see docs/FRAGRANCE-DATA.md — ours)
 *
 * The mappings live in the baked wheels rather than in a table of their own:
 * `accord.json` carries note→family for the 140 it draws, and each of
 * `pyramid.json`'s three tiers carries note→accord and note→family for its own
 * 130. Their union is 252 notes, which covers 91% of note instances across all
 * 24,050 perfumes — a median of 94% per perfume. The remaining 9% (bamboo, sea
 * water, sichuan pepper…) are genuinely unclassified and render as such rather
 * than being forced into a family.
 *
 * Loaded once, lazily, and shared: pyramid.json is 136 KB and no page should
 * pull it twice.
 */

import { normalizeFamily } from './accordFamily';

let promise = null;

export function getTaxonomy() {
  if (!promise) {
    promise = Promise.all([import('./wheels/accord.json'), import('./wheels/pyramid.json')])
      .then(([accord, pyramid]) => build(accord.default, pyramid.default))
      .catch((error) => {
        promise = null;
        throw error;
      });
  }
  return promise;
}

function build(accord, pyramid) {
  /*
   * PRECEDENCE MATTERS. Both files carry note→family and they disagree on 45 of
   * the 140 notes they share: pyramid.json derives a note's family from its
   * accord, so bergamot comes out "spicy" (via the fresh-spicy accord) and
   * neroli "floral". accord.json states the family directly, and it is what the
   * Notes wheel actually draws — so it wins wherever it has an opinion, and
   * pyramid fills in the other 112 notes. Without this the perfume chord would
   * colour bergamot spicy while the wheel two tabs over colours it citrus.
   */
  const noteFamily = {};
  const noteAccord = {};
  for (const tier of Object.values(pyramid.tiers)) {
    Object.assign(noteFamily, tier.noteFamily);
    Object.assign(noteAccord, tier.noteAccord);
  }
  Object.assign(noteFamily, accord.groups);

  // pyramid.json emits two labels that are not families — see accordFamily.js.
  for (const [note, family] of Object.entries(noteFamily)) {
    noteFamily[note] = normalizeFamily(family);
  }

  const accordFamily = Object.fromEntries(
    Object.entries(pyramid.accordFamily).map(([key, value]) => [key, normalizeFamily(value)]),
  );

  return {
    colors: accord.colors,
    familyOrder: accord.familyOrder,
    accordOrder: pyramid.accordOrder,
    accordFamily,
    noteFamily,
    noteAccord,
    /** Family for a note, or null when we decline to guess. */
    familyOf: (note) => noteFamily[note] ?? null,
    /** Accord for a note, or null. */
    accordOf: (note) => noteAccord[note] ?? null,
    /** Hue for a family, with one neutral for everything unclassified. */
    colorOf: (family) => (family ? (accord.colors[family] ?? UNCLASSIFIED) : UNCLASSIFIED),
  };
}

/** Notes and accords we hold no opinion about. Deliberately drab. */
export const UNCLASSIFIED = '#3a3d40';
