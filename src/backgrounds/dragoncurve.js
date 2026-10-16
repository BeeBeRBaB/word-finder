// Dragon curve: a strip of paper folded in half again and again and opened out: at each level a
// copy of the whole curve swings a quarter turn about its end, doubling it, and the view eases
// back to keep it in frame. At its finest level it rests, fades, and a new curve unfolds, some at
// other fold angles, which open into lacier curves. The seed picks the variant: one curve,
// coloured by the level each part was added; four dragons swinging out from one point, which
// tile the plane between them; or a gallery of small curves, each on its own angle and pace.

import { stage, TAU, clamp, mix } from './stage.js';

/**
 * A curve and its arms (turned copies about its start), in curve units, one segment long each,
 * drawn into its cell of the host.
 * @typedef {{deg:number, arms:number, px:number[], py:number[], level:number, max:number,
 *   bands:Path2D[], all:Path2D, nx:number[], ny:number[], phase:number, u:number, wait:number,
 *   alpha:number, cell:number[], view:number[], from:number[], to:number[], pace:number, c0:number}} Curve
 */

const UNFOLD = 2.6, REST = 1.1, HOLD = 7, FADE = 2.4;
// The quarter-turn dragon most of the time, and lacier folds between.
const ANGLES = [90, 120, 90, 100, 90, 108];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const col = (/** @type {number} */ k) => s.colors[k % s.colors.length];
    /** @type {Curve[]} */
    let curves = [];
    // The first curve is always the quarter-turn dragon.
    let turn = 2 * rng.int(3);

    /** Points of the next level: the curve so far, reversed and swung by deg about its end. @param {Curve} c */
    function nextPoints(c) {
      const n = c.px.length, ex = c.px[n - 1], ey = c.py[n - 1];
      const a = c.deg * TAU / 360, ca = Math.cos(a), sa = Math.sin(a);
      c.nx = []; c.ny = [];
      for (let i = n - 2; i >= 0; i--) {
        const dx = c.px[i] - ex, dy = c.py[i] - ey;
        c.nx.push(ex + dx * ca - dy * sa); c.ny.push(ey + dx * sa + dy * ca);
      }
    }

    /** A path through points i0..i1 of xs, ys. @param {number[]} xs @param {number[]} ys @param {number} i0 @param {number} i1 */
    function line(xs, ys, i0, i1) {
      const p = new Path2D();
      p.moveTo(xs[i0], ys[i0]);
      for (let i = i0 + 1; i <= i1; i++) p.lineTo(xs[i], ys[i]);
      return p;
    }

    /** The view [centre x, centre y, scale] that fits the curve with extra points into its cell. @param {Curve} c @param {boolean} more */
    function fit(c, more) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let k = 0; k < c.arms; k++) {
        const a = k * TAU / c.arms, ca = Math.cos(a), sa = Math.sin(a);
        /** @param {number[]} xs @param {number[]} ys */
        const add = (xs, ys) => {
          for (let i = 0; i < xs.length; i++) {
            const x = xs[i] * ca - ys[i] * sa, y = xs[i] * sa + ys[i] * ca;
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        };
        add(c.px, c.py);
        if (more) add(c.nx, c.ny);
      }
      const [, , w, h] = c.cell;
      // Never so close that one segment is more than a fourteenth of the cell.
      const sc = Math.min(w / Math.max(x1 - x0, 1e-6), h / Math.max(y1 - y0, 1e-6), Math.min(w, h) / 14);
      return [(x0 + x1) / 2, (y0 + y1) / 2, sc];
    }

    /** The finest level whose segments stay a few pixels long at the fitted size. @param {Curve} c */
    function maxLevel(c) {
      const [, , w, h] = c.cell;
      // Several arms share the cell, so each is about half its size.
      const m = Math.min(w, h) / (c.arms > 1 ? 2 : 1);
      // A curve's span grows about as sqrt(2) a level for the quarter-turn fold, faster for lacier ones.
      const grow = c.deg === 90 ? Math.SQRT2 : 1.62;
      const minSeg = c.arms > 1 ? 4 : 3.4;
      let L = 0;
      while (L < 13 && m / Math.pow(grow, L + 1) * 0.9 > minSeg) L++;
      return clamp(L, 6, c.arms > 1 ? 11 : 13);
    }

    /** Resets a curve to its first segment, with its next angle. @param {Curve} c @param {number} deg */
    function reset(c, deg) {
      c.deg = deg; c.px = [0, 1]; c.py = [0, 0]; c.level = 0;
      c.bands = [line(c.px, c.py, 0, 1)]; c.all = c.bands[0];
      c.phase = 0; c.u = 0; c.wait = 0; c.alpha = 0;
      c.c0 = rng.int(s.colors.length);
      c.max = maxLevel(c);
      nextPoints(c);
      c.view = fit(c, false); c.from = c.view.slice(); c.to = fit(c, true);
    }

    /** Ends the current unfold: the copy joins the curve as a new band. @param {Curve} c */
    function settle(c) {
      const n = c.px.length;
      c.px = c.px.concat(c.nx); c.py = c.py.concat(c.ny);
      c.bands.push(line(c.px, c.py, n - 1, c.px.length - 1));
      c.all = line(c.px, c.py, 0, c.px.length - 1);
      c.level++;
      nextPoints(c);
    }

    /** @param {number[]} cell @param {number} arms @param {number} deg @returns {Curve} */
    function curve(cell, arms, deg) {
      /** @type {Curve} */
      const c = { deg, arms, px: [], py: [], level: 0, max: 0, bands: [], all: new Path2D(), nx: [], ny: [],
        phase: 0, u: 0, wait: 0, alpha: 0, cell, view: [0, 0, 1], from: [0, 0, 1], to: [0, 0, 1],
        pace: 0.85 + rng.random() * 0.3, c0: 0 };
      reset(c, deg);
      return c;
    }

    /** Runs a new curve forward to `level` and part way into the next unfold. @param {Curve} c @param {number} level */
    function warm(c, level) {
      while (c.level < Math.min(level, c.max)) settle(c);
      c.alpha = 1;
      c.view = fit(c, false); c.from = c.view.slice(); c.to = fit(c, true);
      if (c.level >= c.max) { c.phase = 2; c.u = 0; } else { c.phase = 0; c.u = 0.45; }
    }

    /** Cells [centre x, centre y, width, height] for this size. @returns {number[][]} */
    function cells() {
      if (s.layout !== 2) return [[s.W / 2, s.H / 2, s.W * 0.86, s.H * 0.84]];
      const m = Math.min(s.W, s.H);
      const cs = clamp(m * 0.5, 170, 440);
      let cols = Math.max(1, Math.round(s.W / cs)), rows = Math.max(1, Math.round(s.H / cs));
      while (cols * rows > 6) { if (cols >= rows) cols--; else rows--; }
      const cw = s.W / cols, ch = s.H / rows;
      /** @type {number[][]} */
      const out = [];
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) out.push([cw * (k + 0.5), ch * (r + 0.5), cw * 0.8, ch * 0.8]);
      return out;
    }

    /** The next fold angle in the cycle. @returns {number} */
    const nextDeg = () => ANGLES[turn++ % ANGLES.length];

    return {
      lay() {
        const cs = cells();
        if (curves.length !== cs.length) {
          curves = cs.map((cell, k) => {
            const c = curve(cell, s.layout === 1 ? 4 : 1, s.layout === 1 ? 90 : nextDeg());
            warm(c, s.reduced ? c.max : Math.max(3, c.max - 3 - (k * 3) % 5));
            return c;
          });
          return;
        }
        // A new size keeps each curve and its level; only its frame changes.
        curves.forEach((c, k) => {
          c.cell = cs[k];
          c.max = Math.max(c.level, maxLevel(c));
          c.view = fit(c, false); c.from = c.view.slice(); c.to = fit(c, true);
        });
      },
      step(dt) {
        for (const c of curves) {
          const d = dt * c.pace;
          c.alpha = Math.min(1, c.alpha + d / 1.5);
          if (c.phase === 0) {
            // Unfolding: the copy swings while the view eases to fit the doubled curve.
            c.u = Math.min(1, c.u + d / UNFOLD);
            const e = c.u * c.u * (3 - 2 * c.u);
            c.view = [mix(c.from[0], c.to[0], e), mix(c.from[1], c.to[1], e), c.from[2] * Math.pow(c.to[2] / c.from[2], e)];
            if (c.u >= 1) {
              settle(c);
              c.from = c.view.slice();
              c.phase = c.level >= c.max ? 2 : 1; c.wait = 0;
              if (c.phase === 1) c.to = fit(c, true);
            }
          } else if (c.phase === 1) {
            c.wait += d;
            if (c.wait > REST) { c.phase = 0; c.u = 0; }
          } else {
            c.wait += d;
            if (c.wait > HOLD) c.alpha = clamp(1 - (c.wait - HOLD) / FADE, 0, 1);
            if (c.wait > HOLD + FADE) {
              if (s.layout === 1) { reset(c, 90); c.arms = c.arms === 4 ? 2 : 4; c.max = maxLevel(c); c.to = fit(c, true); }
              else reset(c, nextDeg());
              // Start a few levels in, small at the centre, so the first folds are not lost.
              warm(c, 2); c.alpha = 0; c.u = 0;
            }
          }
        }
      },
      draw() {
        const { ctx } = s;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const c of curves) {
          if (c.alpha <= 0) continue;
          const [vx, vy, sc] = c.view;
          const al = (s.dark ? 0.55 : 0.6) * c.alpha;
          const n = c.px.length, ex = c.px[n - 1], ey = c.py[n - 1];
          const e = c.phase === 0 ? c.u * c.u * (3 - 2 * c.u) : 0;
          for (let k = 0; k < c.arms; k++) {
            ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
            ctx.translate(c.cell[0], c.cell[1]);
            ctx.scale(sc, sc);
            ctx.translate(-vx, -vy);
            ctx.rotate(k * TAU / c.arms);
            ctx.lineWidth = clamp(Math.min(s.W, s.H) / 450, 1.3, 2.2) / sc;
            ctx.globalAlpha = al;
            // One arm alone is coloured by level; several each take one colour.
            for (let b = 0; b < c.bands.length; b++) {
              ctx.strokeStyle = col(c.arms > 1 ? c.c0 + k : c.c0 + b);
              ctx.stroke(c.bands[b]);
            }
            if (e > 0) {
              // The copy swinging out about the curve's end.
              ctx.translate(ex, ey);
              ctx.rotate(c.deg * TAU / 360 * e);
              ctx.translate(-ex, -ey);
              ctx.strokeStyle = col(c.arms > 1 ? c.c0 + k : c.c0 + c.bands.length);
              ctx.globalAlpha = al * (0.55 + 0.45 * e);
              ctx.stroke(c.all);
            }
          }
        }
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      },
    };
  });
}
