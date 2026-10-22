import { useEffect, useMemo, useState } from 'react';
import ChordWheel from '../viz/ChordWheel';
import archive from '../data/coffee.json';
import { coffeeModel } from '../data/coffeeModel';
import './coffee.css';

const vocabulary = archive.vocabulary;
const color = Object.fromEntries(vocabulary.map((n) => [n.name, n.color]));
const EMPTY = {};
const families = [...new Set(vocabulary.map((n) => n.family))];
const spec = {
  size: 760,
  inner: 244,
  padAngle: 0.015,
  labelSize: 10,
  labelRadius: 291,
  ink: '#eee3d3',
  alpha: { focused: 0.8, base: () => 0.35 },
  bands: [
    {
      key: 'note',
      keyOf: 'noteOf',
      radius: 251,
      width: 9,
      hitTo: 275,
      labels: true,
      alpha: (a, s) => (!s.sticky.note || a.key === s.sticky.note ? 1 : 0.25),
    },
  ],
  resolve: ({ model, matrix }) => ({
    names: model.names,
    matrix,
    colorOf: (n) => color[n],
    colorOfKey: (n) => color[n],
    noteOf: (n) => n,
  }),
  readout: ({ engine, hoveredChord }) =>
    hoveredChord == null ? null : engine.pairOf(hoveredChord),
};

