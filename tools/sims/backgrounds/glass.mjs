// How clear the glass can be: for every background x look x shape, the least share of the surface
// each piece of text needs under it for AA, against the share styles.css gives it. The page is
// shot with its board, header and list at 0% and at 100% surface, each over its own backdrop
// filter, so any share s composites as s*X100 + (1-s)*X0 (a shot at 50% matches that but for a few
// antialiased pixels). The ring within 2px of each glyph is what counts: 95% of it must reach 4.5:1,
// or 3:1 for large text, as tools/sims/backgrounds/contrast.mjs holds it.
// Board letters are held to --glass-board, the words to --glass-list, the count row to BAND and the
// header to HDR, each capped by the background's own share when it has one (--clear-board,
// --clear-list, from src/glass-shares.js). Exits 1 when a share is short; the summary
// gives each look's needs. Each look takes FRAMES frames GAP ms apart and keeps the worst; the
// backgrounds that draw the subject's icons (perDeal) run once per subject in SUBJECTS.
//   node tools/sims/backgrounds/glass.mjs                      every background, phone
//   SHAPES=phone,landscape,desktop ONLY=voronoi,drift LOOKS=plum/dark STYLE=glass
//   FRAMES=3 GAP=1500 SUBJECTS=animals/frogs,food/sushi
//   WORKERS=4 WAIT=700 OUT=needs.jsonl                         a JSON line per job, for
//   tools/sims/backgrounds/glass-shares.mjs to turn into src/glass-shares.js
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { serve } from '../site.mjs';
import { BACKGROUNDS } from '../../../src/backgrounds.js';
import { THEMES, PREFS } from '../../../src/appearance.js';
import { findAndDrag } from '../../../tests/e2e/helpers.js';

const list = (k, all) => (process.env[k] ? process.env[k].split(',') : all);
const IDS = list('ONLY', BACKGROUNDS.map(b => b.id));
const ALL_SHAPES = { phone: [390, 664], landscape: [844, 390], desktop: [1440, 900] };
const SHAPES = list('SHAPES', ['phone']);
const LOOKS = list('LOOKS', THEMES.flatMap(t => PREFS.map(p => `${t}/${p}`)));
const STYLE = process.env.STYLE || 'beads';
const SUBJECTS = list('SUBJECTS', [process.env.SUBJECT || 'history/industrial-revolution']);
const WORKERS = Number(process.env.WORKERS || 4), WAIT = Number(process.env.WAIT || 700);
const FRAMES = Number(process.env.FRAMES || 1), GAP = Number(process.env.GAP || 1500);
// The frosted shares in styles.css: the list's count row and the header.
const BAND = 0.9, HDR = 0.88;
const STEPS = Array.from({ length: 21 }, (_, i) => i / 20);
const GROUP = { cell: 'board', '.w': 'list', '.w.done': 'list', '#count': 'band', '#reveal': 'band', '#category': 'hdr', '#subject': 'hdr' };
const ROLES = ['.w', '#count', '#reveal', '#category', '#subject', '#letters .cell'];

const jobs = [];
for (const shape of SHAPES) for (const id of IDS) {
  const bg = BACKGROUNDS.find(b => b.id === id);
  if (bg) for (const subject of bg.perDeal ? SUBJECTS : SUBJECTS.slice(0, 1)) jobs.push({ shape, id, subject });
}
console.log(`${jobs.length} jobs x ${LOOKS.length} looks x ${FRAMES} frames, style ${STYLE}`);
const site = await serve();
const proxy = process.env.HTTPS_PROXY;   // the theme fonts come from Google Fonts
const browser = await chromium.launch(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {});
const out = process.env.OUT ? fs.createWriteStream(process.env.OUT, { flags: 'a' }) : null;
/** look -> group -> [need, where, the share it had there] @type {Record<string, Record<string, [number, string, number]>>} */
const needs = {};
/** Each background x look x role whose share was short. */
let shortfalls = 0;

/** The cards at a share of the surface, over their own backdrop filters. @param {number} a */
const cardCss = (a) => `#app :is(#gridbox,#hdr,#side){background-color:color-mix(in srgb,var(--surface) ${a}%,transparent)!important}
  #app #side{background-image:none!important}`;

