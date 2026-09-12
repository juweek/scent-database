import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWheel, WHEEL_LIST } from '../data/wheels';
import ChordWheel from '../viz/ChordWheel';

/**
 * The rail: four wheels, then the two tools that are not wheels.
 *
 * Perfume and Builder have no chord matrix to preview, so they carry a drawn
 * mark instead of a live wheel. The mark is not decoration in either case —
 * the Venn IS what the builder does, and the single ringed bottle is what the
 * perfume page draws.
 */
const TOOLS = [
  {
    slug: 'perfume',
    to: '/perfume',
    label: 'Perfume',
    stat: '24,050 bottles · one chord each',
    blurb: 'Search one perfume and read its notes against the whole catalogue.',
    mark: 'perfume',
  },
  {
    slug: 'builder',
    to: '/builder',
    label: 'Builder',
    stat: '1,136 notes · stack them',
    blurb: 'Pin the notes you like and see every perfume carrying all of them.',
    mark: 'builder',
  },
];

const CARDS = [...WHEEL_LIST.map((wheel) => ({ ...wheel, to: `/wheel/${wheel.slug}` })), ...TOOLS];

const WAYS_IN = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

/**
 * Marks for the two cards that have no wheel to draw.
 *
 * Both are line-only and inherit the orbit's drift, so they sit in the same
 * rhythm as the four live wheels beside them without pretending to be one.
 */
/** An annular wedge — the one shape a sunburst is made of. */
function wedge(from, to, inner, outer) {
  const p = (angle, r) => [100 + Math.cos(angle) * r, 100 + Math.sin(angle) * r];
  const big = to - from > Math.PI ? 1 : 0;
  const [ax, ay] = p(from, outer);
  const [bx, by] = p(to, outer);
  const [cx, cy] = p(to, inner);
  const [dx, dy] = p(from, inner);
  return `M${ax} ${ay}A${outer} ${outer} 0 ${big} 1 ${bx} ${by}L${cx} ${cy}A${inner} ${inner} 0 ${big} 0 ${dx} ${dy}Z`;
}

/**
 * Marks for the two cards that have no wheel to draw.
 *
 * Neither is decoration. The Venn IS the operation the builder performs, and
 * the sunburst is the ring stack the perfume page actually draws — tier at the
 * centre, family, then one wedge per note at the rim, in the page's own tier
 * colours. Both are line-and-fill only and inherit the orbit's drift, so they
 * keep the rail's rhythm without pretending to be live wheels.
 */
function ToolMark({ kind }) {
  const line = 'rgba(241, 242, 243, 0.32)';
  const warm = 'rgba(246, 197, 58, 0.55)';

  if (kind === 'builder') {
    // Three overlapping sets, the middle one lit: an intersection.
    return (
      <svg className="toolMark" viewBox="0 0 200 200" role="presentation">
        <circle cx="76" cy="88" r="46" fill="none" stroke={line} />
        <circle cx="124" cy="88" r="46" fill="none" stroke={line} />
        <circle cx="100" cy="128" r="46" fill="none" stroke={line} />
        <path
          d="M100 54a46 46 0 0 1 0 68 46 46 0 0 1 0-68z"
          fill="rgba(246, 197, 58, 0.16)"
          stroke={warm}
        />
      </svg>
    );
  }

  // A twelve-note perfume: five top, four heart, three base — the tier split of
  // a real pyramid rather than three equal thirds. The family runs below are
  // deliberately 3/2/4/3, which does NOT line up with 5/4/3: family and tier
  // are overlapping memberships, not a nesting, and a mark that quietly made
  // them nest would be selling the diagram as tidier than it is.
  const TIERS = [
    { color: '#E6B422', notes: 5 },
    { color: '#E0689A', notes: 4 },
    { color: '#8A6A4F', notes: 3 },
  ];
  const total = TIERS.reduce((sum, tier) => sum + tier.notes, 0);
  const GAP = 0.03;
  const step = (Math.PI * 2) / total;

  // Real hues from the wheel's own family palette.
  const FAMILIES = [
    { color: '#E6B422', notes: 3 },
    { color: '#7FA650', notes: 2 },
    { color: '#E0689A', notes: 4 },
    { color: '#8A6A4F', notes: 3 },
  ];

  let slot = 0;
  const tierArcs = [];
  const noteArcs = [];
  TIERS.forEach(({ color, notes }) => {
    const from = slot * step - Math.PI / 2;
    const to = (slot + notes) * step - Math.PI / 2;
    tierArcs.push({ color, d: wedge(from + GAP, to - GAP, 40, 55) });
    for (let i = 0; i < notes; i += 1) {
      const a = (slot + i) * step - Math.PI / 2;
      noteArcs.push({ color, d: wedge(a + GAP, a + step - GAP, 78, 90) });
    }
    slot += notes;
  });

  slot = 0;
  const familyArcs = FAMILIES.map(({ color, notes }) => {
    const from = slot * step - Math.PI / 2;
    const to = (slot + notes) * step - Math.PI / 2;
    slot += notes;
    return { color, d: wedge(from + GAP, to - GAP, 60, 72) };
  });

  return (
    <svg className="toolMark" viewBox="0 0 200 200" role="presentation">
      {/* The ribbon disc the rings sit around. */}
      <circle cx="100" cy="100" r="34" fill="none" stroke={line} strokeDasharray="2 5" />
      {tierArcs.map((arc) => (
        <path key={arc.d} d={arc.d} fill={arc.color} opacity="0.85" />
      ))}
      {familyArcs.map((arc) => (
        <path key={arc.d} d={arc.d} fill={arc.color} opacity="0.6" />
      ))}
      {noteArcs.map((arc) => (
        <path key={arc.d} d={arc.d} fill={arc.color} opacity="0.55" />
      ))}
    </svg>
  );
}

