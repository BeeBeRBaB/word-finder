// Low poly: a mesh of flat triangles over the screen, each face shaded by how squarely it turns to
// the light, so as the points move the facets catch it and dim. The seed picks the variant: a
// loose irregular mesh whose points drift and bob on their own slow orbits; a regular mesh rolled
// by long slow swells, like low-poly terrain, tinted by height; or a fixed cut-gem mesh with the
// light circling slowly round it, a sheen travelling over the facets.

import { stage, TAU, clamp } from './stage.js';

const LEVELS = 8;    // shading steps; faces sharing colour and step are filled as one path

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    let cell = 80, cols = 1, rows = 1, np = 0, nf = 0;
    let hx = new Float32Array(1), hy = new Float32Array(1), ph = new Float32Array(1), fq = new Float32Array(1), hz = new Float32Array(1);
    let px = new Float32Array(1), py = new Float32Array(1), pz = new Float32Array(1);
    let faces = new Int32Array(3), fcol = new Uint8Array(1);
    const p0 = rng.random() * TAU, p1 = rng.random() * TAU, swell = rng.random() * TAU;
    const lo = s.dark ? 0.05 : 0.07, hi = s.dark ? 0.36 : 0.4;
    // The terrain's height bands: up to three of the look's colours, in a run the seed picks.
    const bands = Array.from({ length: Math.min(3, nc) }, (_, i) => (i + rng.int(nc)) % nc);

    /** Builds the mesh for the current size. @returns {void} */
    function build() {
      const m = Math.min(s.W, s.H);
      cell = clamp(m * (layout === 2 ? 0.17 : 0.135), 46, layout === 2 ? 190 : 160);
      const tri = layout !== 0;           // the regular meshes are triangular lattices
      const dy = tri ? cell * 0.866 : cell;
      cols = Math.ceil(s.W / cell) + 3; rows = Math.ceil(s.H / dy) + 3;
      np = cols * rows;
      hx = new Float32Array(np); hy = new Float32Array(np); ph = new Float32Array(np); fq = new Float32Array(np); hz = new Float32Array(np);
      px = new Float32Array(np); py = new Float32Array(np); pz = new Float32Array(np);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const jx = layout === 0 ? (rng.random() - 0.5) * 0.7 : (rng.random() - 0.5) * 0.12;
          const jy = layout === 0 ? (rng.random() - 0.5) * 0.7 : (rng.random() - 0.5) * 0.12;
          hx[i] = (c - 1 + (tri && r % 2 ? 0.5 : 0) + jx) * cell;
          hy[i] = (r - 1 + jy) * dy;
          ph[i] = rng.random() * TAU; fq[i] = 0.35 + rng.random() * 0.4;
          hz[i] = (rng.random() - 0.5) * cell * 0.9;
        }
      }
      nf = (cols - 1) * (rows - 1) * 2;
      faces = new Int32Array(nf * 3); fcol = new Uint8Array(nf);
      let f = 0;
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
          // Triangular lattice: the diagonal follows the row offset; the loose mesh picks at random.
          const flip = tri ? r % 2 === 1 : rng.random() < 0.5;
          const t = flip ? [a, e, d, a, b, e] : [a, b, d, b, e, d];
          faces.set(t, f * 3);
          f += 2;
        }
      }
      // Each face keeps one colour: broad soft regions on the loose mesh, diagonal bands on the gem.
      for (let k = 0; k < nf; k++) {
        const i = faces[k * 3];
        const u = layout === 2 ? (hx[i] + hy[i]) / (s.W + s.H) * 2.2
          : (Math.sin(hx[i] / s.W * 3 + p0) + Math.sin(hy[i] / s.H * 2.5 + p1)) * 0.25 + 0.5;
        fcol[k] = clamp(Math.floor(((u % 1) + 1) % 1 * nc), 0, nc - 1);
      }
    }

    /** Moves the points to time t. @param {number} t @returns {void} */
    function move(t) {
      for (let i = 0; i < np; i++) {
        const x = hx[i], y = hy[i];
        if (layout === 0) {
          const a = ph[i] + t * fq[i] * 0.5;
          px[i] = x + Math.cos(a) * cell * 0.2;
          py[i] = y + Math.sin(a * 1.3) * cell * 0.16;
          pz[i] = hz[i] * 0.6 + Math.sin(x * 0.006 + y * 0.004 + t * 0.35) * cell * 0.45 + Math.sin(a * 0.7) * cell * 0.15;
        } else if (layout === 1) {
          px[i] = x; py[i] = y;
          pz[i] = cell * (0.75 * Math.sin(x * 0.0055 + y * 0.002 - t * 0.4 + swell)
            + 0.45 * Math.sin(y * 0.007 - x * 0.003 - t * 0.27) + hz[i] / cell * 0.35);
        } else {
          px[i] = x; py[i] = y; pz[i] = hz[i] * 1.2;
        }
      }
    }

    return {
      lay() {
        build();
        move(s.t);
        // Filling the whole screen with faces costs by the pixel, and flat faces lose little when
        // the canvas is stretched, so the backing store is held to about 1.5 million pixels.
        const k = Math.min(1, Math.sqrt(1.5e6 / (s.cv.width * s.cv.height)));
        s.cv.width = Math.round(s.W * s.dpr * k); s.cv.height = Math.round(s.H * s.dpr * k);
      },
      step() { move(s.t); },
      draw() {
        const { ctx } = s;
        ctx.setTransform(s.cv.width / s.W, 0, 0, s.cv.height / s.H, 0, 0);
        // The light: high to the upper left, or circling slowly for the gem.
        const az = layout === 2 ? s.t * 0.16 + p0 : -2.3, el = layout === 2 ? 0.75 : 0.9;
        const lx = Math.cos(az) * Math.cos(el), ly = Math.sin(az) * Math.cos(el), lz = Math.sin(el);
        /** @type {(Path2D|null)[]} */
        const fills = new Array(nc * LEVELS).fill(null);
        for (let k = 0; k < nf; k++) {
          const a = faces[k * 3], b = faces[k * 3 + 1], c = faces[k * 3 + 2];
          const ax = px[a], ay = py[a], bx = px[b], by = py[b], cx = px[c], cy = py[c];
          if (Math.max(ax, bx, cx) < 0 || Math.min(ax, bx, cx) > s.W || Math.max(ay, by, cy) < 0 || Math.min(ay, by, cy) > s.H) continue;
          const ux = bx - ax, uy = by - ay, uz = pz[b] - pz[a], vx = cx - ax, vy = cy - ay, vz = pz[c] - pz[a];
          let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
          const d = (nx * lx + ny * ly + nz * lz) / (Math.hypot(nx, ny, nz) || 1);
          // Height tints the terrain: low faces take the first colour, peaks the last.
          let col = fcol[k];
          if (layout === 1) col = bands[clamp(Math.floor(((pz[a] + pz[b] + pz[c]) / (3 * cell) * 0.6 + 0.5) * bands.length), 0, bands.length - 1)];
          // Lit faces glow on dark; on light they pale, and the faces turned away deepen.
          let lv = clamp(Math.floor(clamp((d - 0.35) / 0.65, 0, 1) ** 1.6 * LEVELS), 0, LEVELS - 1);
          if (!s.dark) lv = LEVELS - 1 - lv;
          const key = col * LEVELS + lv;
          const p = fills[key] ?? (fills[key] = new Path2D());
          p.moveTo(ax, ay); p.lineTo(bx, by); p.lineTo(cx, cy); p.closePath();
        }
        for (let key = 0; key < fills.length; key++) {
          const p = fills[key];
          if (!p) continue;
          ctx.fillStyle = s.colors[Math.floor(key / LEVELS)];
          ctx.globalAlpha = lo + (hi - lo) * ((key % LEVELS) + 0.5) / LEVELS;
          ctx.fill(p);
        }
      },
    };
  });
}
