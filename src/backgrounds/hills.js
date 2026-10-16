// Paper hills: layers of cut-paper hills, each casting a soft shadow on the one behind, scroll
// past at their own speeds under a paper sun (a moon on a dark page), in the look's colours. The
// seed picks the variant: rolling hills dotted with round trees under drifting paper clouds; a
// mountain range, jagged ridges with pines on the near slopes; or karst, steep sugarloaf peaks
// rising out of bands of mist, as in a Chinese landscape.

import { stage, TAU, clamp, mix } from './stage.js';

const NL = 4;          // paper layers
const KNOTS = 64;      // ridge points kept per layer for the mountains

/** @typedef {{cv:HTMLCanvasElement, top:number, speed:number}} Layer */
/** @typedef {{x:number, y:number, r:number, v:number, cv:HTMLCanvasElement|null}} Cloud */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    const rgb = s.colors.map(rgbOf);
    const sky = s.dark ? [20, 22, 28] : [246, 244, 238];
    const first = rng.int(C);
    // Shapes from the seed, once, so a resize redraws the same land at the new size.
    const waves = Array.from({ length: NL }, () => [1, 2, 3, 5].map((n) => ({ n, a: rng.random(), ph: rng.random() * TAU })));
    const ridges = Array.from({ length: NL }, () => Array.from({ length: KNOTS }, () => rng.random()));
    const peaks = Array.from({ length: NL }, () => Array.from({ length: 12 }, () => ({ c: rng.random(), w: 0.5 + rng.random() * 0.7, h: 0.45 + rng.random() * 0.55 })));
    const trees = Array.from({ length: NL }, () => Array.from({ length: 24 }, () => ({ u: rng.random(), s: 0.6 + rng.random() * 0.6 })));
    const sunX = rng.random() < 0.5 ? 0.12 + rng.random() * 0.18 : 0.7 + rng.random() * 0.18;
    /** @type {Layer[]} */
    let layers = [];
    /** @type {Cloud[]} */
    const clouds = layout === 1 ? [] : Array.from({ length: 3 }, (_, i) => ({ x: rng.random(), y: 0.1 + i * 0.07 + rng.random() * 0.05,
      r: 0.7 + rng.random() * 0.5, v: 0.6 + rng.random() * 0.6, cv: null }));
    let m = 1, cyc = 1, rd = 1;

    /** Layer i's colour: its look colour, faded toward the sky the farther back it is.
     * @param {number} i @param {number} [lift] extra fade @returns {string} */
    function tone(i, lift = 0) {
      const c = rgb[(first + i) % C], u = clamp((1 - (i + 1) / NL) * 0.62 + lift, 0, 1);
      return `rgb(${Math.round(mix(c[0], sky[0], u))},${Math.round(mix(c[1], sky[1], u))},${Math.round(mix(c[2], sky[2], u))})`;
    }

    /** Layer i's ground height above its base at u (0..1 across one tile, periodic), as a
     * fraction of its amplitude. @param {number} i @param {number} u @returns {number} */
    function ground(i, u) {
      if (layout === 1) {
        const K = Math.min(KNOTS, 6 * cyc + i * 2 * cyc), x = u * K, k = Math.floor(x), f = x - k;
        // Alternate peaks and saddles, straight slopes between them.
        const at = (/** @type {number} */ j) => { const q = ((j % K) + K) % K; return q % 2 ? 0.15 + 0.35 * ridges[i][q] : 0.55 + 0.45 * ridges[i][q]; };
        return mix(at(k), at(k + 1), f);
      }
      if (layout === 2) {
        let h = -0.3;
        const n = Math.min(12, 3 * cyc + i);
        for (let j = 0; j < n; j++) {
          const p = peaks[i][j], c = (j + p.c * 0.8) / n;
          let d = Math.abs(u - c); d = Math.min(d, 1 - d);
          const w = p.w * 0.5 / n, e = d / w;
          // A sugarloaf: steep sides, a rounded top.
          if (e < 1) h = Math.max(h, p.h * Math.pow(1 - e * e, 0.6));
        }
        return h;
      }
      let h = 0.5;
      for (const w of waves[i]) h += Math.sin(u * TAU * w.n * cyc + w.ph) * (0.32 / w.n) * (0.6 + w.a);
      return clamp(h, 0, 1.2);
    }

    /** Draws layer i into its own canvas, one tile wide, its shadow baked in. @param {number} i @returns {Layer} */
    function build(i) {
      const base = s.H * (0.6 + 0.09 * i), amp = m * (layout === 0 ? 0.16 : 0.3) * (1 - i * 0.12);
      const top = Math.max(0, base - amp * 1.25 - 24 - m * 0.12);
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(s.W * rd); cv.height = Math.ceil((s.H - top) * rd);
      const g = cv.getContext('2d');
      const layer = { cv, top, speed: (3 + i * 5) * m / 600 };
      if (!g) return layer;
      g.setTransform(rd, 0, 0, rd, 0, -top * rd);
      g.shadowColor = s.dark ? 'rgba(0,0,0,.55)' : 'rgba(40,30,20,.28)';
      g.shadowBlur = 12 * rd;
      g.shadowOffsetY = -2 * rd;
      g.fillStyle = tone(i);
      const step = layout === 1 ? 2 : 4;
      // A little past both ends of the tile, so the shadow runs on unbroken across the seam.
      g.beginPath();
      g.moveTo(-40, s.H + 10);
      for (let x = -40; x <= s.W + 40; x += step) g.lineTo(x, base - amp * ground(i, ((x / s.W) % 1 + 1) % 1));
      g.lineTo(s.W + 40, s.H + 10);
      g.closePath();
      g.fill();
      if (i >= 1 && layout !== 2) {
        // Trees on the nearer layers: round ones on the hills, pines on the mountains.
        const n = layout === 1 ? 6 + i * 4 : 3 + i * 2;
        const ts = m * 0.018 * (0.7 + i * 0.25);
        for (let j = 0; j < n * cyc && j < 24; j++) {
          const tr = trees[i][j], u = tr.u, x = u * s.W, y = base - amp * ground(i, u) + ts * 0.4, h = ts * tr.s;
          for (const dx of x < 40 ? [0, s.W] : x > s.W - 40 ? [0, -s.W] : [0]) {
            g.beginPath();
            if (layout === 1) {
              g.moveTo(x + dx, y - h * 3.2); g.lineTo(x + dx + h, y); g.lineTo(x + dx - h, y);
            } else {
              g.rect(x + dx - h * 0.18, y - h * 1.6, h * 0.36, h * 1.7);
              g.moveTo(x + dx + h, y - h * 2.2);
              g.arc(x + dx, y - h * 2.2, h, 0, TAU);
            }
            g.fill();
          }
        }
      }
      if (layout === 2) {
        // Mist round the peaks' feet: they fade out downward, so the layer behind shows through.
        g.shadowColor = 'transparent';
        g.globalCompositeOperation = 'destination-out';
        const mist = g.createLinearGradient(0, base - amp * 0.4, 0, base + m * 0.02);
        mist.addColorStop(0, 'rgba(0,0,0,0)');
        mist.addColorStop(1, 'rgba(0,0,0,.95)');
        g.fillStyle = mist;
        g.fillRect(-40, top, s.W + 80, s.H - top);
      }
      return layer;
    }

    /** A paper cloud sprite. @param {Cloud} c @returns {HTMLCanvasElement} */
    function cloud(c) {
      const r = m * 0.05 * c.r, w = r * 5, h = r * 3;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w * rd); cv.height = Math.ceil(h * rd);
      const g = cv.getContext('2d');
      if (!g) return cv;
      g.setTransform(rd, 0, 0, rd, 0, 0);
      g.shadowColor = s.dark ? 'rgba(0,0,0,.5)' : 'rgba(40,30,20,.22)';
      g.shadowBlur = 8 * rd; g.shadowOffsetY = 2 * rd;
      g.fillStyle = tone(0, s.dark ? 0.05 : 0.15);
      g.beginPath();
      g.moveTo(r * 0.6, h - r * 0.6);
      g.arc(r * 1.4, h - r * 1.2, r * 0.8, Math.PI * 0.75, Math.PI * 1.6);
      g.arc(r * 2.5, h - r * 1.5, r * 1.05, Math.PI * 1.15, Math.PI * 1.9);
      g.arc(r * 3.6, h - r * 1.15, r * 0.75, Math.PI * 1.4, Math.PI * 0.25);
      g.lineTo(r * 0.6, h - r * 0.6);
      g.fill();
      return cv;
    }

    return {
      lay() {
        m = Math.min(s.W, s.H);
        rd = Math.min(s.dpr, 2);
        cyc = Math.max(1, Math.round(s.W / s.H * 1.2));
        layers = Array.from({ length: NL }, (_, i) => build(i));
        for (const c of clouds) c.cv = cloud(c);
      },
      step() {},
      draw() {
        const t = s.t, { ctx } = s;
        // The sun or moon: paper discs, largest palest.
        const R = m * 0.085, sx = s.W * sunX, sy = s.H * 0.28 + Math.sin(t * 0.05) * m * 0.01;
        ctx.fillStyle = s.dark ? tone(NL - 1, 0.45) : tone(NL - 1, 0.2);
        for (const [k, a] of [[2.1, 0.1], [1.55, 0.16], [1, 0.36]]) {
          ctx.globalAlpha = a;
          ctx.beginPath(); ctx.arc(sx, sy, R * k, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = s.dark ? 0.42 : 0.5;
        for (const c of clouds) {
          if (!c.cv) continue;
          const w = c.cv.width / rd, span = s.W + w;
          const x = ((c.x * span + t * c.v * 4 * m / 600) % span) - w;
          ctx.drawImage(c.cv, s.W - x - w, s.H * c.y, w, c.cv.height / rd);
        }
        // Each layer first cuts its shape out of what is behind it, then lays itself in, so a
        // nearer layer hides a farther one as paper would, and no spot is more opaque than one layer.
        layers.forEach((L, i) => {
          const off = Math.round((t * L.speed) % s.W * rd) / rd, h = L.cv.height / rd;
          ctx.globalCompositeOperation = 'destination-out';
          ctx.globalAlpha = 1;
          ctx.drawImage(L.cv, -off, L.top, s.W, h);
          ctx.drawImage(L.cv, s.W - off, L.top, s.W, h);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = (s.dark ? 0.32 : 0.3) + i * 0.04;
          ctx.drawImage(L.cv, -off, L.top, s.W, h);
          ctx.drawImage(L.cv, s.W - off, L.top, s.W, h);
        });
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
