/**
 * Figures quoted by the static prose in index.html, computed from the same baked wheels the
 * app renders. A data rebake cannot leave the writing quietly wrong, because nothing in the
 * prose is typed by hand.
 *
 * Used by the `publisher-content` plugin in vite.config.js at build and in dev.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (name) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../src/data/wheels/${name}.json`, import.meta.url))),
  );
const num = (value) => value.toLocaleString('en-US');
const pct = (part, whole) => String(Math.round((part / whole) * 100));

export function contentTokens(site) {
  const accord = read('accord');
  const accords = read('accords');
  const family = read('family');

  const names = accord.names;
  const matrix = accord.matrices.all;
  const totals = accord.totals;
  const population = accord.counts.all;

  const byUse = [...names].sort((a, b) => totals[b] - totals[a]);
  const [first, second, third] = byUse;

  // Every pairing drawn on the wheel, and the ones that beat what chance predicts.
  let pairCount = 0;
  const lifted = [];
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const both = matrix[i][j];
      if (!both) continue;
      pairCount += 1;
      // Support floor: below this, lift is measuring noise rather than a habit.
      if (both < 300) continue;
      const expected = (totals[names[i]] / population) * (totals[names[j]] / population);
      lifted.push({ a: names[i], b: names[j], both, lift: both / population / expected });
    }
  }
  lifted.sort((x, y) => y.lift - x.lift);
  const top = lifted[0];

  const leadRanked = [...accords.names].sort((a, b) => accords.leadShare[b] - accords.leadShare[a]);
  const biggestFamily = [...accord.familyOrder].sort(
    (a, b) => family.famNoteCount[b] - family.famNoteCount[a],
  )[0];

  return {
    site,
    fragrances: num(population),
    notes: num(names.length),
    families: String(accord.familyOrder.length),
    accords: String(accords.names.length),
    pairings: num(pairCount),

    topNote: first,
    topNoteShare: pct(totals[first], population),
    secondNote: second,
    secondNoteShare: pct(totals[second], population),
    thirdNote: third,
    thirdNoteShare: pct(totals[third], population),

    topLiftPair: `${top.a} and ${top.b}`,
    topLift: top.lift.toFixed(1),
    topLiftCount: num(top.both),
    liftedPairs: String(lifted.length),

    biggestFamily,
    biggestFamilyNotes: String(family.famNoteCount[biggestFamily]),

    leadAccord: leadRanked[0],
    leadAccordShare: pct(accords.leadShare[leadRanked[0]] * 100, 100),
    quietAccord: leadRanked[leadRanked.length - 1],

    license: accords.metadata.license,
    sourceUrl: 'https://www.kaggle.com/datasets/olgagmiufana1/fragrantica-com-fragrance-dataset',
  };
}

export function fillTokens(html, tokens) {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in tokens)) throw new Error(`Unknown content token {{${key}}}`);
    return tokens[key];
  });
}
