#!/usr/bin/env node
// Behaviour and cost checks for the animated backgrounds in src/backgrounds/, each run
// full-page in preview.html on its own server. Exits 1 when any module breaks an expectation:
// it paints, it pauses while the tab is hidden and resumes after, it re-sizes its canvas and
// still covers the page after a resize, stop() empties the host, ends drawing and lets go of
// every resize and visibility listener and ResizeObserver, and reduced motion draws no frames.
//
// Usage (from the repo root):
//   node tools/art-src/prototypes/check.mjs                  every animated registry entry
//   node tools/art-src/prototypes/check.mjs pixel-skyline    one or more src/backgrounds/ files
//   ... --hz=165       fake a 165Hz display (rAF on a timer); then each must draw 30fps (+-1)
//   ... --big          also per-frame cost and main-thread busy % at 1920x1080 and 3840x2160
//   ... --shots[=dir]  screenshots dark/light/rm/phone (default dir .shots/backgrounds/)
//   ... --webkit       run in WebKit instead of Chromium (no busy %)
//   ... --serve        just serve, and print the gallery and preview URLs
//   ... --src=<url>    load the module from this URL instead (to plant a broken copy)

import { chromium, webkit } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BACKGROUNDS } from '../../../src/backgrounds.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2);
const flag = (k) => args.find((a) => a === `--${k}` || a.startsWith(`--${k}=`));
const value = (k) => flag(k)?.split('=').slice(1).join('=') || '';
const hz = Number(value('hz')) || 0;
const names = args.filter((a) => !a.startsWith('--'));
const files = names.length ? names : BACKGROUNDS.filter((b) => b.file && b.animated).map((b) => b.file);
const shotsDir = flag('shots') ? (value('shots') || join(ROOT, '.shots/backgrounds')) : '';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('404');
  }
});
// Port 0: a fresh origin every run, so no service worker from an app visit can answer.
await new Promise((r) => server.listen(0, '127.0.0.1', () => r(undefined)));
const base = `http://127.0.0.1:${/** @type {any} */ (server.address()).port}/tools/art-src/prototypes/`;

/** Runs in the page before any script: counts rAF frames that drew, times them, fakes visibility,
 * and lists the resize and visibility listeners and ResizeObservers still held. */
function instrument(hz) {
  const w = /** @type {any} */ (window);
  if (hz > 0) {
    // Timer-driven rAF with vsync-aligned timestamps, as a display at `hz` would give.
    // A late timer skips slots like a real display; one that fires early still gets the next slot.
    const period = 1000 / hz, t0 = performance.now(), queue = new Map();
    let next = 1, timer = 0, slot = 0;
    const tick = () => {
      timer = 0;
      slot = Math.max(slot + 1, Math.floor((performance.now() - t0) / period));
      const due = [...queue.values()]; queue.clear();
      for (const cb of due) cb(t0 + slot * period);
    };
    w.requestAnimationFrame = (cb) => {
      queue.set(next, cb);
      if (!timer) timer = setTimeout(tick, Math.max(0, t0 + (slot + 1) * period - performance.now()));
      return next++;
    };
    w.cancelAnimationFrame = (id) => { queue.delete(id); };
  }
  const raf = w.requestAnimationFrame.bind(w);
  let dirty = false;
  const P = CanvasRenderingContext2D.prototype;
  for (const k of ['clearRect', 'fillRect', 'drawImage', 'putImageData', 'fill', 'stroke', 'fillText']) {
    const orig = P[k];
    P[k] = function (...a) { dirty = true; return orig.apply(this, a); };
  }
  w.__calls = 0; w.__drawn = 0; w.__cost = [];
  w.requestAnimationFrame = (cb) => raf((ts) => {
    w.__calls++; dirty = false;
    const t = performance.now();
    cb(ts);
    if (dirty) { w.__drawn++; w.__cost.push(performance.now() - t); }
  });
  let hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  w.__setHidden = (h) => { hidden = h; document.dispatchEvent(new Event('visibilitychange')); };
  const held = w.__held = [];
  const T = EventTarget.prototype, add = T.addEventListener, rm = T.removeEventListener;
  T.addEventListener = function (type, fn, o) {
    if (type === 'resize' || type === 'visibilitychange') held.push([this, type, fn]);
    return add.call(this, type, fn, o);
  };
  T.removeEventListener = function (type, fn, o) {
    const i = held.findIndex((x) => x[0] === this && x[1] === type && x[2] === fn);
    if (i >= 0) held.splice(i, 1);
    return rm.call(this, type, fn, o);
  };
  const RO = ResizeObserver.prototype, observe = RO.observe, disconnect = RO.disconnect;
  RO.observe = function (...a) { held.push([this, 'ResizeObserver']); return observe.apply(this, a); };
  RO.disconnect = function () {
    for (let i = held.length - 1; i >= 0; i--) if (held[i][0] === this) held.splice(i, 1);
    return disconnect.call(this);
  };
}

