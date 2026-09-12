/**
 * The Family Wheel — the same data lifted to the ten families.
 * Two independent toggles: which fragrance set, and how ribbons are weighted.
 * No threshold slider and no search: ten groups need neither.
 */
const INK = '#EFE7DA';

const family = {
  slug: 'family',
  title: ['The ', 'Family', ' Wheel'],
  lede: 'The same pairings, lifted one level up: the ten scent families, and how much each one bridges to the others. Hover a ribbon for the bridge, or isolate a family to see only what it touches.',
  footer:
    'Aggregated from the Fragrantica fragrance dataset (24,059 perfumes). Amount sums, over every note pair that bridges two families, the number of fragrances containing both notes. Presence counts how many distinct note pairs bridge the families at all. A sibling of the note-level Accord Wheel.',

  size: 760,
  inner: 250,
  padAngle: 0.035,
  labelSize: 12,
  labelRadius: 294,
  ink: INK,

  alpha: { focused: 0.82, base: () => 0.72 },

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
        return active ? (a.key === active ? 1 : 0.18) : 0.9;
      },
    },
  ],

  controls: [
    { type: 'toggle', id: 'set', label: 'Fragrance set' },
    { type: 'toggle', id: 'size', label: 'Ribbon weight' },
    { type: 'legend', id: 'family', label: 'Scent families', hint: '— click to isolate' },
  ],

  defaults: { set: 'all', size: 'amount', minShared: 0 },

  options(data) {
    return {
      set: [
        { value: 'all', label: 'All fragrances', note: data.counts.all.toLocaleString() },
        { value: 'best', label: 'Best-rated ≥ 4.0', note: data.counts.best.toLocaleString() },
      ],
      size: [
        { value: 'amount', label: 'Co-occurrence', note: 'shared fragrances' },
        { value: 'presence', label: 'Distinct pairs', note: 'note pairs' },
      ],
    };
  },

  legend(data) {
    return data.familyOrder.map((f) => ({
      key: f,
      label: f,
      color: data.colors[f],
      count: data.famNoteCount[f],
    }));
  },

  resolve(view) {
    const { data, set, size } = view;
    return {
      names: data.familyOrder,
      matrix: data.matrices[size][set],
      colorOf: (f) => data.colors[f] || '#888',
      colorOfKey: (f) => data.colors[f] || '#888',
      familyOf: (f) => f,
    };
  },

  readout({ data, set, engine, hoveredChord, activeBand }) {
    if (hoveredChord != null) {
      const d = engine.pairOf(hoveredChord);
      const i = data.familyOrder.indexOf(d.source);
      const j = data.familyOrder.indexOf(d.target);
      const amount = data.matrices.amount[set][i][j];
      const presence = data.matrices.presence[set][i][j];
      return {
        pair: d.source === d.target ? [d.source] : [d.source, d.target],
        lead: d.source === d.target ? 'within-family pairings' : null,
        sub: `${amount.toLocaleString()} co-occurrences · ${presence.toLocaleString()} note pairs`,
      };
    }
    if (activeBand.family) {
      return { pair: [activeBand.family], sub: `${data.famNoteCount[activeBand.family]} notes` };
    }
    return null;
  },
};

export default family;
