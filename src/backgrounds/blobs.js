// Blobs: soft metaballs in the look's colours that merge where they meet and pinch apart as they
// part, each with a brighter rim. The field is summed on a coarse grid and scaled up smooth. The
// seed picks the variant: blobs wandering freely, blobs orbiting a centre that gather into one
// and spread out again, or pairs of cells that drift and divide, merging and splitting in turn.

import { stage, TAU, clamp, mix } from './stage.js';

/** @typedef {{x:number, y:number, r:number, c:number, a:number, turn:number, v:number, ph:number, f:number, ox:number, oy:number}} Ball
 * A ball at x, y of radius r (a fraction of the host's shorter side) in colour c; a, turn and v steer a wanderer; ph and f set an orbit's
 * or a pair's phase and rate; ox, oy are a pair's centre as a fraction of the host. */

const REACH = 3.2;   // radii out to which a ball adds to the field

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const rgb = s.colors.map(rgbOf);
    const off = document.createElement('canvas');
    const g = /** @type {CanvasRenderingContext2D} */ (off.getContext('2d'));
    /** @type {ImageData|null} */
    let img = null;
    /** @type {Ball[]} */
    let balls = [];
    let cell = 10, gw = 0, gh = 0, unit = 1, lastW = 0, lastH = 0;
    // Per-ball inputs to the field, in grid cells, refilled each frame.
    let bx = new Float32Array(0), by = new Float32Array(0), br = new Float32Array(0);
    let cr = new Float32Array(0), cg = new Float32Array(0), cb = new Float32Array(0);
    // The summed field and colour-weighted sums per grid cell.
    let F = new Float32Array(0), R = F, G = F, B = F;
    /** @returns {number} */
    const count = () => layout === 2 ? 2 * clamp(Math.round(s.W * s.H / 110000), 4, 8) : clamp(Math.round(s.W * s.H / 70000), 7, 14);

    /** Places a ball by the clock, for the orbit and pair variants. @param {Ball} b @param {number} i @returns {void} */
    function place(b, i) {
      if (layout === 1) {
        // Orbits whose size breathes on a shared slow beat, so all gather, then spread.
        const breathe = 0.5 + 0.5 * Math.sin(s.t * 0.09 + s.seed);
        const k = mix(0.12, 1, breathe ** 1.5) * (0.55 + 0.45 * b.ox);
        const a = b.ph + s.t * b.f;
        b.x = s.W / 2 + Math.cos(a) * s.W * 0.44 * k;
        b.y = s.H / 2 + Math.sin(a * (i % 2 ? 1 : -1)) * s.H * 0.42 * k;
      } else if (layout === 2) {
        // Each pair drifts round its home and divides: apart, together, apart along a slow axis.
        const pair = balls[i - (i % 2)];
        const cx = (pair.ox + 0.05 * Math.sin(s.t * 0.05 + pair.ph)) * s.W;
        const cy = (pair.oy + 0.05 * Math.cos(s.t * 0.04 + pair.ph * 1.3)) * s.H;
        const sep = pair.r * Math.min(s.W, s.H) * mix(0.1, 1.9, 0.5 + 0.5 * Math.sin(s.t * pair.f + pair.ph));
        const ax = pair.ph + s.t * 0.07;
        const sgn = i % 2 ? 1 : -1;
        b.x = cx + Math.cos(ax) * sep * sgn;
        b.y = cy + Math.sin(ax) * sep * sgn;
      }
    }

    /** @returns {void} */
    function build() {
      const n = count();
      balls = [];
      // Pair homes on a jittered grid so the cells cover the host.
      const cols = Math.max(2, Math.round(Math.sqrt((n / 2) * s.W / s.H))), rows = Math.ceil(n / 2 / cols);
      for (let i = 0; i < n; i++) {
        const j = Math.floor(i / 2);
        balls.push({
          x: rng.random() * s.W, y: rng.random() * s.H,
          r: (layout === 2 ? mix(0.07, 0.1, rng.random()) : mix(0.07, 0.13, rng.random())),
          c: (layout === 2 ? i >> 1 : i) % rgb.length, a: rng.random() * TAU, turn: 0, v: 0, ph: rng.random() * TAU,
          f: layout === 2 ? 0.12 + rng.random() * 0.1 : (0.05 + rng.random() * 0.06) * (rng.random() < 0.5 ? -1 : 1),
          ox: layout === 2 ? ((j % cols) + 0.5 + (rng.random() - 0.5) * 0.4) / cols : rng.random(),
          oy: layout === 2 ? (Math.floor(j / cols) + 0.5 + (rng.random() - 0.5) * 0.4) / rows : 0,
        });
      }
      // A pair is one cell dividing, so both halves share its colour.
      if (layout === 2) for (let i = 1; i < n; i += 2) balls[i].c = balls[i - 1].c;
      bx = new Float32Array(n); by = new Float32Array(n); br = new Float32Array(n);
      cr = Float32Array.from(balls, (b) => rgb[b.c][0]);
      cg = Float32Array.from(balls, (b) => rgb[b.c][1]);
      cb = Float32Array.from(balls, (b) => rgb[b.c][2]);
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        unit = clamp(m / 800, 0.6, 1.4);
        cell = clamp(m / 66, 6, 16);
        gw = Math.ceil(s.W / cell) + 1; gh = Math.ceil(s.H / cell) + 1;
        off.width = gw; off.height = gh;
        img = g.createImageData(gw, gh);
        F = new Float32Array(gw * gh); R = new Float32Array(gw * gh); G = new Float32Array(gw * gh); B = new Float32Array(gw * gh);
        // Keep the set across a resize, stretched to the new size, unless the count changes.
        if (count() !== balls.length) build();
        else for (const b of balls) { b.x *= s.W / lastW; b.y *= s.H / lastH; }
        lastW = s.W; lastH = s.H;
        if (layout) balls.forEach(place);
      },
      step(dt) {
        if (layout === 0) {
          for (const b of balls) {
            b.turn = clamp(b.turn + (rng.random() - 0.5) * 1.2 * dt, -0.35, 0.35);
            b.a += b.turn * dt;
            const v = 22 * unit;
            b.x += Math.cos(b.a) * v * dt;
            b.y += Math.sin(b.a) * v * dt;
            // Turn back softly from the edges rather than wrap, so a blob never pops.
            if (b.x < 0 && Math.cos(b.a) < 0 || b.x > s.W && Math.cos(b.a) > 0) b.a = Math.PI - b.a;
            if (b.y < 0 && Math.sin(b.a) < 0 || b.y > s.H && Math.sin(b.a) > 0) b.a = -b.a;
          }
        } else balls.forEach(place);
      },
      draw() {
        if (!img) return;
        const d = img.data, n = balls.length;
        const m = Math.min(s.W, s.H);
        for (let i = 0; i < n; i++) { bx[i] = balls[i].x / cell; by[i] = balls[i].y / cell; br[i] = (balls[i].r * m / cell) ** 2; }
        const inside = s.dark ? 0.26 : 0.3, rim = s.dark ? 0.3 : 0.32;
        F.fill(0); R.fill(0); G.fill(0); B.fill(0);
        // Each ball adds r^2/d^2 only out to REACH radii, less its value there, so it ends at zero.
        for (let i = 0; i < n; i++) {
          const rr = br[i], cut = 1 / (REACH * REACH), lim = Math.sqrt(rr) * REACH;
          const x0 = Math.max(0, Math.floor(bx[i] - lim)), x1 = Math.min(gw - 1, Math.ceil(bx[i] + lim));
          const y0 = Math.max(0, Math.floor(by[i] - lim)), y1 = Math.min(gh - 1, Math.ceil(by[i] + lim));
          for (let y = y0; y <= y1; y++) {
            const dy = y - by[i], row = y * gw;
            for (let x = x0; x <= x1; x++) {
              const dx = x - bx[i];
              const w = rr / (dx * dx + dy * dy + 0.5) - cut;
              if (w <= 0) continue;
              const k = row + x;
              F[k] += w; R[k] += cr[i] * w; G[k] += cg[i] * w; B[k] += cb[i] * w;
            }
          }
        }
        for (let k = 0, o = 3; k < F.length; k++, o += 4) {
          const f = F[k];
          if (f < 0.75) { d[o] = 0; continue; }
          // Soft threshold at 1, plus a band just inside it for the rim.
          const e = Math.min(1, (f - 0.75) * 2), edge = e * e * (3 - 2 * e);
          const q = (f - 1.3) / 0.6, band = q < 1 && q > -1 ? (1 - q * q) ** 2 : 0;
          d[o - 3] = R[k] / f; d[o - 2] = G[k] / f; d[o - 1] = B[k] / f;
          d[o] = 255 * edge * (inside + rim * band);
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
