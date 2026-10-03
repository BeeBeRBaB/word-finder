// Mounts the score card in the real win card and screenshots / measures it. Starts its own server
// and writes PNGs to .shots/scorecard/ (gitignored), or to SHOTS_DIR.
//   node tools/levels-review/scorecard-drive.mjs [--mode=shots|behaviour|wipe|extra] [--themes=default,grove]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 5291);   // not 5173: never fight a dev server already up
const BASE = `http://localhost:${PORT}/?subject=nature/birds`;
const OUT = process.env.SHOTS_DIR || fileURLToPath(new URL('../../.shots/scorecard', import.meta.url));
mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [fileURLToPath(new URL('../../tests/server.mjs', import.meta.url))], {
  env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore',
});
for (let i = 0; i < 100; i++) {
  try { await fetch(`http://localhost:${PORT}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 50)); }
}
const W = ['SPARROW','ROBIN','EAGLE','HERON','FINCH','OWL','PELICAN','WREN','CRANE','SWALLOW','MAGPIE','KESTREL'];
const args = process.argv.slice(2);
const only = (k) => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1];

const browser = await chromium.launch();
process.on('exit', () => server.kill());

/** @param {{w:number,h:number,theme:string,look:string,motion?:string}} o */
async function open(o) {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h }, serviceWorkers: 'block', deviceScaleFactor: 1 });
  await ctx.addInitScript(({ theme, look, motion }) => {
    try {
      localStorage.removeItem('wordfinder-save-v1');
      localStorage.setItem('wordfinder-appearance', look);
      if (theme === 'default') localStorage.removeItem('wordfinder-theme'); else localStorage.setItem('wordfinder-theme', theme);
      if (motion) localStorage.setItem('wordfinder-settings-v1', JSON.stringify({ motion }));
    } catch {}
  }, o);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-booting') && document.querySelectorAll('#letters *').length > 20);
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, errors };
}

/** @param {import('playwright').Page} page @param {'pos'|'neg'} sign @param {object} opts */
async function mount(page, sign, opts = {}) {
  await page.evaluate(async ({ sign, opts, W }) => {
    const { playBreakdown } = await import('/src/scorecard.js');
    const { scoreLevel } = await import('/src/scoring.js');
    const bd = sign === 'pos'
      ? scoreLevel({ events: W.map((w, i) => ({ word: w, at: 9000 * (i + 1), revealed: i === 7 })), elapsedMs: 118000, difficulty: 'normal', wordCount: 12 })
      : scoreLevel({ events: W.map((w, i) => ({ word: w, at: 40000 * (i + 1), revealed: i >= 3 })), elapsedMs: 900000, difficulty: 'hard', wordCount: 12 });
    const win = document.getElementById('win'), card = document.getElementById('wincard');
    for (const id of ['solved', 'winmsg', 'winstats', 'winnext', 'winbtn']) document.getElementById(id).hidden = true;
    let host = document.getElementById('schost');
    if (!host) { host = document.createElement('div'); host.id = 'schost'; card.querySelector('h2').after(host); }
    window.__calls = { next: 0 };
    win.style.display = 'flex';
    window.__pb?.cancel();   // the last card mounted here, which replacing it does not stop
    window.__pb = playBreakdown(host, bd, { ...opts, onNext: () => window.__calls.next++ });
  }, { sign, opts, W });
}

const measure = (page) => page.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; };
  const q = (s) => document.querySelector(s);
  const card = q('#wincard');
  return {
    vw: innerWidth, vh: innerHeight,
    docScroll: document.documentElement.scrollWidth, winScrollW: q('#win').scrollWidth, winClientW: q('#win').clientWidth,
    winScrollH: q('#win').scrollHeight, winClientH: q('#win').clientHeight,
    card: r(card), cardScrollW: card.scrollWidth, cardClientW: card.clientWidth,
    sc: r(q('.sc')),
    rows: [...document.querySelectorAll('.sc-row')].map(el => ({ ...r(el), in: el.classList.contains('sc-in'), vis: getComputedStyle(el).visibility, text: el.innerText.replace(/\n/g, ' | ') })),
    go: q('.sc-go') && r(q('.sc-go')), stay: r(q('.sc-stay')), skip: r(q('.sc-skip')),
    bar: r(q('.sc-bar')), fill: r(q('.sc-bar i')), barDisplay: getComputedStyle(q('.sc-bar')).display,
    fillBg: getComputedStyle(q('.sc-bar i')).backgroundColor, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent'),
    count: q('.sc-count').textContent, active: document.activeElement?.className || document.activeElement?.tagName,
    live: q('.sc [role=status]').textContent, calls: window.__calls,
    skipVis: getComputedStyle(q('.sc-skip')).visibility, nextVis: getComputedStyle(q('.sc-next')).visibility,
  };
});

const shapes = [{ w: 1440, h: 900, tag: 'desk' }, { w: 390, h: 844, tag: 'phone' }];
const themes = (only('themes') ?? 'default,grove,broadsheet').split(',');
const looks = ['dark', 'light'];
const report = [];
const mode = only('mode') ?? 'shots';

if (mode === 'shots') {
  for (const s of shapes) for (const theme of themes) for (const look of looks) for (const sign of ['pos', 'neg']) {
    const { ctx, page, errors } = await open({ w: s.w, h: s.h, theme, look });
    await mount(page, sign, {});
    await page.waitForTimeout(1500);
    const base = `${OUT}/${s.tag}-${theme}-${look}-${sign}`;
    await page.screenshot({ path: `${base}-mid.png` });
    const mid = await measure(page);
    await page.evaluate(() => window.__pb.skip());
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${base}-done.png` });
    const done = await measure(page);
    report.push({ file: base, errors, midRowsIn: mid.rows.map(r => r.in ? 1 : 0).join(''), docScroll: done.docScroll, vw: done.vw,
      winOverflowX: done.winScrollW > done.winClientW, cardOverflowX: done.cardScrollW > done.cardClientW, card: done.card, sc: done.sc,
      winOverflowY: done.winScrollH > done.winClientH, go: done.go, stay: done.stay, skip: mid.skip, bar: done.bar, fill: done.fill,
      fillBg: done.fillBg, accent: done.accent, count: done.count, active: done.active });
    await ctx.close();
  }
  console.log(JSON.stringify(report, null, 0).replace(/},{"file"/g, '},\n{"file"'));
}