export default function HomePage() {
  const [previews, setPreviews] = useState({});
  const [active, setActive] = useState(0);
  const railRef = useRef(null);
  const scrollFrame = useRef(null);

  useEffect(() => {
    let live = true;
    Promise.all(WHEEL_LIST.map((wheel) => getWheel(wheel.slug))).then((loaded) => {
      if (!live) return;
      setPreviews(Object.fromEntries(loaded.map((item) => [item.spec.slug, item])));
    });
    return () => {
      live = false;
      if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current);
    };
  }, []);

  const updateActiveCard = () => {
    if (scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      const rail = railRef.current;
      if (!rail) return;
      const centre = rail.scrollLeft + rail.clientWidth / 2;
      const cards = [...rail.children];
      const nearest = cards.reduce(
        (best, card, index) => {
          const cardCentre = card.offsetLeft + card.offsetWidth / 2;
          const distance = Math.abs(cardCentre - centre);
          return distance < best.distance ? { index, distance } : best;
        },
        { index: 0, distance: Infinity },
      );
      setActive(nearest.index);
    });
  };

  const showCard = (index) => {
    const rail = railRef.current;
    const card = rail?.children[index];
    if (!rail || !card) return;
    rail.scrollTo({
      left: card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2,
      behavior: 'smooth',
    });
  };

  return (
    <main className="homePage">
      <header className="homeHeader">
        {/* Counted, not typed. It read "Three ways in" over four wheels for a
            while, which is the failure mode of writing a number into prose. */}
        <h1>{WAYS_IN[CARDS.length] ?? CARDS.length} ways in</h1>
        <p className="homeCount">24,059 fragrances</p>
      </header>

      <section
        className="previewRail"
        ref={railRef}
        onScroll={updateActiveCard}
        aria-label="Choose a fragrance map"
      >
        {CARDS.map((card, index) => {
          const loaded = previews[card.slug];
          return (
            <Link
              className={`previewCard previewCard--${index + 1}`}
              key={card.slug}
              to={card.to}
              aria-label={`${card.label}: ${card.blurb}`}
            >
              <div className="previewOrbit" aria-hidden="true">
                {card.mark ? (
                  <ToolMark kind={card.mark} />
                ) : loaded ? (
                  <ChordWheel
                    spec={loaded.spec}
                    view={{ data: loaded.data, ...loaded.spec.defaults }}
                    sticky={{}}
                    hovered={{}}
                    minShared={card.previewThreshold}
                    note={null}
                    interactive={false}
                    pixelRatio={1.25}
                    buildThreshold={card.previewThreshold}
                  />
                ) : (
                  <span className="previewPlaceholder" />
                )}
              </div>
              <div className="previewCopy">
                <h2>{card.label}</h2>
                <p>{card.stat}</p>
              </div>
            </Link>
          );
        })}
      </section>

      <div className="carouselDots" aria-label="Fragrance map slides">
        {CARDS.map((card, index) => (
          <button
            key={card.slug}
            type="button"
            className={active === index ? 'on' : ''}
            aria-label={`Show ${card.label}`}
            aria-current={active === index ? 'true' : undefined}
            onClick={() => showCard(index)}
          />
        ))}
      </div>
    </main>
  );
}
