/**
 * The Note Builder's index: which perfumes carry which notes, both ways round.
 *
 * Baked by scripts/pipeline/builder_index.py. Two things about its shape drive
 * everything here:
 *
 *   • A perfume's index IS its quality rank — 0 is the best-rated-and-reviewed
 *     record in the catalogue. Posting lists are built in that order, so an
 *     intersection comes out best-first without a sort, and "the first page"
 *     is just the front of the array.
 *   • Posting lists are gap-encoded, so they have to be walked once on load.
 *
 * Everything the filter and the suggestion list need lives in this one file
 * (~210 KB gzipped). The perfume NAMES are sharded separately and fetched a
 * page at a time — see getCards.
 */

let indexPromise = null;
const cardShards = new Map();

/** Fetch, decode and pivot the index. Cached: the work happens once per tab. */
export function getBuilderIndex() {
  if (!indexPromise) {
    indexPromise = fetch(`${import.meta.env.BASE_URL}data/builder/index.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Builder index returned ${response.status}`);
        return response.json();
      })
      .then(decode)
      .catch((error) => {
        // A failed fetch must not poison the cache, or every retry in this tab
        // resolves to the same rejection.
        indexPromise = null;
        throw error;
      });
  }
  return indexPromise;
}

function decode(raw) {
  const postings = raw.postings.map((gaps) => {
    const list = new Int32Array(gaps.length);
    let running = 0;
    for (let i = 0; i < gaps.length; i += 1) {
      running += gaps[i];
      list[i] = running;
    }
    return list;
  });

  // The inverse map. Built once, because the suggestion list wants "the notes
  // of these 40 perfumes" and walking 235,000 postings to answer that on every
  // keystroke is the difference between instant and not.
  const noteCount = new Uint8Array(raw.perfumes);
  postings.forEach((list) => list.forEach((perfume) => (noteCount[perfume] += 1)));
  const notesOf = new Array(raw.perfumes);
  for (let i = 0; i < raw.perfumes; i += 1) notesOf[i] = new Int16Array(noteCount[i]);
  const filled = new Uint8Array(raw.perfumes);
  postings.forEach((list, note) =>
    list.forEach((perfume) => {
      notesOf[perfume][filled[perfume]] = note;
      filled[perfume] += 1;
    }),
  );

  return {
    perfumes: raw.perfumes,
    shard: raw.shard,
    notes: raw.notes,
    counts: raw.counts,
    indexOf: new Map(raw.notes.map((name, i) => [name, i])),
    postings,
    notesOf,
  };
}

/**
 * Perfumes carrying EVERY note in `selected` (note indices).
 *
 * Walks the shortest posting list and tests membership in the rest, so the
 * cost tracks the rarest note rather than the commonest. The result inherits
 * that list's order, which is quality order.
 */
export function intersect(index, selected) {
  if (!selected.length) return new Int32Array(0);
  const lists = selected.map((note) => index.postings[note]);
  lists.sort((a, b) => a.length - b.length);
  if (lists.length === 1) return lists[0];

  const others = lists.slice(1).map((list) => new Set(list));
  const out = [];
  for (let i = 0; i < lists[0].length; i += 1) {
    const perfume = lists[0][i];
    if (others.every((set) => set.has(perfume))) out.push(perfume);
  }
  return Int32Array.from(out);
}

/**
 * What else is in these perfumes.
 *
 * The point of the panel: having pinned rose and oud, which notes keep turning
 * up alongside them. Returns {note, count, share} sorted by count, with the
 * already-selected notes dropped.
 */
export function suggestions(index, matched, selected, limit = 24) {
  const selectedSet = new Set(selected);
  const tally = new Map();
  for (let i = 0; i < matched.length; i += 1) {
    const notes = index.notesOf[matched[i]];
    for (let j = 0; j < notes.length; j += 1) {
      const note = notes[j];
      if (selectedSet.has(note)) continue;
      tally.set(note, (tally.get(note) || 0) + 1);
    }
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([note, count]) => ({
      note,
      name: index.notes[note],
      count,
      share: matched.length ? count / matched.length : 0,
    }));
}

/**
 * Display rows for a slice of perfume indices.
 *
 * Only the shards those indices fall in are fetched, and a shard is kept once
 * fetched. Because indices are quality ranks, a first page is nearly always
 * inside shard 0.
 */
export async function getCards(index, perfumeIndices, signal) {
  const needed = [...new Set([...perfumeIndices].map((i) => Math.floor(i / index.shard)))];
  await Promise.all(needed.map((shard) => loadShard(shard, signal)));

  return [...perfumeIndices].map((perfume) => {
    const shard = cardShards.get(Math.floor(perfume / index.shard));
    const offset = perfume % index.shard;
    return {
      perfume,
      id: shard.id[offset],
      name: shard.name[offset],
      brand: shard.brands[shard.brand[offset]],
      rating: shard.rating[offset],
      ratings: shard.ratings[offset],
    };
  });
}

function loadShard(shard, signal) {
  if (cardShards.has(shard)) return Promise.resolve();
  return fetch(`${import.meta.env.BASE_URL}data/builder/cards/${shard}.json`, { signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Card shard ${shard} returned ${response.status}`);
      return response.json();
    })
    .then((body) => cardShards.set(shard, body));
}
