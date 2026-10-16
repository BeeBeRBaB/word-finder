// Chladni: sand on a plate that sings in one mode. Grains jostle where the plate shakes and rest
// where it is still, so they gather on the node lines; when the mode changes the lines scatter
// and the sand finds the new ones. The seed picks the variant: a square plate whose figure
// changes every so often; the whole page as one plate whose modes melt slowly into each other;
// or a round plate of rings and spokes, the spokes turning slowly.

import { stage, TAU, clamp } from './stage.js';

const Q = 2;           // CSS px per sand pixel
const HOLD = 16;       // s a figure holds
const MORPH = 9;       // s one mode takes to melt into the next (page plate)

/** Square and page plates: [n, m, sign]. */
const SQUARE = [[1, 2, 1], [1, 3, -1], [2, 3, 1], [1, 4, 1], [2, 5, -1], [3, 4, -1], [1, 5, 1],
  [3, 5, 1], [2, 4, -1], [4, 5, 1]];
/** Round plate: [rings, spokes]. */
const ROUND = [[1, 2], [1, 3], [2, 2], [1, 4], [2, 3], [2, 0], [1, 5], [2, 4], [3, 2], [1, 6]];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    let n = 0;
    // Grain position in plate units (-1..1 across the plate) and colour.
    let gu = new Float32Array(0), gv = new Float32Array(0), gc = new Uint8Array(0);
    let gi = new Int32Array(0);         // each grain's sand pixel last frame
    const buf = document.createElement('canvas');
    const bctx = buf.getContext('2d');
    /** @type {ImageData|null} */
    let img = null;
    let px = new Uint32Array(0), cnt = new Uint8Array(0);
    // Colour per colour and stack height, as little-endian RGBA words.
    /** @type {Uint32Array[]} */
    const tone = s.colors.map((c) => {
      const [r, g, b] = rgbOf(c), out = new Uint32Array(5);
      for (let k = 1; k < 5; k++) {
        const a = Math.round(255 * (s.dark ? 0.46 + k * 0.04 : 0.46 + k * 0.04));
        out[k] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
      }
      return out;
    });
    // The plate on the page: centre and half sizes, CSS px.
    let cx = 0, cy = 0, hx = 1, hy = 1;
    const deck = layout === 2 ? ROUND : SQUARE;
    let mode = rng.int(deck.length), next = mode, w = 0, clock = 0, rot = rng.random() * TAU;
    let laid = false;

    /** A new mode unlike the last. @returns {number} */
    const pick = () => { let k = rng.int(deck.length - 1); if (k >= mode) k++; return k; };

    // Each mode is separable into 1D waves, so it is tabled once: TN steps of cos and sin for
    // each of its two wavenumbers, over the plate's width (square) or radius and turn (round).
    const TN = 1024;
    /** @type {Float32Array[][]} */
    const tabs = deck.map((m) => {
      const ks = layout === 2 ? [(m[0] + 0.5) * Math.PI, m[1]] : [m[0], m[1]];
      return ks.map((k, j) => {
        const span = layout === 2 && j === 1 ? TAU : Math.PI, out = new Float32Array(2 * (TN + 1));
        for (let i = 0; i <= TN; i++) { const x = i / TN * span; out[2 * i] = Math.cos(k * x); out[2 * i + 1] = Math.sin(k * x); }
        return out;
      });
    });

    /** f and its gradient at (u, v) for one mode, into out. @param {number} k @param {number} u
     * @param {number} v @param {Float32Array} out @returns {void} */
    function field(k, u, v, out) {
      const [ta, tb] = tabs[k];
      if (layout === 2) {
        const kr = (deck[k][0] + 0.5) * Math.PI, spokes = deck[k][1];
        const r = Math.max(0.02, Math.hypot(u, v));
        let th = (Math.atan2(v, u) - rot) % TAU;
        if (th < 0) th += TAU;
        const i = Math.min(TN, (r * TN) | 0) * 2, j = ((th / TAU * TN) | 0) * 2;
        const cr = ta[i], sr = ta[i + 1], cm = tb[j], sm = tb[j + 1];
        out[0] = cr * cm;
        const fr = -kr * sr * cm, ft = -spokes * cr * sm / r;
        out[1] = (fr * u - ft * v) / r; out[2] = (fr * v + ft * u) / r;
        return;
      }
      const [a, b, sg] = deck[k];
      const ix = (((u + 1) / 2 * TN) | 0) * 2, iy = (((v + 1) / 2 * TN) | 0) * 2;
      const cax = ta[ix], sax = ta[ix + 1], cbx = tb[ix], sbx = tb[ix + 1];
      const cay = ta[iy], say = ta[iy + 1], cby = tb[iy], sby = tb[iy + 1];
      out[0] = (cax * cby - sg * cbx * cay) / 2;
      out[1] = (-a * sax * cby + sg * b * sbx * cay) * Math.PI / 4;
      out[2] = (-b * cax * sby + sg * a * cbx * say) * Math.PI / 4;
    }

    const f1 = new Float32Array(3), f2 = new Float32Array(3);
    /** The plate's shape now: one mode, or two melting. @param {number} u @param {number} v */
    function now(u, v) {
      field(mode, u, v, f1);
      if (w > 0) {
        field(next, u, v, f2);
        const e = w * w * (3 - 2 * w);
        for (let i = 0; i < 3; i++) f1[i] += (f2[i] - f1[i]) * e;
      }
    }

    /** Keeps a grain on the plate. @param {number} i @returns {void} */
    function hold(i) {
      if (layout === 2) {
        const r = Math.hypot(gu[i], gv[i]);
        if (r > 0.995) { gu[i] *= 0.99 / r; gv[i] *= 0.99 / r; }
      } else { gu[i] = clamp(gu[i], -0.997, 0.997); gv[i] = clamp(gv[i], -0.997, 0.997); }
    }

    let part = 0, seedR = (s.seed ^ 0x9e3779b9) >>> 0;
    /** Shakes a third of the grains, in turn, for three times dt. @param {number} dt @returns {void} */
    function shake(dt) {
      const m0 = Math.min(hx, hy), e = Math.min(1, dt * 30) * 1.7, d3 = dt * 3;
      const ju = 7 / hx * e, jv = 7 / hy * e, du = 22 / hx * d3, dv = 22 / hy * d3;
      let r = seedR;
      for (let i = part; i < n; i += 3) {
        now(gu[i], gv[i]);
        const a = Math.min(1, Math.abs(f1[0]) * 2.2);
        if (a < 0.004) continue;
        // Grains hop where the plate moves, and slide downhill to the still lines.
        const g = Math.hypot(f1[1] * m0 / hx, f1[2] * m0 / hy) || 1, sg = f1[0] > 0 ? a : -a;
        r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
        const x = r / 4294967296 - 0.5;
        r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
        const y = r / 4294967296 - 0.5;
        gu[i] += x * ju * a - sg * f1[1] / g * du;
        gv[i] += y * jv * a - sg * f1[2] / g * dv;
        hold(i);
      }
      seedR = r; part = (part + 1) % 3;
    }

    /** Scatters grains, most of them near the figure already. @param {number} from @returns {void} */
    function sow(from) {
      for (let i = from; i < n; i++) {
        let u = 0, v = 0;
        for (let t = 0; t < 40; t++) {
          u = rng.random() * 2 - 1; v = rng.random() * 2 - 1;
          if (layout === 2 && u * u + v * v > 0.98) continue;
          now(u, v);
          if (Math.abs(f1[0]) < 0.06) break;
        }
        gu[i] = u; gv[i] = v; gc[i] = rng.int(nc);
        hold(i);
      }
    }

    return {
      lay() {
        const { W, H } = s, m0 = Math.min(W, H);
        if (layout === 0) { cx = W / 2; cy = H / 2; hx = hy = m0 * 0.46; }
        else if (layout === 2) { cx = W / 2; cy = H / 2; hx = hy = m0 * 0.47; }
        else { cx = W / 2; cy = H / 2; hx = W / 2; hy = H / 2; }
        const area = layout === 1 ? W * H : layout === 0 ? 4 * hx * hy : Math.PI * hx * hy;
        const want = clamp(Math.round(area / 45), 3000, 15000);
        if (want !== n) {
          const was = n;
          /** @template {Float32Array|Uint8Array|Int32Array} T @param {T} a @param {T} b @returns {T} */
          const grow = (a, b) => { b.set(a.subarray(0, Math.min(a.length, b.length))); return b; };
          gu = grow(gu, new Float32Array(want)); gv = grow(gv, new Float32Array(want));
          gc = grow(gc, new Uint8Array(want)); gi = new Int32Array(want).fill(-1);
          n = want;
          if (n > was) sow(was);
        }
        buf.width = Math.ceil(W / Q); buf.height = Math.ceil(H / Q);
        img = bctx ? bctx.createImageData(buf.width, buf.height) : null;
        px = img ? new Uint32Array(img.data.buffer) : new Uint32Array(0);
        cnt = new Uint8Array(px.length);
        gi.fill(-1);
        if (!laid) { laid = true; for (let i = 0; i < 90; i++) shake(1 / 30); }
      },
      step(dt) {
        clock += dt;
        if (layout === 1) {
          // Hold, then melt into the next mode.
          if (w > 0 || clock > HOLD) {
            if (w === 0) next = pick();
            w = Math.min(1, w + dt / MORPH);
            if (w === 1) { mode = next; w = 0; clock = 0; }
          }
        } else if (clock > HOLD) { mode = pick(); clock = 0; }
        if (layout === 2) rot += dt * 0.025;
        shake(dt);
      },
      draw() {
        const { ctx } = s;
        if (!img || !bctx) return;
        // Clear last frame's grains only, then stack this frame's.
        for (let i = 0; i < n; i++) if (gi[i] >= 0) { px[gi[i]] = 0; cnt[gi[i]] = 0; }
        const bw = buf.width, bh = buf.height;
        for (let i = 0; i < n; i++) {
          const x = ((cx + gu[i] * hx) / Q) | 0, y = ((cy + gv[i] * hy) / Q) | 0;
          if (x < 0 || y < 0 || x >= bw || y >= bh) { gi[i] = -1; continue; }
          const k = y * bw + x;
          gi[i] = k;
          if (cnt[k] < 4) cnt[k]++;
          px[k] = tone[gc[i]][cnt[k]];
        }
        bctx.putImageData(img, 0, 0);
        // The plate's rim and the post it is held on.
        ctx.strokeStyle = s.ink; ctx.fillStyle = s.ink;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = s.dark ? 0.2 : 0.22;
        if (layout === 0) { ctx.strokeRect(cx - hx, cy - hy, hx * 2, hy * 2); }
        if (layout === 2) { ctx.beginPath(); ctx.arc(cx, cy, hx, 0, TAU); ctx.stroke(); }
        if (layout !== 1) { ctx.beginPath(); ctx.arc(cx, cy, clamp(hx * 0.02, 3, 7), 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf, 0, 0, bw * Q, bh * Q);
        ctx.imageSmoothingEnabled = true;
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
