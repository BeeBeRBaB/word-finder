// Pendulum wave: rows of pendulums of graded lengths, each a little quicker than the last, so
// their bobs (the subject's icons) drift in and out of phase in snakes, splits and realignments.
// The seed picks the variant: rows hung on V strings from a beam, seen a little from above as
// they swing toward the viewer; the same seen from straight overhead as flat snakes about each
// beam; or fans hung from one point, the longest swinging slowest.

import { iconStage } from './icon-stage.js';
import { TAU, clamp } from './stage.js';

/** @typedef {{k:number, px:number, py:number, L:number, T:number, amp:number, ph:number, spread:number,
 *   x:number, y:number, sz:number, z:number}} Bob
 * One pendulum: pivot px, py; length L px (layout 1: its reach on screen); period T s; swing amp
 * radians; ph its start in seconds; spread the half-width of its V string. x, y, sz, z are where
 * draw() last put it. */

const TILT = 0.45;   // layout 0: how far the camera looks down, radians
const M = 60;        // the longest pendulum swings M times a cycle, the next M + 1 and so on

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = layout === 2 ? 190 : 220;   // seconds until every bob is back in line
    const t0 = rng.random() * C;
    const k0 = rng.int(s.n);
    /** @type {Bob[]} */
    let bobs = [];
    /** @type {Bob[]} */
    let order = [];
    /** @type {number[][]} */
    let beams = [];   // x1, y1, x2, y2
    let size = 30, depth = 1;

    /** @param {number} px @param {number} py @param {number} L @param {number} i @param {number} amp
     * @param {number} ph @param {number} spread @returns {Bob} */
    const bob = (px, py, L, i, amp, ph, spread) => ({
      k: k0 + bobs.length, px, py, L, T: C / (M + i), amp, ph, spread, x: px, y: py, sz: size, z: 0,
    });

    return {
      lay() {
        bobs = []; beams = [];
        const { W, H } = s;
        size = clamp(Math.min(W, H) * 0.075, 26, 56);
        if (layout === 2) {
          const fans = W > H * 1.2 ? 2 : 1;
          const Lmax = H * 0.86, Lmin = Math.max(size * 2.2, H * 0.14);
          const N = clamp(Math.floor((Lmax - Lmin) / (size * 1.12)) + 1, 5, 18);
          const reach = W / fans * 0.42;   // px the longest swings out each way
          for (let f = 0; f < fans; f++) {
            const px = W * (f + 0.5) / fans, py = size * 0.4;
            for (let i = 0; i < N; i++) {
              const L = Lmin + (Lmax - Lmin) * i / (N - 1);
              bobs.push(bob(px, py, L, N - 1 - i, Math.min(0.6, reach / L), f * C * 0.37, 0));
            }
          }
        } else {
          const rows = layout === 0 ? (H > W * 1.25 ? 2 : 1) : clamp(Math.round(H / (size * 6)), 1, 4);
          const rowH = H / rows;
          const N = clamp(Math.floor(W * 0.9 / (size * 1.3)), 6, Math.min(24, Math.floor(46 / rows)));
          const gap = W * 0.9 / N;
          depth = rowH * 3.5;
          for (let r = 0; r < rows; r++) {
            const py = layout === 0 ? r * rowH + rowH * 0.04 + size * 0.2 : (r + 0.5) * rowH;
            const Lmax = layout === 0 ? rowH * 0.8 : rowH * 0.36;
            beams.push([W * 0.05 - gap * 0.2, py, W * 0.95 + gap * 0.2, py]);
            for (let j = 0; j < N; j++) {
              const i = r % 2 ? N - 1 - j : j;   // rows alternate which end is longest
              const L = layout === 0 ? Lmax * (M / (M + i)) ** 2 : Lmax;
              bobs.push(bob(W * 0.05 + gap * (j + 0.5), py, L, i, layout === 0 ? 0.42 : 0.5, r * C * 0.29, layout === 0 ? gap * 0.3 : 0));
            }
          }
        }
        order = bobs.slice();
      },
      step() {},
      draw() {
        const { ctx } = s;
        const t = t0 + s.t;
        const cx = s.W / 2;
        for (const b of bobs) {
          const th = b.amp * Math.cos(TAU * (t + b.ph) / b.T);
          if (layout === 0) {
            // Down the string and toward the viewer, seen from a little above.
            b.z = b.L * Math.sin(th);
            const p = 1 + b.z / depth;
            b.x = cx + (b.px - cx) * p;
            b.y = b.py + b.L * Math.cos(th - TILT);
            b.sz = size * p;
          } else if (layout === 1) {
            // From overhead: the swing is the offset; a bob near the top of its arc is nearer.
            b.z = (1 - Math.cos(th)) / (1 - Math.cos(b.amp));
            b.x = b.px;
            b.y = b.py + b.L * Math.sin(th) / Math.sin(b.amp);
            b.sz = size * (1 + 0.16 * b.z);
          } else {
            b.z = 0;
            b.x = b.px + b.L * Math.sin(th);
            b.y = b.py + b.L * Math.cos(th);
            b.sz = size;
          }
        }
        if (layout === 0) order.sort((a, b) => a.z - b.z);
        ctx.lineCap = 'round';
        ctx.strokeStyle = s.ink;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = layout === 0 ? 3 : 2;
        ctx.beginPath();
        for (const [x1, y1, x2, y2] of beams) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
        if (layout === 2) for (const b of bobs) { ctx.moveTo(b.px + 4, b.py); ctx.arc(b.px, b.py, 4, 0, TAU); }
        ctx.stroke();
        ctx.lineWidth = 1.2;
        for (const b of order) {
          ctx.strokeStyle = s.hue(b.k);
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          if (b.spread) {
            ctx.moveTo(b.px - b.spread, b.py); ctx.lineTo(b.x, b.y - b.sz * 0.35);
            if (layout === 0) ctx.lineTo(b.px + b.spread, b.py);
          } else {
            ctx.moveTo(b.px, b.py); ctx.lineTo(b.x, b.y);
          }
          ctx.stroke();
          s.icon(b.k, b.x, b.y, b.sz, 0, 0.44 + 0.12 * (layout === 0 ? clamp(b.z / b.L, -1, 1) : b.z));
        }
      },
    };
  });
}
