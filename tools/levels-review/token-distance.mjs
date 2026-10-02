// CIE76 distance of colour tokens from --accent and from --bg (each composited over --bg), for every
// palette x theme x mode with the cascade resolved: palette blocks inherit the tokens they leave out.
// Picked --pill-miss for the score card's negative bar; rerun it when a palette changes.
//   node tools/levels-review/token-distance.mjs [--pill-miss --muted ...]    cells read accent/bg
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const ALT = /^:root((?:\[data-(?:palette|theme|appearance)="[^"]+"\])*)$/;
const blocks = [];
for (const m of css.matchAll(/^(:root[^{]*)\{([^}]*)\}/gm)) {
  const alts = m[1].split(',').map((s) => s.trim().match(ALT));
  if (alts.some((a) => !a)) continue;   // :root[data-booting] and the like
  const attrs = alts.map((a) => Object.fromEntries([...a[1].matchAll(/data-(\w+)="([^"]+)"/g)].map((x) => [x[1], x[2]])));
  const tokens = Object.fromEntries([...m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)].map((x) => [x[1], x[2].trim()]));
  blocks.push({ attrs, tokens });
}
/** Tokens in force for one combination, merged in cascade order (specificity, then source order). */
function resolve(combo) {
  const hits = [];
  blocks.forEach((b, i) => {
    const spec = Math.max(-1, ...b.attrs.filter((a) => Object.entries(a).every(([k, v]) => combo[k] === v)).map((a) => Object.keys(a).length));
    if (spec >= 0) hits.push({ spec, i, tokens: b.tokens });
  });
  hits.sort((a, b) => a.spec - b.spec || a.i - b.i);
  return Object.assign({}, ...hits.map((h) => h.tokens));
}

const rgb = (v) => {
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1);
  m = v.match(/^rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
  return null;
};
const over = (c, bg) => c.slice(0, 3).map((x, i) => x * c[3] + bg[i] * (1 - c[3]));
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lab = ([r, g, b]) => {
  const [R, G, B] = [r, g, b].map(lin);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const dE = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };

const themes = [...new Set(blocks.flatMap((b) => b.attrs.map((a) => a.theme)).filter(Boolean)), 'phosphor'];
const palettes = ['classic', ...new Set(blocks.flatMap((b) => b.attrs.map((a) => a.palette)).filter(Boolean))];
const cands = process.argv.slice(2).length ? process.argv.slice(2) : ['--pill-miss', '--muted', '--label', '--pill-1', '--pill-2', '--pill-3', '--pill-4', '--text'];
const rows = [];
for (const palette of palettes) for (const theme of [...new Set(themes)]) for (const appearance of ['dark', 'light']) {
  const t = resolve({ palette, theme, appearance });
  if (!t['--bg'] || !t['--accent']) continue;
  const bg = rgb(t['--bg']).slice(0, 3), acc = over(rgb(t['--accent']), bg);
  const r = { combo: `${palette}/${theme}/${appearance}` };
  for (const c of cands) { const v = t[c] && rgb(t[c]); r[c] = v ? `${dE(over(v, bg), acc).toFixed(0)}/${dE(over(v, bg), bg).toFixed(0)}` : '-'; }
  rows.push(r);
}
console.table(rows);
