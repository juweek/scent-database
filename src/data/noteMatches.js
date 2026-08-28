/**
 * Record-level perfumes for ONE note, and for that note crossed with a scent
 * family — the two lists the note search and the family bars ask for.
 *
 * The pair index (fragranceMatches.js) stores each pair once, under the
 * alphabetically-first note, so it cannot answer "which perfumes have this
 * note" without touching ~192 files. scripts/pipeline/note_index.py inverts it
 * into these per-note files ahead of time.
 *
 * Page 1 (~3 KB gzipped) carries the headline list and the top of every family.
 * Page 2 holds the long tail and is fetched only when a reader opens one.
 */

import { fileKey } from './fragranceMatches';

const pages = new Map();

function rows(list = []) {
  return list.map(([name, brand, rating, url]) => ({ name, brand, rating, url }));
}

async function fetchPage(note, suffix, signal) {
  const cacheKey = `${note} ${suffix}`;
  if (pages.has(cacheKey)) return pages.get(cacheKey);

  const base = `${import.meta.env.BASE_URL}data/fragrances/by-note-index/`;
  const response = await fetch(`${base}${fileKey(note)}${suffix}.json`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Note index returned ${response.status}`);

  const body = await response.json();
  pages.set(cacheKey, body);
  return body;
}

/** Page 1: totals, the headline list, and the top slice of every family. */
export async function getNotePerfumes(note, signal) {
  const page = await fetchPage(note, '', signal);
  if (!page) return null;
  return {
    note: page.note,
    // `total` is how many perfumes carry the note; `held` is how many records
    // the index actually keeps. They differ once a note is popular enough to
    // hit the baker's cap, and the UI has to say so rather than promise rows
    // it cannot deliver.
    total: page.total,
    held: page.held ?? page.all.length,
    hasMore: page.hasMore,
    all: rows(page.all),
    families: Object.fromEntries(
      Object.entries(page.families).map(([family, value]) => [
        family,
        { total: value.total, held: value.held ?? value.top.length, items: rows(value.top) },
      ]),
    ),
  };
}

/** Page 2: everything page 1 truncated. Only fetched on demand. */
export async function getNotePerfumesRest(note, signal) {
  const page = await fetchPage(note, '.2', signal);
  if (!page) return { all: [], families: {} };
  return {
    all: rows(page.all),
    families: Object.fromEntries(
      Object.entries(page.families || {}).map(([family, list]) => [family, rows(list)]),
    ),
  };
}
