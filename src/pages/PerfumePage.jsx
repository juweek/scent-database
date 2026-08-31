import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMeta, getPerfume, searchPerfumes, pairMatrix, liftOf } from '../data/perfumeIndex';
import { familyOfAccord } from '../data/accordFamily';
import { getTaxonomy } from '../data/noteTaxonomy';
import PerfumeChord, { TIER_COLOR, TIER_NAME } from '../viz/PerfumeChord';
import WheelTabs from '../components/WheelTabs';
import { Loading, ErrorState } from '../components/Status';

/**
 * One perfume, four readings: the chord (how its notes relate across the whole
 * catalogue), the pyramid (how the brand declared them), the accord bars (what
 * Fragrantica's community voted it smells of), and its nearest neighbours by
 * note overlap.
 *
 * Everything on the page comes from ONE record fetch — see src/data/perfumeIndex.js.
 */
export default function PerfumePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [record, setRecord] = useState(null);
  const [status, setStatus] = useState('idle');
  const [mode, setMode] = useState('conventional');
  const [arrange, setArrange] = useState('tier');
  const [selected, setSelected] = useState(null);
  const [taxonomy, setTaxonomy] = useState(null);

  // note -> accord -> family, for the chord's outer bands and the accord bars.
  useEffect(() => {
    getTaxonomy()
      .then(setTaxonomy)
      .catch(() => {});
  }, []);

  useEffect(() => {
    getMeta().then(setMeta).catch(setMetaError);
  }, []);

  useEffect(() => {
    if (!id) {
      setRecord(null);
      setStatus('idle');
      return undefined;
    }
    const controller = new AbortController();
    setStatus('loading');
    setSelected(null);
    getPerfume(id, controller.signal)
      .then((found) => {
        setRecord(found);
        setStatus(found ? 'done' : 'missing');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, [id]);

  const open = useCallback((nextId) => navigate(`/perfume/${nextId}`), [navigate]);

  if (metaError) return <ErrorState message="The perfume index could not be loaded." />;

  return (
    <main className="explorerPage">
      <header className="explorerHeader">
        <div>
          <p className="eyebrow">Fragrantica · one bottle</p>
          <h1>Perfume</h1>
          <p className="lede">
            Search any of the {meta ? meta.perfumes.toLocaleString() : '24,000'} perfumes in the
            dataset to see its notes drawn as a chord — where the ribbons are weighted not by this
            bottle but by the whole catalogue, so an ordinary composition reads as a thick even web
            and an unusual one shows its seams.
          </p>
        </div>
      </header>

      <div className="perfumeSearchRow">
        <PerfumeSearch onPick={open} />
      </div>

      {!id && <Featured meta={meta} onPick={open} />}
      {id && status === 'loading' && <Loading />}
      {id && status === 'error' && <ErrorState message="That perfume could not be loaded." />}
      {id && status === 'missing' && (
        <p className="emptyPrompt perfumeMissing">
          No perfume with that id is in the index. Try the search above.
        </p>
      )}

      {id && status === 'done' && record && meta && (
        <PerfumeDetail
          record={record}
          meta={meta}
          taxonomy={taxonomy}
          mode={mode}
          setMode={setMode}
          arrange={arrange}
          setArrange={setArrange}
          selected={selected}
          setSelected={setSelected}
          onPick={open}
        />
      )}

      <WheelTabs />

      <footer className="wheelFooter">
        Note lists, accords and tiers as published on Fragrantica, which are community-edited from
        brand material — see the data notes for who authors what. Ribbon weight is catalogue-wide
        co-occurrence across {meta ? meta.perfumes.toLocaleString() : '24,050'} perfumes, not a
        claim about this perfume's formula.
      </footer>
    </main>
  );
}

function PerfumeDetail({
  record,
  meta,
  taxonomy,
  mode,
  setMode,
  arrange,
  setArrange,
  selected,
  setSelected,
  onPick,
}) {
  const { variants, lookalikes } = useMemo(() => {
    const all = record.similar || [];
    return {
      variants: all.filter((row) => row[5] === 1),
      lookalikes: all.filter((row) => row[5] !== 1),
    };
  }, [record]);

  return (
    <>
      <div className="perfumeHead">
        <div>
          <h2>{record.name}</h2>
          <p className="perfumeBrand">
            {record.brand}
            {record.year ? ` · ${record.year}` : ''}
            {record.perfumers?.length ? ` · ${record.perfumers.join(', ')}` : ''}
          </p>
        </div>
        <div className="perfumeStats">
          {record.rating != null && (
            <span>
              <strong>{record.rating.toFixed(2)}</strong>
              <small>
                {record.ratings ? `${record.ratings.toLocaleString()} ratings` : 'rating'}
              </small>
            </span>
          )}
          <a href={record.url} target="_blank" rel="noreferrer" className="perfumeSource">
            Fragrantica ↗
          </a>
        </div>
      </div>

      <div className="explorerGrid">
        <section className="wheelWorkspace" aria-label={`${record.name} note chord`}>
          <div className="perfumeControls">
            <div className="pairRank perfumeMode" role="group" aria-label="Weight ribbons by">
              <button
                type="button"
                aria-pressed={mode === 'conventional'}
                onClick={() => setMode('conventional')}
              >
                conventional
              </button>
              <button
                type="button"
                aria-pressed={mode === 'distinctive'}
                onClick={() => setMode('distinctive')}
              >
                distinctive
              </button>
            </div>
            <div className="pairRank perfumeMode" role="group" aria-label="Arrange notes by">
              <button
                type="button"
                aria-pressed={arrange === 'tier'}
                onClick={() => setArrange('tier')}
              >
                by tier
              </button>
              <button
                type="button"
                aria-pressed={arrange === 'family'}
                onClick={() => setArrange('family')}
              >
                by family
              </button>
            </div>
          </div>

          <div className="stage perfumeStage">
            <PerfumeChord
              record={record}
              taxonomy={taxonomy}
              population={meta.perfumes}
              mode={mode}
              arrange={arrange}
              selected={selected}
              onPick={setSelected}
            />
            <p className="stageHint">
              {mode === 'conventional'
                ? 'Thicker ribbon · more perfumes pair those two notes'
                : 'Brighter ribbon · that pair beats chance by more'}
              {' — rings, outward: note · family · tier'}
            </p>
            <p className="stageHint">Tap a ribbon or an arc · tap empty space to clear</p>
          </div>

          <TierLegend record={record} />
        </section>

        <aside className="insightPanel" aria-label="Pyramid, accords and lookalikes">
          <NotePyramid record={record} maxNotes={meta.maxNotes} />
          <AccordBars record={record} taxonomy={taxonomy} />
          <SmellsLike lookalikes={lookalikes} variants={variants} onPick={onPick} />
        </aside>
      </div>
    </>
  );
}

function TierLegend({ record }) {
  return (
    <ul className="tierLegend">
      {TIER_NAME.map((name, tier) => {
        const count = record.tier.filter((value) => value === tier).length;
        if (!count) return null;
        return (
          <li key={name}>
            <span style={{ background: TIER_COLOR[tier] }} />
            {name} · {count}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The declared pyramid. Drawn as three stacked bands rather than a triangle:
 * the tiers are a claim about volatility, not about proportion, so tapering the
 * shape would encode a quantity the data does not have.
 */
function NotePyramid({ record, maxNotes }) {
  const tiers = [0, 1, 2].map((tier) => ({
    tier,
    name: TIER_NAME[tier],
    notes: record.notes.filter((_, index) => record.tier[index] === tier),
  }));

  return (
    <section className="notePyramid">
      <p className="fieldLabel">Note pyramid</p>
      <div className="pyramidTiers">
        {tiers.map(({ tier, name, notes }) => (
          <div className="pyramidTier" key={name} data-empty={notes.length === 0}>
            <div className="pyramidTierHead">
              <span className="pyramidDot" style={{ background: TIER_COLOR[tier] }} />
              <span className="pyramidTierName">{name}</span>
              <span className="pyramidTierCount">{notes.length}</span>
            </div>
            {notes.length > 0 ? (
              <ul className="pyramidNotes">
                {notes.map((note) => (
                  <li key={note} style={{ borderColor: TIER_COLOR[tier] }}>
                    {note}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="emptyPrompt">None listed.</p>
            )}
          </div>
        ))}
      </div>
      {maxNotes && record.notes.length >= maxNotes && (
        <p className="emptyPrompt pyramidNote pyramidCap">
          Showing the first {maxNotes} notes as listed. This perfume declares more — the index caps
          each record there, because the pair triangle a chord needs grows as the square of the note
          count.
        </p>
      )}
      <p className="emptyPrompt pyramidNote">
        Top, heart and base are as the brand declared them — a description written to sell the
        bottle, not a measurement. The same material lands in different tiers in different perfumes.
      </p>
    </section>
  );
}

/**
 * Fragrantica's main accords, which its community votes on. The source gives
 * five in rank order but no vote weights, so the bars encode RANK and say so —
 * inventing strengths to make them look like the site's would be a lie in the
 * shape of a chart.
 */
function AccordBars({ record, taxonomy }) {
  if (!record.accords?.length) return null;

  return (
    <section className="accordBars">
      <p className="fieldLabel">Main accords</p>
      <ol className="accordList">
        {record.accords.map((accord, index) => {
          const family = taxonomy ? familyOfAccord(taxonomy.accordFamily, accord) : null;
          const color = family ? taxonomy.colors[family] : null;
          return (
            <li key={accord}>
              <span
                className="accordBar"
                data-unclassified={color ? undefined : 'true'}
                style={{
                  width: `${100 - index * 15}%`,
                  background: color || 'transparent',
                  // Family hues run from #E6B422 to #6E5A4A, so one text colour
                  // is unreadable at one end or the other.
                  color: color ? inkOn(color) : 'var(--muted)',
                }}
              >
                <span className="accordName">{accord}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="emptyPrompt accordNote">
        Ranked 1–5 as published. Bar length is that rank, not a vote count — the dataset does not
        carry the strengths Fragrantica draws.
      </p>
    </section>
  );
}

/** Readable text colour for a filled swatch — sRGB relative luminance. */
function inkOn(hex) {
  const value = hex.replace('#', '');
  const channel = (start) => {
    const c = parseInt(value.slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // 0.175 is where the WCAG contrast ratio against these two inks crosses over.
  // Checked against all ten family hues: only woody and musky take light text.
  return luminance > 0.175 ? '#0b0d0d' : '#f6f3ee';
}

function SmellsLike({ lookalikes, variants, onPick }) {
  return (
    <section className="smellsLike">
      <div className="pairMatchesHeader">
        <p className="fieldLabel">Smells like this</p>
        <span>{lookalikes.length}</span>
      </div>

      {lookalikes.length === 0 ? (
        <p className="emptyPrompt">Nothing else in the index shares enough of these notes.</p>
      ) : (
        <ol className="matchList">
          {lookalikes.map(([id, name, brand, score, shared]) => (
            <li key={id}>
              <button type="button" onClick={() => onPick(id)}>
                <span>
                  <strong>{name}</strong>
                  <small>{brand}</small>
                </span>
                <span className="rating">
                  {Math.round(score * 100)}%<small>{shared} notes</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {variants.length > 0 && (
        <>
          <p className="fieldLabel smellsLikeSub">Other versions</p>
          <ol className="matchList">
            {variants.map(([id, name, brand, score, shared]) => (
              <li key={id}>
                <button type="button" onClick={() => onPick(id)}>
                  <span>
                    <strong>{name}</strong>
                    <small>{brand}</small>
                  </span>
                  <span className="rating">
                    {Math.round(score * 100)}%<small>{shared} notes</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}

      <p className="emptyPrompt smellsNote">
        Shared notes over combined notes. Candidates are drawn from each perfume's rarest notes
        rather than every record, so this finds close matches, not a ranking of all 24,050.
      </p>
    </section>
  );
}

function Featured({ meta, onPick }) {
  if (!meta?.featured) return null;
  return (
    <section className="featured">
      <p className="fieldLabel">Start somewhere</p>
      <ul className="featuredGrid">
        {meta.featured.map(([id, name, brand, year]) => (
          <li key={id}>
            <button type="button" onClick={() => onPick(id)}>
              <strong>{name}</strong>
              <small>
                {brand}
                {year ? ` · ${year}` : ''}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Type-ahead over the whole catalogue, one shard per initial letter. */
function PerfumeSearch({ onPick }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return undefined;
    }
    const controller = new AbortController();
    // Short debounce: a shard is a single small file, but there is no reason to
    // filter 3,000 rows on every keystroke.
    const timer = setTimeout(() => {
      searchPerfumes(query, controller.signal)
        .then(setHits)
        .catch((error) => {
          if (error.name !== 'AbortError') setHits([]);
        });
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choose = (row) => {
    setQuery(`${row.name} — ${row.brand}`);
    setOpen(false);
    onPick(row.id);
  };

  return (
    <div>
      <label className="fieldLabel" htmlFor="perfume-search">
        Search a perfume
      </label>
      <div className="search" ref={boxRef}>
        <input
          id="perfume-search"
          type="text"
          placeholder="e.g. Aventus, Chanel, Black Orchid…"
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
            if (event.key === 'Enter' && hits[0]) choose(hits[0]);
            if (event.key === 'Escape') setOpen(false);
          }}
        />
        {open && hits.length > 0 && (
          <div className="results" role="listbox">
            {hits.map((row) => (
              <button key={row.id} type="button" role="option" onClick={() => choose(row)}>
                {row.name}
                <span className="fam">
                  {row.brand}
                  {row.year ? ` · ${row.year}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
