// Paper planes: folded darts glide in long banking curves, each leaving a faint trail; a banked
// plane shows its inner wing foreshortened and a slice of keel. The seed picks the variant: planes
// seen from above wandering freely, each steering for a far point and banking into the turn; a
// flight of planes in a V following a lead plane round a slow figure of eight; or planes seen
// from the side, launched in turn from either edge and gliding across in gentle swoops.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, a:number, w:number, v:number, c:number, tx:number, ty:number,
 *   next:number, dir:number, y0:number, ph:number, k:number, trail:number[], tick:number}} Plane
 * A plane: position, heading a (rad), turn rate w (rad/s), speed v (px/s), colour c; tx, ty its
 * target and next the seconds until it picks a new one (from above); dir, y0, ph, k its glide
 * (from the side: travel direction, start height, swoop phase and wavelength); trail the past
 * positions as x, y pairs, oldest first, and tick the seconds until the next is kept. */

const TRAIL = 34;        // trail points kept
const EVERY = 0.12;      // seconds between trail points
const WMAX = 0.55;       // fastest turn, rad/s

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Plane[]} */
    const planes = [];
    let unit = 1, size = 20, warm = true, lastW = 0, lastH = 0, clock = 0;
    const ph0 = rng.random() * TAU;

    /** @param {number} a @returns {number} a wrapped into -pi .. pi */
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

    /** A new target somewhere well inside the host. @param {Plane} p @returns {void} */
    function aim(p) {
      p.tx = s.W * (0.1 + 0.8 * rng.random()); p.ty = s.H * (0.1 + 0.8 * rng.random());
      p.next = 7 + rng.random() * 8;
    }

    /** Starts a side-view plane at an edge, or anywhere along its glide if `anywhere`. @param {Plane} p @param {boolean} anywhere @returns {void} */
    function launch(p, anywhere) {
      p.dir = rng.random() < 0.5 ? -1 : 1;
      p.v = (55 + rng.random() * 40) * unit;
      p.y0 = s.H * (0.05 + rng.random() * 0.5);
      p.k = (260 + rng.random() * 220) * unit;
      p.ph = rng.random() * TAU;
      p.x = p.dir > 0 ? -size * 2 : s.W + size * 2;
      if (anywhere) p.x = rng.random() * s.W;
      p.y = glideY(p, p.x);
      p.trail = [];
    }

    /** A new plane. @param {number} i @returns {Plane} */
    function make(i) {
      /** @type {Plane} */
      const p = { x: rng.random() * s.W, y: rng.random() * s.H, a: rng.random() * TAU, w: 0, v: (45 + rng.random() * 30) * unit,
        c: (i + rng.int(2)) % nc, tx: 0, ty: 0, next: 0, dir: 1, y0: 0, ph: 0, k: 1, trail: [], tick: rng.random() * EVERY };
      if (layout === 2) launch(p, true); else aim(p);
      return p;
    }

    /** Height of a side-view plane at x: a shallow descent with swoops. @param {Plane} p @param {number} x @returns {number} */
    function glideY(p, x) {
      const d = p.dir > 0 ? x : s.W - x;
      return p.y0 + d * 0.16 + Math.sin(d / p.k * TAU + p.ph) * p.k * 0.09;
    }

    /** The V's lead point on its figure of eight at time t. @param {number} t @returns {[number, number]} */
    function lead(t) {
      const u = t * 0.085 + ph0;
      return [s.W / 2 + s.W * 0.27 * Math.sin(u), s.H / 2 + s.H * 0.2 * Math.sin(2 * u)];
    }

    /** @param {number} dt @returns {void} */
    function advance(dt) {
      clock += dt;
      if (layout === 1) {
        // The flight: plane i sits in the V behind the lead, in the lead's frame.
        const [x0, y0] = lead(clock), [x1, y1] = lead(clock + 0.5), [x2, y2] = lead(clock + 1);
        const a = Math.atan2(y1 - y0, x1 - x0), a2 = Math.atan2(y2 - y1, x2 - x1);
        const w = wrap(a2 - a) * 2, gap = size * 2.2;
        planes.forEach((p, i) => {
          const rank = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
          const bx = -rank * gap, by = side * rank * gap * 0.75;
          p.x = x0 + bx * Math.cos(a) - by * Math.sin(a);
          p.y = y0 + bx * Math.sin(a) + by * Math.cos(a);
          p.a = a; p.w = w;
        });
      } else if (layout === 2) {
        for (const p of planes) {
          const nx = p.x + p.dir * p.v * dt;
          const ny = glideY(p, nx);
          p.a = Math.atan2(ny - p.y, nx - p.x);
          p.x = nx; p.y = ny;
          if (p.x < -size * 3 || p.x > s.W + size * 3 || p.y > s.H + size * 2) launch(p, false);
        }
      } else {
        for (const p of planes) {
          p.next -= dt;
          if (p.next <= 0 || Math.hypot(p.tx - p.x, p.ty - p.y) < size * 4) aim(p);
          // Turn toward the target, easing the turn rate so the bank changes slowly.
          const want = clamp(wrap(Math.atan2(p.ty - p.y, p.tx - p.x) - p.a) * 0.6, -WMAX, WMAX);
          p.w += (want - p.w) * Math.min(1, dt * 0.8);
          p.a += p.w * dt;
          p.x += Math.cos(p.a) * p.v * dt;
          p.y += Math.sin(p.a) * p.v * dt;
        }
      }
      for (const p of planes) {
        p.tick -= dt;
        if (p.tick > 0) continue;
        p.tick += EVERY;
        p.trail.push(p.x - Math.cos(p.a) * size * 0.7, p.y - Math.sin(p.a) * size * 0.7);
        if (p.trail.length > TRAIL * 2) p.trail.splice(0, 2);
      }
    }

    /** Draws plane p seen from above, banked by its turn. @param {Plane} p @returns {void} */
    function top(p) {
      const { ctx } = s, b = clamp(p.w / WMAX, -1, 1), S = size;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      // The wing on the inside of the turn tilts down and away, so it looks narrower.
      const wl = 0.62 * (1 + 0.45 * b), wr = 0.62 * (1 - 0.45 * b);
      ctx.fillStyle = s.colors[p.c];
      ctx.globalAlpha = s.dark ? 0.42 + 0.12 * b : 0.46 + 0.12 * b;
      tri(ctx, S, 0, -0.75 * S, -wl * S, -0.62 * S, 0);
      ctx.globalAlpha = s.dark ? 0.42 - 0.12 * b : 0.46 - 0.12 * b;
      tri(ctx, S, 0, -0.75 * S, wr * S, -0.62 * S, 0);
      // The keel shows on the outside of the turn.
      ctx.globalAlpha = 0.3 * Math.abs(b) + 0.05;
      ctx.fillStyle = s.ink;
      tri(ctx, S, 0, -0.62 * S, 0, -0.66 * S, -b * 0.2 * S);
      ctx.globalAlpha = s.dark ? 0.4 : 0.45;
      ctx.strokeStyle = s.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(S, 0); ctx.lineTo(-0.62 * S, 0);
      ctx.stroke();
    }

    /** Draws plane p from the side, nose along its glide. @param {Plane} p @returns {void} */
    function side(p) {
      const { ctx } = s, S = size;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      if (p.dir < 0) ctx.scale(1, -1);
      ctx.fillStyle = s.colors[p.c];
      ctx.globalAlpha = s.dark ? 0.5 : 0.52;
      tri(ctx, S, 0, -0.85 * S, -0.34 * S, -0.7 * S, 0.02 * S);
      ctx.globalAlpha = s.dark ? 0.3 : 0.32;
      tri(ctx, S, 0, -0.7 * S, 0.02 * S, -0.62 * S, 0.24 * S);
      ctx.globalAlpha = s.dark ? 0.4 : 0.45;
      ctx.strokeStyle = s.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(S, 0); ctx.lineTo(-0.7 * S, 0.02 * S);
      ctx.stroke();
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        unit = clamp(m / 700, 0.6, 1.4);
        size = clamp(m * 0.04, 15, 36);
        const n = layout === 1 ? clamp(Math.round(s.W * s.H / 120000), 5, 9) : clamp(Math.round(s.W * s.H / 85000), 5, 16);
        while (planes.length < n) planes.push(make(planes.length));
        planes.length = n;
        // Keep the planes, moved with the host's new size.
        if (lastW) {
          for (const p of planes) {
            const fx = s.W / lastW, fy = s.H / lastH;
            p.x *= fx; p.y *= fy; p.y0 *= fy;
            for (let i = 0; i < p.trail.length; i += 2) { p.trail[i] *= fx; p.trail[i + 1] *= fy; }
            if (layout === 0) aim(p);
          }
        }
        lastW = s.W; lastH = s.H;
        // Fly a few seconds first, so the trails are already drawn on a still frame.
        if (warm) { warm = false; for (let k = 0; k < 40; k++) advance(0.1); }
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        ctx.lineWidth = clamp(size / 12, 1.2, 2.2);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Trails, fading out toward their old end in three steps.
        for (const p of planes) {
          const n = p.trail.length / 2;
          if (n < 2) continue;
          ctx.strokeStyle = s.colors[p.c];
          for (let k = 0; k < 3; k++) {
            const i0 = Math.floor(n * k / 3), i1 = Math.min(n - 1, Math.floor(n * (k + 1) / 3));
            ctx.beginPath();
            ctx.moveTo(p.trail[i0 * 2], p.trail[i0 * 2 + 1]);
            for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(p.trail[i * 2], p.trail[i * 2 + 1]);
            if (k === 2) ctx.lineTo(p.x - Math.cos(p.a) * size * 0.7, p.y - Math.sin(p.a) * size * 0.7);
            ctx.globalAlpha = (s.dark ? 0.06 : 0.08) * (k + 1);
            ctx.stroke();
          }
        }
        for (const p of planes) { if (layout === 2) side(p); else top(p); }
      },
    };
  });
}

/** Fills the triangle a, b, c. @param {CanvasRenderingContext2D} ctx @param {number} ax @param {number} ay
 * @param {number} bx @param {number} by @param {number} cx @param {number} cy @returns {void} */
function tri(ctx, ax, ay, bx, by, cx, cy) {
  ctx.beginPath();
  ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
}
