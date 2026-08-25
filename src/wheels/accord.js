/**
 * The Accord Wheel — note-level pairings, one family band.
 * Constants are the prototype's (SIZE 760, INNER 250, ARC_IN 259, ARC_W 15).
 */
const INK = '#EFE7DA';

const accord = {
  slug: 'accord',
  eyebrow: 'Fragrantica · co-occurrence',
  title: ['The ', 'Accord', ' Wheel'],
  lede: 'Every ribbon links two scent notes that appear together in the same fragrance. Thicker, brighter ribbons are pairings perfumers reach for again and again. Search a note, hover a family, or follow a ribbon to read the accord.',
  footer:
    'Built from the Fragrantica fragrance dataset (24,059 perfumes). Co-occurrence counts pairings of top, heart, and base notes; node colour marks the dominant scent family. Data via Kaggle (olgagmiufana1) — for exploration, not a perfumery reference.',

  size: 760,
  inner: 250,
  padAngle: 0.004,
  labelSize: 11,
  labelRadius: 292,
  ink: INK,

  // Ribbon opacity. Unfocused, weight drives it; focused, it's flat.
  alpha: {
    focused: 0.66,
    base: (v) => 0.14 + 0.5 * Math.min(1, v / 1500),
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

  // Sidebar controls, rendered in this order.
  controls: [
    { type: 'toggle', id: 'set', label: 'Fragrance set' },
    {
      type: 'search',
      id: 'note',
      label: 'Focus a note',
      placeholder: 'e.g. bergamot, oud, vanilla…',
    },
    {
      type: 'slider',
      id: 'minShared',
      label: 'Minimum shared fragrances',
      min: 10,
      max: 600,
      step: 10,
      value: 150,
    },
    { type: 'legend', id: 'family', label: 'Scent families', hint: '— click to isolate' },
  ],

  defaults: { set: 'all', minShared: 150 },

  options(data) {
    return {
      set: [
        { value: 'all', label: 'All fragrances', note: data.counts.all.toLocaleString() },
        { value: 'best', label: 'Best-rated ≥ 4.0', note: data.counts.best.toLocaleString() },
      ],
    };
  },

  /** Family list for the legend: swatch, name, note count. */
  legend(data) {
    const counts = {};
    data.familyOrder.forEach((f) => (counts[f] = 0));
    data.names.forEach((n) => (counts[data.groups[n]] = (counts[data.groups[n]] || 0) + 1));
    return data.familyOrder.map((f) => ({
      key: f,
      label: f,
      color: data.colors[f],
      count: counts[f],
    }));
  },

  /** The view the engine draws: names, matrix, and the lookups it needs. */
  resolve(view) {
    const { data, set } = view;
    return {
      names: data.names,
      matrix: data.matrices[set],
      colorOf: (note) => data.colors[data.groups[note]] || '#888',
      colorOfKey: (family) => data.colors[family] || '#888',
      familyOf: (note) => data.groups[note],
    };
  },

  searchable: (data) => data.names.map((n) => ({ value: n, meta: data.groups[n] })),

  /** Centre readout, in priority order: ribbon → focused note → family → idle. */
  readout({ data, set, engine, hoveredChord, note, activeBand }) {
    if (hoveredChord != null) {
      const p = engine.pairOf(hoveredChord);
      return {
        pair: [p.source, p.target],
        sub: `paired in ${p.value.toLocaleString()} fragrances`,
      };
    }
    if (note) {
      const partner = engine.strongestPartner(note);
      return {
        pair: [note],
        sub: `${data.groups[note]} · ${partner ? `loves ${partner}` : 'no strong pairing'}`,
      };
    }
    if (activeBand.family) {
      const count = data.names.filter((n) => data.groups[n] === activeBand.family).length;
      return { pair: [activeBand.family], sub: `${count} notes` };
    }
    void set;
    return null;
  },
};

export default accord;
