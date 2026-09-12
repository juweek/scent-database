import { useState, useMemo, useCallback, useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAsync } from '../lib/useAsync';
import { useNarrow } from '../lib/useNarrow';
import { getSharedFragrances } from '../data/fragranceMatches';
import { getNotePerfumes, getNotePerfumesRest } from '../data/noteMatches';
import { getWheel, WHEELS } from '../data/wheels';
import {
  rankPairings,
  aliasesOf,
  describeLift,
  RANKINGS,
  supportsRating,
  MIN_SUPPORT,
  TOP_N,
} from '../data/notePairings';
import { Loading, ErrorState } from '../components/Status';
import SubscribeGate from '../components/SubscribeGate';
import { builderUnlocked } from '../lib/engagement';
import { Toggle, Slider, Search, FamilyBars } from '../components/Controls';
import ChordWheel from '../viz/ChordWheel';
import WheelTabs from '../components/WheelTabs';

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
  // On a phone the tabs take the header slot and the toggles drop to the
  // wheel — navigation at the top, controls beside the thing they control.
  const narrow = useNarrow();
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
  // A spec may size its threshold from the current view: the accords wheel's
  // two matrices peak at 5,034 and 2,182, so a fixed range would open one mode
  // filtered down to nothing. Wheels without `slider()` keep their static one.
  // Null when a wheel has no threshold at all — the family wheel does not.
  const sliderRange = useMemo(() => {
    if (!sliderControl) return null;
    return spec.slider ? { ...sliderControl, ...spec.slider(view) } : sliderControl;
  }, [spec, sliderControl, view]);

  // Snap the threshold when the view changes its range, so switching matrices
  // lands on that mode's sensible default rather than a stale number. Declared
  // after sliderRange: its dependency array is evaluated during render, so a
  // reference above the definition is a temporal-dead-zone crash, not a warning.
  useEffect(() => {
    if (!spec.slider || !sliderRange) return;
    setMinShared((current) =>
      current >= sliderRange.min && current <= sliderRange.max ? current : sliderRange.value,
    );
  }, [spec, sliderRange?.min, sliderRange?.max, sliderRange?.value]);
  const legendControl = spec.controls.find((control) => control.type === 'legend');
  const matches = useSharedFragrances(spec.slug, selectedPair);
  const legendId = spec.controls.find((control) => control.type === 'legend')?.id;
  const notePerfumes = useNotePerfumes(spec.slug, note);
  const activeFamily = legendId ? sticky[legendId] : null;

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
        // The note stays: note AND band together read as "this note, inside
        // this family", which is what the engine's visible() already draws.
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

  const toggles = toggleControls.length > 0 && (
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
  );

  return (
    <main className="explorerPage">
      <header className="explorerHeader">
        <div>
          <h1>{WHEELS[spec.slug].title}</h1>
          <p className="lede">{spec.lede}</p>
        </div>
        {!narrow && toggles}
      </header>

      {narrow && <WheelTabs lead />}

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

          {narrow ? toggles : <WheelTabs />}
        </section>

        <aside className="insightPanel" aria-label="Wheel controls and pairing details">
          {sliderRange && (
            <Slider
              label={sliderRange.label}
              min={sliderRange.min}
              max={sliderRange.max}
              step={sliderRange.step}
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
                setSelectedPair(null);
              }}
            />
          )}

          {spec.slug === 'family' && activeFamily && (
            <FamilyBridges
              data={data}
              family={activeFamily}
              set={settings.set}
              size={settings.size}
              selected={selectedPair}
              onPick={setSelectedPair}
            />
          )}

          {note && spec.slug !== 'family' && (
            <NotePairings
              data={data}
              note={note}
              set={settings.set}
              family={activeFamily}
              selected={selectedPair}
              onPick={setSelectedPair}
            />
          )}

          {note && !selectedPair ? (
            <NotePerfumes note={note} family={activeFamily} state={notePerfumes} />
          ) : (
            <PairMatches pair={selectedPair} matches={matches} isFamily={spec.slug === 'family'} />
          )}
        </aside>
      </div>

      <footer className="wheelFooter">{spec.footer}</footer>
    </main>
  );
}

