// Validate a full 7-theme palette set. Usage: node check.mjs <set.json>
// set.json: { "phosphor": { "light": {...}, "dark": {...} }, "broadsheet": {...}, ... } — all 7 themes.
// Tokens per mode: bg surface border text strong muted label hint accent accentText accentInk
//   pills[4] sel foundText done   (hex '#rrggbb', or rgba(...) for pills/sel/done)
import fs from 'node:fs';
const THEMES = ['phosphor', 'broadsheet', 'sticker', 'drafting', 'grove', 'plum', 'graphite'];
const KEYS = ['bg', 'surface', 'border', 'text', 'strong', 'muted', 'label', 'hint', 'accent', 'accentText', 'accentInk', 'pills', 'sel', 'foundText', 'done'];
const set = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const parse = c => c.startsWith('#') ? [...hex(c), 1] : c.match(/[\d.]+/g).map(Number);
const over = (fg, bg) => { const [r, g, b, a] = parse(fg), B = parse(bg); return [r * a + B[0] * (1 - a), g * a + B[1] * (1 - a), b * a + B[2] * (1 - a), 1]; };
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
// OKLCH-ish chroma/hue via simple RGB->HSL for reporting distinctness.
const hsl = c => { let [r, g, b] = parse(c).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };
let fail = 0; const out = [];
for (const t of THEMES) for (const m of ['light', 'dark']) {
  const p = set?.[t]?.[m]; if (!p) { console.log(`FAIL missing ${t}/${m}`); fail++; continue; }
  const miss = KEYS.filter(k => !(k in p)); if (miss.length) { console.log(`FAIL ${t}/${m} missing ${miss.join(',')}`); fail++; continue; }
  if (!Array.isArray(p.pills) || p.pills.length !== 4) { console.log(`FAIL ${t}/${m} pills must be 4`); fail++; continue; }
  const S = parse(p.surface), B = parse(p.bg);
  const checks = [['text/surface', parse(p.text), S, 4.5], ['text/bg', parse(p.text), B, 4.5], ['strong/bg', parse(p.strong), B, 4.5], ['muted/bg', parse(p.muted), B, 4.5], ['muted/surface', parse(p.muted), S, 4.5],
    ['label/bg', parse(p.label), B, 4.5], ['hint/bg', parse(p.hint), B, 4.5], ['accentText/bg', parse(p.accentText), B, 4.5], ['accentText/surface', parse(p.accentText), S, 4.5], ['accentInk/accent', parse(p.accentInk), parse(p.accent), 4.5],
    ['accent/surface (control edge)', parse(p.accent), S, 3], ['done/bg', over(p.done, p.bg), B, 4.5], ['text on sel', parse(p.text), over(p.sel, p.surface), 4.5],
    ...p.pills.map((c, i) => [`foundText on pill${i + 1}`, parse(p.foundText), over(c, p.surface), 4.5])];
  for (const [n, a, b, min] of checks) { const r = cr(a, b); if (r < min) { console.log(`FAIL ${t}/${m} ${n} ${r.toFixed(2)} < ${min}`); fail++; } }
  const [h, , l] = hsl(p.bg); const rgb = parse(p.bg).slice(0, 3); const chroma = (Math.max(...rgb) - Math.min(...rgb)) / 255;
  out.push({ t, m, bg: p.bg, hue: Math.round(h), sat: +chroma.toFixed(2), light: +l.toFixed(2) });
}
// Distinctness: themes within one mode should not share a background look.
for (const m of ['light', 'dark']) {
  const rows = out.filter(o => o.m === m);
  console.log(`\n${m} backgrounds (hue° / chroma / lightness):`);
  for (const o of rows) console.log(`  ${o.t.padEnd(11)} ${o.bg}  ${String(o.hue).padStart(3)}° s=${o.sat} l=${o.light}`);
  let close = 0;
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j], dh = Math.min(Math.abs(a.hue - b.hue), 360 - Math.abs(a.hue - b.hue));
    const bothGrey = a.sat < .04 && b.sat < .04;
    if ((dh < 25 && Math.abs(a.sat - b.sat) < .06 && Math.abs(a.light - b.light) < .06) || (bothGrey && Math.abs(a.light - b.light) < .06)) { console.log(`  TOO SIMILAR: ${a.t} ~ ${b.t}`); close++; }
  }
  if (close) fail++;
  const avgSat = rows.reduce((s, o) => s + o.sat, 0) / rows.length;
  const pale = m === 'light' && avgSat < .14, black = m === 'dark' && rows.some(o => o.light < .09), dull = m === 'dark' && avgSat < .08;
  console.log(`  average background chroma ${avgSat.toFixed(2)}${pale ? '  (FAIL: light themes too pale, aim average chroma >= .14)' : ''}${black ? '  (FAIL: a dark background is near-black, aim lightness >= .09)' : ''}${dull ? '  (FAIL: dark themes too grey, aim average chroma >= .08)' : ''}`);
  if (pale || black || dull) fail++;
}
console.log(fail ? `\n${fail} problem(s)` : '\nALL CHECKS PASS'); process.exit(fail ? 1 : 0);
