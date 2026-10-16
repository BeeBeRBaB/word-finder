// Gears: drawn spur gears mesh and turn, every pair at matched speeds (teeth pass at one pitch-line
// speed, so small gears spin faster and neighbours turn opposite ways) with their teeth
// interleaved. The seed picks the variant: one sprawling gear train across the screen; clockwork,
// each axle a big gear with a pinion on a layer in front driving the next, slowing down the
// train; planetary sets, planets orbiting a sun inside a ring gear, beside a spur train.

import { stage, TAU, clamp } from './stage.js';
import { makeRng } from '../rng.js';

/** @typedef {{x:number, y:number, r:number, N:number, ph:number, w:number, path:Path2D, c:number,
 *   plane:number, orb?:{cx:number, cy:number, d:number, a:number, w:number}}} Gear
 * Pitch radius r, N teeth, angle ph + w·t (rad, rad/s), outline in local px; plane 0 sits behind
 * plane 1. An orbiting planet's centre is (cx, cy) + d at angle a + w·t. */
/** @typedef {{cx:number, cy:number, d:number, a:number, w:number, k:number, c:number}} Carrier */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { layout } = s;
    const nc = s.colors.length;
    /** @type {Gear[]} */
    let gears = [];
    /** @type {Carrier[]} */
    let carriers = [];
    let pitch = 14, v = 12;
    /** Each spur's toothed rim, keyed by its web. @type {Map<Path2D, Path2D>} */
    const rims = new Map();

    /** Toothed outline: roots at rRoot, tips at rTip (inward when rTip < rRoot). Adds to `p`.
     * @param {Path2D} p @param {number} N @param {number} rRoot @param {number} rTip @returns {void} */
    function teeth(p, N, rRoot, rTip) {
      const st = TAU / N, hr = st * 0.29, ht = st * 0.16;
      p.moveTo(Math.cos(-hr) * rRoot, Math.sin(-hr) * rRoot);
      for (let k = 0; k < N; k++) {
        const a = k * st;
        // Straight segments only: stroking arcs costs several times as much.
        p.lineTo(Math.cos(a - ht) * rTip, Math.sin(a - ht) * rTip);
        p.lineTo(Math.cos(a + ht) * rTip, Math.sin(a + ht) * rTip);
        p.lineTo(Math.cos(a + hr) * rRoot, Math.sin(a + hr) * rRoot);
        p.lineTo(Math.cos(a + st - hr) * rRoot, Math.sin(a + st - hr) * rRoot);
      }
      p.closePath();
    }

    /** A spur gear's outline with its bore and, when big enough, spoked windows.
     * @param {number} N @param {number} r @param {number} p tooth pitch @param {number} spokes @returns {Path2D} */
    function spur(N, r, p, spokes) {
      // Two fills that never overlap: the toothed rim, stronger, and the web inside it.
      const rim = new Path2D(), path = new Path2D(), band = r - p * 0.36 - clamp(p * 0.35, 3, 8);
      teeth(rim, N, r - p * 0.36, r + p * 0.3);
      rim.moveTo(band, 0);
      rim.arc(0, 0, band, 0, TAU);
      rims.set(path, rim);
      path.moveTo(band, 0);
      path.arc(0, 0, band, 0, TAU);
      const bore = clamp(r * 0.13, 2.5, 10);
      path.moveTo(bore, 0);
      path.arc(0, 0, bore, 0, TAU);
      const ro = r - p * 0.95, ri = Math.max(bore * 2.2, r * 0.32);
      if (ro - ri > 10) {
        const sw = clamp(r * 0.1, 4, 14);
        for (let i = 0; i < spokes; i++) {
          const a0 = i * TAU / spokes, a1 = (i + 1) * TAU / spokes;
          path.moveTo(Math.cos(a0 + sw / 2 / ro) * ro, Math.sin(a0 + sw / 2 / ro) * ro);
          path.arc(0, 0, ro, a0 + sw / 2 / ro, a1 - sw / 2 / ro);
          path.arc(0, 0, ri, a1 - sw / 2 / ri, a0 + sw / 2 / ri, true);
          path.closePath();
        }
      } else if (ro - bore > 8) {
        path.moveTo(ro * 0.55 + 2, 0);
        path.arc(0, 0, ro * 0.55 + 2, 0, TAU);
      }
      return path;
    }

    /** @param {Gear[]} list @param {number} x @param {number} y @param {number} ro tip radius
     * @param {number} plane @param {Gear|null} skip the gear it meshes with @returns {boolean} */
    function free(list, x, y, ro, plane, skip) {
      for (const g of list) {
        if (g === skip) continue;
        const gx = g.orb ? g.orb.cx : g.x, gy = g.orb ? g.orb.cy : g.y;
        const R = g.orb ? g.orb.d + g.r : g.r;
        const dist = Math.hypot(x - gx, y - gy);
        // Other planes may overlap, but never cover an axle.
        if (g.plane !== plane) { if (dist < Math.max(ro * 0.3, g.r * 0.3) + 6) return false; continue; }
        if (dist < ro + R + pitch * 0.9) return false;
      }
      return true;
    }

    /** Is a gear at (x, y) with tip radius ro worth having: mostly on screen. @param {number} x @param {number} y @param {number} ro @returns {boolean} */
    const onScreen = (x, y, ro) => x > -ro * 0.5 && x < s.W + ro * 0.5 && y > -ro * 0.5 && y < s.H + ro * 0.5;

    /** A gear meshing with `g` at bearing `a` from it.
     * @param {Gear} g @param {number} a @param {number} N @param {number} plane
     * @param {import('../rng.js').Rng} rng @returns {Gear} */
    function meshed(g, a, N, plane, rng) {
      const r = N * pitch / TAU, d = g.r + r;
      // Interleave the teeth: where g has a tooth at bearing a, this one has a gap.
      const ph = a + Math.PI + Math.PI / N - (g.ph - a) * g.N / N;
      return { x: g.x + Math.cos(a) * d, y: g.y + Math.sin(a) * d, r, N, ph, w: -g.w * g.N / N,
        path: spur(N, r, pitch, 4 + rng.int(3)), c: rng.int(nc), plane };
    }

    /** Clockwork: a pinion in front of `g` on its axle, on the other plane. @param {Gear} g
     * @param {import('../rng.js').Rng} rng @returns {Gear|null} */
    function pinion(g, rng) {
      const N = clamp(Math.round(g.N * (0.28 + rng.random() * 0.12)), 8, 16), r = N * pitch / TAU;
      if (!free(gears, g.x, g.y, r + pitch * 0.3, 1 - g.plane, null)) return null;
      return { x: g.x, y: g.y, r, N, ph: rng.random() * TAU, w: g.w, path: spur(N, r, pitch, 0),
        c: (g.c + 1) % nc, plane: 1 - g.plane };
    }

    /** Grows trains from roots until `cover` of the screen is gear. @param {import('../rng.js').Rng} rng
     * @param {number} cover @returns {void} */
    function grow(rng, cover) {
      let area = 0;
      const target = s.W * s.H * cover;
      /** @type {Gear[]} where the next gear may attach */
      const ends = [];
      for (let tries = 0; tries < 900 && area < target && gears.length < 60; tries++) {
        /** @type {Gear|null} */
        let made = null;
        if (ends.length && tries % 25 !== 24) {
          const g = ends[rng.int(ends.length)];
          const n = meshed(g, rng.random() * TAU, layout === 1 ? 28 + rng.int(36) : 10 + rng.int(42), g.plane, rng);
          if (!onScreen(n.x, n.y, n.r) || !free(gears, n.x, n.y, n.r + pitch * 0.3, n.plane, g)) continue;
          made = n;
        } else {
          // A fresh root where there is room.
          const N = 18 + rng.int(36), r = N * pitch / TAU;
          const x = rng.random() * s.W, y = rng.random() * s.H;
          if (!free(gears, x, y, r + pitch * 0.3, 0, null)) continue;
          made = { x, y, r, N, ph: rng.random() * TAU, w: (rng.random() < 0.5 ? 1 : -1) * v / r,
            path: spur(N, r, pitch, 4 + rng.int(3)), c: rng.int(nc), plane: 0 };
        }
        if (layout === 1) {
          // Each axle: this big gear and a pinion on the other plane, which drives the next.
          const pin = pinion(made, rng);
          if (!pin) continue;
          gears.push(made, pin);
          ends.push(pin);
        } else {
          gears.push(made);
          ends.push(made);
        }
        area += Math.PI * made.r * made.r * (layout === 1 ? 0.6 : 1);
      }
    }

    /** One planetary set: sun, planets on a turning carrier, a fixed ring gear.
     * @param {number} cx @param {number} cy @param {number} R ring pitch radius @param {import('../rng.js').Rng} rng @returns {void} */
    function planetary(cx, cy, R, rng) {
      // Tooth counts where K planets fit evenly: (Ns + Nr) divisible by K, Nr = Ns + 2·Np.
      const sets = [[18, 12, 3], [24, 12, 4], [20, 10, 3], [16, 16, 4], [30, 15, 3], [12, 18, 3]];
      const [Ns, Np, K] = sets[rng.int(sets.length)];
      const Nr = Ns + 2 * Np, p = TAU * R / Nr;
      const rs = Ns * p / TAU, rp = Np * p / TAU;
      const wc = (rng.random() < 0.5 ? 1 : -1) * 0.06, ws = wc * (Ns + Nr) / Ns, wp = wc * (1 - Nr / Np);
      const c0 = rng.random() * TAU, sph = rng.random() * TAU;
      const c = rng.int(nc);
      gears.push({ x: cx, y: cy, r: rs, N: Ns, ph: sph, w: ws, path: spur(Ns, rs, p, 5), c, plane: 0 });
      let ring = 0;
      for (let k = 0; k < K; k++) {
        const a = c0 + k * TAU / K;
        const ph = a + Math.PI + Math.PI / Np - (sph - a) * Ns / Np;
        if (k === 0) ring = a + Math.PI / Nr + (ph - a) * Np / Nr;
        gears.push({ x: 0, y: 0, r: rp, N: Np, ph, w: wp, path: spur(Np, rp, p, 4), c: (c + 1) % nc, plane: 0,
          orb: { cx, cy, d: rs + rp, a, w: wc } });
      }
      // The ring: internal teeth inside a plain rim.
      const path = new Path2D();
      teeth(path, Nr, R + p * 0.36, R - p * 0.3);
      const rim = R + p * 0.36 + clamp(R * 0.09, 8, 24);
      path.moveTo(rim, 0);
      path.arc(0, 0, rim, 0, TAU);
      // Drawn as all rim: an empty web keys it.
      const web = new Path2D();
      rims.set(web, path);
      gears.push({ x: cx, y: cy, r: rim, N: Nr, ph: ring, w: 0, path: web, c: (c + 2) % nc, plane: 0 });
      carriers.push({ cx, cy, d: rs + rp, a: c0, w: wc, k: K, c: (c + 1) % nc });
    }

    return {
      lay() {
        // The same arrangement for the same size: a fresh rng from the seed each time.
        const rng = makeRng(s.seed * 7919 + 17);
        const m = Math.min(s.W, s.H);
        pitch = clamp(m * 0.032, 10, 20);
        v = pitch * 0.9;
        gears = []; carriers = []; rims.clear();
        if (layout === 2) {
          const two = s.W > s.H * 1.3 && s.W * s.H > 600000;
          const R = clamp(m * (two ? 0.3 : 0.34), 80, 300);
          if (two) { planetary(s.W * 0.28, s.H * 0.5, R, rng); planetary(s.W * 0.74, s.H * 0.42, R * 0.8, rng); }
          else planetary(s.W * 0.5, s.H * (s.H > s.W ? 0.38 : 0.5), R, rng);
        }
        grow(rng, layout === 2 ? 0.45 : layout === 1 ? 0.7 : 0.62);
        gears.sort((a, b) => a.plane - b.plane);
      },
      step() {},
      draw() {
        const { ctx } = s;
        const fill = s.dark ? 0.16 : 0.18, rim = s.dark ? 0.42 : 0.38, line = s.dark ? 0.55 : 0.6;
        for (const g of gears) {
          let x = g.x, y = g.y;
          if (g.orb) { const a = g.orb.a + g.orb.w * s.t; x = g.orb.cx + Math.cos(a) * g.orb.d; y = g.orb.cy + Math.sin(a) * g.orb.d; }
          const a = g.ph + g.w * s.t;
          const k = g.plane === 0 && layout === 1 ? 0.65 : 1;
          ctx.setTransform(s.dpr * Math.cos(a), s.dpr * Math.sin(a), -s.dpr * Math.sin(a), s.dpr * Math.cos(a), s.dpr * x, s.dpr * y);
          ctx.fillStyle = ctx.strokeStyle = s.colors[g.c];
          // Fills only: stroking these outlines cost several times as much as filling them.
          ctx.globalAlpha = fill * k;
          ctx.fill(g.path, 'evenodd');
          const rp = rims.get(g.path);
          if (rp) { ctx.globalAlpha = rim * k; ctx.fill(rp, 'evenodd'); }
        }
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
        // Carrier arms over the planets, and an axle on every gear.
        ctx.lineCap = 'round';
        for (const c of carriers) {
          ctx.strokeStyle = s.colors[c.c];
          ctx.globalAlpha = line * 0.7;
          ctx.lineWidth = clamp(c.d * 0.1, 4, 12);
          ctx.beginPath();
          for (let k = 0; k < c.k; k++) {
            const a = c.a + c.w * s.t + k * TAU / c.k;
            ctx.moveTo(c.cx, c.cy);
            ctx.lineTo(c.cx + Math.cos(a) * c.d, c.cy + Math.sin(a) * c.d);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = line;
        ctx.fillStyle = s.ink;
        ctx.beginPath();
        for (const g of gears) {
          if (g.w === 0) continue;
          let x = g.x, y = g.y;
          if (g.orb) { const a = g.orb.a + g.orb.w * s.t; x = g.orb.cx + Math.cos(a) * g.orb.d; y = g.orb.cy + Math.sin(a) * g.orb.d; }
          const r = clamp(g.r * 0.07, 1.5, 5);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
      },
    };
  });
}
