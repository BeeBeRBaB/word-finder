// node vendor.mjs <one-colour-dir> <flat-colour-dir> — copies the Fluent Emoji drawings the iconmap uses
// into fluent-emoji.json (one colour, in currentColor) and fluent-emoji-flat.json (flat colour).
// The dirs are @iconify-json/fluent-emoji-high-contrast and @iconify-json/fluent-emoji-flat unpacked:
// `npm pack` each into an empty folder and untar it there. Nothing is installed. Run
// ../iconmap/emit.mjs afterwards.
import fs from 'node:fs';
import path from 'node:path';

const [mono, flat] = process.argv.slice(2);
if (!mono || !flat) {
  console.error('usage: node vendor.mjs <unpacked fluent-emoji-high-contrast> <unpacked fluent-emoji-flat>');
  process.exit(1);
}
const dir = new URL('.', import.meta.url).pathname;
const mapDir = new URL('../iconmap/', import.meta.url).pathname;

/** @typedef {{icons:Record<string,{body:string,width?:number,height?:number}>, aliases?:Record<string,{parent:string}>, width?:number, height?:number}} IconSet */
/** @param {string} p @returns {IconSet} */
function load(p) {
  const root = fs.existsSync(path.join(p, 'package', 'icons.json')) ? path.join(p, 'package') : p;
  return JSON.parse(fs.readFileSync(path.join(root, 'icons.json'), 'utf8'));
}

/** The drawing on 32x32 with nothing it points at elsewhere: a whole-square clip and a drop shadow
 * dropped (the viewBox clips already), an inside stroke drawn through a mask as a stroke half as wide,
 * a reused path written out where it is used, and a gradient as its first colour.
 * @param {IconSet} set @param {string} name @returns {string} */
function body(set, name) {
  const icon = set.icons[name] ?? set.icons[set.aliases?.[name]?.parent ?? ''];
  if (!icon) throw new Error('not in the set');
  let b = icon.body
    .replace(/<clipPath id="[^"]+"><path fill="#fff" d="M0 [.\d]*h32v32H0z"\/><\/clipPath>/g, '')
    .replace(/ (?:clip-path|filter)="url\(#[^"]+\)"/g, '')
    .replace(/<mask id="[^"]+"[^>]*>[\s\S]*?<\/mask>/g, '')
    .replace(/ stroke-width="2"([^>]*) mask="url\(#[^"]+\)"/g, ' stroke-width="1"$1');
  /** @type {Map<string, string>} */
  const reused = new Map();
  for (const m of b.matchAll(/<path id="([^"]+)"([^>]*)\/>/g)) reused.set(m[1], `<path${m[2]}/>`);
  for (const m of b.matchAll(/<(?:linear|radial)Gradient id="([^"]+)"[^>]*>\s*<stop[^>]*stop-color="([^"]+)"/g)) reused.set(`fill:${m[1]}`, m[2]);
  b = b.replace(/<use href="#([^"]+)"\/>/g, (_, id) => reused.get(id) ?? _)
    .replace(/fill="url\(#([^"]+)\)"/g, (_, id) => (reused.has(`fill:${id}`) ? `fill="${reused.get(`fill:${id}`)}"` : _))
    .replace(/<defs>[\s\S]*?<\/defs>/g, '');
  if (/url\(|href|<defs|<mask|<use|<filter|style|id=|'/.test(b)) throw new Error('uses masks, filters or references');
  const w = icon.width ?? set.width ?? 32, h = icon.height ?? set.height ?? 32;
  if (w === 32 && h === 32) return b;
  const k = 32 / Math.max(w, h), r = (/** @type {number} */ v) => Math.round(v * 1000) / 1000;
  return `<g transform="translate(${r((32 - w * k) / 2)} ${r((32 - h * k) / 2)}) scale(${r(k)})">${b}</g>`;
}

const names = new Set();
for (const f of fs.readdirSync(mapDir).filter(f => /^[a-z]+\.json$/.test(f))) {
  const m = JSON.parse(fs.readFileSync(mapDir + f, 'utf8'));
  if (!m.subjects) continue;
  for (const v of [m.category, ...Object.values(m.subjects)]) for (const n of v) names.add(n);
}
const bad = [];
for (const [src, file] of [[mono, 'fluent-emoji.json'], [flat, 'fluent-emoji-flat.json']]) {
  const set = load(src);
  /** @type {Record<string, string>} */
  const out = {};
  for (const n of [...names].sort()) {
    try { out[n] = body(set, n); } catch (e) { bad.push(`${file}: ${n}: ${/** @type {Error} */ (e).message}`); }
  }
  if (!bad.length) fs.writeFileSync(dir + file, JSON.stringify(out, null, 1) + '\n');
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`${names.size} drawings written to fluent-emoji.json and fluent-emoji-flat.json`);
