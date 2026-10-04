// Swimming icons: the subject's icons glide along gentle wavy paths at three depths, in small
// schools that trail a leader, each body wiggling as it swims. The seed picks the variant:
// schools crossing both ways, one large school weaving across, or a calm tank where they turn.
// A sprite tilts with its path and is never mirrored: which way an icon faces is unknown.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';
import { iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions
 * @typedef {{u0:number, len:number, dir:number, lane:number, amp:number, wl:number, ph:number}} Leg
 * One crossing: it starts at u0 (in crossings) and `len` includes the time off the host; dir is
 * +1 left to right. lane, amp and wl are 0..1, scaled to the host's size as it draws.
 * @typedef {{cx:number, reach:number, ease:number, amp:number, m:number}} Tank
 * A back-and-forth: cx is the middle as a fraction of the width, ease how gently it turns.
 * @typedef {{k:number, z:number, size:number, alpha:number, lag:number, side:number, jog:number,
 *   wf:number, ph:number, on:boolean}} Body
 * k is its sprite; lag is how far behind the leader along its path, side how far off it across,
 * both CSS px.
 * @typedef {{rank:number, lane:number, speed:number, u:number, ph:number,
 *   rng:import('../rng.js').Rng, legs:Leg[], tank:Tank|null, weave:boolean, size:number,
 *   spread:number, back:number, bodies:Body[]}} School
 * u is the leader's progress: crossings on a path that leaves the host, radians in the tank.
 * A host shows the schools ranked below a count its area sets.
 */

const SPRITE = 80;   // largest drawn edge in CSS px
const EDGE = 50;     // a crossing starts and ends this far past the host's edge
const BIG = 24;      // the large school on a big host; a smaller one shows its middle
const WIG = 0.08;    // body wiggle either way, radians
const TAU = Math.PI * 2;
// Lanes by rank, so however many schools a host shows they spread top to bottom.
const LANES = [0.2, 0.8, 0.5, 0.35, 0.65, 0.08, 0.92, 0.27, 0.73, 0.43];

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
  const flip = rng.random() < 0.5;
  // The large school is the hero in two of the colours, so one faint colour cannot hide it all.
  const art = layout === 1 ? ids.slice(0, 1).concat(ids.slice(0, 1)) : ids;

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = art.map(() => null);
  /** @type {School[]} */
  const schools = [];
  let W = 0, H = 0, dpr = 1, t = 0;
  let X = 0, Y = 0, TILT = 0, TURN = 0;   // where locate() last found a body
  let cancel = () => {};

  /** @param {number} z depth, 0 far to 1 near @param {number} size @param {number} lag
   * @param {number} side @param {import('../rng.js').Rng} r @returns {Body} */
  function body(z, size, lag, side, r) {
    return { k: 0, z, size, alpha: 0.3 + z * 0.4, lag, side, jog: size * 0.1,
      wf: (1.15 - z * 0.4) * (0.85 + r.random() * 0.3), ph: r.random() * TAU, on: true };
  }

  /** A leader, then followers staggered back and to alternate sides of its path.
   * @param {number} z @param {number} n @param {number} speed CSS px/s @returns {School} */
  function school(z, n, speed) {
    // Its own rng, so the legs it swims next do not depend on frame timing.
    const r = makeRng(rng.int(0x7fffffff) + 1);
    const size = Math.min(SPRITE, (28 + z * 52) * (0.94 + r.random() * 0.12));
    /** @type {Body[]} */
    const bodies = [];
    for (let j = 0; j < n; j++) {
      bodies.push(body(z, size, j ? size * (0.95 * j + r.random() * 0.35) : 0,
        j ? (j % 2 ? -1 : 1) * size * (0.5 + r.random() * 0.35) : 0, r));
    }
    return { rank: 0, lane: 0.5, speed, u: 0, ph: r.random() * TAU, rng: r, legs: [], tank: null,
      weave: false, size, spread: 0, back: 0, bodies };
  }

  if (layout === 1) {
    // One large school in the hero's icon: a sunflower, so any first n of it are an even disc.
    const big = school(0.5, 0, 10 + rng.random() * 3);
    big.weave = true;
    const rot = rng.random() * TAU;
    for (let j = 0; j < BIG; j++) {
      const r = Math.sqrt((j + 0.5) / BIG), a = j * 2.39996 + rot, z = 0.25 + rng.random() * 0.5;
      big.bodies.push(body(z, 28 + z * 52, 330 * (1 - r * Math.cos(a)) + (rng.random() - 0.5) * 28,
        120 * r * Math.sin(a) + (rng.random() - 0.5) * 20, big.rng));
      big.bodies[j].k = rng.random() < 0.6 ? 0 : 1;
    }
    big.size = Math.max(...big.bodies.map(b => b.size));
    schools.push(big);
  } else {
    // Three depths; 0 crosses and comes back, 2 turns inside the host. Ranks take a school from
    // each depth in turn, nearest first, and the first rank carries the hero.
    const per = layout ? [3, 3, 2] : [4, 3, 3];
    const tiers = [0.12, 0.5, 0.88].map((z0, d) => Array.from({ length: per[d] }, () => {
      const z = z0 + (rng.random() - 0.5) * 0.08;
      const s = school(z, 2 + rng.int(3), (layout ? 7 + z * 13 : 9 + z * 16) * (0.88 + rng.random() * 0.24));
      if (layout) s.tank = { cx: 0.5 + (rng.random() - 0.5) * 0.12, reach: 0.88 + rng.random() * 0.1,
        ease: 0.9 + rng.random() * 0.07, amp: rng.random(), m: 0.3 + rng.random() * 0.5 };
      return s;
    }));
    const turn = [2, ...rng.shuffle([0, 1])];
    for (let j = 0; j < 4; j++) for (const d of turn) { const s = tiers[d][j]; if (s) schools.push(s); }
    schools.forEach((s, i) => {
      s.rank = i;
      for (const b of s.bodies) b.k = i % Math.max(1, ids.length);
      const l = LANES[i % LANES.length] + (rng.random() - 0.5) * 0.08;
      s.lane = flip ? 1 - l : l;
    });
  }
  for (const s of schools) s.back = Math.max(0, ...s.bodies.map(b => b.lag + b.jog));
  /** @type {{s:School, b:Body}[]} every body, far ones first */
  const order = schools.flatMap(s => s.bodies.map(b => ({ s, b }))).sort((p, q) => p.b.z - q.b.z);

  /** How far `lane` is from the nearest other school on the host. @param {number} lane
   * @param {School} s @returns {number} */
  function room(lane, s) {
    let g = 1;
    for (const o of schools) {
      if (o !== s && o.bodies[0]?.on && o.legs.length) g = Math.min(g, Math.abs(o.legs[o.legs.length - 1].lane - lane));
    }
    return g;
  }

  /** @param {School} s @param {number} u0 @param {number} dir @returns {Leg} */
  function leg(s, u0, dir) {
    const r = s.rng.random;
    // The extra length is time spent off the host before it comes back in by the edge it left,
    // in the roomier of two lanes.
    const len = 1 + (s.weave ? 0.02 + r() * 0.05 : 0.04 + r() * 0.3), a = r(), b = r();
    return { u0, len, dir, lane: s.weave || room(a, s) >= room(b, s) ? a : b, amp: r(), wl: r(), ph: r() * TAU };
  }

  /** Places every school mid-flight, its leader on the host. @returns {void} */
  function place() {
    const span = W + 2 * EDGE;
    for (const s of schools) {
      // Spread across the host by rank, either way, so a still frame does not bunch them.
      const p = (s.rank * 0.618 + (flip ? 0.3 : 0.1)) % 1, dir = s.rng.random() < 0.5 ? 1 : -1;
      if (s.tank) {
        const K = s.tank.ease, th = Math.asin(Math.sin((2 * p - 1) * Math.asin(K)) / K);
        s.u = dir > 0 ? th : Math.PI - th;
        continue;
      }
      const back = Math.max(0, ...s.bodies.filter(b => b.on).map(b => b.lag)) / span;
      const lo = Math.min(0.9, back + 0.04);
      s.u = lo + (dir > 0 ? p : 1 - p) * Math.max(0, 0.92 - lo);
      s.legs = [leg(s, 0, dir)];
      if (!s.weave) s.legs[0].lane = s.lane;
      // The legs its tail is still on.
      while (s.legs[0].u0 > s.u - s.back / span - 0.5) {
        const l = leg(s, 0, -s.legs[0].dir);
        l.u0 = s.legs[0].u0 - l.len;
        s.legs.unshift(l);
      }
    }
  }

  /** @param {Tank} T @param {School} s @returns {[number, number]} the half-width it swims, and
   * its pixels per radian at full speed, mid-tank */
  function tankSpan(T, s) {
    const A = Math.max(8, (Math.min(T.cx, 1 - T.cx) * W - s.size * 0.6) * T.reach);
    return [A, A * T.ease / Math.asin(T.ease)];
  }

  /** A lane's centre line: its share of the height, held in far enough that the school and its
   * wave stay on the host. The large school's lanes are fitted between those margins instead.
   * @param {School} s @param {number} lane @param {number} amp @returns {number} */
  function laneY(s, lane, amp) {
    const pad = Math.min(H / 2, s.spread + amp * 0.8 + s.size * 0.35);
    return s.weave ? pad + lane * (H - 2 * pad) : Math.min(H - pad, Math.max(pad, lane * H));
  }

  /** Sets X, Y, TILT and TURN for body b, or returns false while it is off the host.
   * @param {School} s @param {Body} b @returns {boolean} */
  function locate(s, b) {
    const lag = b.lag + b.jog * Math.sin(t * 0.43 + b.ph);
    const jog = b.side + b.jog * 0.7 * Math.sin(t * 0.31 + b.ph * 2.3);
    const T = s.tank;
    if (T) {
      // asin(k sin) is a triangle wave with rounded corners: steady across, an eased turn at
      // each end. A narrow tank squeezes the school so its tail is never a lap behind.
      const [A, rate] = tankSpan(T, s), K = T.ease, SK = Math.asin(K);
      const th = s.u - lag / Math.max(rate, s.back / 0.8), sn = Math.sin(th);
      X = T.cx * W + A * Math.asin(K * sn) / SK;
      const vx = A * K * Math.cos(th) / (SK * Math.sqrt(1 - K * K * sn * sn));
      const amp = (0.3 + 0.7 * T.amp) * Math.min(H * 0.08, 60), a = th * T.m + s.ph;
      Y = laneY(s, s.lane, amp) + amp * Math.sin(a) + jog;
      // The path's slope, fading through zero as it turns, so the tilt never flips.
      const vy = amp * T.m * Math.cos(a);
      TILT = Math.atan(vy * vx / (vx * vx + 0.12 * rate * rate));
      TURN = 1 - Math.abs(vx) / rate;
      return true;
    }
    const span = W + 2 * EDGE, u = s.u - lag / span;
    let i = s.legs.length - 1;
    while (i > 0 && s.legs[i].u0 > u) i--;
    const L = s.legs[i], f = u - L.u0;
    if (f < 0 || f > 1) return false;
    const d = f * span - EDGE;
    X = L.dir > 0 ? d : W - d;
    // A wave fixed in space, so every follower swims the curve its leader swam.
    const wl = (s.weave ? 0.6 + L.wl * 0.5 : 0.55 + L.wl * 0.6) * Math.max(W, 380);
    const amp = s.weave ? Math.min((0.6 + 0.4 * L.amp) * Math.min(H * 0.22, 180), 0.075 * wl)
      : Math.min((0.25 + 0.75 * L.amp) * Math.min(H * 0.1, 80), 0.06 * wl);
    const a = TAU * X / wl + L.ph;
    Y = laneY(s, L.lane, amp) + amp * Math.sin(a) + jog;
    TILT = Math.atan(amp * TAU / wl * Math.cos(a));
    TURN = 0;
    return true;
  }

  /** Sprites are drawn at the device pixel ratio of the last resize that changed it.
   * @returns {void} */
  function makeSprites() {
    // One still loading from before a density change would land over the new one.
    cancel();
    cancel = iconSprites(art, i => colors[(hue0 + i) % colors.length], Math.round(SPRITE * dpr), (i, s) => {
      sprites[i] = s;
      draw();
    });
  }

  /** @returns {void} */
  function resize() {
    const [w, h] = hostSize(host);
    const d = Math.min(3, devicePixelRatio || 1);
    const first = !W;
    if (w === W && h === H && d === dpr) return;
    const remake = d !== dpr || first;
    // Positions are fractions of a crossing or angles in the tank, so a new size moves every
    // icon smoothly rather than reshuffling the field.
    W = w; H = h; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const area = W * H;
    if (layout === 1) {
      const n = Math.max(8, Math.min(BIG, Math.round(area / 45000)));
      schools[0].bodies.forEach((b, j) => { b.on = j < n; });
    } else {
      const n = Math.max(3, Math.round(area / (layout ? 120000 : 90000)));
      for (const s of schools) for (const b of s.bodies) b.on = s.rank < n;
    }
    for (const s of schools) s.spread = Math.max(0, ...s.bodies.filter(b => b.on).map(b => Math.abs(b.side) + b.jog));
    if (first) place();
    if (remake) makeSprites(); else draw();
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    const span = W + 2 * EDGE;
    for (const s of schools) {
      // A slow surge and glide, so a school does not keep metronome pace.
      const v = s.speed * (1 + 0.15 * Math.sin(t * 0.23 + s.ph)) * dt;
      if (s.tank) { s.u += v / tankSpan(s.tank, s)[1]; continue; }
      s.u += v / span;
      let last = s.legs[s.legs.length - 1];
      while (s.u > last.u0 + last.len) {
        last = leg(s, last.u0 + last.len, -last.dir);
        s.legs.push(last);
      }
      // Half a crossing of slack, so a narrower host does not pull a tail onto a dropped leg.
      while (s.legs.length > 1 && s.u - s.back / span > s.legs[1].u0 + 0.5) s.legs.shift();
    }
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const { s, b } of order) {
      const spr = sprites[b.k];
      if (!spr || !b.on || !locate(s, b)) continue;
      // A wiggle, and a squash along the direction of travel twice per stroke; a turn in the
      // tank narrows the body as if seen edge-on.
      const st = t * b.wf * TAU + b.ph, q = Math.sin(st * 2 + 0.9) * 0.045;
      const a = TILT * 0.85 + Math.sin(st) * WIG;
      const sx = (1 - q) * (1 - 0.32 * TURN * TURN) * dpr, sy = (1 + q * 0.6) * dpr;
      const cos = Math.cos(a), sin = Math.sin(a);
      ctx.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, X * dpr, Y * dpr);
      ctx.globalAlpha = b.alpha;
      ctx.drawImage(spr, -b.size / 2, -b.size / 2, b.size, b.size);
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
  return () => { cancel(); stop(); cv.remove(); schools.length = 0; order.length = 0; };
}
