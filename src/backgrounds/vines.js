// Vines: stems curl in from the edges, leaves unfurling along them as the tip passes, each stem
// ending in a coiled tendril; a grown vine holds a while, fades, and grows again somewhere new.
// Layout 0: vines creep in from all four edges. 1: a curtain of vines hangs from the top edge and
// sways. 2: ivy climbs from the bottom edge, throwing side shoots that climb with it.

import { stage, TAU, clamp, mix } from './stage.js';

/**
 * @typedef {{i:number, side:number, born:number, L:number}} Leaf
 * @typedef {{x:number[], y:number[], d0:number, h:number, k:number, aim:number, sg:number, len:number,
 *   max:number, acc:number, w:number, leaves:Leaf[], kids:Vine[], age:number, done:boolean}} Vine
 * @typedef {{root:Vine, state:number, hold:number, a:number, c:number, lc:number, ph:number,
 *   ax:number, ay:number, slot:number, v:number}} Plant
 * A Vine is one stem (root or side shoot); d0 is its arc length from the plant's root, for sway.
 * A Plant's state: 0 growing, 1 holding, 2 fading; ax, ay its sway direction.
 */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const nc = s.colors.length;
    /** @type {Plant[]} */
    let plants = [];
    let u = 12, oW = 0, oH = 0;

    /** Unit length: stem segments, leaves and widths all follow it. */
    const unit = () => clamp(Math.min(s.W, s.H) / 42, 8, 17);

    /** @param {number} x @param {number} y @param {number} h @param {number} max @param {number} d0 @param {number} w @returns {Vine} */
    function vine(x, y, h, max, d0, w) {
      return { x: [x], y: [y], d0, h, k: 0, aim: h, sg: rng.random() < 0.5 ? -1 : 1, len: 0, max,
        acc: 0, w, leaves: [], kids: [], age: 0, done: false };
    }

    /** A new plant rooted at an edge, as the layout places it. @param {number} slot @returns {Plant} */
    function plant(slot) {
      const m = mix(Math.min(s.W, s.H), Math.max(s.W, s.H), 0.3);
      /** @type {Vine} */
      let root;
      if (L === 0) {
        // Any edge, by its length; heading inward, give or take 50 degrees.
        const per = rng.random() * 2 * (s.W + s.H);
        let x, y, h;
        if (per < s.W) { x = per; y = -4; h = TAU / 4; }
        else if (per < 2 * s.W) { x = per - s.W; y = s.H + 4; h = -TAU / 4; }
        else if (per < 2 * s.W + s.H) { x = -4; y = per - 2 * s.W; h = 0; }
        else { x = s.W + 4; y = per - 2 * s.W - s.H; h = Math.PI; }
        root = vine(x, y, h + (rng.random() - 0.5) * 1.6, m * (0.38 + rng.random() * 0.4), 0, 1);
      } else {
        const n = count();
        const x = (slot + 0.2 + rng.random() * 0.6) / n * s.W;
        if (L === 1) root = vine(x, -4, TAU / 4 + (rng.random() - 0.5) * 0.5, s.H * (0.25 + rng.random() * 0.6), 0, 1);
        else root = vine(x, s.H + 4, -TAU / 4 + (rng.random() - 0.5) * 0.6, s.H * (0.55 + rng.random() * 0.4), 0, 1.15);
      }
      const c = rng.int(nc);
      const ang = root.h + TAU / 4;
      return { root, state: 0, hold: 4 + rng.random() * 5, a: 1, c, lc: nc > 1 ? (c + 1 + rng.int(nc - 1)) % nc : 0,
        ph: rng.random() * TAU, ax: Math.cos(ang), ay: Math.sin(ang), slot, v: u * (2.6 + rng.random() * 1.4) };
    }

    const count = () => L === 0 ? clamp(Math.round(s.W * s.H / 60000), 8, 18)
      : L === 1 ? clamp(Math.round(s.W / 75), 5, 24) : clamp(Math.round(s.W / 160), 4, 12);

    /** Grows one stem by dt at speed sp, and its side shoots. @param {Vine} v @param {number} dt @param {number} sp @param {boolean} shoot @returns {boolean} all done */
    function grow(v, dt, sp, shoot) {
      let done = true;
      for (const k of v.kids) done = grow(k, dt, sp * 0.9, false) && done;
      if (v.done) return done;
      v.age += dt;
      v.acc += sp * dt;
      const seg = u * 0.5;
      while (v.acc >= seg && !v.done) {
        v.acc -= seg;
        const f = v.len / v.max;
        const n = v.x.length - 1;
        const x = v.x[n], y = v.y[n];
        if (f > 0.8) {
          // The tendril: curvature climbs, so the tip winds into a tightening coil.
          v.k = v.sg * mix(0.15, 1.6, (f - 0.8) / 0.2) / u;
        } else {
          v.k = clamp(v.k + (rng.random() - 0.5) * 0.14 / u, -0.3 / u, 0.3 / u);
          // Lean back toward the aim, harder near an edge it is heading out of.
          let aim = v.aim;
          const edge = 2.5 * u;
          if (x < edge || x > s.W - edge || y < edge || y > s.H - edge) {
            if (n > 6) aim = Math.atan2(s.H / 2 - y, s.W / 2 - x);
          }
          let dh = aim - v.h;
          dh = Math.atan2(Math.sin(dh), Math.cos(dh));
          v.h += dh * (L === 1 ? 0.06 : 0.035);
          if (f > 0.7) v.sg = v.k < 0 ? -1 : 1;
        }
        v.h += v.k * seg;
        v.x.push(x + Math.cos(v.h) * seg);
        v.y.push(y + Math.sin(v.h) * seg);
        v.len += seg;
        // Leaves every few segments, alternating sides, smaller toward the tip; none on the tendril.
        if (n % 3 === 1 && f < 0.76 && n > 1) {
          v.leaves.push({ i: n + 1, side: v.leaves.length % 2 ? 1 : -1, born: v.age,
            L: u * (1.4 + rng.random() * 0.6) * (1 - f * 0.5) * (v.w < 1 ? 0.85 : 1) });
        }
        if (shoot && L === 2 && f > 0.15 && f < 0.65 && v.kids.length < 3 && rng.random() < 0.035) {
          const side = rng.random() < 0.5 ? -1 : 1;
          const k = vine(v.x[n + 1], v.y[n + 1], v.h + side * (0.6 + rng.random() * 0.4),
            v.max * (0.25 + rng.random() * 0.25), v.d0 + v.len, 0.65);
          k.aim = -TAU / 4 + side * 0.7;
          v.kids.push(k);
        }
        if (v.len >= v.max) v.done = true;
      }
      return v.done && done;
    }

    /** Advances a plant through grow, hold and fade; a faded one is replanted. @param {Plant} p @param {number} dt @param {number} i */
    function advance(p, dt, i) {
      if (p.state === 0) { if (grow(p.root, dt, p.v, true)) p.state = 1; }
      else if (p.state === 1) { p.hold -= dt; if (p.hold <= 0) p.state = 2; }
      else {
        p.a -= dt / 3.5;
        if (p.a <= 0) plants[i] = plant(p.slot);
      }
    }

    /** Runs a new plant on by up to `t` seconds, so a first frame shows vines at every stage. @param {number} i @param {number} t */
    function warm(i, t) {
      for (let k = 0; k < t; k += 0.1) advance(plants[i], 0.1, i);
    }

    /** @param {Vine} v @param {number} sx @param {number} sy */
    function scale(v, sx, sy) {
      for (let i = 0; i < v.x.length; i++) { v.x[i] *= sx; v.y[i] *= sy; }
      for (const k of v.kids) scale(k, sx, sy);
    }

    /** Strokes one stem and its shoots, swayed, tapering toward the tip.
     * @param {Vine} v @param {number} ox @param {number} oy @param {number} D @param {Path2D} leaves @param {Path2D} ribs @param {number} age */
    function stem(v, ox, oy, D, leaves, ribs, age) {
      const { ctx } = s;
      const n = v.x.length;
      const seg = u * 0.5;
      const w0 = Math.max(1.5, u * 0.2 * v.w);
      /** @param {number} i @returns {number} */
      const sw = (i) => Math.min(1, (v.d0 + i * seg) / D);
      for (let a = 0; a < n - 1; a += 10) {
        const b = Math.min(n - 1, a + 10);
        const f = (a + b) / 2 / Math.max(1, v.max / seg);
        ctx.lineWidth = Math.max(1.2, w0 * (1 - 0.65 * f));
        ctx.beginPath();
        for (let i = a; i <= b; i++) {
          const q = sw(i);
          if (i === a) ctx.moveTo(v.x[i] + ox * q, v.y[i] + oy * q);
          else ctx.lineTo(v.x[i] + ox * q, v.y[i] + oy * q);
        }
        ctx.stroke();
      }
      for (const lf of v.leaves) {
        const i = lf.i;
        if (i >= n) continue;
        let g = clamp((v.age - lf.born) / 1.6, 0, 1);
        g = 1 - (1 - g) * (1 - g);
        if (g <= 0.02) continue;
        const j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
        const h = Math.atan2(v.y[j1] - v.y[j0], v.x[j1] - v.x[j0]);
        // Unfurling: the leaf opens away from the stem as it grows.
        const ang = h + lf.side * mix(0.15, 0.95, g);
        const q = sw(i);
        leaf(leaves, ribs, v.x[i] + ox * q, v.y[i] + oy * q, ang, lf.L * g, lf.L * 0.42 * g * g);
      }
      for (const k of v.kids) stem(k, ox, oy, D, leaves, ribs, age);
    }

    return {
      lay() {
        u = unit();
        if (oW && (oW !== s.W || oH !== s.H)) for (const p of plants) scale(p.root, s.W / oW, s.H / oH);
        oW = s.W; oH = s.H;
        const n = count();
        const old = plants.length;
        plants.length = Math.min(old, n);
        for (let i = plants.length; i < n; i++) {
          plants.push(plant(i));
          // Staggered starts: some still growing, some grown, a few fading.
          warm(i, rng.random() * 16);
        }
      },
      step(dt) {
        for (let i = 0; i < plants.length; i++) advance(plants[i], dt, i);
      },
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const D = Math.min(s.W, s.H) * 0.8;
        for (const p of plants) {
          // A slow breeze bends each plant from its root, more for the hanging ones.
          const amp = u * (L === 1 ? 2.2 : 0.9);
          const b = Math.sin(s.t * 0.45 + p.ph) + 0.4 * Math.sin(s.t * 0.83 + p.ph * 2);
          const ox = p.ax * amp * b, oy = p.ay * amp * b;
          const leaves = new Path2D(), ribs = new Path2D();
          ctx.globalAlpha = p.a * (s.dark ? 0.5 : 0.58);
          ctx.strokeStyle = s.colors[p.c];
          stem(p.root, ox, oy, D, leaves, ribs, s.t);
          ctx.globalAlpha = p.a * (s.dark ? 0.34 : 0.4);
          ctx.fillStyle = s.colors[p.lc];
          ctx.fill(leaves);
          ctx.globalAlpha = p.a * (s.dark ? 0.45 : 0.5);
          ctx.lineWidth = 1;
          ctx.stroke(ribs);
        }
      },
    };
  });
}

/** Adds a pointed leaf from (x, y) along angle a, length l and half-width w, and its midrib.
 * @param {Path2D} body @param {Path2D} rib @param {number} x @param {number} y @param {number} a @param {number} l @param {number} w */
function leaf(body, rib, x, y, a, l, w) {
  const c = Math.cos(a), n = Math.sin(a);
  /** @param {number} lx @param {number} ly @returns {[number, number]} */
  const at = (lx, ly) => [x + lx * c - ly * n, y + lx * n + ly * c];
  const [tx, ty] = at(l, 0);
  const [ax, ay] = at(l * 0.45, -w * 1.9);
  const [bx, by] = at(l * 0.45, w * 1.9);
  body.moveTo(x, y);
  body.quadraticCurveTo(ax, ay, tx, ty);
  body.quadraticCurveTo(bx, by, x, y);
  const [mx, my] = at(l * 0.8, 0);
  rib.moveTo(x, y);
  rib.lineTo(mx, my);
}
