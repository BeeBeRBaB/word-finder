// Geometry of the Settings card (or the category picker) at many shapes: card box, off-screen
// edges, its own scroll, column and row layout, controls that overflow the card, clipped
// segment buttons, wrapped labels, sticky header, and which open animation ran.
//   node tools/sims/settings/measure.mjs
//   ENGINES=chromium,webkit MODES=dark,light SHAPES=390x844,844x390 node tools/sims/settings/measure.mjs
//   PANE=picker | PAGE=bg (or theme) | THEME=plum | RM=reduce | DATAMOTION=1 | NOFONTS=1 | SHOT=tag (PNGs to OUT, default .shots/sims)
import { chromium, webkit } from '@playwright/test';
import fs from 'node:fs';
import { serve, REPO } from '../site.mjs';

const shapes = (process.env.SHAPES || '1440x900,1366x768,1024x768,768x1024,390x844,320x568,844x390,667x375,844x300,932x340,430x752,744x1053,1133x664').split(',');
const engines = (process.env.ENGINES || 'chromium').split(',');
const modes = (process.env.MODES || 'dark').split(',');
const pane = process.env.PANE || 'settings';
const OUT = process.env.OUT || REPO + '.shots/sims/';
if (process.env.SHOT) fs.mkdirSync(OUT, { recursive: true });
const site = await serve();
for (const en of engines) {
  const browser = await (en === 'webkit' ? webkit : chromium).launch();
  for (const mode of modes) for (const sh of shapes) {
    const [w, h] = sh.split('x').map(Number);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: mode, hasTouch: w < 600 || h <= 420, serviceWorkers: 'block', reducedMotion: process.env.RM || 'no-preference' });
    const page = await ctx.newPage();
    await page.addInitScript(([t, m]) => { try { if (t) localStorage.setItem('wordfinder-theme', t); localStorage.setItem('wordfinder-appearance', m); } catch {} }, [process.env.THEME, mode]);
    // Web fonts blocked: the fallback stack is wider, which is where labels wrap first.
    if (process.env.NOFONTS) await page.route(/fonts\.(googleapis|gstatic)\.com|\.woff2?(\?|$)/, (r) => r.abort());
    await page.goto(`${site.url}/?subject=sports/golf`);
    await page.waitForSelector('.cell');
    if (process.env.DATAMOTION) await page.evaluate(() => { document.documentElement.dataset.motion = 'reduce'; });
    await page.click(pane === 'settings' ? '#appearance' : '#catbtn');
    const cardId = pane === 'settings' ? 'settingscard' : 'pickercard';
    const anims = await page.evaluate((id) => document.getElementById(id).getAnimations().map((a) => a.animationName), cardId);
    await page.evaluate((id) => Promise.all(document.getElementById(id).getAnimations().map((a) => a.finished)), cardId);
    // PAGE=bg or theme measures that page of Settings instead, opened from its row.
    if (pane === 'settings' && process.env.PAGE) await page.click(`#settings-${process.env.PAGE}`);
    await page.waitForTimeout(100);
    const m = await page.evaluate(({ id }) => {
      const c = document.getElementById(id), r = c.getBoundingClientRect(), cs = getComputedStyle(c);
      const p = c.parentElement, ps = getComputedStyle(p);
      const o = { card: [r.x, r.y, r.width, r.height].map(Math.round), vw: innerWidth, vh: innerHeight,
        offL: r.left < -0.5, offR: r.right > innerWidth + 0.5, offB: Math.round(r.bottom - innerHeight),
        scroll: c.scrollHeight - c.clientHeight, docOverflowX: document.documentElement.scrollWidth - innerWidth,
        w: cs.width, h: cs.height, maxH: cs.maxHeight, pad: cs.padding, bw: cs.borderWidth, br: cs.borderRadius, shadow: cs.boxShadow === 'none' ? 'none' : 'yes', anim: cs.animationName,
        panePad: ps.padding, paneInline: p.getAttribute('style'), align: ps.alignItems, justify: ps.justifyContent };
      if (id === 'settingscard') {
        const g = (x) => getComputedStyle(document.getElementById(x));
        o.back = g('settings-back').display; o.close = g('settings-close').display;
        o.cols = g('settings-body').gridTemplateColumns;
        o.rows = [...c.querySelectorAll('.row')].map((x) => getComputedStyle(x).gridTemplateColumns.split(' ').length).join('');
        o.groupW = [...c.querySelectorAll('.panegroup')].map((x) => Math.round(x.getBoundingClientRect().width)).join('/');
        o.headPos = getComputedStyle(c.querySelector('.panehead')).position;
        o.over = [...c.querySelectorAll('button,select,label,span,p,h2,h3')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > r.right + 0.5 || b.left < r.left - 0.5); }).map((e) => e.id || e.textContent.trim().slice(0, 20));
        o.clipSeg = [...c.querySelectorAll('.seg button')].filter((b) => getComputedStyle(b).display !== 'none' && b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent.trim());
        o.labels = [...c.querySelectorAll('.row > :first-child')].filter((l) => l.scrollWidth > l.clientWidth + 0.5 || l.getBoundingClientRect().height > 20).map((l) => `${l.textContent.trim()}:${l.scrollWidth}/${l.clientWidth}x${Math.round(l.getBoundingClientRect().height)}`);
        o.checkWrap = [...c.querySelectorAll('.check span')].filter((s) => s.getBoundingClientRect().height > 24).map((s) => s.textContent.slice(0, 15));
        o.hintBottom = Math.round(document.getElementById('hint').getBoundingClientRect().bottom);
      }
      return o;
    }, { id: cardId });
    console.log(en, mode, sh, 'anims=' + JSON.stringify(anims), JSON.stringify(m));
    if (process.env.SHOT) await page.screenshot({ path: `${OUT}${process.env.SHOT}-${en}-${mode}-${sh}.png` });
    await ctx.close();
  }
  await browser.close();
}
site.close();
