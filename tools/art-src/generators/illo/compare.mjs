// Diffs group1-4.json (run gen1-4.mjs first) against ILLUSTRATIONS in src/art.js. Exit 1 on any mismatch.
import fs from 'node:fs';
const { ILLUSTRATIONS } = await import(new URL('../../../../src/art.js', import.meta.url).href);
// Number formatting differs in one shipped path (33.440 vs 33.44), so compare numbers by value.
const norm = s => s.replace(/-?\d*\.?\d+/g, v => String(Number(v)));
const seen = new Set(); let bad = 0;
for (const g of [1, 2, 3, 4]) {
  const items = JSON.parse(fs.readFileSync(new URL(`./group${g}.json`, import.meta.url), 'utf8'));
  for (const { id, svg } of items) {
    seen.add(id);
    const ok = ILLUSTRATIONS[id] !== undefined && norm(ILLUSTRATIONS[id]) === norm(svg);
    if (!ok) bad++;
    console.log(`${ok ? 'same' : 'DIFF'} group${g} ${id}`);
  }
}
for (const id of Object.keys(ILLUSTRATIONS)) if (!seen.has(id)) { bad++; console.log(`MISSING ${id} (no generator)`); }
process.exit(bad ? 1 : 0);
