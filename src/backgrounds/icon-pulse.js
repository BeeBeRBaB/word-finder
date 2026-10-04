// Pulsing icons: the subject's icons sit still on a loose jittered grid, and waves pass through
// them: each swells about 12% and grows stronger, then settles. The seed picks the wave: a
// ripple from a point, an equaliser's columns to a beat, or a lub-dub heartbeat sweeping across.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';
import { iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions
 * @typedef {{i:number, j:number, jx:number, jy:number, k:number, f:number, size:number,
 *   cos:number, sin:number, alpha:number}} Cell
 * i, j is the lattice cell, jx, jy its jitter and f its edge, all in pitches; alpha its resting strength.
 */

const SPRITE = 80;   // largest drawn edge in CSS px
const BIG = 70;      // largest resting edge, so a swollen or stretched icon stays within the sprite
const SWELL = 0.12;  // extra size at a wave's crest
const LIFT = 0.22;   // extra alpha at a wave's crest
const ACCENT = [1, 0.4, 0.75, 0.3, 0.9, 0.45, 0.7, 0.15];  // the equaliser's eight-beat bar

/** A float in [0, 1) from two integers and a salt: a lattice cell's draw, the same at any host size.
 * @param {number} a @param {number} b @param {number} salt @returns {number} */
function hash(a, b, salt) {
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ salt;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** @param {number} v @param {number} lo @param {number} hi @returns {number} */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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
  const n = ids.length;
  const rng = makeRng(seed);
  const hue0 = rng.int(colors.length);
  // 0 ripples from a point to one side of the board, 1 is an equaliser, 2 a heartbeat sweeping
  // left to right or back, tilted up to 17 degrees.
  const ou = rng.random() < 0.5 ? 0.1 + rng.random() * 0.2 : 0.7 + rng.random() * 0.2, ov = 0.15 + rng.random() * 0.7;
  const head = (rng.random() < 0.5 ? 0 : Math.PI) + (rng.random() - 0.5) * 0.6;
  const hc = Math.cos(head), hs = Math.sin(head);
  const beat = 60 / (84 + rng.int(17)), bar0 = rng.int(8);
  const eq = layout === 1, s0 = seed | 0;

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  /** @type {Cell[]} */
  let cells = [];
  /** @type {number[]} the equaliser's column levels this frame, from column -half */
  const lv = [];
  // pitch is the lattice spacing; v, D and P the wave's speed, reach and period; w its clock.
  let W = 0, H = 0, dpr = 1, t = 0, w = 0, pitch = 1, v = 1, D = 1, P = 1, half = 0;
  let cancel = () => {};

  /** Sprites are drawn at the device pixel ratio of the last resize that changed it.
   * @returns {void} */
  function makeSprites() {
    // One still loading from before a density change would land over the new one.
    cancel();
    cancel = iconSprites(ids, i => colors[(hue0 + i) % colors.length], Math.round(SPRITE * dpr), (i, s) => {
      sprites[i] = s;
      draw();
    });
  }

  /** A cell's own icon, hero most often. @param {number} i @param {number} j @returns {number} */
  const raw = (i, j) => (n < 2 || hash(i, j, s0 ^ 7) < 0.3 ? 0 : 1 + Math.floor(hash(i, j, s0 ^ 8) * (n - 1)));

  /** Odd cells of the checkerboard steer clear of their four neighbours' icons, which are raw.
   * @param {number} i @param {number} j @returns {number} */
  function pick(i, j) {
    const k = raw(i, j);
    if (!((i + j) & 1) || n < 3) return k;
    const near = [raw(i - 1, j), raw(i + 1, j), raw(i, j - 1), raw(i, j + 1)];
    for (const keep of [4, 2]) {
      for (let c = 0; c < n; c++) if (!near.slice(0, keep).includes((k + c) % n)) return (k + c) % n;
    }
    return k;
  }

  /** @param {number} i @param {number} j @returns {Cell} */
  function cell(i, j) {
    const f = 0.3 + hash(i, j, s0 ^ 3) * 0.16, rot = (hash(i, j, s0 ^ 4) - 0.5) * (eq ? 10 : 24) * Math.PI / 180;
    return { i, j, jx: (hash(i, j, s0 ^ 1) - 0.5) * (eq ? 0.12 : 0.36), jy: (hash(i, j, s0 ^ 2) - 0.5) * 0.36,
      k: pick(i, j), f, size: 0, cos: Math.cos(rot), sin: Math.sin(rot), alpha: 0.3 + (f - 0.3) * 1.1 };
  }

  /** @param {Cell} c @returns {number} */
  const cellX = (c) => W / 2 + (c.i + 0.5 + c.jx) * pitch;
  /** The equaliser stands on the bottom edge, the others are centred. @param {Cell} c @returns {number} */
  const cellY = (c) => (eq ? H - (c.j + 0.5 + c.jy) * pitch : H / 2 + (c.j + 0.5 + c.jy) * pitch);

  /** @returns {void} */
  function resize() {
    const [nw, nh] = hostSize(host);
    const d = Math.min(3, devicePixelRatio || 1);
    if (nw === W && nh === H && d === dpr && cells.length) return;
    const remake = d !== dpr || !cells.length;
    W = nw; H = nh; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // About 30 cells on a laptop, never more than about 60 however big the screen.
    pitch = Math.max(clamp(Math.sqrt(W * H / 30), 76, 180), Math.sqrt(W * H / 60));
    const ny = Math.ceil(H / pitch / 2) + 1;
    half = Math.ceil(W / pitch / 2) + 1;
    // A cell comes from its lattice place alone and the lattice is anchored to the middle (the
    // bottom for the equaliser), so dragging an edge only adds or drops cells there.
    cells = [];
    for (let j = eq ? 0 : -ny; j < (eq ? 2 * ny : ny); j++) for (let i = -half; i < half; i++) {
      const c = cell(i, j);
      c.size = Math.max(28, Math.min(BIG, c.f * pitch));
      const x = cellX(c), y = cellY(c), m = c.size * 0.3;
      if (x > -m && x < W + m && y > -m && y < H + m) cells.push(c);
    }
    cells.sort((a, b) => a.size - b.size);
    if (layout === 0) {
      const ox = ou * W, oy = ov * H;
      D = Math.max(Math.hypot(ox, oy), Math.hypot(W - ox, oy), Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy));
      v = clamp(D / 4.2, 110, 320); P = D / v + 2;
    } else {
      D = W * Math.abs(hc) + H * Math.abs(hs);
      v = clamp(D / 3.4, 120, 380); P = D / v + 1.4;
    }
    // Reduced motion freezes a wave part way across: the ripple's ring, a strong beat, a lub-dub.
    if (reduced) { w = (layout === 0 ? 0.38 : 0.2) * D / v; t = ((8 - bar0) % 8) * beat + 0.12; }
    w %= P;
    if (remake) makeSprites(); else draw();
  }

  /** The ripple's swell: quick to rise, slow to settle. @param {number} s seconds since the crest
   * @returns {number} */
  const swell = (s) => (s < 0 ? Math.exp(-(s * s) / 0.06) : Math.exp(-(s * s) / 0.5));
  /** The heartbeat's lub and its softer dub. @param {number} s @returns {number} */
  const lubdub = (s) => Math.max(Math.exp(-(s * s) / 0.011), 0.62 * Math.exp(-((s - 0.3) ** 2) / 0.013));

  /** One equaliser column's loudness: a beat kicks it to a new height that then falls away.
   * Strong beats hit most columns and reach high, weak ones hit a few, low.
   * @param {number} i column @returns {number} 0..1 of the host's height */
  function level(i) {
    const b = Math.floor(t / beat), s = t - b * beat;
    let L = 0;
    for (let m = 0; m < 2; m++) {
      const bb = b - m, ss = s + m * beat, acc = ACCENT[(bb + bar0) & 7];
      if (hash(i, bb, s0 ^ 12) > 0.3 + 0.65 * acc) continue;
      // Mostly its own, partly a contour across the columns, so neighbours lean together.
      const tone = 0.7 * hash(i, bb, s0 ^ 11) + 0.3 * (0.5 + 0.5 * Math.sin(i * 0.9 + bb * 1.3));
      // Up in 80ms, a moment near the top, then down as if dropped.
      const fall = ss < 0.08 ? ss / 0.08 : 1 - Math.min(1, (ss - 0.08) / 0.6) ** 2;
      L = Math.max(L, acc * (0.15 + 0.85 * tone) * fall);
    }
    return L;
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    w = (w + dt) % P;
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const ox = ou * W, oy = ov * H, x0 = hc > 0 ? 0 : W, y0 = hs > 0 ? 0 : H;
    if (eq) for (let i = -half; i < half; i++) lv[i + half] = level(i);
    for (const c of cells) {
      const spr = sprites[c.k];
      if (!spr) continue;
      const x = cellX(c), y = cellY(c);
      let e = 0, sx = 1, sy = 1;
      if (layout === 0) {
        const d = Math.hypot(x - ox, y - oy);
        e = swell(w - d / v) * (1 - 0.3 * d / D);
      } else if (layout === 2) {
        e = lubdub(w - ((x - x0) * hc + (y - y0) * hs) / v);
      } else {
        // The column lights from the bottom up to its level, each lit icon stretched upright.
        e = clamp((lv[c.i + half] * H - (H - y)) / (0.45 * pitch) + 0.5, 0, 1);
        sx = 1 + 0.04 * e; sy = 1 + 0.15 * e;
      }
      if (!eq) sx = sy = 1 + SWELL * e;
      ctx.setTransform(c.cos * sx * dpr, c.sin * sx * dpr, -c.sin * sy * dpr, c.cos * sy * dpr, x * dpr, y * dpr);
      ctx.globalAlpha = c.alpha + LIFT * e;
      ctx.drawImage(spr, -c.size / 2, -c.size / 2, c.size, c.size);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  resize();
  const stop = frameLoop(host, resize, (dt) => {
    step(dt);
    draw();
  }, reduced);
  return () => { cancel(); stop(); cv.remove(); cells = []; };
}
