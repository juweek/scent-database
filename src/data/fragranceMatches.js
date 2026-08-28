const cache = new Map();

/**
 * Filename for a note's partition.
 *
 * The baker writes these with Python's quote(), which escapes !~*'() where
 * encodeURIComponent leaves them alone — so "agarwood (oud)" is on disk as
 * agarwood_20_28oud_29.json. Escaping those extra characters ourselves keeps
 * the two sides in step; without it those notes 404 into an empty list.
 */
export function fileKey(note) {
  const encoded = encodeURIComponent(note).replace(
    /[!~*'()]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return encoded.replaceAll('%', '_');
}

export async function getSharedFragrances(source, target, signal) {
  const [first, second] = [source, target].sort();
  const cacheKey = `${first}\u0000${second}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `${import.meta.env.BASE_URL}data/fragrances/by-note/${fileKey(first)}.json`;
  const response = await fetch(url, { signal });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Fragrance index returned ${response.status}`);

  const partners = await response.json();
  const matches = (partners[second] || []).map(([name, brand, rating, url]) => ({
    name,
    brand,
    rating,
    url,
  }));
  cache.set(cacheKey, matches);
  return matches;
}
