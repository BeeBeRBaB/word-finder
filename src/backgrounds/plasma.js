// Plasma: a soft field of sines in the look's colours, worked out on a coarse grid and scaled up
// smooth, its bands drifting slowly and the palette creeping round. The seed picks the variant:
// classic plasma (sines across, down, diagonal and round a wandering centre), interference rings
// spreading from three drifting sources, or marbling, where the bands are swirled into veins.

import { stage, TAU, clamp } from './stage.js';

const LUT = 256;   // palette entries

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { layout } = s;
    const off = document.createElement('canvas');
    const g = /** @type {CanvasRenderingContext2D} */ (off.getContext('2d'));
    /** @type {ImageData|null} */
    let img = null;
    let cell = 20, gw = 0, gh = 0;
    // Phases from the seed, so two seeds of one variant differ.
    const ph = Array.from({ length: 8 }, () => s.rng.random() * TAU);

    // A cyclic palette through the look's colours: each colour full at its stop, blending to the
    // next, a little fainter between stops so the bands read.
    const rgb = s.colors.map(rgbOf);
    const A = s.dark ? 0.3 : 0.34;
    const pr = new Uint8ClampedArray(LUT), pg = new Uint8ClampedArray(LUT), pb = new Uint8ClampedArray(LUT), pa = new Uint8ClampedArray(LUT);
    for (let j = 0; j < LUT; j++) {
      const u = j / LUT * rgb.length, i = Math.floor(u), f = u - i;
      const a = rgb[i], b = rgb[(i + 1) % rgb.length], e = f * f * (3 - 2 * f);
      pr[j] = a[0] + (b[0] - a[0]) * e; pg[j] = a[1] + (b[1] - a[1]) * e; pb[j] = a[2] + (b[2] - a[2]) * e;
      pa[j] = 255 * A * (0.72 + 0.28 * Math.cos(f * TAU));
    }

    /** The field at grid point x, y (in units of the shorter side), for time t; any real value,
     * read modulo 1 into the palette. @param {number} x @param {number} y @param {number} t @returns {number} */
    function field(x, y, t) {
      if (layout === 1) {
        // Rings from three sources that wander slowly over the host.
        let v = 0;
        for (let k = 0; k < 3; k++) {
          const sx = (0.5 + 0.4 * Math.sin(t * 0.031 + ph[k])) * aspect;
          const sy = 0.5 + 0.4 * Math.cos(t * 0.027 + ph[k + 3]);
          v += Math.sin(Math.hypot(x - sx, y - sy) * 15 - t * 0.35);
        }
        return v * 0.12 + t * 0.012;
      }
      if (layout === 2) {
        // Marbling: one set of bands, its phase warped by two slower swirls.
        const w = 2.2 * Math.sin(y * 4.1 + t * 0.09 + ph[0]) + 1.4 * Math.sin((x - y) * 3.3 - t * 0.07 + ph[1]);
        return Math.sin(x * 5.2 + w + ph[2]) * 0.22 + w * 0.06 + t * 0.01;
      }
      const cx = aspect * (0.5 + 0.35 * Math.sin(t * 0.05 + ph[0])), cy = 0.5 + 0.35 * Math.cos(t * 0.04 + ph[1]);
      const v = Math.sin(x * 5.5 + t * 0.19 + ph[2]) + Math.sin(y * 6.5 - t * 0.15 + ph[3])
        + Math.sin((x + y) * 4 + t * 0.12 + ph[4]) + Math.sin(Math.hypot(x - cx, y - cy) * 9 - t * 0.22);
      return v * 0.15 + t * 0.01;
    }
    let aspect = 1;

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        aspect = s.W / m;
        cell = clamp(m / 40, 10, 28);
        gw = Math.ceil(s.W / cell) + 1; gh = Math.ceil(s.H / cell) + 1;
        off.width = gw; off.height = gh;
        img = g.createImageData(gw, gh);
      },
      step() {},
      draw() {
        if (!img) return;
        const d = img.data, m = Math.min(s.W, s.H), t = s.t;
        let o = 0;
        for (let y = 0; y < gh; y++) {
          const Y = y * cell / m;
          for (let x = 0; x < gw; x++, o += 4) {
            const v = field(x * cell / m, Y, t);
            const j = Math.floor((v - Math.floor(v)) * LUT) & (LUT - 1);
            d[o] = pr[j]; d[o + 1] = pg[j]; d[o + 2] = pb[j]; d[o + 3] = pa[j];
          }
        }
        g.putImageData(img, 0, 0);
        const { ctx } = s;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(off, 0, 0, gw * cell, gh * cell);
      },
    };
  });
}

/** Any CSS colour as [r, g, b], via a canvas's own parser. @param {string} color @returns {number[]} */
function rgbOf(color) {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return [128, 128, 128];
  g.fillStyle = '#888';
  g.fillStyle = color;
  const v = String(g.fillStyle);
  if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = v.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
