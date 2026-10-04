// Icon carousel: the subject's icons ride slow elliptical orbits, a carousel seen from slightly
// above: the front of a ring larger and stronger, the back smaller and fainter, drawn back to front.
// The seed picks the variant: one wide ring, two rings turning opposite ways, or one round a corner.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';
import { iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions
 * @typedef {{spin:number, phi:number, fam:number, step:number, cx:number, cy:number, rx:number, ry:number,
 *   lo:number, hi:number, w:number, icon:number[], vis:number[]}} Ring
 * Slot s sits at angle phi + s * 2pi / SLOTS and shows when s % step is 0; vis fades it in and out.
 * fam, 1 or 3 once fitted, makes the count fam * 2^k. lo and hi are the least and most sin(angle) in view.
 */

const SPRITE = 80;   // largest drawn edge in CSS px
const SLOTS = 192;   // places round a ring; a host shows every step-th, so a resize never moves one
const TAU = Math.PI * 2;
const TALL = 1.6;    // steepest ring, height over width: a tall host gets an oval track, not a small ring
const DOTS = [0.1, 7];   // the track's dash: round dots 7px apart

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
  // 0 one ring, 1 two turning opposite ways, 2 one round the corner these two pick.
  const turn = rng.random() < 0.5 ? 1 : -1;
  const right = rng.random() < 0.5 ? 1 : 0, low = rng.random() < 0.5 ? 1 : 0;
  const used = ids.map(() => 0);
  /** @type {Ring[]} */
  const rings = (layout === 1 ? [turn, -turn] : [turn]).map(spin => ({ spin, phi: 0, fam: 0, step: SLOTS,
    cx: 0, cy: 0, rx: 1, ry: 1, lo: -1, hi: 1, w: 0, icon: [], vis: new Array(SLOTS).fill(0) }));

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  // One frame's icons in view: centre, size, alpha, sprite and depth, drawn back to front by order.
  const cap = rings.length * SLOTS, X = new Float32Array(cap), Y = new Float32Array(cap), S = new Float32Array(cap);
  const A = new Float32Array(cap), K = new Uint8Array(cap), Z = new Float32Array(cap);
  /** @type {number[]} */
  const order = [];
  const bob = reduced ? 0 : 0.06;   // of an icon's size; a still frame keeps them level
  let W = 0, H = 0, dpr = 1, t = 0, sMin = 28, sMax = 80;
  let cancel = () => {};

  /** Each slot's icon, assigned in the order slots show as the ring fills, so at every density an
   * icon differs from its neighbours, and mostly from theirs, where the subject has icons enough.
   * @param {number} fam @returns {number[]} */
  function assign(fam) {
    const icon = new Array(SLOTS).fill(-1);
    for (let st = SLOTS / (fam === 3 ? 3 : 4); st >= 1 && st % 1 === 0; st /= 2) {
      for (let s = 0; s < SLOTS; s += st) {
        if (icon[s] >= 0) continue;
        const at = (/** @type {number} */ d) => icon[(s + d * st + SLOTS) % SLOTS];
        let best = 0, low = Infinity;
        for (let k = 0; k < ids.length; k++) {
          const score = (k === at(-1) || k === at(1) ? 100 : 0) + (k === at(-2) || k === at(2) ? 3 : 0) + used[k];
          if (score < low) { low = score; best = k; }
        }
        icon[s] = best;
        used[best]++;
      }
    }
    return icon;
  }

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

  /**
   * Sets a ring's ellipse, its height kept between flat and TALL times its width: a centred ring
   * shrinks to fit, a corner ring grows past the host instead. Then its depths in view and count.
   * @param {Ring} r @param {number} cx @param {number} cy @param {number} rx @param {number} ry
   * @param {number} flat @param {number} gap icons apart, in mean icon edges @param {boolean} grow
   * @returns {void}
   */
  function fit(r, cx, cy, rx, ry, flat, gap, grow) {
    rx = Math.max(24, rx); ry = Math.max(12, ry);
    if (ry > TALL * rx) { if (grow) rx = ry / TALL; else ry = TALL * rx; }
    else if (ry < flat * rx) { if (grow) ry = flat * rx; else rx = ry / flat; }
    Object.assign(r, { cx, cy, rx, ry });
    let lo = 1, hi = -1, len = 0, px = cx + rx, py = cy;
    for (let j = 1; j <= 96; j++) {
      const a = j * TAU / 96, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
      len += Math.hypot(x - px, y - py);
      px = x; py = y;
      if (x >= 0 && x <= W && y >= 0 && y <= H) { lo = Math.min(lo, Math.sin(a)); hi = Math.max(hi, Math.sin(a)); }
    }
    if (hi - lo < 0.2) { const m = hi < lo ? 0 : (hi + lo) / 2; lo = m - 0.1; hi = m + 0.1; }
    r.lo = lo; r.hi = hi;
    // The first size picks 2^k or 3 * 2^k icons, whichever is nearer; later ones halve or double it.
    const want = Math.log2(len / (gap * (sMin + sMax) / 2)), off = (/** @type {number} */ x) => Math.abs(x - Math.round(x));
    if (!r.fam) {
      r.fam = off(want - Math.log2(3)) < off(want) ? 3 : 1;
      r.icon = assign(r.fam);
    }
    const k = Math.round(want - Math.log2(r.fam)), three = r.fam === 3;
    r.step = SLOTS / (r.fam * 2 ** Math.max(three ? 0 : 2, Math.min(three ? 4 : 6, k)));   // 3 to 48, or 4 to 64
    // The front moves about 20px a second, one turn taking 45s to 200s.
    r.w = Math.max(TAU / 200, Math.min(TAU / 45, 20 / rx));
  }

  /** @returns {void} */
  function place() {
    sMax = Math.max(44, Math.min(80, Math.min(W, H) * 0.16));
    sMin = Math.max(28, sMax * 0.4);
    const m = sMax * 0.55;   // room for a front icon at the edge
    if (layout === 0) fit(rings[0], W / 2, H / 2, (W / 2 - m) * 0.92, (H / 2 - m) * 0.92, 0.28, 2.5, false);
    else if (layout === 1) {
      fit(rings[0], W * 0.53, H * 0.71, (W / 2 - m) * 0.88, (H / 4 - m / 2) * 0.8, 0.24, 3, false);
      fit(rings[1], W * 0.47, H * 0.27, (W / 2 - m) * 0.68, (H / 4 - m / 2) * 0.8, 0.24, 3, false);
    } else fit(rings[0], right * W, low * H, W * 0.6, H * 0.6, 0.45, 1.8, true);
  }

  /** @returns {void} */
  function resize() {
    const [w, h] = hostSize(host);
    const d = Math.min(3, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr) return;
    const first = !W, remake = d !== dpr || first;
    W = w; H = h; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // Rings keep their turn and are only re-fitted, so dragging a window edge reshuffles nothing.
    place();
    rings.forEach((r, i) => {
      if (first) {
        // The hero starts front and centre (mid-arc on a corner), the other ring half a place round.
        const mid = layout === 2 ? Math.atan2(low ? -1 : 1, right ? -1 : 1) : Math.PI / 2;
        r.phi = mid + i * r.step * Math.PI / SLOTS;
      }
      if (first || reduced) for (let s = 0; s < SLOTS; s++) r.vis[s] = s % r.step ? 0 : 1;
    });
    if (remake) makeSprites(); else draw();
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    for (const r of rings) {
      r.phi += r.spin * r.w * dt;
      for (let s = 0; s < SLOTS; s++) {
        const to = s % r.step ? 0 : 1, v = r.vis[s];
        if (v !== to) r.vis[s] = to ? Math.min(1, v + dt / 0.8) : Math.max(0, v - dt / 0.8);
      }
    }
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Each ring's track, dotted like carousel lights, its back half fainter.
    ctx.strokeStyle = colors[hue0];
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.setLineDash(DOTS);
    for (const r of rings) for (const back of [1, 0]) {
      ctx.globalAlpha = back ? 0.12 : 0.22;
      ctx.beginPath();
      ctx.ellipse(r.cx, r.cy, r.rx, r.ry, 0, back ? Math.PI : 0, back ? TAU : Math.PI);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    let n = 0;
    rings.forEach((r, ri) => {
      for (let s = 0; s < SLOTS; s++) {
        const v = r.vis[s];
        if (!v) continue;
        const a = r.phi + s * TAU / SLOTS, sin = Math.sin(a);
        const z = Math.max(0, Math.min(1, (sin - r.lo) / (r.hi - r.lo)));
        const size = sMin + z * (sMax - sMin);
        // Each icon bobs a little, like a carousel horse.
        const x = r.cx + r.rx * Math.cos(a), y = r.cy + r.ry * sin + Math.sin(t * 0.9 + s * 2.4 + ri) * size * bob;
        if (x < -size || x > W + size || y < -size || y > H + size) continue;
        X[n] = x; Y[n] = y; S[n] = size; A[n] = v * (0.3 + z * 0.4); K[n] = r.icon[s]; Z[n] = z; order[n] = n;
        n++;
      }
    });
    order.length = n;
    order.sort((i, j) => Z[i] - Z[j]);
    for (const i of order) {
      const spr = sprites[K[i]];
      if (!spr) continue;
      ctx.globalAlpha = A[i];
      ctx.drawImage(spr, X[i] - S[i] / 2, Y[i] - S[i] / 2, S[i], S[i]);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  resize();
  if (!reduced) t = rng.random() * 20;
  const stop = frameLoop(host, resize, (dt) => {
    step(dt);
    draw();
  }, reduced);
  return () => { cancel(); stop(); cv.remove(); rings.length = 0; };
}