/**
 * "Show more" behind the subscribe wall.
 *
 * Returns a click handler and the gate element to render. Expanding is free
 * for anyone already subscribed; otherwise the wall goes up and the expansion
 * happens only if they come back unlocked — declining leaves the list as it
 * was, which is the same bargain the builder strikes at its third note.
 */
function useGatedExpand(expand) {
  const [asking, setAsking] = useState(false);

  const request = useCallback(() => {
    if (builderUnlocked()) {
      expand();
      return;
    }
    setAsking(true);
  }, [expand]);

  const gate = asking ? (
    <SubscribeGate
      onClose={(unlocked) => {
        setAsking(false);
        if (unlocked) expand();
      }}
    />
  ) : null;

  return [request, gate];
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

/**
 * Perfumes containing the searched note. Page 1 arrives with the search; the
 * long tail is fetched only if the reader opens a list.
 */
function useNotePerfumes(slug, note) {
  const [state, setState] = useState({ status: 'idle', data: null, rest: null });

  useEffect(() => {
    if (!note || slug === 'family') {
      setState({ status: 'idle', data: null, rest: null });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading', data: null, rest: null });
    getNotePerfumes(note, controller.signal)
      .then((data) => setState({ status: data ? 'done' : 'empty', data, rest: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', data: null, rest: null });
      });
    return () => controller.abort();
  }, [slug, note]);

  const loadRest = useCallback(() => {
    setState((current) => {
      if (current.status !== 'done' || current.rest) return current;
      getNotePerfumesRest(note).then((rest) =>
        setState((latest) => (latest.data?.note === note ? { ...latest, rest } : latest)),
      );
      return current;
    });
  }, [note]);

  return { ...state, loadRest };
}

/**
 * Where one family's ribbons go.
 *
 * The wheel shows this as ten arcs and fifty-five ribbons, which is legible as
 * a shape but useless for reading a number off. Selecting a family turns its
 * row of the matrix into a ranked list: who it bridges to, how many perfumes
 * carry notes from both, and across how many distinct note pairs.
 *
 * Those two numbers say different things and the panel shows both. Sweet and
 * fruity share 11,085 perfumes across 219 note pairs — a broad, well-worn
 * bridge. A family pair can post a big co-occurrence count through two or
 * three very common notes, and the pair count is what gives that away.
 *
 * Ranked by whichever metric the wheel is currently weighted by, so the list
 * and the picture agree about what is biggest.
 */
function FamilyBridges({ data, family, set, size, selected, onPick }) {
  const rows = useMemo(() => {
    const order = data.familyOrder;
    const index = order.indexOf(family);
    if (index < 0) return [];
    const amounts = data.matrices.amount[set];
    const pairs = data.matrices.presence[set];
    return (
      order
        .map((other, j) => ({
          family: other,
          amount: amounts[index][j],
          pairs: pairs[index][j],
        }))
        // The diagonal is the family folded in on itself — a real number, but a
        // different question from "what does it bridge to". It goes in the note
        // below instead of competing for the top of the list.
        .filter((row) => row.family !== family && row.amount > 0)
        .sort((a, b) => (size === 'presence' ? b.pairs - a.pairs : b.amount - a.amount))
    );
  }, [data, family, set, size]);

  if (!rows.length) return null;

  const within =
    data.matrices.amount[set][data.familyOrder.indexOf(family)][data.familyOrder.indexOf(family)];
  const key = size === 'presence' ? 'pairs' : 'amount';
  const peak = rows[0][key];

  return (
    <section className="notePairings" aria-live="polite">
      <div className="pairMatchesHeader">
        <p className="fieldLabel">Bridges from {family}</p>
        <span>{rows.length}</span>
      </div>

      <ol className="pairingList">
        {rows.map((row) => {
          const pinned =
            selected &&
            [selected.source, selected.target].includes(family) &&
            [selected.source, selected.target].includes(row.family);
          return (
            <li key={row.family}>
              <button
                type="button"
                aria-pressed={Boolean(pinned)}
                aria-label={`${family} with ${row.family}: ${row.amount.toLocaleString()} perfumes across ${row.pairs.toLocaleString()} note pairs`}
                onClick={() =>
                  onPick(pinned ? null : { source: family, target: row.family, value: row.amount })
                }
              >
                <span
                  className="pairingBar"
                  style={{ width: `${Math.max(3, (row[key] / peak) * 100)}%` }}
                  aria-hidden="true"
                />
                <span className="pairingName">{row.family}</span>
                <span className="pairingMetric">
                  {size === 'presence' ? row.pairs.toLocaleString() : row.amount.toLocaleString()}
                  <small>
                    {size === 'presence'
                      ? `${row.amount.toLocaleString()} shared`
                      : `${row.pairs.toLocaleString()} note pairs`}
                  </small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="emptyPrompt pairingCaveat">
        Perfumes carrying a {family} note and one from the other family, summed over every note pair
        that bridges them — so a perfume with three such pairs is counted three times. {family}{' '}
        pairs with itself {within.toLocaleString()} times over. Tap a row to pin the bridge.
      </p>
    </section>
  );
}

/** The number in the right-hand column, per ranking. */
function metricOf(by, pairing) {
  if (by === 'distinctive') return `${pairing.lift.toFixed(1)}×`;
  // Below chance the interesting figure is how far below, and 0.3× reads as a
  // small number rather than a strong signal. Inverted, it says "3.3× rarer".
  if (by === 'avoided') return `${(1 / pairing.lift).toFixed(1)}× rarer`;
  if (by === 'rated') return `${Math.round(pairing.bestShare * 100)}%`;
  return `${Math.round(pairing.share * 100)}%`;
}

/** What the list is actually measuring, spelled out under it. */
function caveatOf(by, note, data, top) {
  if (by === 'distinctive') {
    return `Share of ${note} perfumes, against how often the pair would meet by chance — ${describeLift(top.lift)} for ${top.note}. Ranked among partners appearing together at least ${MIN_SUPPORT} times.`;
  }
  if (by === 'avoided') {
    return `Pairs perfumers reach for least: ${top.note} appears with ${note} ${describeLift(top.lift)}. Two things to read past. Notes that never meet at all are not here — a pair needs ${MIN_SUPPORT} co-occurrences before a ratio means anything, and most of the wheel's possible pairs simply never occur. And two names for one material avoid each other by definition, because a record lists it once: that is why rose shuns bulgarian rose, and bergamot shuns citruses.`;
  }
  // 'rated' deliberately has none: the percentage speaks for itself, and the
  // paragraph that used to sit here was longer than the list it explained.
  if (by === 'rated') return null;
  return `Share of the ${data.totals[note].toLocaleString()} perfumes carrying ${note}. Common notes lead every list; switch to most distinctive to divide that out.`;
}

/**
 * A focused note's partners, ranked. Pure arithmetic on the matrix already in
 * memory (see src/data/notePairings.js), so this renders in the same frame as
 * the search — no fetch, no spinner.
 *
 * Four rankings, because they disagree and the disagreement is the point. "Most
 * often" is the honest headline and is mostly musk and jasmine, which are in
 * everything. "Most distinctive" divides that by how common each note is on
 * its own, which is what turns rose from `musk, jasmine, sandalwood` into
 * `carnation, aldehydes, orris root` — the vintage rose chypre. "Avoided" reads
 * the same ratio from the bottom, and "best rated" asks which pairings the
 * catalogue's own voters liked. See RANKINGS in src/data/notePairings.js.
 *
 * Picking a row pins the pair, which hands the existing PairMatches panel
 * below its `source`/`target`/`value` and loads the record-level perfumes.
 */
function NotePairings({ data, note, set, family, selected, onPick }) {
  const [by, setBy] = useState('often');
  const [expanded, setExpanded] = useState(false);
  const [askToExpand, expandGate] = useGatedExpand(useCallback(() => setExpanded(true), []));

  useEffect(() => {
    setExpanded(false);
  }, [note, family, by]);

  const ranked = useMemo(() => {
    const all = rankPairings(data, note, set, by);
    return family ? all.filter((pairing) => pairing.family === family) : all;
  }, [data, note, set, by, family]);

  // Other spellings of this same material still on the wheel. Their existence
  // skews everything below, so the panel says so rather than quietly ranking
  // one spelling's records as if they were the whole picture.
  const aliases = [...aliasesOf(data, note)].filter((name) => data.totals?.[name]);

  if (!data.totals) return null;

  const items = expanded ? ranked : ranked.slice(0, TOP_N);
  // Only the rankings this wheel's data can actually answer. The accords wheel
  // has no all/best split, so it is never offered "best rated".
  const rankings = Object.entries(RANKINGS).filter(
    ([key]) => key !== 'rated' || supportsRating(data),
  );
  const { scale } = RANKINGS[by] ?? RANKINGS.often;
  // Ratio scales floor at 1 (chance) so a list of near-chance pairs does not
  // stretch into a full bar; share scales floor just above 0.
  const peak = Math.max(
    ...items.map((pairing) => pairing[scale]),
    scale === 'lift' || scale === 'avoidance' ? 1 : 0.01,
  );

  return (
    <section className="notePairings" aria-live="polite">
      <div className="pairMatchesHeader">
        <p className="fieldLabel">{family ? `${note} × ${family}` : `Pairs with ${note}`}</p>
        <span>{ranked.length.toLocaleString()}</span>
      </div>

      <div className="pairRank pairRank--wrap" role="group" aria-label="Rank pairings by">
        {rankings.map(([key, ranking]) => (
          <button key={key} type="button" aria-pressed={by === key} onClick={() => setBy(key)}>
            {ranking.label}
          </button>
        ))}
      </div>

      {ranked.length === 0 ? (
        <p className="emptyPrompt">
          Nothing pairs {note} with a {family} note often enough to rank.
        </p>
      ) : (
        <>
          <ol className="pairingList">
            {items.map((pairing) => {
              const pinned =
                selected &&
                [selected.source, selected.target].includes(note) &&
                [selected.source, selected.target].includes(pairing.note);
              return (
                <li key={pairing.note}>
                  <button
                    type="button"
                    aria-pressed={Boolean(pinned)}
                    onClick={() =>
                      onPick(
                        pinned
                          ? null
                          : { source: note, target: pairing.note, value: pairing.count },
                      )
                    }
                  >
                    <span
                      className="pairingBar"
                      style={{ width: `${Math.max(3, (pairing[scale] / peak) * 100)}%` }}
                      aria-hidden="true"
                    />
                    <span className="pairingName">{pairing.note}</span>
                    <span className="pairingMetric">
                      {metricOf(by, pairing)}
                      <small>{pairing.count.toLocaleString()}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {ranked.length > items.length && (
            <button type="button" className="showMore" onClick={askToExpand}>
              Show {(ranked.length - items.length).toLocaleString()} more
            </button>
          )}
          {expandGate}

          {caveatOf(by, note, data, items[0]) && (
            <p className="emptyPrompt pairingCaveat">{caveatOf(by, note, data, items[0])}</p>
          )}

          {aliases.length > 0 && (
            <p className="emptyPrompt pairingCaveat pairingAlias">
              Also on this wheel as{' '}
              {aliases
                .map((name) => `“${name}” (${data.totals[name].toLocaleString()})`)
                .join(', ')}
              . A record uses one spelling or the other, almost never both, so these ranks describe
              the “{note}” records alone.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/**
 * One perfume per row: name and brand on the left, rating over review count on
 * the right. The count is the half that says how much to trust the other half —
 * 4.6 from nine voters and 4.2 from nine thousand are not the same claim.
 */
function MatchList({ items }) {
  return (
    <ol className="matchList">
      {items.map((item) => (
        <li key={item.url}>
          <a href={item.url} target="_blank" rel="noreferrer">
            <span>
              <strong>{item.name}</strong>
              <small>{item.brand}</small>
            </span>
            <span className="rating">
              {item.rating ? item.rating.toFixed(1) : '\u2014'}
              {item.ratings > 0 && (
                <small>
                  {item.ratings.toLocaleString()} {item.ratings === 1 ? 'review' : 'reviews'}
                </small>
              )}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * Two readings of one note: every perfume that carries it, or — once a family
 * bar is selected — only those that also carry a note from that family.
 */
/** Perfumes shown before "show more" raises the subscribe wall. */
const PERFUME_PREVIEW = 10;

function NotePerfumes({ note, family, state }) {
  const [expanded, setExpanded] = useState(false);
  const [askToExpand, expandGate] = useGatedExpand(
    // Page two is only fetched once the wall is cleared, so a declined prompt
    // costs no request either.
    useCallback(() => {
      state.loadRest();
      setExpanded(true);
    }, [state]),
  );

  useEffect(() => setExpanded(false), [note, family]);

  if (state.status === 'loading') {
    return (
      <section className="pairMatches" aria-live="polite">
        <div className="pairMatchesHeader">
          <p className="fieldLabel">Perfumes with {note}</p>
        </div>
        <p className="emptyPrompt">Loading examples…</p>
      </section>
    );
  }
  if (state.status === 'error') {
    return (
      <section className="pairMatches" aria-live="polite">
        <div className="pairMatchesHeader">
          <p className="fieldLabel">Perfumes with {note}</p>
        </div>
        <p className="emptyPrompt">The fragrance index could not be loaded.</p>
      </section>
    );
  }
  if (state.status !== 'done' || !state.data) {
    return (
      <section className="pairMatches" aria-live="polite">
        <div className="pairMatchesHeader">
          <p className="fieldLabel">Perfumes with {note}</p>
        </div>
        <p className="emptyPrompt">No record-level examples are indexed for this note yet.</p>
      </section>
    );
  }

  const { data, rest } = state;
  const bucket = family ? data.families[family] : null;
  const head = family ? (bucket?.items ?? []) : data.all;
  const tail = (family ? rest?.families?.[family] : rest?.all) ?? [];
  // `total` is how many perfumes exist; `held` is how many the index keeps.
  // The button may only promise what page 2 can actually deliver.
  const total = family ? (bucket?.total ?? 0) : data.total;
  const held = family ? (bucket?.held ?? head.length) : (data.held ?? data.all.length);
  // Ten, then the wall. Page 1 carries forty, but showing them all leaves
  // nothing for "show more" to reveal on a note with a short list.
  const items = expanded ? [...head, ...tail] : head.slice(0, PERFUME_PREVIEW);
  const more = Math.max(0, Math.min(held, total) - items.length);
  const capped = total > items.length && more === 0;

  return (
    <section className="pairMatches" aria-live="polite">
      <div className="pairMatchesHeader">
        <p className="fieldLabel">
          {family ? `${note} \u00d7 ${family}` : `Perfumes with ${note}`}
        </p>
        <span>{total.toLocaleString()}</span>
      </div>

      {family && (
        <p className="emptyPrompt noteScope">
          Carrying {note} and a {family} note.
        </p>
      )}

      {items.length === 0 ? (
        <p className="emptyPrompt">
          Nothing in the index pairs {note} with a {family} note.
        </p>
      ) : (
        <>
          <MatchList items={items} />
          {more > 0 && (
            <button type="button" className="showMore" onClick={askToExpand}>
              Show {more.toLocaleString()} more
            </button>
          )}
          {expandGate}
          {capped && (
            <p className="emptyPrompt listCap">
              Showing the top {items.length.toLocaleString()} of {total.toLocaleString()}, by rating
              and review count.
            </p>
          )}
        </>
      )}
    </section>
  );
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
            <MatchList items={matches.items} />
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
