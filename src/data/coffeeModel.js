export function coffeeModel(records, vocabulary, minimum = 5) {
  const names = vocabulary.map((n) => n.name);
  const totals = Object.fromEntries(names.map((n) => [n, 0]));
  const counts = names.map(() => names.map(() => 0));
  const index = new Map(names.map((n, i) => [n, i]));
  for (const record of records) {
    const notes = [...new Set(record.notes)].filter((n) => index.has(n));
    notes.forEach((n) => totals[n]++);
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        counts[index.get(notes[i])][index.get(notes[j])]++;
        counts[index.get(notes[j])][index.get(notes[i])]++;
      }
    }
  }
  const pairs = [];
  names.forEach((a, i) =>
    names.slice(i + 1).forEach((b, offset) => {
      const count = counts[i][i + 1 + offset];
      if (count >= minimum)
        pairs.push({
          source: a,
          target: b,
          count,
          lift: (count * records.length) / (totals[a] * totals[b]),
        });
    }),
  );
  return { names, totals, pairs, counts };
}
