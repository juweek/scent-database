import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAsync } from '../lib/useAsync';
import { getSharedFragrances } from '../data/fragranceMatches';
import { getWheel, WHEELS, WHEEL_LIST } from '../data/wheels';
import { Loading, ErrorState } from '../components/Status';
import { Toggle, Slider, Search, FamilyBars } from '../components/Controls';
import ChordWheel from '../viz/ChordWheel';

export default function WheelPage() {
  const { slug } = useParams();
  const state = useAsync(getWheel, slug);

  if (slug && !WHEELS[slug]) return <Navigate to="/wheel/accord" replace />;

  return (
    <>
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorState message={state.error} />}
      {state.status === 'done' && (
        <Wheel key={state.data.spec.slug} spec={state.data.spec} data={state.data.data} />
      )}
    </>
  );
}

function Wheel({ spec, data }) {
  const [settings, setSettings] = useState(spec.defaults);
  const [minShared, setMinShared] = useState(spec.defaults.minShared ?? 0);
  const [note, setNote] = useState(null);
  const [sticky, setSticky] = useState({});
  const [hovered, setHovered] = useState({});
  const [readout, setReadout] = useState(null);
  const [selectedPair, setSelectedPair] = useState(null);

  useEffect(() => {
    setSticky({});
    setHovered({});
    setNote(null);
    setSelectedPair(null);
  }, [settings]);

  const view = useMemo(() => ({ data, ...settings }), [data, settings]);
  const options = useMemo(() => spec.options(data), [spec, data]);
  const legendItems = useMemo(() => spec.legend(data, view), [spec, data, view]);
  const searchItems = useMemo(() => (spec.searchable ? spec.searchable(data) : []), [spec, data]);
  const toggleControls = spec.controls.filter((control) => control.type === 'toggle');
  const searchControl = spec.controls.find((control) => control.type === 'search');
  const sliderControl = spec.controls.find((control) => control.type === 'slider');
  const legendControl = spec.controls.find((control) => control.type === 'legend');
  const matches = useSharedFragrances(spec.slug, selectedPair);

  const onHover = useCallback((band, value) => {
    setHovered((current) =>
      (current[band] ?? null) === value ? current : { ...current, [band]: value },
    );
  }, []);

  const onPick = useCallback(
    (hit) => {
      if (hit.chord != null && hit.pair) {
        setSelectedPair(hit.pair);
        pulseHaptic();
        return;
      }

      const clicked = spec.bands.map((band) => band.key).find((key) => hit[key]);
      if (clicked) {
        setSticky((current) => {
          const next = {};
          if (current[clicked] !== hit[clicked]) next[clicked] = hit[clicked];
          return next;
        });
        setNote(null);
        setSelectedPair(null);
        pulseHaptic();
      } else if (hit.chord == null) {
        setSticky({});
        setSelectedPair(null);
      }
    },
    [spec],
  );

  const set = (id, value) => setSettings((current) => ({ ...current, [id]: value }));

  return (
    <main className="explorerPage">
      <header className="explorerHeader">
        <div>
          <p className="eyebrow">{spec.eyebrow}</p>
          <h1>{WHEELS[spec.slug].title}</h1>
          <p className="lede">{spec.lede}</p>
        </div>
        {toggleControls.length > 0 && (
          <div className="viewControls">
            {toggleControls.map((control) => (
              <Toggle
                key={control.id}
                label={control.label}
                options={options[control.id]}
                value={settings[control.id]}
                onChange={(value) => set(control.id, value)}
              />
            ))}
          </div>
        )}
      </header>

      <div className="explorerGrid">
        <section className="wheelWorkspace" aria-label={`${WHEELS[spec.slug].title} explorer`}>
          {searchControl && (
            <div className="stageSearch">
              <Search
                label={searchControl.label}
                placeholder={searchControl.placeholder}
                items={searchItems}
                value={note}
                onChange={(value) => {
                  setNote(value);
                  setSticky({});
                  setSelectedPair(null);
                }}
              />
            </div>
          )}

          <div className="stage">
            <ChordWheel
              spec={spec}
              view={view}
              sticky={sticky}
              hovered={hovered}
              minShared={minShared}
              note={note}
              onHover={onHover}
              onPick={onPick}
              onReadout={setReadout}
              ambientPulse
              ariaLabel={`${WHEELS[spec.slug].title}. Tap a ribbon to inspect the pairing, or use the controls below.`}
            />
            <Readout readout={readout} />
            <p className="stageHint">Tap a ribbon · tap again to clear</p>
          </div>

          <nav className="wheelTabs" aria-label="Fragrance views">
            {WHEEL_LIST.map((wheel) => (
              <Link
                key={wheel.slug}
                to={`/wheel/${wheel.slug}`}
                aria-current={wheel.slug === spec.slug ? 'page' : undefined}
              >
                {wheel.label}
              </Link>
            ))}
          </nav>
        </section>

        <aside className="insightPanel" aria-label="Wheel controls and pairing details">
          {sliderControl && (
            <Slider
              label={sliderControl.label}
              min={sliderControl.min}
              max={sliderControl.max}
              step={sliderControl.step}
              value={minShared}
              onChange={(value) => {
                setMinShared(value);
                if (selectedPair && selectedPair.value < value) setSelectedPair(null);
              }}
            />
          )}

          {legendControl && (
            <FamilyBars
              label={legendControl.label}
              items={legendItems}
              sticky={sticky[legendControl.id]}
              onHover={(value) => !sticky[legendControl.id] && onHover(legendControl.id, value)}
              onToggle={(value) => {
                setSticky((current) =>
                  current[legendControl.id] === value ? {} : { [legendControl.id]: value },
                );
                setNote(null);
                setSelectedPair(null);
              }}
            />
          )}

          <PairMatches pair={selectedPair} matches={matches} isFamily={spec.slug === 'family'} />
        </aside>
      </div>

      <footer className="wheelFooter">{spec.footer}</footer>
    </main>
  );
}

