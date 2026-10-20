// Swaying icons: the subject's icons hang on strings and swing in the breeze, each a pendulum
// that a gust sets moving as it sweeps across the host. The seed picks the variant: pegged to
// washing lines, wind chimes on strings from the top edge, or garlands draped in scallops.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';
import { iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number,
 *   icons?:import('./icon-scene.js').IconStyle}} BackgroundOptions
 * @typedef {{k:number, rope:number, u:number, x:number, y:number, len:number, base:number, size:number,
 *   th:number, w:number, w0:number, alpha:number}} Hang
 * One icon on its string: rope is its line (-1 for the top edge), u its place along it, x, y the
 * pivot in CSS px, len the string; th the swing in radians, w its rate, w0 the natural rate.
 * @typedef {{y0:number, y1:number, sag:number, ph:number}} Rope
 * A line across the host: its ends' heights, how far it sags in the middle, and its bob phase.
 * @typedef {{lines:number[], gap:number, size:number[], str:number[], drape:number, scallop:number,
 *   breeze:number, gust:number, gapT:number[], alpha:number[]}} Style
 */

const SPRITE = 80;   // largest drawn edge in CSS px
const TAU = Math.PI * 2;
const G = 850;       // px/s²: a 60px pendulum swings about 0.6 times a second
const DAMP = 0.55;   // per second
const SWEEP = 260;   // px/s a gust front crosses the host

/** Per variant: lines of rope for a short and a tall host, spacing in icon edges, icon edge px
 * (far to near), string px, how far each line sags (share of the host height), the scallop
 * width (0: one sag end to end), breeze and gust px/s², seconds between gusts, and alpha.
 * @type {Style[]} */
const STYLES = [
  // 0 washing lines: two or three ropes end to end, icons pegged on short strings.
  { lines: [2, 3], gap: 1.55, size: [48, 70], str: [6, 14], drape: 0.07, scallop: 0,
    breeze: 70, gust: 320, gapT: [6, 11], alpha: [0.4, 0.66] },
  // 1 wind chimes: strings of staggered lengths hung from the top edge.
  { lines: [0, 0], gap: 1.25, size: [40, 64], str: [0.12, 0.62], drape: 0, scallop: 0,
    breeze: 40, gust: 260, gapT: [5, 9], alpha: [0.36, 0.64] },
  // 2 garlands: ropes draped in scallops between pins, smaller icons hung close together.
  { lines: [2, 4], gap: 1.3, size: [36, 54], str: [4, 10], drape: 0.06, scallop: 260,
    breeze: 60, gust: 300, gapT: [7, 12], alpha: [0.38, 0.62] },
];

/** @param {number[]} r @param {number} u 0..1 @returns {number} */
const lerp = (r, u) => r[0] + (r[1] - r[0]) * u;

/**
 * @param {HTMLElement} host positioned element the canvas fills
 * @param {BackgroundOptions} opts
 * @returns {() => void} stop: undoes everything start did
 */
