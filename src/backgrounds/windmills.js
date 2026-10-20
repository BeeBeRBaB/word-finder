// Windmills: windmills and wind turbines stand across the land, each turning its sails at its
// own steady speed while clouds drift over, smaller and fainter the farther off. The seed picks
// the variant: a polder, old lattice-sailed mills along flat land and a canal that ripples; a
// wind farm, rows of three-bladed turbines along rolling ridges; or offshore, turbines standing
// in the sea in rows that recede to the horizon, their reflections wavering among the swell.

import { stage, TAU, clamp } from './stage.js';

const STEP = 8;        // px between hill samples

/** @typedef {{x:number, y:number, z:number, mill:boolean, w:number, ph:number, c:number}} Mill
 * x, y its foot; z its nearness (scale); w turning speed in rad/s. */
/** @typedef {{y:Float32Array, c:number, al:number}} Hill */
/** @typedef {{x:number, y:number, r:number, v:number}} Cloud */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    /** @param {number} k */
    const col = (k) => s.colors[k % C];
    // Shapes from the seed, once, so a resize redraws the same land.
    const waves = Array.from({ length: 3 }, () => [1, 2, 3, 5].map((n) => ({ n, a: 0.4 + rng.random() * 0.6, p: rng.random() * TAU })));
    const jit = Array.from({ length: 64 }, () => rng.random());
    /** @type {Mill[]} */
    let mills = [];
    /** @type {Hill[]} */
    let hills = [];
    /** @type {Cloud[]} */
    const clouds = Array.from({ length: 6 }, (_, i) => ({ x: rng.random(), y: 0.06 + (i % 3) * 0.07 + rng.random() * 0.05, r: 0.6 + rng.random() * 0.6, v: 0.6 + rng.random() * 0.8 }));
    let S = 400, sea = 0;

    /** Height of hill i at x in px above its base, as a fraction of its amplitude. @param {number} i @param {number} x */
    const rise = (i, x) => waves[i].reduce((h, w) => h + Math.sin(x / s.W * TAU * w.n * 0.5 + w.p) * w.a / w.n, 0);

    /** Builds a hill's ridge. @param {number} i @param {number} base @param {number} amp @param {number} c @param {number} al @returns {Hill} */
    function hill(i, base, amp, c, al) {
      const y = new Float32Array(Math.ceil(s.W / STEP) + 2);
      for (let k = 0; k < y.length; k++) y[k] = s.H * base - rise(i, k * STEP) * amp;
      return { y, c, al };
    }
    /** @param {Hill} h @param {number} x */
    const ridge = (h, x) => { const f = clamp(x / STEP, 0, h.y.length - 1.001), k = Math.floor(f); return h.y[k] + (h.y[k + 1] - h.y[k]) * (f - k); };

    /** Spreads mills along a line: n across the width, fixed jitter. @param {number} n @param {number} z
     * @param {(x:number) => number} foot @param {boolean} mill @param {number} k0 jitter offset */
    function row(n, z, foot, mill, k0) {
      for (let j = 0; j < n; j++) {
        const x = s.W * (j + 0.25 + jit[(k0 + j) % 64] * 0.5) / n;
        mills.push({ x, y: foot(x), z: z * (0.88 + jit[(k0 + j * 7) % 64] * 0.24), mill, w: 0, ph: 0, c: 0 });
      }
    }

    function build() {
      const old = mills;
      mills = [];
      hills = [];
      const n = (/** @type {number} */ gap) => Math.max(2, Math.round(s.W / gap));
      if (layout === 0) {
        hills = [hill(0, 0.64, 0, 0, 0.12), hill(1, 0.86, 0, 1, 0.16)];
        row(n(S * 0.28), 0.32, () => s.H * 0.64, true, 0);
        row(n(S * 0.6), 0.6, () => s.H * 0.74, true, 11);
        row(Math.max(2, n(S * 1.4)), 1, () => s.H * 0.86, true, 23);
      } else if (layout === 1) {
        hills = [hill(0, 0.6, S * 0.06, 0, 0.13), hill(1, 0.74, S * 0.07, 1, 0.17), hill(2, 0.9, S * 0.05, 2, 0.21)];
        row(n(S * 0.2), 0.3, (x) => ridge(hills[0], x), false, 0);
        row(n(S * 0.42), 0.58, (x) => ridge(hills[1], x), false, 13);
        row(Math.max(2, n(S * 1.3)), 1, (x) => ridge(hills[2], x), false, 29);
      } else {
        sea = s.H * 0.56;
        // Rows recede toward the horizon, spaced in perspective about the middle.
        const depths = [0.22, 0.34, 0.5, 0.75];
        depths.forEach((z, r) => {
          const gap = S * 0.9 * z, y = sea + (s.H * 0.97 - sea) * Math.pow(z, 1.3) * 0.95;
          const off = (r % 2) * 0.5 + jit[r] * 0.3;
          for (let j = -Math.ceil(s.W / 2 / gap) - 1; j <= Math.ceil(s.W / 2 / gap) + 1; j++) {
            const x = s.W / 2 + (j + off) * gap;
            if (x > -gap * 0.3 && x < s.W + gap * 0.3) mills.push({ x, y, z, mill: false, w: 0, ph: 0, c: 0 });
          }
        });
      }
      mills.sort((p, q) => p.z - q.z);
      // Spin and colour are fixed per mill, kept across a resize where the count allows.
      mills.forEach((m, i) => {
        const o = old[i];
        // Old mills turn anticlockwise, turbines clockwise.
        m.w = o ? o.w : (m.mill ? -0.28 - jit[i % 64] * 0.3 : 0.45 + jit[(i * 5) % 64] * 0.45);
        m.ph = o ? o.ph : jit[(i * 3) % 64] * TAU;
        m.c = (i * 3 + Math.round(m.z * 5)) % C;
      });
    }

    /** @param {Mill} m */
    function drawTurbine(m) {
      const { ctx } = s;
      const h = S * 0.42 * m.z, hx = m.x, hy = m.y - h, b = h * 0.03;
      ctx.fillStyle = col(m.c);
      ctx.beginPath();
      ctx.moveTo(hx - b, m.y); ctx.lineTo(hx - b * 0.45, hy); ctx.lineTo(hx + b * 0.45, hy); ctx.lineTo(hx + b, m.y);
      ctx.closePath();
      ctx.rect(hx - b * 1.3, hy - b * 0.7, b * 3.2, b * 1.4);
      const L = h * 0.47, root = h * 0.028;
      for (let k = 0; k < 3; k++) {
        const a = m.ph + k * TAU / 3, c = Math.cos(a), sn = Math.sin(a);
        // A blade: broad at the root, swept a little to one side, to a point.
        ctx.moveTo(hx + sn * root, hy - c * root);
        ctx.quadraticCurveTo(hx + c * L * 0.3 + sn * root * 2.2, hy + sn * L * 0.3 - c * root * 2.2, hx + c * L, hy + sn * L);
        ctx.lineTo(hx - sn * root * 0.5, hy + c * root * 0.5);
        ctx.closePath();
      }
      ctx.moveTo(hx + root * 1.5, hy);
      ctx.arc(hx, hy, root * 1.5, 0, TAU);
      ctx.fill();
    }

    /** @param {Mill} m */
    function drawMill(m) {
      const { ctx } = s;
      const h = S * 0.36 * m.z, x = m.x, y = m.y, hb = h * 0.2, ht = h * 0.11, top = y - h * 0.66;
      const c = col(m.c);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x - hb, y); ctx.lineTo(x - ht, top); ctx.lineTo(x + ht, top); ctx.lineTo(x + hb, y);
      ctx.closePath();
      // The cap.
      ctx.moveTo(x - ht * 1.25, top); ctx.quadraticCurveTo(x, top - h * 0.2, x + ht * 1.25, top); ctx.closePath();
      ctx.fill();
      const hx = x, hy = top - h * 0.06, L = h * 0.58, sw = L * 0.17;
      ctx.strokeStyle = c;
      ctx.lineWidth = clamp(h * 0.012, 1, 3);
      ctx.beginPath();
      const fills = new Path2D();
      for (let k = 0; k < 4; k++) {
        const a = m.ph + k * TAU / 4, cx = Math.cos(a), cy = Math.sin(a), nx = -cy, ny = cx;
        ctx.moveTo(hx, hy); ctx.lineTo(hx + cx * L, hy + cy * L);
        // A lattice sail along the trailing side of the stock.
        const p0 = L * 0.2, p1 = L * 0.98;
        const q = (/** @type {number} */ p, /** @type {number} */ o) => /** @type {[number, number]} */ ([hx + cx * p + nx * o, hy + cy * p + ny * o]);
        const [ax, ay] = q(p0, 0), [bx, by] = q(p0, sw), [ex, ey] = q(p1, sw), [fx, fy] = q(p1, 0);
        ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.lineTo(fx, fy);
        for (let j = 1; j < 4; j++) { const [ux, uy] = q(p0 + (p1 - p0) * j / 4, 0), [vx, vy] = q(p0 + (p1 - p0) * j / 4, sw); ctx.moveTo(ux, uy); ctx.lineTo(vx, vy); }
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
        fills.moveTo(ax, ay); fills.lineTo(bx, by); fills.lineTo(ex, ey); fills.lineTo(fx, fy); fills.closePath();
      }
      ctx.stroke();
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * 0.35;
      ctx.fill(fills);
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.5, h * 0.025), 0, TAU); ctx.fill();
    }

    return {
      lay() {
        S = Math.max(Math.min(s.W, s.H), Math.min(s.W * 0.55, s.H * 0.8, 700));
        build();
      },
      step(dt) {
        for (const m of mills) m.ph = (m.ph + m.w * dt + TAU) % TAU;
        for (const c of clouds) c.x = (c.x + dt * c.v * 9 / s.W) % 1.3;
      },
      draw() {
        const { ctx, W, H } = s;
        const lift = s.dark ? 1 : 1.15;
        ctx.fillStyle = s.ink;
        ctx.globalAlpha = s.dark ? 0.09 : 0.1;
        ctx.beginPath();
        for (const c of clouds) {
          const x = (c.x - 0.15) * W, y = c.y * H, r = S * 0.07 * c.r;
          ctx.moveTo(x - r * 1.6, y + r * 0.5);
          ctx.arc(x - r * 0.8, y + r * 0.1, r * 0.55, Math.PI * 0.75, Math.PI * 1.6);
          ctx.arc(x, y - r * 0.1, r * 0.75, Math.PI * 1.1, Math.PI * 1.9);
          ctx.arc(x + r * 0.9, y + r * 0.1, r * 0.55, Math.PI * 1.4, Math.PI * 0.25);
          ctx.closePath();
        }
        ctx.fill();
        if (layout === 2) {
          // The sea in the look's blue: a warm one over the sky's blue reads violet.
          ctx.fillStyle = col(4);
          ctx.globalAlpha = 0.12 * lift;
          ctx.fillRect(0, sea, W, H - sea);
          // Swell: short dashes that sway, closer together toward the horizon.
          ctx.strokeStyle = col(1);
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.3 * lift;
          ctx.beginPath();
          for (let i = 0; i < 64; i++) {
            const d = Math.pow((i + 0.5) / 64, 1.6), y = sea + 3 + (H - sea) * d, len = 8 + d * S * 0.08;
            const x = ((jit[i] * W + Math.sin(s.t * 0.35 + i) * 14 * (0.3 + d)) % W + W) % W;
            ctx.moveTo(x - len / 2, y); ctx.lineTo(x + len / 2, y);
          }
          ctx.stroke();
        }
        let hi = 0;
        for (const m of mills) {
          // Hills draw just before the first mill nearer than them, so each mill stands on its own.
          while (hi < hills.length && layoutZ(hi) < m.z) drawHill(hills[hi++]);
          ctx.globalAlpha = (0.2 + m.z * 0.32) * lift;
          if (layout === 2) {
            const h = S * 0.42 * m.z, b = h * 0.045;
            // The yellow-painted foundation, and a wavering reflection under it.
            ctx.fillStyle = col(m.c + 1);
            ctx.fillRect(m.x - b, m.y - h * 0.06, b * 2, h * 0.08);
            ctx.globalAlpha *= 0.4;
            ctx.fillStyle = col(m.c);
            const sw = Math.sin(s.t * 0.8 + m.x) * b * 0.4;
            ctx.fillRect(m.x - b * 0.5 + sw, m.y + h * 0.04, b, h * 0.25);
            ctx.globalAlpha = (0.2 + m.z * 0.32) * lift;
          }
          if (m.mill) drawMill(m); else drawTurbine(m);
        }
        while (hi < hills.length) drawHill(hills[hi++]);
        if (layout === 0) {
          // The canal, glinting.
          const y0 = H * 0.9;
          ctx.globalAlpha = 0.12 * lift;
          ctx.fillStyle = col(3);
          ctx.fillRect(0, y0, W, H * 0.05);
          ctx.globalAlpha = 0.35 * lift;
          ctx.strokeStyle = col(3);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < 24; i++) {
            const x = jit[i] * W + Math.sin(s.t * 0.4 + i * 2) * 10, y = y0 + H * 0.05 * (0.2 + jit[(i * 3) % 64] * 0.6), len = S * (0.02 + jit[(i * 5) % 64] * 0.04);
            ctx.moveTo(x - len, y); ctx.lineTo(x + len, y);
          }
          ctx.stroke();
        }
      },
    };

    /** Nearness of hill i, matched to the rows standing on it. @param {number} i */
    function layoutZ(i) { return layout === 0 ? [0.4, 0.95][i] : [0.4, 0.7, 1.1][i]; }

    /** @param {Hill} h */
    function drawHill(h) {
      const { ctx } = s;
      ctx.globalAlpha = h.al * (s.dark ? 1 : 1.15);
      ctx.fillStyle = col(h.c);
      ctx.beginPath();
      ctx.moveTo(0, s.H);
      for (let k = 0; k < h.y.length; k++) ctx.lineTo(k * STEP, h.y[k]);
      ctx.lineTo(s.W, s.H);
      ctx.closePath();
      ctx.fill();
    }
  });
}
