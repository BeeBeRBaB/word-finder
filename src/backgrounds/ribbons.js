// Ribbons: long sinuous ribbons that twist as they travel, a different colour on each face, the
// faces brighter where they turn toward the light. The seed picks the variant: free flight, ribbons
// trailing behind heads that wander the host like a gymnast's ribbon; streamers, ribbons across the
// whole width rippling in a wind as twists run along them; or knots, ribbons following 3D Lissajous
// loops, wider and brighter where they come near.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, th:number, z:number}} Pt */
/** @typedef {{pts:Pt[], x:number, y:number, a:number, th:number, z:number, f:number[], ph:number[], c:number, cx:number, cy:number, R:number, moved:number}} Ribbon */

const LEVELS = 4;   // shading steps per face

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    /** @type {Ribbon[]} */
    let ribbons = [];
    /** @type {Pt[]} */
    const pool = [];
    let m = 1, width = 20, gap = 8, len = 0, warmed = false;
    // Scratch for one ribbon's edges.
    let ax = new Float32Array(0), ay = new Float32Array(0), bx = new Float32Array(0), by = new Float32Array(0);
    let sh = new Float32Array(0);

    /** @param {number} i @returns {Ribbon} */
    function ribbon(i) {
      return { pts: [], x: rng.random() * s.W, y: rng.random() * s.H, a: rng.random() * TAU, th: rng.random() * TAU, z: 0,
        f: [0.17 + rng.random() * 0.2, 0.31 + rng.random() * 0.25, 0.05 + rng.random() * 0.05],
        ph: [rng.random() * TAU, rng.random() * TAU, rng.random() * TAU], c: i % C, cx: 0, cy: 0, R: 0, moved: 0 };
    }

    /** Knots: the head's place on its loop at time t. @param {Ribbon} r @param {number} t */
    function knot(r, t) {
      const k = [[2, 3, 1], [3, 2, 5], [3, 4, 1], [1, 2, 3]][r.c % 4];
      const u = t * 0.11;
      const X = Math.sin(k[0] * u + r.ph[0]), Y = Math.sin(k[1] * u + r.ph[1]), Z = Math.cos(k[2] * u + r.ph[2]);
      const p = 1 / (1 + 0.35 * Z);
      r.x = r.cx + r.R * X * p; r.y = r.cy + r.R * Y * p; r.z = -Z;
    }

    /** Moves one ribbon's head on and lays trail points behind it. @param {Ribbon} r @param {number} t @param {number} dt */
    function advance(r, t, dt) {
      const ox = r.x, oy = r.y;
      if (layout === 2) knot(r, t);
      else {
        // Wander: a turn made of two slow sines, and a pull back toward the middle near an edge.
        let turn = 0.7 * Math.sin(t * r.f[0] + r.ph[0]) + 0.5 * Math.sin(t * r.f[1] + r.ph[1]);
        const mx = s.W * 0.5 - r.x, my = s.H * 0.5 - r.y;
        const edge = Math.max(Math.abs(mx) / (s.W * 0.5), Math.abs(my) / (s.H * 0.5));
        if (edge > 0.8) {
          let d = Math.atan2(my, mx) - r.a;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          turn += d * (edge - 0.8) * 8;
        }
        r.a += clamp(turn, -1.6, 1.6) * dt;
        const v = m * 0.1;
        r.x += Math.cos(r.a) * v * dt; r.y += Math.sin(r.a) * v * dt;
      }
      r.th += (0.9 + 0.5 * Math.sin(t * r.f[2] + r.ph[2])) * dt;
      r.moved += Math.hypot(r.x - ox, r.y - oy);
      if (r.moved >= gap || !r.pts.length) {
        r.moved = 0;
        const p = pool.pop() ?? { x: 0, y: 0, th: 0, z: 0 };
        p.x = r.x; p.y = r.y; p.th = r.th; p.z = r.z;
        r.pts.unshift(p);
        while (r.pts.length > len) pool.push(/** @type {Pt} */ (r.pts.pop()));
      }
    }

    /** Fills and edges one ribbon through n spine points read by `at`.
     * @param {(i:number) => Pt} at @param {number} n @param {Ribbon} r @param {boolean} taper */
    function paint(at, n, r, taper) {
      const { ctx } = s;
      if (n < 2) return;
      for (let i = 0; i < n; i++) {
        // `at` may hand back one shared point, so each read is used before the next call.
        let p = at(Math.min(n - 1, i + 1));
        let tx = p.x, ty = p.y;
        p = at(Math.max(0, i - 1));
        tx -= p.x; ty -= p.y;
        p = at(i);
        const l = Math.hypot(tx, ty) || 1;
        tx /= l; ty /= l;
        const near = layout === 2 ? 1 / (1 + 0.35 * -p.z) : 1;
        const tail = taper ? Math.min(1, (n - 1 - i) / (n * 0.35)) * Math.min(1, (i + 2) / 6) : 1;
        const c = Math.cos(p.th), h = width * 0.5 * c * near * (0.25 + 0.75 * tail);
        ax[i] = p.x - ty * h; ay[i] = p.y + tx * h;
        bx[i] = p.x + ty * h; by[i] = p.y - tx * h;
        // Shade: sign is the face, size how squarely it faces us (and how near, for knots).
        const lit = layout === 2 ? Math.abs(c) * 0.55 + (p.z + 1) * 0.225 : Math.abs(c);
        sh[i] = (c >= 0 ? 1 : -1) * (1 + Math.min(LEVELS - 1, Math.floor(lit * LEVELS)));
      }
      for (let side = -1; side <= 1; side += 2) {
        for (let lv = 0; lv < LEVELS; lv++) {
          ctx.beginPath();
          let any = false;
          for (let i = 0; i < n - 1; i++) {
            const k = sh[i];
            if ((k > 0 ? 1 : -1) !== side || Math.abs(k) - 1 !== lv) continue;
            // Every quad wound the same way, so overlaps in one path fill once.
            const j = i + 1;
            if (k > 0) {
              ctx.moveTo(ax[i], ay[i]); ctx.lineTo(ax[j], ay[j]); ctx.lineTo(bx[j], by[j]); ctx.lineTo(bx[i], by[i]);
            } else {
              ctx.moveTo(bx[i], by[i]); ctx.lineTo(bx[j], by[j]); ctx.lineTo(ax[j], ay[j]); ctx.lineTo(ax[i], ay[i]);
            }
            ctx.closePath();
            any = true;
          }
          if (!any) continue;
          ctx.fillStyle = s.colors[side > 0 ? r.c : (r.c + 1) % C];
          ctx.globalAlpha = (s.dark ? 0.16 : 0.2) + lv * (s.dark ? 0.12 : 0.13) + (side > 0 ? 0.04 : 0);
          ctx.fill();
        }
      }
      // A fine line along each edge keeps the silk crisp.
      ctx.globalAlpha = s.dark ? 0.45 : 0.5;
      ctx.strokeStyle = s.colors[r.c];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax[0], ay[0]);
      for (let i = 1; i < n; i++) ctx.lineTo(ax[i], ay[i]);
      ctx.moveTo(bx[0], by[0]);
      for (let i = 1; i < n; i++) ctx.lineTo(bx[i], by[i]);
      ctx.stroke();
    }

    /** @type {Pt} */
    const tmp = { x: 0, y: 0, th: 0, z: 0 };
    let sr = /** @type {Ribbon|null} */ (null);

    /** Streamers: the spine point i of the current ribbon sr. @param {number} i @returns {Pt} */
    function streamer(i) {
      const r = /** @type {Ribbon} */ (sr), t = s.t;
      const x = -20 + i * gap, k = TAU / (m * (0.9 + r.f[0]));
      tmp.x = x;
      tmp.y = r.cy + (x - s.W / 2) * r.f[2] * 0.6 + r.R * Math.sin(k * x - t * 0.45 + r.ph[0])
        + r.R * 0.4 * Math.sin(k * 2.3 * x - t * 0.7 + r.ph[1]);
      tmp.th = k * 1.6 * x - t * (0.8 + r.f[1]) + r.ph[2];
      return tmp;
    }

    return {
      lay() {
        m = Math.min(s.W, s.H);
        width = clamp(m * 0.05, 16, 48);
        gap = clamp(m * 0.012, 5, 10);
        const n = layout === 1 ? clamp(Math.round(s.H / 130), 3, 8) : layout === 2 ? clamp(Math.round(s.W * s.H / 260000), 2, 4)
          : clamp(Math.round(s.W * s.H / 200000), 3, 6);
        while (ribbons.length < n) ribbons.push(ribbon(ribbons.length));
        ribbons.length = n;
        len = Math.round((layout === 2 ? m * 1.6 : m * 1.3) / gap);
        const cols = Math.ceil(Math.sqrt(n * s.W / s.H));
        ribbons.forEach((r, i) => {
          if (layout === 1) { r.cy = (i + 0.5) * s.H / n; r.R = clamp(s.H / n * 0.3, 14, 70); }
          if (layout === 2) {
            // Knots sit in a loose grid, each as big as its cell allows.
            const rowsN = Math.ceil(n / cols), col = i % cols, row = Math.floor(i / cols);
            r.cx = (col + 0.5) * s.W / cols; r.cy = (row + 0.5) * s.H / rowsN;
            r.R = Math.min(s.W / cols, s.H / rowsN) * 0.3;
          }
          r.x = Math.min(r.x, s.W); r.y = Math.min(r.y, s.H);
        });
        const max = layout === 1 ? Math.ceil((s.W + 40) / gap) + 1 : len + 1;
        if (ax.length < max) {
          ax = new Float32Array(max); ay = new Float32Array(max); bx = new Float32Array(max); by = new Float32Array(max);
          sh = new Float32Array(max);
        }
        // Grow the trails over the last 40s, so the first frame (and reduced motion) shows whole
        // ribbons; knots again on every resize, as their loops have moved.
        if (layout === 2 || (!warmed && layout === 0)) {
          warmed = true;
          const dt = 1 / 30;
          for (const r of ribbons) { pool.push(...r.pts); r.pts.length = 0; }
          for (let k = 0; k <= 1200; k++) for (const r of ribbons) advance(r, s.t - 40 + k * dt, dt);
        }
      },
      step(dt) {
        if (layout === 1) return;
        for (const r of ribbons) advance(r, s.t, dt);
      },
      draw() {
        if (layout === 1) {
          const n = Math.ceil((s.W + 40) / gap) + 1;
          for (const r of ribbons) { sr = r; paint(streamer, n, r, false); }
        } else {
          for (const r of ribbons) paint((i) => r.pts[i], r.pts.length, r, true);
        }
        s.ctx.globalAlpha = 1;
      },
    };
  });
}
