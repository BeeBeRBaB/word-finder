// WCAG contrast of every text role in the open Settings pane against the card, for each
// palette x theme x mode, on a phone (page) and a desktop (card). Text under 4.5:1 is listed
// in `bad` (the divider is reported, not judged). Exits 1 if any text fails.
//   node tools/sims/settings/contrast.mjs
//   PALETTES=classic,calm node tools/sims/settings/contrast.mjs
import { chromium } from '@playwright/test';
import { serve } from '../site.mjs';
const THEMES = ['phosphor', 'broadsheet', 'sticker', 'drafting', 'grove', 'plum', 'graphite'];
const PALETTES = (process.env.PALETTES || 'classic,jewel,duotone,calm').split(',');
const site = await serve();
const browser = await chromium.launch();
let failed = 0;
for (const palette of PALETTES) for (const [w, h] of [[390, 844], [1440, 900]]) for (const mode of ['dark', 'light']) for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', reducedMotion: 'reduce', hasTouch: w < 600 });
  const page = await ctx.newPage();
  await page.addInitScript(([m, t, p]) => { localStorage.setItem('wordfinder-appearance', m); localStorage.setItem('wordfinder-theme', t); localStorage.setItem('wordfinder-palette', p); }, [mode, theme, palette]);
  await page.goto(site.url + '/?subject=sports/golf'); await page.waitForSelector('.cell');
  await page.click('#appearance');
  const r = await page.evaluate(() => {
    const rgb = s => { const m = s.match(/[\d.]+/g).map(Number); return m.slice(0, 3); };
    const L = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const cr = (a, b) => { const x = L(rgb(a)), y = L(rgb(b)); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
    const cs = s => getComputedStyle(document.querySelector(s));
    const bg = cs('#settingscard').backgroundColor;
    const bad = [];
    const vis = s => { const e = document.querySelector(s); return e && getComputedStyle(e).display !== 'none'; };
    const o = { palette: document.documentElement.dataset.palette, theme: document.documentElement.dataset.theme, mode: document.documentElement.dataset.appearance, bg,
      headBgSame: cs('#settingscard .panehead').backgroundColor === bg || cs('#settingscard .panehead').position !== 'sticky',
      back: vis('#settings-back') ? cr(cs('#settings-back').color, bg) : '-',
      close: vis('#settings-close') ? cr(cs('#settings-close').color, bg) : '-',
      section: cr(cs('.panesection').color, bg), label: cr(cs('.panelabel').color, bg), label2: cr(cs('label[for="settings-theme"]').color, bg),
      note: cr(cs('.panenote').color, bg), check: cr(cs('.check').color, bg),
      divider: cr(cs('#settings-feedback').borderTopColor, bg) };
    for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && k !== 'divider' && v < 4.5) bad.push(k);
    o.bad = bad; return o;
  });
  console.log(`${w}x${h}`, JSON.stringify(r));
  failed += r.bad.length;
  await ctx.close();
}
await browser.close();
site.close();
if (failed) process.exitCode = 1;
