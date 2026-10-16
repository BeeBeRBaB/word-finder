// Synthwave: a neon perspective grid rolling toward the viewer under a striped sun setting on
// the horizon, its stripes sliding slowly down. The seed picks the variant: the classic flat grid
// between two mountain ranges, wireframe hills rising either side of a flat valley as they roll
// in, or a highway with lane marks winding off along a gently curving grid.

import { stage, TAU, clamp } from './stage.js';

const NEAR = 0.7;    // depth of the nearest grid row (1 is the bottom edge)
const FAR = 13;      // depth where the grid has faded out
const DZ = 0.5;      // depth between grid rows
const DX = 0.36;     // width between grid columns
const ROLL = 0.42;   // grid rows a second

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const col = (/** @type {number} */ i) => s.colors[i % s.colors.length];
    let hz = 0, F = 1, vx = 0, sunX = 0, sunY = 0, sunR = 1, curve = 0;
    let sun = document.createElement('canvas');
    const halo = glow(col(3));
    /** @type {{x:number, y:number, r:number, ph:number}[]} */
    let stars = [];
    /** @type {number[][]} */
    let ranges = [];
    // Phases for the hills, from the seed.
    const ph = Array.from({ length: 4 }, () => rng.random() * TAU);
    const side = rng.random() < 0.5 ? -1 : 1;

    /** Ground height at lateral X on world row w (hills variant only). @param {number} X @param {number} w @returns {number} */
    function height(X, w) {
      if (layout !== 1) return 0;
      const a = Math.abs(X) - 1.1;
      if (a <= 0) return 0;
      const n = 0.6 + 0.28 * Math.sin(w * 0.33 + X * 0.9 + ph[0]) + 0.12 * Math.sin(w * 0.8 - X * 1.7 + ph[1]);
      return Math.min(2.4, a * a * 0.4 + a * 0.15) * n;
    }

    /** Screen point for ground X at depth z on world row w. @param {number} X @param {number} z @param {number} w @returns {[number, number]} */
    function project(X, z, w) {
      const k = F / z;
      return [vx + (X + curve * z * z) * k, hz + (1 - height(X, w)) * k];
    }

    /** A row's alpha by depth: full near, gone by FAR. @param {number} z @returns {number} */
    const fade = (z) => clamp(1 - (z - 1.5) / (FAR - 1.5), 0, 1) ** 2.4;

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        hz = Math.round(s.H * (layout === 1 ? 0.5 : 0.55));
        F = s.H - hz;
        vx = s.W / 2;
        sunR = clamp(m * (layout === 1 ? 0.3 : 0.25), 60, 300);
        sunX = layout === 2 ? s.W / 2 + side * Math.min(s.W * 0.2, sunR * 1.2) : s.W / 2;
        sunY = hz - sunR * (layout === 1 ? 0.35 : 0.5);
        sun = disc(col(1), col(3), Math.ceil(sunR * 2 * s.dpr));
        stars = Array.from({ length: clamp(Math.round(s.W * hz / 9000), 25, 120) }, () => ({
          x: rng.random() * s.W, y: rng.random() * (hz - 12), r: 0.6 + rng.random() * 1.1, ph: rng.random() * TAU }));
        ranges = [];
        if (layout === 0) {
          // Two ranges, left and right of the sun, each a jagged run of peaks.
          for (const [x0, x1] of [[-20, s.W / 2 - sunR * 1.1], [s.W / 2 + sunR * 1.1, s.W + 20]]) {
            const pts = [x0, hz];
            const n = Math.max(3, Math.round((x1 - x0) / clamp(m * 0.08, 30, 80)));
            for (let i = 1; i < n; i++) {
              const u = i / n, edge = Math.sin(u * Math.PI) ** 0.6;
              pts.push(x0 + (x1 - x0) * u, hz - edge * (0.3 + 0.7 * rng.random()) * clamp(m * 0.13, 30, 120));
            }
            pts.push(x1, hz);
            ranges.push(pts);
          }
        }
      },
      step() {},
      draw() {
        const { ctx } = s;
        const t = s.t, dark = s.dark;
        if (layout === 2) {
          // The road winds: the vanishing point drifts and the far grid bends with it.
          curve = 0.012 * Math.sin(t * 0.09 + ph[2]);
          vx = s.W / 2 + Math.sin(t * 0.07 + ph[3]) * s.W * 0.06;
        }

        // Stars, twinkling slowly.
        ctx.fillStyle = dark ? col(5) : s.ink;
        for (const p of stars) {
          ctx.globalAlpha = (dark ? 0.25 : 0.14) + (dark ? 0.35 : 0.14) * (0.5 + 0.5 * Math.sin(t * 0.6 + p.ph));
          ctx.fillRect(p.x, p.y, p.r * 1.6, p.r * 1.6);
        }

        // The sun's halo, then the sun in horizontal slices: solid above, banded below, the bands
        // widening toward the horizon and sliding down.
        if (dark) ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = dark ? 0.3 : 0.22;
        // Cut off at the horizon.
        const hr = sunR * 2.1, hh = Math.min(hr * 2, hz - (sunY - hr));
        ctx.drawImage(halo, 0, 0, halo.width, halo.height * hh / (hr * 2), sunX - hr, sunY - hr, hr * 2, hh);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = dark ? 0.5 : 0.46;
        const top = sunY - sunR, bot = Math.min(sunY + sunR, hz), zone = sunY - sunR * 0.15;
        const sc = sun.width / (sunR * 2), n = 7, phase = (t * 0.07) % 1;
        let y = top;
        for (let k = -1; k <= n; k++) {
          const u = (k + phase) / n;
          if (u < 0) continue;
          const gy = zone + u * (bot - zone), gh = (0.12 + 0.88 * u) * sunR * 0.09;
          const y1 = Math.min(bot, gy - gh / 2);
          if (y1 > y) ctx.drawImage(sun, 0, (y - top) * sc, sun.width, (y1 - y) * sc, sunX - sunR, y, sunR * 2, y1 - y);
          y = Math.max(y, gy + gh / 2);
          if (y >= bot) break;
        }
        if (y < bot) ctx.drawImage(sun, 0, (y - top) * sc, sun.width, (bot - y) * sc, sunX - sunR, y, sunR * 2, bot - y);

        // Mountain ranges on the horizon.
        for (const pts of ranges) {
          ctx.beginPath();
          ctx.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
          ctx.globalAlpha = dark ? 0.16 : 0.18;
          ctx.fillStyle = col(4);
          ctx.fill();
          ctx.globalAlpha = dark ? 0.5 : 0.55;
          ctx.strokeStyle = col(4);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // The grid: rows across at even depths rolling nearer, and columns run as segments
        // between rows, each band of depth stroked at its own fade.
        const roll = t * ROLL, whole = Math.floor(roll), frac = roll - whole;
        const lw = clamp(Math.min(s.W, s.H) / 400, 1.5, 2.5);
        ctx.lineCap = 'round';
        if (dark) ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = col(2);
        const rows = Math.ceil((FAR - NEAR) / DZ) + 1;
        /** @type {number[]} */
        const zs = [];
        for (let k = 0; k <= rows; k++) zs.push(NEAR + (k + 1 - frac) * DZ);
        for (let k = 0; k < rows; k++) {
          const z = zs[k], z2 = zs[k + 1], w = whole + k, a = fade(z);
          if (a <= 0.01) continue;
          // Columns across what this band can see, with margin for the curve and the hills.
          const span = (s.W / F) * z2 * 0.5 + 6 + Math.abs(curve) * z2 * z2;
          const c0 = Math.floor((-span - curve * z * z) / DX), c1 = Math.ceil((span - curve * z * z) / DX);
          ctx.beginPath();
          let [px, py] = project(c0 * DX, z, w);
          ctx.moveTo(px, py);
          for (let c = c0 + 1; c <= c1; c++) { [px, py] = project(c * DX, z, w); ctx.lineTo(px, py); }
          for (let c = c0; c <= c1; c++) {
            const X = c * DX;
            if (layout === 2 && Math.abs(X) < 0.5) continue;
            [px, py] = project(X, z, w);
            ctx.moveTo(px, py);
            [px, py] = project(X, z2, w + 1);
            ctx.lineTo(px, py);
          }
          for (let pass = dark ? 0 : 1; pass < 2; pass++) {
            // In the dark, a wide faint stroke under the line for a neon glow.
            ctx.lineWidth = pass ? lw : lw * 4;
            ctx.globalAlpha = a * (pass ? (dark ? 0.55 : 0.5) : 0.12);
            ctx.stroke();
          }
          if (layout === 2) {
            // The road: bright edges, and a dash on every other row down the middle.
            ctx.beginPath();
            for (const X of [-0.7, 0.7]) {
              [px, py] = project(X, z, w); ctx.moveTo(px, py);
              [px, py] = project(X, z2, w + 1); ctx.lineTo(px, py);
            }
            if (w % 2 === 0) {
              [px, py] = project(0, z, w); ctx.moveTo(px, py);
              [px, py] = project(0, z + DZ * 0.55, w); ctx.lineTo(px, py);
            }
            ctx.strokeStyle = col(1);
            ctx.lineWidth = lw * 1.3;
            ctx.globalAlpha = a * (dark ? 0.7 : 0.62);
            ctx.stroke();
            ctx.strokeStyle = col(2);
          }
        }

        // The horizon line.
        ctx.globalAlpha = dark ? 0.6 : 0.5;
        ctx.strokeStyle = col(3);
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(0, hz);
        ctx.lineTo(s.W, hz);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  });
}

/** The sun: a disc shading from `top` to `bottom`, as a sprite. @param {string} top @param {string} bottom @param {number} n @returns {HTMLCanvasElement} */
function disc(top, bottom, n) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(8, n);
  const g = c.getContext('2d');
  if (!g) return c;
  n = c.width;
  const grad = g.createLinearGradient(0, 0, 0, n);
  grad.addColorStop(0.1, top);
  grad.addColorStop(0.9, bottom);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(n / 2, n / 2, n / 2, 0, TAU);
  g.fill();
  return c;
}

/** A soft round glow as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function glow(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.3, 'rgba(0,0,0,.8)');
  grad.addColorStop(0.55, 'rgba(0,0,0,.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}
