// Falling icons: the subject's icons tumble down the host like leaves or snow, swaying, spinning
// and now and then turning over, and every so often a gust pushes the whole field sideways.
// The seed picks the variant: large flipping leaves, light swaying snow, or a windy slant.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';
import { iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions
 * @typedef {{k:number, d:number, base:number, size:number, speed:number, x:number, y:number,
 *   sway:number, swayF:number, ph:number, rot:number, spin:number, flip:number, flipF:number,
 *   alpha:number}} Flake
 * x, y is the centre before sway; rot is radians, spin rad/s. flip's whole part counts the times
 * it has turned over, so its parity is the face showing; flipF is flip cycles a second.
 * @typedef {{max:number, min:number, per:number, size:number[], speed:number[], sway:number[],
 *   swayF:number[], spin:number, tilt:number, rock:number, flipF:number[], turn:number,
 *   alpha:number[], wind:number, gust:number, gap:number[]}} Style
 * Pairs run far to near (size px, speed px/s, alpha) or low to high (sway px, swayF Hz, gap s).
 */

const SPRITE = 80;   // largest drawn edge in CSS px
const TAU = Math.PI * 2;
const EDGE = 0.2;    // narrowest a flip gets, as a share of the width, eased in rather than clipped

/** Per variant: icons made, fewest shown, host area per icon; tilt and spin in degrees, rock the
 * 3D wobble in radians, turn the share of each flip cycle spent turning over, wind and gust px/s.
 * @type {Style[]} */
const STYLES = [
  // 0 leaves: few, large and slow, swinging like a pendulum and turning over every few seconds.
  { max: 22, min: 7, per: 38000, size: [42, 80], speed: [13, 24], sway: [22, 44], swayF: [0.14, 0.22],
    spin: 9, tilt: 22, rock: 0.5, flipF: [0.08, 0.14], turn: 0.4, alpha: [0.34, 0.68], wind: 0, gust: 34, gap: [8, 14] },
  // 1 snow: many small and light ones, mostly swaying, rocking rather than turning over.
  { max: 48, min: 12, per: 20000, size: [28, 46], speed: [11, 22], sway: [8, 22], swayF: [0.1, 0.22],
    spin: 4, tilt: 9, rock: 0.5, flipF: [0, 0], turn: 0, alpha: [0.3, 0.56], wind: 0, gust: 28, gap: [9, 15] },
  // 2 windy: a steady slant across the host, spinning and flipping, with stronger, closer gusts.
  { max: 30, min: 8, per: 32000, size: [30, 64], speed: [20, 36], sway: [4, 12], swayF: [0.18, 0.3],
    spin: 20, tilt: 6, rock: 0.35, flipF: [0.18, 0.3], turn: 0.35, alpha: [0.32, 0.66], wind: 28, gust: 40, gap: [5, 9] },
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
  // The windy slant blows left to right or back, by seed; still air gusts either way.
  const side = rng.random() < 0.5 ? -1 : 1;

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  /** @type {Flake[]} */
  const parts = [];
  /** @type {boolean[]} which of parts the host's size has room for */
  let shown = [];
  let W = 0, H = 0, dpr = 1, t = 0, next = 0, push = 0;
  let gustAt = Infinity, gustLen = 1, gustDir = 1, gustPow = 0;
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

  /** @param {Flake} p @param {number} i its place in parts @param {number} j its place among
   * those shown, or -1 @param {number} n how many are shown, while filling the host mid-fall,
   * else 0 @returns {void} */
  function spawn(p, i, j, n) {
    // Only the ones shown take the next icon in turn, so a small host still shows them all.
    p.k = j < 0 ? i % ids.length : next++ % ids.length;
    p.rot = (rng.random() - 0.5) * (layout === 2 ? 2 : 0.8);
    p.flip = rng.int(2) + rng.random() * (1 - st.turn);   // face up or down, not mid-turn
    p.ph = rng.random() * TAU;
    if (n && j >= 0) {
      // A low-discrepancy spread over the ones shown, so the still frame has no clumps or holes.
      p.x = ((j + 0.5) * 0.7548777 + (rng.random() - 0.5) * 0.4 / n) % 1 * W;
      p.y = ((j + 0.5) * 0.5698403 + (rng.random() - 0.5) * 0.4 / n) % 1 * (H + p.size) - p.size / 2;
    } else if (n) {
      p.x = rng.random() * W;
      p.y = rng.random() * (H + p.size) - p.size / 2;
    } else {
      p.x = rng.random() * W;
      p.y = -p.size * (0.7 + rng.random() * 0.8);
    }
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
    for (const p of parts) { p.x *= sx; p.y *= sy; }
    W = w; H = h; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const fresh = !parts.length;
    while (parts.length < st.max) {
      const z = (parts.length + rng.random()) / st.max;   // spread evenly over depth; far ones drawn first
      const base = lerp(st.size, z) * (0.9 + rng.random() * 0.2);
      /** @type {Flake} */
      const p = { k: 0, d: z, base, size: base, speed: lerp(st.speed, z) * (0.85 + rng.random() * 0.3),
        x: 0, y: 0, sway: lerp(st.sway, rng.random()), swayF: lerp(st.swayF, rng.random()), ph: 0, rot: 0,
        spin: (rng.random() < 0.5 ? -1 : 1) * st.spin * (0.5 + rng.random() * 0.5) * Math.PI / 180,
        flip: 0, flipF: lerp(st.flipF, rng.random()), alpha: lerp(st.alpha, z) };
      parts.push(p);
    }
    // A narrow rail or a strip under the board gets smaller icons, never below the smallest.
    const fit = Math.max(0.75, Math.min(1, Math.min(W, H) / 480));
    for (const p of parts) p.size = 28 + (p.base - 28) * fit;
    const n = Math.max(st.min, Math.min(st.max, Math.round(W * H / st.per)));
    shown = parts.map((_, i) => Math.floor((i + 1) * n / st.max) > Math.floor(i * n / st.max));
    if (fresh) {
      let j = 0;
      parts.forEach((p, i) => spawn(p, i, shown[i] ? j++ : -1, n));
    }
    if (remake) makeSprites(); else draw();
  }

  /** Books the next gust a few seconds after `from`. @param {number} from @returns {void} */
  function nextGust(from) {
    gustAt = from + lerp(st.gap, rng.random());
    gustLen = 3 + rng.random() * 2.5;
    gustDir = st.wind ? side : rng.random() < 0.5 ? -1 : 1;
    gustPow = st.gust * (0.75 + rng.random() * 0.5);
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    if (t > gustAt + gustLen) nextGust(t);
    // The gust swells and dies away smoothly: 0 outside one, 1 at its peak.
    const u = (t - gustAt) / gustLen;
    const g = u > 0 && u < 1 ? Math.sin(u * Math.PI) ** 2 : 0;
    push = st.wind * side + g * gustPow * gustDir;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      // Leaves drop fastest through the bottom of each swing and hang at its ends.
      const c = Math.cos(t * p.swayF * TAU + p.ph);
      const fall = layout === 0 ? 0.35 + 1.3 * c * c : 1;
      p.y += p.speed * fall * (1 - 0.3 * g) * dt;
      p.x += push * (0.55 + 0.6 * p.d) * dt;   // nearer ones are carried further
      p.rot += p.spin * (1 + g) * dt;
      p.flip += p.flipF * (1 + 1.5 * g) * dt;   // a gust turns them over sooner
      const m = p.size + p.sway;
      if (p.y > H + p.size) spawn(p, i, shown[i] ? 0 : -1, 0);
      else if (p.x < -m) p.x += W + 2 * m;
      else if (p.x > W + m) p.x -= W + 2 * m;
    }
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    // Everything leans a little into the wind it is carried by.
    const lean = Math.max(-0.3, Math.min(0.3, push / 240));
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], spr = sprites[p.k];
      if (!spr || !shown[i]) continue;
      const ph = t * p.swayF * TAU + p.ph;
      const x = p.x + Math.sin(ph) * p.sway, y = p.y;
      const a = p.rot + Math.cos(ph) * st.tilt * Math.PI / 180 + lean;   // tilted with the swing
      // The 3D flip: a width of cos(angle), the angle rocking with the swing and now and then
      // turning a half-turn over, eased through edge-on so it never thins to nothing.
      const n = Math.floor(p.flip), f = st.turn && !reduced ? (p.flip - n - 1 + st.turn) / st.turn : 0;
      const s = f > 0 ? f * f * (3 - 2 * f) : 0;
      const c = Math.cos(Math.PI * (n + s) + st.rock * Math.sin(ph + 1));
      const e = Math.sqrt(c * c + EDGE * EDGE) / Math.sqrt(1 + EDGE * EDGE), wd = c < 0 ? -e : e;
      const cos = Math.cos(a) * dpr, sin = Math.sin(a) * dpr;
      ctx.setTransform(cos * wd, sin * wd, -sin, cos, x * dpr, y * dpr);
      ctx.globalAlpha = p.alpha * (0.72 + 0.28 * e);   // dimmer edge-on
      ctx.drawImage(spr, -p.size / 2, -p.size / 2, p.size, p.size);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  resize();
  push = st.wind * side;
  if (!reduced) { t = rng.random() * 20; nextGust(t - st.gap[0] + 2); }
  const stop = frameLoop(host, resize, (dt) => {
    step(dt);
    draw();
  }, reduced);
  return () => { cancel(); stop(); cv.remove(); parts.length = 0; };
}