export function start(host, opts) {
  const subject = opts.subject;
  const colors = sceneColors(opts.colors, opts.dark === false ? '#555' : '#bbb');
  const reduced = !!opts.reducedMotion;
  const { layout, hero, seed } = variantOf(subject, opts.seed ?? 0);
  const ids = withHero(iconsFor(subject), hero);
  const rng = makeRng(seed);
  const hue0 = rng.int(colors.length);
  const st = STYLES[layout] ?? STYLES[0];
  const ropeColor = colors[hue0 % colors.length];
  // The wind blows one way for the whole deal, by seed.
  const side = rng.random() < 0.5 ? -1 : 1;

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  /** @type {Hang[]} */
  let hangs = [];
  /** @type {Rope[]} */
  let ropes = [];
  let W = 0, H = 0, dpr = 1, t = 0;
  let gustAt = Infinity, gustLen = 1, gustPow = 0;
  let cancel = () => {};

  /** @returns {void} */
  function makeSprites() {
    cancel();
    cancel = iconSprites(ids, i => colors[(hue0 + 1 + i) % colors.length], Math.round(SPRITE * dpr), (i, s) => {
      sprites[i] = s;
      draw();
    }, opts);
  }

  /** Height of rope r at x, sagging between its ends or in scallops between pins.
   * @param {Rope} r @param {number} x @returns {number} */
  function ropeY(r, x) {
    const u = Math.max(0, Math.min(1, x / W));
    const span = st.scallop ? W / Math.max(1, Math.round(W / st.scallop)) : W;
    const v = ((x % span) + span) % span / span;
    return r.y0 + (r.y1 - r.y0) * u + r.sag * (1 + 0.04 * Math.sin(t * 0.9 + r.ph)) * 4 * v * (1 - v);
  }

  /** Lays the ropes and hangs icons along them; a resize lays them again from the same seed,
   * keeping each icon's swing. @returns {void} */
  function lay() {
    const r2 = makeRng(seed ^ 0x5bd1e995);
    const fit = Math.max(0.72, Math.min(1, Math.min(W, H) / 520));
    const old = hangs;
    hangs = []; ropes = [];
    const n = st.lines[1] ? Math.max(st.lines[0], Math.min(st.lines[1], Math.round(H / 240))) : 0;
    for (let i = 0; i < n; i++) {
      // Evenly down the host, the first a little below the top, each tilted a little.
      const y = H * (i + 0.35) / n, tilt = (r2.random() - 0.5) * Math.min(60, H * 0.08);
      ropes.push({ y0: y - tilt, y1: y + tilt, sag: H * st.drape * (0.8 + r2.random() * 0.4), ph: r2.random() * TAU });
    }
    let k = 0;
    const lines = n || 1;
    for (let li = 0; li < lines; li++) {
      const z = n ? (li + 0.5) / n : 0.5;   // lower ropes are nearer: bigger and stronger
      const size = lerp(st.size, z) * fit;
      const pitch = size * st.gap;
      const count = Math.max(2, Math.floor(W / pitch));
      const off = (W - (count - 1) * pitch) / 2;
      for (let j = 0; j < count; j++) {
        const x = off + j * pitch + (r2.random() - 0.5) * pitch * 0.18;
        // Chimes: a long string and a short one take turns, so neighbours never hang level.
        const len = n ? lerp(st.str, r2.random()) * fit
          : H * lerp(st.str, ((j * 0.618034 + r2.random() * 0.25) % 1));
        const s = n ? size * (0.9 + r2.random() * 0.2) : lerp(st.size, len / (H * st.str[1])) * fit;
        const d = len + s / 2;
        const prev = old[hangs.length];
        hangs.push({ k: k++ % ids.length, rope: n ? li : -1, u: x / W, x, y: 0, len, base: s, size: s,
          th: prev ? prev.th : (r2.random() - 0.5) * 0.3 + side * 0.08, w: prev ? prev.w : 0,
          w0: Math.sqrt(G / d), alpha: lerp(st.alpha, n ? z : len / (H * st.str[1])) });
      }
    }
  }

  /** @returns {void} */
  function resize() {
    const [w, h] = hostSize(host);
    const d = Math.min(3, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr && hangs.length) return;
    const remake = d !== dpr || !hangs.length;
    W = w; H = h; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    lay();
    if (remake) makeSprites(); else draw();
  }

  /** Books the next gust a few seconds after `from`. @param {number} from @returns {void} */
  function nextGust(from) {
    gustAt = from + lerp(st.gapT, rng.random());
    gustLen = 2.5 + rng.random() * 2;
    gustPow = st.gust * (0.7 + rng.random() * 0.6);
  }

  /** The wind at x: the breeze, a little flutter, and the gust as its front sweeps past.
   * @param {number} x @returns {number} px/s² */
  function windAt(x) {
    const from = side > 0 ? x : W - x;
    const u = (t - gustAt - from / SWEEP) / gustLen;
    const g = u > 0 && u < 1 ? Math.sin(u * Math.PI) ** 2 : 0;
    const flutter = Math.sin(t * 1.7 + x * 0.013) * 0.5 + Math.sin(t * 2.9 - x * 0.007) * 0.3;
    return side * (st.breeze * (1 + flutter) + gustPow * g);
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    if (t > gustAt + gustLen + W / SWEEP) nextGust(t);
    // Two half steps keep a short, quick pendulum stable at the 0.1s worst case.
    for (let s = 0; s < 2; s++) {
      const h = dt / 2;
      for (const p of hangs) {
        const d = p.len + p.size / 2;
        const acc = -p.w0 * p.w0 * Math.sin(p.th) - DAMP * p.w + windAt(p.x) * Math.cos(p.th) / d;
        p.w += acc * h;
        p.th = Math.max(-1.2, Math.min(1.2, p.th + p.w * h));
      }
    }
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = ropeColor;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 1.6 * dpr;
    for (const r of ropes) {
      ctx.beginPath();
      for (let x = -8; x <= W + 8; x += 12) {
        const y = ropeY(r, x);
        if (x < 0) ctx.moveTo(x * dpr, y * dpr); else ctx.lineTo(x * dpr, y * dpr);
      }
      ctx.stroke();
    }
    for (const p of hangs) {
      p.y = p.rope < 0 ? -2 : ropeY(ropes[p.rope], p.x);
      const spr = sprites[p.k];
      const sin = Math.sin(p.th), cos = Math.cos(p.th);
      // The string, from the pivot to the top of the icon.
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath();
      ctx.moveTo(p.x * dpr, p.y * dpr);
      ctx.lineTo((p.x - sin * p.len) * dpr, (p.y + cos * p.len) * dpr);
      ctx.stroke();
      if (p.rope >= 0) {
        // A peg or a knot where it meets the rope.
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = ropeColor;
        ctx.fillRect((p.x - 1.6) * dpr, (p.y - 3.5) * dpr, 3.2 * dpr, 7 * dpr);
      }
      if (!spr) continue;
      ctx.setTransform(cos * dpr, sin * dpr, -sin * dpr, cos * dpr, p.x * dpr, p.y * dpr);
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(spr, -p.size / 2, p.len, p.size, p.size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.globalAlpha = 1;
  }

  resize();
  if (!reduced) { t = rng.random() * 10; nextGust(t - st.gapT[0] + 1.5); }
  const stop = frameLoop(host, resize, (dt) => {
    step(dt);
    draw();
  }, reduced);
  return () => { cancel(); stop(); cv.remove(); hangs = []; ropes = []; };
}