function useSharedFragrances(slug, pair) {
  const [state, setState] = useState({ status: 'idle', items: [] });

  useEffect(() => {
    if (!pair || slug === 'family') {
      setState({ status: 'idle', items: [] });
      return undefined;
    }

    const controller = new AbortController();
    setState({ status: 'loading', items: [] });
    getSharedFragrances(pair.source, pair.target, controller.signal)
      .then((items) => setState({ status: 'done', items }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', items: [] });
      });
    return () => controller.abort();
  }, [slug, pair]);

  return state;
}

function PairMatches({ pair, matches, isFamily }) {
  return (
    <section className="pairMatches" aria-live="polite">
      <div className="pairMatchesHeader">
        <p className="fieldLabel">{isFamily ? 'Bridge detail' : 'Shared fragrances'}</p>
        {pair && <span>{pair.value.toLocaleString()}</span>}
      </div>

      {!pair && (
        <p className="emptyPrompt">
          Tap a ribbon to pin a pairing and reveal the fragrances behind it.
        </p>
      )}

      {pair && (
        <>
          <h2>
            {pair.source} <span>×</span> {pair.target}
          </h2>
          {isFamily ? (
            <p className="emptyPrompt">
              This bridge aggregates {pair.value.toLocaleString()} note-level co-occurrences.
            </p>
          ) : matches.status === 'loading' ? (
            <p className="emptyPrompt">Finding the strongest examples…</p>
          ) : matches.status === 'error' ? (
            <p className="emptyPrompt">The fragrance index could not be loaded.</p>
          ) : matches.items.length > 0 ? (
            <ol className="matchList">
              {matches.items.map((item) => (
                <li key={item.url}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.brand}</small>
                    </span>
                    <span className="rating">{item.rating ? item.rating.toFixed(1) : '—'}</span>
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className="emptyPrompt">No record-level examples are indexed for this pair yet.</p>
          )}
        </>
      )}
    </section>
  );
}

function Readout({ readout }) {
  if (!readout) {
    return (
      <div className="readout idle">
        <div className="pair">Explore a ribbon</div>
      </div>
    );
  }
  return (
    <div className="readout">
      <div className="pair">
        {readout.pair.map((part, index) => (
          <span key={part}>
            {index > 0 && <i className="times"> × </i>}
            <span className="hl">{part}</span>
          </span>
        ))}
      </div>
      <div className="sub">
        {readout.lead && (
          <>
            {readout.lead}
            <br />
          </>
        )}
        {readout.sub}
      </div>
    </div>
  );
}

function pulseHaptic() {
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  navigator.vibrate?.(8);
}
