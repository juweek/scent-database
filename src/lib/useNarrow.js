import { useEffect, useState } from 'react';

/**
 * True on the narrow layout — the same 720px the stylesheet breaks at.
 *
 * Used where a layout difference cannot be expressed in CSS because the two
 * elements swapping places live in different containers, and `order` only
 * works between siblings. Rendering them in different slots per breakpoint
 * keeps ONE of each in the DOM; the alternative, rendering both and hiding
 * one, would put two copies of a <nav> in the accessibility tree.
 */
const QUERY = '(max-width: 720px)';

export function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia?.(QUERY);
    if (!mql) return undefined;
    const onChange = (event) => setNarrow(event.matches);
    setNarrow(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return narrow;
}
