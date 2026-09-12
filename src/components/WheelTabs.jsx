import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WHEEL_LIST } from '../data/wheels';

/**
 * The tab strip under every explorer. Lives here rather than inside WheelPage
 * because /perfume and /builder are not wheels — each has its own page and its
 * own data — but they belong in the same row of tabs.
 */
export default function WheelTabs({ lead = false }) {
  const { pathname } = useLocation();
  const navRef = useRef(null);
  const activeRef = useRef(null);

  const tabs = [
    ...WHEEL_LIST.map((wheel) => ({ to: `/wheel/${wheel.slug}`, label: wheel.label })),
    { to: '/perfume', label: 'Perfume' },
    { to: '/builder', label: 'Builder' },
  ];

  /**
   * Bring the current tab into view rather than reordering the strip.
   *
   * On a phone the six pills are wider than the screen, so "Builder" sits off
   * the right edge and the page you are on looks unselected. Moving the active
   * tab to the front would fix that and break something worse: the pills would
   * sit in a different order on every page, so the one you want is never twice
   * in the same place. Stable order, scrolled to you, is how native tab strips
   * behave and it is the reason you can learn where things are.
   *
   * scrollLeft rather than scrollIntoView, which would also scroll the PAGE
   * vertically to reach the strip.
   */
  useEffect(() => {
    const nav = navRef.current;
    const active = activeRef.current;
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const centred = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    nav.scrollLeft = Math.max(0, Math.min(centred, nav.scrollWidth - nav.clientWidth));
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      className={`wheelTabs${lead ? ' wheelTabs--lead' : ''}`}
      aria-label="Fragrance views"
    >
      {tabs.map((tab) => {
        const current = pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            ref={current ? activeRef : undefined}
            aria-current={current ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
