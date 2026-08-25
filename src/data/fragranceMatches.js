const cache = new Map();

function fileKey(note) {
  return encodeURIComponent(note).replaceAll('%', '_');
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
