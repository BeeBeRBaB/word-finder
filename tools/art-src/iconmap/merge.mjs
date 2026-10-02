// node merge.mjs — folds newly drawn icons into the subject map, and rebuilds index.txt.
// Each wishlist icon that now exists in icons/part*.json goes in front of the icons of every
// subject that asked for it (most-requested first), capped at 6. Re-running changes nothing.
import fs from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const iconDir = new URL('../icons/', import.meta.url).pathname;
// Round-2 skips: the same object was drawn under another id.
const ALIAS = { 'paint-palette': 'palette', envelope: 'invitation-card' };

/** @type {Map<string, string>} id -> motif */
const drawn = new Map();
for (const f of fs.readdirSync(iconDir).filter(f => /^part\d+\.json$/.test(f)))
  for (const it of JSON.parse(fs.readFileSync(iconDir + f, 'utf8'))) drawn.set(it.id, it.motif);

/** @type {Map<string, string[]>} subject -> new icons, in wishlist rank order */
const wanted = new Map();
for (const w of JSON.parse(fs.readFileSync(dir + 'wishlist.json', 'utf8'))) {
  const id = ALIAS[w.id] ?? w.id;
  if (!drawn.has(id)) continue;
  for (const s of w.subjects) { const l = wanted.get(s) ?? []; if (!l.includes(id)) l.push(id); wanted.set(s, l); }
}

let changed = 0;
const seen = new Set();
for (const f of fs.readdirSync(dir).filter(f => /^[a-z]+\.json$/.test(f) && f !== 'wishlist.json' && !f.startsWith('round'))) {
  const text = fs.readFileSync(dir + f, 'utf8');
  // Rewrites only the subject entries, one per line, so the category and wishlist blocks stay
  // byte-identical.
  const out = text.replace(/^( {4}"([a-z]+\/[a-z0-9-]+)": )(\[[^\]]*\])(,?)$/gm, (line, head, s, arr, comma) => {
    seen.add(s);
    const next = [...new Set([...(wanted.get(s) ?? []), ...JSON.parse(arr)])].slice(0, 6);
    return `${head}${JSON.stringify(next).replace(/","/g, '", "')}${comma}`;
  });
  if (out !== text) { fs.writeFileSync(dir + f, out); changed++; }
}
const missing = [...wanted.keys()].filter(s => !seen.has(s));
if (missing.length) { console.error(`wishlist subjects not in any map: ${missing.join(', ')}`); process.exit(1); }

const index = new Map(fs.readFileSync(dir + 'index.txt', 'utf8').trim().split('\n').map(l => {
  const k = l.indexOf(': '); return [l.slice(0, k), l.slice(k + 2)];
}));
for (const [id, motif] of drawn) if (!index.has(id)) index.set(id, motif);
fs.writeFileSync(dir + 'index.txt', [...index].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n');
console.log(`${wanted.size} subjects take new icons; ${changed} map files changed; index has ${index.size} icons`);
