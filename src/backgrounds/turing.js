// Turing patterns: Gray-Scott reaction-diffusion on a coarse grid, scaled up smooth, so spots and
// stripes grow, split and morph in the look's colours. The seed picks the variant: dividing spots
// whose kill rate drifts in slow waves, so patches die back and regrow; a labyrinth of stripes whose
// feed rate sweeps slowly between mazes and spots; or a parameter map, spots in one corner, stripes
// and worms in another, the map itself drifting so the textures morph into each other.

import { stage, TAU, clamp } from './stage.js';

const LUT = 256;
const ITERS = 6;     // reaction steps per frame: growth speed
const WARM = 900;    // steps run before the first paint, so it opens patterned
const MAX_CELLS = 16000;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { layout, rng } = s;
    const off = document.createElement('canvas');
    const g = /** @type {CanvasRenderingContext2D} */ (off.getContext('2d'));
    /** @type {ImageData|null} */
    let img = null;
    let cell = 8, gw = 0, gh = 0;
    let U = new Float32Array(0), V = new Float32Array(0), U2 = U, V2 = V;
    /** Per-cell feed and kill rates, refreshed a few times a second. */
    let F = U, K = U;
    let seedClock = 0, rateClock = 0, warmed = false;
    const ph = Array.from({ length: 6 }, () => rng.random() * TAU);

    // Palette over V: clear below the threshold, the first colour at a pattern's rim, the second
    // in its core.
    const rgb = s.colors.map(rgbOf);
    const c0 = rgb[0], c1 = rgb[1 % rgb.length], c2 = rgb[2 % rgb.length];
    const A = s.dark ? 0.46 : 0.42;
    const pr = new Uint8ClampedArray(LUT), pg = new Uint8ClampedArray(LUT), pb = new Uint8ClampedArray(LUT), pa = new Uint8ClampedArray(LUT);
    for (let j = 0; j < LUT; j++) {
      const v = j / LUT * 0.5;
      const e = clamp((v - 0.08) / 0.22, 0, 1), a = e * e * (3 - 2 * e);
      const u = clamp((v - 0.18) / 0.16, 0, 1);
      const lo = u < 0.5 ? c0 : c1, hi = u < 0.5 ? c1 : c2, f = u < 0.5 ? u * 2 : u * 2 - 1;
      pr[j] = lo[0] + (hi[0] - lo[0]) * f; pg[j] = lo[1] + (hi[1] - lo[1]) * f; pb[j] = lo[2] + (hi[2] - lo[2]) * f;
      pa[j] = 255 * A * a;
    }

    /** Feed and kill rates for every cell at time t. @param {number} t @returns {void} */
    function rates(t) {
      for (let y = 0; y < gh; y++) {
        const Y = y / gh;
        for (let x = 0; x < gw; x++) {
          const X = x / gw, i = y * gw + x;
          if (layout === 0) {
            // Mitosis, with a kill rate that swells past the spots' limit in slow travelling waves.
            F[i] = 0.0367;
            K[i] = 0.0641 + 0.0026 * Math.sin(X * 5.1 + Y * 2.3 - t * 0.045 + ph[0]) * Math.sin(Y * 4.3 - X * 1.7 + t * 0.031 + ph[1]);
          } else if (layout === 1) {
            // Labyrinth to spots and back: the feed rate sweeps on a minute-long cycle, offset across the host.
            F[i] = 0.033 + 0.007 * Math.sin(t * 0.09 + X * 1.6 + Y * 1.1 + ph[2]);
            K[i] = 0.0585 + 0.001 * Math.sin(t * 0.05 + ph[3] + X * 2);
          } else {
            // Pearson's map: feed across, kill down, the map sliding slowly diagonally.
            const a = (X + 0.18 * Math.sin(t * 0.021 + ph[4]) + 1) % 1, b = (Y + 0.18 * Math.cos(t * 0.017 + ph[5]) + 1) % 1;
            const ta = Math.abs(a * 2 - 1), tb = Math.abs(b * 2 - 1);
            F[i] = 0.024 + 0.032 * ta;
            // Kill rises with feed too, keeping clear of the corner where V floods the whole map.
            K[i] = 0.0595 + 0.0055 * tb + (F[i] - 0.024) * 0.06;
          }
        }
      }
    }

    /** A small square of V at a random place, to nucleate a pattern. @param {number} r @returns {void} */
    function seedAt(r) {
      const cx = rng.int(gw), cy = rng.int(gh);
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          const i = ((cy + y + gh) % gh) * gw + (cx + x + gw) % gw;
          U[i] = 0.5; V[i] = 0.25 + rng.random() * 0.05;
        }
      }
    }

    /** Advances the reaction n steps; wraps at the edges. Diffusion 0.8 and 0.4 on the five-point
     * stencil: at 1 the checkerboard mode is only marginally stable and runs away. @param {number} n @returns {void} */
    function react(n) {
      for (let it = 0; it < n; it++) {
        for (let y = 0; y < gh; y++) {
          const row = y * gw, up = ((y + gh - 1) % gh) * gw, dn = ((y + 1) % gh) * gw;
          for (let x = 0; x < gw; x++) {
            const i = row + x, l = x ? i - 1 : row + gw - 1, r = x < gw - 1 ? i + 1 : row;
            const u = U[i], v = V[i];
            const lu = (U[l] + U[r] + U[up + x] + U[dn + x]) * 0.25 - u;
            const lv = (V[l] + V[r] + V[up + x] + V[dn + x]) * 0.25 - v;
            const uvv = u * v * v;
            U2[i] = u + 0.8 * lu - uvv + F[i] * (1 - u);
            V2[i] = v + 0.4 * lv + uvv - (F[i] + K[i]) * v;
          }
        }
        let t = U; U = U2; U2 = t;
        t = V; V = V2; V2 = t;
      }
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        cell = clamp(m / 100, 4, 10);
        while ((s.W / cell + 1) * (s.H / cell + 1) > MAX_CELLS) cell += 0.5;
        const nw = Math.ceil(s.W / cell) + 1, nh = Math.ceil(s.H / cell) + 1;
        const oU = U, oV = V, ow = gw, oh = gh;
        gw = nw; gh = nh;
        const n = gw * gh;
        U = new Float32Array(n).fill(1); V = new Float32Array(n);
        U2 = new Float32Array(n); V2 = new Float32Array(n);
        F = new Float32Array(n); K = new Float32Array(n);
        if (ow) {
          // Keep the pattern: resample the old grid by nearest cell.
          for (let y = 0; y < gh; y++) {
            for (let x = 0; x < gw; x++) {
              const j = Math.min(oh - 1, Math.floor(y * oh / gh)) * ow + Math.min(ow - 1, Math.floor(x * ow / gw));
              U[y * gw + x] = oU[j]; V[y * gw + x] = oV[j];
            }
          }
        }
        off.width = gw; off.height = gh;
        img = g.createImageData(gw, gh);
        rates(s.t);
        if (!warmed) {
          warmed = true;
          const k = clamp(Math.round(n / (layout === 1 ? 70 : 260)), 12, 240);
          for (let i = 0; i < k; i++) seedAt(2 + rng.int(2));
          react(WARM);
        }
      },
      step(dt) {
        rateClock += dt; seedClock += dt;
        if (rateClock > 0.5) { rateClock = 0; rates(s.t); }
        // A fresh nucleus now and then, so a patch that died out regrows.
        if (seedClock > 6) { seedClock = 0; seedAt(2); }
        react(ITERS);
      },
      draw() {
        if (!img) return;
        const d = img.data, n = gw * gh;
        for (let i = 0, o = 0; i < n; i++, o += 4) {
          const j = Math.min(LUT - 1, Math.max(0, (V[i] * 2 * LUT) | 0));
          d[o] = pr[j]; d[o + 1] = pg[j]; d[o + 2] = pb[j]; d[o + 3] = pa[j];
        }
        g.putImageData(img, 0, 0);
        const { ctx } = s;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'low';
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
