// String art: nails round a frame, a thread from each nail i to nail i x m, the multiplier m
// creeping slowly so the threads sweep through a cardioid, a nephroid and the rest of the times
// table. The seed picks the variant: one large circle, a gallery of smaller circles each on its
// own table and pace, or nails round the edge of the host itself so the threads cross the whole
// screen.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, r:number, n:number, m0:number, span:number, f:number, ph:number, c:number}} Frame
 * A circle of n nails at x, y, radius r; its multiplier steps m0 .. m0 + span and back, f seconds
 * a step, from ph steps in; c is its first colour. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Frame[]} */
    let frames = [];
    const c0 = rng.int(nc), ph0 = rng.random() * 9;
    // The rectangle variant's nails, as [x, y] round the border.
    /** @type {number[]} */
    let rect = [];

    /** The multiplier of frame f now: it rests a while on each whole number, where the figure is
     * cleanest, then eases to the next. @param {Frame} f @returns {number} */
    function mult(f) {
      const q = (s.t / f.f + f.ph) % (f.span * 2), tri = q < f.span ? q : f.span * 2 - q;
      const k = Math.floor(tri), e = clamp(((tri - k) - 0.35) / 0.5, 0, 1);
      return f.m0 + k + e * e * (3 - 2 * e);
    }

    /** Nail position at fraction p (any real) round the host's border. @param {number} p @returns {[number, number]} */
    function onRect(p) {
      const n = rect.length / 2;
      const q = ((p % 1) + 1) % 1 * n, i = Math.floor(q), u = q - i, j = (i + 1) % n;
      return [rect[i * 2] + (rect[j * 2] - rect[i * 2]) * u, rect[i * 2 + 1] + (rect[j * 2 + 1] - rect[i * 2 + 1]) * u];
    }

    return {
      lay() {
        const { W, H } = s, m = Math.min(W, H);
        frames = [];
        if (layout === 1) {
          const n = clamp(Math.round(W * H / 230000), 2, 6);
          const cols = clamp(Math.round(Math.sqrt(n * W / H)), 1, n), rows = Math.ceil(n / cols);
          const cw = W / cols, ch = H / rows, r = Math.min(cw, ch) * 0.4;
          for (let k = 0; k < n; k++) {
            const row = Math.floor(k / cols), inRow = row === rows - 1 ? n - row * cols : cols;
            const x = (W - inRow * cw) / 2 + (k - row * cols + 0.5) * cw;
            frames.push({ x, y: (row + 0.5) * ch, r, n: clamp(Math.round(r / 1.1), 80, 200),
              m0: 2 + k % 2, span: 2 + rng.int(3), f: 11 + rng.random() * 5, ph: rng.random() * 8, c: (c0 + k) % nc });
          }
        } else if (layout === 0) {
          const r = m * 0.46;
          frames.push({ x: W / 2, y: H / 2, r, n: clamp(Math.round(r / 1.5), 90, 220), m0: 2, span: 9, f: 12, ph: ph0, c: c0 });
        } else {
          // Nails every few px round the border, an inset in from the edge.
          const e = clamp(m * 0.04, 10, 40), step = clamp(m / 60, 7, 16);
          rect = [];
          /** @type {[number, number, number, number][]} */
          const sides = [[e, e, W - e, e], [W - e, e, W - e, H - e], [W - e, H - e, e, H - e], [e, H - e, e, e]];
          for (const [x0, y0, x1, y1] of sides) {
            const k = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
            for (let i = 0; i < k; i++) rect.push(x0 + (x1 - x0) * i / k, y0 + (y1 - y0) * i / k);
          }
          frames.push({ x: 0, y: 0, r: 0, n: rect.length / 2, m0: 2, span: 3, f: 14, ph: ph0, c: c0 });
        }
      },
      step() {},
      draw() {
        const { ctx } = s;
        ctx.lineWidth = 1;
        for (const f of frames) {
          const m = mult(f), circle = layout !== 2;
          // Slow turn of the whole circle, so even a still multiplier drifts.
          const rot = circle ? s.t * 0.012 + f.ph : 0;
          /** @param {number} i @returns {[number, number]} */
          const nail = (i) => {
            if (!circle) return onRect(i / f.n);
            const a = TAU * i / f.n + rot;
            return [f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r];
          };
          // Threads, in a colour per run of nails.
          const groups = Math.min(nc, 4);
          for (let g = 0; g < groups; g++) {
            ctx.beginPath();
            for (let i = Math.floor(g * f.n / groups); i < Math.floor((g + 1) * f.n / groups); i++) {
              const [x0, y0] = nail(i), [x1, y1] = nail(i * m);
              ctx.moveTo(x0, y0);
              ctx.lineTo(x1, y1);
            }
            ctx.strokeStyle = s.colors[(f.c + g) % nc];
            ctx.globalAlpha = s.dark ? (circle ? 0.26 : 0.22) : (circle ? 0.34 : 0.3);
            ctx.stroke();
          }
          // The nails.
          ctx.globalAlpha = s.dark ? 0.45 : 0.5;
          ctx.fillStyle = s.ink;
          ctx.beginPath();
          const d = circle ? clamp(f.r / 120, 1, 1.8) : 1.3;
          for (let i = 0; i < f.n; i++) {
            const [x, y] = nail(i);
            ctx.rect(x - d, y - d, d * 2, d * 2);
          }
          ctx.fill();
        }
      },
    };
  });
}
