// Kinetic: a wind sculpture of thin panels on axles, each turning so its width narrows to an
// edge and opens on its other face, and a panel glints as its face swings past the light.
// Layout 0: a grid of square panels on upright axles, a plane wave sweeping across on the
// diagonal. 1: rows of tall blades, ripples spreading from a slowly wandering point. 2: wide
// louvres on level axles, idling until a gust sweeps across and spins them up, then slowing.

import { stage, TAU, clamp } from './stage.js';

const LEVELS = 6;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const nc = s.colors.length;
    const front = s.colors[0], back = s.colors[nc > 1 ? 1 : 0];
    let px = new Float32Array(0), py = new Float32Array(0), th = new Float32Array(0), om = new Float32Array(0);
    let n = 0, sp = 30, hw = 10, hh = 10;
    /** @type {number[]} axle positions: x of upright ones, y of level ones */
    let axles = [];
    const ph = rng.random() * TAU;
    // Layout 2's gust: where it is across the screen, its height band, and when the next comes.
    const gust = { x: 1e9, y: 0, h: 0, v: 0, wait: 2 };

    return {
      lay() {
        sp = clamp(Math.min(s.W, s.H) / 19, 24, 60);
        /** @type {number[]} */
        const xs = [], ys = [];
        let dx, dy;
        if (L === 0) { dx = dy = sp; hw = sp * 0.34; hh = sp * 0.34; }
        else if (L === 1) { dx = sp * 0.62; dy = sp * 2.8; hw = sp * 0.22; hh = sp * 1.25; }
        else { dx = sp * 1.9; dy = sp * 0.95; hw = sp * 0.82; hh = sp * 0.3; }
        const cols = Math.ceil(s.W / dx) + 1, rows = Math.ceil(s.H / dy) + 1;
        const ox = (s.W - (cols - 1) * dx) / 2, oy = (s.H - (rows - 1) * dy) / 2;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { xs.push(ox + c * dx); ys.push(oy + r * dy); }
        axles = [];
        if (L === 2) for (let r = 0; r < rows; r++) axles.push(oy + r * dy);
        else for (let c = 0; c < cols; c++) axles.push(ox + c * dx);
        const keep = xs.length === n;
        n = xs.length;
        px = Float32Array.from(xs); py = Float32Array.from(ys);
        if (!keep) {
          th = new Float32Array(n); om = new Float32Array(n);
          // Layout 2 starts from a gentle ripple, left over from an earlier gust.
          for (let i = 0; i < n; i++) { th[i] = px[i] / s.W * 3 + Math.sin(py[i] / s.H * 5 + ph); om[i] = 0.25; }
          if (L === 2) sweep(0);
        }
      },
      step(dt) { if (L === 2) sweep(dt); },
      draw() {
        const { ctx } = s;
        const t = s.t;
        // The light's direction drifts, so the glints wander over the sculpture.
        const lt = 0.5 * Math.sin(t * 0.07 + ph);
        /** @type {Path2D[]} front faces by brightness, then back faces */
        const buckets = [];
        for (let k = 0; k < LEVELS * 2; k++) buckets.push(new Path2D());
        let cx = 0, cy = 0, kx = 0, ky = 0;
        if (L === 0) {
          const a = TAU / 8 + 0.6 * Math.sin(t * 0.03 + ph);
          const k = TAU / (sp * 9);
          kx = Math.cos(a) * k; ky = Math.sin(a) * k;
        } else if (L === 1) {
          cx = s.W * (0.5 + 0.35 * Math.sin(t * 0.05 + ph));
          cy = s.H * (0.5 + 0.35 * Math.sin(t * 0.037 + ph * 2));
          kx = TAU / (sp * 7);
        }
        for (let i = 0; i < n; i++) {
          let a;
          if (L === 0) a = (px[i] * kx + py[i] * ky) - t * 0.8;
          else if (L === 1) a = Math.hypot(px[i] - cx, py[i] - cy) * kx - t * 0.9;
          else a = th[i];
          const c = Math.cos(a);
          // The face toward the viewer, and how squarely it meets the light.
          const nrm = c >= 0 ? a : a + Math.PI;
          const lit = Math.max(0, Math.cos(nrm - lt));
          const lv = Math.min(LEVELS - 1, Math.floor(lit * lit * lit * LEVELS));
          const p = buckets[lv + (c >= 0 ? 0 : LEVELS)];
          const ac = Math.abs(c);
          if (L === 2) {
            const h = Math.max(0.75, hh * ac);
            p.rect(px[i] - hw, py[i] - h, hw * 2, h * 2);
          } else {
            const w = Math.max(0.75, hw * ac);
            p.rect(px[i] - w, py[i] - hh, w * 2, hh * 2);
          }
        }
        // Axles first, faint, then the panels from dim to bright.
        ctx.globalAlpha = s.dark ? 0.16 : 0.2;
        ctx.strokeStyle = s.ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const v of axles) {
          if (L === 2) { ctx.moveTo(0, v); ctx.lineTo(s.W, v); } else { ctx.moveTo(v, 0); ctx.lineTo(v, s.H); }
        }
        ctx.stroke();
        for (let k = 0; k < LEVELS * 2; k++) {
          const lv = k % LEVELS;
          ctx.fillStyle = k < LEVELS ? front : back;
          ctx.globalAlpha = (s.dark ? 0.1 : 0.12) + (s.dark ? 0.34 : 0.36) * lv / (LEVELS - 1);
          ctx.fill(buckets[k]);
        }
      },
    };

    /** Layout 2: a gust band crosses now and then, spinning up the panels it passes; each panel
     * eases toward its target speed, so the spin carries on after the gust and slows. @param {number} dt */
    function sweep(dt) {
      if (gust.x > s.W + 4 * sp) {
        gust.wait -= dt;
        if (gust.wait <= 0) {
          gust.x = -4 * sp; gust.y = s.H * (0.2 + rng.random() * 0.6); gust.h = s.H * (0.25 + rng.random() * 0.35);
          gust.v = sp * (3.5 + rng.random() * 2); gust.wait = 3 + rng.random() * 5;
        }
      } else gust.x += gust.v * dt;
      const gw = 3.5 * sp;
      const e = Math.min(1, dt * 0.8);
      for (let i = 0; i < n; i++) {
        const fx = (px[i] - gust.x) / gw, fy = (py[i] - gust.y) / gust.h;
        const g = fx > -3 && fx < 3 ? Math.exp(-fx * fx - fy * fy) : 0;
        om[i] += (0.25 + 2.1 * g - om[i]) * e;
        th[i] += om[i] * dt;
      }
    }
  });
}
