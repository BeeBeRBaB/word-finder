// Fuzzes the inline appearance resolver in index.html, in Chromium and WebKit:
//  1. With main.js blocked, odd and hostile stored palettes resolve exactly as normalizePalette
//     does, without disturbing theme or appearance.
//  2. Throwing localStorage still yields the defaults.
//  3. theme-color meta tracks --bg at boot and after palette, mode and theme changes.
//   node tools/sims/appearance/resolver.mjs           Exits 1 on any problem.
import { chromium, webkit } from '@playwright/test';
import { serve } from '../site.mjs';
const site = await serve();
const URL_ = site.url + '/?seed=3&subject=sports/golf';
let failed = 0;
const inputs = [null, 'classic', 'jewel', 'duotone', 'calm', 'Jewel', 'neon', '', ' jewel', 'jewel ', '"><img src=x onerror=alert(1)>', 'toString', 'constructor', '__proto__', 'undefined', 'null'];
for (const bt of [chromium, webkit]) {
  const b = await bt.launch();
  const bad = [];
  // 1. inline resolver only (main.js aborted)
  for (const v of inputs) {
    for (const theme of ['grove', 'phosphor']) {
      const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const errs = []; page.on('pageerror', e => errs.push(String(e)));
      await page.addInitScript(([v, theme]) => { if (v !== null) localStorage.setItem('wordfinder-palette', v); localStorage.setItem('wordfinder-theme', theme); localStorage.setItem('wordfinder-appearance', 'light'); }, [v, theme]);
      await page.route('**/src/main.js', r => r.abort());
      await page.goto(URL_);
      const r = await page.evaluate(async (v) => {
        const h = document.documentElement;
        const { normalizePalette } = await import('/src/appearance.js');
        return { pal: h.dataset.palette, theme: h.dataset.theme, app: h.dataset.appearance, norm: normalizePalette(v), bg: getComputedStyle(h).getPropertyValue('--bg').trim() };
      }, v);
      if (r.pal !== r.norm) bad.push(`resolver!=normalizePalette for ${JSON.stringify(v)}: resolver=${r.pal} norm=${r.norm}`);
      if (r.theme !== theme || r.app !== 'light') bad.push(`palette ${JSON.stringify(v)} disturbed theme/appearance: ${JSON.stringify(r)}`);
      if (errs.length) bad.push(`errors for ${JSON.stringify(v)}: ${errs}`);
      await ctx.close();
    }
  }
  // 2. throwing storage: resolver must still set defaults
  {
    const ctx = await b.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.addInitScript(() => { Storage.prototype.getItem = function () { throw new Error('blocked'); }; });
    await page.route('**/src/main.js', r => r.abort());
    await page.goto(URL_);
    const r = await page.evaluate(() => ({ ...document.documentElement.dataset }));
    if (r.palette !== 'classic' || r.theme !== 'phosphor' || r.appearance !== 'dark') bad.push(`throwing storage: ${JSON.stringify(r)}`);
    console.log(bt.name(), 'throwing storage ->', JSON.stringify(r));
    await ctx.close();
  }
  // 3. theme-color meta at boot and after changes (full app)
  for (const [pal, theme, mode] of [['jewel', 'grove', 'dark'], ['calm', 'phosphor', 'light'], ['duotone', 'sticker', 'light'], ['classic', 'plum', 'dark']]) {
    const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(([p, t, m]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('wordfinder-palette', p); localStorage.setItem('wordfinder-theme', t); localStorage.setItem('wordfinder-appearance', m); } }, [pal, theme, mode]);
    await page.goto(URL_);
    await page.waitForSelector('.cell');
    const snap = () => page.evaluate(() => ({ meta: document.querySelector('meta[name="theme-color"]').getAttribute('content'), bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), sel: document.getElementById('settings-palette').value, pal: document.documentElement.dataset.palette }));
    let s = await snap();
    if (s.meta !== s.bg || s.sel !== pal) bad.push(`boot ${pal}:${theme}:${mode}: ${JSON.stringify(s)}`);
    await page.locator('#appearance').click();
    const next = pal === 'jewel' ? 'calm' : 'jewel';
    await page.locator('#settings-palette').selectOption(next);
    s = await snap();
    if (s.meta !== s.bg || s.pal !== next) bad.push(`after palette change ${next}:${theme}:${mode}: ${JSON.stringify(s)}`);
    await page.locator(mode === 'dark' ? '#mode-light' : '#mode-dark').click();
    s = await snap();
    if (s.meta !== s.bg) bad.push(`after mode change: ${JSON.stringify(s)}`);
    await page.locator('#settings-theme').selectOption('graphite');
    s = await snap();
    if (s.meta !== s.bg) bad.push(`after theme change: ${JSON.stringify(s)}`);
    const stored = await page.evaluate(() => localStorage.getItem('wordfinder-palette'));
    if (stored !== next) bad.push(`not stored: ${stored}`);
    console.log(bt.name(), pal, theme, mode, '->', JSON.stringify(s));
    await ctx.close();
  }
  console.log(bt.name(), 'PROBLEMS', bad.length); for (const x of bad) console.log('  ' + x);
  failed += bad.length;
  await b.close();
}
site.close();
if (failed) process.exitCode = 1;
