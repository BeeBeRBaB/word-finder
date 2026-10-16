// Interference: ripples spread from slowly moving sources and add up, crest on crest bright and
// crest on trough cancelling, so still lines of calm fan out between the sources and swing as
// they move. Worked out on a coarse grid and scaled up. The seed picks the variant: two sources
// drifting apart and together, three at the corners of a slowly turning triangle, or straight
// waves rolling across the host past one wandering source.

import { stage, TAU, clamp } from './stage.js';

const PERIOD = 3.4;  // seconds a crest takes to pass: any point lightens and darkens this slowly
const N = 1024;      // cosine table size

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const cos = new Float32Array(N);
    for (let i = 0; i < N; i++) cos[i] = Math.cos(i / N * TAU);
    const lut = palette();
    const field = document.createElement('canvas');
    const fg = field.getContext('2d');
    /** @type {ImageData|null} */
    let img = null;
    /** @type {Uint32Array} */
    let px = new Uint32Array(0);
    let gw = 0, gh = 0, cell = 1, lambda = 1;
    const ph = [rng.random() * TAU, rng.random() * TAU, rng.random() * TAU];
    const src = [[0, 0], [0, 0], [0, 0]];
    const n = layout === 1 ? 3 : layout === 0 ? 2 : 1;
    const plane = rng.random() * TAU;

    /**
     * 256 colours by signed height: troughs in the second colour, crests in the first, and the
     * calm middle clear. Two stops at the middle keep the fade from passing through black.
     * @returns {Uint32Array}
     */
    function palette() {
      const out = new Uint32Array(256);
      const c = document.createElement('canvas');
      c.width = 256; c.height = 1;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!g) return out;
      const A = s.dark ? 0.36 : 0.44, a = s.colors[0], b = s.colors[1 % s.colors.length];
      const grad = g.createLinearGradient(0, 0, 256, 0);
      grad.addColorStop(0, b); grad.addColorStop(0.5, b); grad.addColorStop(0.5, a); grad.addColorStop(1, a);
      g.fillStyle = grad; g.fillRect(0, 0, 256, 1);
      const d = g.getImageData(0, 0, 256, 1).data;
      for (let i = 0; i < 256; i++) {
        const v = Math.abs(i / 255 * 2 - 1), al = Math.round(255 * A * Math.pow(v, 1.3));
        out[i] = (al << 24 | d[i * 4 + 2] << 16 | d[i * 4 + 1] << 8 | d[i * 4]) >>> 0;
      }
      return out;
    }

    /** Moves the sources to where they are at time t, in grid cells. @param {number} t @returns {void} */
    function move(t) {
      const cx = gw / 2, cy = gh / 2;
      if (layout === 0) {
        // Apart and together on slow figures, never meeting.
        const a = t * 0.05 + ph[0], r = 0.2 + 0.1 * Math.sin(t * 0.07 + ph[1]);
        const ox = Math.sin(t * 0.031 + ph[2]) * gw * 0.12, oy = Math.cos(t * 0.027) * gh * 0.1;
        src[0][0] = cx + ox + Math.cos(a) * r * gw; src[0][1] = cy + oy + Math.sin(a) * r * gh;
        src[1][0] = cx + ox - Math.cos(a) * r * gw; src[1][1] = cy + oy - Math.sin(a) * r * gh;
      } else if (layout === 1) {
        // The triangle stretched to the host's shape, so a tall one spreads its sources too.
        const a = t * 0.04 + ph[0], r = 0.3 + 0.06 * Math.sin(t * 0.06 + ph[1]);
        for (let k = 0; k < 3; k++) {
          src[k][0] = cx + Math.cos(a + k * TAU / 3) * r * gw;
          src[k][1] = cy + Math.sin(a + k * TAU / 3) * r * gh;
        }
      } else {
        src[0][0] = cx + Math.sin(t * 0.043 + ph[0]) * gw * 0.32; src[0][1] = cy + Math.sin(t * 0.061 + ph[1]) * gh * 0.3;
      }
    }

    return {
      lay() {
        cell = clamp(Math.sqrt(s.W * s.H / 11000), 6, 14);
        gw = Math.ceil(s.W / cell); gh = Math.ceil(s.H / cell);
        field.width = gw; field.height = gh;
        img = fg ? fg.createImageData(gw, gh) : null;
        px = img ? new Uint32Array(img.data.buffer) : new Uint32Array(0);
        // About a sixth of the shorter side from crest to crest, at least five cells.
        lambda = Math.max(5, Math.min(gw, gh) / 6.5);
      },
      step() {},
      draw() {
        if (!img || !fg) return;
        const t = s.t;
        move(t);
        const k = N / lambda, w = Math.round(t / PERIOD * N);
        const fall = Math.min(gw, gh) * 0.6, inv = 1 / (n + (layout === 2 ? 0.8 : 0));
        const pc = Math.cos(plane) * k, ps = Math.sin(plane) * k;
        let i = 0;
        for (let y = 0; y < gh; y++) {
          for (let x = 0; x < gw; x++) {
            let v = 0;
            for (let q = 0; q < n; q++) {
              const dx = x - src[q][0], dy = y - src[q][1], d = Math.sqrt(dx * dx + dy * dy);
              // Each ripple fades a little with distance, so the sources stay the brightest.
              v += cos[((d * k - w) | 0) & (N - 1)] * fall / (fall + d * 0.6);
            }
            if (layout === 2) v += cos[((x * pc + y * ps - w) | 0) & (N - 1)] * 0.8;
            const u = clamp(v * inv, -1, 1);
            px[i++] = lut[((u + 1) * 127.5) | 0];
          }
        }
        fg.putImageData(img, 0, 0);
        const { ctx } = s;
        ctx.globalAlpha = 1;
        ctx.drawImage(field, 0, 0, gw * cell, gh * cell);
        // A small ring at each source.
        ctx.globalAlpha = s.dark ? 0.45 : 0.5; ctx.strokeStyle = s.ink; ctx.lineWidth = 2;
        for (let q = 0; q < n; q++) {
          ctx.beginPath(); ctx.arc(src[q][0] * cell, src[q][1] * cell, clamp(cell * 0.9, 6, 10), 0, TAU); ctx.stroke();
        }
      },
    };
  });
}
