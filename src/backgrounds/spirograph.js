// Spirograph: a toothed wheel rolls inside a fixed ring and the pen in one of its holes draws a
// looping hypotrochoid; once the figure closes the wheel is swapped and a new one is drawn over
// it while the old line fades out in the order it was drawn. The seed picks the variant: one large
// figure with its ring, wheel and pen shown; a loose grid of small figures, each with its own wheel
// and pace, some rolling outside the ring; small rings sliding across the page so the loops trail
// out into long fading ribbons.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{ox:number, oy:number, k:number, rho:number, d:number, epi:boolean, rot:number, th:number,
 *   end:number, rate:number, len:number, c:number, buf:Float32Array, head:number, n:number, life:number,
 *   slide:{ax:number, ay:number, fx:number, fy:number, px:number, py:number, sz:number}|null, show:boolean}} Pen
 * Draws at (ox, oy), k px per unit (the fixed ring is radius 1). Wheel radius rho, pen hole d from
 * its centre, rolling outside when epi; th runs 0..end at `rate` rad/s (len: the figure's length in units). buf is a ring of [x, y, time, colour]
 * in units, n of them ending at head; a point fades out `life` seconds after it is drawn. A sliding
 * pen's ring centre wanders on a Lissajous path (amplitudes ax, ay) and the figure is sz units. */

// Wheel / ring tooth ratios m/n in lowest terms: n lobes, closing after m trips round the ring.
const RATIOS = [[2, 5], [3, 7], [3, 8], [2, 7], [3, 10], [4, 9], [3, 11], [2, 9], [4, 11], [5, 12], [5, 13],
  [4, 13], [5, 14], [5, 16], [6, 13], [7, 16], [7, 18], [5, 18], [7, 20]];
/** Pen speed, px/s: a little faster on bigger figures. @param {number} k @returns {number} */
const speed = (k) => clamp(k * 0.9, 170, 340);
const RATE = 60;   // points a second

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Pen[]} */
    let pens = [];
    let now = 0, warm = false;

    /** A new wheel and pen hole for `p`, and a colour. @param {Pen} p @returns {void} */
    function rewheel(p) {
      // Pick a wheel whose figure takes 12-30 s at the pen's speed, so small figures get more loops.
      let m = 2, n = 5;
      for (let k = 0; k < 12; k++) {
        [m, n] = RATIOS[rng.int(p.slide ? 8 : RATIOS.length)];
        p.rho = m / n;
        p.d = p.rho * (0.55 + rng.random() * 0.4);
        p.len = TAU * m * (1 - p.rho) * (1 + p.d / p.rho) * 0.75;
        if (p.slide || p.len * p.k / speed(p.k) < 32) break;
      }
      p.epi = layout === 1 && rng.random() < 0.35;
      p.rot = rng.random() * TAU;
      p.th = 0;
      // The figure closes after the wheel has gone round the ring m times.
      p.end = TAU * m;
      p.c = (p.c + 1 + rng.int(Math.max(1, nc - 1))) % nc;
      // A sliding one loops about once every 2.5 seconds.
      p.rate = p.slide ? TAU * 0.4 / (1 - p.rho) * (0.8 + rng.random() * 0.4) : 0;
      // A pen-up mark so the new figure does not join the old one.
      push(p, NaN, NaN);
    }

    /** Where the pen is, in units: hypotrochoid (inside) or epitrochoid (outside), scaled to fit
     * radius 1. @param {Pen} p @param {number[]} out @returns {void} */
    function pos(p, out) {
      const { rho, d, th } = p;
      let x, y;
      if (p.epi) {
        const q = (1 + rho) / rho, f = 1 / (1 + rho + d);
        x = ((1 + rho) * Math.cos(th) - d * Math.cos(q * th)) * f;
        y = ((1 + rho) * Math.sin(th) - d * Math.sin(q * th)) * f;
      } else {
        const q = (1 - rho) / rho;
        x = (1 - rho) * Math.cos(th) + d * Math.cos(q * th);
        y = (1 - rho) * Math.sin(th) - d * Math.sin(q * th);
      }
      const c = Math.cos(p.rot), sn = Math.sin(p.rot);
      out[0] = x * c - y * sn;
      out[1] = x * sn + y * c;
    }

    /** @param {Pen} p @param {number} x @param {number} y @returns {void} */
    function push(p, x, y) {
      const cap = p.buf.length / 4, j = ((p.head + 1) % cap) * 4;
      p.head = j / 4;
      p.buf[j] = x; p.buf[j + 1] = y; p.buf[j + 2] = now; p.buf[j + 3] = p.c;
      if (p.n < cap) p.n++;
    }

    /** Where a sliding pen's ring is at time `t`, in units. @param {Pen} p @param {number} t @param {number[]} out @returns {void} */
    function base(p, t, out) {
      const sl = p.slide;
      if (!sl) { out[0] = 0; out[1] = 0; return; }
      out[0] = sl.ax * Math.sin(t * sl.fx + sl.px);
      out[1] = sl.ay * Math.sin(t * sl.fy + sl.py);
    }

    /** @param {number} life @param {number} rate @param {Pen['slide']} slide @returns {Pen} */
    function pen(life, rate, slide) {
      // Room for `life` seconds of points, plus slack.
      const p = { ox: 0, oy: 0, k: 1, rho: 0.4, d: 0.3, epi: false, rot: 0, th: 0, end: TAU, rate, c: rng.int(nc),
        buf: new Float32Array(Math.ceil(life * RATE + 60) * 4), len: 1, head: 0, n: 0, life, slide, show: layout === 0 };
      rewheel(p);
      return p;
    }

    /** @type {number[]} */
    const q = [0, 0], b = [0, 0];

    /** @param {number} dt @returns {void} */
    function step(dt) {
      // Points at a steady 30 a second, so the buffers never overrun.
      now += dt;
      for (const p of pens) {
        const sub = Math.max(1, Math.round(dt * RATE));
        for (let i = 0; i < sub; i++) {
          // Fixed figures: the pen at speed(k) px/s, a figure in 12-32 s.
          const rate = p.slide ? p.rate : p.end / clamp(p.len * p.k / speed(p.k), 12, 32);
          p.th += rate * dt / sub;
          if (p.th >= p.end) { if (p.slide) p.th -= p.end; else { rewheel(p); continue; } }
          pos(p, q);
          base(p, now, b);
          const sz = p.slide ? p.slide.sz : 1;
          push(p, b[0] + q[0] * sz, b[1] + q[1] * sz);
        }
      }
    }

    /** Places the pens for this size; their drawings are kept in units. @returns {void} */
    function place() {
      const m = Math.min(s.W, s.H);
      if (layout === 0) {
        pens[0].ox = s.W / 2; pens[0].oy = s.H / 2; pens[0].k = m * 0.45;
        // Wide or tall screens: two smaller figures in the spare room either side.
        const side = Math.max(s.W, s.H) - m;
        for (let i = 1; i < pens.length; i++) {
          const k = clamp(Math.min(side / 2, m) * 0.4, 0, m * 0.3), o = (m + side / 2) / 2;
          const sg = i === 1 ? -1 : 1;
          pens[i].k = side > m * 0.35 ? k : 0;
          pens[i].ox = s.W / 2 + (s.W > s.H ? sg * o : 0);
          pens[i].oy = s.H / 2 + (s.W > s.H ? 0 : sg * o);
        }
      } else if (layout === 1) {
        const n = pens.length, cols = Math.max(1, Math.round(Math.sqrt(n * s.W / s.H))), rows = Math.ceil(n / cols);
        const cw = s.W / cols, ch = s.H / rows;
        pens.forEach((p, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          const inRow = r === rows - 1 ? n - r * cols : cols, off = (cols - inRow) * cw / 2;
          p.ox = off + (c + 0.5) * cw + ((i * 37) % 11 - 5) * cw * 0.02;
          p.oy = (r + 0.5) * ch + ((i * 53) % 9 - 4) * ch * 0.02;
          p.k = Math.min(cw, ch) * 0.42;
        });
      } else {
        for (const p of pens) {
          p.ox = s.W / 2; p.oy = s.H / 2; p.k = m / 2;
          const sl = /** @type {NonNullable<Pen['slide']>} */ (p.slide);
          sl.ax = s.W / m - sl.sz - 0.04; sl.ay = s.H / m - sl.sz - 0.04;
        }
      }
    }

    if (layout === 0) {
      pens = [pen(42, 0, null), pen(42, 0, null), pen(42, 0, null)];
    } else if (layout === 1) {
      const n = clamp(Math.round(s.W * s.H / 220000), 2, 6);
      for (let i = 0; i < n; i++) pens.push(pen(42, 0, null));
    } else {
      const n = clamp(Math.round(s.W * s.H / 400000), 3, 5);
      const p0 = rng.random() * TAU;
      for (let i = 0; i < n; i++) {
        // Spread round their paths, so the ribbons start apart.
        pens.push(pen(16, 0, { ax: 0, ay: 0, fx: 0.035 + rng.random() * 0.03, fy: 0.05 + rng.random() * 0.03,
          px: p0 + i * TAU / n * 1.618, py: p0 + i * TAU / n, sz: 0.11 + rng.random() * 0.05 }));
      }
    }

    return {
      lay() {
        place();
        // Draw most of a figure before the first paint, so a still frame shows one.
        if (warm) return;
        warm = true;
        // The first wheels were picked before the pens had a size.
        for (const p of pens) if (!p.slide) rewheel(p);
        for (let i = 0; i < 600; i++) step(1 / 30);
      },
      step,
      draw() {
        const { ctx } = s;
        const A = s.dark ? 0.62 : 0.7;
        ctx.lineJoin = ctx.lineCap = 'round';
        for (const p of pens) {
          if (p.k <= 0 || !p.n) continue;
          ctx.setTransform(s.dpr * p.k, 0, 0, s.dpr * p.k, s.dpr * p.ox, s.dpr * p.oy);
          ctx.lineWidth = clamp(p.k / 180, 1.1, 1.8) / p.k;
          if (p.show) mechanism(p, A);
          const cap = p.buf.length / 4, buf = p.buf;
          // Oldest to newest in chunks, each at the alpha of its age; a pen-up ends a figure and
          // its colour.
          const K = 12, per = Math.ceil(p.n / K);
          let i = (p.head - p.n + 1 + cap) % cap, left = p.n;
          let px = NaN, py = NaN;
          while (left > 0) {
            const cnt = Math.min(per, left);
            const fade = clamp((p.life - now + buf[((i + (cnt >> 1)) % cap) * 4 + 2]) / (p.life * 0.3), 0, 1);
            ctx.globalAlpha = A * fade;
            ctx.beginPath();
            if (px === px) ctx.moveTo(px, py);
            let c = buf[i * 4 + 3];
            for (let j = 0; j < cnt; j++, i = (i + 1) % cap) {
              const x = buf[i * 4], y = buf[i * 4 + 1];
              if (x !== x) {
                if (fade > 0) { ctx.strokeStyle = s.colors[c]; ctx.stroke(); }
                ctx.beginPath();
                px = NaN;
                continue;
              }
              c = buf[i * 4 + 3];
              if (px === px) ctx.lineTo(x, y); else ctx.moveTo(x, y);
              px = x; py = y;
            }
            left -= cnt;
            if (fade > 0) { ctx.strokeStyle = s.colors[c]; ctx.stroke(); }
          }
        }
      },
    };

    /** The ring, the rolling wheel with its turning teeth, and the pen. @param {Pen} p @param {number} A @returns {void} */
    function mechanism(p, A) {
      const { ctx } = s;
      const lw = ctx.lineWidth;
      ctx.strokeStyle = s.ink;
      ctx.globalAlpha = A * 0.3;
      ctx.lineWidth = lw * 2;
      const sc = p.epi ? 1 / (1 + p.rho + p.d) : 1;
      ctx.beginPath();
      ctx.arc(0, 0, sc, 0, TAU);
      ctx.stroke();
      const cr = (p.epi ? 1 + p.rho : 1 - p.rho) * sc, a = p.th + p.rot;
      const wx = Math.cos(a) * cr, wy = Math.sin(a) * cr, wr = p.rho * sc;
      // The wheel turns against its travel inside the ring, with it outside.
      const spin = p.rot + (p.epi ? (1 + p.rho) / p.rho : -(1 - p.rho) / p.rho) * p.th;
      ctx.fillStyle = ctx.strokeStyle = s.colors[p.c];
      ctx.globalAlpha = A * 0.16;
      ctx.beginPath();
      ctx.arc(wx, wy, wr, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = A * 0.55;
      ctx.setLineDash([lw * 2, lw * 3]);
      ctx.lineDashOffset = -spin * wr;
      ctx.lineWidth = lw * 3;
      ctx.beginPath();
      ctx.arc(wx, wy, wr, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      const hx = p.buf[p.head * 4], hy = p.buf[p.head * 4 + 1];
      if (hx !== hx) { ctx.lineWidth = lw; return; }
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.globalAlpha = A;
      ctx.beginPath();
      ctx.arc(hx, hy, lw * 3, 0, TAU);
      ctx.fill();
    }
  });
}