/** In the page: the biggest canvas under #bg, its CSS box and cell size, and how many pixels are
 * painted. Read through a copy, so the module's own context never sees a readback. */
function canvasState() {
  const all = [...document.querySelectorAll('#bg canvas')];
  const c = /** @type {HTMLCanvasElement|undefined} */ (all.sort((a, b) => b.width * b.height - a.width * a.height)[0]);
  if (!c) return null;
  const r = c.getBoundingClientRect();
  const copy = document.createElement('canvas');
  copy.width = c.width; copy.height = c.height;
  const ctx = copy.getContext('2d', { willReadFrequently: true });
  let painted = 0;
  if (ctx && c.width && c.height) {
    ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) painted++;
  }
  return { w: c.width, h: c.height, cell: c.width ? r.width / c.width : 0, left: r.left, top: r.top, right: r.right, bottom: r.bottom, painted };
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2) : 0; };

async function run() {
  const engine = flag('webkit') ? webkit : chromium;
  const browser = await engine.launch();
  const src = value('src');
  const url = (file, q = '') => `${base}preview.html?name=${file}${src ? `&src=${encodeURIComponent(src)}` : ''}${q}`;
  if (shotsDir) await mkdir(shotsDir, { recursive: true });
  let failed = 0;

  /** @param {{width:number,height:number}} viewport */
  async function open(file, q, viewport) {
    const page = await browser.newPage({ viewport });
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.addInitScript(instrument, hz);
    await page.goto(url(file, q));
    await page.waitForFunction(() => /** @type {any} */ (window).__ready, null, { timeout: 5000 }).catch(() => errs.push('never ready'));
    return { page, errs };
  }
  const drawn = (page) => page.evaluate(() => /** @type {any} */ (window).__drawn);

  for (const file of files) {
    const bad = [];
    // Animated, at a laptop size.
    const { page, errs } = await open(file, '', { width: 1280, height: 800 });
    await pause(1500);
    const first = await page.evaluate(canvasState);
    if (!first?.painted) bad.push('nothing painted');
    await page.evaluate(() => { const w = /** @type {any} */ (window); w.__cost = []; w.__calls = 0; w.__drawn = 0; });
    await pause(2000);
    const live = await page.evaluate(() => { const w = /** @type {any} */ (window); return { calls: w.__calls, drawn: w.__drawn, cost: w.__cost }; });
    const fps = live.drawn / 2;
    if (fps < 5) bad.push(`only ${fps} fps`);
    // The cap is exactly 30 at any refresh rate (handoff question 5), measurable once rAF is faked.
    if (hz && Math.abs(fps - 30) > 1) bad.push(`${fps} fps at ${hz}Hz, not 30`);

    await page.evaluate(() => /** @type {any} */ (window).__setHidden(true));
    await pause(100);
    const h0 = await drawn(page); await pause(700); const hiddenDraws = (await drawn(page)) - h0;
    if (hiddenDraws) bad.push(`${hiddenDraws} draws while hidden`);
    await page.evaluate(() => /** @type {any} */ (window).__setHidden(false));
    await pause(600);
    const resumed = (await drawn(page)) - h0 - hiddenDraws;
    if (!resumed) bad.push('did not resume');

    await page.setViewportSize({ width: 600, height: 500 });
    await pause(400);
    const small = await page.evaluate(canvasState);
    // Grids sized by floor leave under one cell bare at the right and bottom; that is allowed.
    const slack = Math.max(1, small?.cell ?? 0);
    const covers = small && small.left <= 0 && small.top <= 0 && small.right > 600 - slack && small.bottom > 500 - slack;
    if (!covers) bad.push(`canvas no longer covers 600x500: ${JSON.stringify(small)}`);
    // A stretched canvas covers without help, so also require a new backing size.
    if (small && first && small.w === first.w && small.h === first.h) bad.push(`backing store still ${small.w}x${small.h} after resize`);

    const { kids, held } = await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      w.__stop();
      return { kids: document.getElementById('bg')?.childElementCount, held: w.__held.map((x) => x[1]) };
    });
    const s0 = await drawn(page); await pause(500); const afterStop = (await drawn(page)) - s0;
    if (kids || afterStop || held.length) bad.push(`after stop(): ${kids} children, ${afterStop} draws, still held: ${held.join(', ') || 'none'}`);
    await page.close();

    // Reduced motion: one still picture, no frames.
    const rm = await open(file, '&rm', { width: 1280, height: 800 });
    await pause(800);
    const r0 = await drawn(rm.page); await pause(1000); const rmDraws = (await drawn(rm.page)) - r0;
    const still = await rm.page.evaluate(canvasState);
    if (rmDraws) bad.push(`${rmDraws} frames under reduced motion`);
    if (!still?.painted) bad.push('reduced motion painted nothing');
    await rm.page.close();
    errs.push(...rm.errs);
    if (errs.length) bad.push(`errors: ${JSON.stringify(errs)}`);

    const line = `${file.padEnd(16)} ${fps.toFixed(1)} fps (rAF ${(live.calls / 2).toFixed(0)}/s${hz ? ` at fake ${hz}Hz` : ''})  ` +
      `frame ${pct(live.cost, 0.5)}ms p95 ${pct(live.cost, 0.95)}ms  hidden ${hiddenDraws}  resumed ${resumed}  rm ${rmDraws}`;
    console.log(`${bad.length ? 'FAIL' : 'ok  '} ${line}${bad.length ? '\n     ' + bad.join('\n     ') : ''}`);
    if (bad.length) failed++;

    if (flag('big')) {
      for (const vp of [{ width: 1920, height: 1080 }, { width: 3840, height: 2160 }]) {
        const big = await open(file, '', vp);
        await pause(1000);
        const cdp = engine === chromium ? await big.page.context().newCDPSession(big.page) : null;
        const task = async () => {
          if (!cdp) return 0;
          const { metrics } = await cdp.send('Performance.getMetrics');
          return metrics.find((m) => m.name === 'TaskDuration')?.value ?? 0;
        };
        if (cdp) await cdp.send('Performance.enable');
        await big.page.evaluate(() => { const w = /** @type {any} */ (window); w.__cost = []; w.__drawn = 0; });
        const t0 = await task(); await pause(3000); const t1 = await task();
        const m = await big.page.evaluate(() => { const w = /** @type {any} */ (window); return { drawn: w.__drawn, cost: w.__cost }; });
        console.log(`     ${vp.width}x${vp.height}: ${(m.drawn / 3).toFixed(1)} fps  frame ${pct(m.cost, 0.5)}ms p95 ${pct(m.cost, 0.95)}ms` +
          (cdp ? `  main thread busy ${((t1 - t0) / 3 * 100).toFixed(1)}%` : ''));
        await big.page.close();
      }
    }

    if (shotsDir) {
      for (const [suffix, q, viewport] of [['', '', { width: 1280, height: 800 }], ['-light', '&light', { width: 1280, height: 800 }],
        ['-rm', '&rm', { width: 1280, height: 800 }], ['-phone', '', { width: 390, height: 844 }]]) {
        const s = await open(file, q, viewport);
        await pause(1500);
        await s.page.screenshot({ path: join(shotsDir, `${file}${suffix}${flag('webkit') ? '-webkit' : ''}.png`) });
        await s.page.close();
      }
    }
  }
  await browser.close();
  if (shotsDir) console.log(`screenshots in ${shotsDir}`);
  console.log(failed ? `${failed} of ${files.length} failed` : `all ${files.length} passed`);
  return failed ? 1 : 0;
}

if (flag('serve')) {
  console.log(`gallery: ${base}gallery.html  (?light, ?rm)\npreview: ${base}preview.html?name=${files[0]}  (&light, &rm)\nCtrl-C to stop.`);
} else {
  process.exitCode = await run();
  server.close();
}
