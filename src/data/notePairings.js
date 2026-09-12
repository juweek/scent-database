/**
 * A note's partners, ranked four ways.
 *
 * Everything here is arithmetic on the matrix the wheel already holds, plus
 * the per-note totals stamped in by scripts/pipeline/note_totals.py. No fetch,
 * no loading state — the panel can render in the same frame as the search.
 *
 * The rankings answer genuinely different questions, which is why the panel
 * offers all of them rather than picking one:
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
 *   "avoided"    — the same lift, read from the bottom. Pairs that DO occur,
 *                  but well under what chance predicts. See RANKINGS for why
 *                  this cannot be "notes that never meet".
 *
 *   "rated"      — of the perfumes that pair these two notes, the share rated
 *                  4.0 or better. The catalogue's own rate is about 47%, so
 *                  that, not zero, is the line worth beating.
 *
 * None is a recommendation. All describe what has been bottled, which is a
 * record of fashion and marketing copy as much as of craft — and "rated" adds
 * a second filter on top: who bothered to review it, and liked it enough.
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

/** How many partners a ranking shows before "show more" — which is the wall. */
export const TOP_N = 10;

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
  // bestShare has to read BOTH matrices whatever `set` is showing. Taken from
  // the active row it would be 1.0 for every pair on the best-rated set — a
  // column of 100%s that looks like data and says nothing.
  //
  // Guarded, because only the note wheel HAS an all/best split. The accords
  // wheel's two matrices are together/beyondChance, and reaching for .all
  // there is undefined[index] — which is exactly how this crashed the accords
  // wheel on every search until it was caught. See supportsRating.
  const rated = supportsRating(data);
  const allRow = rated ? matrices.all[index] : null;
  const bestRow = rated ? matrices.best[index] : null;
  const hidden = aliasesOf(data, note);

  const pairings = [];
  for (let j = 0; j < names.length; j += 1) {
    const partner = names[j];
    const count = row[j];
    if (j === index || count < MIN_SUPPORT || hidden.has(partner)) continue;

    const partnerTotal = totals[partner];
    if (!partnerTotal) continue;

    // Falls back to the active set's own count, so `rated`-less wheels still
    // get a sane number anywhere allCount is read.
    const allCount = allRow ? allRow[j] : count;
    // Observed co-occurrence over the co-occurrence you would expect if the
    // two notes were distributed independently. 1.0 is exactly chance.
    const lift = (count * population) / (noteTotal * partnerTotal);

    pairings.push({
      note: partner,
      family: groups[partner],
      count,
      allCount,
      // Of every perfume carrying the focused note, the fraction that also
      // carries this partner. Deliberately asymmetric: 57% of rose perfumes
      // have musk, but only 32% of musk perfumes have rose.
      share: count / noteTotal,
      lift,
      // The mirror of lift, so a bar can grow with how much a pair is avoided
      // rather than shrink towards nothing.
      avoidance: 1 / lift,
      // Of the perfumes that pair these two, the fraction rated 4.0 or better.
      // Compare against the catalogue's own rate, not against zero — roughly
      // 47% of all 24,059 records clear 4.0.
      bestShare: rated && allCount ? bestRow[j] / allCount : null,
    });
  }
  return pairings;
}

/**
 * How the four tabs rank the same set of pairings.
 *
 * `sort` is what orders the list; `scale` is what the bar length shows. They
 * differ for 'often' only because share and count order identically — the bar
 * reads better as a percentage.
 *
 * A word on 'avoided'. It cannot show notes that never meet, and that is not a
 * shortcut: pairs under MIN_SUPPORT are excluded because a ratio built on four
 * co-occurrences is noise, and the great majority of the 9,730 possible pairs
 * simply never occur, which is a fact about a 140-note vocabulary rather than a
 * finding about any one note. So it ranks pairs that DO occur by how far below
 * chance they land — the honest mirror of 'distinctive'.
 */
/**
 * Can this wheel answer "best rated"? Only if it carries the all/best matrix
 * pair the share is computed from — the note wheel does, the accords wheel
 * does not. WheelPage uses this to decide which tabs to offer, so a ranking is
 * never shown that would throw when selected.
 */
export function supportsRating(data) {
  return Boolean(data?.matrices?.all && data?.matrices?.best);
}

export const RANKINGS = {
  often: { label: 'most often', sort: 'count', scale: 'share', dir: -1 },
  distinctive: { label: 'most distinctive', sort: 'lift', scale: 'lift', dir: -1 },
  avoided: { label: 'avoided', sort: 'lift', scale: 'avoidance', dir: 1 },
  rated: { label: 'best rated', sort: 'bestShare', scale: 'bestShare', dir: -1 },
};

/** `pairingsFor`, sorted by one of RANKINGS. */
export function rankPairings(data, note, set, by) {
  const ranking = RANKINGS[by] || RANKINGS.often;
  const rated = by === 'rated' && supportsRating(data);
  const pairings = pairingsFor(data, note, set).filter(
    // bestShare divides by the all-set count, so it needs its own floor when
    // the wheel is showing the best-rated matrix.
    (pairing) => !rated || pairing.allCount >= MIN_SUPPORT,
  );
  return pairings.sort((a, b) => (a[ranking.sort] - b[ranking.sort]) * ranking.dir);
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
