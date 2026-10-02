// Safe-area insets on the full-screen Settings page: emulates notch and home-bar insets
// through CDP (Emulation.setSafeAreaInsetsOverride, Chromium only), scrolls to the bottom,
// and reports what env() resolves to, the card and header padding, and where Back, the title,
// the body and the hint land. PNG per shape to OUT (default .shots/sims).
//   node tools/sims/settings/safe-area.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { serve, REPO } from '../site.mjs';
const OUT = process.env.OUT || REPO + '.shots/sims/';
fs.mkdirSync(OUT, { recursive: true });
const site = await serve();
const browser = await chromium.launch();
console.log('chromium', browser.version());
for (const [w, h, ins] of [[390, 844, { top: 47, bottom: 34, left: 0, right: 0 }], [844, 390, { top: 0, bottom: 21, left: 47, right: 47 }], [320, 568, { top: 20, bottom: 0, left: 0, right: 0 }]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: ins }); } catch (e) { console.log('no override:', e.message.split('\n')[0]); await ctx.close(); continue; }
  await page.goto(site.url + '/?subject=sports/golf'); await page.waitForSelector('.cell');
  await page.click('#appearance');
  const r = await page.evaluate(() => {
    const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;top:0;left:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.append(probe);
    const env = getComputedStyle(probe).padding; probe.remove();
    const c = document.getElementById('settingscard'), hd = c.querySelector('.panehead'), cs = getComputedStyle(c), hs = getComputedStyle(hd);
    const at = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(Math.round); };
    c.scrollTop = c.scrollHeight;
    const hb = hd.getBoundingClientRect(), cb = c.getBoundingClientRect(), hint = document.getElementById('hint').getBoundingClientRect();
    return { env, cardPad: cs.padding, headPad: hs.padding, headMargin: hs.margin, card: [cb.x, cb.y, cb.width, cb.height].map(Math.round), headRect: [hb.x, hb.y, hb.width, hb.height].map(Math.round),
      back: at('#settings-back'), title: at('#settings-title'), body: at('#settings-body'), hintGapToBottom: Math.round(cb.bottom - hint.bottom) };
  });
  console.log(`${w}x${h}`, JSON.stringify(r));
  await page.screenshot({ path: `${OUT}safe-${w}x${h}.png` });
  await ctx.close();
}
await browser.close();
site.close();
