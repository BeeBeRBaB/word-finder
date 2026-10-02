// Emits the [data-palette] CSS blocks from set1..3.json: colour tokens only; shape, shadow,
// miss/edge and art tokens stay with the theme block underneath.
import fs from 'node:fs';
const dir = new URL('.', import.meta.url);
const SETS = { jewel: 'set1', duotone: 'set2', calm: 'set3' };
const THEMES = ['phosphor', 'broadsheet', 'sticker', 'drafting', 'grove', 'plum', 'graphite'];
const rgb = c => c.startsWith('#') ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : c.match(/[\d.]+/g).slice(0, 3).map(Number);
const hex = c => '#' + rgb(c).map(v => v.toString(16).padStart(2, '0')).join('');
const rgba = (c, a) => `rgba(${rgb(c).join(',')},${a})`;
const low = c => c.startsWith('#') ? c.toLowerCase() : c;
const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
// Plum frames its board with a ring in a tone between ground and card; a palette needs its own.
const plumShadow = (p, dark) => dark
  ? `--shadow:0 0 0 4px ${mix(p.bg, p.surface, .5)}, 0 14px 30px -16px rgba(0,0,0,.6)`
  : `--shadow:0 1px 0 ${mix(p.bg, p.border, .5)}, 0 10px 24px -14px ${rgba(p.text, .35)}`;
function tokens(p, mode, theme) {
  const dark = mode === 'dark';
  return [
    `color-scheme:${mode}`, `--bg:${low(p.bg)}`, `--surface:${low(p.surface)}`, `--border:${low(p.border)}`,
    `--text:${low(p.text)}`, `--text-strong:${low(p.strong)}`, `--muted:${low(p.muted)}`, `--label:${low(p.label)}`,
    `--hint:${low(p.hint)}`, `--accent:${low(p.accent)}`, `--accent-text:${low(p.accentText)}`, `--accent-ink:${low(p.accentInk)}`,
    `--accent-wash:${rgba(p.accent, dark ? .14 : .10)}`, `--scrim:${dark ? 'rgba(0,0,0,.62)' : rgba(p.text, .40)}`,
    `--found-text:${low(p.foundText)}`, `--done-text:${p.done}`, `--glow:${rgba(p.accent, dark ? .40 : .26)}`,
    ...p.pills.map((c, i) => `--pill-${i + 1}:${low(c)}`), `--pill-sel:${p.sel}`,
    `--confetti-1:${hex(p.accent)}`, ...p.pills.map((c, i) => `--confetti-${i + 2}:${hex(c)}`), `--confetti-6:${hex(p.strong)}`,
    ...(theme === 'plum' ? [plumShadow(p, dark)] : []),
  ];
}
// Wrap declarations to ~100 columns like the theme blocks.
function body(decls) {
  const lines = []; let line = ' ';
  for (const d of decls) { if ((line + ' ' + d + ';').length > 100) { lines.push(line); line = ' '; } line += ' ' + d + ';'; }
  lines.push(line); return lines.join('\n');
}
let css = `/* Palettes: the same seven themes in three more colour sets. Colour tokens only (plus Plum's
   ringed shadow); each theme's shape, shadows and art opacity still come from its own block.
   A palette's bare dark selector ties a theme's light block on specificity, and its own light
   block outranks both, so order does not decide today; after the themes keeps it that way.
   Generated from contrast-checked values (AA text, 3:1 edges); re-check before hand-tuning. */\n`;
for (const [name, file] of Object.entries(SETS)) {
  const set = JSON.parse(fs.readFileSync(new URL(file + '.json', dir)));
  for (const t of THEMES) {
    const sel = `:root[data-palette="${name}"][data-theme="${t}"]`;
    css += `${sel}, ${sel}[data-appearance="dark"]{\n${body(tokens(set[t].dark, 'dark', t))}\n}\n`;
    css += `${sel}[data-appearance="light"]{\n${body(tokens(set[t].light, 'light', t))}\n}\n`;
  }
}
process.stdout.write(css);
