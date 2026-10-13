import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import NewsletterModal from './NewsletterModal';
import SearchInterstitial from './SearchInterstitial';
import site from '../site.config';

/**
 * The only nav item: a Support menu that opens on hover where a pointer can
 * hover, and on tap/click everywhere else. Kept as a button so keyboards and
 * screen readers get the same menu the mouse does.
 */
function SupportMenu({ dataHref }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Hover only opens the menu where hovering is a real gesture; on touch the
  // synthetic mouseenter would fight the tap that follows it.
  const canHover = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

  // On a hover device the pointer has already opened the menu by the time a
  // click lands, so a plain toggle would flicker it shut. Keyboard-triggered
  // clicks (detail 0) still toggle.
  const handleClick = (e) => {
    if (canHover() && e.detail > 0) setOpen(true);
    else setOpen((v) => !v);
  };

  return (
    <div
      className="navMenu"
      ref={wrapRef}
      onMouseEnter={() => canHover() && setOpen(true)}
      onMouseLeave={() => canHover() && setOpen(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="navMenuButton"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={handleClick}
      >
        Support
        <span className="navMenuCaret" aria-hidden="true" />
      </button>
      <div className="navMenuPanel" hidden={!open}>
        {site.support.map((link) => (
          <a
            key={link.href}
            className="navMenuItem"
            href={link.label === 'Data' && dataHref ? dataHref : link.href}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Page chrome: a thin nav over whatever the route renders, plus the two
 * overlays, which live here so any route can raise them. Each wheel supplies
 * its own header and footer, so this stays deliberately bare.
 */
export default function Layout({ children }) {
  const coffeeDraft = useLocation().pathname === '/coffee';
  return (
    <div className="wrap">
      <header className="siteNav">
        <Link className="wordmark" to="/" aria-label={`${site.brand}, home`}>
          gourmet<span>data</span>
        </Link>
        <nav aria-label="Site navigation">
          <SupportMenu
            dataHref={coffeeDraft ? 'https://github.com/datascopeanalytics/coffee-blog' : undefined}
          />
        </nav>
      </header>
      {children}
      {!coffeeDraft && <NewsletterModal />}
      {!coffeeDraft && <SearchInterstitial />}
    </div>
  );
}
