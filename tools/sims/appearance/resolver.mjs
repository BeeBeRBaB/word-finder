// Fuzzes the inline appearance resolver in index.html, in Chromium and WebKit:
//  1. With main.js blocked, odd and hostile stored themes and flavours resolve exactly as
//     normalizeTheme and normalizePref do, each without disturbing the other.
//  2. Throwing localStorage still yields the defaults.
//  3. theme-color meta tracks --bg at boot and after a flavour and a theme change on the Theme page.
//   node tools/sims/appearance/resolver.mjs           Exits 1 on any problem.
//   ENGINES=chromium node tools/sims/appearance/resolver.mjs   where WebKit is not installed.
import { chromium, webkit } from '@playwright/test';
import { THEMES } from '../../../src/appearance.js';
import { serve } from '../site.mjs';
const site = await serve();
const URL_ = site.url + '/?seed=3&subject=sports/golf';
let failed = 0;
const hostile = [null, '', 'neon', 'system', 'classic', 'undefined', 'null', 'toString', 'constructor', '__proto__', '"><img src=x onerror=alert(1)>'];
// Each key's fuzz: its own valid values, near misses of them, and the shared hostile ones.
const FUZZ = {
  'wordfinder-theme': { fixed: ['wordfinder-appearance', 'light'], inputs: [...THEMES, 'Grove', ' grove', 'grove ', 'plum\n', ...hostile] },
  'wordfinder-appearance': { fixed: ['wordfinder-theme', 'grove'], inputs: ['light', 'dark', 'Light', 'LIGHT', ' light', 'light ', ...hostile] },
};
for (const bt of [chromium, webkit].filter(e => (process.env.ENGINES || 'chromium,webkit').split(',').includes(e.name()))) {
  const b = await bt.launch();
  const bad = [];
  // 1. inline resolver only (main.js aborted)
  for (const [key, { fixed, inputs }] of Object.entries(FUZZ)) for (const v of inputs) {
    const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.addInitScript(([key, v, fixed]) => { if (v !== null) localStorage.setItem(key, v); localStorage.setItem(...fixed); }, [key, v, fixed]);
    await page.route('**/src/main.js', r => r.abort());
    await page.goto(URL_);
    const r = await page.evaluate(async () => {
      const { normalizeTheme, normalizePref } = await import('/src/appearance.js');
      const { theme, appearance } = document.documentElement.dataset;
      const want = { theme: normalizeTheme(localStorage.getItem('wordfinder-theme')), appearance: normalizePref(localStorage.getItem('wordfinder-appearance')) };
      return { got: { theme, appearance }, want };
    });
    if (r.got.theme !== r.want.theme || r.got.appearance !== r.want.appearance) bad.push(`${key}=${JSON.stringify(v)}: resolver=${JSON.stringify(r.got)} normalize=${JSON.stringify(r.want)}`);
    if (errs.length) bad.push(`errors for ${key}=${JSON.stringify(v)}: ${errs}`);
    await ctx.close();
  }
  // 2. throwing storage: resolver must still set defaults
  {
    const ctx = await b.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.addInitScript(() => { Storage.prototype.getItem = function () { throw new Error('blocked'); }; });
    await page.route('**/src/main.js', r => r.abort());
    await page.goto(URL_);
    const r = await page.evaluate(() => ({ ...document.documentElement.dataset }));
    if (r.theme !== THEMES[0] || r.appearance !== 'dark') bad.push(`throwing storage: ${JSON.stringify(r)}`);
    console.log(bt.name(), 'throwing storage ->', JSON.stringify(r));
    await ctx.close();
  }
  // 3. theme-color meta at boot and after look changes (full app), each through a Theme page tile
  for (const [theme, pref] of [['grove', 'dark'], ['phosphor', 'light'], ['sticker', 'light'], ['plum', 'dark']]) {
    const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(([t, p]) => { localStorage.setItem('wordfinder-theme', t); localStorage.setItem('wordfinder-appearance', p); }, [theme, pref]);
    await page.goto(URL_);
    await page.waitForSelector('.cell');
    const snap = () => page.evaluate(() => ({ meta: document.querySelector('meta[name="theme-color"]').getAttribute('content'), bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), sel: document.querySelector('input[name="look"]:checked')?.value, look: `${document.documentElement.dataset.theme}/${document.documentElement.dataset.appearance}` }));
    const check = async (when, look) => { const s = await snap(); if (s.meta !== s.bg || s.sel !== look || s.look !== look) bad.push(`${when}: ${JSON.stringify(s)}`); return s; };
    await check(`boot ${theme}/${pref}`, `${theme}/${pref}`);
    await page.locator('#appearance').click();
    await page.locator('#settings-theme').click();
    const other = pref === 'dark' ? 'light' : 'dark';
    await page.locator(`.looktile[data-look="${theme}/${other}"]`).click();
    await check(`after flavour change to ${theme}/${other}`, `${theme}/${other}`);
    await page.locator(`.looktile[data-look="graphite/${pref}"]`).click();
    const s = await check(`after theme change to graphite/${pref}`, `graphite/${pref}`);
    const stored = await page.evaluate(() => `${localStorage.getItem('wordfinder-theme')}/${localStorage.getItem('wordfinder-appearance')}`);
    if (stored !== `graphite/${pref}`) bad.push(`not stored: ${stored}`);
    console.log(bt.name(), theme, pref, '->', JSON.stringify(s));
    await ctx.close();
  }
  console.log(bt.name(), 'PROBLEMS', bad.length); for (const x of bad) console.log('  ' + x);
  failed += bad.length;
  await b.close();
}
site.close();
if (failed) process.exitCode = 1;
