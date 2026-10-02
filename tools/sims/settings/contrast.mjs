// WCAG contrast of every piece of text on every Settings page (the main page, Theme and
// Background), against whatever it sits on composited down to the card, for each theme x
// palette x mode, on a phone (page) and a desktop (card). Text under 4.5:1 (3:1 if large) is
// listed; disabled controls are exempt, as WCAG has them. Exits 1 if any text fails.
//   node tools/sims/settings/contrast.mjs
//   PALETTES=classic,calm THEMES=plum node tools/sims/settings/contrast.mjs
import { chromium } from '@playwright/test';
import { serve } from '../site.mjs';
import { THEMES as ALL_THEMES, PALETTES as ALL_PALETTES } from '../../../src/appearance.js';

const list = (k, all) => (process.env[k] ? process.env[k].split(',') : all);
const THEMES = list('THEMES', ALL_THEMES);
const PALETTES = list('PALETTES', ALL_PALETTES);
// The main page, then each subpage through the row that opens it.
const PAGES = [['main', null], ['theme', '#settings-theme'], ['background', '#settings-bg']];

const site = await serve();
const browser = await chromium.launch();
let failed = 0;
for (const palette of PALETTES) for (const [w, h] of [[390, 844], [1440, 900]]) for (const mode of ['dark', 'light']) for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', reducedMotion: 'reduce', hasTouch: w < 600 });
  const page = await ctx.newPage();
  await page.addInitScript(([m, t, p]) => { localStorage.setItem('wordfinder-appearance', m); localStorage.setItem('wordfinder-theme', t); localStorage.setItem('wordfinder-palette', p); }, [mode, theme, palette]);
  await page.goto(site.url + '/?subject=sports/golf'); await page.waitForSelector('.cell');
  const out = [];
  for (const [name, row] of PAGES) {
    await page.click('#appearance');
    if (row) await page.click(row);
    out.push(await page.evaluate((name) => {
      const rgba = s => { const m = s.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3] ?? 1]; };
      const over = (a, b) => [0, 1, 2].map(i => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
      const L = c => { const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      // What an element sits on: its own and its ancestors' backgrounds, down to the first opaque one.
      const ground = (el) => {
        const layers = [];
        for (let e = el; e; e = e.parentElement) {
          const c = rgba(getComputedStyle(e).backgroundColor);
          if (c[3] > 0) layers.push(c);
          if (c[3] >= 1) break;
        }
        return layers.reverse().reduce((acc, c) => over(c, acc), [255, 255, 255, 1]);
      };
      const card = /** @type {Element} */ (document.getElementById('settingscard'));
      const bad = [];
      let low = 99;
      for (const el of card.querySelectorAll('*')) {
        const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (!own || !el.getClientRects().length || el.closest('[aria-hidden="true"],.sr,[disabled]')) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
        const bg = ground(el), fg = over(rgba(cs.color), bg);
        const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
        const r = cr(fg, bg);
        low = Math.min(low, r);
        if (r < (large ? 3 : 4.5)) bad.push(`${name}: "${el.textContent.trim().slice(0, 24)}" ${r.toFixed(2)}`);
      }
      return { low, bad };
    }, name));
    await page.keyboard.press('Escape');
  }
  const bad = out.flatMap(o => o.bad);
  failed += bad.length;
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${w}x${h} ${mode.padEnd(5)} ${theme}/${palette} lowest ${Math.min(...out.map(o => o.low)).toFixed(2)}`
    + (bad.length ? `\n     ${[...new Set(bad)].join('\n     ')}` : ''));
  await ctx.close();
}
await browser.close();
site.close();
console.log(failed ? `${failed} text failures` : 'all Settings text meets AA');
if (failed) process.exitCode = 1;
