// Waves: layered ocean swells rolling sideways, crests sharpened (Gerstner) and laced with foam,
// in the look's colours. The seed picks the variant: open sea, bands of swell stacked from a high
// horizon to the shore, larger and slower near the viewer; line sea, the whole host ruled with
// stroked wave lines whose crests run in diagonal sets; or moonlit, a lower sea under a moon whose
// glint shimmers on the crests below it.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{base:number, A:number, k:number, w:number, ph:number, c:number, depth:number, u:number, grad:CanvasGradient|string}} Swell */



/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const STEP = layout === 1 ? 9 : 7;   // CSS px between samples along a wave
    const rgb = s.colors.map(rgbOf);
    const dir = rng.random() < 0.5 ? 1 : -1;
    const seedPh = Array.from({ length: 64 }, () => rng.random() * TAU);
    /** @type {Swell[]} */
    let swells = [];
    let horizon = 0, moonX = 0, moonY = 0, moonR = 0;
    const moon = glow(s.colors[0]);
    // Sample buffers, reused every frame.
    let xs = new Float32Array(0), ys = new Float32Array(0), cr = new Float32Array(0);

    let px = 0, py = 0, pc = 0;
    /** Sets px, py to the surface point that rests at x0, and pc to its crest-ness (1 at a crest).
     * @param {Swell} v @param {number} x0 @param {number} t */
    function at(v, x0, t) {
      const Q = 0.75;   // steepness: 1 would make the crests cusps
      const th = v.k * x0 * dir - v.w * t + v.ph;
      pc = Math.cos(th);
      px = x0 - dir * (Q / v.k) * Math.sin(th);
      py = v.base - v.A * pc
        - v.A * 0.32 * Math.sin(v.k * 1.63 * x0 * dir - v.w * 1.28 * t + v.ph * 2.1)
        - v.A * 0.45 * Math.sin(v.k * 0.57 * x0 * dir - v.w * 0.75 * t + v.ph * 0.7);
    }

    /** Fills xs, ys, cr with the swell's surface, from beyond the left edge to beyond the right
     * (the crests lean, so a point can sit up to 0.75/k from where it rests).
     * @param {Swell} v @param {number} t @returns {number} the count of samples */
    function surface(v, t) {
      const o = Math.ceil(0.75 / v.k / STEP) + 1, n = Math.min(xs.length, Math.ceil(s.W / STEP) + 2 * o + 1);
      for (let i = 0; i < n; i++) { at(v, (i - o) * STEP, t); xs[i] = px; ys[i] = py; cr[i] = pc; }
      return n;
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        const n = layout === 1 ? clamp(Math.round(s.H / 34), 12, 32) : clamp(Math.round(s.H / 75), 7, 13);
        horizon = layout === 2 ? s.H * 0.36 : layout === 0 ? s.H * 0.08 : 0;
        moonR = clamp(m * 0.06, 22, 60);
        moonX = s.W * 0.68; moonY = horizon * 0.48;
        swells = [];
        for (let i = 0; i < n; i++) {
          const u = n > 1 ? i / (n - 1) : 1;   // 0 far .. 1 near
          let base, A, L;
          if (layout === 1) {
            base = (i + 0.7) * s.H / n;
            A = clamp(s.H / n * 0.32, 5, 16);
            L = m * (0.42 + 0.12 * Math.sin(i * 1.7));
          } else {
            base = horizon + (s.H * 1.02 - horizon) * Math.pow((i + 1) / n, 1.3);
            A = m * (0.006 + 0.03 * Math.pow(u, 1.4));
            L = m * (0.18 + 0.5 * u);
          }
          const k = TAU / L;
          // A near swell is longer and slower to cycle, so it travels faster, as deep water does.
          const w = TAU / (layout === 1 ? 8 : 6 + 5 * u);
          const ph = layout === 1 ? i * 0.9 + seedPh[i % 64] * 0.3 : seedPh[i % 64];
          swells.push({ base, A, k, w, ph, c: i % rgb.length, u, depth: 0, grad: '' });
        }
        // Each band fades out a little below the next one, so the alpha never piles up.
        for (let i = 0; i < swells.length; i++) {
          const v = swells[i];
          const next = i + 1 < swells.length ? swells[i + 1].base : s.H + 40;
          v.depth = Math.max(20, (next - v.base) * 1.6 + v.A);
          if (layout === 1) { v.grad = ''; continue; }
          const g = s.ctx.createLinearGradient(0, v.base - v.A * 1.7, 0, v.base + v.depth);
          const a = (s.dark ? 0.2 : 0.24) + v.u * 0.12;
          g.addColorStop(0, rgba(rgb[v.c], a));
          g.addColorStop(0.35, rgba(rgb[v.c], a * 0.7));
          g.addColorStop(1, rgba(rgb[v.c], 0));
          v.grad = g;
        }
        const n2 = Math.ceil(s.W / STEP) + 2 * Math.ceil(0.75 / Math.min(...swells.map((v) => v.k)) / STEP) + 6;
        if (xs.length !== n2) { xs = new Float32Array(n2); ys = new Float32Array(n2); cr = new Float32Array(n2); }
      },
      step() {},
      draw() {
        const { ctx } = s, t = s.t;
        if (layout === 2) {
          // The moon and a faint haze over the horizon.
          if (s.dark) ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = s.dark ? 0.35 : 0.45;
          ctx.drawImage(moon, moonX - moonR * 3, moonY - moonR * 3, moonR * 6, moonR * 6);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = s.dark ? 0.38 : 0.42;
          ctx.fillStyle = s.colors[0];
          ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, TAU); ctx.fill();
          ctx.globalAlpha = 0.18;
          ctx.fillRect(0, horizon - 1, s.W, 1.5);
        }
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        for (const v of swells) {
          const n = surface(v, t);
          if (v.grad) {
            ctx.beginPath();
            ctx.moveTo(xs[0], ys[0]);
            for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ys[i]);
            ctx.lineTo(xs[n - 1], v.base + v.depth); ctx.lineTo(xs[0], v.base + v.depth); ctx.closePath();
            ctx.globalAlpha = 1; ctx.fillStyle = v.grad; ctx.fill();
          }
          ctx.beginPath();
          ctx.moveTo(xs[0], ys[0]);
          for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ys[i]);
          // The surface line, then foam along the stretch of each crest.
          ctx.globalAlpha = layout === 1 ? (s.dark ? 0.42 : 0.5) : (s.dark ? 0.32 : 0.4) + v.u * 0.15;
          ctx.strokeStyle = s.colors[v.c];
          ctx.lineWidth = layout === 1 ? 1.6 : 1 + v.u * 1.6;
          ctx.stroke();
          ctx.beginPath();
          for (let i = 1; i < n; i++) {
            if (cr[i] > 0.55) {
              if (cr[i - 1] <= 0.55) ctx.moveTo(xs[i], ys[i] - 0.5);
              else ctx.lineTo(xs[i], ys[i] - 0.5);
            }
          }
          ctx.globalAlpha = s.dark ? 0.5 : 0.55;
          ctx.strokeStyle = s.dark ? foamDark(rgb[v.c]) : s.colors[v.c];
          ctx.lineWidth = (layout === 1 ? 2.6 : 1.6 + v.u * 2.4);
          ctx.stroke();
          // Flecks of foam left on the back of each crest, fixed to the wave so they ride with it.
          ctx.fillStyle = ctx.strokeStyle;
          ctx.globalAlpha = s.dark ? 0.4 : 0.45;
          ctx.beginPath();
          const r = 0.8 + v.u * 1.3;
          const th0 = -v.w * t + v.ph, span = v.k * (s.W + 2 * STEP);
          const lo = Math.min(th0 - v.k * STEP, th0 + dir * span), hi = Math.max(th0 - v.k * STEP, th0 + dir * span);
          for (let m = Math.floor(lo / TAU); m <= Math.ceil(hi / TAU) + 1; m++) {
            for (let j = 0; j < 5; j++) {
              const h = hash(m * 7 + j + v.c * 131);
              at(v, (TAU * m - 0.25 - 1.1 * h - th0) / (v.k * dir), t);
              const yy = py + (v.A * 0.5 + 2) * hash(m * 13 + j * 5 + 3);
              ctx.moveTo(px + r, yy); ctx.arc(px, yy, r * (0.6 + h * 0.8), 0, TAU);
            }
          }
          ctx.fill();
          if (layout === 2) glint(v, n);
        }
        ctx.globalAlpha = 1;
      },
    };

    /** The moon's path on the water: dashes under it on this swell's surface that shimmer slowly.
     * @param {Swell} v @param {number} n */
    function glint(v, n) {
      const { ctx } = s;
      const half = moonR * (0.8 + v.u * 2.2);
      if (s.dark) ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = s.colors[0];
      ctx.lineWidth = 1.5 + v.u * 1.5;
      for (let i = 0; i < n; i += 2) {
        const dx = xs[i] - moonX;
        if (Math.abs(dx) > half) continue;
        // About a third of a second per cycle at the fastest: a slow glitter, never a flash.
        const sh = 0.5 + 0.5 * Math.sin(s.t * (0.6 + (i % 5) * 0.12) + i * 1.3 + v.ph);
        ctx.globalAlpha = (0.12 + 0.4 * sh) * (1 - Math.abs(dx) / half);
        const len = 3 + v.u * 9;
        ctx.beginPath(); ctx.moveTo(xs[i] - len, ys[i] + 1); ctx.lineTo(xs[i] + len, ys[i] + 1); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  });
}

/** A stable pseudo-random 0..1 from an integer. @param {number} i @returns {number} */
function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Foam on a dark page: the swell's colour most of the way to white. @param {number[]} c @returns {string} */
function foamDark(c) {
  return `rgb(${c.map((v) => Math.round(v + (255 - v) * 0.65)).join(',')})`;
}

/** @param {number[]} c @param {number} a @returns {string} */
function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`; }

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

/** A soft round glow, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function glow(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,.8)');
  grad.addColorStop(0.35, 'rgba(0,0,0,.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
