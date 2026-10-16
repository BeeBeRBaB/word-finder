// Black hole: an accretion disk of glowing gas swirls round a dark centre, inner orbits faster,
// the side turning toward the viewer brighter; the disk's far side is bent up over the top of the
// shadow by lensing, with a thin second image under it. Layout 0: seen nearly edge-on, centred,
// a wide disk and a tall lensed arch. 1: tilted further, gas spiralling inward, twin jets from the
// poles with knots drifting out along them. 2: off to one side, a companion star drawn out into a
// stream of gas that curls into the disk.

import { stage, TAU, clamp, mix } from './stage.js';

/** @typedef {[number, number, number]} RGB */
/** @typedef {{u:number, off:number, v:number}} Puff a bit of the companion's stream: u how far along (0..1), off its sideways offset, v its speed */

/** Disk layer pixels, at most: each is looked up in the disk texture per frame. */
const BUDGET = 52000;
/** The disk texture: NR rings from inner edge to outer, NT steps round. */
const NR = 56, NT = 512;
/** How much of the disk's width the lensed arch keeps over the top. */
const LENS = 0.28;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    // Brightest colour innermost.
    const cols = s.colors.map(rgbOf).sort((p, q) => lum(q) - lum(p));
    const css = cols.map((c) => `rgb(${c[0]},${c[1]},${c[2]})`);
    const nc = cols.length;
    const side = rng.random() < 0.5 ? -1 : 1;
    const halo = glow(cols[0], 0.6);
    const starGlow = glow(cols[Math.min(nc - 1, 1)], 0.8);
    const jet = jetSprite(cols[Math.min(nc - 1, 1)]);
    const puff = glow(cols[Math.min(nc - 1, 2)], 0.9);
    const tex = diskTexture(rng);
    // Each ring's colour: the brightest colour inside, running to the next two outward.
    const ringRGB = new Uint8Array(NR * 3);
    const run = cols.slice(0, Math.min(3, nc));
    for (let i = 0; i < NR; i++) {
      const f = Math.pow(i / (NR - 1), 1.4) * (run.length - 1), k = Math.min(run.length - 2, Math.floor(f)), u = run.length > 1 ? f - k : 0;
      for (let ch = 0; ch < 3; ch++) ringRGB[i * 3 + ch] = run.length > 1 ? Math.round(mix(run[k][ch], run[k + 1][ch], u)) : run[0][ch];
    }
    const rowOff = new Int32Array(NR);
    const layer = document.createElement('canvas');
    const lg = layer.getContext('2d');
    /** @type {ImageData|null} */
    let img = null;
    // Per layer pixel the disk shows in: its index, then for up to two images of the disk (seen
    // directly, and bent by lensing) the ring, the step round and the brightness (0 for none).
    let pix = new Int32Array(0), r1 = new Uint8Array(0), t1 = new Uint16Array(0), w1 = new Uint8Array(0);
    let r2 = new Uint8Array(0), t2 = new Uint16Array(0), w2 = new Uint8Array(0);
    let cx = 0, cy = 0, rs = 40, rin = 60, rout = 200, ky = 0.2, sc = 1, bx = 0, by = 0;
    let sx = 0, sy = 0, sr = 30;
    /** @type {Puff[]} */
    let puffs = [];
    /** @type {{x:number, y:number, r:number, f:number, p:number}[]} */
    let stars = [];
    /** @type {{d:number, side:number}[]} */
    let knots = [];

    /** Where along the companion's stream: from the star's near side, arching over and curling
     * into the disk's outer edge on its far side. @param {number} u 0..1 @param {number} off @returns {[number, number]} */
    function streamAt(u, off) {
      const x0 = sx - side * sr * 0.95, y0 = sy + sr * 0.15;
      const a = -TAU / 4 - side * 0.5;
      const x2 = cx + Math.cos(a) * rout * 0.95, y2 = cy + Math.sin(a) * rout * 0.95 * ky;
      const x1 = mix(x0, x2, 0.45), y1 = Math.min(y0, y2) - rout * ky * 1.2;
      const v = 1 - u;
      const k = off * (1 - u * 0.8);
      return [v * v * x0 + 2 * v * u * x1 + u * u * x2, v * v * y0 + 2 * v * u * y1 + u * u * y2 + k];
    }

    /** Maps each layer pixel to the disk points it shows. Once per size. */
    function mapDisk() {
      if (!lg) return;
      const w = layer.width, h = layer.height;
      img = lg.createImageData(w, h);
      const P = [], R1 = [], T1 = [], W1 = [], R2 = [], T2 = [], W2 = [];
      const span = rout - rin, lift = rs * 1.12 - LENS * rin;
      /** Brightness of disk point r, angle a: brightest just outside the inner edge, the side
       * turning toward the viewer beamed brighter. @param {number} r @param {number} a */
      const bright = (r, a) => {
        const f = (r - rin) / span;
        const edge = clamp(f / 0.04, 0, 1) * clamp((1 - f) / 0.3, 0, 1);
        return Math.min(1, 2.3 * edge * Math.pow(1 - f, 1.3) * (0.3 + 0.7 * (0.5 + 0.5 * Math.cos(a))));
      };
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const X = bx + (i + 0.5) / sc - cx, Y = by + (j + 0.5) / sc - cy;
          let ra = -1, ta = 0, wa = 0, rb = -1, tb = 0, wb = 0;
          // Seen directly: the disk plane squashed by the tilt; its far side hidden by the shadow.
          const Yd = Y / ky, r = Math.hypot(X, Yd);
          if (r >= rin && r <= rout && !(Y < 0 && X * X + Y * Y < rs * rs)) {
            const a = Math.atan2(Yd, X);
            ra = r; ta = a; wa = bright(r, a);
          }
          const rho = Math.hypot(X, Y), phi = Math.atan2(Y, X);
          if (Y < 0) {
            // The far side again, lifted up and over the shadow.
            const u = Math.pow(-Math.sin(phi), 0.75);
            const rl = (rho - lift * u) / (1 - (1 - LENS) * u);
            if (rl >= rin && rl <= rout) { rb = rl; tb = phi; wb = bright(rl, phi) * 0.9; }
          } else {
            // And a thin copy under the shadow.
            const rl = rin + (rho - rs * 1.04) / 0.07;
            if (rl >= rin && rl <= rout) { rb = rl; tb = -phi; wb = bright(rl, -phi) * 0.45; }
          }
          if (ra < 0 && rb < 0) continue;
          if (ra < 0) { ra = rb; ta = tb; wa = wb; rb = -1; wb = 0; }
          const ring = (/** @type {number} */ q) => clamp(Math.floor(((q - rin) / span) * NR), 0, NR - 1);
          const step = (/** @type {number} */ a) => ((Math.round((a / TAU) * NT) % NT) + NT) % NT;
          P.push((j * w + i) * 4);
          R1.push(ring(ra)); T1.push(step(ta)); W1.push(Math.round(wa * 255));
          R2.push(rb < 0 ? 0 : ring(rb)); T2.push(step(tb)); W2.push(Math.round(wb * 255));
        }
      }
      pix = Int32Array.from(P); r1 = Uint8Array.from(R1); t1 = Uint16Array.from(T1); w1 = Uint8Array.from(W1);
      r2 = Uint8Array.from(R2); t2 = Uint16Array.from(T2); w2 = Uint8Array.from(W2);
    }

    /** Paints the disk into its layer, each ring of the texture turned by its own orbit. */
    function paintDisk() {
      if (!lg || !img) return;
      // Inner rings turn faster, as orbits do.
      for (let i = 0; i < NR; i++) {
        const r = mix(rin, rout, (i + 0.5) / NR);
        const turns = (s.t * 0.55 * Math.pow(rin / r, 1.5)) / TAU;
        rowOff[i] = Math.floor((1 - (turns % 1)) * NT) % NT;
      }
      const D = img.data;
      for (let k = 0; k < pix.length; k++) {
        let ri = r1[k];
        let a = (tex[ri * NT + ((t1[k] + rowOff[ri]) % NT)] * w1[k]) >> 8;
        if (w2[k]) {
          const rj = r2[k];
          const b = (tex[rj * NT + ((t2[k] + rowOff[rj]) % NT)] * w2[k]) >> 8;
          if (b > a) { a = b; ri = rj; }
        }
        const o = pix[k];
        D[o] = ringRGB[ri * 3]; D[o + 1] = ringRGB[ri * 3 + 1]; D[o + 2] = ringRGB[ri * 3 + 2]; D[o + 3] = a;
      }
      lg.putImageData(img, 0, 0);
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        if (L === 0) {
          rs = clamp(m * 0.075, 20, 90); cx = s.W / 2; cy = s.H * 0.5; ky = 0.17;
          rin = rs * 1.6; rout = Math.min(s.W * 0.48, rs * 7);
        } else if (L === 1) {
          rs = clamp(m * 0.07, 20, 80); cx = s.W / 2; cy = s.H * 0.5; ky = 0.42;
          rin = rs * 1.6; rout = Math.min(s.W * 0.46, s.H * 0.42 / ky, rs * 6);
        } else {
          rs = clamp(m * 0.06, 18, 70); ky = 0.26;
          cx = s.W * (0.5 - side * 0.15); cy = s.H * 0.56;
          rin = rs * 1.6; rout = Math.min(s.W * 0.32, rs * 5.5);
          sr = clamp(m * 0.065, 16, 64); sx = s.W * (0.5 + side * 0.32); sy = s.H * 0.28;
          if (!puffs.length) for (let i = 0; i < 120; i++) puffs.push({ u: rng.random(), off: (rng.random() - 0.5) * 2, v: 0.1 + rng.random() * 0.05 });
        }
        if (L === 1 && !knots.length) for (let i = 0; i < 8; i++) knots.push({ d: i / 8 + rng.random() * 0.05, side: i % 2 ? 1 : -1 });
        // The disk's layer covers the disk and the arch over it, inside the screen.
        const x0 = cx - rout - 4, x1 = cx + rout + 4;
        const y0 = cy - Math.max(rs * 1.12 + (rout - rin) * LENS, rout * ky) - 4, y1 = cy + rout * ky + 4;
        bx = Math.max(0, Math.floor(x0)); by = Math.max(0, Math.floor(y0));
        const bw = Math.max(1, Math.min(s.W, x1) - bx), bh = Math.max(1, Math.min(s.H, y1) - by);
        sc = Math.min(s.dpr, Math.sqrt(BUDGET / (bw * bh)));
        layer.width = Math.max(1, Math.ceil(bw * sc)); layer.height = Math.max(1, Math.ceil(bh * sc));
        mapDisk();
        paintDisk();
        const ns = clamp(Math.round(s.W * s.H / 9000), 30, 170);
        if (stars.length !== ns) {
          stars = [];
          for (let i = 0; i < ns; i++) stars.push({ x: rng.random(), y: rng.random(), r: 0.6 + rng.random() * 0.9, f: 0.08 + rng.random() * 0.1, p: rng.random() * TAU });
        }
      },
      step(dt) {
        for (const p of puffs) { p.u += p.v * dt; if (p.u > 1) { p.u -= 1; p.off = (rng.random() - 0.5) * 2; } }
        for (const k of knots) { k.d += dt * 0.06; if (k.d > 1) k.d -= 1; }
        paintDisk();
      },
      draw() {
        const { ctx } = s;
        ctx.fillStyle = s.ink;
        for (const st of stars) {
          ctx.globalAlpha = (s.dark ? 0.2 : 0.22) + 0.18 * Math.sin(s.t * st.f * TAU + st.p);
          ctx.fillRect(st.x * s.W, st.y * s.H, st.r * 1.6, st.r * 1.6);
        }
        // A faint glow round the hole.
        const g = rs * 4;
        ctx.globalAlpha = s.dark ? 0.3 : 0.3;
        ctx.drawImage(halo, cx - g, cy - g * 0.8, g * 2, g * 1.6);
        if (L === 2) {
          // The companion, drawn out toward the hole, and the stream it feeds.
          const k = sr * 2.6;
          ctx.globalAlpha = s.dark ? 0.5 : 0.45;
          ctx.drawImage(starGlow, sx - k, sy - k, k * 2, k * 2);
          ctx.globalAlpha = s.dark ? 0.45 : 0.42;
          ctx.fillStyle = css[Math.min(nc - 1, 1)];
          // A teardrop, its point toward the hole where the stream leaves it.
          const to = side < 0 ? 0.25 : Math.PI - 0.25;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, to + 0.75, to - 0.75 + TAU);
          ctx.quadraticCurveTo(sx + Math.cos(to) * sr * 1.25, sy + Math.sin(to) * sr * 1.25, sx + Math.cos(to + 0.75) * sr, sy + Math.sin(to + 0.75) * sr);
          ctx.fill();
          ctx.globalAlpha = s.dark ? 0.35 : 0.3;
          ctx.drawImage(starGlow, sx - sr * 0.8, sy - sr * 0.8, sr * 1.6, sr * 1.6);
          for (const p of puffs) {
            const [x, y] = streamAt(p.u, p.off * sr * 0.22);
            const z = mix(sr * 0.5, 6, p.u);
            ctx.globalAlpha = (s.dark ? 0.55 : 0.6) * Math.min(1, p.u * 8, (1 - p.u) * 6);
            ctx.drawImage(puff, x - z, y - z, z * 2, z * 2);
          }
        }
        if (L === 1) {
          // Twin jets along the poles, breathing slowly, with knots drifting outward.
          const jl = Math.min(s.H * 0.5, rs * 11), jw = rs * 0.8;
          ctx.globalAlpha = (s.dark ? 0.26 : 0.3) + 0.08 * Math.sin(s.t * TAU / 9);
          ctx.drawImage(jet, cx - jw, cy - jl, jw * 2, jl);
          ctx.save(); ctx.translate(cx, cy); ctx.scale(1, -1);
          ctx.drawImage(jet, -jw, -jl, jw * 2, jl);
          ctx.restore();
          ctx.fillStyle = css[Math.min(nc - 1, 1)];
          for (const k of knots) {
            const d = rs * 1.3 + k.d * (jl - rs * 1.3);
            ctx.globalAlpha = 0.32 * Math.sin(Math.PI * k.d);
            ctx.beginPath(); ctx.ellipse(cx, cy + k.side * d, rs * 0.08 * (1 + k.d), rs * 0.16 * (1 + k.d), 0, 0, TAU); ctx.fill();
          }
        }
        // The shadow: a void darker than the page.
        ctx.globalAlpha = s.dark ? 0.6 : 0.42;
        ctx.fillStyle = s.dark ? '#000' : s.ink;
        ctx.beginPath(); ctx.arc(cx, cy, rs, 0, TAU); ctx.fill();
        ctx.globalAlpha = s.dark ? 0.9 : 0.85;
        ctx.drawImage(layer, bx, by, layer.width / sc, layer.height / sc);
        // The photon ring at the shadow's edge.
        ctx.globalAlpha = s.dark ? 0.55 : 0.6;
        ctx.strokeStyle = css[0];
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, rs * 1.05, 0, TAU); ctx.stroke();
      },
    };
  });
}

