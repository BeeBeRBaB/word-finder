// Palette contact sheets: for each set JSON, the app in all 7 themes x light/dark with four
// words found, tiled into one sheet-<name>.png. The set's colours are injected over the live
// app, so a candidate set (say from tools/palettes/gen2.mjs) renders before it ships.
//   node tools/sims/palettes/render.mjs                        Classic, Jewel, Duotone, Calm
//   node tools/sims/palettes/render.mjs path/to/candidate.json
// Tiles, sheet-<name>.jpg and (for several sets) sheet-all.jpg go to OUT (default .shots/palettes/).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { serve, REPO } from '../site.mjs';

const THEMES = ['phosphor', 'broadsheet', 'sticker', 'drafting', 'grove', 'plum', 'graphite'];
const NAMES = { current: 'Classic', set1: 'Jewel', set2: 'Duotone', set3: 'Calm' };
const OUT = process.env.OUT || REPO + '.shots/palettes/';
const files = process.argv.slice(2).length ? process.argv.slice(2).map((f) => path.resolve(f))
  : Object.keys(NAMES).map((n) => REPO + `tools/palettes/${n}.json`);
fs.mkdirSync(OUT, { recursive: true });

const rgb = (c) => c.startsWith('#') ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/[\d.]+/g).slice(0, 3).map(Number);
const solid = (c) => '#' + rgb(c).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const css = (set) => THEMES.flatMap((t) => ['light', 'dark'].map((m) => {
  const p = set[t][m], a = rgb(p.accent).join(',');
  return `:root[data-theme="${t}"][data-appearance="${m}"]{--bg:${p.bg};--surface:${p.surface};--border:${p.border};--text:${p.text};--text-strong:${p.strong};--muted:${p.muted};--label:${p.label};--hint:${p.hint};--accent:${p.accent};--accent-text:${p.accentText};--accent-ink:${p.accentInk};--accent-wash:rgba(${a},.12);--glow:rgba(${a},.35);--found-text:${p.foundText};--done-text:${p.done};--pill-1:${p.pills[0]};--pill-2:${p.pills[1]};--pill-3:${p.pills[2]};--pill-4:${p.pills[3]};--pill-sel:${p.sel};--confetti-1:${solid(p.accent)};--confetti-2:${solid(p.pills[0])};--confetti-3:${solid(p.pills[1])};--confetti-4:${solid(p.pills[2])};--confetti-5:${solid(p.pills[3])};--confetti-6:${solid(p.strong)}}`;
})).join('\n');

const site = await serve();
const b = await chromium.launch();
const sections = [];
const shoot = async (name, body) => {
  fs.writeFileSync(`${OUT}${name}.html`, `<body style="margin:0;background:#1a1a1a;font:14px Helvetica;color:#eee;padding:12px">${body}</body>`);
  const p = await b.newPage({ viewport: { width: 7 * 278 + 24, height: 100 } }); await p.goto('file://' + OUT + `${name}.html`); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}${name}.jpg`, fullPage: true, type: 'jpeg', quality: 85 }); await p.close();
  console.log(`${OUT}${name}.jpg`);
};
for (const file of files) {
  const base = path.basename(file, '.json'), title = NAMES[base] || base, slug = title.toLowerCase();
  const set = JSON.parse(fs.readFileSync(file, 'utf8')); const shots = [];
  for (const m of ['light', 'dark']) for (const t of THEMES) {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 750 }, serviceWorkers: 'block' });
    await ctx.addInitScript(([t, m]) => { localStorage.setItem('wordfinder-theme', t); localStorage.setItem('wordfinder-appearance', m); localStorage.setItem('wordfinder-palette', 'classic'); }, [t, m]);
    const p = await ctx.newPage(); await p.goto(site.url + '/?seed=7&subject=space/jupiter'); await p.waitForSelector('#letters .cell');
    await p.addStyleTag({ content: css(set) });
    // Find the first four words by dragging across their real cells.
    const pl = await p.evaluate(() => JSON.parse(localStorage.getItem('wordfinder-save-v1')).placements.slice(0, 4));
    const size = Math.round(Math.sqrt(await p.locator('#letters .cell').count()));
    const centre = (x, y) => p.evaluate(([i]) => { const r = document.querySelectorAll('#letters .cell')[i].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, [y * size + x]);
    for (const q of pl) {
      const [ax, ay] = await centre(q.x0, q.y0), [bx, by] = await centre(q.x0 + q.dx * (q.word.length - 1), q.y0 + q.dy * (q.word.length - 1));
      await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 5 }); await p.mouse.up();
    }
    await p.waitForTimeout(1100);
    const f = `tile-${slug}-${m}-${t}.png`; await p.screenshot({ path: OUT + f }); shots.push({ f, t, m }); await ctx.close();
  }
  const section = `<h2 style="margin:0 0 8px">${title}</h2><div style="display:grid;grid-template-columns:repeat(7,270px);gap:8px;margin-bottom:14px">` +
    shots.map((s) => `<div><img src="${s.f}" style="width:270px;border-radius:4px;display:block"><div style="margin-top:2px">${s.t} · ${s.m}</div></div>`).join('') + '</div>';
  sections.push(section);
  await shoot(`sheet-${slug}`, section);
}
if (sections.length > 1) await shoot('sheet-all', sections.join(''));
await b.close(); site.close();
