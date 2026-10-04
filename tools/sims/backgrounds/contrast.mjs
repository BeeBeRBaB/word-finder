// WCAG contrast of what sits over a background, for every background x area x shape x look, a
// theme in one flavour (the animations take their colours from the look, so each is run in it).
// Each frame is captured at full opacity over a black and a white ground, which gives every
// pixel's colour and coverage, so any host opacity is composited in the math. So is everything
// the page paints between the background and the glyph (a halo, a plate, the see-through board
// in Full screen, its pills), captured the same way. What counts is the ring within 2px of each
// glyph, where legibility is decided. 95% of that ring must reach 4.5:1 for text (3:1 if large)
// and 3:1 for icons. The board's letters are measured over a Full screen background and over the
// still art in the board corner, whose "host opacity" is --art-board. Prints the highest host
// opacity that would pass as well. Exits 1 if the stylesheet's opacity fails anywhere.
//   node tools/sims/backgrounds/contrast.mjs
//   ONLY=aurora,starfield MODES=dark AREAS=full SHAPES=phone LOOKS=sticker/dark node tools/sims/backgrounds/contrast.mjs
//   NOHALO=1 strips text-shadow, to see what a halo is buying; CSS='...' adds a rule, to try one;
//   RING=3 widens the ring; DEBUG=<dir> saves the masks and prints each box; SUBJECT=nature/fish deals it.
import { chromium } from '@playwright/test';
import { serve } from '../site.mjs';
import { BACKGROUNDS } from '../../../src/backgrounds.js';
import { THEMES, PREFS } from '../../../src/appearance.js';
import { findAndDrag } from '../../../tests/e2e/helpers.js';

const list = (k, all) => (process.env[k] ? process.env[k].split(',') : all);
const IDS = list('ONLY', BACKGROUNDS.filter(b => b.id !== 'none').map(b => b.id));
const MODES = list('MODES', PREFS);
const AREAS = list('AREAS', ['list', 'full']);
const ALL_SHAPES = { desktop: [1440, 900], phone: [390, 664], landscape: [844, 390] };
const SHAPES = list('SHAPES', Object.keys(ALL_SHAPES));
// Each look carries its flavour, so MODES narrows the looks rather than adding a loop.
const LOOKS = list('LOOKS', THEMES.flatMap(t => PREFS.map(p => `${t}/${p}`))).filter(l => MODES.includes(l.split('/')[1]));
const FRAMES = Number(process.env.FRAMES || 2);
// The dealt subject: the subject backgrounds draw its icons, and Subject motion its motion.
const SUBJECT = process.env.SUBJECT || 'history/industrial-revolution';
const WORKERS = Number(process.env.WORKERS || 3);
const STEPS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1];
const RING = Number(process.env.RING || 2);

// What sits over the background in each area. Icons need 3:1, as non-text.
const ROLES = {
  list: ['.w', '#listhdr b', '#count', '#reveal'],
  full: ['#kicker', '#category', '#subject', '#newbtn', '#appearance svg', '#catbtn svg'],
  board: ['#letters .cell'],
};
const ICONS = ['#appearance svg', '#catbtn svg'];

// A background with a module runs in either area. Plain still art in Word list sits in the board
// corner, under the letters, or in the landscape rail below the list, behind no text (run() skips
// that). So does the Subject scene in Word list on a phone held upright.
const jobs = [];
for (const shape of SHAPES) for (const area of AREAS) for (const id of IDS) {
  const bg = BACKGROUNDS.find(b => b.id === id);
  const corner = area === 'list' && (!bg?.file || (id === 'scene' && shape === 'phone'));
  if (bg) jobs.push({ shape, area, bg, corner });
}

console.log(`${jobs.length} jobs, each through ${LOOKS.length} looks: ${LOOKS.join(' ')}`);
const site = await serve();
const proxy = process.env.HTTPS_PROXY;   // the theme fonts come from Google Fonts
const browser = await chromium.launch(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {});
let failed = 0;

/** A selection held over four letters of one row with no find in it, drawn as view.js pillDiv
 * draws a drag's, its letters marked for the measure. Runs in the page. */