/** The disk's gas as brightness rings x steps round: each ring its own streaky pattern, so the
 * streaks run along the orbits, softened a little across rings.
 * @param {import('../rng.js').Rng} rng @returns {Uint8Array} */
function diskTexture(rng) {
  const raw = new Float32Array(NR * NT);
  for (let i = 0; i < NR; i++) {
    const hs = Array.from({ length: 9 }, () => ({ k: 2 + rng.int(50), p: rng.random() * TAU, a: 0.4 + rng.random() }));
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < NT; j++) {
      const a = (j / NT) * TAU;
      let v = 0;
      for (const h of hs) v += (h.a / Math.sqrt(h.k)) * Math.sin(h.k * a + h.p);
      raw[i * NT + j] = v;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    for (let j = 0; j < NT; j++) raw[i * NT + j] = (raw[i * NT + j] - lo) / (hi - lo || 1);
  }
  const out = new Uint8Array(NR * NT);
  for (let i = 0; i < NR; i++) {
    for (let j = 0; j < NT; j++) {
      const v = 0.6 * raw[i * NT + j] + 0.2 * raw[Math.max(0, i - 1) * NT + j] + 0.2 * raw[Math.min(NR - 1, i + 1) * NT + j];
      out[i * NT + j] = Math.round(255 * (0.3 + 0.7 * Math.pow(v, 1.4)));
    }
  }
  return out;
}

