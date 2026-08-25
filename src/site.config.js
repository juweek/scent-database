/**
 * ──────────────────────────────────────────────────────────────────────────
 * THE ONE FILE TO EDIT for this project's CONTENT.
 * Title, tagline, nav, attribution. Nothing structural lives here.
 *
 * Other seams, each its own file (see README §"Where things go"):
 *   • a wheel's behaviour → src/wheels/<slug>.js   (bands, controls, readout)
 *   • the chord renderer  → src/viz/chordEngine.js + src/viz/ChordWheel.jsx
 *   • the look            → src/index.css
 * ──────────────────────────────────────────────────────────────────────────
 */
const site = {
  title: 'Scent chords',
  tagline:
    'What goes with what in perfume — every pairing between the most common notes, drawn from 24,059 fragrances.',

  // 'live' → real aggregated data, no SAMPLE tag. Flip to 'sample' if a wheel
  // is ever rebuilt on placeholder numbers.
  dataStatus: 'live',

  // Attribution is required on every page. Credit the upstream data source.
  attribution: {
    sourceName: 'Fragrantica fragrance dataset (24,059 perfumes)',
    sourceOrg: 'aggregated by Gourmet Data; note→family grouping is our own',
    sourceUrl: 'https://www.kaggle.com/datasets/olgagmiufana1/fragrantica-com-fragrance-dataset',
    note: 'A ribbon means two notes appear in the same fragrance, not that perfumers consider them a good pairing. Note lists are as published on Fragrantica, which are community-edited and uneven in coverage.',
  },
};

export default site;
