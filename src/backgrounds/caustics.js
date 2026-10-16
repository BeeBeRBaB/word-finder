// Caustics: the wavering net of light that sunlight through rippled water throws on a pool floor,
// worked out on a coarse grid and scaled up soft. Each net is three crossing waves whose phases
// drift apart, so its cells swell, pinch and re-form, all bent by slow ripples. The seed picks the
// floor: a tiled pool with its grout lines wavering too, a pool lane with its painted stripes, or
// sandy shallows where the net is larger and slides along with the current under a drifting glare.

import { stage, TAU, clamp } from './stage.js';

const LUT = 256;
const WAVES = 6;   // two nets of three

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout, colors } = s;
    const off = document.createElement('canvas');
    const g = /** @type {CanvasRenderingContext2D} */ (off.getContext('2d'));
    /** @type {ImageData|null} */
    let img = null;
    let cell = 6, gw = 0, gh = 0;
    /** @type {Uint32Array} */
    let px = new Uint32Array(0);

    // Two nets, each three waves 120 degrees apart; the second finer and turned a little.
    const scale = layout === 2 ? 1.35 : 1;
    const turn0 = rng.random() * TAU, turn1 = turn0 + 0.5 + rng.random() * 0.6;
    /** wave vectors, phase speeds and phases, per wave @type {number[]} */
    const kx = [];
    /** @type {number[]} */ const ky = [];
    /** @type {number[]} */ const om = [];
    /** @type {number[]} */ const ph = [];
    for (let j = 0; j < WAVES; j++) {
      const net = j < 3 ? 0 : 1;
      const k = (net ? 50 : 34) / scale;
      const a = (net ? turn1 : turn0) + (j % 3) * TAU / 3 + (rng.random() - 0.5) * 0.15;
      kx.push(Math.cos(a) * k); ky.push(Math.sin(a) * k);
      om.push((0.22 + rng.random() * 0.25) * (rng.random() < 0.5 ? -1 : 1));
      ph.push(rng.random() * TAU);
    }
    const wph = Array.from({ length: 4 }, () => rng.random() * TAU);

    // Per column and per row tables, refilled each frame: the phase of each wave split into an x
    // part and a y part, so a pixel's cosine is cos(a + b) from four looked-up numbers.
    /** @type {Float32Array[]} */
    let cA = [];
    /** @type {Float32Array[]} */ let sA = [];
    /** @type {Float32Array[]} */ let cB = [];
    /** @type {Float32Array[]} */ let sB = [];
    let ux = new Float32Array(0), vy = new Float32Array(0), wxRow = new Float32Array(0), wyCol = new Float32Array(0);
    // Floor markings and glare, separable too: mark = max(rowA * colA, rowB * colB), glare = col * row.
    let mRA = new Float32Array(0), mRB = new Float32Array(0), mCA = new Float32Array(0), mCB = new Float32Array(0);
    let gR = new Float32Array(0), gC = new Float32Array(0);

    // Light ramp: from the second colour, faint, to the first colour, bright, at the net's cores.
    const lo = rgbOf(colors[1 % colors.length]), hi = rgbOf(colors[0]), mk = rgbOf(colors[2 % colors.length]);
    const A = s.dark ? 0.4 : 0.48;
    const pr = new Uint8ClampedArray(LUT), pg = new Uint8ClampedArray(LUT), pb = new Uint8ClampedArray(LUT), pa = new Uint8ClampedArray(LUT);
    const lut = new Uint32Array(LUT);
    for (let i = 0; i < LUT; i++) {
      const u = i / (LUT - 1), e = u * u * (3 - 2 * u);
      pr[i] = lo[0] + (hi[0] - lo[0]) * e; pg[i] = lo[1] + (hi[1] - lo[1]) * e; pb[i] = lo[2] + (hi[2] - lo[2]) * e;
      pa[i] = 255 * (0.03 + A * Math.pow(u, 1.15));
      // ImageData bytes are r, g, b, a; as a little-endian word that is a<<24 | b<<16 | g<<8 | r.
      lut[i] = ((pa[i] << 24) | (pb[i] << 16) | (pg[i] << 8) | pr[i]) >>> 0;
    }
    const markA = 255 * (s.dark ? 0.1 : 0.13) * (layout === 1 ? 1.2 : 1);
    // A wave sum (-1.5..3) to how bright its ridge is: a soft line along the level near zero.
    const RID = 512;
    const ridge = new Float32Array(RID);
    for (let i = 0; i < RID; i++) {
      const f = -1.5 + 4.5 * i / (RID - 1);
      const q = (f - 0.15) / 0.5;
      ridge[i] = Math.exp(-q * q);
    }

    /** Fills the marking and glare tables for this frame. @param {number} m @param {number} t */
    function floor(m, t) {
      mRA.fill(0); mRB.fill(0); mCA.fill(0); mCB.fill(0);
      if (layout === 0) {
        // Tiles: grout where either warped coordinate nears a multiple of the tile size.
        const tile = 0.085;
        /** @param {number} v */
        const grout = (v) => { const f = v / tile - Math.floor(v / tile); return Math.max(0, 1 - Math.min(f, 1 - f) * 14); };
        for (let y = 0; y < gh; y++) { mRA[y] = grout(vy[y] + wxRow[y] * 0.5); mRB[y] = 1; }
        for (let x = 0; x < gw; x++) { mCA[x] = 1; mCB[x] = grout(ux[x] + wyCol[x] * 0.5); }
      } else if (layout === 1) {
        // A lane: two painted stripes along the long side, each ending in a cross bar.
        const long = s.W >= s.H, span = (long ? s.H : s.W) / m, len = (long ? s.W : s.H) / m;
        const nA = long ? gh : gw, nB = long ? gw : gh;
        const stripe = long ? mRA : mCA, near = long ? mRB : mCB, keep = long ? mCA : mRA, bar = long ? mCB : mRB;
        for (let i = 0; i < nA; i++) {
          const v = long ? vy[i] + wxRow[i] * 0.5 : ux[i] + wyCol[i] * 0.5;
          for (const c of [0.28, 0.72]) {
            const dd = Math.abs(v - c * span);
            stripe[i] = Math.max(stripe[i], clamp((0.035 - dd) * 90, 0, 1));
            if (dd < 0.11) near[i] = 1;
          }
        }
        for (let i = 0; i < nB; i++) {
          const v = long ? ux[i] + wyCol[i] * 0.5 : vy[i] + wxRow[i] * 0.5;
          keep[i] = v < len * 0.88 ? 1 : 0;
          bar[i] = clamp((0.025 - Math.abs(v - len * 0.88)) * 120, 0, 1);
        }
      } else {
        // Shallows: a broad soft glare drifting across.
        const gx = (0.5 + 0.35 * Math.sin(t * 0.05 + wph[0])) * s.W / m, gy = 0.5 + 0.3 * Math.cos(t * 0.04 + wph[1]);
        for (let x = 0; x < gw; x++) gC[x] = Math.exp(-((ux[x] - gx) ** 2) * 3);
        for (let y = 0; y < gh; y++) gR[y] = Math.exp(-((vy[y] - gy) ** 2) * 3);
      }
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        cell = clamp(m / 115, 5, 8.5);
        gw = Math.ceil(s.W / cell) + 1; gh = Math.ceil(s.H / cell) + 1;
        off.width = gw; off.height = gh;
        img = g.createImageData(gw, gh);
        px = new Uint32Array(img.data.buffer);
        /** @param {number} n */
        const mkT = (n) => Array.from({ length: WAVES }, () => new Float32Array(n));
        cA = mkT(gw); sA = mkT(gw); cB = mkT(gh); sB = mkT(gh);
        ux = new Float32Array(gw); vy = new Float32Array(gh); wxRow = new Float32Array(gh); wyCol = new Float32Array(gw);
        mRA = new Float32Array(gh); mRB = new Float32Array(gh); mCA = new Float32Array(gw); mCB = new Float32Array(gw);
        gR = new Float32Array(gh); gC = new Float32Array(gw);
      },
      step() {},
      draw() {
        if (!img) return;
        const m = Math.min(s.W, s.H), t = s.t, k = cell / m;
        // Ripples bend the net: a sideways shift that varies down the host and one across it.
        // In the shallows the whole net also slides with the current.
        const drift = layout === 2 ? t * 0.012 : 0;
        for (let y = 0; y < gh; y++) {
          const Y = y * k;
          vy[y] = Y;
          wxRow[y] = 0.022 * Math.sin(Y * 7.1 + t * 0.31 + wph[0]) + 0.012 * Math.sin(Y * 13.3 - t * 0.43 + wph[1]) - drift;
        }
        for (let x = 0; x < gw; x++) {
          const X = x * k;
          ux[x] = X;
          wyCol[x] = 0.022 * Math.sin(X * 6.3 - t * 0.27 + wph[2]) + 0.012 * Math.sin(X * 11.7 + t * 0.39 + wph[3]) - drift * 0.4;
        }
        for (let j = 0; j < WAVES; j++) {
          const a = cA[j], b = sA[j], c = cB[j], e = sB[j], p = ph[j] + om[j] * t;
          for (let x = 0; x < gw; x++) { const v = kx[j] * ux[x] + ky[j] * wyCol[x] + p; a[x] = Math.cos(v); b[x] = Math.sin(v); }
          for (let y = 0; y < gh; y++) { const v = ky[j] * vy[y] + kx[j] * wxRow[y]; c[y] = Math.cos(v); e[y] = Math.sin(v); }
        }
        floor(m, t);
        const [a0, a1, a2, a3, a4, a5] = cA, [b0, b1, b2, b3, b4, b5] = sA;
        const R = (RID - 1) / 4.5, glare = layout === 2, marks = layout !== 2;
        let o = 0;
        for (let y = 0; y < gh; y++) {
          const c0 = cB[0][y], c1 = cB[1][y], c2 = cB[2][y], c3 = cB[3][y], c4 = cB[4][y], c5 = cB[5][y];
          const e0 = sB[0][y], e1 = sB[1][y], e2 = sB[2][y], e3 = sB[3][y], e4 = sB[4][y], e5 = sB[5][y];
          const rA = mRA[y], rB = mRB[y], gr = gR[y];
          for (let x = 0; x < gw; x++, o++) {
            const f1 = a0[x] * c0 - b0[x] * e0 + a1[x] * c1 - b1[x] * e1 + a2[x] * c2 - b2[x] * e2;
            const f2 = a3[x] * c3 - b3[x] * e3 + a4[x] * c4 - b4[x] * e4 + a5[x] * c5 - b5[x] * e5;
            const r1 = ridge[((f1 + 1.5) * R) | 0], r2 = ridge[((f2 + 1.5) * R) | 0];
            let bri = r1 * 0.62 + r2 * 0.4 + r1 * r2 * 0.5;
            if (glare) bri *= 0.6 + 0.55 * gC[x] * gr;
            const i = bri >= 1 ? LUT - 1 : (bri * (LUT - 1)) | 0;
            const mark = marks ? Math.max(rA * mCA[x], rB * mCB[x]) : 0;
            if (mark > 0.02) {
              const r = pr[i] + (mk[0] - pr[i]) * mark, gg = pg[i] + (mk[1] - pg[i]) * mark, bb = pb[i] + (mk[2] - pb[i]) * mark;
              const al = Math.max(pa[i], markA * mark);
              px[o] = ((al << 24) | (bb << 16) | (gg << 8) | r) >>> 0;
            } else px[o] = lut[i];
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
