import { useMemo, useState } from 'react';
import { chord as d3chord, ribbon as d3ribbon } from 'd3-chord';
import { pairMatrix, liftOf } from '../data/perfumeIndex';
import { UNCLASSIFIED } from '../data/noteTaxonomy';

/**
 * One perfume's notes, drawn as a chord diagram with three grouping bands.
 *
 * SVG, not canvas — a deliberate departure from src/viz/chordEngine.js. That
 * engine exists because the accord wheel is 140 arcs and ~10,000 ribbons, far
 * too many DOM nodes. A perfume is at most 24 notes and 276 ribbons, typically
 * nine and 36. At that size SVG costs nothing and buys hit testing, hover
 * states, crisp labels and focusable elements for free.
 *
 * WHAT A RIBBON MEANS. Inside a single perfume every pair of notes co-occurs
 * exactly once, so ribbons are weighted by the whole catalogue instead:
 *
 *   conventional — how many of the 24,050 perfumes pair those two notes. A
 *                  thick even web is a composition built from well-worn moves.
 *   distinctive  — how far that pair beats chance (lift). One bright ribbon in
 *                  a quiet wheel is the unusual thing the perfumer did.
 *
 * THE BANDS, reading outward: the tier the brand declared it in, its family,
 * then the note itself — coarsest group at the centre, finest at the rim, the
 * way a sunburst reads. Only the band you arrange by merges into big clean
 * arcs — the other stays segmented, which is honest about a note having one
 * position and two overlapping memberships.
 */

const SIZE = 620;

/*
 * Three rings: the tier the brand declared it in, its family, then the note.
 *
 * Ordered coarse-to-fine from the centre out. Three tiers merge into three big
 * arcs at the tightest radius where they still label cleanly; the notes sit at
 * the rim, one arc each, next to their own text.
 *
 * A fourth — the note's accord — was built and removed. At 84 accords the ring
 * fragmented into segments too narrow to label on anything but a six-note
 * perfume, and four stacked rings read as one striped smear rather than as a
 * hierarchy. The accord is still on the page where it has room to be legible:
 * in the centre readout when you hover a ribbon, and in the main-accord bars.
 *
 * With one ring gone the whole stack gets thicker and the ribbon disc gets
 * bigger. Retune it here.
 */
const RIBBON_R = 142;
// Listed inner to outer, with a 4px gutter between rings. The outer edge stays
// at 195 so the note labels at LABEL_R do not need moving.
const BANDS = [
  { key: 'tier', inner: 148, width: 15, minLabel: 0.11 },
  { key: 'family', inner: 167, width: 12, minLabel: 0.14 },
];
const NOTE_BAND = { inner: 183, width: 12 };
const LABEL_R = 203;

/**
 * Ribbon weights span three orders of magnitude — 4,222 perfumes pair jasmine
 * with musk, 15 pair white honey with african orange flower. Drawn linearly the
 * rare pair is a sub-pixel sliver and the diagram says nothing. The exponent
 * compresses that range so every real pairing stays visible.
 */
const EXPONENT = 0.45;

/**
 * Lift is a ratio, so thin evidence produces enormous values: a pair seen 15
 * times can score 11x and outshout one seen 485 times at 5.7x. Weight is shrunk
 * toward 1 in proportion to how little support it has. The note wheel uses a
 * hard floor instead; here a floor would delete ribbons from a diagram meant to
 * show the whole bottle, so it damps rather than excludes.
 */
const SHRINK = 60;

const TIER_COLOR = ['#E6B422', '#E0689A', '#8A6A4F'];
const TIER_NAME = ['top', 'heart', 'base'];

