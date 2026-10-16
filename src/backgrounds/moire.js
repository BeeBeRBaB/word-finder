// Moire: a fine grating covers the page, and round lenses of a second, slightly different grating
// drift slowly over it, so broad soft bands show inside each lens where the two fall in and out of
// step, swinging and bending as the lenses turn and slide. The seed picks the variant: line lenses,
// each turning back and forth a few degrees over straight lines, giving straight bands that swing;
// ring lenses over rings round a point off to one side, giving fans of bands between the centres;
// or ring lenses over straight lines, giving nested curves. The page grating is drawn once.

import { stage, TAU, clamp } from './stage.js';

/**
 * A lens: its centre (CSS px), its drift, its grating's turn from the page's, phase and its own
 * small canvas.
 * @typedef {{x:number, y:number, vx:number, vy:number, th:number, ph:number, f:number, cv:HTMLCanvasElement}} Lens
 */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const col = (/** @type {number} */ k) => s.colors[k % s.colors.length];
    const base = rng.random() * TAU;
    const ox = 0.25 + rng.random() * 0.5, oy = 0.3 + rng.random() * 0.4;
    /** The page's grating, at device pixels. */
    const page = document.createElement('canvas');
    /** The lens's soft round edge, as alpha. */
    const mask = document.createElement('canvas');
    /** @type {Lens[]} */
    let lenses = [];
    let d = 6, r = 120, sz = 0, turn = 0;

    /**
     * Adds parallel lines `gap` apart through (x, y) at angle a, out to `R` each way.
     * @param {CanvasRenderingContext2D} g @param {number} x @param {number} y @param {number} a
     * @param {number} gap @param {number} R
     */
    function lines(g, x, y, a, gap, R) {
      const c = Math.cos(a), sn = Math.sin(a);
      const n = Math.ceil(R / gap);
      for (let k = -n; k <= n; k++) {
        const u = k * gap;
        g.moveTo(x + c * u - sn * R, y + sn * u + c * R);
        g.lineTo(x + c * u + sn * R, y + sn * u - c * R);
      }
    }

    /** Adds rings `gap` apart round (x, y) out to R. @param {CanvasRenderingContext2D} g @param {number} x @param {number} y @param {number} gap @param {number} R */
    function rings(g, x, y, gap, R) {
      for (let q = gap; q < R + gap; q += gap) { g.moveTo(x + q, y); g.arc(x, y, q, 0, TAU); }
    }

    /**
     * Strokes a grating into g round (x, y): rings, or lines at angle a.
     * @param {CanvasRenderingContext2D} g @param {boolean} ring @param {number} x @param {number} y
     * @param {number} a @param {number} gap @param {number} R
     */
    function grating(g, ring, x, y, a, gap, R) {
      g.beginPath();
      if (ring) rings(g, x, y, gap, R); else lines(g, x, y, a, gap, R);
      g.stroke();
    }
    // The page is rings only in the rings-over-rings variant; lenses are rings in two of three.
    const pageRings = s.layout === 1, lensRings = s.layout !== 0;

    /** Redraws a lens's own canvas with its grating at its present turn. @param {Lens} L */
    function paintLens(L) {
      const g = L.cv.getContext('2d');
      if (!g) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, sz, sz);
      g.setTransform(s.dpr, 0, 0, s.dpr, 1, 1);
      g.strokeStyle = col(s.layout === 2 ? 2 : 1);
      g.lineWidth = d * 0.5;
      // Lines turn a few degrees either way; rings, alike at every turn, differ in spacing.
      const th = L.th + 0.025 * Math.sin(s.t * L.f + L.ph);
      grating(g, lensRings, r, r, base + th, lensRings ? d * 1.04 : d * (1 + 0.6 * Math.abs(L.th)), r * 1.5);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(mask, 0, 0);
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        d = clamp(m / 140, 4.5, 7);
        r = clamp(m * 0.17, 70, 230);
        sz = Math.ceil(r * 2 * s.dpr) + 2;
        // The page grating, once per size.
        page.width = s.cv.width; page.height = s.cv.height;
        const g = page.getContext('2d');
        if (g) {
          g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
          g.strokeStyle = col(0);
          g.lineWidth = d * 0.5;
          const cx = pageRings ? s.W * ox : s.W / 2, cy = pageRings ? s.H * oy : s.H / 2;
          grating(g, pageRings, cx, cy, base, d, Math.hypot(s.W, s.H) + d);
        }
        mask.width = mask.height = sz;
        const mg = mask.getContext('2d');
        if (mg) {
          const c = sz / 2;
          const grad = mg.createRadialGradient(c, c, 0, c, c, c);
          grad.addColorStop(0, 'rgba(0,0,0,1)');
          grad.addColorStop(0.72, 'rgba(0,0,0,1)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          mg.fillStyle = grad;
          mg.fillRect(0, 0, sz, sz);
        }
        // Lenses by area, kept where they were. Line lenses drift mostly along the page's lines,
        // which moves their bands least, and rings drift slowly, so no band passes faster than
        // about one a second.
        const n = clamp(Math.round(s.W * s.H / 400000), 2, 6);
        const along = pageRings ? rng.random() * TAU : base + TAU / 4;
        while (lenses.length < n) {
          const k = lenses.length;
          const v = lensRings ? 4 + rng.random() * 2 : 9 + rng.random() * 6;
          const dir = along + (rng.random() - 0.5) * 0.3 + (k % 2 ? Math.PI : 0);
          lenses.push({ x: (k + 0.5) / n * s.W + (rng.random() - 0.5) * 40, y: rng.random() * s.H,
            vx: Math.cos(dir) * v, vy: Math.sin(dir) * v,
            th: (rng.random() < 0.5 ? -1 : 1) * (0.05 + rng.random() * 0.05),
            ph: rng.random() * TAU, f: 0.03 + rng.random() * 0.03, cv: document.createElement('canvas') });
        }
        lenses.length = n;
        for (const L of lenses) {
          L.cv.width = L.cv.height = sz;
          L.x = Math.min(L.x, s.W); L.y = Math.min(L.y, s.H);
          paintLens(L);
        }
      },
      step(dt) {
        for (const L of lenses) {
          L.x += L.vx * dt; L.y += L.vy * dt;
          // Round the edges, a lens's width beyond them.
          if (L.x < -r) L.x += s.W + 2 * r; else if (L.x > s.W + r) L.x -= s.W + 2 * r;
          if (L.y < -r) L.y += s.H + 2 * r; else if (L.y > s.H + r) L.y -= s.H + 2 * r;
        }
        // Rings look the same at every turn, so only line lenses are redrawn, one a frame: they
        // turn so slowly that a few frames' wait never shows.
        if (!lensRings && lenses.length) paintLens(lenses[turn++ % lenses.length]);
      },
      draw() {
        const { ctx } = s;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = s.dark ? 0.42 : 0.4;
        ctx.drawImage(page, 0, 0);
        // Xor keeps the overlap from doubling up: in step the two share their lines and half the
        // ground shows, out of step they fill it, and that difference is the band.
        ctx.globalCompositeOperation = 'xor';
        for (const L of lenses) ctx.drawImage(L.cv, (L.x - r) * s.dpr - 1, (L.y - r) * s.dpr - 1);
        ctx.globalCompositeOperation = 'source-over';
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      },
    };
  });
}
