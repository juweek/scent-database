import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWheel, WHEEL_LIST } from '../data/wheels';
import ChordWheel from '../viz/ChordWheel';
import site from '../site.config';

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
        <p className="eyebrow">Explore the architecture of scent</p>
        <h1>Three ways in</h1>
        <p className="homeCount">24,059 fragrances</p>
      </header>

      <section
        className="previewRail"
        ref={railRef}
        onScroll={updateActiveCard}
        aria-label="Choose a fragrance map"
      >
        {WHEEL_LIST.map((wheel, index) => {
          const loaded = previews[wheel.slug];
          return (
            <Link
              className={`previewCard previewCard--${index + 1}`}
              key={wheel.slug}
              to={`/wheel/${wheel.slug}`}
              aria-label={`Explore by ${wheel.label.toLowerCase()}: ${wheel.blurb}`}
            >
              <div className="previewOrbit" aria-hidden="true">
                {loaded ? (
                  <ChordWheel
                    spec={loaded.spec}
                    view={{ data: loaded.data, ...loaded.spec.defaults }}
                    sticky={{}}
                    hovered={{}}
                    minShared={wheel.previewThreshold}
                    note={null}
                    interactive={false}
                    pixelRatio={1.25}
                    buildThreshold={wheel.previewThreshold}
                  />
                ) : (
                  <span className="previewPlaceholder" />
                )}
              </div>
              <div className="previewCopy">
                <h2>{wheel.label}</h2>
                <p>{wheel.stat}</p>
              </div>
            </Link>
          );
        })}
      </section>

      <div className="carouselDots" aria-label="Fragrance map slides">
        {WHEEL_LIST.map((wheel, index) => (
          <button
            key={wheel.slug}
            type="button"
            className={active === index ? 'on' : ''}
            aria-label={`Show ${wheel.label}`}
            aria-current={active === index ? 'true' : undefined}
            onClick={() => showCard(index)}
          />
        ))}
      </div>

      <section className="homeMethod" id="method">
        <p className="fieldLabel">How to read it</p>
        <p>
          Every ribbon connects two notes found in the same perfume. Width shows how often the
          pairing occurs; colour follows scent family. Choose a wheel, then tap or hover to dig in.
        </p>
      </section>

      <footer className="wheelFooter">{site.attribution.note}</footer>
    </main>
  );
}
