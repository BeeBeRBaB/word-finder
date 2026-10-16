// Train window: the view from a moving train, framed by its window. Far hills slide by slowly,
// nearer land faster, and telegraph poles sweep past nearest of all, their wires dipping between
// them. The seed picks the variant: farmland, rolling hills with round trees and hedges under
// clouds; a mountain lake, jagged peaks over glinting water and a pine shore; or a town at dusk,
// rows of houses and distant blocks with lit windows under a moon.

import { roundRect } from './shapes.js';
import { stage, clamp } from './stage.js';

const STEP = 6;        // px between ridge samples

/** @typedef {{u:number, a:number, b:number, k:number}} Thing u across the tile 0..1, a b shape draws, k lit flags */
/** @typedef {{base:number, amp:number, peak:boolean, v:number, c:number, al:number, kind:string, things:Thing[],
 *   waves:{n:number, a:number, p:number}[], h:Float32Array, off:number}} Layer */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    /** @param {number} k @returns {string} */
    const col = (k) => s.colors[k % C];

    /** @param {number} n @param {(i:number) => Thing} f @returns {Thing[]} */
    const many = (n, f) => Array.from({ length: n }, (_, i) => f(i)).sort((p, q) => p.u - q.u);
    const thing = (/** @type {number} */ u) => ({ u: ((u % 1) + 1) % 1, a: rng.random(), b: rng.random(), k: rng.int(16) });
    /** Clumps of things: n clumps of m each. @param {number} n @param {number} m @param {number} w clump width */
    const clumps = (n, m, w) => many(n * m, (i) => thing(Math.floor(i / m) / n + rng.random() * 0.3 / n + rng.random() * w));
    /** @param {number} n */
    const spread = (n) => many(n, (i) => thing((i + rng.random() * 0.5) / n));

    /** @param {Partial<Layer>} o @returns {Layer} */
    const layer = (o) => ({ base: 0.6, amp: 0.03, peak: false, v: 0.2, c: 0, al: 0.2, kind: '', things: [],
      waves: [2, 3, 5, 9].map((n) => ({ n, a: 0.4 + rng.random() * 0.6, p: rng.random() })),
      h: new Float32Array(0), off: rng.random() * 4000, ...o });

    /** @type {Layer[]} */
    const layers = layout === 1 ? [
      layer({ base: 0.5, amp: 0.2, peak: true, v: 0.04, c: 0, al: 0.2, kind: 'snow' }),
      layer({ base: 0.585, amp: 0, v: 0.07, c: 3, al: 0.1, kind: 'glint', things: spread(46) }),
      layer({ base: 0.7, amp: 0.035, v: 0.2, c: 1, al: 0.26, kind: 'pine', things: clumps(9, 12, 0.05) }),
      layer({ base: 0.87, amp: 0.012, v: 0.55, c: 2, al: 0.3, kind: 'bush', things: spread(20) }),
    ] : layout === 2 ? [
      layer({ base: 0.62, amp: 0.025, v: 0.05, c: 0, al: 0.16, kind: 'tower', things: clumps(3, 6, 0.06) }),
      layer({ base: 0.73, amp: 0.008, v: 0.2, c: 1, al: 0.25, kind: 'house', things: spread(30) }),
      layer({ base: 0.87, amp: 0.012, v: 0.55, c: 2, al: 0.3, kind: 'bush', things: spread(16) }),
    ] : [
      layer({ base: 0.53, amp: 0.075, v: 0.05, c: 0, al: 0.17 }),
      layer({ base: 0.67, amp: 0.045, v: 0.18, c: 1, al: 0.23, kind: 'tree', things: clumps(14, 3, 0.02) }),
      layer({ base: 0.85, amp: 0.018, v: 0.55, c: 2, al: 0.29, kind: 'hedge', things: spread(14) }),
    ];
    const clouds = layout === 2 ? [] : Array.from({ length: 6 }, (_, i) => ({ x: rng.random(), y: 0.12 + (i % 3) * 0.06 + rng.random() * 0.04, r: 0.7 + rng.random() * 0.6 }));
    let P = 0, N = 0, U = 20, near = 100, gap = 300, poleOff = rng.random() * 1000;

    /** Height of layer l at u across the tile, in fractions of H above its base. @param {Layer} l @param {number} u */
    function rise(l, u) {
      let h = 0;
      for (const w of l.waves) {
        const z = u * w.n + w.p;
        // Peaks: a sharpened triangle wave; hills: sines.
        h += (l.peak ? Math.pow(1 - Math.abs(2 * (z - Math.floor(z)) - 1), 1.6) * 2 - 0.7 : Math.sin(z * 6.2832)) * w.a / Math.sqrt(w.n);
      }
      return h * l.amp;
    }

    /** Screen y of the ground of layer l at screen x. @param {Layer} l @param {number} x */
    function yAt(l, x) {
      const f = ((x + l.off) / STEP) % N, i = Math.floor(f), j = (i + 1) % N;
      return l.h[i] + (l.h[j] - l.h[i]) * (f - i);
    }

    /** Calls f for each thing of l on screen, with its screen x. @param {Layer} l @param {number} m margin
     * @param {(t:Thing, x:number) => void} f */
    function each(l, m, f) {
      for (const t of l.things) {
        let x = t.u * P - l.off;
        x -= Math.floor(x / P) * P;
        if (x > P - m) x -= P;
        if (x < s.W + m) f(t, x);
      }
    }

    /** Fills or strokes the current path in colour c at alpha a. @param {string} c @param {number} a @param {boolean} [line] */
    function paintPath(c, a, line) {
      const { ctx } = s;
      ctx.globalAlpha = a;
      if (line) { ctx.strokeStyle = c; ctx.stroke(); } else { ctx.fillStyle = c; ctx.fill(); }
    }

    /** Draws layer l's ground and its things. @param {Layer} l */
    function drawLayer(l) {
      const { ctx, H } = s;
      const lift = s.dark ? 1 : 1.15;
      const fr = (l.off / STEP) % N, i0 = Math.floor(fr), sub = (fr - i0) * STEP;
      ctx.beginPath();
      ctx.moveTo(-STEP, H);
      for (let k = 0, x = -sub; x < s.W + STEP; k++, x += STEP) ctx.lineTo(x, l.h[(i0 + k) % N]);
      ctx.lineTo(s.W + STEP, H);
      ctx.closePath();
      paintPath(col(l.c), l.al * lift);
      const c = col(l.c);
      if (l.kind === 'snow') {
        // Caps on the highest peaks: the ridge, offset down, clipped to above a snow line.
        const line = s.H * (l.base - l.amp * 0.55);
        ctx.beginPath();
        ctx.moveTo(-STEP, line);
        for (let k = 0, x = -sub; x < s.W + STEP; k++, x += STEP) ctx.lineTo(x, Math.min(line, l.h[(i0 + k) % N]));
        ctx.lineTo(s.W + STEP, line);
        paintPath(col(3), 0.16 * lift);
      } else if (l.kind === 'tree') {
        ctx.beginPath();
        each(l, U * 2, (t, x) => {
          const h = U * (0.9 + t.a * 0.9), y = yAt(l, x) + 2;
          ctx.moveTo(x + h * 0.3, y - h * 0.62);
          ctx.arc(x, y - h * 0.62, h * 0.3 * (0.8 + t.b * 0.4), 0, 6.2832);
        });
        paintPath(c, l.al * 1.5 * lift);
        ctx.beginPath();
        each(l, U * 2, (t, x) => { const y = yAt(l, x) + 2; ctx.moveTo(x, y); ctx.lineTo(x, y - U * (0.5 + t.a * 0.5)); });
        ctx.lineWidth = clamp(U * 0.1, 2, 4);
        paintPath(c, l.al * 1.5 * lift, true);
      } else if (l.kind === 'pine') {
        ctx.beginPath();
        each(l, U, (t, x) => {
          const h = U * (0.8 + t.a * 1.1), w = h * 0.24, y = yAt(l, x) + 3;
          ctx.moveTo(x, y - h); ctx.lineTo(x + w, y); ctx.lineTo(x - w, y); ctx.closePath();
        });
        paintPath(c, l.al * 1.3 * lift);
      } else if (l.kind === 'glint') {
        // Light on the water, a slow shimmer in place.
        ctx.beginPath();
        each(l, U * 2, (t, x) => {
          const y = s.H * (0.6 + t.b * 0.06), w = U * (0.4 + t.a * 1.2) * (0.7 + 0.3 * Math.sin(s.t * 0.7 + t.k));
          ctx.moveTo(x - w, y); ctx.lineTo(x + w, y);
        });
        ctx.lineWidth = clamp(U * 0.08, 1.5, 3);
        if (s.dark) ctx.globalCompositeOperation = 'lighter';
        paintPath(col(3), 0.4, true);
        ctx.globalCompositeOperation = 'source-over';
      } else if (l.kind === 'bush' || l.kind === 'hedge') {
        ctx.beginPath();
        each(l, U * 3, (t, x) => {
          // Domes standing on the ground, a hedge a row of them.
          const r = U * (l.kind === 'hedge' ? 0.35 + t.a * 0.2 : 0.3 + t.a * 0.4), y = yAt(l, x) + r * 0.3;
          const n = l.kind === 'hedge' ? 3 + (t.k % 4) : 1 + (t.k % 2);
          for (let j = 0; j < n; j++) { ctx.moveTo(x + j * r * 1.3 - r, y); ctx.arc(x + j * r * 1.3, y, r * (1 - (j % 2) * 0.2), Math.PI, 0); ctx.closePath(); }
        });
        paintPath(c, l.al * 1.35 * lift);
      } else if (l.kind === 'house' || l.kind === 'tower') {
        const tower = l.kind === 'tower';
        /** @type {[number, number, number, number][]} */
        const lit = [];
        ctx.beginPath();
        each(l, U * 3, (t, x) => {
          const w = U * (tower ? 0.9 + t.a * 0.7 : 1.1 + t.a * 0.7), h = U * (tower ? 1.6 + t.b * 2.6 : 0.65 + t.b * 0.45);
          const y = yAt(l, x) + 2, x0 = x - w / 2;
          ctx.rect(x0, y - h, w, h);
          if (!tower) { ctx.moveTo(x0 - w * 0.08, y - h); ctx.lineTo(x, y - h - w * 0.42); ctx.lineTo(x0 + w * 1.08, y - h); }
          // Windows on a grid, some lit, fixed per building.
          const q = tower ? U * 0.22 : U * 0.2, cols = tower ? 3 : 2, rows = tower ? Math.max(2, Math.floor(h / (U * 0.5))) : 1;
          for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
            if ((t.k + r * 5 + k * 3) % (tower ? 3 : 2)) continue;
            lit.push([x0 + w * (k + 0.5) / cols - q / 2, y - h + (r + 0.5) * (h / (rows + (tower ? 0.4 : 0.6))), q, q * (tower ? 0.8 : 1.1)]);
          }
        });
        paintPath(c, l.al * 1.3 * lift);
        ctx.beginPath();
        for (const [x, y, w, h] of lit) ctx.rect(x, y, w, h);
        if (s.dark) ctx.globalCompositeOperation = 'lighter';
        paintPath(col(3), s.dark ? 0.5 : 0.55);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    function drawPoles() {
      const { ctx, H } = s;
      const top = H * 0.2, arm = U * 0.9, sag = gap * 0.07;
      const first = -(poleOff % gap) - gap;
      ctx.beginPath();
      for (let x = first; x < s.W + gap; x += gap) {
        // Three wires to the next pole, each hanging in a curve.
        for (const [dx, dy] of [[-arm * 0.8, 0], [arm * 0.8, 0], [0, U * 0.55]]) {
          ctx.moveTo(x + dx, top + dy);
          ctx.quadraticCurveTo(x + gap / 2 + dx, top + dy + sag * 2, x + gap + dx, top + dy);
        }
      }
      ctx.lineWidth = clamp(U * 0.05, 1.2, 2);
      paintPath(s.ink, s.dark ? 0.32 : 0.38, true);
      ctx.beginPath();
      for (let x = first; x < s.W + gap; x += gap) {
        ctx.moveTo(x, top - U * 0.35); ctx.lineTo(x, H);
        ctx.moveTo(x - arm, top); ctx.lineTo(x + arm, top);
      }
      ctx.lineWidth = clamp(U * 0.2, 3, 9);
      paintPath(s.ink, s.dark ? 0.4 : 0.45, true);
    }

    return {
      lay() {
        U = clamp(Math.min(s.W, s.H) * 0.055, 18, 52);
        const oldP = P;
        P = STEP * Math.ceil(Math.max(s.W * 1.7, 1600) / STEP);
        N = P / STEP;
        near = clamp(s.W * 0.16, 80, 240);
        gap = clamp(s.W * 0.5, 220, 620);
        for (const l of layers) {
          if (oldP) l.off = l.off / oldP * P;
          l.h = new Float32Array(N);
          for (let i = 0; i < N; i++) l.h[i] = s.H * (l.base - rise(l, i / N));
        }
      },
      step(dt) {
        for (const l of layers) l.off = (l.off + l.v * near * dt) % P;
        poleOff = (poleOff + near * dt) % gap;
        for (const c of clouds) c.x = (c.x + dt * near * 0.012 / s.W) % 1.4;
      },
      draw() {
        const { ctx, W: w, H } = s;
        const lift = s.dark ? 1 : 1.15;
        if (layout === 2) {
          // A moon with a faint halo.
          const r = U * 0.75, x = w * 0.78, y = H * 0.2;
          ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 6.2832); paintPath(col(3), 0.07);
          ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); paintPath(col(3), 0.32 * lift);
        } else {
          ctx.beginPath(); ctx.arc(w * 0.2, H * 0.24, U * 0.9, 0, 6.2832); paintPath(col(3), 0.2 * lift);
          ctx.beginPath();
          for (const c of clouds) {
            const x = (c.x - 0.2) * w * 1.0, y = c.y * H, r = U * c.r;
            for (const [dx, dy, k] of [[-1.1, 0.25, 0.7], [0, 0, 1], [1.1, 0.2, 0.75]]) {
              ctx.moveTo(x + dx * r + r * k, y + dy * r); ctx.arc(x + dx * r, y + dy * r, r * k, 0, 6.2832);
            }
          }
          paintPath(col(2), 0.11 * lift);
        }
        for (const l of layers) drawLayer(l);
        drawPoles();
        // The window: a rounded pane, the carriage wall shaded round it.
        const m = clamp(Math.min(w, H) * 0.035, 10, 34), r = clamp(Math.min(w, H) * 0.09, 24, 90);
        ctx.beginPath();
        ctx.rect(0, 0, w, H);
        roundRect(ctx, m, m, w - m * 2, H - m * 2, r);
        ctx.globalAlpha = s.dark ? 0.16 : 0.12;
        ctx.fillStyle = s.ink;
        ctx.fill('evenodd');
        ctx.beginPath();
        roundRect(ctx, m, m, w - m * 2, H - m * 2, r);
        ctx.lineWidth = clamp(m * 0.25, 2.5, 6);
        paintPath(s.ink, s.dark ? 0.3 : 0.32, true);
      },
    };
  });
}
