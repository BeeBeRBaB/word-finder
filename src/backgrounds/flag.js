// Flag: striped cloth waves in the wind, the folds running from the pole to the free end and
// lit by their slope, the breeze swelling and easing in slow gusts. The seed picks the variant:
// one large flag of horizontal stripes on a pole, a row of smaller flags on staggered poles each
// with its own pattern and beat, or a close-up where the cloth fills the host and broad
// diagonal stripes roll through its folds.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {[number, number][]} Poly a polygon in cloth space: u along the fly, v down the hoist, both 0..1 */
/** @typedef {{x:number, y:number, L:number, h:number, ph:number, wav:number, amp:number, pole:boolean, bands:{poly:Poly, c:number}[]}} Cloth
 * A flag: its hoist's top corner at x, y, fly length L, hoist height h, its own phase, waves along
 * it, fold depth (a share of h), whether a pole is drawn, and its coloured patches. */

const COLS = 40;     // samples along the fly: edges and shading stops

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Cloth[]} */
    let cloths = [];
    let phase = rng.random() * TAU, wind = 0.8;
    const c0 = rng.int(nc);
    const fill = layout === 2 ? (s.dark ? 0.2 : 0.24) : (s.dark ? 0.3 : 0.34);
    // How far a fully lit slope mixes toward white, and a fully shaded one toward black.
    const lit = s.dark ? 0.35 : 0.45, dim = s.dark ? 0.55 : 0.3;
    const rgb = s.colors.map(rgbOf);

    /** n stripes across (dir 0, along the fly) or down (dir 1), or diagonal (dir 2).
     * @param {number} n @param {number} dir @param {number} c first colour @returns {{poly:Poly, c:number}[]} */
    function stripes(n, dir, c) {
      /** @type {{poly:Poly, c:number}[]} */
      const out = [];
      for (let k = 0; k < n; k++) {
        const a = k / n, b = (k + 1) / n;
        /** @type {Poly} */
        let poly;
        if (dir === 0) poly = [[0, a], [1, a], [1, b], [0, b]];
        else if (dir === 1) poly = [[a, 0], [b, 0], [b, 1], [a, 1]];
        else {
          // Bands of u + v = const, over u + v in 0..2, clipped to the square.
          poly = clipDiag(a * 2, b * 2);
        }
        if (poly.length > 2) out.push({ poly, c: (c + k) % nc });
      }
      return out;
    }

    /** A pattern for a row flag: stripes either way, a canton over stripes, or a cross.
     * @param {number} kind @param {number} c @returns {{poly:Poly, c:number}[]} */
    function pattern(kind, c) {
      if (kind === 0) return stripes(3, 1, c);
      if (kind === 1) return stripes(5, 0, c);
      if (kind === 2) return [...stripes(4, 0, c), { poly: [[0, 0], [0.42, 0], [0.42, 0.5], [0, 0.5]], c: (c + 2) % nc }];
      // An off-centre cross on a field.
      return [{ poly: [[0, 0], [1, 0], [1, 1], [0, 1]], c },
        { poly: [[0.3, 0], [0.42, 0], [0.42, 1], [0.3, 1]], c: (c + 1) % nc },
        { poly: [[0, 0.42], [1, 0.42], [1, 0.58], [0, 0.58]], c: (c + 1) % nc }];
    }

    /** Where cloth point u, v sits now, and its slope shading (-1 shadow .. 1 lit).
     * @param {Cloth} f @param {number} u @param {number} v @returns {[number, number, number]} */
    function at(f, u, v) {
      const ph = TAU * f.wav * u - phase + f.ph + v * 1.1;
      // Pinned at the hoist, folds deepening toward the free end.
      const a = f.amp * f.h * wind * Math.min(1, u * 2.2) * (0.55 + 0.45 * u);
      const x = f.x + u * f.L * (0.94 + 0.06 * (1 - wind)) - a * 0.45 * (1 - Math.cos(ph));
      const y = f.y + v * f.h + a * Math.sin(ph) + (1 - wind) * u * u * f.h * 0.35;
      return [x, y, -Math.cos(ph) * Math.min(1, u * 5)];
    }

    /** Adds patch `poly` of cloth f to path p, its edges bent by the wave. @param {Path2D} p @param {Cloth} f @param {Poly} poly @returns {void} */
    function trace(p, f, poly) {
      for (let i = 0; i < poly.length; i++) {
        const [u0, v0] = poly[i], [u1, v1] = poly[(i + 1) % poly.length];
        const n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, (v1 - v0) * 0.5) * COLS));
        for (let j = 0; j < n; j++) {
          const q = j / n, [x, y] = at(f, u0 + (u1 - u0) * q, v0 + (v1 - v0) * q);
          if (i || j) p.lineTo(x, y); else p.moveTo(x, y);
        }
      }
      p.closePath();
    }

    return {
      lay() {
        const { W, H } = s, m = Math.min(W, H);
        cloths = [];
        if (layout === 0) {
          const px = W * (W > H ? 0.1 : 0.07), h = clamp(Math.min(H * 0.5, W * (W > H ? 0.4 : 0.6)), 140, 520);
          cloths.push({ x: px, y: H * 0.13, L: Math.min(W - px - W * 0.05, h * 1.75), h, ph: 0, wav: 1.35, amp: 0.13,
            pole: true, bands: stripes(nc > 3 ? 5 : 4, 0, c0) });
        } else if (layout === 1) {
          const n = clamp(Math.round(W / 430), 2, 4), gap = W / n;
          const kinds = rng.shuffle([0, 1, 2, 3]);
          for (let k = 0; k < n; k++) {
            const h = clamp(Math.min(gap * 0.5, H * 0.24), 70, 260);
            const y = H * (0.08 + 0.42 * ((k * 0.618 + 0.2) % 1));
            cloths.push({ x: gap * (k + 0.12), y, L: Math.min(gap * 0.8, h * 1.6), h, ph: k * 1.9 + rng.random(),
              wav: 1.1 + 0.25 * (k % 2), amp: 0.14, pole: true, bands: pattern(kinds[k % 4], (c0 + k) % nc) });
          }
        } else {
          // Bigger than the host, so its edges stay off-screen as it waves.
          cloths.push({ x: -W * 0.05, y: -H * 0.18, L: W * 1.25, h: H * 1.36, ph: 0, wav: 2, amp: 0.07 * Math.max(1, W / H * 0.6),
            pole: false, bands: stripes(clamp(Math.round(m / 110), 5, 9), 2, c0) });
        }
      },
      step(dt) {
        // Gusts: the wind swells and eases over tens of seconds; the folds run faster in it.
        wind = 0.78 + 0.16 * Math.sin(s.t * 0.11) * Math.sin(s.t * 0.047 + 1.3) + 0.06 * Math.sin(s.t * 0.23);
        phase += dt * (1.6 + 1.2 * wind) * (layout === 2 ? 0.55 : 1);
      },
      draw() {
        const { ctx } = s, m = Math.min(s.W, s.H);
        for (const f of cloths) {
          if (f.pole) {
            ctx.globalAlpha = s.dark ? 0.42 : 0.5;
            ctx.fillStyle = s.ink;
            const w = clamp(m * 0.008, 2.5, 6);
            ctx.fillRect(f.x - w, f.y - w * 2, w, s.H - f.y + w * 2);
            ctx.beginPath();
            ctx.arc(f.x - w / 2, f.y - w * 2.4, w * 1.1, 0, TAU);
            ctx.fill();
          }
          // Folds: each patch is filled with a gradient across the folds (along lines of equal
          // phase), lit toward white on rising slopes and shaded toward black on falling ones, the
          // stops sampled along the middle of the cloth. One fill per patch keeps big hosts cheap.
          let gx = TAU * f.wav / f.L, gy = 1.1 / f.h;
          const gl = Math.hypot(gx, gy); gx /= gl; gy /= gl;
          const [x0, y0] = at(f, 0, 0.5), [x1, y1] = at(f, 1, 0.5);
          const D = (x1 - x0) * gx + (y1 - y0) * gy;
          /** @type {[number, number][]} */
          const stops = [];
          for (let i = 0, last = 0; i <= COLS; i++) {
            const [x, y, k] = at(f, i / COLS, 0.5);
            last = clamp(((x - x0) * gx + (y - y0) * gy) / D, last, 1);
            stops.push([last, k]);
          }
          ctx.globalAlpha = 1;
          for (const b of f.bands) {
            const p = new Path2D();
            trace(p, f, b.poly);
            const g = ctx.createLinearGradient(x0, y0, x0 + gx * D, y0 + gy * D), [r, gr, bl] = rgb[b.c];
            for (const [at, k] of stops) {
              const w = k > 0 ? 255 : 0, u = Math.abs(k) * (k > 0 ? lit : dim);
              g.addColorStop(at, `rgba(${Math.round(r + (w - r) * u)},${Math.round(gr + (w - gr) * u)},${Math.round(bl + (w - bl) * u)},${(fill * (1 + 0.25 * k)).toFixed(3)})`);
            }
            ctx.fillStyle = g;
            ctx.fill(p);
          }
        }
      },
    };
  });
}

/** The part of the unit square where a <= u + v <= b, as a polygon. @param {number} a @param {number} b @returns {Poly} */
function clipDiag(a, b) {
  /** @type {Poly} */
  let poly = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const [sgn, lim] of [[1, a], [-1, -b]]) {
    /** @type {Poly} */
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const dp = sgn * (p[0] + p[1]) - lim, dq = sgn * (q[0] + q[1]) - lim;
      if (dp >= 0) out.push(p);
      if (dp * dq < 0) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    poly = out;
  }
  return poly;
}

/** Any CSS colour as [r, g, b], via a canvas's own parser. @param {string} color @returns {number[]} */
function rgbOf(color) {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return [128, 128, 128];
  g.fillStyle = '#888';
  g.fillStyle = color;
  const v = String(g.fillStyle);
  if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = v.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
