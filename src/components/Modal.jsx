import { useEffect, useRef } from 'react';

/**
 * How many modals are mounted right now.
 *
 * Three different things can raise a wall — the search interstitial, the
 * subscribe gate, the signup offer — and they do not know about each other.
 * A reader whose seventh search is also their seventh of the day would get two
 * stacked dialogs, each trapping focus, which is worse than either alone. The
 * interstitial checks this before it opens; a gate the reader asked for always
 * wins, because it is a response to something they just clicked.
 */
let openModals = 0;

export function isModalOpen() {
  return openModals > 0;
}

/**
 * The shell both overlays share: a dimmed backdrop, Escape and click-out to
 * leave, the page frozen behind it, and focus moved in and then put back where
 * it came from. Nothing about what is inside.
 */
export default function Modal({ label, onClose, children, tone = 'default' }) {
  const panelRef = useRef(null);
  const returnTo = useRef(null);
  // Held in a ref so the setup effect below can depend on NOTHING. Every caller
  // passes an inline arrow, so `onClose` is a new function on every render —
  // as an effect dependency it re-ran the whole setup on each keystroke, and
  // the panel.focus() inside stole focus back from whatever input was being
  // typed into. On a phone that closed the keyboard after every character.
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    openModals += 1;
    returnTo.current = document.activeElement;
    panelRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      // Hold Tab inside the panel. Without this the first Tab lands on the
      // page behind, which screen readers then read out as if it were live.
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, iframe, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      openModals = Math.max(0, openModals - 1);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Only steal focus back if it is still parked in the panel we are tearing
      // down — otherwise we would yank it off whatever the user just clicked.
      if (panelRef.current?.contains(document.activeElement)) returnTo.current?.focus?.();
    };
    // Deliberately empty: this runs once per mount. See closeRef above.
  }, []);

  return (
    <div
      className="modalScrim"
      data-tone={tone}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modalPanel"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={panelRef}
      >
        <button type="button" className="modalClose" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
