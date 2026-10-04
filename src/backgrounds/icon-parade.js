// Icon parade: the subject's icons march along lanes across the host, each lane at its own
// pace, hopping a step at a time and leaning into the way they go. The seed picks the variant:
// lanes alternating left and right, all one way at staggered speeds, or columns up and down.
// One drawn facing a side faces the way its lane goes.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';
import { facingOf, iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions
 * @typedef {{z:number, dir:number, speed:number, salt:number, seq:number[], s:number, ph:number,
 *   at:number, vis:number, size:number, gap:number, stride:number, alpha:number}} Lane
 * A lane is an endless procession: icon k sits at (k + dir*s) gaps from the anchor edge, so it
 * wraps with no seam. at is the lane's place across the host (a fraction), vis its fade.
 */

const SPRITE = 80;   // largest drawn edge in CSS px
const LANES = 6;     // lanes made; the host's size shows 3 to 6 of them
const PITCH = 140;   // CSS px across per lane, before the 3..6 clamp
const SPACE = 3.0;   // spacing along a lane, in icon edges, at the closest
const MOST = 46;     // about the most icons on screen; a bigger host spaces them out instead
const WRAP = 1024;   // the jitter repeats every WRAP icons, so s can wrap without a seam

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
  const facing = ids.map(id => facingOf(id));
  const rng = makeRng(seed);
  const hue0 = rng.int(colors.length);
  // 0 alternates left and right, 1 all one way at staggered speeds, 2 columns up and down.
  const vert = layout === 2, dir0 = rng.random() < 0.5 ? 1 : -1;

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  let W = 0, H = 0, dpr = 1, n = 0, pitch = 0;
  let cancel = () => {};

  // Depths step by the golden ratio, so the first three lanes (a small host's) span near to far.
  const z0 = rng.random();
  /** @type {Lane[]} */
  const lanes = [];
  for (let i = 0; i < LANES; i++) {
    const z = (z0 + i * 0.618) % 1;
    const speed = layout === 1 ? 10 + z * 24 : 13 + z * 13 + rng.random() * 4;
    // The hero takes every third place; the rest follow in a shuffled order of the lane's own.
    const rest = rng.shuffle(ids.map((_, k) => k).slice(1));
    /** @type {number[]} */
    const seq = [];
    for (let q = 0; q < Math.max(1, Math.ceil(rest.length / 2)); q++) {
      seq.push(0);
      if (rest.length) seq.push(rest[(2 * q) % rest.length], rest[(2 * q + 1) % rest.length]);
    }
    lanes.push({ z, dir: layout === 0 || vert ? (i & 1 ? -dir0 : dir0) : dir0, speed, salt: rng.int(1 << 30),
      seq, s: rng.random() * seq.length, ph: rng.random() * 6.28, at: 0, vis: 0, size: 0, gap: 0, stride: 0,
      alpha: 0.32 + z * 0.38 });
  }
  // Far lanes first, so a near one's hop passes in front.
  const order = lanes.slice().sort((a, b) => a.z - b.z);

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

  /** Sizes follow the host smoothly; only the lane count steps, and lanes glide to their new place.
   * @param {boolean} snap place lanes at once (first paint, reduced motion) @returns {void} */
  function fit(snap) {
    const span = vert ? H : W, cross = vert ? W : H;
    const nc = Math.max(3, Math.min(LANES, cross / PITCH));
    n = Math.round(nc);
    pitch = cross / nc;
    // Near lanes carry the biggest icons, short lanes (a phone's) smaller ones.
    const big = Math.max(36, Math.min(80, Math.min(W, H) * 0.16, pitch * 0.6, span * 0.14));
    let inv = 0;
    for (const L of lanes) { L.size = 28 + L.z * (big - 28); inv += 1 / L.size / LANES; }
    // Spaced in proportion to size, so far lanes come thick and near ones sparse, like perspective.
    const space = Math.max(SPACE, nc * span * inv / MOST);
    for (const L of lanes) {
      L.gap = L.size * space;
      L.stride = L.size * 0.6;
      if (snap) { const i = lanes.indexOf(L); L.at = (i + 0.5) / n; L.vis = i < n ? 1 : 0; }
    }
  }

  /** @returns {void} */
  function resize() {
    const [w, h] = hostSize(host);
    const d = Math.min(3, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr) return;
    const first = !W, remake = first || d !== dpr;
    W = w; H = h; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // Lanes keep their icons and their place along, so dragging a window edge only reveals
    // more of the parade; a change in lane count glides the lanes over.
    fit(first || reduced);
    if (remake) makeSprites(); else draw();
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    const ease = 1 - Math.exp(-dt * 3);
    lanes.forEach((L, i) => {
      L.s = (L.s + L.speed * dt / L.gap) % (WRAP * L.seq.length);
      L.ph = (L.ph + Math.PI * L.speed * dt / L.stride) % (2 * Math.PI);
      L.at += ((i + 0.5) / n - L.at) * ease;
      L.vis += ((i < n ? 1 : 0) - L.vis) * ease;
    });
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const span = vert ? H : W, cross = vert ? W : H;
    for (const L of order) {
      if (L.vis < 0.01) continue;
      const { size, gap, dir } = L, reach = size + gap * 0.25;
      const base = L.at * cross, off = dir * L.s;
      ctx.globalAlpha = L.alpha * L.vis;
      // Every icon whose slot, jitter and all, could be on screen.
      for (let k = Math.floor((-reach) / gap - off); k <= Math.ceil((span + reach) / gap - off); k++) {
        const kk = ((k % WRAP) + WRAP) % WRAP;
        let hsh = Math.imul(kk ^ L.salt, 0x9E3779B1);
        hsh = Math.imul(hsh ^ (hsh >>> 15), 0x85EBCA77);
        hsh ^= hsh >>> 13;
        const ik = L.seq[((k % L.seq.length) + L.seq.length) % L.seq.length], spr = sprites[ik];
        if (!spr) continue;
        const j1 = (hsh & 1023) / 1023 - 0.5, j2 = ((hsh >>> 10) & 1023) / 1023 - 0.5, j3 = ((hsh >>> 20) & 1023) / 1023;
        const along = (k + off + j1 * 0.4) * gap;
        // Mostly in step with the lane, as a parade would be, with a little stagger.
        const ph = L.ph + j3 * 1.2, lift = Math.abs(Math.sin(ph)) * size * 0.14;
        let x, y, a, face = 1;
        if (vert) {
          // Seen from above: a step surges forward, and the icon rocks foot to foot.
          x = base + j2 * pitch * 0.1; y = along + dir * lift;
          a = Math.cos(ph) * 6;
        } else {
          x = along; y = base + j2 * pitch * 0.08 - lift;
          a = dir * (7 + Math.cos(2 * ph) * 3);
          // Mirrored before the lean, so it still leans the way it goes.
          if (facing[ik]) face = dir * facing[ik];
        }
        const r = a * Math.PI / 180, cos = Math.cos(r) * dpr, sin = Math.sin(r) * dpr;
        ctx.setTransform(cos * face, sin * face, -sin, cos, x * dpr, y * dpr);
        ctx.drawImage(spr, -size / 2, -size / 2, size, size);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  resize();
  const stop = frameLoop(host, resize, (dt) => {
    step(dt);
    draw();
  }, reduced);
  return () => { cancel(); stop(); cv.remove(); lanes.length = order.length = 0; };
}
