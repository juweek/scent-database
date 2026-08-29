import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import site from '../site.config';

const SUPPORT_LINKS = [
  { label: 'Donate', href: 'https://ko-fi.com/gourmetmedia' },
  { label: 'Follow', href: 'https://juweek.studio/' },
];

/**
 * "Support" nav item: a two-link menu that opens on hover where a pointer can
 * hover, and on tap/click everywhere else. Kept as a button so keyboards and
 * screen readers get the same menu the mouse does.
 */
function SupportMenu() {
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
        {SUPPORT_LINKS.map((link) => (
          <a
            key={link.href}
            className="navMenuItem"
            href={link.href}
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
          <a href={site.attribution.sourceUrl} target="_blank" rel="noreferrer">
            Data
          </a>
          <SupportMenu />
        </nav>
      </header>
      {children}
    </div>
  );
}