if (mode === 'behaviour') {
  const log = (...a) => console.log(...a);
  // 1. onNext fires exactly once after the countdown.
  {
    const { ctx, page, errors } = await open({ w: 390, h: 844, theme: 'default', look: 'dark' });
    await mount(page, 'pos', { countdownMs: 3000 });
    const t0 = Date.now();
    await page.waitForFunction(() => document.querySelector('.sc').classList.contains('sc-done'));
    const revealMs = Date.now() - t0;
    const m0 = await measure(page);
    await page.waitForTimeout(1600);
    const m1 = await measure(page);
    await page.waitForTimeout(2000);
    const m2 = await measure(page);
    await page.waitForTimeout(4000);
    const m3 = await measure(page);
    log('countdown', JSON.stringify({ revealMs, atStart: { count: m0.count, active: m0.active, calls: m0.calls, live: m0.live },
      mid: { count: m1.count, fill: m1.fill, bar: m1.bar, calls: m1.calls }, after: m2.calls, later: m3.calls, errors }));
    await ctx.close();
  }
  // 2. Stay cancels it.
  {
    const { ctx, page, errors } = await open({ w: 390, h: 844, theme: 'default', look: 'dark' });
    await mount(page, 'neg', { countdownMs: 3000 });
    await page.evaluate(() => window.__pb.skip());
    await page.waitForTimeout(800);
    const before = await measure(page);
    await page.click('.sc-stay');
    await page.waitForTimeout(4500);
    const after = await measure(page);
    await page.screenshot({ path: `${OUT}/phone-default-dark-neg-stayed.png` });
    log('stay', JSON.stringify({ negFill: before.fill, negBar: before.bar, calls: after.calls, active: after.active,
      lineShown: await page.isVisible('.sc-line'), barShown: await page.isVisible('.sc-bar'), errors }));
    await page.click('.sc-go');
    await page.click('.sc-go');
    log('stay-then-go', JSON.stringify(await page.evaluate(() => window.__calls)));
    await ctx.close();
  }
  // 3. Reduced motion renders instantly.
  for (const look of ['dark', 'light']) {
    const { ctx, page, errors } = await open({ w: 390, h: 844, theme: 'default', look, motion: 'reduce' });
    const motion = await page.evaluate(() => document.documentElement.dataset.motion);
    await mount(page, 'pos', { reduceMotion: true, countdownMs: 3000 });
    const m = await measure(page);   // same task as the mount: no frame has run
    await page.screenshot({ path: `${OUT}/phone-default-${look}-pos-reduced.png` });
    const anims = await page.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.closest?.('.sc')).length);
    await page.waitForTimeout(3500);
    log('reduced', look, JSON.stringify({ motion, rowsIn: m.rows.map(r => r.in ? 1 : 0).join(''), vis: m.rows.map(r => r.vis[0]).join(''),
      nums: m.rows.map(r => r.text), barDisplay: m.barDisplay, count: m.count, skipVis: m.skipVis, nextVis: m.nextVis,
      go: m.go, stay: m.stay, active: m.active, scAnimations: anims, callsAfter: await page.evaluate(() => window.__calls), errors }));
    await ctx.close();
  }
  // 4. Pause while hidden (emulated via a page-level override of document.hidden + event).
  {
    const { ctx, page, errors } = await open({ w: 1440, h: 900, theme: 'default', look: 'dark' });
    await mount(page, 'pos', { countdownMs: 3000, reduceMotion: true });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const hiddenAt = await measure(page);
    await page.waitForTimeout(4000);
    const stillHidden = await measure(page);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(1300);
    const resumed = await measure(page);
    await page.waitForTimeout(800);
    const fired = await measure(page);
    log('hidden', JSON.stringify({ hiddenAt: [hiddenAt.count, hiddenAt.calls], afterHidden4s: [stillHidden.count, stillHidden.calls],
      resumed1300: [resumed.count, resumed.calls], after2100: fired.calls, errors }));
    await ctx.close();
  }
  // 5. Focus is not stolen from a field outside the card.
  {
    const { ctx, page, errors } = await open({ w: 1440, h: 900, theme: 'default', look: 'dark' });
    await page.evaluate(() => { const i = document.createElement('input'); i.id = 'outside'; document.body.append(i); i.focus(); });
    await mount(page, 'pos', { reduceMotion: true });
    log('focus-outside', await page.evaluate(() => document.activeElement.id));
    await ctx.close();
  }
}

