// node check.mjs <category> — validates iconmap/<category>.json against the icon index and the category's subjects.
import fs from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const ids = new Set(fs.readFileSync(dir + 'index.txt', 'utf8').trim().split('\n').map(l => l.split(':')[0]));
const cat = process.argv[2];
const mod = await import(new URL(`../../../src/subjects/${cat}.js`, import.meta.url).href);
const pool = mod.WORDS;
const subjects = Object.keys(pool).filter(k => k.startsWith(cat + '/'));
const map = JSON.parse(fs.readFileSync(`${dir}${cat}.json`, 'utf8'));
const errs = [];
for (const s of subjects) {
  const v = map.subjects?.[s];
  if (!Array.isArray(v)) { errs.push(`${s}: missing`); continue; }
  if (v.length < 4 || v.length > 6) errs.push(`${s}: ${v.length} icons (need 4-6)`);
  const bad = v.filter(i => !ids.has(i)); if (bad.length) errs.push(`${s}: unknown ${bad.join(',')}`);
  if (new Set(v).size !== v.length) errs.push(`${s}: duplicate icon`);
}
for (const s of Object.keys(map.subjects ?? {})) if (!subjects.includes(s)) errs.push(`${s}: not a subject of ${cat}`);
const cv = map.category ?? [];
if (cv.length < 4 || cv.length > 6 || cv.some(i => !ids.has(i))) errs.push(`category: needs 4-6 known icons`);
console.log(errs.length ? errs.join('\n') : `ok ${cat}: ${subjects.length} subjects`);
process.exit(errs.length ? 1 : 0);
