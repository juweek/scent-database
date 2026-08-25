import { Link } from 'react-router-dom';
import site from '../site.config';

/**
 * Page chrome: a thin nav over whatever the route renders. Each wheel supplies
 * its own header and footer, so this stays deliberately bare.
 */
export default function Layout({ children }) {
  return (
    <div className="wrap">
      <header className="siteNav">
        <Link className="wordmark" to="/" aria-label={`${site.title}, home`}>
          <span className="wordmarkMark" aria-hidden="true" />
          Scent chords
        </Link>
        <nav aria-label="Site navigation">
          <Link to="/">Wheels</Link>
          <Link to="/#method">Method</Link>
          <a href={site.attribution.sourceUrl} target="_blank" rel="noreferrer">
            Data
          </a>
        </nav>
      </header>
      {children}
    </div>
  );
}
