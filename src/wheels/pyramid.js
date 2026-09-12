/**
 * The Pyramid Wheels — one wheel per pyramid layer, and the only wheel with
 * TWO arc bands: main accord (inner) nested inside family (outer). Both are
 * independently hoverable and clickable, which is the drill-down: isolate a
 * family, then isolate one accord inside it.
 *
 * `repad` is what makes the two rings legible — without it the accord runs
 * butt against each other and the nesting disappears.
 */
const INK = '#EFE7DA';

const pyramid = {
  slug: 'pyramid',
  title: ['The Pyramid ', 'Wheels', ''],
  lede: 'A separate wheel for each layer of the pyramid — the top notes that open, the heart that emerges, the base that lingers. Three rings: ribbons join notes that share fragrances, the middle band groups them by Fragrantica main accord, and the outer band groups accords into twelve families.',
  footer:
    'Built from the Fragrantica dataset (~24,000 fragrances). A note sits under the main accord it is most distinctively associated with, and accords are grouped into twelve families. Sibling of the single Accord Wheel.',

  size: 800,
  inner: 250,
  padAngle: 0.0012,
  labelSize: 12,
  labelRadius: 326,
  ink: INK,

  alpha: {
    focused: 0.66,
    base: (v) => 0.13 + 0.5 * Math.min(1, v / 600),
  },

  repad: { innerGap: 0.012, outerGap: 0.05 },

  bands: [
    {
      key: 'accord',
      keyOf: 'accordOf',
      familyOf: 'familyOfAccord',
      radius: 258,
      width: 16,
      hitTo: 285,
      inset: 0.004,
      alpha: (a, s) => {
        const aa = s.sticky.accord || s.hovered.accord;
        const af = s.sticky.family || s.hovered.family;
        if (aa) return a.key === aa ? 0.95 : 0.14;
        if (af) return a.family === af ? 0.75 : 0.16;
        return 0.6;
      },
    },
    {
      key: 'family',
      keyOf: 'familyOf',
      radius: 292,
      width: 16,
      hitTo: 342,
      labels: true,
      alpha: (a, s) => {
        const af = s.sticky.family || s.hovered.family;
        return af ? (a.key === af ? 1 : 0.18) : 0.9;
      },
    },
  ],

  controls: [
    { type: 'toggle', id: 'tier', label: 'Pyramid layer' },
    {
      type: 'slider',
      id: 'minShared',
      label: 'Minimum shared fragrances',
      min: 5,
      max: 300,
      step: 5,
      value: 40,
    },
    {
      type: 'legend',
      id: 'family',
      label: 'Families & accords',
      hint: '— click a family to isolate',
      nested: true,
    },
  ],

  defaults: { tier: 'Top', minShared: 40 },

  options() {
    return {
      tier: [
        { value: 'Top', label: 'Top', note: 'the opening' },
        { value: 'Middle', label: 'Heart', note: 'the middle' },
        { value: 'Base', label: 'Base', note: 'the dry-down' },
      ],
    };
  },

  /** Families present in this tier, each listing the accords nested under it. */
  legend(data, view) {
    const t = data.tiers[view.tier];
    return data.familyOrder
      .map((f) => {
        const notes = t.names.filter((n) => t.noteFamily[n] === f);
        if (!notes.length) return null;
        const accords = data.accordOrder.filter(
          (a) => data.accordFamily[a] === f && t.names.some((n) => t.noteAccord[n] === a),
        );
        return { key: f, label: f, color: data.colors[f], count: notes.length, sub: accords };
      })
      .filter(Boolean);
  },

  resolve(view) {
    const { data, tier } = view;
    const t = data.tiers[tier];
    return {
      names: t.names,
      matrix: t.matrix,
      colorOf: (n) => data.colors[t.noteFamily[n]] || '#888',
      colorOfKey: (f) => data.colors[f] || '#888',
      familyOf: (n) => t.noteFamily[n],
      accordOf: (n) => t.noteAccord[n],
      familyOfAccord: (a) => data.accordFamily[a],
      innerKey: (n) => t.noteAccord[n],
      outerKey: (n) => t.noteFamily[n],
    };
  },

  readout({ data, tier, engine, hoveredChord, activeBand }) {
    const t = data.tiers[tier];
    if (hoveredChord != null) {
      const p = engine.pairOf(hoveredChord);
      return {
        pair: [p.source, p.target],
        sub: `together in ${p.value.toLocaleString()} fragrances`,
      };
    }
    if (activeBand.accord) {
      const count = t.names.filter((n) => t.noteAccord[n] === activeBand.accord).length;
      return {
        pair: [activeBand.accord],
        sub: `main accord · ${data.accordFamily[activeBand.accord]} · ${count} notes`,
      };
    }
    if (activeBand.family) {
      const count = t.names.filter((n) => t.noteFamily[n] === activeBand.family).length;
      return { pair: [activeBand.family], sub: `${count} notes` };
    }
    return null;
  },
};

export default pyramid;
