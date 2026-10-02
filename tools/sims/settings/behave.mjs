// Settings pane behaviour, in Chromium and WebKit:
//  1. Open animation under OS reduced motion and under data-motion, page and card modes;
//     then the real Reduce motion toggle, closed and reopened.
//  2. Sticky header after scrolling to the bottom: hit-tests under its edge, title centring,
//     Back size, hint gap (PNG per shape to OUT, default .shots/sims).
//  3. Resizing while open moves it card -> page -> card cleanly.
//   node tools/sims/settings/behave.mjs
import { chromium, webkit } from '@playwright/test';
import fs from 'node:fs';
import { serve, REPO } from '../site.mjs';
const OUT = process.env.OUT || REPO + '.shots/sims/';
fs.mkdirSync(OUT, { recursive: true });
const site = await serve();
const U = site.url + '/?subject=sports/golf';
for (const en of ['chromium', 'webkit']) {
  const browser = await (en === 'webkit' ? webkit : chromium).launch();
  const open = async (opts, pre) => {
    const ctx = await browser.newContext({ serviceWorkers: 'block', ...opts });
    const page = await ctx.newPage(); await page.goto(U); await page.waitForSelector('.cell');
    if (pre) await page.evaluate(pre);
    await page.click('#appearance'); return { ctx, page };
  };
  // 1. reduced motion, OS and data-motion, page mode and card mode
  for (const [label, opts, pre] of [
    ['OS reduce 390x844', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true }],
    ['OS reduce 844x390', { viewport: { width: 844, height: 390 }, reducedMotion: 'reduce', hasTouch: true }],
    ['data-motion 390x844', { viewport: { width: 390, height: 844 }, hasTouch: true }, () => { document.documentElement.dataset.motion = 'reduce'; }],
    ['data-motion 1440x900', { viewport: { width: 1440, height: 900 } }, () => { document.documentElement.dataset.motion = 'reduce'; }],
  ]) {
    const { ctx, page } = await open(opts, pre);
    const r = await page.evaluate(() => { const c = document.getElementById('settingscard'); return { anims: c.getAnimations().map(a => a.animationName), name: getComputedStyle(c).animationName, x: c.getBoundingClientRect().x }; });
    console.log(en, label, JSON.stringify(r)); await ctx.close();
  }
  // 1b. The real Settings toggle: tick Reduce motion, close, reopen
  {
    const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.evaluate(() => Promise.all(document.getElementById('settingscard').getAnimations().map(a => a.finished)));
    await page.locator('#settings-motion-box').check();
    await page.click('#settings-back'); await page.click('#appearance');
    const r = await page.evaluate(() => ({ dm: document.documentElement.dataset.motion, anims: document.getElementById('settingscard').getAnimations().map(a => a.animationName) }));
    console.log(en, 'toggle reduce via UI then reopen', JSON.stringify(r)); await ctx.close();
  }
  // 2. sticky header after scrolling to the bottom
  for (const [w, h] of [[320, 568], [844, 300], [667, 375], [390, 844]]) {
    const { ctx, page } = await open({ viewport: { width: w, height: h }, hasTouch: true });
    await page.evaluate(() => Promise.all(document.getElementById('settingscard').getAnimations().map(a => a.finished)));
    const r = await page.evaluate(() => {
      const c = document.getElementById('settingscard'), hd = c.querySelector('.panehead');
      c.scrollTop = c.scrollHeight;
      const hb = hd.getBoundingClientRect(), cb = c.getBoundingClientRect();
      const pts = [0.1, 0.5, 0.9].map(f => { const el = document.elementFromPoint(cb.left + cb.width * f, hb.bottom - 2); return el && (hd.contains(el) || el === hd) ? 'head' : (el ? (el.id || el.tagName) : null); });
      const back = document.getElementById('settings-back').getBoundingClientRect(), h2 = hd.querySelector('h2').getBoundingClientRect();
      const hint = document.getElementById('hint').getBoundingClientRect();
      return { scrollTop: c.scrollTop, headTop: hb.top, headH: Math.round(hb.height), headL: hb.left, headW: Math.round(hb.width), cardW: cb.width, pts,
        headBg: getComputedStyle(hd).backgroundColor, cardBg: getComputedStyle(c).backgroundColor,
        titleCentre: Math.round(h2.left + h2.width / 2), titleTextCentreOff: Math.round((() => { const rg = document.createRange(); rg.selectNodeContents(hd.querySelector('h2')); const b = rg.getBoundingClientRect(); return b.left + b.width / 2 - cb.width / 2; })()),
        backH: Math.round(back.height), hintBottomVsCard: Math.round(cb.bottom - hint.bottom) };
    });
    console.log(en, `sticky ${w}x${h}`, JSON.stringify(r));
    await page.screenshot({ path: `${OUT}sticky-${en}-${w}x${h}.png` });
    await ctx.close();
  }
  // 3. resize while open: card -> page -> card
  {
    const { ctx, page } = await open({ viewport: { width: 1024, height: 768 } });
    const snap = async (tag) => { await page.waitForTimeout(150); await page.evaluate(() => Promise.all(document.getElementById('settingscard').getAnimations().map((a) => a.finished))); console.log(en, 'resize', tag, JSON.stringify(await page.evaluate(() => { const s = document.getElementById('settings'), c = document.getElementById('settingscard'), b = c.getBoundingClientRect(); return { inline: s.getAttribute('style'), card: [b.x, b.y, b.width, b.height].map(Math.round), vw: innerWidth, vh: innerHeight, back: getComputedStyle(document.getElementById('settings-back')).display }; }))); };
    await snap('1024x768');
    await page.setViewportSize({ width: 844, height: 390 }); await snap('->844x390');
    await page.setViewportSize({ width: 390, height: 844 }); await snap('->390x844');
    await page.setViewportSize({ width: 768, height: 1024 }); await snap('->768x1024');
    await page.setViewportSize({ width: 1366, height: 768 }); await snap('->1366x768');
    await ctx.close();
  }
  await browser.close();
}
site.close();