function select() {
  if (document.querySelector('.pill.sel[data-simsel]')) return;
  const cells = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('#letters .cell')]);
  const n = Math.round(Math.sqrt(cells.length)), cell = parseFloat(cells[0].style.width), pad = parseFloat(cells[0].style.left);
  const free = (y, x) => [0, 1, 2, 3].every(d => !cells[y * n + x + d].classList.contains('found'));
  for (const y of [...Array(n).keys()].sort((a, b) => Math.abs(a - n / 2) - Math.abs(b - n / 2))) {
    for (let x = 0; x + 3 < n; x++) {
      if (!free(y, x)) continue;
      const h = Math.round(cell * 0.82), d = document.createElement('div');
      d.className = 'pill sel';
      d.setAttribute('data-simsel', '');
      Object.assign(d.style, { left: `${Math.round(pad + (x + 0.5) * cell - h / 2)}px`, top: `${Math.round(pad + (y + 0.5) * cell - h / 2)}px`,
        width: `${Math.round(3 * cell + h)}px`, height: `${h}px` });
      document.getElementById('pills')?.appendChild(d);
      for (let k = 0; k < 4; k++) cells[y * n + x + k].setAttribute('data-simsel', '');
      return;
    }
  }
}
/** @type {Record<string, number>} */
const ceiling = {};

