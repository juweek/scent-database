/**
 * The Accords Wheel — Fragrantica's own 84-word accord vocabulary.
 *
 * NAMING, because two files here are one letter apart: `accord.js` is the
 * NOTE wheel (140 notes, labelled "Notes" in the tabs). This is `accords.js`,
 * the accord wheel, labelled "Accords". They sit at different grains — note,
 * accord, family — and only this one uses the source's own taxonomy rather
 * than ours.
 *
 * Two matrices, in the same unit so the threshold slider stays meaningful:
 *   together      how many perfumes carry both accords
 *   beyondChance  how many MORE than independence predicts
 *
 * See scripts/pipeline/accord_wheel.py for why rank weights the ARC and not
 * the ribbon.
 */
const INK = '#EFE7DA';

const accords = {
  slug: 'accords',
  eyebrow: 'Fragrantica · main accords',
  title: ['The ', 'Accords', ' Wheel'],
  lede: 'The vocabulary Fragrantica itself uses — aquatic, mossy, animalic, gourmand — and which of them get bottled together. Switch to "beyond chance" to strip out the pairings that are common only because both halves are common.',
  footer:
    "Built from mainaccord1–5 across 24,050 perfumes. Accords and their ranking are Fragrantica's, voted by its community; the grouping of accords into ten families is ours. Ribbon width is perfumes, not intensity — the dataset carries no strengths.",

  size: 760,
  inner: 250,
  padAngle: 0.006,
  labelSize: 11,
  labelRadius: 292,
  ink: INK,

  alpha: {
    focused: 0.7,
    base: (v) => 0.16 + 0.5 * Math.min(1, v / 1200),
  },

  bands: [
    {
      key: 'family',
      keyOf: 'familyOf',
      radius: 259,
      width: 15,
      hitTo: 274,
      labels: true,
      alpha: (a, s) => {
        const active = s.sticky.family || s.hovered.family;
        return active ? (a.key === active ? 1 : 0.16) : 0.85;
      },
    },
  ],

  controls: [
    { type: 'toggle', id: 'set', label: 'Ribbon weight' },
    {
      type: 'search',
      id: 'note',
      label: 'Focus an accord',
      placeholder: 'e.g. aquatic, leather, gourmand…',
    },
    { type: 'slider', id: 'minShared', label: 'Minimum perfumes', min: 0, max: 100, step: 1 },
    { type: 'legend', id: 'family', label: 'Scent families', hint: '— click to isolate' },
  ],

  defaults: { set: 'together', minShared: 600 },

  /**
   * The two matrices live on different scales — co-occurrence peaks at 5,034,
   * excess at 2,182 — so the threshold has to move with the view or one mode
   * opens filtered down to nothing. WheelPage clamps the current value into
   * whatever range this returns.
   */
  slider(view) {
    return view.set === 'beyondChance'
      ? { min: 0, max: 1200, step: 25, value: 250 }
      : { min: 0, max: 3000, step: 50, value: 600 };
  },

  options(data) {
    return {
      set: [
        { value: 'together', label: 'Together', note: 'co-occurrence' },
        { value: 'beyondChance', label: 'Beyond chance', note: 'minus expected' },
      ],
    };
  },

  legend(data) {
    const counts = {};
    data.familyOrder.forEach((family) => (counts[family] = 0));
    data.names.forEach((name) => {
      const family = data.groups[name];
      if (family) counts[family] = (counts[family] || 0) + 1;
    });
    return data.familyOrder.map((family) => ({
      key: family,
      label: family,
      color: data.colors[family],
      count: counts[family],
    }));
  },

  resolve(view) {
    const { data, set } = view;
    return {
      names: data.names,
      matrix: data.matrices[set],
      colorOf: (accord) => data.colors[data.groups[accord]] || '#888',
      colorOfKey: (family) => data.colors[family] || '#888',
      familyOf: (accord) => data.groups[accord],
    };
  },

  searchable: (data) => data.names.map((n) => ({ value: n, meta: data.groups[n] })),

  /**
   * Centre readout. A pinned accord reports where it usually sits in a
   * perfume's own ranking — the one thing rank is genuinely good for.
   */
  readout({ data, set, engine, hoveredChord, note, activeBand }) {
    if (hoveredChord != null) {
      const pair = engine.pairOf(hoveredChord);
      const together =
        data.matrices.together[data.names.indexOf(pair.source)][data.names.indexOf(pair.target)];
      const expected = (data.totals[pair.source] * data.totals[pair.target]) / data.counts.together;
      return {
        pair: [pair.source, pair.target],
        lead:
          set === 'beyondChance'
            ? `${pair.value.toLocaleString()} more than chance predicts`
            : `together in ${together.toLocaleString()} perfumes`,
        sub: `${together.toLocaleString()} perfumes · ${(together / expected).toFixed(1)}× chance`,
      };
    }
    if (note) {
      const lead = Math.round((data.leadShare[note] ?? 0) * 100);
      return {
        pair: [note],
        lead: `${data.totals[note].toLocaleString()} perfumes · ${data.groups[note]}`,
        sub: `average position ${data.meanRank[note]} of 5 · leads ${lead}% of perfumes`,
      };
    }
    if (activeBand.family) {
      const count = data.names.filter((n) => data.groups[n] === activeBand.family).length;
      return { pair: [activeBand.family], sub: `${count} accords` };
    }
    return null;
  },
};

export default accords;