/** One background x shape x subject, through every look. */
async function run({ shape, id, subject }, math) {
  const [w, h] = ALL_SHAPES[shape];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: w < 600 });
  const page = await ctx.newPage();
  await page.addInitScript((s) => {
    localStorage.setItem('wordfinder-settings-v1', s);
    const raf = window.requestAnimationFrame.bind(window);
    /** @type {FrameRequestCallback[]} */ let held = [];
    const g = /** @type {any} */ (window);
    g.__freeze = () => { held = []; window.requestAnimationFrame = (cb) => { held.push(cb); return 0; }; };
    // Each held frame is released once: releasing one twice would start a second loop.
    g.__thaw = () => { window.requestAnimationFrame = raf; const x = held; held = []; for (const cb of x) raf(cb); };
  }, JSON.stringify({ bgmode: 'manual', art: id, style: STYLE, autoNext: false }));
  await page.goto(`${site.url}/?seed=1&subject=${subject}`);
  await page.waitForSelector('.cell');
  await page.waitForSelector('#bg > *', { state: 'visible' }).catch(() => {});
  // Four finds, then every other word marked found, so found and plain words both sit over it.
  const words = (await page.locator('#list .w').allTextContents()).slice(0, 4);
  for (const word of words) await findAndDrag(page, word.trim().toUpperCase());
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1200);   // the find's glow and confetti
  await page.evaluate(() => document.querySelectorAll('.w').forEach((e, i) => { if (i % 2) e.className = 'w done'; }));
  const sel = ROLES.join(',');
  const tag = (/** @type {string} */ css) => page.addStyleTag({ content: css });
  const ground = (/** @type {string} */ c) => page.evaluate((c) => { document.documentElement.style.background = c; document.body.style.background = c; }, c);
  /** @type {Record<string, Record<string, number>>} */
  const res = {};
  /** look -> group -> the share this background has in it @type {Record<string, Record<string, number>>} */
  const shares = {};
  for (const look of LOOKS) {
    // Through the app's own controls, so the background restarts in the look's colours.
    const moved = await page.evaluate((look) => {
      const r = /** @type {HTMLInputElement | null} */ (document.querySelector(`input[name="look"][value="${look}"]`));
      if (!r || r.checked) return false;
      document.querySelectorAll('#bg > *').forEach(e => e.setAttribute('data-old', ''));
      r.checked = true;
      r.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, look);
    if (moved) await page.waitForSelector('#bg > *:not([data-old])', { timeout: 3000 }).catch(() => {});
    const info = await page.evaluate((sel) => {
      const root = getComputedStyle(document.documentElement);
      const pct = (/** @type {string} */ k, /** @type {number} */ d) => { const v = parseFloat(root.getPropertyValue(k)); return Number.isNaN(v) ? d : v / 100; };
      return {
        share: { board: Math.min(pct('--glass-board', 1), pct('--clear-board', 1)), list: Math.min(pct('--glass-list', 1), pct('--clear-list', 1)),
        },
        boxes: [...document.querySelectorAll(sel)].map(e => ({ e, b: e.getBoundingClientRect(), cs: getComputedStyle(e) }))
          .filter(x => x.b.width > 0 && x.b.height > 0 && x.cs.visibility !== 'hidden' && x.cs.display !== 'none')
          .map(({ e, b, cs }) => {
            const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
            const role = e.matches('.cell.found') ? 'cell found' : e.matches('.cell') ? 'cell' : e.matches('.w.done') ? '.w.done' : e.matches('.w') ? '.w' : `#${e.id}`;
            return { role, need: size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5, fg: cs.color,
              x: Math.max(0, Math.floor(b.x) - 4), y: Math.max(0, Math.floor(b.y) - 4), w: Math.ceil(b.width) + 8, h: Math.ceil(b.height) + 8 };
          }),
      };
    }, sel);
    shares[look] = { ...info.share, band: BAND, hdr: HDR };
    // Glyphs alone, in black on white; then the pills alone, so a plain letter's ring leaves out a
    // diagonal pill grazing it.
    await ground('#ffffff');
    const hideBg = await tag('#bg{visibility:hidden!important} #settings,#toast{display:none}');
    let s = await tag(`body *{visibility:hidden!important} :is(${sel}),:is(${sel}) *{visibility:visible!important;color:#000!important;`
      + 'text-shadow:none!important;border-color:transparent!important;background:transparent!important;box-shadow:none!important}');
    const glyph = (await page.screenshot()).toString('base64');
    await s.evaluate(n => n.remove());
    s = await tag('body *{visibility:hidden!important} #pills .pill{visibility:visible!important;filter:brightness(0)}');
    const pills = (await page.screenshot()).toString('base64');
    await s.evaluate(n => n.remove());
    await hideBg.evaluate(n => n.remove());
    await ground('');
    // FRAMES frames of the background, each frozen under the cards at 100% and at 0%; the worst counts.
    res[look] = {};
    for (let f = 0; f < FRAMES; f++) {
      await page.waitForTimeout(f ? GAP : WAIT);
      await page.evaluate(() => /** @type {any} */ (window).__freeze());
      await page.waitForTimeout(60);
      const hideText = await tag(`:is(${sel}){color:transparent!important} #settings,#toast{display:none}`);
      const shots = [];
      for (const a of [100, 0]) {
        s = await tag(cardCss(a));
        await page.waitForTimeout(30);
        shots.push((await page.screenshot()).toString('base64'));
        await s.evaluate(n => n.remove());
      }
      await hideText.evaluate(n => n.remove());
      await page.evaluate(() => /** @type {any} */ (window).__thaw());

      /** @type {Record<string, number>} */
      const frame = await math.evaluate(async ([glyphPng, pillPng, solidPng, clearPng, boxes, steps]) => {
        /** @param {string} b64 */
        const pixels = async (b64) => {
          const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
          const c = new OffscreenCanvas(img.width, img.height), x = /** @type {OffscreenCanvasRenderingContext2D} */ (c.getContext('2d'));
          x.drawImage(img, 0, 0); return { d: x.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height };
        };
        const G = await pixels(glyphPng), P = await pixels(pillPng), S = await pixels(solidPng), K = await pixels(clearPng);
        /** @param {string} s */
        const parse = (s) => { const m = (s.match(/[\d.]+/g) ?? []).map(Number); return [m[0], m[1], m[2], m[3] ?? 1]; };
        /** @param {number} v */
        const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        /** @param {number[]} c */
        const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
        const ink = (/** @type {number} */ i) => 1 - G.d[i * 4 + 1] / 255;
        const pill = (/** @type {number} */ i) => 1 - P.d[i * 4 + 1] / 255;
        /** @type {Record<string, number>} */
        const worst = {};
        for (const box of boxes) {
          const T = parse(box.fg), zone = [];
          const x1 = Math.min(G.w, box.x + box.w), y1 = Math.min(G.h, box.y + box.h);
          for (let y = box.y; y < y1; y++) for (let x = box.x; x < x1; x++) {
            if (ink(y * G.w + x) > 0.1 || (box.role === 'cell' && pill(y * G.w + x) > 0.1)) continue;
            let near = false;
            for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
              const yy = y + dy, xx = x + dx;
              if (dx * dx + dy * dy <= 4 && yy >= 0 && yy < G.h && xx >= 0 && xx < G.w && ink(yy * G.w + xx) > 0.4) { near = true; break; }
            }
            if (near) zone.push(y * G.w + x);
          }
          if (!zone.length) continue;
          // The 5th percentile of the ring's contrast at each share; the need is the least share from
          // which every higher one passes (2 if not even a solid card does).
          const p5 = steps.map(a => {
            const v = zone.map(i => {
              const px = [0, 1, 2].map(c => a * S.d[i * 4 + c] + (1 - a) * K.d[i * 4 + c]);
              const t = px.map((q, c) => T[c] * T[3] + q * (1 - T[3]));
              const lt = L(t), lp = L(px);
              return (Math.max(lt, lp) + 0.05) / (Math.min(lt, lp) + 0.05);
            }).sort((m, q) => m - q);
            return v[Math.floor(v.length * 0.05)];
          });
          let m = p5[steps.length - 1] < box.need ? 2 : 1;
          for (let k = steps.length - 1; k >= 0 && p5[k] >= box.need; k--) m = steps[k];
          worst[box.role] = Math.max(worst[box.role] ?? 0, m);
        }
        return worst;
      }, [glyph, pills, shots[0], shots[1], info.boxes, STEPS]);
      for (const [role, m] of Object.entries(frame)) res[look][role] = Math.max(res[look][role] ?? 0, m);
    }
    for (const [role, m] of Object.entries(res[look])) {
      const g = GROUP[role];
      if (!g) continue;
      const n = (needs[look] ??= {})[g] ??= [0, '', 1];
      if (m > n[0]) needs[look][g] = [m, `${id}/${shape}${subject === SUBJECTS[0] ? '' : ` ${subject}`}`, shares[look][g]];
    }
  }
  await ctx.close();
  out?.write(JSON.stringify({ shape, id, subject, style: STYLE, frames: FRAMES, res }) + '\n');
  const short = Object.entries(res).flatMap(([look, r]) => Object.entries(r).filter(([role, m]) => GROUP[role] && m > shares[look][GROUP[role]] + 1e-9)
    .map(([role, m]) => `${look} ${role} needs ${m}, has ${shares[look][GROUP[role]]}`));
  shortfalls += short.length;
  console.log(`${short.length ? 'FAIL' : 'ok  '} ${shape.padEnd(9)} ${id}${subject === SUBJECTS[0] ? '' : ` ${subject}`}${short.length ? `: ${short.join(', ')}` : ''}`);
}

let next = 0;
await Promise.all(Array.from({ length: Math.min(WORKERS, jobs.length) }, async () => {
  const math = await (await browser.newContext()).newPage();
  while (next < jobs.length) await run(jobs[next++], math);
}));
await browser.close();
site.close();
out?.end();
console.log('\nEach look: the share each group needs at worst (where), against what it had there.');
for (const look of Object.keys(needs).sort()) {
  const row = Object.entries(needs[look]).map(([g, [m, at, has]]) => `${g} ${m.toFixed(2)}/${has.toFixed(2)}${m > has + 1e-9 ? ' SHORT' : ''} (${at})`);
  console.log(`  ${look.padEnd(17)} ${row.join('  ')}`);
}
console.log(shortfalls ? `${shortfalls} shares short of AA (the FAIL lines)` : 'every share keeps its text at AA');
process.exit(shortfalls ? 1 : 0);
