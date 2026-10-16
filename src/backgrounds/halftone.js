// Halftone: a printer's grid of dots whose sizes follow a moving wave, in the look's colours.
// The seed picks the variant: swells, broad diagonal waves rolling across a square screen, colour
// bands drifting with them; screens, two or three colour screens at their own angles, each
// toned by soft patches that wander, overprinting where they meet; or ripples, rings spreading
// out over a hex grid from slowly wandering drops, each ring keeping its colour as it grows.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, ph:number, fx:number, fy:number}} Source */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    const ph = Array.from({ length: 12 }, () => rng.random() * TAU);
    // Swells: the direction the waves roll toward.
    const dirA = rng.random() * TAU;
    // Screens: one angle per colour screen, the classic 15/45/75 set, turned by the seed.
    const turn = rng.random() * 0.5;
    const screens = Array.from({ length: Math.min(3, Math.max(2, C)) }, (_, i) => ({
      a: turn + [0.26, 0.79, 1.31][i], c: i % C,
    }));
    /** @type {Source[]} */
    const sources = Array.from({ length: 3 }, () => ({ x: rng.random(), y: rng.random(),
      ph: rng.random() * TAU, fx: 0.011 + rng.random() * 0.012, fy: 0.009 + rng.random() * 0.012 }));
    let sp = 20, m = 1;
    /** One dot list per colour, filled during draw: x, y, r triples. @type {number[][]} */
    const bins = s.colors.map(() => []);

    /** @param {number} c @param {number} x @param {number} y @param {number} r */
    function dot(c, x, y, r) {
      if (r < 0.5) return;
      const b = bins[c];
      b.push(x, y, r);
    }

    /** Swells: broad waves rolling across a square grid. @param {number} t */
    function swells(t) {
      const ux = Math.cos(dirA), uy = Math.sin(dirA);
      const k = TAU / (m * 0.9), k2 = TAU / (m * 0.55);
      const cols = Math.ceil(s.W / sp) + 1, rows = Math.ceil(s.H / sp) + 1;
      const ox = (s.W - (cols - 1) * sp) / 2, oy = (s.H - (rows - 1) * sp) / 2;
      for (let j = 0; j < rows; j++) {
        const y = oy + j * sp;
        for (let i = 0; i < cols; i++) {
          const x = ox + i * sp;
          const along = x * ux + y * uy, across = -x * uy + y * ux;
          const v = 0.5 + 0.32 * Math.sin(along * k - t * 0.55 + 0.9 * Math.sin(across * k2 * 0.6 + t * 0.12 + ph[0]))
            + 0.18 * Math.sin(across * k2 + along * k * 0.4 - t * 0.3 + ph[1]);
          const band = Math.floor(((along + across * 0.35) / (m * 0.7) + t * 0.025 + ph[2]) * 1) % C;
          dot((band + C) % C, x, y, sp * 0.5 * clamp(v, 0.06, 1) * 0.95);
        }
      }
    }

    /** Screens: rotated colour screens toned by wandering soft patches. @param {number} t */
    function screenDots(t) {
      const g = sp * 1.15;
      const diag = Math.hypot(s.W, s.H) / 2 + g, cx = s.W / 2, cy = s.H / 2;
      const n = Math.ceil(diag / g);
      screens.forEach((sc, q) => {
        const ca = Math.cos(sc.a), sa = Math.sin(sc.a);
        // Two patch centres per screen, drifting on slow loops.
        const p1x = s.W * (0.5 + 0.38 * Math.sin(t * 0.045 + ph[q])), p1y = s.H * (0.5 + 0.36 * Math.cos(t * 0.038 + ph[q + 3]));
        const p2x = s.W * (0.5 + 0.4 * Math.cos(t * 0.031 + ph[q + 6])), p2y = s.H * (0.5 + 0.38 * Math.sin(t * 0.042 + ph[q + 9]));
        const R1 = 1 / (m * m * 0.26), R2 = 1 / (m * m * 0.16);
        for (let j = -n; j <= n; j++) {
          for (let i = -n; i <= n; i++) {
            const x = cx + (i * ca - j * sa) * g, y = cy + (i * sa + j * ca) * g;
            if (x < -g || y < -g || x > s.W + g || y > s.H + g) continue;
            const d1 = (x - p1x) ** 2 + (y - p1y) ** 2, d2 = (x - p2x) ** 2 + (y - p2y) ** 2;
            const v = 0.16 + 0.75 * Math.exp(-d1 * R1) + 0.55 * Math.exp(-d2 * R2);
            dot(sc.c, x, y, g * 0.46 * clamp(v, 0, 1));
          }
        }
      });
    }

    /** Ripples: rings spreading from wandering drops over a hex grid. @param {number} t */
    function ripples(t) {
      const rowH = sp * 0.866, k = TAU / (sp * 4.2), w = 0.7;
      const pts = sources.map((p) => [s.W * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t * p.fx + p.ph + p.x * TAU))),
        s.H * (0.15 + 0.7 * (0.5 + 0.5 * Math.cos(t * p.fy + p.ph * 1.3 + p.y * TAU)))]);
      const rows = Math.ceil(s.H / rowH) + 1, cols = Math.ceil(s.W / sp) + 1;
      for (let j = 0; j < rows; j++) {
        const y = j * rowH, off = (j & 1) * sp / 2;
        for (let i = 0; i < cols; i++) {
          const x = i * sp + off - sp / 2;
          // The nearest drop's rings win, so each drop keeps a clean set of circles.
          let best = 1e9, bi = 0;
          for (let q = 0; q < pts.length; q++) {
            const d = Math.hypot(x - pts[q][0], y - pts[q][1]);
            if (d < best) { best = d; bi = q; }
          }
          const phase = best * k - t * w + ph[bi];
          const v = 0.5 + 0.5 * Math.cos(phase);
          const ring = Math.floor(phase / TAU);
          const fade = 0.55 + 0.45 * Math.exp(-best / (m * 0.6));
          dot((((ring + bi) % C) + C) % C, x, y, sp * 0.5 * clamp(0.08 + v * 0.92 * fade, 0, 1));
        }
      }
    }

    return {
      lay() {
        m = Math.min(s.W, s.H);
        sp = clamp(m / 28, 14, 34);
      },
      step() {},
      draw() {
        const { ctx } = s;
        for (const b of bins) b.length = 0;
        if (layout === 1) screenDots(s.t); else if (layout === 2) ripples(s.t); else swells(s.t);
        if (layout === 1) ctx.globalCompositeOperation = s.dark ? 'lighter' : 'multiply';
        ctx.globalAlpha = layout === 1 ? (s.dark ? 0.36 : 0.42) : (s.dark ? 0.42 : 0.45);
        bins.forEach((b, c) => {
          if (!b.length) return;
          ctx.fillStyle = s.colors[c];
          ctx.beginPath();
          for (let i = 0; i < b.length; i += 3) {
            ctx.moveTo(b[i] + b[i + 2], b[i + 1]);
            ctx.arc(b[i], b[i + 1], b[i + 2], 0, TAU);
          }
          ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  });
}
