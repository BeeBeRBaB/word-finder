// Floating icons: the subject's icons float on still water, bobbing and rocking with their
// reflections, and rings of ripples spread out over it. The seed picks the variant: a pond where
// each icon dips and sends out rings, rain freckling the water and rocking whatever it passes,
// or a slow current carrying them along in lanes. One drawn facing a side faces the way it goes.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';
import { facingOf, iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions
 * @typedef {{k:number, d:number, base:number, size:number, x:number, y:number, vx:number, vy:number,
 *   ph:number, bobF:number, kick:number, alpha:number, cyc:number}} Float
 * x, y is where it meets the water in CSS px; d its depth, 0 far to 1 near; kick a bob a passing
 * ring gave it, dying away; cyc counts its bobs, each ending at the bottom of a dip.
 * @typedef {{x:number, y:number, r:number, max:number, n:number, a:number}} Ring
 * n rings spread from x, y one GAP apart, the first at radius r, until it reaches max.
 * @typedef {{max:number, min:number, per:number, size:number[], drift:number, current:number,
 *   rain:number, dip:number, alpha:number[]}} Style
 */

const SPRITE = 80;     // largest drawn edge in CSS px
const TAU = Math.PI * 2;
const FLAT = 0.32;     // the water is seen at a slant: a ring's height over its width
const GAP = 11;        // px between the rings of one ripple
const SPREAD = 34;     // px/s a ring grows
const SINK = 0.16;     // share of an icon below the waterline

/** Per variant: floats made, fewest shown, host area per float, edge px far to near, wander
 * px/s, current px/s, raindrops per second per megapixel, dips that ring per bob, alpha.
 * @type {Style[]} */
const STYLES = [
  // 0 pond: a few large icons wandering slowly, each dip sending out rings.
  { max: 12, min: 5, per: 70000, size: [64, 104], drift: 5, current: 0, rain: 0.6, dip: 0.5, alpha: [0.4, 0.68] },
  // 1 rain: more, smaller icons, rocked by the rings of the rain falling round them.
  { max: 20, min: 7, per: 42000, size: [46, 74], drift: 2.5, current: 0, rain: 9, dip: 0, alpha: [0.36, 0.64] },
  // 2 current: lanes carried along at staggered speeds, rings trailing behind.
  { max: 18, min: 6, per: 52000, size: [54, 88], drift: 0, current: 16, rain: 0.4, dip: 0.3, alpha: [0.38, 0.66] },
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
  const facing = ids.map(id => facingOf(id));
  const rng = makeRng(seed);
  const hue0 = rng.int(colors.length);
  const st = STYLES[layout] ?? STYLES[0];
  const water = colors[hue0 % colors.length];
  // The current flows one way for the whole deal, by seed.
  const side = rng.random() < 0.5 ? -1 : 1;

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  /** @type {Float[]} */
  const floats = [];
  /** @type {Ring[]} */
  let rings = [];
  /** @type {boolean[]} */
  let shown = [];
  let W = 0, H = 0, dpr = 1, t = 0, rainDue = 0;
  let cancel = () => {};

  /** @returns {void} */
  function makeSprites() {
    cancel();
    cancel = iconSprites(ids, i => colors[(hue0 + 1 + i) % colors.length], Math.round(SPRITE * dpr), (i, s) => {
      sprites[i] = s;
      draw();
    });
  }

  /** @param {number} x @param {number} y @param {number} max @param {number} n @param {number} a
   * @param {number} [r] @returns {void} */
  function ring(x, y, max, n, a, r = 0) {
    if (rings.length < 60) rings.push({ x, y, r, max, n, a });
  }

  /** @returns {void} */
  function resize() {
    const [w, h] = hostSize(host);
    const d = Math.min(3, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr && floats.length) return;
    const remake = d !== dpr || !floats.length;
    const sx = W ? w / W : 1, sy = H ? h / H : 1;
    for (const p of floats) { p.x *= sx; p.y *= sy; }
    for (const r of rings) { r.x *= sx; r.y *= sy; }
    W = w; H = h; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const fresh = !floats.length;
    while (floats.length < st.max) {
      const i = floats.length;
      // A low-discrepancy spread, so the still frame has no clumps or holes.
      const u = (i + 0.5) * 0.7548777 % 1, v = (i + 0.5) * 0.5698403 % 1;
      const lane = st.current ? 0.6 + 0.8 * rng.random() : 1;
      const ang = rng.random() * TAU;
      floats.push({ k: i % ids.length, d: v, base: lerp(st.size, v) * (0.9 + rng.random() * 0.2), size: 0,
        x: (u + (rng.random() - 0.5) * 0.08) * W, y: 0, ph: rng.random() * TAU, bobF: 0.25 + rng.random() * 0.2,
        vx: st.current ? side * st.current * lane * (0.6 + 0.6 * v) : Math.cos(ang) * st.drift,
        vy: st.current ? 0 : Math.sin(ang) * st.drift * FLAT, kick: 0, alpha: lerp(st.alpha, v), cyc: 0 });
    }
    // A narrow rail or a strip under the board gets smaller icons, never below the smallest.
    const fit = Math.max(0.72, Math.min(1, Math.min(W, H) / 520));
    for (const p of floats) {
      p.size = 30 + (p.base - 30) * fit;
      // Depth runs down the host: near ones sit lower, and the top edge keeps room for an icon.
      if (fresh) p.y = p.size + p.d * (H - p.size * 1.4);
    }
    const n = Math.max(st.min, Math.min(st.max, Math.round(W * H / st.per)));
    shown = floats.map((_, i) => Math.floor((i + 1) * n / st.max) > Math.floor(i * n / st.max));
    if (fresh) {
      // The still frame already has ripples spreading, as if it had been raining a while.
      for (let i = 0; i < floats.length; i++) if (shown[i] && (st.dip || st.current)) {
        const p = floats[i];
        ring(p.x, p.y, p.size * 2.2, 3, 0.7, rng.random() * p.size * 1.6);
      }
      for (let i = 0, m = Math.round(st.rain * W * H / 1e6 * 2); i < m; i++)
        ring(rng.random() * W, rng.random() * H, 40 + rng.random() * 50, 2, 0.4, rng.random() * 40);
    }
    if (remake) makeSprites(); else draw();
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    for (const r of rings) r.r += SPREAD * dt * (1 - 0.5 * r.r / (r.max + GAP * r.n));
    rings = rings.filter(r => r.r - GAP * (r.n - 1) < r.max);
    if (st.current) for (const r of rings) r.x += side * st.current * 0.4 * dt;
    // Rain: drops at random, each a ring that rocks the floats it reaches.
    rainDue -= dt;
    if (st.rain && rainDue <= 0) {
      rainDue = -Math.log(1 - rng.random()) / (st.rain * W * H / 1e6);
      ring(rng.random() * W, rng.random() * H, 36 + rng.random() * 54, 2 + rng.int(2), 0.45);
    }
    for (let i = 0; i < floats.length; i++) {
      const p = floats[i];
      if (!shown[i]) continue;
      // Each bob ends at the bottom of a dip, and some of the dips ring.
      const cyc = Math.floor(t * p.bobF + p.ph / TAU + 0.25);
      if (cyc !== p.cyc) {
        if (p.cyc && rng.random() < st.dip) ring(p.x, p.y, p.size * 2.2, 3, 0.7);
        p.cyc = cyc;
      }
      p.kick *= Math.exp(-1.6 * dt);
      for (const r of rings) {
        const dx = p.x - r.x, dy = (p.y - r.y) / FLAT;
        const dist = Math.hypot(dx, dy);
        if (Math.abs(dist - r.r) < SPREAD * dt * 1.2 && dist > p.size * 0.4) p.kick = Math.min(1, p.kick + 0.5 * (1 - r.r / r.max));
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (st.current) {
        const m = p.size;
        if (p.x > W + m) p.x -= W + 2 * m; else if (p.x < -m) p.x += W + 2 * m;
      } else {
        // Wanderers turn back at the banks and drift apart from each other.
        if (p.x < p.size * 0.5 && p.vx < 0 || p.x > W - p.size * 0.5 && p.vx > 0) p.vx = -p.vx;
        if (p.y < p.size && p.vy < 0 || p.y > H - p.size * 0.3 && p.vy > 0) p.vy = -p.vy;
        for (let j = 0; j < floats.length; j++) {
          const q = floats[j];
          if (j === i || !shown[j]) continue;
          const dx = p.x - q.x, dy = (p.y - q.y) / FLAT, dd = Math.hypot(dx, dy), near = (p.size + q.size) * 0.6;
          if (dd > 0 && dd < near) { p.x += dx / dd * 6 * dt; p.y += dy / dd * 6 * FLAT * dt; }
        }
      }
    }
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = water;
    ctx.lineWidth = 1.8 * dpr;
    for (const r of rings) {
      for (let j = 0; j < r.n; j++) {
        const rad = r.r - j * GAP;
        if (rad <= 1 || rad > r.max) continue;
        ctx.globalAlpha = r.a * (1 - rad / r.max) ** 1.4 * (j ? 0.7 : 1);
        ctx.beginPath();
        ctx.ellipse(r.x * dpr, r.y * dpr, rad * dpr, rad * FLAT * dpr, 0, 0, TAU);
        ctx.stroke();
      }
    }
    // Far ones first, so nearer icons and their reflections lie over them.
    const order = floats.map((_, i) => i).filter(i => shown[i]).sort((a, b) => floats[a].y - floats[b].y);
    for (const i of order) {
      const p = floats[i], spr = sprites[p.k];
      if (!spr) continue;
      const s = p.size, sw = spr.width, cut = sw * (1 - SINK);
      const bob = Math.sin(t * p.bobF * TAU + p.ph);
      const kick = p.kick * Math.sin(t * 9 + p.ph);
      const y = p.y + bob * 2.2 + kick * 3;
      const rock = bob * 0.05 + kick * 0.12;
      const goes = Math.sign(p.vx) || 1;
      const flip = facing[p.k] && facing[p.k] !== goes ? -1 : 1;
      const cos = Math.cos(rock) * dpr, sin = Math.sin(rock) * dpr;
      // The reflection: the icon upside down under the waterline, squashed and faint, wavering.
      const wav = Math.sin(t * 2.3 + p.ph) * 0.08;
      ctx.setTransform(cos * flip, sin * flip, wav * dpr, -0.55 * dpr, p.x * dpr, y * dpr);
      ctx.globalAlpha = p.alpha * 0.28;
      ctx.drawImage(spr, 0, 0, sw, cut, -s / 2, -s * (1 - SINK), s, s * (1 - SINK));
      // The icon, its bottom hidden below the waterline.
      ctx.setTransform(cos * flip, sin * flip, -sin, cos, p.x * dpr, y * dpr);
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(spr, 0, 0, sw, cut, -s / 2, -s * (1 - SINK), s, s * (1 - SINK));
      // A thin waterline ring hugging it.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = p.alpha * 0.5;
      ctx.beginPath();
      ctx.ellipse(p.x * dpr, y * dpr, s * 0.46 * dpr, s * 0.46 * FLAT * dpr, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  resize();
  if (!reduced) t = rng.random() * 10;
  const stop = frameLoop(host, resize, (dt) => {
    step(dt);
    draw();
  }, reduced);
  return () => { cancel(); stop(); cv.remove(); floats.length = 0; rings = []; };
}
