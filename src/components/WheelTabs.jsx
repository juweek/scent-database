import { Link, useLocation } from 'react-router-dom';
import { WHEEL_LIST } from '../data/wheels';

/**
 * The tab strip under every explorer. Lives here rather than inside WheelPage
 * because /perfume is not a wheel — it has its own page and its own data — but
 * it belongs in the same row of tabs.
 */
export default function WheelTabs() {
  const { pathname } = useLocation();
  const tabs = [
    ...WHEEL_LIST.map((wheel) => ({ to: `/wheel/${wheel.slug}`, label: wheel.label })),
    { to: '/perfume', label: 'Perfume' },
  ];

  return (
    <nav className="wheelTabs" aria-label="Fragrance views">
      {tabs.map((tab) => (
        <Link key={tab.to} to={tab.to} aria-current={pathname === tab.to ? 'page' : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
