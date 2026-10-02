// Cascade check of the palette CSS, in a real browser. For every theme x mode (and no mode):
//  1. Classic, no palette, an unknown or removed palette all compute exactly what BASE's
//     stylesheet computes with no palette.
//  2. Each shipped palette computes the values in tools/palettes/set*.json.
//  3. A palette with no mode equals its dark mode, and touches no non-colour token.
//   node tools/sims/appearance/cascade.mjs                BASE=HEAD, the working styles.css
//   BASE=origin/main CSS=/tmp/candidate.css node tools/sims/appearance/cascade.mjs
// Exits 1 on any problem.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { serve, REPO } from '../site.mjs';

const BASE = process.env.BASE || 'HEAD';
const css = fs.readFileSync(process.env.CSS || REPO + 'styles.css', 'utf8');
const baseCss = execFileSync('git', ['-C', REPO, 'show', `${BASE}:styles.css`], { encoding: 'utf8', maxBuffer: 1 << 26 });
const blk = (s) => { const at = css.indexOf(s); const o = css.indexOf('{', at); return css.slice(o, css.indexOf('}', o)); };
const TOKENS = [...new Set([...blk(':root, :root[data-appearance="dark"]').matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))];
const PALETTE_TOKENS = ['--bg', '--surface', '--border', '--text', '--text-strong', '--muted', '--label',
  '--hint', '--accent', '--accent-text', '--accent-ink', '--accent-wash', '--scrim', '--found-text',
  '--done-text', '--glow', '--pill-1', '--pill-2', '--pill-3', '--pill-4', '--pill-sel',
  ...[1, 2, 3, 4, 5, 6].map((i) => `--confetti-${i}`)];
const THEMES = ['phosphor', 'broadsheet', 'sticker', 'drafting', 'grove', 'plum', 'graphite'];
const SETS = { jewel: 'set1', duotone: 'set2', calm: 'set3' };   // as in tools/palettes/tocss.mjs
const MAP = { bg: '--bg', surface: '--surface', border: '--border', text: '--text', strong: '--text-strong', muted: '--muted', label: '--label', hint: '--hint', accent: '--accent', accentText: '--accent-text', accentInk: '--accent-ink', sel: '--pill-sel', foundText: '--found-text', done: '--done-text' };

const site = await serve();
const b = await chromium.launch();
async function open(routeCss) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.route('**/styles.css', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: routeCss }));
  await page.goto(site.url + '/?seed=3&subject=sports/golf');
  await page.waitForSelector('.cell');
  return page;
}
async function read(page, attrs) {
  return page.evaluate(([attrs, TOKENS]) => {
    const h = document.documentElement;
    for (const [k, v] of Object.entries(attrs)) { if (v === null) h.removeAttribute('data-' + k); else h.setAttribute('data-' + k, v); }
    const cs = getComputedStyle(h);
    const probe = document.createElement('div'); document.body.appendChild(probe);
    const norm = (v) => {
      v = v.trim().replace(/\s+/g, ' ');
      probe.style.color = ''; probe.style.color = v;
      return probe.style.color ? getComputedStyle(probe).color : v;
    };
    const out = {};
    for (const t of TOKENS) out[t] = norm(cs.getPropertyValue(t));
    const g = getComputedStyle(document.getElementById('gridbox'));
    Object.assign(out, { 'color-scheme': cs.colorScheme, 'body-bg': getComputedStyle(document.body).backgroundColor,
      'gridbox-bg': g.backgroundColor, 'gridbox-shadow': g.boxShadow, 'gridbox-radius': g.borderTopLeftRadius });
    probe.remove();
    return out;
  }, [attrs, TOKENS]);
}
const normColor = (page, v) => page.evaluate((v) => { const p = document.createElement('div'); document.body.appendChild(p); p.style.color = v; const c = getComputedStyle(p).color; p.remove(); return c; }, v);

const work = await open(css);
const base = await open(baseCss);
const shipped = await work.evaluate(async () => (await import('/src/appearance.js')).PALETTES);
const live = Object.keys(SETS).filter((p) => shipped.includes(p));
const problems = [];
const MODES = ['dark', 'light', null];
for (const th of THEMES) for (const m of MODES) {
  const ref = await read(base, { theme: th, appearance: m, palette: null });
  for (const pal of ['classic', null, 'neon', 'Jewel', '', ...Object.keys(SETS).filter((p) => !live.includes(p))]) {
    const got = await read(work, { theme: th, appearance: m, palette: pal });
    for (const k of Object.keys(ref)) if (ref[k] !== got[k]) problems.push(`classic-equivalence ${pal}:${th}:${m} ${k}: base=${ref[k]} got=${got[k]}`);
  }
}
const derivedDiffs = new Map();
for (const pal of live) {
  const set = JSON.parse(fs.readFileSync(REPO + `tools/palettes/${SETS[pal]}.json`, 'utf8'));
  for (const th of THEMES) {
    const byMode = {};
    for (const m of MODES) {
      const got = await read(work, { theme: th, appearance: m, palette: pal });
      byMode[String(m)] = got;
      const cm = m ?? 'dark';
      const classic = await read(work, { theme: th, appearance: m, palette: 'classic' });
      const exp = set[th][cm];
      for (const [k, tok] of Object.entries(MAP)) {
        const e = await normColor(work, exp[k]);
        if (got[tok] !== e) problems.push(`value ${pal}:${th}:${m} ${tok}: expected ${e} got ${got[tok]}`);
      }
      for (let i = 0; i < 4; i++) { const e = await normColor(work, exp.pills[i]); if (got[`--pill-${i + 1}`] !== e) problems.push(`value ${pal}:${th}:${m} --pill-${i + 1}: expected ${e} got ${got[`--pill-${i + 1}`]}`); }
      if (got['color-scheme'] !== cm) problems.push(`color-scheme ${pal}:${th}:${m}: ${got['color-scheme']}`);
      for (const t of TOKENS) {
        if (PALETTE_TOKENS.includes(t) || got[t] === classic[t]) continue;
        const key = `${th}:${cm} ${t}`; derivedDiffs.set(key, (derivedDiffs.get(key) || []).concat(`${pal}: ${classic[t]} -> ${got[t]}`));
      }
      if (got['gridbox-radius'] !== classic['gridbox-radius']) problems.push(`shape ${pal}:${th}:${m} radius ${classic['gridbox-radius']} -> ${got['gridbox-radius']}`);
    }
    for (const k of Object.keys(byMode.dark)) if (byMode.dark[k] !== byMode.null[k]) problems.push(`absent-vs-dark ${pal}:${th} ${k}: dark=${byMode.dark[k]} absent=${byMode.null[k]}`);
  }
}
console.log(`BASE=${BASE} palettes checked: ${live.join(' ')}  tokens: ${TOKENS.length}, non-palette: ${TOKENS.filter((t) => !PALETTE_TOKENS.includes(t)).join(' ')}`);
console.log('PROBLEMS', problems.length); for (const p of problems) console.log('  ' + p);
console.log('NON-PALETTE TOKENS THAT DIFFER FROM CLASSIC (should only be var()-derived):');
for (const [k, v] of derivedDiffs) console.log('  ' + k + '\n     ' + v.join('\n     '));
await b.close(); site.close();
if (problems.length) process.exitCode = 1;
