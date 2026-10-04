// Rising icons: the subject's icons float up the host at three depths, wobbling side to side
// with a slight tilt. The seed picks the variant: balloons that pop near the top, quick
// bubbles, or slow lanterns whose glow breathes. Each icon is rasterised once into a sprite.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';
import { iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions
 * @typedef {{k:number, size:number, speed:number, rise:number, x:number, sway:number, swayF:number,
 *   f2:number, tilt:number, ph:number, alpha:number, grow:number, top:number, pop:number}} Riser
 * rise is the distance climbed from just below the bottom edge, x the centre across. f2 is the
 * bubble's wiggle or the lantern's breath in Hz; top is where a balloon pops, as a fraction of
 * the height from the top, and pop the seconds since it began to, or -1.
 */

const SPRITE = 80;   // largest drawn edge in CSS px
const POP = 0.45;    // seconds a pop takes to swell and fade
const TAU = Math.PI * 2;

/** Per variant: edge range px, climb px/s, sway px and Hz, tilt degrees, icons made, host px²
 * per icon shown and the fewest shown, and how far below the edge (in edges) one starts. */
const KINDS = [
  { min: 34, max: 80, v0: 11, v1: 24, s0: 10, s1: 22, f0: 0.07, f1: 0.13, tilt: 9, make: 22, per: 40000, least: 6, reach: 1.3 },
  { min: 26, max: 60, v0: 22, v1: 46, s0: 4, s1: 10, f0: 0.35, f1: 0.6, tilt: 7, make: 34, per: 26000, least: 8, reach: 0.65 },
  { min: 32, max: 76, v0: 7, v1: 15, s0: 4, s1: 10, f0: 0.04, f1: 0.08, tilt: 3, make: 18, per: 40000, least: 6, reach: 1.15 },
];

/**
 * @param {HTMLElement} host positioned element the canvas fills
 * @param {BackgroundOptions} opts
 * @returns {() => void} stop: undoes everything start did
 */
export function start(host, opts) {
  const subject = opts.subject;
  const dark = opts.dark !== false;
  const colors = sceneColors(opts.colors, dark ? '#bbb' : '#555');
  const reduced = !!opts.reducedMotion;
  const { layout, hero, seed } = variantOf(subject, opts.seed ?? 0);
  const ids = withHero(iconsFor(subject), hero);
  const rng = makeRng(seed);
  const hue0 = rng.int(colors.length);
  // 0 balloons, 1 bubbles, 2 lanterns.
  const kind = layout, K = KINDS[kind];
  /** @param {number} i @returns {string} */
  const colorOf = (i) => colors[(hue0 + i) % colors.length];

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  // Lanterns glow through a soft disc in their own colour, made once: it has no edges to blur.
  const halos = kind === 2 ? ids.map((_, i) => halo(colorOf(i))) : [];
  /** @type {Riser[]} */
  const parts = [];
  /** @type {boolean[]} which of parts the host's size has room for */
  let shown = [];
  let W = 0, H = 0, dpr = 1, t = 0, next = 0;
  let cancel = () => {};

  /** Sprites are drawn at the device pixel ratio of the last resize that changed it.
   * @returns {void} */
  function makeSprites() {
    // One still loading from before a density change would land over the new one.
    cancel();
    cancel = iconSprites(ids, colorOf, Math.round(SPRITE * dpr), (i, s) => {
      sprites[i] = kind === 1 ? bubble(s, colorOf(i)) : s;
      draw();
    });
  }

  /** @param {Riser} p @returns {number} how far below the bottom edge its centre starts */
  const reach = (p) => p.size * K.reach;

  /** The icon least seen among those shown, the hero counting half, so a small host still
   * shows them all. Ties go round in turn. @param {Riser} p @returns {number} */
  function pick(p) {
    const seen = ids.map(() => 0);
    parts.forEach((q, i) => { if (q !== p && q.k >= 0 && shown[i]) seen[q.k] += q.k === 0 && ids.length > 2 ? 0.5 : 1; });
    const first = next++ % ids.length;
    let best = first;
    for (let j = 1; j < ids.length; j++) {
      const k = (first + j) % ids.length;
      if (seen[k] < seen[best]) best = k;
    }
    return best;
  }

  /** Best of three tries at x, away from the icons shown near the same height, so none clump.
   * @param {Riser} p @returns {number} */
  function across(p) {
    const y = H + reach(p) - p.rise;
    let best = 0, room = -1;
    for (let c = 0; c < 3; c++) {
      const x = (0.03 + rng.random() * 0.94) * W;
      let near = Infinity;
      for (let i = 0; i < parts.length; i++) {
        const q = parts[i];
        if (q === p || q.k < 0 || !shown[i]) continue;
        near = Math.min(near, Math.hypot(x - q.x, (y - (H + reach(q) - q.rise)) * 0.6));
      }
      if (near > room) { room = near; best = x; }
    }
    return best;
  }

  /** @param {Riser} p @param {number} at 0..1 of the way up on the first size; below 0, enter
   * from under the bottom edge @returns {void} */
  function spawn(p, at) {
    p.pop = -1;
    p.top = 0.03 + rng.random() * 0.17;
    // A balloon starts below its pop line; the others anywhere up to past the top.
    const span = kind === 0 ? H * (1 - p.top) + reach(p) * 0.8 : H + reach(p) * 2;
    p.rise = at >= 0 ? at * span : -rng.random() * p.size * (kind === 0 ? 3 : 1.5);
    p.k = -1;
    p.x = across(p);
    p.k = pick(p);
  }

  /** @returns {void} */
  function resize() {
    const [w, h] = hostSize(host);
    const d = Math.min(3, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr && parts.length) return;
    const remake = d !== dpr || !parts.length;
    // Icons in flight keep their place, scaled to the new size, so dragging a window edge
    // does not reshuffle the field.
    const sx = W ? w / W : 1, sy = H ? h / H : 1;
    for (const p of parts) { p.rise *= sy; p.x *= sx; }
    W = w; H = h; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const fresh = !parts.length;
    while (parts.length < K.make) {
      const z = (parts.length + rng.random()) / K.make;   // spread evenly over depth; far ones drawn first
      parts.push({ k: -1, size: K.min + z * (K.max - K.min), speed: K.v0 + z * (K.v1 - K.v0), rise: 0, x: 0,
        sway: K.s0 + rng.random() * (K.s1 - K.s0), swayF: K.f0 + rng.random() * (K.f1 - K.f0),
        f2: kind === 1 ? 0.9 + rng.random() * 0.8 : 0.1 + rng.random() * 0.12,
        tilt: K.tilt * (0.6 + rng.random() * 0.4), ph: rng.random() * TAU, alpha: 0.3 + z * 0.38,
        grow: kind === 1 && rng.random() < 0.5 ? 0.15 + rng.random() * 0.2 : 0, top: 0, pop: -1 });
    }
    const n = Math.max(K.least, Math.min(K.make, Math.round(W * H / K.per)));
    shown = parts.map((_, i) => Math.floor((i + 1) * n / K.make) > Math.floor(i * n / K.make));
    if (fresh) {
      // Heights by golden-ratio steps, counted apart for the shown and the hidden, so each set
      // is spread up the host however few it holds.
      const off = [rng.random(), rng.random()], rank = [0, 0];
      parts.forEach((p, i) => { const s = shown[i] ? 0 : 1; spawn(p, (off[s] + rank[s]++ * 0.618034) % 1); });
    }
    if (remake) makeSprites(); else draw();
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    for (const p of parts) {
      p.rise += p.speed * dt;
      const y = H + reach(p) - p.rise;
      if (kind === 0) {
        if (p.pop < 0) { if (y < H * p.top) p.pop = 0; }
        else if ((p.pop += dt) > POP) spawn(p, -1);
      } else if (y < -reach(p)) spawn(p, -1);
    }
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], spr = sprites[p.k];
      if (!spr || !shown[i]) continue;
      const w = t * p.swayF * TAU + p.ph, up = Math.min(1, Math.max(0, p.rise / (H + reach(p))));
      let x = p.x + Math.sin(w) * p.sway, y = H + reach(p) - p.rise, s = p.size, a = p.alpha;
      // Leans into its sway, as a balloon on a string does.
      let tilt = Math.cos(w) * p.tilt, sx = 1, sy = 1, glow = 0, u = 0;
      if (kind === 1) {
        // A quicker wiggle on the sway, a wobble of the skin, and some swell as they climb.
        x += Math.sin(t * p.f2 * TAU + p.ph * 2) * p.sway * 0.45;
        tilt = Math.sin(t * p.f2 * TAU * 0.7 + p.ph) * p.tilt;
        const sq = Math.sin(t * p.f2 * TAU * 1.6 + p.ph) * 0.045;
        sx = 1 + sq; sy = 1 - sq;
        s *= 1 + p.grow * (up - 0.5);
      } else if (kind === 2) {
        glow = 0.5 + 0.5 * Math.sin(t * p.f2 * TAU + p.ph);
        a *= 0.72 + 0.28 * glow;
        s *= 1 - 0.16 * up;   // receding into the sky
      } else if (p.pop >= 0) {
        // The pop: a quick swell that fades out, never a hard cut.
        u = p.pop / POP;
        s *= 1 + 0.45 * (1 - (1 - u) ** 3);
        a *= (1 - u) ** 2;
      }
      const r = tilt * Math.PI / 180, cos = Math.cos(r) * dpr, sin = Math.sin(r) * dpr;
      ctx.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, x * dpr, y * dpr);
      if (kind === 2) {
        const h = halos[p.k];
        if (h) { ctx.globalAlpha = a * (dark ? 0.5 : 0.4) * (0.45 + 0.55 * glow); ctx.drawImage(h, -s * 1.2, -s * 1.2, s * 2.4, s * 2.4); }
      } else if (kind === 0) {
        // The string hangs from the icon's foot and trails the sway; a pop sheds a ring of dashes.
        const foot = s * 0.4, len = s * 0.8, kink = Math.sin(w * 1.7 + p.ph) * s * 0.08;
        ctx.strokeStyle = colorOf(p.k);
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = a * 0.7;
        ctx.beginPath();
        ctx.moveTo(0, foot);
        ctx.quadraticCurveTo(kink * 2, foot + len * 0.5, -kink, foot + len);
        if (u) {
          const r0 = s * 0.5, r1 = r0 + p.size * 0.14 * (1 - u);
          for (let j = 0; j < 8; j++) {
            const c = Math.cos(j * TAU / 8 + p.ph), d = Math.sin(j * TAU / 8 + p.ph);
            ctx.moveTo(c * r0, d * r0); ctx.lineTo(c * r1, d * r1);
          }
        }
        ctx.stroke();
      }
      ctx.globalAlpha = a;
      ctx.drawImage(spr, -s / 2, -s / 2, s, s);
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
  return () => { cancel(); stop(); cv.remove(); parts.length = 0; };
}