if (mode === 'wipe') {
  for (const [w, h, tag] of [[390, 844, 'phone'], [1440, 900, 'desk']]) for (const look of ['dark', 'light']) {
    const { ctx, page } = await open({ w, h, theme: 'default', look });
    await mount(page, 'pos', {});
    // Row 3 starts at 1710ms; freeze its wipe part-way so the shot is deterministic.
    await page.waitForFunction(() => document.querySelectorAll('.sc-row.sc-in').length === 4);
    const info = await page.evaluate(() => {
      const row = document.querySelectorAll('.sc-row.sc-in')[3];
      const [a] = row.getAnimations();
      a.pause(); a.currentTime = 110;
      return { name: a.animationName, clip: getComputedStyle(row).clipPath };
    });
    await page.screenshot({ path: `${OUT}/${tag}-default-${look}-pos-wipe.png` });
    console.log('wipe', tag, look, JSON.stringify(info));
    await ctx.close();
  }
}
if (mode === 'extra') {
  for (const [w, h, tag] of [[844, 390, 'landscape'], [320, 568, 'se']]) for (const sign of ['pos', 'neg']) {
    const { ctx, page, errors } = await open({ w, h, theme: 'default', look: 'dark' });
    await mount(page, sign, {});
    await page.evaluate(() => window.__pb.skip());
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${tag}-default-dark-${sign}-done.png` });
    const m = await measure(page);
    console.log(tag, sign, JSON.stringify({ errors, docScroll: m.docScroll, vw: m.vw, ovX: [m.winScrollW > m.winClientW, m.cardScrollW > m.cardClientW],
      winScrollH: m.winScrollH, vh: m.vh, card: m.card, sc: m.sc, rowsH: m.rows.map(r => r.h).join(','), go: m.go }));
    await ctx.close();
  }
}
await browser.close();
server.kill();