export default function PerfumeChord({
  record,
  taxonomy,
  population,
  mode,
  arrange,
  onPick,
  selected,
}) {
  const [hover, setHover] = useState(null);

  const view = useMemo(() => {
    const counts = pairMatrix(record);
    const n = record.notes.length;

    // Arrange by tier (source order, already grouped) or by family, which sorts
    // notes so the family and accord bands merge instead of fragmenting.
    let order = record.notes.map((_, index) => index);
    if (arrange === 'family' && taxonomy) {
      order = order.sort((a, b) => {
        const fa = taxonomy.familyOf(record.notes[a]);
        const fb = taxonomy.familyOf(record.notes[b]);
        const ra = fa ? taxonomy.familyOrder.indexOf(fa) : 99;
        const rb = fb ? taxonomy.familyOrder.indexOf(fb) : 99;
        if (ra !== rb) return ra - rb;
        const aa = taxonomy.accordOf(record.notes[a]) || '';
        const ab = taxonomy.accordOf(record.notes[b]) || '';
        return aa.localeCompare(ab) || record.notes[a].localeCompare(record.notes[b]);
      });
    }

    const weights = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const count = counts[order[i]][order[j]];
        let value = 0;
        if (count > 0) {
          if (mode === 'distinctive') {
            const lift = liftOf(record, counts, order[i], order[j], population);
            const damped = 1 + (lift - 1) * (count / (count + SHRINK));
            value = Math.max(0, damped) ** 1.4;
          } else {
            value = count ** EXPONENT;
          }
        }
        weights[i][j] = value;
        weights[j][i] = value;
      }
    }

    const chords = d3chord()
      .padAngle(0.03)
      .sortSubgroups((a, b) => b - a)(weights);

    // What each band says about the note in slot i, and what colour it takes.
    const noteAt = (slot) => record.notes[order[slot]];
    const keyed = {
      family: (slot) => taxonomy?.familyOf(noteAt(slot)) ?? null,
      tier: (slot) => TIER_NAME[record.tier[order[slot]]],
    };
    const hued = {
      family: (key) => (key && taxonomy ? taxonomy.colorOf(key) : UNCLASSIFIED),
      tier: (key) => TIER_COLOR[TIER_NAME.indexOf(key)],
    };

    const bands = BANDS.map((band) => ({
      ...band,
      runs: runsOf(chords.groups, keyed[band.key]),
      colorOf: hued[band.key],
    }));

    return { chords, ribbon: d3ribbon().radius(RIBBON_R), counts, order, bands, noteAt };
  }, [record, taxonomy, population, mode, arrange]);

  const { chords, ribbon, counts, order, bands, noteAt } = view;
  const active = hover ?? selected;

  /**
   * What the current focus covers, as slot indices. Three things are
   * selectable and they highlight differently: a ribbon lights its two notes, a
   * note arc lights one, and a band arc lights every note in its run.
   */
  const slotLit = (slot) => {
    if (!active) return true;
    if (active.type === 'pair') return active.a === slot || active.b === slot;
    if (active.type === 'note') return active.slot === slot;
    return slot >= active.from && slot <= active.to;
  };
  const runLit = (run) => {
    if (!active) return true;
    for (let slot = run.from; slot <= run.to; slot += 1) if (slotLit(slot)) return true;
    return false;
  };
  const same = (a, b) =>
    a &&
    b &&
    a.type === b.type &&
    a.a === b.a &&
    a.b === b.b &&
    a.slot === b.slot &&
    a.from === b.from;
  const toggle = (next) => onPick(same(selected, next) ? null : next);
  const enter = (next) => (event) => event.pointerType !== 'touch' && setHover(next);

  return (
    <svg
      className="perfumeChord"
      viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`${record.name} by ${record.brand}: ${record.notes.length} notes and the pairings between them.`}
    >
      {/* Clicking away from every ribbon and arc clears the focus — the same
          gesture the wheels use. Sits behind everything and catches whatever
          the marks above do not. */}
      <rect
        className="chordGround"
        x={-SIZE / 2}
        y={-SIZE / 2}
        width={SIZE}
        height={SIZE}
        onClick={() => onPick(null)}
      />

      <g>
        {chords.map((link) => {
          const a = link.source.index;
          const b = link.target.index;
          const lit = active == null || slotLit(a) || slotLit(b);
          return (
            <path
              key={`${a}-${b}`}
              className="perfumeRibbon"
              d={ribbon(link)}
              fill={TIER_COLOR[record.tier[order[a]]]}
              opacity={lit ? 0.55 : 0.06}
              onPointerEnter={enter({ type: 'pair', a, b })}
              onPointerLeave={() => setHover(null)}
              onClick={() => toggle({ type: 'pair', a, b })}
            />
          );
        })}
      </g>

      <g>
        {chords.groups.map((group) => (
          <path
            key={group.index}
            className="chordArc"
            d={arcPath(
              group.startAngle,
              group.endAngle,
              NOTE_BAND.inner,
              NOTE_BAND.inner + NOTE_BAND.width,
            )}
            fill={TIER_COLOR[record.tier[order[group.index]]]}
            opacity={slotLit(group.index) ? 0.95 : 0.25}
            onPointerEnter={enter({ type: 'note', slot: group.index })}
            onPointerLeave={() => setHover(null)}
            onClick={() => toggle({ type: 'note', slot: group.index })}
          />
        ))}
      </g>

      {bands.map((band) => (
        <g key={band.key} className={`chordBand chordBand--${band.key}`}>
          {band.runs.map((run) => {
            const lit = runLit(run);
            const span = run.endAngle - run.startAngle;
            const focus = { type: 'group', band: band.key, ...run };
            return (
              <g key={`${run.key ?? 'none'}-${run.from}`}>
                <path
                  className="chordArc"
                  d={arcPath(run.startAngle, run.endAngle, band.inner, band.inner + band.width)}
                  fill={band.colorOf(run.key)}
                  opacity={lit ? 0.9 : 0.22}
                  onPointerEnter={enter(focus)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => toggle(focus)}
                />
                {run.key && span > band.minLabel && (
                  <BandLabel
                    text={run.key}
                    angle={(run.startAngle + run.endAngle) / 2}
                    radius={band.inner + band.width / 2}
                    lit={lit}
                  />
                )}
              </g>
            );
          })}
        </g>
      ))}

      <g className="perfumeLabels">
        {chords.groups.map((group) => {
          const angle = (group.startAngle + group.endAngle) / 2 - Math.PI / 2;
          const flip = Math.cos(angle) < 0;
          return (
            <text
              key={group.index}
              transform={`rotate(${(angle * 180) / Math.PI}) translate(${LABEL_R},0)${
                flip ? ' rotate(180)' : ''
              }`}
              textAnchor={flip ? 'end' : 'start'}
              dominantBaseline="middle"
              opacity={slotLit(group.index) ? 1 : 0.3}
            >
              {noteAt(group.index)}
            </text>
          );
        })}
      </g>

      {/* The ribbons fill the inner disc, so the readout needs its own ground
          or it reads as noise over noise. */}
      <circle className="chordCentreDisc" r={active ? (active.type === 'pair' ? 76 : 66) : 58} />

      <ChordReadout
        record={record}
        counts={counts}
        order={order}
        population={population}
        active={active}
        mode={mode}
        taxonomy={taxonomy}
      />
    </svg>
  );
}