/** The icon inside a thin soap film: a ring, a faint wash and a glint, drawn once.
 * @param {HTMLCanvasElement} icon @param {string} color @returns {HTMLCanvasElement} */
function bubble(icon, color) {
  const px = icon.width, c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = c.height = px;
  if (!g) return icon;
  g.strokeStyle = g.fillStyle = color;
  g.lineWidth = px * 0.03;
  g.beginPath();
  g.arc(px / 2, px / 2, px * 0.47, 0, TAU);
  g.globalAlpha = 0.1;
  g.fill();
  g.globalAlpha = 0.85;
  g.stroke();
  g.lineWidth = px * 0.045;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(px / 2, px / 2, px * 0.37, Math.PI * 1.12, Math.PI * 1.38);
  g.stroke();
  g.globalAlpha = 1;
  g.drawImage(icon, px * 0.2, px * 0.2, px * 0.6, px * 0.6);
  return c;
}

/** A soft disc of `color`, opaque at the middle and gone at the rim. @param {string} color
 * @returns {HTMLCanvasElement|null} */
function halo(color) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  if (!g) return null;
  c.width = c.height = 64;
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  // Fading by mask keeps the colour true; a gradient to transparent black would grey it.
  const fade = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.4, 'rgba(0,0,0,0.5)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = fade;
  g.fillRect(0, 0, 64, 64);
  return c;
}