export default function CoffeePage() {
  const [roast, setRoast] = useState('All roasts');
  const [mode, setMode] = useState('common');
  const [note, setNote] = useState('');
  const [pair, setPair] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [minimum, setMinimum] = useState(10);
  useEffect(() => {
    const previous = document.title;
    document.title = 'Coffee chords — Gourmet Data';
    return () => {
      document.title = previous;
    };
  }, []);
  const records = useMemo(
    () => archive.records.filter((r) => roast === 'All roasts' || r.roast === roast),
    [roast],
  );
  const model = useMemo(() => coffeeModel(records, vocabulary, minimum), [records, minimum]);
  const pairs = useMemo(
    () =>
      model.pairs
        .filter(
          (p) =>
            (!note || p.source === note || p.target === note) && (mode === 'common' || p.lift > 1),
        )
        .sort((a, b) =>
          mode === 'common' ? b.count - a.count : b.lift - a.lift || b.count - a.count,
        ),
    [model, note, mode],
  );
  const view = useMemo(() => {
    const matrix = model.names.map(() => model.names.map(() => 0));
    model.pairs
      .filter((p) => mode === 'common' || p.lift > 1)
      .forEach((p) => {
        const i = model.names.indexOf(p.source),
          j = model.names.indexOf(p.target);
        matrix[i][j] = matrix[j][i] = mode === 'common' ? p.count : p.lift;
      });
    return { model, matrix };
  }, [model, mode]);
  const sticky = useMemo(() => ({ note: note || null }), [note]);
  const active = pair || pairs[0];
  const examples = active
    ? records.filter((r) => r.notes.includes(active.source) && r.notes.includes(active.target))
    : [];
  const hoverPair =
    hovered &&
    model.pairs.find(
      (p) =>
        (p.source === hovered.source && p.target === hovered.target) ||
        (p.source === hovered.target && p.target === hovered.source),
    );
  function resetSelection() {
    setPair(null);
    setHovered(null);
  }
  function selectNote(value) {
    setNote(value);
    resetSelection();
  }
  return (
    <main className="coffeePage">
      <header className="coffeeIntro">
        <h1>
          Coffee <em>chords.</em>
        </h1>
        <p>
          What goes with what in coffee. Explore the tasting notes that appear together, from
          familiar combinations to distinctive connections.
        </p>
        <div className="coffeeStats">
          <span>
            <strong>{records.length.toLocaleString()}</strong> review records
          </span>
          <span>
            <strong>{vocabulary.length}</strong> tasting notes
          </span>
          <span>One connection at a time</span>
        </div>
      </header>
      <section className="coffeeToolbar" aria-label="Explore coffee connections">
        <div>
          <span className="coffeeLabel">Explore connections</span>
          <div className="coffeeModes">
            {[
              ['common', 'Most common'],
              ['distinctive', 'Most distinctive'],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={mode === key}
                onClick={() => {
                  setMode(key);
                  resetSelection();
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className="coffeeLabel">Roast level</span>
          <select
            value={roast}
            onChange={(e) => {
              setRoast(e.target.value);
              resetSelection();
            }}
          >
            {['All roasts', 'Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark', 'NA'].map(
              (r) => (
                <option key={r} value={r}>
                  {r === 'NA' ? 'Unspecified' : r}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          <span className="coffeeLabel">Focus a note</span>
          <select value={note} onChange={(e) => selectNote(e.target.value)}>
            <option value="">All notes</option>
            {vocabulary.map((n) => (
              <option key={n.name} value={n.name}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="coffeeLabel">Minimum reviews · {minimum}</span>
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={minimum}
            onChange={(e) => {
              setMinimum(Number(e.target.value));
              resetSelection();
            }}
          />
        </label>
      </section>
      <div className="coffeeExplore">
        <section className="coffeeVisual" aria-label="Tasting note wheel">
          <div className="coffeeWheel">
            <ChordWheel
              spec={spec}
              view={view}
              sticky={sticky}
              hovered={EMPTY}
              minShared={0}
              note={note || null}
              onReadout={setHovered}
              onPick={(hit) => {
                if (hit.pair)
                  setPair(
                    model.pairs.find(
                      (p) =>
                        (p.source === hit.pair.source && p.target === hit.pair.target) ||
                        (p.source === hit.pair.target && p.target === hit.pair.source),
                    ),
                  );
                else selectNote(hit.note === note ? '' : hit.note || '');
              }}
              ariaLabel="Coffee tasting note connections. Use the note selector and connection list for keyboard access."
            />
            {!pairs.length && (
              <div className="coffeeEmpty">
                No connections at this threshold.
                <br />
                Lower the minimum or choose another roast.
              </div>
            )}
          </div>
          <div className="coffeeHover">
            {hoverPair ? (
              <>
                <strong>
                  {hoverPair.source} + {hoverPair.target}
                </strong>
                <span>
                  {hoverPair.count} reviews · {hoverPair.lift.toFixed(1)}× expected
                </span>
              </>
            ) : (
              <>
                <strong>{note || 'Follow a connection'}</strong>
                <span>Tap a ribbon or choose a pair from the list.</span>
              </>
            )}
          </div>
          <div className="coffeeLegend">
            {families.map((f) => (
              <span key={f}>
                <i style={{ background: vocabulary.find((n) => n.family === f).color }} />
                {f}
              </span>
            ))}
          </div>
          <p className="coffeeCaption">
            {mode === 'common'
              ? 'Wider ribbons mean more reviews mention both notes.'
              : 'Wider ribbons mean a pair occurs more often than expected from each note’s frequency.'}{' '}
            Notes describe perceived flavors, not added ingredients.
          </p>
        </section>
        <aside className="coffeeConnections">
          <h2>{mode === 'common' ? 'Often together.' : 'Beyond the usual.'}</h2>
          <p>
            {mode === 'common'
              ? 'The pairs mentioned together most often in this selection.'
              : `Pairs ranked by lift, supported by at least ${minimum} reviews. 2× means twice as frequent as independence predicts.`}
          </p>
          <div className="coffeePairList">
            {pairs.slice(0, 12).map((p) => (
              <button
                key={`${p.source}-${p.target}`}
                aria-pressed={active === p}
                onClick={() => setPair(p)}
              >
                <span>
                  <i style={{ background: color[p.source] }} />
                  {p.source} <b>+</b> {p.target}
                </span>
                <strong>
                  {mode === 'common' ? p.count.toLocaleString() : `${p.lift.toFixed(1)}×`}
                </strong>
              </button>
            ))}
          </div>
          {!pairs.length && <p>No matching pairs. Try another note or a lower minimum.</p>}
          {note && (
            <button className="coffeeClear" onClick={() => selectNote('')}>
              Clear note focus ↗
            </button>
          )}
        </aside>
      </div>
      <section className="coffeeExamples" aria-live="polite">
        <div className="coffeeSectionHeading">
          <div>
            <h2>{active ? `${active.source} + ${active.target}` : 'Choose a connection'}</h2>
          </div>
          <p>{active && `${examples.length} reviews · ${active.lift.toFixed(1)}× expected`}</p>
        </div>
        <div className="coffeeCards">
          {examples.slice(0, 6).map((r) => (
            <article key={r.id}>
              <span className="coffeeLabel">{r.roaster}</span>
              <h3>{r.name}</h3>
              <p>{r.origin}</p>
              <span className="coffeeRoast">
                {r.roast === 'NA' ? 'Roast unspecified' : `${r.roast} roast`}
              </span>
              <div className="coffeeTags">
                {r.notes.map((n) => (
                  <button
                    key={n}
                    onClick={() => selectNote(n)}
                    style={{
                      color: color[n],
                      borderColor:
                        active && [active.source, active.target].includes(n) ? color[n] : undefined,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
        {examples.length > 6 && (
          <p className="coffeeCaption">
            Showing 6 of {examples.length} matching historical reviews, in source order.
            Availability today is unknown.
          </p>
        )}
      </section>
      <footer className="coffeeMethod">
        <h2>How to read this draft</h2>
        <p>
          Each ribbon connects two terms mentioned in the same review. We removed{' '}
          {archive.duplicatesRemoved} exact duplicate rows from{' '}
          {archive.sourceRows.toLocaleString()} source rows. Counts use all{' '}
          {records.length.toLocaleString()} records in the selected roast, including those with no
          recognized notes.
        </p>
        <p>
          A fixed vocabulary identifies {vocabulary.length} notes in review descriptions, including
          finish and milk assessments. A term counts once per review. Cocoa and cacao are merged;
          chocolate stays separate. Extraction can miss synonyms or count negated mentions, and
          repeated products may have separate reviews. These are patterns in review language, not
          measurements of flavor intensity or quality.
        </p>
        <p>
          Source: <a href={archive.source}>Datascope’s coffee review archive</a>, containing Coffee
          Review descriptions. This is a historical prototype; commercial reuse permissions have not
          been established.
        </p>
      </footer>
    </main>
  );
}
