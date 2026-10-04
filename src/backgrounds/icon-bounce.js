// Bouncing icons: the subject's icons bounce, squashing as they land and stretching as they take
// off, each over a soft shadow in its own colour. The seed picks the variant: hopping along the
// ground, bouncing in place in rows, or travelling diagonally off all four edges. One drawn
// facing a side faces the way it hops or travels.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';
import { facingOf, iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions
 * @typedef {{k:number, z:number, size:number, alpha:number, x:number, y:number, vx:number, vy:number,
 *   hops:number[], n:number, u:number, rest:number, stride:number, wall:number, hit:number}} Bouncer
 * One icon of the hopping (0) or travelling (2) variant: x, y in CSS px, hops the heights it cycles
 * through in multiples of its size, n the hop it is on and u the seconds since it last landed.
 * @typedef {{k:number, x:number, base:number, size:number, alpha:number, f:number, T:number, ph:number}} Juggler
 * One icon of the rows variant, bouncing f sizes high every T seconds from its ground at x, base.
 * @typedef {{T:number, step:number, f:number, s:number, ph:number}} Row
 */

const SPRITE = 80;   // largest drawn edge in CSS px
const MAX = 22;      // hoppers made; a small host draws an even spread of them over depth
const MAX_FLY = 14;  // travellers made, likewise
const G = 520;       // px/s² on a 64px icon; it scales with size, so every depth keeps one tempo
const SEG = 0.12;    // seconds a landing squash, and a take-off crouch, each take
const GROUND = 2 * SEG;
const FOOT = 0.04;   // the art's own margin inside its square, as a share of the edge
const SILL = 9;      // px between the travellers' floor and the host's bottom, room for their shadows

/** Seconds aloft for a hop `f` sizes high, the same at every size. @param {number} f @returns {number} */
const airOf = (f) => 2 * Math.sqrt(128 * f / G);
/** Squash depth for a hop `f` sizes high: a higher one lands harder. @param {number} f @returns {number} */
const ampOf = (f) => 0.1 + 0.07 * Math.min(1.6, f);

/** Pose `u` seconds after landing in a hop of `ground` then `air` seconds: lift is 0 to 1 of its
 * height, d below 0 squashed and above 0 stretched, lean -1 nose up at take-off and 1 nose down at landing. */
const pose = { lift: 0, d: 0, lean: 0 };
/** @param {number} u @param {number} ground @param {number} air @returns {void} */
function poseAt(u, ground, air) {
  const seg = Math.min(SEG, ground / 2);
  if (u < ground) {
    const e1 = Math.max(0, 1 - u / seg), e2 = Math.max(0, 1 - (ground - u) / seg);
    const sq = Math.max(Math.sin(Math.PI * Math.min(1, u / (2 * seg))), Math.sin(Math.PI * Math.min(1, (ground - u) / (2 * seg))));
    pose.lift = 0;
    pose.d = 0.5 * (e1 * e1 + e2 * e2) - sq;
    pose.lean = e1 - e2;
  } else {
    const a = Math.min(1, (u - ground) / air), m = 1 - 2 * a;
    pose.lift = 4 * a * (1 - a);
    pose.d = 0.5 * m * m;
    pose.lean = -m;
  }
}

/** A soft round blot in `color`, squeezed flat when drawn as a shadow. @param {string} color
 * @returns {HTMLCanvasElement} */
function blot(color) {
  const s = document.createElement('canvas');
  s.width = s.height = 64;
  const g = s.getContext('2d');
  if (g) {
    g.fillStyle = color;
    g.fillRect(0, 0, 64, 64);
    g.globalCompositeOperation = 'destination-in';
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, '#000'); r.addColorStop(0.45, 'rgba(0,0,0,.7)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  return s;
}

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
  // 0 hops along the ground (rightwards or back, by seed), 1 bounces in place in rows, 2 travels.
  const mode = layout, dir = rng.random() < 0.5 ? 1 : -1;
  const colorOf = (/** @type {number} */ i) => colors[(hue0 + i) % colors.length];

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  const shadows = ids.map((_, i) => blot(colorOf(i)));
  /** @type {Bouncer[]} */
  const parts = [];
  /** @type {boolean[]} which of parts the host's size has room for */
  let shown = [];
  /** @type {Juggler[]} */
  let cells = [];
  /** @type {Map<number, Row>} */
  const rows = new Map();
  /** @type {Map<string, {s:number, f:number, ph:number}>} */
  const slots = new Map();
  let W = 0, H = 0, dpr = 1, t = rng.random() * 20, made = false;
  const o1 = rng.random(), o2 = rng.random();
  let cancel = () => {};

  /** Sprites are drawn at the device pixel ratio of the last resize that changed it.
   * @returns {void} */
  function makeSprites() {
    // One still loading from before a density change would land over the new one.
    cancel();
    cancel = iconSprites(ids, colorOf, Math.round(SPRITE * dpr), (i, s) => {
      sprites[i] = s;
      draw();
    });
  }

  /** Ground seconds before hop `n`: every third waits a little longer. @param {Bouncer} p @param {number} n
   * @returns {number} */
  const groundOf = (p, n) => GROUND + (n % 3 ? 0 : p.rest);

  /** @param {number} z depth, 0 far to 1 near @param {number} i @param {number} max
   * @param {number} at its place in a low-discrepancy walk, which spreads the first ones drawn evenly
   * @returns {Bouncer} the nearest, always drawn, is the hero */
  function make(z, i, max, at) {
    const f = 1.1 + rng.random() * 0.9, fly = mode === 2;
    const size = fly ? 30 + z * 46 : 28 + z * 52, speed = 18 + z * 24, a = 0.55 + rng.random() * 0.45;
    // The plastic-number walk (R2) spreads points over an area; the golden one along a line.
    const u = (o1 + at * (fly ? 0.7548776662 : 0.6180339887)) % 1, v = (o2 + at * 0.5698402910) % 1, r = size * (0.5 - FOOT);
    /** @type {Bouncer} */
    const p = { k: (max - 1 - i) % ids.length, z, size, alpha: 0.32 + z * 0.36,
      x: fly ? r + u * (W - 2 * r) : u * (W + size) - size / 2, y: r + v * (H - SILL - 2 * r),
      // Turns through the four diagonals, so the first ones drawn head every way.
      vx: Math.cos(a) * speed * (at & 1 ? -1 : 1), vy: Math.sin(a) * speed * (at & 2 ? -1 : 1),
      hops: [f, f * (0.5 + rng.random() * 0.3), f * (0.7 + rng.random() * 0.3)], n: rng.int(3), u: 0,
      rest: rng.random() * 0.7, stride: size * (0.55 + rng.random() * 0.45), wall: 0, hit: -9 };
    p.u = rng.random() * (groundOf(p, p.n) + airOf(p.hops[p.n % 3]));
    return p;
  }

  /** The rows variant's tempo and look for row r, the same whatever the host's size.
   * @param {number} r @returns {Row} */
  function rowOf(r) {
    let row = rows.get(r);
    if (!row) {
      const q = makeRng((seed ^ Math.imul(r + 31, 0x27D4EB2F)) >>> 0);
      row = { T: 1.4 + q.random() * 0.6, step: [0.5, 1 / 3, -1 / 3, 0.25, -0.25][q.int(5)],
        f: 0.5 + q.random() * 0.35, s: 0.26 + q.random() * 0.1, ph: q.random() };
      rows.set(r, row);
    }
    return row;
  }

  /** Lays the rows variant over the host: rows stacked up from its floor, centred across, so a
   * dragged edge slides them and adds or drops whole slots at the edges rather than reshuffling.
   * @returns {void} */
  function layRows() {
    // About one per 42000px², 6 to 26 of them, at least two across a narrow host.
    const n = Math.max(6, Math.min(26, W * H / 42000));
    const p = Math.max(96, Math.min(Math.sqrt(W * H / n), W / 2.4)), py = p * 0.9;
    cells = [];
    const c0 = Math.floor(-W / 2 / p) - 1, c1 = Math.ceil(W / 2 / p) + 1;
    for (let r = 0; r <= H / py; r++) {
      const row = rowOf(r), base = H - py * 0.1 - r * py;
      for (let c = c0; c <= c1; c++) {
        let s = slots.get(r + ',' + c);
        if (!s) {
          const q = makeRng((seed ^ Math.imul(r + 977, 0x85EBCA6B) ^ Math.imul(c + 6151, 0xC2B2AE35)) >>> 0);
          s = { s: 0.88 + q.random() * 0.24, f: 0.85 + q.random() * 0.3, ph: (q.random() - 0.5) * 0.08 };
          slots.set(r + ',' + c, s);
        }
        const size = Math.max(28, Math.min(80, p * row.s * s.s)), x = W / 2 + (c + (r & 1) / 2) * p;
        if (x < -size / 2 || x > W + size / 2 || base - size * 0.8 < 0) continue;
        const f = Math.min(2.2, (py - size * 0.9) * row.f * s.f / size);
        cells.push({ k: ((r * 2 + c) % ids.length + ids.length) % ids.length, x, base, size,
          alpha: 0.32 + (size - 28) / 52 * 0.36, f, T: row.T, ph: row.ph + c * row.step + s.ph });
      }
    }
  }

  /** @returns {void} */
  function resize() {
    const [w, h] = hostSize(host);
    const d = Math.min(3, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr && made) return;
    const remake = d !== dpr || !made;
    made = true;
    // Icons keep their place, scaled to the new size, so dragging a window edge does not
    // reshuffle them.
    const sx = W ? w / W : 1, sy = H ? h / H : 1;
    for (const p of parts) { p.x *= sx; p.y *= sy; }
    W = w; H = h; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (mode === 1) layRows();
    else {
      const max = mode === 2 ? MAX_FLY : MAX;
      const n = mode === 2 ? Math.max(5, Math.min(max, Math.round(W * H / 55000)))
        : Math.max(8, Math.min(max, Math.round(W * H / 30000)));
      shown = Array.from({ length: max }, (_, i) => Math.floor((i + 1) * n / max) > Math.floor(i * n / max));
      // Those drawn at the first size take the walk's first places, so they start spread out,
      // shuffled among themselves so that no icon lines up with its own kind.
      const leads = parts.length ? [] : rng.shuffle(Array.from({ length: n }, (_, j) => j));
      let lead = 0, rest = n;
      for (let i = parts.length; i < max; i++) parts.push(make((i + rng.random()) / max, i, max, shown[i] ? leads[lead++] : rest++));
    }
    if (remake) makeSprites(); else draw();
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    if (mode === 0) {
      for (const p of parts) {
        // x moves only while aloft, a stride per hop; the ground time between stays put.
        let left = dt;
        for (;;) {
          const g = groundOf(p, p.n), air = airOf(p.hops[p.n % 3]);
          const a0 = Math.max(0, (p.u - g) / air);
          if (p.u + left < g + air) {
            p.u += left;
            p.x += dir * p.stride * (Math.max(0, (p.u - g) / air) - a0);
            break;
          }
          p.x += dir * p.stride * (1 - a0);
          left -= g + air - p.u;
          p.u = 0; p.n++;
        }
        const span = W + p.size;
        if (p.x > W + p.size / 2) p.x -= span; else if (p.x < -p.size / 2) p.x += span;
      }
    } else if (mode === 2) {
      for (const p of parts) {
        const r = p.size * (0.5 - FOOT), floor = H - SILL;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < r) { p.x = Math.min(W / 2, 2 * r - p.x); p.vx = Math.abs(p.vx); p.wall = 0; p.hit = t; }
        else if (p.x > W - r) { p.x = Math.max(W / 2, 2 * (W - r) - p.x); p.vx = -Math.abs(p.vx); p.wall = 1; p.hit = t; }
        if (p.y < r) { p.y = Math.min(H / 2, 2 * r - p.y); p.vy = Math.abs(p.vy); p.wall = 2; p.hit = t; }
        else if (p.y > floor - r) { p.y = Math.max(H / 2, 2 * (floor - r) - p.y); p.vy = -Math.abs(p.vy); p.wall = 3; p.hit = t; }
      }
    }
  }

  /** A shadow under x on the ground at y, w wide. @param {number} k @param {number} x @param {number} y
   * @param {number} w @param {number} alpha @returns {void} */
  function shadow(k, x, y, w, alpha) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(shadows[k], x - w / 2, y - w * 0.11, w, w * 0.22);
  }

  /** An icon standing on x, y, scaled sx by sy about its foot and leaning rot radians.
   * @param {HTMLCanvasElement} spr @param {number} x @param {number} y @param {number} size
   * @param {number} sx @param {number} sy @param {number} rot @param {number} alpha @returns {void} */
  function stand(spr, x, y, size, sx, sy, rot, alpha) {
    const cos = Math.cos(rot) * dpr, sin = Math.sin(rot) * dpr;
    ctx.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, x * dpr, y * dpr);
    ctx.globalAlpha = alpha;
    ctx.drawImage(spr, -size / 2, -size * (1 - FOOT), size, size);
  }

  /** A hopping or bouncing icon in the pose poseAt left, f sizes high at most, mirrored when face is -1.
   * @param {number} k @param {number} x @param {number} base @param {number} size @param {number} f
   * @param {number} alpha @param {number} lean radians at full lean @param {number} face @returns {void} */
  function hopper(k, x, base, size, f, alpha, lean, face) {
    const spr = sprites[k];
    if (!spr) return;
    const d = pose.d * ampOf(f), up = pose.lift * f * size, high = Math.min(1, up / (size * 2.2));
    shadow(k, x, base, size * 0.85 * (1 - 0.45 * high) * (1 - Math.min(0, d)), alpha * 0.75 * (1 - 0.6 * high));
    stand(spr, x, base - up, size, face * (1 - 0.75 * d), 1 + d, pose.lean * lean, alpha);
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (mode === 1) {
      for (const c of cells) {
        const ph = t / c.T + c.ph, air = c.T - GROUND;
        poseAt((ph - Math.floor(ph)) * c.T, GROUND, air);
        hopper(c.k, c.x, c.base, c.size, c.f, c.alpha, 0, 1);
      }
    } else if (mode === 0) {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!shown[i]) continue;
        // Far ones stand higher up the ground; a short host lowers the hops to fit.
        const base = H * (0.55 + 0.42 * p.z), f = p.hops[p.n % 3];
        const fit = Math.min(1, Math.max(0.3, (base - p.size - H * 0.06) / (p.size * 2)));
        poseAt(p.u, groundOf(p, p.n), airOf(f));
        // Mirrored before the lean, so the nose still dips into each landing.
        const face = facing[p.k] ? dir * facing[p.k] : 1;
        hopper(p.k, p.x, base, p.size, f * fit, p.alpha, dir * 0.11 * Math.min(1, f), face);
      }
    } else {
      const floor = H - SILL;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i], spr = sprites[p.k];
        if (!spr || !shown[i]) continue;
        const r = p.size * (0.5 - FOOT), high = Math.max(0, Math.min(1, (floor - r - p.y) / Math.max(1, floor - 2 * r)));
        shadow(p.k, p.x, floor, p.size * 0.85 * (1 - 0.45 * high), p.alpha * 0.75 * (1 - high) * (1 - high));
        // A light squash against the wall it last met, wobbling out within a third of a second.
        const since = t - p.hit, d = since < 0.6 ? -0.2 * Math.exp(-since / 0.12) * Math.cos(since * 15) : 0;
        const across = p.wall < 2, side = p.wall % 2 ? 1 : -1;
        const sx = across ? 1 + d : 1 - 0.75 * d, sy = across ? 1 - 0.75 * d : 1 + d;
        const x = p.x + (across ? side * r * (1 - sx) : 0), y = p.y + (across ? 0 : side * r * (1 - sy));
        // Turns round as it meets a side wall, which flips vx.
        const face = facing[p.k] && p.vx * facing[p.k] < 0 ? -1 : 1;
        ctx.setTransform(face * sx * dpr, 0, 0, sy * dpr, x * dpr, y * dpr);
        ctx.globalAlpha = p.alpha;
        ctx.drawImage(spr, -p.size / 2, -p.size / 2, p.size, p.size);
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
  return () => { cancel(); stop(); cv.remove(); parts.length = 0; cells = []; };
}
