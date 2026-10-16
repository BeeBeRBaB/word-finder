// Contours: the contour lines of a height field that changes slowly, traced by marching squares
// on a coarse grid, every fifth line heavier, coloured by height. The seed picks the variant: a
// topographic map of hills and hollows that rise, sink and wander; isobars, a weather chart whose
// highs and lows (marked H and L) blow across the host; or a flyover, rugged terrain scrolling
// under the viewer, its ridges packed with lines.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, ax:number, ay:number, fx:number, fy:number, px:number, py:number, a:number, r:number, f:number}} Hill */

/** Each square's crossing edges by case (corner bits a=8 b=4 c=2 d=1 from top left, clockwise),
 * as edge pairs (0 top, 1 right, 2 bottom, 3 left); the saddles 5 and 10 are resolved apart. */
const CASES = [[], [3, 2], [2, 1], [3, 1], [0, 1], [], [0, 2], [0, 3], [0, 3], [0, 2], [], [0, 1], [3, 1], [2, 1], [3, 2], []];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    let cell = 14, gw = 0, gh = 0, m = 1;
    let v = new Float32Array(0);
    /** @type {Hill[]} */
    const hills = [];
    const nh = layout === 1 ? 5 : 8;
    for (let i = 0; i < nh; i++) {
      // Isobars: alternate highs and lows; topo: mostly hills with a couple of hollows.
      const sign = layout === 1 ? (i % 2 ? -1 : 1) : (i % 4 === 3 ? -1 : 1);
      hills.push({ x: rng.random(), y: rng.random(), ax: 0.12 + rng.random() * 0.25, ay: 0.1 + rng.random() * 0.25,
        fx: 0.012 + rng.random() * 0.02, fy: 0.01 + rng.random() * 0.02, px: rng.random() * TAU, py: rng.random() * TAU,
        a: sign * (0.6 + rng.random() * 0.6), r: layout === 1 ? 0.3 + rng.random() * 0.2 : 0.1 + rng.random() * 0.16,
        f: 0.03 + rng.random() * 0.04 });
    }
    const ph = Array.from({ length: 8 }, () => rng.random() * TAU);
    const spacing = layout === 1 ? 0.11 : layout === 2 ? 0.14 : 0.1;
    const heavy = layout === 1 ? 4 : 5;
    // Segments by stroke: [colour][heavy], each a flat list of x0, y0, x1, y1.
    /** @type {number[][][]} */
    const segs = Array.from({ length: C }, () => [[], []]);
    /** @type {{x:number, y:number, hi:boolean}[]} */
    let marks = [];

    /** Where the hills are now, in host px, and their height scale. */
    function placed() {
      const t = s.t, aspect = s.W / m;
      return hills.map((h) => {
        let x, y;
        if (layout === 1) {
          // Weather drifts west to east, wrapping a system's width beyond the edges.
          const span = aspect + 2 * h.r;
          x = ((h.x * span + t * 0.006 * (1 + h.fx * 20)) % span) - h.r;
          y = (0.15 + 0.7 * h.y + 0.08 * Math.sin(t * h.fy + h.py)) * s.H / m;
        } else {
          x = aspect * (0.5 + (h.x - 0.5) * 0.9 + h.ax * Math.sin(t * h.fx + h.px));
          y = (s.H / m) * (0.5 + (h.y - 0.5) * 0.9 + h.ay * Math.sin(t * h.fy + h.py));
        }
        const a = h.a * (layout === 1 ? 1 : 0.75 + 0.25 * Math.sin(t * h.f + h.px));
        return { x, y, a, k: 1 / (2 * h.r * h.r) };
      });
    }

    /** Fills v with the field's height on the grid. */
    function field() {
      const t = s.t;
      if (layout === 2) {
        // Folded terrain: octaves of rotated sines, sliding diagonally as if flown over.
        const ox = t * 0.018, oy = t * 0.011;
        for (let j = 0, o = 0; j < gh; j++) {
          for (let i = 0; i < gw; i++, o++) {
            const x = i * cell / m + ox, y = j * cell / m + oy;
            let h = 0, f = 3.2, a = 1;
            for (let q = 0; q < 3; q++) {
              const u = x * 0.8 + y * 0.6, w = y * 0.8 - x * 0.6;
              h += a * Math.sin(f * (q % 2 ? u : x) + ph[q]) * Math.sin(f * (q % 2 ? w : y) + ph[q + 4]);
              f *= 2.07; a *= 0.52;
            }
            // Fold the ridges sharp, as weathered rock is.
            v[o] = 1.6 * (0.7 - Math.abs(h)) + 0.4 * h;
          }
        }
        return;
      }
      const ps = placed();
      if (layout === 1) marks = ps.map((p) => ({ x: p.x * m, y: p.y * m, hi: p.a > 0 }));
      for (let j = 0, o = 0; j < gh; j++) {
        const y = j * cell / m;
        for (let i = 0; i < gw; i++, o++) {
          const x = i * cell / m;
          let h = layout === 1 ? 0 : 0.18 * Math.sin(x * 4 + ph[0] + t * 0.02) * Math.sin(y * 3.5 + ph[1]);
          for (const p of ps) {
            const dx = x - p.x, dy = y - p.y, e = (dx * dx + dy * dy) * p.k;
            if (e < 7) h += p.a * Math.exp(-e);   // beyond, under 0.1% of the hill
          }
          v[o] = h;
        }
      }
    }

    const EX = new Float64Array(4), EY = new Float64Array(4);
    /** Traces every level through the grid into segs. */
    function trace() {
      for (const pair of segs) { pair[0].length = 0; pair[1].length = 0; }
      for (let j = 0; j < gh - 1; j++) {
        const y0 = j * cell, y1 = y0 + cell;
        for (let i = 0; i < gw - 1; i++) {
          const o = j * gw + i;
          const a = v[o], b = v[o + 1], c = v[o + gw + 1], d = v[o + gw];
          const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
          const k0 = Math.ceil(lo / spacing), k1 = Math.floor(hi / spacing);
          const x0 = i * cell, x1 = x0 + cell;
          for (let k = k0; k <= k1; k++) {
            const L = k * spacing;
            const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const col = (((Math.floor(k / 2)) % C) + C) % C;
            const out = segs[col][((k % heavy) + heavy) % heavy === 0 ? 1 : 0];
            // Where the level crosses each edge (only the crossed ones are read).
            EX[0] = x0 + cell * (L - a) / (b - a); EY[0] = y0;
            EX[1] = x1; EY[1] = y0 + cell * (L - b) / (c - b);
            EX[2] = x0 + cell * (L - d) / (c - d); EY[2] = y1;
            EX[3] = x0; EY[3] = y0 + cell * (L - a) / (d - a);
            if (idx === 5 || idx === 10) {
              const joined = (a + b + c + d) / 4 > L;
              if ((idx === 5) === joined) out.push(EX[0], EY[0], EX[3], EY[3], EX[2], EY[2], EX[1], EY[1]);
              else out.push(EX[0], EY[0], EX[1], EY[1], EX[3], EY[3], EX[2], EY[2]);
            } else {
              const e = CASES[idx], f = e[0], g = e[1];
              out.push(EX[f], EY[f], EX[g], EY[g]);
            }
          }
        }
      }
    }

    // The field is worked out on one frame and traced on the next, so no frame does both.
    let frame = 0;

    return {
      lay() {
        m = Math.min(s.W, s.H);
        cell = clamp(m / 50, 9, 16);
        gw = Math.ceil(s.W / cell) + 2; gh = Math.ceil(s.H / cell) + 2;
        if (v.length !== gw * gh) v = new Float32Array(gw * gh);
        field();
        trace();
      },
      step() {
        if (++frame % 2) field();
        else trace();
      },
      draw() {
        const { ctx } = s;
        ctx.lineCap = 'butt';
        for (let c = 0; c < C; c++) {
          for (let w = 0; w < 2; w++) {
            const list = segs[c][w];
            if (!list.length) continue;
            ctx.beginPath();
            for (let i = 0; i < list.length; i += 4) { ctx.moveTo(list[i], list[i + 1]); ctx.lineTo(list[i + 2], list[i + 3]); }
            ctx.strokeStyle = s.colors[c];
            ctx.globalAlpha = w ? (s.dark ? 0.6 : 0.62) : (s.dark ? 0.38 : 0.42);
            ctx.lineWidth = w ? 2.2 : 1.1;
            ctx.stroke();
          }
        }
        if (layout === 1) {
          // The centres of the pressure systems, labelled as a weather chart labels them.
          const size = clamp(m * 0.05, 18, 40);
          ctx.font = `700 ${size}px system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.globalAlpha = s.dark ? 0.5 : 0.55;
          ctx.fillStyle = s.ink;
          for (const p of marks) ctx.fillText(p.hi ? 'H' : 'L', p.x, p.y);
        }
        ctx.globalAlpha = 1;
      },
    };
  });
}
