// Fluttering icons: the subject's icons fly smooth wandering curves, each wingbeat a quick
// squash and bob, banking into their turns. The seed picks the variant: free wandering, loose
// flocks crossing the host, or a lazy swirl around a drifting point that icons peel off and rejoin.
// Each icon is rasterised once into a sprite canvas in its own colour.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';
import { iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions
 * @typedef {{k:number, d:number, size:number, speed:number, alpha:number, x:number, y:number,
 *   vx:number, vy:number, head:number, turn:number, face:number, beat:number, ph:number,
 *   h:number, u:number, v:number, w:number[]}} Flier
 * x, y is the centre in CSS px, vx, vy the smoothed velocity and turn the smoothed rate of turn
 * (rad/s); face mirrors a sprite drawn facing a side, -1 to 1; beat is wingbeats a second.
 * h is the heading a wanderer meanders about; u, v its slot in a flock (along and across the
 * heading) or its orbit in the swirl (radius and angle); w its sines as amplitude, rate, phase.
 * @typedef {{x:number, y:number, h:number, speed:number, sp:number, fore:number, aft:number,
 *   half:number, w:number[], n:number, birds:Flier[]}} Flock
 * x, y is its leader's slot; sp its spacing; fore, aft and half how far it reaches ahead of
 * that slot, behind it and to either side, icons and their wobble included.
 */

const SPRITE = 80;   // largest drawn edge in CSS px
const MAX = 28;      // icons made; a small host draws an even spread of them over depth
const FLOCKS = 7;    // flocks of up to five made for the flock variant
const TAU = Math.PI * 2;
// The loose bunch's slots, along and across, apart enough that no two icons sit on each other.
const BUNCH = [0, 0, -0.7, 1.05, -1.05, -0.8, -1.85, 0.35, -0.3, -1.9];
// Icons drawn facing a side, -1 left and 1 right: a flier mirrors them to face its way.
/** @type {Readonly<Record<string, number>>} */
const FACES = { bee: -1, bird: -1, cat: -1, deer: -1, fish: -1, fox: -1, rabbit: -1, sheep: -1, whale: -1,
  airplane: 1, dinosaur: 1, horse: 1, rocket: 1, 'shooting-star': 1 };

/** The sum of n sines from triple i of w at time t.
 * @param {number[]} w @param {number} i @param {number} n @param {number} t @returns {number} */
function wave(w, i, n, t) {
  let s = 0;
  for (let j = i * 3; j < (i + n) * 3; j += 3) s += w[j] * Math.sin(w[j + 1] * t + w[j + 2]);
  return s;
}

/** @param {number} v @param {number} lo @param {number} hi @returns {number} */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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
  const facing = ids.map(id => FACES[id] ?? 0);
  const rng = makeRng(seed);
  /** @param {number} lo @param {number} hi @returns {number} */
  const span = (lo, hi) => lo + rng.random() * (hi - lo);
  const hue0 = rng.int(colors.length);
  // Flocks fly left to right at 1, back at -1; the swirl turns clockwise at 1.
  const dir = rng.random() < 0.5 ? 1 : -1;
  // The swirl's centre drifts on a slow Lissajous: rate and phase across, then down.
  const drift = [span(0.04, 0.06), span(0, TAU), span(0.05, 0.08), span(0, TAU)];

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  /** @type {Flier[]} every icon, far ones first */
  const birds = [];
  /** @type {Flock[]} */
  const flocks = [];
  /** @type {boolean[]} which of birds the host's size has room for */
  let shown = [];
  let W = 0, H = 0, dpr = 1, t = 0, next = 0, settling = false;
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

  /** A flier of icon k at depth z, nearer ones larger, faster, slower to beat and more opaque.
   * @param {number} k @param {number} z @returns {Flier} */
  function flier(k, z) {
    return { k: k % ids.length, d: z, size: 28 + z * 52, speed: 14 + z * 24, alpha: 0.3 + z * 0.4,
      x: 0, y: 0, vx: 0, vy: 0, head: 0, turn: 0, face: 1, beat: 3.8 - z * 1.6 + span(-0.2, 0.2),
      ph: rng.random(), h: 0, u: 0, v: 0, w: [] };
  }

  /** Moves p to nx, ny, and follows its velocity, turn and facing unless it jumped there.
   * @param {Flier} p @param {number} nx @param {number} ny @param {number} dt @param {boolean} jump
   * @returns {void} */
  function move(p, nx, ny, dt, jump) {
    if (dt > 0 && !jump) {
      // The first move sets the velocity outright, with no turn into it.
      const fresh = !p.vx && !p.vy, k = fresh ? 1 : Math.min(1, dt * 6);
      p.vx += ((nx - p.x) / dt - p.vx) * k;
      p.vy += ((ny - p.y) / dt - p.vy) * k;
      const head = Math.atan2(p.vy, p.vx);
      let dh = fresh ? 0 : head - p.head;
      dh -= TAU * Math.round(dh / TAU);
      p.head = head;
      p.turn += (dh / dt - p.turn) * Math.min(1, dt * 3);
      // Turns to face the way it goes, through edge-on, and only once it plainly goes that way.
      const nat = facing[p.k];
      if (!nat) p.face = 1;
      else if (Math.abs(p.vx) > 0.3 * Math.hypot(p.vx, p.vy)) {
        const want = Math.sign(p.vx) * nat;
        p.face = settling ? want : p.face + clamp(want - p.face, -dt * 2, dt * 2);
      }
    }
    p.x = nx; p.y = ny;
  }

  /** Puts a flock just off its entry edge, or anywhere along its way on (re)size.
   * @param {Flock} f @param {number} i its slot, to spread the first ones out @param {boolean} anywhere
   * @returns {void} */
  function launch(f, i, anywhere) {
    // Flatter on a host wider than tall, so it crosses rather than leaving by the top or bottom.
    f.h = (dir > 0 ? 0 : Math.PI) + span(-0.3, 0.3) * Math.min(1, H / W);
    const lane = anywhere ? (0.5 + i * 0.382 + span(0, 0.12)) % 1 : rng.random();
    f.y = H * (0.15 + lane * 0.7);
    // How far along its crossing: just out of sight at 0, and at 1 just gone.
    const along = anywhere ? (i * 0.618 + span(0, 0.15)) % 1 : 0, fore = f.fore + f.half * 0.55;
    const go = (W + fore + f.aft + f.half * 0.55) * along - fore;
    f.x = dir > 0 ? go : W - go;
    // The first ones count from the nearest, which every host shows, so the hero is in sight.
    const k = (anywhere ? FLOCKS - 1 - i : next++) % ids.length;
    for (const b of f.birds) b.k = k;
  }

  /** Makes every icon once, spread evenly over depth, at the first size the host has.
   * @returns {void} */
  function populate() {
    if (layout === 1) {
      for (let i = 0; i < FLOCKS; i++) {
        const z = (i + rng.random()) / FLOCKS, size = 28 + z * 52, sp = size * 1.15, shape = rng.int(3);
        /** @type {Flock} */
        const f = { x: 0, y: 0, h: 0, speed: 16 + z * 22, sp, fore: 0, aft: 0, half: 0, n: 3 + rng.int(3), birds: [],
          w: [span(0.08, 0.16), span(0.1, 0.2), span(0, TAU), span(0.04, 0.08), span(0.3, 0.45), span(0, TAU)] };
        const side = rng.random() < 0.5 ? 1 : -1;
        for (let j = 0; j < 5; j++) {
          const b = flier(0, clamp(z + span(-0.05, 0.05), 0, 1)), rank = Math.ceil(j / 2), wing = j % 2 ? 1 : -1;
          // A V, a slanting line or a loose bunch, in spacings behind and beside the leader.
          if (shape === 0) { b.u = -rank; b.v = wing * rank * 0.8; }
          else if (shape === 1) { b.u = -j * 0.9; b.v = side * j * 0.75; }
          else { b.u = BUNCH[j * 2]; b.v = BUNCH[j * 2 + 1] * side; }
          b.u += span(-0.2, 0.2); b.v += span(-0.2, 0.2);
          b.w = [span(0.1, 0.22), span(0.3, 0.7), span(0, TAU), span(0.1, 0.22), span(0.3, 0.7), span(0, TAU)];
          f.birds.push(b);
          birds.push(b);
        }
        const pad = size * 0.6 + sp * 0.25, us = f.birds.map(b => b.u), vs = f.birds.map(b => Math.abs(b.v));
        f.fore = Math.max(...us) * sp + pad; f.aft = -Math.min(...us) * sp + pad; f.half = Math.max(...vs) * sp + pad;
        launch(f, i, true);
        flocks.push(f);
      }
      return;
    }
    for (let i = 0; i < MAX; i++) {
      // Icons count from the nearest, which every host shows, so the hero is in sight.
      const p = flier(MAX - 1 - i, (i + rng.random()) / MAX);
      if (layout === 0) {
        // Mostly sideways, meandering about it, and now and then a long swing that turns it round.
        p.h = (rng.random() < 0.5 ? 0 : Math.PI) + span(-0.45, 0.45);
        p.w = [span(0.35, 0.7), span(0.12, 0.3), span(0, TAU), span(0.12, 0.3), span(0.35, 0.6), span(0, TAU),
          span(1.2, 1.8), span(0.03, 0.06), span(0, TAU), 0.15, span(0.2, 0.5), span(0, TAU)];
        p.x = span(0, W);
        p.y = span(0, H);
      } else {
        // Radius as a share of the swirl's, even over a ring round its open middle; then the
        // peel's reach, rate and phase, and a slight breathing of the orbit.
        p.u = 0.35 + 0.65 * Math.sqrt(rng.random());
        p.v = span(0, TAU);
        p.w = [span(0.7, 1.4), span(0.07, 0.13), span(0, TAU), 0.06, span(0.2, 0.4), span(0, TAU)];
      }
      birds.push(p);
    }
  }

  /** @returns {void} */
  function resize() {
    const [w, h] = hostSize(host);
    const d = Math.min(3, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr && birds.length) return;
    const remake = d !== dpr || !birds.length;
    // Icons in flight keep their place, scaled to the new size, so dragging a window edge
    // does not reshuffle the field.
    const sx = W ? w / W : 1, sy = H ? h / H : 1;
    for (const p of birds) { p.x *= sx; p.y *= sy; }
    for (const f of flocks) { f.x *= sx; f.y *= sy; }
    W = w; H = h; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (!birds.length) populate();
    const n = clamp(Math.round(W * H / 33000), 8, MAX);
    if (layout === 1) {
      // Fewer to a flock on a small host, where five of the nearest would crowd it.
      const g = clamp(Math.round(n / 3.5), 3, FLOCKS), most = clamp(Math.round(Math.min(W, H) / 100), 3, 5);
      shown = flocks.flatMap((f, i) => f.birds.map((_, j) =>
        j < Math.min(f.n, most) && Math.floor((i + 1) * g / FLOCKS) > Math.floor(i * g / FLOCKS)));
    } else {
      shown = birds.map((_, i) => Math.floor((i + 1) * n / MAX) > Math.floor(i * n / MAX));
    }
    if (remake) makeSprites(); else draw();
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    if (layout === 0) {
      for (const p of birds) {
        const h = p.h + wave(p.w, 0, 3, t), s = p.speed * (1 + wave(p.w, 3, 1, t));
        move(p, p.x + Math.cos(h) * s * dt, p.y + Math.sin(h) * s * dt, dt, false);
        // Off one edge and back in at the other, out of sight both times.
        const m = p.size * 0.7;
        if (p.x > W + m) p.x -= W + 2 * m; else if (p.x < -m) p.x += W + 2 * m;
        if (p.y > H + m) p.y -= H + 2 * m; else if (p.y < -m) p.y += H + 2 * m;
      }
    } else if (layout === 1) {
      flocks.forEach((f, i) => {
        const h = f.h + wave(f.w, 0, 2, t);
        f.x += Math.cos(h) * f.speed * dt;
        f.y += Math.sin(h) * f.speed * dt;
        const aft = f.aft + f.half * 0.55;
        const gone = (dir > 0 ? f.x - aft > W : f.x + aft < 0) || Math.abs(f.y - H / 2) > H / 2 + f.half + f.fore;
        if (gone) launch(f, i, false);
        const c = Math.cos(h), s = Math.sin(h);
        for (const b of f.birds) {
          const a = (b.u + wave(b.w, 0, 1, t)) * f.sp, q = (b.v + wave(b.w, 1, 1, t)) * f.sp;
          move(b, f.x + c * a - s * q, f.y + s * a + c * q, dt, gone);
        }
      });
    } else {
      const cx = W * (0.5 + 0.32 * Math.sin(drift[0] * t + drift[1]));
      const cy = H * (0.5 + 0.26 * Math.sin(drift[2] * t + drift[3]));
      // A group a third of a page across that drifts over it, filling a rail; wider than tall on
      // a wide host and the other way on a rail.
      const R = Math.min(0.6 * Math.min(W, H), Math.max(130, 0.26 * Math.sqrt(W * H))), ex = (W / H) ** 0.3;
      for (const p of birds) {
        // Each peels off on its own slow cycle, lagging as it spirals out, then swings back in.
        const b = Math.max(0, Math.sin(p.w[1] * t + p.w[2])), peel = p.w[0] * b * b * b;
        const r = R * p.u * (1 + peel) * (1 + wave(p.w, 1, 1, t));
        // Inner ones round faster, but the swirl turns as one, a lap in 20 to 60 seconds.
        p.v += dir * Math.min(0.3, (0.1 + p.d * 0.1) / Math.sqrt(p.u)) * dt / (1 + peel);
        move(p, cx + Math.cos(p.v) * r * ex, cy + Math.sin(p.v) * r / ex, dt, false);
      }
    }
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < birds.length; i++) {
      const p = birds[i], spr = sprites[p.k];
      if (!spr || !shown[i]) continue;
      // The beat: a quick squash with a lift, at rest in a still frame.
      const s = reduced ? 0 : Math.sin(Math.PI * ((p.beat * t + p.ph) % 1)) ** 4;
      const f = Math.sin(p.face * Math.PI / 2), nat = facing[p.k];
      // Banks into the turn; one drawn facing a side also pitches its nose up or down the climb.
      let a = clamp(p.turn * 0.55, -0.3, 0.3);
      if (nat) a += clamp(Math.atan2(p.vy, Math.abs(p.vx)), -0.6, 0.6) * 0.5 * nat * f;
      const cos = Math.cos(a), sin = Math.sin(a), wx = f * (1 + 0.05 * s) * dpr, wy = (1 - 0.18 * s) * dpr;
      ctx.setTransform(cos * wx, sin * wx, -sin * wy, cos * wy, p.x * dpr, (p.y - p.size * 0.07 * s) * dpr);
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(spr, -p.size / 2, -p.size / 2, p.size, p.size);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  t = rng.random() * 20;
  resize();
  // Placed, then a moment of flight, so the first frame already banks and faces its way.
  settling = true;
  step(0);
  for (let i = 0; i < 20; i++) step(1 / 30);
  settling = false;
  draw();
  const stop = frameLoop(host, resize, (dt) => {
    step(dt);
    draw();
  }, reduced);
  return () => { cancel(); stop(); cv.remove(); birds.length = 0; flocks.length = 0; };
}
