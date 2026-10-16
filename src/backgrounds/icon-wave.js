// Stadium wave: the subject's icons sit in rows like a crowd in the stands, and a wave runs
// through them, lifting each in turn as it passes. The seed picks the variant: straight tiers
// with the wave sweeping one way, a stadium bowl seen from above with the wave running round it,
// or tiers with the wave running back and forth, every icon facing its way.

import { iconStage } from './icon-stage.js';
import { TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, size:number, key:number, i:number}} Seat
 * A place in the stands: where it sits, its icon's size, where it is along the wave's path (x
 * across the tiers, an angle round the bowl) and which icon sits in it. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {number[]} the icon in each seat, kept across resizes */
    const ks = [];
    /** @param {number} i @returns {number} */
    const kOf = (i) => {
      while (ks.length <= i) ks.push(rng.random() < 0.12 ? 0 : 1 + rng.int(Math.max(1, s.n - 1)));
      return ks[i];
    };
    /** @type {Seat[]} */
    let seats = [];
    /** @type {{y:number, rx:number, ry:number}[]} tier lines, or the bowl's rings */
    let lines = [];
    const way = rng.random() < 0.5 ? -1 : 1;
    let width = 100, rise = 40, span = 1, lap = 10, cx = 0, cy = 0;

    /** Where the wave's crest is along the path now, and which way it goes. @returns {[number, number]} */
    function crest() {
      const t = s.t + lap * 0.35;
      if (layout === 1) return [way * t * TAU / lap, way];
      const u = t / lap % (layout === 2 ? 2 : 1);
      if (layout === 0) return [way > 0 ? u * span - width * 2 : s.W + width * 2 - u * span, way];
      // Back and forth: out along the tiers and back, the turn just past each edge.
      const fwd = u < 1;
      const v = fwd ? u : 2 - u;
      return [-width + v * (s.W + width * 2), fwd ? 1 : -1];
    }

    return {
      lay() {
        const { W, H } = s;
        const unit = Math.min(W, H);
        seats = []; lines = [];
        cx = W / 2; cy = H / 2;
        if (layout === 1) {
          const base = clamp(unit * 0.08, 28, 64);
          let i = 0;
          for (let j = 0; j < 3; j++) {
            const rx = W * (0.22 + 0.13 * j), ry = H * (0.19 + 0.125 * j);
            const n = clamp(Math.round(Math.PI * (rx + ry) / (base * 2.2)), 8, 30);
            lines.push({ y: cy, rx, ry });
            for (let m = 0; m < n; m++) {
              const a = (m + (j % 2) * 0.5) / n * TAU;
              seats.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, key: a,
                size: base * (0.85 + 0.12 * j) * (0.9 + 0.15 * Math.sin(a)), i: i++ });
            }
          }
          width = 0.42; rise = base * 0.7; lap = 15;
          // Back rows first, so the nearer ones overlap them.
          seats.sort((a, b) => a.y - b.y);
          return;
        }
        const step = unit * 0.17;
        const cols = clamp(Math.round(W / step), 4, 11), rows = clamp(Math.round(H / step), 3, 7);
        const gx = W / cols, gy = H / rows;
        const size = clamp(Math.min(gx, gy) * 0.5, 24, 92);
        let i = 0;
        for (let r = 0; r < rows; r++) {
          const y = gy * (r + 0.58);
          lines.push({ y: y + size * 0.55, rx: 0, ry: 0 });
          const off = r % 2 ? 0 : gx / 2;
          for (let c = 0; c <= cols; c++) {
            const x = off + c * gx;
            if (x > W + 1) continue;
            // Each row lags the one in front a little, so the crest runs on a slant.
            seats.push({ x, y, size, key: x - r * gx * 0.22 * way, i: i++ });
          }
        }
        width = gx * 1.1; rise = gy * 0.45;
        span = W + width * 4 + rows * gx * 0.3; lap = span / clamp(W / 6, 60, 260);
      },
      step() {},
      draw() {
        const { ctx, t } = s;
        const [at, dir] = crest();
        // The stands: tier lines, or the bowl's rings round a faint pitch.
        ctx.strokeStyle = s.ink;
        ctx.globalAlpha = 0.16;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (const l of lines) {
          if (l.rx) {
            ctx.moveTo(cx + l.rx * 1.06, l.y + l.ry * 0.06);
            ctx.ellipse(cx, l.y + l.ry * 0.06, l.rx * 1.06, l.ry * 1.06, 0, 0, TAU);
          } else { ctx.moveTo(0, l.y); ctx.lineTo(s.W, l.y); }
        }
        if (layout === 1 && lines.length) {
          const pw = lines[0].rx * 0.62, ph = lines[0].ry * 0.6;
          ctx.rect(cx - pw, cy - ph, pw * 2, ph * 2);
          ctx.moveTo(cx, cy - ph); ctx.lineTo(cx, cy + ph);
          ctx.moveTo(cx + ph * 0.3, cy); ctx.arc(cx, cy, ph * 0.3, 0, TAU);
        }
        ctx.stroke();
        for (const p of seats) {
          let d = p.key - at;
          if (layout === 1) d = (((d % TAU) + TAU + Math.PI) % TAU) - Math.PI;
          const lift = Math.exp(-(d / width) * (d / width));
          const bob = Math.sin(t * 0.9 + p.i * 1.7) * p.size * 0.02;
          s.icon(kOf(p.i), p.x, p.y - lift * rise + bob, p.size * (1 + 0.22 * lift), 0, 0.36 + 0.24 * lift,
            layout === 1 ? 0 : dir);
        }
      },
    };
  });
}
