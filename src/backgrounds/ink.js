// Ink bloom: drops of watercolour land and bloom outward, quickly then slower, irregular, with
// a darker rim where the pigment gathers, then fade over seconds. Each drop is painted once at
// half size and scaled up, which softens every edge. The seed picks the variant: single drops
// scattered over the host, a few wandering brushes each leaving a trail of overlapping blooms
// that shifts colour, or splatters, a big drop ringed by small and stretched satellite drops.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, R:number, age:number, life:number, tau:number, a:number,
 *   spr:HTMLCanvasElement, half:number}} Drop
 * A drop: where it landed, the radius it blooms to (tau sets how fast), its age and life in
 * seconds, its strength a, and its sprite, painted at full bloom, half its side in CSS px. */

const N = 36;          // points round a drop's rim
const SCALE = 0.5;     // the layer's size against the host

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Drop[]} */
    const drops = [];
    /** @type {HTMLCanvasElement[]} sprites of faded drops, to reuse */
    const spare = [];
    let unit = 300, clock = 0, due = 0, W0 = 0, H0 = 0;
    const last = new Float32Array(6);   // where each brush last let a drop fall
    const ph = Array.from({ length: 12 }, () => rng.random() * TAU);
    const A = s.dark ? 0.3 : 0.36;
    const xs = new Float32Array(N), ys = new Float32Array(N);

    /** An edge: a few low harmonics with random phases. @param {number} amp @returns {Float32Array} */
    function edge(amp) {
      const e = new Float32Array(N);
      for (let h = 2; h <= 7; h++) {
        const a = amp * (0.5 + rng.random()) / h, p = rng.random() * TAU;
        for (let i = 0; i < N; i++) e[i] += a * Math.sin(h * i / N * TAU + p);
      }
      return e;
    }
    /** @param {number} x @param {number} y @param {number} R @param {number} c @param {number} life
     * @param {number} [sx] stretch along rot @param {number} [rot] @param {number} [a] strength
     * @returns {void} */
    function drop(x, y, R, c, life, sx = 1, rot = 0, a = 1) {
      const spr = spare.pop() ?? document.createElement('canvas');
      // A spare sprite is kept as it is when its size is near enough: resizing reallocates it.
      const need = Math.max(4, Math.ceil((R * 1.3 * Math.max(1, sx) + 2) * 2 * SCALE));
      if (spr.width < need || spr.width > need * 1.5) spr.width = spr.height = need;
      const half = spr.width / 2 / SCALE;
      paint(spr, R, sx, rot, s.colors[c]);
      drops.push({ x, y, R, age: 0, life, tau: 0.6 + rng.random() * 0.8, a, spr, half });
    }

    /** Paints a drop at full bloom: a wet halo, the body, the darker rim where pigment gathers,
     * and a denser core. @param {HTMLCanvasElement} spr @param {number} R @param {number} sx
     * @param {number} rot @param {string} color @returns {void} */
    function paint(spr, R, sx, rot, color) {
      const g = spr.getContext('2d');
      if (!g) return;
      const m = spr.width / 2;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, spr.width, spr.height);
      g.setTransform(SCALE, 0, 0, SCALE, m, m);
      g.fillStyle = g.strokeStyle = color; g.lineJoin = 'round';
      const base = edge(0.12), fringe = edge(0.2);
      for (let i = 0; i < N; i++) base[i] += 1 + fringe[i];
      const core = edge(0.15);
      for (let i = 0; i < N; i++) core[i] += 1;
      rim(g, base, R * 1.07, sx, rot); g.globalAlpha = 0.3; g.fill();
      rim(g, base, R, sx, rot); g.globalAlpha = 0.5; g.fill();
      g.globalAlpha = 0.55; g.lineWidth = Math.max(1, R * 0.06); g.stroke();
      rim(g, core, R * 0.5, sx, rot); g.globalAlpha = 0.3; g.fill();
    }

    /** Lands the next drop, brush stroke or splatter, and says when the one after is due.
     * @returns {number} seconds to the next */
    function spawn() {
      const m = unit;
      if (layout === 1) {
        // Each brush wanders its own slow figure over the host, its colour turning every few
        // seconds, and lets a drop fall each time it has moved on a little, so a slow brush
        // does not pile them up.
        const nb = s.W * s.H > 500000 ? 3 : 2, q = clock * 0.17;
        for (let b = 0; b < nb; b++) {
          const o = b * 4;
          const x = s.W * (0.5 + 0.43 * Math.sin(q * (0.7 + ph[o] / TAU * 0.6) + ph[o + 1]));
          const y = s.H * (0.5 + 0.42 * Math.sin(q * (0.8 + ph[o + 2] / TAU * 0.6) + ph[o + 3]));
          if (Math.hypot(x - last[b * 2], y - last[b * 2 + 1]) < m * 0.055) continue;
          last[b * 2] = x; last[b * 2 + 1] = y;
          const c = (Math.floor(clock / 7) + b * 2) % s.colors.length;
          drop(x + (rng.random() - 0.5) * m * 0.05, y + (rng.random() - 0.5) * m * 0.05,
            m * (0.05 + rng.random() * 0.04), c, 9 + rng.random() * 3, 1, 0, 0.85);
        }
        return 0.1;
      }
      const x = s.W * (0.04 + rng.random() * 0.92), y = s.H * (0.04 + rng.random() * 0.92);
      const c = rng.int(s.colors.length);
      if (layout === 2) {
        const R = m * (0.09 + rng.random() * 0.06);
        drop(x, y, R, c, 13 + rng.random() * 4);
        const k = 5 + rng.int(6);
        for (let i = 0; i < k; i++) {
          const a = rng.random() * TAU, d = R * (1.25 + rng.random() * 1.5), r = R * (0.08 + rng.random() * 0.18);
          // Far satellites fly out stretched along their way.
          drop(x + Math.cos(a) * d, y + Math.sin(a) * d, r, c, 11 + rng.random() * 4, 1 + (d / R - 1.2) * 0.9, a);
        }
        return 2.2 + rng.random() * 1.6;
      }
      drop(x, y, m * (0.06 + rng.random() * 0.09), c, 12 + rng.random() * 6);
      const want = clamp(Math.round(s.W * s.H / 60000), 9, 18);
      return 15 / want * (0.6 + rng.random() * 0.8);
    }

    /** @param {number} dt @returns {void} */
    function advance(dt) {
      clock += dt;
      for (const d of drops) d.age += dt;
      for (let i = drops.length - 1; i >= 0; i--) {
        if (drops[i].age > drops[i].life) spare.push(drops.splice(i, 1)[0].spr);
      }
      due -= dt;
      while (due <= 0) due += spawn();
    }

    /** Traces a rim round the origin: radius R times each of `e`, stretched sx along rot.
     * @param {CanvasRenderingContext2D} g @param {Float32Array} e @param {number} R @param {number} sx
     * @param {number} rot @returns {void} */
    function rim(g, e, R, sx, rot) {
      const ca = Math.cos(rot), sa = Math.sin(rot);
      for (let i = 0; i < N; i++) {
        const a = i / N * TAU, u = Math.cos(a) * R * e[i] * sx, v = Math.sin(a) * R * e[i];
        xs[i] = u * ca - v * sa; ys[i] = u * sa + v * ca;
      }
      g.beginPath();
      // Through the midpoints, so the rim is smooth curves rather than a polygon.
      g.moveTo((xs[N - 1] + xs[0]) / 2, (ys[N - 1] + ys[0]) / 2);
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        g.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[j]) / 2, (ys[i] + ys[j]) / 2);
      }
      g.closePath();
    }

    return {
      lay() {
        unit = Math.min(s.W, s.H);
        if (W0 && (W0 !== s.W || H0 !== s.H)) {
          for (const d of drops) { d.x *= s.W / W0; d.y *= s.H / H0; }
        }
        W0 = s.W; H0 = s.H;
        // First time: run the paint a while so the page starts with blooms at every stage.
        if (!clock) for (let i = 0; i < 60; i++) advance(0.25);
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'low';
        // Pigment over pigment: glowing on dark, deepening on light; a brush trail lays so many
        // drops over each other that it simply covers.
        ctx.globalCompositeOperation = layout === 1 ? 'source-over' : s.dark ? 'lighter' : 'multiply';
        for (const d of drops) {
          // Out fast, then slower and slower, as a drop soaks into wet paper.
          const k = 1 - Math.exp(-d.age / d.tau);
          const fadeAt = d.life * 0.4;
          const u = clamp((d.age - fadeAt) / (d.life - fadeAt), 0, 1);
          const a = A * d.a * clamp(d.age / 0.25, 0, 1) * (1 - u * u * (3 - 2 * u));
          if (a <= 0.003 || k < 0.01) continue;
          const h = d.half * k;
          ctx.globalAlpha = a;
          ctx.drawImage(d.spr, d.x - h, d.y - h, h * 2, h * 2);
        }
      },
    };
  });
}
