/**
 * A note's partners, ranked two ways.
 *
 * Everything here is arithmetic on the matrix the wheel already holds, plus
 * the per-note totals stamped in by scripts/pipeline/note_totals.py. No fetch,
 * no loading state — the panel can render in the same frame as the search.
 *
 * The two rankings answer genuinely different questions, which is why the
 * panel offers both rather than picking one:
 *
 *   "often"      — raw co-occurrence. How many perfumes put these together.
 *                  Honest, and mostly boring: the top of every note's list is
 *                  musk, jasmine, sandalwood, bergamot, because those are in
 *                  everything. Rose's top partner by count is musk (3,467).
 *
 *   "distinctive" — lift: how much more often the pair occurs than it would if
 *                  the two notes were sprinkled independently across the
 *                  catalogue. Rose's top partner by lift is carnation (2.2x),
 *                  then aldehydes and orris root — which is the vintage rose
 *                  chypre, an actual perfumery idea rather than an artefact of
 *                  what is common.
 *
 * Neither is a recommendation. Both describe what has been bottled, which is a
 * record of fashion and marketing copy as much as of craft.
 */

/**
 * Minimum co-occurrences before a pair is ranked at all.
 *
 * Lift is a ratio, so it explodes on thin evidence: two notes that appear
 * together four times can outscore a real pairing seen five hundred times. The
 * floor is flat rather than proportional because the wheel's vocabulary is
 * already truncated to the 140 most common notes — even the rarest of them
 * (birch, 291 perfumes) clears it with 18-38 partners to spare, so a
 * proportional floor would buy nothing and cost legibility.
 */
export const MIN_SUPPORT = 25;

/** How many partners a ranking shows before "show more". */
export const TOP_N = 6;

/**
 * Partners of `note`, unranked, with both metrics attached.
 *
 * @param data  the accord wheel JSON (needs `totals`; older bakes lack it)
 * @param set   which matrix — 'all' or 'best'
 * @param note  the focused note
 * @returns [] when the note is unknown or the wheel predates `totals`
 */
export function pairingsFor(data, note, set = 'all') {
  const { names, totals, matrices, counts, groups } = data;
  if (!totals || !note) return [];

  const index = names.indexOf(note);
  const noteTotal = totals[note];
  if (index < 0 || !noteTotal) return [];

  const row = matrices[set][index];
  const population = counts[set];
  const hidden = aliasesOf(data, note);

  const pairings = [];
  for (let j = 0; j < names.length; j += 1) {
    const partner = names[j];
    const count = row[j];
    if (j === index || count < MIN_SUPPORT || hidden.has(partner)) continue;

    const partnerTotal = totals[partner];
    if (!partnerTotal) continue;

    pairings.push({
      note: partner,
      family: groups[partner],
      count,
      // Of every perfume carrying the focused note, the fraction that also
      // carries this partner. Deliberately asymmetric: 57% of rose perfumes
      // have musk, but only 32% of musk perfumes have rose.
      share: count / noteTotal,
      // Observed co-occurrence over the co-occurrence you would expect if the
      // two notes were distributed independently. 1.0 is exactly chance.
      lift: (count * population) / (noteTotal * partnerTotal),
    });
  }
  return pairings;
}

/** `pairingsFor`, sorted. `by` is 'often' (raw count) or 'distinctive' (lift). */
export function rankPairings(data, note, set, by) {
  const key = by === 'distinctive' ? 'lift' : 'count';
  return pairingsFor(data, note, set).sort((a, b) => b[key] - a[key]);
}

/**
 * Other spellings of the same material on this wheel.
 *
 * The upstream note names are community-edited, so "oakmoss" and "oak moss"
 * both survive as separate arcs. Listing one as the other's distinctive
 * partner would be nonsense dressed up as a finding, so the panel drops them.
 * The arcs themselves are left alone — merging them is a change to the wheel,
 * not to this panel. See scripts/pipeline/note_totals.py.
 */
export function aliasesOf(data, note) {
  const group = (data.aliases || []).find((pair) => pair.includes(note));
  return new Set(group ? group.filter((name) => name !== note) : []);
}

/** Human phrasing for a lift value. Kept out of JSX so the thresholds are visible. */
export function describeLift(lift) {
  if (lift >= 1.15) return `${lift.toFixed(1)}× more often than chance`;
  if (lift <= 0.85) return `${(1 / lift).toFixed(1)}× less often than chance`;
  return 'about as often as chance';
}