/** Rough perceived lightness. @param {RGB} c @returns {number} */
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

/** A soft round glow. @param {RGB} c @param {number} core alpha at the middle @returns {HTMLCanvasElement} */
function glow(c, core) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  if (!g) return cv;
  const rgb = `${c[0]},${c[1]},${c[2]}`;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb},${core})`);
  grad.addColorStop(0.3, `rgba(${rgb},${core * 0.35})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return cv;
}

/** A jet as a sprite: a narrow beam from its base at the bottom, widening and fading upward.
 * @param {RGB} c @returns {HTMLCanvasElement} */
function jetSprite(c) {
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 128;
  const g = cv.getContext('2d');
  if (!g) return cv;
  const rgb = `${c[0]},${c[1]},${c[2]}`;
  const up = g.createLinearGradient(0, 128, 0, 0);
  up.addColorStop(0, `rgba(${rgb},.9)`);
  up.addColorStop(0.4, `rgba(${rgb},.45)`);
  up.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = up;
  g.beginPath(); g.moveTo(14, 128); g.lineTo(18, 128); g.lineTo(26, 0); g.lineTo(6, 0); g.closePath(); g.fill();
  // Soft sides: fade the edges toward the middle line.
  const across = g.createLinearGradient(0, 0, 32, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)');
  across.addColorStop(0.5, 'rgba(0,0,0,1)');
  across.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, 32, 128);
  return cv;
}

/** A colour string's channels. @param {string} color @returns {RGB} */
function rgbOf(color) {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return [128, 128, 128];
  g.fillStyle = '#888';
  g.fillStyle = color;
  const v = String(g.fillStyle);
  if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = v.match(/[\d.]+/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128];
}
