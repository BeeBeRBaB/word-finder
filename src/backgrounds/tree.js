// Growing tree: a branching tree grows level by level from the trunk out, leafs at its twig
// ends, sways in a breeze, sheds its leaves to drift down and settle, then fades and regrows.
// Layout 0: one broad tree in the middle, leaves falling gently. 1: a grove of smaller trees,
// each at its own point in the cycle. 2: a windswept tree at one side, leaning, its leaves
// carried across the screen on a steady wind.

import { stage, TAU, clamp, mix } from './stage.js';

/**
 * @typedef {{len:number, ang:number, d:number, t0:number, dur:number, kids:Br[], leaves:Lf[]}} Br
 * @typedef {{a:number, at:number, L:number, c:number, shed:number, x:number, y:number, h:number, on:boolean}} Lf
 * @typedef {{root:Br, bx:number, sc:number, age:number, end:number, hold:number, shedT:number, ph:number,
 *   c:number, maxD:number, lean:number, leaves:Lf[], paths:Path2D[], lp:Path2D[], a:number}} Tree
 * @typedef {{x:number, y:number, vx:number, vy:number, r:number, vr:number, ph:number, L:number, c:number, a:number, rest:boolean}} Fall
 * Branch lengths are in trunk lengths; t0 and dur are seconds of the tree's age. A leaf's shed
 * is the age it lets go at; x, y, h are where it was last posed.
 */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const nc = s.colors.length;
    // Layout 2's wind: +1 blows to the right, from a tree on the left.
    const wind = L === 2 ? (rng.random() < 0.5 ? 1 : -1) : 0;
    /** @type {Tree[]} */
    let trees = [];
    /** @type {Fall[]} */
    let falls = [];
    let u = 8, oW = 0, oH = 0;

    const count = () => L === 1 ? clamp(Math.round(s.W / 380), 2, 5) : 1;
    /** The size a tree's trunk scales by. */
    const ref = () => Math.min(s.H, s.W * 1.8);

    /** @param {number} slot @param {number} n @returns {Tree} */
    function tree(slot, n) {
      const maxD = L === 1 ? 6 : 7;
      /** @type {Lf[]} */
      const leaves = [];
      const c = rng.int(nc);
      /** @param {number} len @param {number} ang @param {number} d @param {number} t0 @returns {Br} */
      const br = (len, ang, d, t0) => {
        const dur = 1.3 + rng.random() * 0.5;
        /** @type {Br} */
        const b = { len, ang, d, t0, dur, kids: [], leaves: [] };
        if (d < maxD) {
          const k = d === 0 ? 2 + rng.int(2) : rng.random() < 0.22 ? 3 : 2;
          const spread = mix(0.32, 0.55, rng.random());
          for (let i = 0; i < k; i++) {
            const a = (i - (k - 1) / 2) * spread * 2 / Math.max(1, k - 1) + (rng.random() - 0.5) * 0.25;
            b.kids.push(br(len * (0.7 + rng.random() * 0.12), a, d + 1, t0 + dur));
          }
        }
        if (d >= maxD - 1) {
          for (let i = 0, m = d === maxD ? 3 : 1; i < m; i++) {
            /** @type {Lf} */
            const lf = { a: (rng.random() - 0.5) * 2.2, at: 0.45 + rng.random() * 0.55, L: 1 + rng.random() * 0.5,
              c: nc > 1 && rng.random() < 0.75 ? (c + 1 + rng.int(nc - 1)) % nc : c, shed: 0, x: 0, y: 0, h: 0, on: true };
            b.leaves.push(lf);
            leaves.push(lf);
          }
        }
        return b;
      };
      const root = br(1, 0, 0, 0);
      let end = 0;
      /** @param {Br} b */
      const last = (b) => { end = Math.max(end, b.t0 + b.dur); b.kids.forEach(last); };
      last(root);
      end += 1.6;
      const hold = 7 + rng.random() * 5, shedT = L === 2 ? 14 : 9;
      // Layout 2 starts shedding early and keeps a thin stream going; the others drop all at once.
      for (const lf of leaves) lf.shed = L === 2 ? end + 2 + rng.random() * (hold + shedT - 2) : end + hold + rng.random() * shedT;
      const bx = L === 0 ? 0.5 + (rng.random() - 0.5) * 0.12
        : L === 2 ? (wind > 0 ? 0.24 : 0.76) + (rng.random() - 0.5) * 0.06
        : (slot + 0.5 + (rng.random() - 0.5) * 0.35) / n;
      const sc = L === 1 ? 0.1 + rng.random() * 0.07 : 0.2 + rng.random() * 0.03;
      return { root, bx, sc, age: 0, end, hold, shedT, ph: rng.random() * TAU, c, maxD,
        lean: wind * 0.045, leaves, paths: [], lp: [], a: 1 };
    }

    /** The whole cycle's length: grow, hold, shed, stand bare, fade. @param {Tree} t */
    const cycle = (t) => t.end + t.hold + t.shedT + 2.5 + 3;

    /** Rebuilds a tree's branch and leaf paths at its age and the breeze's moment. @param {Tree} t */
    function pose(t) {
      const trunk = t.sc * ref();
      t.paths = [];
      for (let d = 0; d <= t.maxD; d++) t.paths.push(new Path2D());
      t.lp = s.colors.map(() => new Path2D());
      t.a = 1 - clamp((t.age - (cycle(t) - 3)) / 3, 0, 1);
      const gust = 0.5 + 0.5 * Math.sin(s.t * 0.23 + t.ph);
      /** @param {Br} b @param {number} x @param {number} y @param {number} ang */
      const walk = (b, x, y, ang) => {
        let g = clamp((t.age - b.t0) / b.dur, 0, 1);
        if (g <= 0) return;
        g = g * (2 - g);
        const f = b.d / t.maxD;
        const sway = (0.05 + 0.05 * gust * Math.abs(wind)) * f * Math.sin(s.t * 0.75 + t.ph - b.d * 0.5)
          + t.lean * b.d * (0.8 + 0.4 * gust);
        const a = ang + b.ang + sway;
        const c = Math.cos(a), n = Math.sin(a), l = b.len * trunk * g;
        const ex = x + c * l, ey = y + n * l;
        t.paths[b.d].moveTo(x, y);
        t.paths[b.d].lineTo(ex, ey);
        if (b.leaves.length) {
          const lg = clamp((t.age - b.t0 - b.dur) / 1.6, 0, 1);
          for (const lf of b.leaves) {
            if (!lf.on || lg <= 0) continue;
            lf.x = x + c * l * lf.at; lf.y = y + n * l * lf.at;
            lf.h = a + lf.a + 0.12 * Math.sin(s.t * 1.3 + lf.at * 9);
            leaf(t.lp[lf.c], lf.x, lf.y, lf.h, lf.L * u * 1.6 * lg, lf.L * u * 0.55 * lg);
          }
        }
        for (const k of b.kids) walk(k, ex, ey, a);
      };
      walk(t.root, t.bx * s.W, s.H + 2, -TAU / 4);
    }

    /** @param {number} dt */
    function advance(dt) {
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i];
        t.age += dt;
        if (t.age >= cycle(t)) { trees[i] = tree(i, trees.length); continue; }
        for (const lf of t.leaves) {
          if (!lf.on || t.age < lf.shed || t.age < t.end) continue;
          lf.on = false;
          if (falls.length > 320) continue;
          falls.push({ x: lf.x, y: lf.y, vx: 0, vy: 0, r: lf.h, vr: (rng.random() - 0.5) * 2, ph: rng.random() * TAU,
            L: lf.L, c: lf.c, a: 1, rest: false });
        }
      }
      for (const f of falls) {
        if (f.rest) { f.a -= dt / 4; continue; }
        // Drift down with a side-to-side flutter, and the wind in layout 2.
        f.ph += dt * 1.4;
        f.vx += ((wind * u * 7 + Math.sin(f.ph) * u * 2.5) - f.vx) * Math.min(1, dt * 1.5);
        f.vy += ((u * (2.6 + Math.cos(f.ph * 2) * 1.2)) - f.vy) * Math.min(1, dt * 1.5);
        f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.vr * dt;
        if (f.y > s.H - u * (0.5 + (f.L - 1) * 3)) f.rest = true;
        if (f.x < -20 || f.x > s.W + 20) f.a = 0;
      }
      falls = falls.filter((f) => f.a > 0);
    }

    return {
      lay() {
        u = clamp(Math.min(s.W, s.H) / 70, 5, 10);
        if (oW) for (const f of falls) { f.x *= s.W / oW; f.y *= s.H / oH; }
        const n = count();
        if (trees.length !== n) {
          const first = !trees.length;
          trees = [];
          for (let i = 0; i < n; i++) {
            const t = tree(i, n);
            // A first frame shows a grown tree, or in a grove trees at every stage.
            const span = cycle(t);
            t.age = L === 1 ? rng.random() * (span - 6) : mix(t.end * 0.85, t.end + t.hold + t.shedT * 0.4, rng.random());
            if (first || L !== 1) t.age = Math.max(0, t.age - 8);
            trees.push(t);
          }
          if (first) for (let k = 0; k < 80; k++) advance(0.1);
          else for (const t of trees) t.age += 8;
        }
        oW = s.W; oH = s.H;
        for (const t of trees) pose(t);
      },
      step(dt) {
        advance(dt);
        for (const t of trees) pose(t);
      },
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'round';
        for (const t of trees) {
          const w0 = clamp(t.sc * ref() * 0.085, 2.5, 15);
          ctx.strokeStyle = s.colors[t.c];
          ctx.globalAlpha = t.a * (s.dark ? 0.5 : 0.55);
          for (let d = 0; d <= t.maxD; d++) {
            ctx.lineWidth = Math.max(1.2, w0 * Math.pow(0.66, d));
            ctx.stroke(t.paths[d]);
          }
          ctx.globalAlpha = t.a * (s.dark ? 0.42 : 0.48);
          for (let c = 0; c < nc; c++) { ctx.fillStyle = s.colors[c]; ctx.fill(t.lp[c]); }
        }
        // Falling and fallen leaves, turning over as they drift (their width squashes); a fallen
        // leaf fades in four steps, each a small change on a small leaf.
        /** @type {Path2D[][]} */
        const lp = [1, 2, 3, 4].map(() => s.colors.map(() => new Path2D()));
        for (const f of falls) {
          const flip = 0.3 + 0.7 * Math.abs(Math.cos(f.ph * 0.8));
          const q = clamp(Math.ceil(f.a * 4), 1, 4) - 1;
          leaf(lp[q][f.c], f.x, f.y, f.r, f.L * u * 1.6, f.L * u * 0.55 * (f.rest ? 1 : flip));
        }
        for (let q = 0; q < 4; q++) {
          ctx.globalAlpha = (s.dark ? 0.42 : 0.48) * (q + 1) / 4;
          for (let c = 0; c < nc; c++) { ctx.fillStyle = s.colors[c]; ctx.fill(lp[q][c]); }
        }
      },
    };
  });
}

/** Adds a pointed leaf from (x, y) along angle a, length l and half-width w. @param {Path2D} p
 * @param {number} x @param {number} y @param {number} a @param {number} l @param {number} w */
function leaf(p, x, y, a, l, w) {
  const c = Math.cos(a), n = Math.sin(a);
  p.moveTo(x, y);
  p.quadraticCurveTo(x + c * l * 0.45 + n * w * 1.9, y + n * l * 0.45 - c * w * 1.9, x + c * l, y + n * l);
  p.quadraticCurveTo(x + c * l * 0.45 - n * w * 1.9, y + n * l * 0.45 + c * w * 1.9, x, y);
}
