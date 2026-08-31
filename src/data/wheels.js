/**
 * THE THREE WHEELS. Each is baked static JSON (no API, no key, nothing to keep
 * alive) plus a spec in src/wheels/ describing its bands, controls, and
 * readout. Adding a fourth wheel = one JSON + one spec + one entry here.
 *
 * Both the JSON and the spec are dynamic-imported, so a visitor downloads only
 * the wheel they open (accord ~117 KB, pyramid ~135 KB, family ~2 KB).
 */

const load = {
  accord: () => Promise.all([import('./wheels/accord.json'), import('../wheels/accord')]),
  family: () => Promise.all([import('./wheels/family.json'), import('../wheels/family')]),
  pyramid: () => Promise.all([import('./wheels/pyramid.json'), import('../wheels/pyramid')]),
  accords: () => Promise.all([import('./wheels/accords.json'), import('../wheels/accords')]),
};

export const WHEELS = {
  accord: {
    slug: 'accord',
    label: 'Notes',
    title: 'Accord wheel',
    blurb: 'Every pairing between the 140 most common notes.',
    stat: '140 notes · 1.2m pairings',
    previewThreshold: 150,
  },
  family: {
    slug: 'family',
    label: 'Families',
    title: 'Family wheel',
    blurb: 'The ten scent families, and how much each bridges to the others.',
    stat: '10 families · 55 bridges',
    previewThreshold: 0,
  },
  accords: {
    slug: 'accords',
    label: 'Accords',
    title: 'Accords wheel',
    blurb: "Fragrantica's own vocabulary — aquatic, mossy, animalic — and what pairs with what.",
    stat: '56 accords · 1.7k pairings',
    previewThreshold: 600,
  },
  pyramid: {
    slug: 'pyramid',
    label: 'Pyramid',
    title: 'Pyramid wheel',
    blurb: 'Top, heart, and base — a wheel for each layer, with accords nested inside families.',
    stat: 'top · heart · base',
    previewThreshold: 40,
  },
};

export const WHEEL_LIST = Object.values(WHEELS);

/** Loader for useAsync: takes a wheel slug, resolves its data and spec. */
export async function getWheel(slug) {
  if (!load[slug]) throw new Error(`No wheel named "${slug}".`);
  const [data, spec] = await load[slug]();
  return { data: data.default, spec: spec.default };
}
