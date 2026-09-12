import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBuilderIndex, intersect, suggestions, getCards } from '../data/builderIndex';
import { builderUnlocked, unlockBuilder } from '../lib/engagement';
import WheelTabs from '../components/WheelTabs';
import SubscribeGate from '../components/SubscribeGate';
import { Loading, ErrorState } from '../components/Status';
import site from '../site.config';

// The results start folded to a handful. The recommended notes are the point
// of the page, and twenty-four rows of perfume between them and the reader was
// burying the thing that makes this better than a search box.
const COLLAPSED = 6;
const PAGE = 24;

/**
 * The Note Builder: pin notes, see what carries all of them.
 *
 * The other views start from the catalogue and show you its shape. This one
 * starts from a shelf — the notes you already like, or already own — and
 * narrows. The panel underneath is the actual engine of it: having pinned two
 * notes, the notes that keep turning up beside them are the next thing to try,
 * and that list is rebuilt from the matched set rather than from the catalogue.
 */
export default function BuilderPage() {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [shown, setShown] = useState(COLLAPSED);
  const [cards, setCards] = useState([]);
  // The note the reader reached for when the prompt appeared. Held rather than
  // dropped: interrupting someone is bad enough without also losing their tap.
  const [pending, setPending] = useState(null);

  useEffect(() => {
    getBuilderIndex().then(setIndex).catch(setError);
  }, []);

  const matched = useMemo(
    () => (index ? intersect(index, selected) : new Int32Array(0)),
    [index, selected],
  );

  const suggested = useMemo(
    () => (index && selected.length ? suggestions(index, matched, selected) : []),
    [index, matched, selected],
  );

  useEffect(() => setShown(COLLAPSED), [selected]);

  // Names for the visible slice only.
  useEffect(() => {
    if (!index || !matched.length) {
      setCards([]);
      return undefined;
    }
    const controller = new AbortController();
    const slice = matched.slice(0, shown);
    getCards(index, slice, controller.signal)
      .then(setCards)
      .catch((fetchError) => {
        if (fetchError.name !== 'AbortError') setCards([]);
      });
    return () => controller.abort();
  }, [index, matched, shown]);

  const { freeNotes, hardStop } = site.builder;

  const add = useCallback(
    (note) => {
      setSelected((current) => {
        if (current.includes(note)) return current;
        // The allowance is a width, not a budget: two notes may be stacked
        // freely, and the third is where the ask lands. Unlike the old soft
        // gate this reappears every time — it is the door, not a reminder.
        if (freeNotes > 0 && current.length >= freeNotes && !builderUnlocked()) {
          setPending(note);
          return current;
        }
        return [...current, note];
      });
    },
    [freeNotes],
  );

  /**
   * Unlocking lets the held note through. Declining does not — hardStop keeps
   * the reader at the free width, which is the whole point of a gate.
   *
   * Both setters are called flat, never one nested inside the other's updater:
   * an updater that fires a side effect is impure, and React runs updaters
   * twice in development precisely to catch that. Nested, this added the note
   * twice. The includes() guard is belt and braces — `selected` must never
   * carry a duplicate, whichever path put it there.
   */
  const closeGate = useCallback(
    (unlocked) => {
      if (pending != null && (unlocked || !hardStop)) {
        setSelected((current) => (current.includes(pending) ? current : [...current, pending]));
      }
      setPending(null);
    },
    [pending, hardStop],
  );

  const remove = (note) => setSelected((current) => current.filter((value) => value !== note));

  if (error) return <ErrorState message="The builder index could not be loaded." />;

  return (
    <main className="explorerPage builderPage">
      <WheelTabs lead />

      <header className="explorerHeader">
        <div>
          <h1>Note builder</h1>
          <p className="lede">
            Pin the notes you like — or the ones already on your shelf — and see every perfume that
            carries all of them. Each note you add narrows the list, and the panel underneath shows
            what else keeps turning up in whatever is left.
          </p>
        </div>
      </header>

      {!index ? (
        <Loading />
      ) : (
        <>
          <NotePicker index={index} selected={selected} onAdd={add} />

          {selected.length > 0 && (
            <div className="builderChips">
              {selected.map((note) => (
                <button
                  key={note}
                  type="button"
                  className="builderChip"
                  onClick={() => remove(note)}
                  aria-label={`Remove ${index.notes[note]}`}
                >
                  {index.notes[note]}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              <button type="button" className="builderClear" onClick={() => setSelected([])}>
                Clear all
              </button>
            </div>
          )}

          <RecommendedNotes
            suggested={suggested}
            matched={matched}
            selected={selected}
            onAdd={add}
          />

          <div className="builderGrid">
            <section className="builderResults" aria-live="polite">
              <div className="pairMatchesHeader">
                <p className="fieldLabel">
                  {selected.length === 0
                    ? 'Every perfume'
                    : selected.length === 1
                      ? `Perfumes with ${index.notes[selected[0]]}`
                      : `Perfumes with all ${selected.length} notes`}
                </p>
                <span>{(selected.length ? matched.length : index.perfumes).toLocaleString()}</span>
              </div>

              {selected.length === 0 ? (
                <p className="emptyPrompt">
                  Add a note above to begin. {index.perfumes.toLocaleString()} perfumes,{' '}
                  {index.notes.length.toLocaleString()} notes to filter on.
                </p>
              ) : matched.length === 0 ? (
                <p className="emptyPrompt">
                  Nothing in the catalogue carries all {selected.length} of those. Drop one and try
                  again — the rarer the combination, the sooner it runs dry.
                </p>
              ) : (
                <>
                  <ol className="matchList builderList">
                    {cards.map((card) => (
                      <li key={card.id}>
                        <Link to={`/perfume/${card.id}`}>
                          <span>
                            <strong>{card.name}</strong>
                            <small>{card.brand}</small>
                          </span>
                          <span className="rating">
                            {card.rating ? card.rating.toFixed(1) : '—'}
                            {card.ratings > 0 && (
                              <small>{card.ratings.toLocaleString()} reviews</small>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                  <div className="builderListControls">
                    {matched.length > shown && (
                      <button
                        type="button"
                        className="showMore"
                        onClick={() => setShown((current) => current + PAGE)}
                      >
                        Show {Math.min(PAGE, matched.length - shown).toLocaleString()} more
                      </button>
                    )}
                    {shown > COLLAPSED && (
                      <button
                        type="button"
                        className="showMore showMore--quiet"
                        onClick={() => setShown(COLLAPSED)}
                      >
                        Collapse
                      </button>
                    )}
                  </div>
                  <p className="emptyPrompt listCap">
                    Showing {Math.min(shown, matched.length).toLocaleString()} of{' '}
                    {matched.length.toLocaleString()}, best-rated first — a high rating from many
                    reviewers outranks a perfect one from nine.
                  </p>
                </>
              )}
            </section>
          </div>
        </>
      )}

      <footer className="wheelFooter">
        Built from the Fragrantica fragrance dataset (24,050 perfumes with note lists). A perfume
        matches when its published note list contains every note you pinned — those lists are
        community-edited and uneven, so an absence is often a gap in the record rather than in the
        bottle.
      </footer>

      {pending != null && <SubscribeGate onClose={closeGate} />}
    </main>
  );
}

/**
 * The notes that keep turning up in whatever is left — the engine of the page.
 *
 * Pills rather than a ranked list, and above the results rather than beside
 * them, because this is the thing a reader acts on next. Each carries its own
 * share as a proportional fill: twelve percentages in a row is a table nobody
 * reads, whereas twelve pills of visibly different weight is a shape you take
 * in at a glance and can still read the exact number off.
 *
 * The fill is the share itself — 20% carries a fifth of the pill — so the same
 * width means the same thing however narrow the selection has become.
 */
const PILLS = 12;

function RecommendedNotes({ suggested, matched, selected, onAdd }) {
  const [all, setAll] = useState(false);

  useEffect(() => setAll(false), [selected]);

  if (!selected.length || !suggested.length) return null;

  const shown = all ? suggested : suggested.slice(0, PILLS);

  return (
    <section className="recommended" aria-live="polite">
      <div className="recommendedHead">
        <p className="fieldLabel">Recommended notes</p>
        <span>
          in the {matched.length.toLocaleString()} {matched.length === 1 ? 'match' : 'matches'}
        </span>
      </div>

      <ul className="notePills">
        {shown.map((item) => (
          <li key={item.note}>
            <button
              type="button"
              onClick={() => onAdd(item.note)}
              title={`${item.count.toLocaleString()} of ${matched.length.toLocaleString()} also carry ${item.name}`}
            >
              {/* Literally the share: a note in 20% of the matches fills a
                  fifth of its pill. No floor and no scaling to the leader —
                  the width means the same thing on every pill and in every
                  selection, so a thin sliver is genuinely a thin sliver. */}
              <span
                className="notePillFill"
                style={{ width: `${item.share * 100}%` }}
                aria-hidden="true"
              />
              <span className="notePillName">{item.name}</span>
              <span className="notePillShare">{Math.round(item.share * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>

      {suggested.length > PILLS && (
        <button type="button" className="recommendedMore" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show ${suggested.length - PILLS} more`}
        </button>
      )}
    </section>
  );
}

/** Type-ahead over the builder vocabulary, ranked by how many perfumes carry it. */
function NotePicker({ index, selected, onAdd }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const chosen = new Set(selected);
    const out = [];
    // index.notes is already in frequency order, so the first matches found are
    // the ones most people mean.
    for (let i = 0; i < index.notes.length && out.length < 40; i += 1) {
      if (!chosen.has(i) && index.notes[i].includes(q)) out.push(i);
    }
    return out;
  }, [query, index, selected]);

  const choose = (note) => {
    onAdd(note);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="builderPicker">
      <label className="fieldLabel" htmlFor="builder-note">
        Add a note
      </label>
      <div className="search" ref={boxRef}>
        <input
          id="builder-note"
          type="text"
          placeholder="e.g. vanilla, oud, bergamot…"
          autoComplete="off"
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && hits.length > 0}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && hits[0] != null) choose(hits[0]);
            if (event.key === 'Escape') setOpen(false);
          }}
        />
        {open && hits.length > 0 && (
          <div className="results" role="listbox">
            {hits.map((note) => (
              <button key={note} type="button" role="option" onClick={() => choose(note)}>
                {index.notes[note]}
                <span className="fam">{index.counts[note].toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected.length === 0 && (
        <div className="builderQuick">
          {index.notes.slice(0, 8).map((name, note) => (
            <button key={name} type="button" onClick={() => onAdd(note)}>
              + {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