/** Contiguous runs of one band key across the chord groups → one arc each. */
function runsOf(groups, keyOf) {
  const out = [];
  let i = 0;
  while (i < groups.length) {
    const key = keyOf(i);
    let j = i;
    while (j < groups.length && keyOf(j) === key) j += 1;
    out.push({
      key,
      from: i,
      to: j - 1,
      startAngle: groups[i].startAngle,
      endAngle: groups[j - 1].endAngle,
    });
    i = j;
  }
  return out;
}

/** Text set along a band arc, kept upright on the left-hand side. */
function BandLabel({ text, angle, radius, lit }) {
  const a = angle - Math.PI / 2;
  const flip = Math.cos(a) < 0;
  return (
    <text
      className="chordBandLabel"
      transform={`rotate(${(a * 180) / Math.PI}) translate(${radius},0) rotate(${flip ? 180 : 0})`}
      textAnchor="middle"
      dominantBaseline="central"
      opacity={lit ? 1 : 0.35}
    >
      {text}
    </text>
  );
}

function ChordReadout({ record, counts, order, population, active, mode, taxonomy }) {
  if (!active) {
    return (
      <g className="chordCentre">
        <text y={-8} className="chordCentreLead">
          {record.notes.length} notes
        </text>
        <text y={14} className="chordCentreSub">
          {TIER_NAME.map(
            (name, tier) => `${record.tier.filter((value) => value === tier).length} ${name}`,
          ).join(' · ')}
        </text>
      </g>
    );
  }

  // One note: the three things the rings encode, in ring order.
  if (active.type === 'note') {
    const index = order[active.slot];
    const note = record.notes[index];
    const family = taxonomy?.familyOf(note);
    const accord = taxonomy?.accordOf(note);
    const tier = TIER_NAME[record.tier[index]];
    return (
      <g className="chordCentre">
        <text y={-16} className="chordCentrePair">
          {note}
        </text>
        <text y={8} className="chordCentreSub">
          {[family ?? 'unclassified', `${tier} note`].join(' · ')}
        </text>
        <text y={26} className="chordCentreSub">
          {accord && accord !== family ? `${accord} accord · ` : ''}
          {record.total[index].toLocaleString()} perfumes
        </text>
      </g>
    );
  }

  // A whole ring segment: one family, or one tier.
  if (active.type === 'group') {
    const notes = [];
    for (let slot = active.from; slot <= active.to; slot += 1)
      notes.push(record.notes[order[slot]]);
    return (
      <g className="chordCentre">
        <text y={-16} className="chordCentrePair">
          {active.key ?? 'unclassified'}
        </text>
        <text y={8} className="chordCentreSub">
          {active.band === 'tier' ? 'tier' : 'family'} · {notes.length}{' '}
          {notes.length === 1 ? 'note' : 'notes'}
        </text>
        <text y={26} className="chordCentreSub">
          {notes.slice(0, 3).join(', ')}
          {notes.length > 3 ? `, +${notes.length - 3}` : ''}
        </text>
      </g>
    );
  }

  const i = order[active.a];
  const j = order[active.b];
  const count = counts[i][j];
  const lift = liftOf(record, counts, i, j, population);
  const accords = [taxonomy?.accordOf(record.notes[i]), taxonomy?.accordOf(record.notes[j])];

  return (
    <g className="chordCentre">
      <text y={-30} className="chordCentrePair">
        {record.notes[i]}
      </text>
      <text y={-10} className="chordCentreTimes">
        ×
      </text>
      <text y={10} className="chordCentrePair">
        {record.notes[j]}
      </text>
      {accords[0] && accords[1] && (
        <text y={34} className="chordCentreSub">
          {accords[0]} · {accords[1]}
        </text>
      )}
      <text y={accords[0] && accords[1] ? 52 : 38} className="chordCentreSub">
        {mode === 'distinctive'
          ? `${lift.toFixed(1)}× chance · ${count.toLocaleString()} perfumes`
          : `${count.toLocaleString()} perfumes · ${lift.toFixed(1)}× chance`}
      </text>
    </g>
  );
}

/** Annular sector, drawn without pulling in d3-shape for one path. */
function arcPath(start, end, inner, outer) {
  const a0 = start - Math.PI / 2;
  const a1 = end - Math.PI / 2;
  const large = end - start > Math.PI ? 1 : 0;
  const p = (radius, angle) => `${radius * Math.cos(angle)} ${radius * Math.sin(angle)}`;
  return [
    `M ${p(outer, a0)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${p(outer, a1)}`,
    `L ${p(inner, a1)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${p(inner, a0)}`,
    'Z',
  ].join(' ');
}

export { TIER_COLOR, TIER_NAME };