/** One background x area x shape, through every look. */
async function run(job, math) {
  const { shape, area, bg, corner } = job;
  const [w, h] = ALL_SHAPES[shape];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: w < 600 });
  const page = await ctx.newPage();
  await page.addInitScript((s) => {
    localStorage.setItem('wordfinder-settings-v1', s);
    const raf = window.requestAnimationFrame.bind(window);
    /** @type {FrameRequestCallback[]} */ let held = [];
    const w = /** @type {any} */ (window);
    w.__freeze = () => { held = []; window.requestAnimationFrame = (cb) => { held.push(cb); return 0; }; };
    // Each held frame is released once: releasing one twice would start a second loop.
    w.__thaw = () => { window.requestAnimationFrame = raf; const h = held; held = []; for (const cb of h) raf(cb); };
  }, JSON.stringify({ bgmode: 'manual', art: bg.id, area }));
  await page.goto(`${site.url}/?seed=1&subject=${SUBJECT}`);
  await page.waitForSelector('.cell');
  // The module draws into the board corner (#art) for the Subject scene there, else into its host.
  const host = corner ? '#art' : area === 'full' ? '#bg' : '#bgside';
  const layer = bg.file && !corner ? `${host} > *` : '#art svg';
  await page.waitForSelector(layer, { state: corner ? 'attached' : 'visible' });
  if (corner && await page.getAttribute('#app', 'data-art') === 'rail') {
    console.log(`skip ${bg.id.padEnd(13)} ${area.padEnd(4)} ${shape.padEnd(9)} in the rail, behind no text`);
    await ctx.close();
    return;
  }
  const roles = corner ? ROLES.board : [...ROLES.list, ...(area === 'full' ? [...ROLES.full, ...ROLES.board] : [])];
  // Four finds, one in each pill colour, before the list is faked: a find re-renders it.
  const words = (await page.locator('#list .w').allTextContents()).slice(0, 4);
  for (const w of words) await findAndDrag(page, w.trim().toUpperCase());
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1200);   // the find's glow and confetti
  await page.evaluate(() => document.querySelectorAll('.w').forEach((e, i) => { if (i % 2) e.className = 'w done'; }));
  const sel = roles.join(',');
  const tag = (css) => page.addStyleTag({ content: css });
  const ground = (c) => page.evaluate((c) => { document.documentElement.style.background = c; document.body.style.background = c; }, c);
  if (process.env.NOHALO) await tag('*{text-shadow:none!important}');
  if (process.env.CSS) await tag(process.env.CSS);
  /** @type {Record<string, {score:number, at:string, need:number, max:number}>} */
  const worst = {};
  let opacity = 1;

  for (const look of LOOKS) {
    if (process.env.DEBUG) console.log('look', bg.id, shape, look, new Date().toISOString().slice(11, 19));
    // Through the app's own controls, so the background restarts in the look's colours.
    const moved = await page.evaluate(([look, layer]) => {
      const r = /** @type {HTMLInputElement} */ (document.querySelector(`input[name="look"][value="${look}"]`));
      if (r.checked) return false;
      document.querySelector(layer)?.setAttribute('data-old', '');
      r.checked = true;
      r.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, [look, layer]);
    if (moved && bg.file) await page.waitForSelector(`${layer}:not([data-old])`, { timeout: 5000 }).catch(() => {});
    if (roles.includes(ROLES.board[0])) await page.evaluate(select);
    const info = await page.evaluate(([sel, icons, layer]) => {
      const r = document.documentElement;
      return {
        bg: getComputedStyle(r).getPropertyValue('--bg').trim(),
        opacity: parseFloat(getComputedStyle(/** @type {Element} */ (document.querySelector(layer))).opacity),
        boxes: [...document.querySelectorAll(sel)].map(e => ({ e, b: e.getBoundingClientRect(), cs: getComputedStyle(e) }))
          .filter(x => x.b.width > 0 && x.b.height > 0 && x.cs.visibility !== 'hidden' && x.cs.display !== 'none')
          .map(({ e, b, cs }) => {
            const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
            const icon = icons.some(i => e.matches(i));
            const cell = e.matches('.cell.found') ? 'cell found' : e.hasAttribute('data-simsel') ? 'cell selected' : e.matches('.cell') ? 'cell' : '';
            return { sel: cell || (e.matches('.w.done') ? '.w.done' : e.id ? `#${e.id}` : e.matches('.w') ? '.w' : e.closest('[id]')?.id + ' ' + e.tagName.toLowerCase()),
              need: icon || size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5, fg: cs.color,
              x: Math.max(0, Math.floor(b.x) - 4), y: Math.max(0, Math.floor(b.y) - 4), w: Math.ceil(b.width) + 8, h: Math.ceil(b.height) + 8 };
          }),
      };
    }, [sel, ICONS, bg.file && !corner ? host : '#art svg']);
    // A host's opacity, or the still art's own (--art-board), which the frames below leave out.
    opacity = info.opacity;
    // Glyphs alone, in black on white.
    await ground('#ffffff');
    const hideBg = await tag(`#bg,#bgside,#art{visibility:hidden!important} #settings,#toast{display:none}`);
    let s = await tag(`body *{visibility:hidden!important} :is(${sel}),:is(${sel}) *{visibility:visible!important;color:#000!important;`
      + `text-shadow:none!important;border-color:transparent!important;background:transparent!important;box-shadow:none!important}`);
    const glyph = (await page.screenshot()).toString('base64');
    await s.evaluate(n => n.remove());
    // The pills alone, in black. A letter in none is not on one: a diagonal pill grazes the corner
    // of a wide letter beside it (a W), and that edge is the pill's, not the letter's ground.
    s = await tag(`body *{visibility:hidden!important} #pills .pill{visibility:visible!important;filter:brightness(0)}`);
    const pills = (await page.screenshot()).toString('base64');
    await s.evaluate(n => n.remove());
    // Everything painted over the background but the glyphs (a halo, a plate, the board, a pill),
    // over a black ground and a white one: what differs between them is how much shows through.
    // Over corner art, the board's own surface is beneath the art, so it is left out here.
    const over = [];
    for (const c of ['#000000', '#ffffff']) {
      await ground(c);
      s = await tag(`:is(${sel}){color:transparent!important}${corner ? ' #gridbox{background:none!important}' : ''}`);
      over.push((await page.screenshot()).toString('base64'));
      await s.evaluate(n => n.remove());
    }
    // What the background is drawn on: the ground, or under corner art the board's surface.
    let base = '';
    if (corner) {
      s = await tag('body *{visibility:hidden!important} #gridbox{visibility:visible!important} #gridbox *{visibility:hidden!important}');
      base = (await page.screenshot()).toString('base64');
      await s.evaluate(n => n.remove());
    }
    await hideBg.evaluate(n => n.remove());
    if (process.env.DEBUG) for (const [n, b] of [['glyph', glyph], ['over', over[0]]]) (await import('node:fs')).writeFileSync(`${process.env.DEBUG}/${bg.id}-${look.replace('/', '-')}-${area}-${shape}-${n}.png`, Buffer.from(b, 'base64'));
    // The background alone at full opacity, over black and over white.
    s = await tag(`#app{visibility:hidden} #bgside,#art{visibility:visible} #settings,#toast{display:none} #bg,#bgside,#art svg{opacity:1!important}`);
    const frames = [];
    for (let f = 0; f < (bg.animated ? FRAMES : 1); f++) {
      if (bg.animated) {
        await page.evaluate(() => /** @type {any} */ (window).__thaw());
        await page.waitForTimeout(700);
        await page.evaluate(() => /** @type {any} */ (window).__freeze());
        await page.waitForTimeout(60);
      }
      const pair = [];
      for (const g of ['#000000', '#ffffff']) { await ground(g); pair.push((await page.screenshot()).toString('base64')); }
      frames.push(pair);
    }
    await s.evaluate(n => n.remove());
    await ground('');
    if (bg.animated) await page.evaluate(() => /** @type {any} */ (window).__thaw());

    const res = await math.evaluate(async ([glyphPng, overPngs, basePng, frames, info, steps, cur, ring, pillPng]) => {
      /** @param {string} b64 */
      const pixels = async (b64) => {
        const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
        const c = new OffscreenCanvas(img.width, img.height), x = /** @type {OffscreenCanvasRenderingContext2D} */ (c.getContext('2d'));
        x.drawImage(img, 0, 0); return { d: x.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height };
      };
      const G = await pixels(glyphPng), O0 = await pixels(overPngs[0]), O1 = await pixels(overPngs[1]), P = await pixels(pillPng);
      const U = basePng ? await pixels(basePng) : null;
      const F = await Promise.all(frames.map(async ([k, w]) => [await pixels(k), await pixels(w)]));
      /** @param {string} s */
      const parse = (s) => { const m = s.startsWith('#') ? [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)) : s.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3] ?? 1]; };
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const ink = (i) => 1 - G.d[i * 4 + 1] / 255;   // glyph coverage
      const pill = (i) => 1 - P.d[i * 4 + 1] / 255;
      const B = parse(info.bg);
      return info.boxes.map(box => {
        const T = parse(box.fg);
        // The ring: pixels clear of the glyph (and of the pills, for a letter in none) but within `ring` px of it.
        const zone = [];
        const x1 = Math.min(G.w, box.x + box.w), y1 = Math.min(G.h, box.y + box.h);
        for (let y = box.y; y < y1; y++) for (let x = box.x; x < x1; x++) {
          if (ink(y * G.w + x) > 0.1 || (box.sel === 'cell' && pill(y * G.w + x) > 0.1)) continue;
          let near = false;
          for (let dy = -ring; dy <= ring && !near; dy++) for (let dx = -ring; dx <= ring; dx++) {
            const yy = y + dy, xx = x + dx;
            if (dx * dx + dy * dy <= ring * ring && yy >= 0 && yy < G.h && xx >= 0 && xx < G.w && ink(yy * G.w + xx) > 0.4) { near = true; break; }
          }
          if (near) zone.push(y * G.w + x);
        }
        let score = 99, max = 1, at = 0;
        F.forEach(([K, W], f) => {
          const by = steps.map(() => /** @type {number[]} */ ([]));
          for (const i of zone) {
            const under = U ? [0, 1, 2].map(c => U.d[i * 4 + c]) : B;
            const full = [0, 1, 2].map(c => K.d[i * 4 + c] + (W.d[i * 4 + c] - K.d[i * 4 + c]) / 255 * under[c]);
            steps.forEach((a, k) => {
              // The background at opacity a, then whatever the page paints over it.
              const px = full.map((v, c) => O0.d[i * 4 + c] + (O1.d[i * 4 + c] - O0.d[i * 4 + c]) / 255 * (under[c] + a * (v - under[c])));
              const t = px.map((v, c) => T[c] * T[3] + v * (1 - T[3]));
              const lt = L(t), lp = L(px);
              by[k].push((Math.max(lt, lp) + 0.05) / (Math.min(lt, lp) + 0.05));
            });
          }
          const s = by.map(v => v.sort((m, q) => m - q)[Math.floor(v.length * 0.05)] ?? 99);
          let m = -1;
          for (let k = 0; k < steps.length && s[k] >= box.need; k++) m = steps[k];
          max = Math.min(max, m);
          const now = s[steps.indexOf(cur)];
          if (now < score) { score = now; at = f; }
        });
        const opens = zone.map(i => (O1.d[i * 4 + 1] - O0.d[i * 4 + 1]) / 255).sort((a, b) => b - a);
        return { sel: box.sel, need: box.need, score, max, frame: at, dbg: `zone ${zone.length} open p5 ${opens[Math.floor(opens.length * 0.05)]?.toFixed(2)} box ${box.x},${box.y},${box.w}x${box.h}` };
      });
    }, [glyph, over, base, frames, info, [...new Set([...STEPS, opacity])].sort((a, b) => a - b), opacity, RING, pills]);
    if (process.env.DEBUG) for (const r of res) console.log(look, r.sel, r.score.toFixed(2), r.dbg);
    for (const r of res) {
      const o = worst[r.sel] ??= { score: 99, at: '', need: r.need, max: 1 };
      if (r.score < o.score) Object.assign(o, { score: r.score, at: `${look} frame ${r.frame}`, need: r.need });
      o.max = Math.min(o.max, r.max);
    }
  }
  await ctx.close();
  const rows = Object.entries(worst);
  const bad = rows.filter(([, v]) => v.score < v.need);
  failed += bad.length;
  const [lk, lv] = rows.reduce((a, b) => (b[1].score - b[1].need < a[1].score - a[1].need ? b : a));
  // The board's letters get their own ceiling: in Full screen the board's solid share is tuned
  // by it, and over corner art it is --art-board's.
  const cells = rows.filter(([k]) => k.startsWith('cell')), rest = rows.filter(([k]) => !k.startsWith('cell'));
  const top = (rs) => (rs.length ? Math.min(...rs.map(([, v]) => v.max)) : 1);
  const max = Math.min(top(cells), top(rest));
  if (rest.length) ceiling[`${bg.id} ${area}`] = Math.min(ceiling[`${bg.id} ${area}`] ?? 1, top(rest));
  if (cells.length) ceiling[`${bg.id} ${area} board`] = Math.min(ceiling[`${bg.id} ${area} board`] ?? 1, top(cells));
  const lines = [`${bad.length ? 'FAIL' : 'ok  '} ${bg.id.padEnd(13)} ${area.padEnd(4)} ${shape.padEnd(9)} at ${opacity}: `
    + `lowest ${lv.score.toFixed(2)}/${lv.need} ${lk} (${lv.at}); passes up to ${max}`
    + (cells.length && rest.length ? `, the board's letters up to ${top(cells)}` : '')];
  for (const [k, v] of bad) lines.push(`     ${k} ${v.score.toFixed(2)} < ${v.need} at ${v.at}`);
  console.log(lines.join('\n'));
}

let next = 0;
await Promise.all(Array.from({ length: Math.min(WORKERS, jobs.length) }, async () => {
  const math = await (await browser.newContext()).newPage();
  while (next < jobs.length) await run(jobs[next++], math);
}));
await browser.close();
site.close();
console.log('\nHighest host opacity every look and shape passes at:');
for (const [k, v] of Object.entries(ceiling).sort()) console.log(`  ${k.padEnd(20)} ${v}`);
console.log(failed ? `${failed} roles under AA at the stylesheet's opacity` : 'everything over the backgrounds meets AA');
process.exit(failed ? 1 : 0);
