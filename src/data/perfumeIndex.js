/**
 * The record-level perfume index — search, and one perfume's full profile.
 *
 * Baked by scripts/pipeline/perfume_index.py. Two fetches at most: a search
 * shard (one per initial letter, and a perfume is filed under both its name's
 * and its brand's) and a record shard (256 of them, keyed by a hash of the id).
 *
 * A record is deliberately self-sufficient — it carries its own note totals,
 * its own pair counts, and its neighbours' names — so rendering the whole page
 * costs one round trip rather than five. See the baker's docstring.
 */

const BASE = `${import.meta.env.BASE_URL}data/perfumes/`;

const searchShards = new Map();
const recordShards = new Map();
let metaPromise = null;

/** Mirror of the baker's search_key(): first alphanumeric, digits share '0'. */
function shardKey(text) {
  for (const char of (text || '').toLowerCase()) {
    if (/[a-z]/.test(char)) return char;
    if (/[0-9]/.test(char)) return '0';
  }
  return '0';
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

/** Catalogue-wide facts the lift calculation needs. Fetched once. */
export function getMeta() {
  if (!metaPromise) {
    metaPromise = fetchJson(`${BASE}meta.json`).catch((error) => {
      metaPromise = null;
      throw error;
    });
  }
  return metaPromise;
}

async function loadSearchShard(key, signal) {
  if (searchShards.has(key)) return searchShards.get(key);
  const rows = (await fetchJson(`${BASE}search/${key}.json`, signal)) || [];
  const parsed = rows.map(([id, name, brand, year]) => ({
    id,
    name,
    brand,
    year: year || null,
  }));
  searchShards.set(key, parsed);
  return parsed;
}

/**
 * Typeahead over 24,050 perfumes without shipping a 24,050-row index.
 *
 * The first letter picks the shard, so "cha" fetches one file and filters it in
 * memory. Matches on name or brand; a hit in the name outranks a hit in the
 * brand, and a prefix outranks a substring, so typing "chanel" surfaces the
 * house rather than the twelve unrelated perfumes with "chanel" late in a name.
 */
export async function searchPerfumes(query, signal, limit = 40) {
  const trimmed = (query || '').trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const rows = await loadSearchShard(shardKey(trimmed), signal);
  const scored = [];
  for (const row of rows) {
    const name = row.name.toLowerCase();
    const brand = row.brand.toLowerCase();
    let rank = null;
    if (name.startsWith(trimmed)) rank = 0;
    else if (brand.startsWith(trimmed)) rank = 1;
    else if (name.includes(trimmed)) rank = 2;
    else if (brand.includes(trimmed)) rank = 3;
    if (rank !== null) scored.push([rank, row]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length);
  return scored.slice(0, limit).map(([, row]) => row);
}

async function loadRecordShard(shard, signal) {
  if (recordShards.has(shard)) return recordShards.get(shard);
  const group = (await fetchJson(`${BASE}record/${shard}.json`, signal)) || {};
  recordShards.set(shard, group);
  return group;
}

/**
 * blake2s with a 1-byte digest, matching the baker's shard_of().
 *
 * Ported rather than imported: the alternative is a crypto dependency for what
 * is two dozen lines, and SubtleCrypto offers no blake2. Only the first output
 * byte is needed, but blake2s has no shortcut for that — the full compression
 * still runs, on strings of at most a few characters.
 */
const IV = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];
const SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
];

function rotr(x, n) {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

export function shardOf(id) {
  const bytes = new TextEncoder().encode(id);
  const h = IV.slice();
  h[0] = (h[0] ^ 0x01010000 ^ 1) >>> 0; // digest_size = 1, no key

  const block = new Uint8Array(64);
  block.set(bytes.subarray(0, 64));
  const m = new Uint32Array(16);
  for (let i = 0; i < 16; i += 1) {
    m[i] =
      (block[i * 4] |
        (block[i * 4 + 1] << 8) |
        (block[i * 4 + 2] << 16) |
        (block[i * 4 + 3] << 24)) >>>
      0;
  }

  const v = h.concat(IV);
  v[12] = (v[12] ^ bytes.length) >>> 0;
  v[14] = ~v[14] >>> 0; // final block

  const mix = (a, b, c, d, x, y) => {
    v[a] = (v[a] + v[b] + x) >>> 0;
    v[d] = rotr(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = rotr(v[b] ^ v[c], 12);
    v[a] = (v[a] + v[b] + y) >>> 0;
    v[d] = rotr(v[d] ^ v[a], 8);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = rotr(v[b] ^ v[c], 7);
  };

  for (let round = 0; round < 10; round += 1) {
    const s = SIGMA[round];
    mix(0, 4, 8, 12, m[s[0]], m[s[1]]);
    mix(1, 5, 9, 13, m[s[2]], m[s[3]]);
    mix(2, 6, 10, 14, m[s[4]], m[s[5]]);
    mix(3, 7, 11, 15, m[s[6]], m[s[7]]);
    mix(0, 5, 10, 15, m[s[8]], m[s[9]]);
    mix(1, 6, 11, 12, m[s[10]], m[s[11]]);
    mix(2, 7, 8, 13, m[s[12]], m[s[13]]);
    mix(3, 4, 9, 14, m[s[14]], m[s[15]]);
  }

  const first = (h[0] ^ v[0] ^ v[8]) >>> 0;
  return (first & 0xff).toString(16).padStart(2, '0');
}

/** One perfume, complete. */
export async function getPerfume(id, signal) {
  const group = await loadRecordShard(shardOf(id), signal);
  return group[id] || null;
}

/** Expand the stored upper triangle into a symmetric lookup. */
export function pairMatrix(record) {
  const n = record.notes.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  let k = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1, k += 1) {
      const value = record.pairs[k] || 0;
      matrix[i][j] = value;
      matrix[j][i] = value;
    }
  }
  return matrix;
}

/**
 * How much more often this pair occurs than chance predicts, catalogue-wide.
 * Identical arithmetic to the note wheel's lift, so the two tabs agree.
 */
export function liftOf(record, counts, i, j, population) {
  const expected = (record.total[i] * record.total[j]) / population;
  return expected > 0 ? counts[i][j] / expected : 0;
}

export const TIER_LABEL = ['top', 'heart', 'base'];
