import { useState, useRef, useEffect, useId, useMemo } from 'react';

/** Segmented button group. Each option may carry a small sub-label. */
export function Toggle({ label, options, value, onChange }) {
  return (
    <div className="toggleField">
      <p className="fieldLabel">{label}</p>
      <div className="toggle" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
            {o.note && <span className="n">{o.note}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Slider({ label, min, max, step, value, onChange }) {
  const id = useId();
  return (
    <div className="slider">
      <label className="fieldLabel" htmlFor={id}>
        {label} <output>{value.toLocaleString()}</output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </div>
  );
}

/**
 * Type-ahead over the note list. Matches the prototype: substring match, first
 * 40 hits, Enter takes the first, Escape and outside-click close, and the
 * chosen note becomes a dismissible chip.
 */
export function Search({ label, placeholder, items, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const inputId = useId();
  const resultsId = useId();

  useEffect(() => {
    const close = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const q = query.trim().toLowerCase();
  const hits = useMemo(
    () => items.filter((it) => it.value.toLowerCase().includes(q)).slice(0, 40),
    [items, q],
  );

  const choose = (v) => {
    onChange(v);
    setQuery(v);
    setOpen(false);
  };

  return (
    <div>
      <label className="fieldLabel" htmlFor={inputId}>
        {label}
      </label>
      <div className="search" ref={boxRef}>
        <input
          id={inputId}
          type="text"
          placeholder={placeholder}
          autoComplete="off"
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && hits.length > 0}
          aria-controls={resultsId}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hits[0]) choose(hits[0].value);
            if (e.key === 'Escape') setOpen(false);
          }}
        />
        {open && hits.length > 0 && (
          <div className="results" id={resultsId} role="listbox">
            {hits.map((it) => (
              <button key={it.value} type="button" role="option" onClick={() => choose(it.value)}>
                {it.value}
                <span className="fam">{it.meta}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {value && (
        <span className="chip">
          {value}
          <button
            type="button"
            title="clear"
            aria-label="clear focus"
            onClick={() => {
              onChange(null);
              setQuery('');
            }}
          >
            ×
          </button>
        </span>
      )}
    </div>
  );
}

/** Compact, scrollable family distribution. Bars remain 44px touch targets. */
export function FamilyBars({ label, items, sticky, onHover, onToggle }) {
  const max = Math.max(1, ...items.map((item) => item.count || 0));
  const active = items.find((item) => item.key === sticky);

  return (
    <section className="familyChart" aria-label={label}>
      <p className="fieldLabel">{label}</p>
      <div className="familyBars" role="group" aria-label={`${label}, select to isolate`}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-label={`${item.label}, ${item.count} notes`}
            aria-pressed={sticky === item.key}
            data-dim={sticky && sticky !== item.key ? 'true' : 'false'}
            onPointerEnter={(event) => event.pointerType !== 'touch' && onHover(item.key)}
            onPointerLeave={(event) => event.pointerType !== 'touch' && onHover(null)}
            onClick={() => onToggle(item.key)}
          >
            <span
              className="familyBar"
              style={{ background: item.color, height: `${28 + (item.count / max) * 72}%` }}
            />
            <span className="srOnly">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="familyChartReadout" aria-live="polite">
        <span>{active ? active.label : 'All scent families'}</span>
        <span>{active ? `${active.count} notes` : `${items.length} families`}</span>
      </div>
    </section>
  );
}
