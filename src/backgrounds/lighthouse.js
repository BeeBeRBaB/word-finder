// Lighthouse: a night sea under stars, a lighthouse turning its beam slowly over the water.
// The beam is a wedge of light turning in depth, so it lengthens as it swings across, shrinks as
// it turns away, and the lantern swells softly when it faces the viewer; boats rock on the swell
// and brighten as it passes. The seed picks the variant: one tall lighthouse on a cliff headland
// at a side; a far island light near the horizon with two opposed beams and its reflection on
// the water, boats close in front; or a coast receding into the distance with three lights, each
// turning at its own pace.

import { stage, clamp, TAU } from './stage.js';
import { makeRng } from '../rng.js';

/**
 * @typedef {{sx:number, sy:number, h:number, X:number, Z:number, hL:number, th:number, w:number, twin:boolean,
 *   lx:number, ly:number, size:number}} Light
 * @typedef {{X:number, Z:number, v:number, kind:number, ph:number, col:number}} Boat
 */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const n = s.colors.length;
    const BEAM = s.colors[1 % n];
    /** @type {Light[]} */
    let lights = [];
    /** @type {Boat[]} */
    let boats = [];
    let hy = 300, f = 1000, cx = 0, mn = 600;
    const CAM = 10; // eye height over the sea, world units
    // Everything settled, in one cache drawn over the sea: sky, land and towers never overlap the
    // waves except where the land should hide them. (A second full-host cache is slow at 4K.)
    const cache = document.createElement('canvas');
    /** Land outline in CSS px, to keep waves and boats off it. */
    let landPath = new Path2D();
    let stale = true;
    s.onDpr = () => { stale = true; };
    /** @type {HTMLCanvasElement} */
    let glow = document.createElement('canvas');

    /** Depth of the sea at screen y. @param {number} y */
    const depth = (y) => f * CAM / Math.max(1, y - hy);
    /** Projects a world point. @param {number} X @param {number} Y @param {number} Z @param {number[]} out */
    function proj(X, Y, Z, out) { out[0] = cx + f * X / Z; out[1] = hy + f * (CAM - Y) / Z; }

    /** A light whose tower stands at screen (sx, sy), h px tall. @param {number} sx @param {number} sy @param {number} h @param {boolean} twin */
    function light(sx, sy, h, twin) {
      const Z = depth(sy), X = (sx - cx) * Z / f;
      // The lamp sits just under the tower top.
      const hL = (h * 0.86) * Z / f + 0;
      return { sx, sy, h, X, Z, hL, th: rng.random() * TAU, w: (rng.random() < 0.5 ? 1 : -1) * TAU / (18 + rng.random() * 8),
        twin, lx: sx, ly: sy - h * 0.86, size: h };
    }

    function build() {
      mn = Math.min(s.W, s.H);
      const wide = s.W >= s.H;
      f = Math.max(s.W, s.H) * 0.9;
      cx = s.W / 2;
      const r = makeRng(s.seed * 613 + 9);
      const left = r.random() < 0.5;
      lights = [];
      if (s.layout === 0) {
        // On a tall host the board covers the middle, so the scene sits low.
        hy = s.H * (wide ? 0.4 : 0.58);
        const sx = left ? s.W * (wide ? 0.13 : 0.2) : s.W * (wide ? 0.87 : 0.8);
        const sy = wide ? hy + (s.H - hy) * 0.32 : s.H * 0.9;
        lights.push(light(sx, sy, clamp(mn * (wide ? 0.36 : 0.46), 120, 380), false));
      } else if (s.layout === 1) {
        hy = s.H * (wide ? 0.42 : 0.74);
        const sx = left ? s.W * (wide ? 0.16 : 0.25) : s.W * (wide ? 0.84 : 0.75);
        lights.push(light(sx, hy + Math.max(6, (s.H - hy) * 0.035), clamp(mn * 0.11, 40, 120), true));
      } else {
        hy = s.H * (wide ? 0.38 : 0.64);
        for (let k = 0; k < 3; k++) {
          const u = [0.62, 0.24, 0.07][k];
          const sx = left ? s.W * (0.08 + (1 - u) * 0.3 + k * 0.02) : s.W * (0.92 - (1 - u) * 0.3 - k * 0.02);
          lights.push(light(sx, hy + (s.H - hy) * u * 0.6 + 4, clamp(mn * [0.26, 0.12, 0.05][k], [90, 40, 18][k], [280, 130, 56][k]), false));
        }
      }
      // Boats, at depths that land on the sea in view.
      const nb = clamp(Math.round(s.W * s.H / 160000), 3, 9);
      const near = s.layout === 1;
      if (boats.length !== nb) {
        boats = [];
        for (let k = 0; k < nb; k++) boats.push(newBoat(r, true, near));
      }
      makeGlow();
      stale = true;
    }

    /** @param {import('../rng.js').Rng} r @param {boolean} anywhere @param {boolean} near @returns {Boat} */
    function newBoat(r, anywhere, near) {
      const y = hy + (s.H - hy) * (near ? 0.25 + r.random() * 0.65 : 0.06 + r.random() * 0.75);
      const Z = depth(y);
      const v = (r.random() < 0.5 ? -1 : 1) * (0.6 + r.random() * 0.8) * Z / f * 18;
      const halfW = (s.W / 2 + 80) * Z / f;
      const X = anywhere ? (r.random() * 2 - 1) * halfW : -Math.sign(v) * halfW;
      return { X, Z, v, kind: r.int(3), ph: r.random() * TAU, col: r.int(n) };
    }

    /** A soft round glow in the beam colour, as a sprite. */
    function makeGlow() {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      if (g) {
        g.fillStyle = BEAM;
        g.fillRect(0, 0, 64, 64);
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(0.2, 'rgba(0,0,0,.6)');
        grad.addColorStop(0.55, 'rgba(0,0,0,.15)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalCompositeOperation = 'destination-in';
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
      }
      glow = c;
    }

    /** Stars, land and towers, settled, into the cache at device pixels. */
    function paintCache() {
      stale = false;
      cache.width = s.cv.width; cache.height = s.cv.height;
      const c = cache.getContext('2d');
      if (!c) return;
      const r = makeRng(s.seed * 41 + 2);
      c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      // Stars, denser and smaller towards the horizon's haze.
      c.fillStyle = s.ink;
      const ns = clamp(Math.round(s.W * hy / 2600), 30, 400);
      for (let k = 0; k < ns; k++) {
        const x = r.random() * s.W, y = Math.pow(r.random(), 1.4) * hy * 0.94;
        const big = r.random() < 0.12;
        c.globalAlpha = (s.dark ? 0.3 : 0.26) + r.random() * 0.3;
        c.beginPath(); c.arc(x, y, big ? 1.6 : 0.9, 0, TAU); c.fill();
      }
      // Horizon line.
      c.globalAlpha = s.dark ? 0.3 : 0.32;
      c.strokeStyle = s.ink;
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, hy); c.lineTo(s.W, hy); c.stroke();
      // A crescent moon away from the lights.
      const L0 = lights[0];
      const mx = L0.sx < s.W / 2 ? s.W * 0.8 : s.W * 0.2, my = hy * 0.3, mr = clamp(mn * 0.035, 10, 30);
      c.globalAlpha = s.dark ? 0.4 : 0.45;
      c.fillStyle = s.colors[1 % n];
      c.beginPath();
      c.arc(mx, my, mr, 0.6, TAU - 0.6 + 0.0001, true);
      c.arc(mx - mr * 0.45, my - mr * 0.1, mr * 0.85, TAU - 0.9, 0.9, false);
      c.fill();
      land(c, r);
      for (const L of lights) tower(c, L);
    }

    /** The land for each variant: headland, islet, or receding coast. @param {CanvasRenderingContext2D} c @param {import('../rng.js').Rng} r */
    function land(c, r) {
      /** @type {number[][]} */
      const poly = [];
      const L0 = lights[0];
      const side = L0.sx < s.W / 2 ? -1 : 1;
      const X = (/** @type {number} */ x) => (side < 0 ? x : s.W - x);
      if (s.layout === 0) {
        const top = L0.sy, base = L0.sx < s.W / 2 ? L0.sx : s.W - L0.sx;
        poly.push([X(-10), s.H + 10], [X(-10), top - L0.h * 0.06]);
        for (let k = 0; k <= 6; k++) poly.push([X(base * (k / 6) * 1.4), top - L0.h * 0.06 + Math.sin(k * 1.7) * L0.h * 0.02 + (k / 6) * L0.h * 0.06]);
        // The cliff face drops to the sea and runs out to the near edge.
        const drop = s.H - top;
        poly.push([X(base * 1.4 + L0.h * 0.25), top + L0.h * 0.12], [X(base * 1.4 + L0.h * 0.35), top + drop * 0.3]);
        poly.push([X(base * 1.4 + L0.h * 0.55), top + drop * 0.75], [X(base * 1.4 + L0.h * 0.5), s.H + 10]);
      } else if (s.layout === 1) {
        const w = L0.h * 1.6;
        poly.push([L0.sx - w, L0.sy + 2], [L0.sx - w * 0.5, L0.sy - L0.h * 0.08], [L0.sx - w * 0.15, L0.sy - L0.h * 0.12],
          [L0.sx + w * 0.3, L0.sy - L0.h * 0.1], [L0.sx + w * 0.7, L0.sy - L0.h * 0.03], [L0.sx + w, L0.sy + 2]);
      } else {
        // The coast runs from the near corner to the horizon, each light on a point of it.
        poly.push([X(-10), s.H + 10], [X(-10), hy - 2]);
        poly.push([X(s.W * 0.5), hy - 1]);
        for (let k = lights.length - 1; k >= 0; k--) {
          const L = lights[k];
          const lx = side < 0 ? L.sx : s.W - L.sx;
          poly.push([X(lx - L.h * 0.1), L.sy - L.h * 0.05], [X(lx + L.h * 0.35), L.sy + 1], [X(lx + L.h * 0.1), L.sy + L.h * 0.2 + 3]);
        }
        poly.push([X(s.W * 0.2), s.H * 0.92], [X(s.W * 0.26), s.H + 10]);
      }
      void r;
      c.globalAlpha = s.dark ? 0.16 : 0.14;
      c.fillStyle = s.ink;
      landPath = new Path2D();
      poly.forEach((p, k) => (k ? landPath.lineTo(p[0], p[1]) : landPath.moveTo(p[0], p[1])));
      landPath.closePath();
      c.fill(landPath);
      c.globalAlpha = s.dark ? 0.36 : 0.4;
      c.strokeStyle = s.ink;
      c.lineWidth = 1.2;
      c.stroke(landPath);
    }

    /** A tapered striped tower with gallery and lantern. @param {CanvasRenderingContext2D} c @param {Light} L */
    function tower(c, L) {
      const h = L.h, bw = h * 0.16, tw = h * 0.1, top = L.sy - h * 0.78;
      const at = (/** @type {number} */ u) => bw + (tw - bw) * u;
      const bands = 4;
      for (let k = 0; k < bands; k++) {
        const u0 = k / bands, u1 = (k + 1) / bands;
        const y0 = L.sy - (L.sy - top) * u0, y1 = L.sy - (L.sy - top) * u1;
        c.globalAlpha = k % 2 ? (s.dark ? 0.32 : 0.3) : (s.dark ? 0.5 : 0.52);
        c.fillStyle = k % 2 ? s.ink : s.colors[3 % n];
        c.beginPath();
        c.moveTo(L.sx - at(u0) / 2, y0); c.lineTo(L.sx + at(u0) / 2, y0);
        c.lineTo(L.sx + at(u1) / 2, y1); c.lineTo(L.sx - at(u1) / 2, y1);
        c.closePath(); c.fill();
      }
      // Gallery, lantern glass and cap.
      c.globalAlpha = s.dark ? 0.55 : 0.6;
      c.fillStyle = s.ink;
      c.fillRect(L.sx - tw * 0.8, top - h * 0.02, tw * 1.6, Math.max(1.5, h * 0.022));
      c.globalAlpha = s.dark ? 0.4 : 0.45;
      c.strokeStyle = s.ink;
      c.lineWidth = Math.max(1, h * 0.008);
      c.strokeRect(L.sx - tw * 0.38, top - h * 0.1, tw * 0.76, h * 0.08);
      c.globalAlpha = s.dark ? 0.55 : 0.6;
      c.beginPath();
      c.moveTo(L.sx - tw * 0.5, top - h * 0.1);
      c.quadraticCurveTo(L.sx, top - h * 0.17, L.sx + tw * 0.5, top - h * 0.1);
      c.closePath(); c.fill();
      L.ly = top - h * 0.06;
    }

    const a = [0, 0], e = [0, 0];
    const far = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];

    /** One beam from a light at heading th (0 east, pi/2 away from the viewer). @param {Light} L @param {number} th */
    function beam(L, th) {
      const { ctx } = s;
      const dx = Math.cos(th), dz = Math.sin(th);
      // Never closer to the eye than a third of the light's own distance.
      let R = L.Z * 2.6;
      if (dz < 0) R = Math.min(R, (L.Z * 0.66) / -dz);
      const spread = 0.085;
      const yEnd = L.hL * 0.75;
      // The far end of the cone: left, right, top and bottom; the beam is their hull with the lamp.
      const ex = L.X + dx * R, ez = L.Z + dz * R, sr = spread * R;
      proj(ex - dz * sr, yEnd, ez + dx * sr, far[0]);
      proj(ex + dz * sr, yEnd, ez - dx * sr, far[1]);
      proj(ex, yEnd + sr * 0.35, ez, far[2]);
      proj(ex, yEnd - sr * 0.35, ez, far[3]);
      proj(ex, yEnd, ez, e);
      far[4][0] = L.lx; far[4][1] = L.ly;
      const hull = convex(far);
      const g = ctx.createLinearGradient(L.lx, L.ly, e[0], e[1]);
      g.addColorStop(0, BEAM);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      // Facing away the wedge is short and faint; swinging across, long and clear.
      ctx.globalAlpha = (s.dark ? 0.3 : 0.32) * (0.55 + 0.45 * Math.abs(dx));
      ctx.beginPath();
      hull.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
    }

    /** Convex hull of a few points, monotone chain. @param {number[][]} pts @returns {number[][]} */
    function convex(pts) {
      const p = pts.slice().sort((u, v) => u[0] - v[0] || u[1] - v[1]);
      const cr = (/** @type {number[]} */ o, /** @type {number[]} */ u, /** @type {number[]} */ v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
      /** @type {number[][]} */
      const lo = [], hi = [];
      for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
      for (let k = p.length - 1; k >= 0; k--) { const q = p[k]; while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
      return lo.slice(0, -1).concat(hi.slice(0, -1));
    }

    /** How much the light faces the viewer, smoothly, 0..1. @param {Light} L */
    function facing(L) {
      const v = -Math.sin(L.th);
      const t = L.twin ? Math.abs(v) : Math.max(0, v);
      return t * t * t;
    }

    /** Boat lit by any beam passing over it, 0..1. @param {Boat} bt */
    function litBy(bt) {
      let best = 0;
      for (const L of lights) {
        const ang = Math.atan2(bt.Z - L.Z, bt.X - L.X);
        for (const off of L.twin ? [0, Math.PI] : [0]) {
          let d = Math.abs(((ang - L.th - off) % TAU + TAU + Math.PI) % TAU - Math.PI);
          d = Math.exp(-((d / 0.22) ** 2));
          if (d > best) best = d;
        }
      }
      return best;
    }

    /** Waves: short dashes in rows that crowd towards the horizon, drifting slowly. */
    function waves() {
      const { ctx } = s;
      ctx.strokeStyle = s.ink;
      ctx.lineWidth = 1;
      ctx.globalAlpha = s.dark ? 0.22 : 0.26;
      ctx.beginPath();
      const rows = clamp(Math.round((s.H - hy) / 22), 8, 26);
      for (let q = 1; q <= rows; q++) {
        const u = Math.pow(q / rows, 1.7);
        const y = hy + (s.H - hy) * u;
        const len = 3 + 30 * u, gap = len * 3.2;
        const drift = (s.t * (4 + 14 * u) + q * 37) % gap;
        for (let x = -gap + drift, i = 0; x < s.W; x += gap, i++) {
          const j = ((i * 9301 + q * 49297) % 233) / 233;
          const bob = Math.sin(s.t * 0.8 + i * 1.3 + q) * 0.8 * u;
          const xx = x + j * gap * 0.5;
          ctx.moveTo(xx, y + bob); ctx.lineTo(xx + len * (0.6 + j * 0.6), y + bob);
        }
      }
      ctx.stroke();
    }

    /** A boat at its place: a sailing boat, a fishing boat with a wheelhouse, or a rowing boat. @param {Boat} bt */
    function boat(bt) {
      const { ctx } = s;
      proj(bt.X, 0, bt.Z, a);
      const k = f / bt.Z * 0.5;
      if (a[0] < -k * 6 || a[0] > s.W + k * 6) return;
      const lit = litBy(bt);
      const dir = Math.sign(bt.v) || 1;
      const roll = Math.sin(s.t * 0.9 + bt.ph) * 0.06;
      const x = a[0], y = a[1] + Math.sin(s.t * 1.1 + bt.ph) * k * 0.15;
      // Rock by roll, then face the way it sails.
      const co = Math.cos(roll) * s.dpr, si = Math.sin(roll) * s.dpr;
      ctx.setTransform(dir * co, dir * si, -si, co, x * s.dpr, y * s.dpr);
      if (lit > 0.02) {
        ctx.globalCompositeOperation = s.dark ? 'lighter' : 'source-over';
        ctx.globalAlpha = lit * (s.dark ? 0.45 : 0.35);
        ctx.drawImage(glow, -k * 5, -k * 5, k * 10, k * 10);
        ctx.globalCompositeOperation = 'source-over';
      }
      const col = s.colors[bt.col % n];
      ctx.globalAlpha = (s.dark ? 0.4 : 0.45) + lit * 0.3;
      ctx.fillStyle = col;
      ctx.beginPath();
      // Hull.
      ctx.moveTo(-k * 2.2, -k * 0.5); ctx.lineTo(k * 2.4, -k * 0.6);
      ctx.lineTo(k * 1.6, k * 0.35); ctx.lineTo(-k * 1.7, k * 0.35); ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = (s.dark ? 0.32 : 0.38) + lit * 0.35;
      ctx.fillStyle = s.ink;
      ctx.beginPath();
      if (bt.kind === 0) {
        ctx.moveTo(-k * 0.1, -k * 0.7); ctx.lineTo(-k * 0.1, -k * 4.2); ctx.lineTo(k * 1.7, -k * 0.8); ctx.closePath();
        ctx.moveTo(-k * 0.3, -k * 0.7); ctx.lineTo(-k * 0.3, -k * 3.4); ctx.lineTo(-k * 1.6, -k * 0.8); ctx.closePath();
      } else if (bt.kind === 1) {
        ctx.rect(-k * 1.3, -k * 1.8, k * 1.4, k * 1.2);
        ctx.rect(k * 0.6, -k * 2.6, k * 0.18, k * 2);
      } else {
        ctx.rect(-k * 1.6, -k * 0.85, k * 3.2, k * 0.25);
      }
      ctx.fill();
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    }

    return {
      lay() {
        build();
      },
      step(dt) {
        for (const L of lights) L.th += L.w * dt;
        boats.forEach((bt, k) => {
          bt.X += bt.v * dt;
          const halfW = (s.W / 2 + 120) * bt.Z / f;
          if (Math.abs(bt.X) > halfW) boats[k] = newBoat(rng, false, s.layout === 1);
        });
      },
      draw() {
        const { ctx } = s;
        if (stale) paintCache();
        // Waves and boats stay off the land, as though behind it.
        ctx.save();
        const clip = new Path2D();
        clip.rect(0, 0, s.W, s.H);
        clip.addPath(landPath);
        ctx.clip(clip, 'evenodd');
        waves();
        // Reflection of the lantern on the water, for the island light.
        for (const L of lights) {
          if (!L.twin) continue;
          const fc = 0.35 + 0.65 * facing(L);
          ctx.strokeStyle = BEAM;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let q = 0; q < 16; q++) {
            const y = L.sy + 4 + q * q * 1.6;
            if (y > s.H) break;
            const wv = (3 + q * 1.6) * (0.6 + 0.4 * Math.sin(s.t * 0.9 + q * 1.7));
            ctx.moveTo(L.sx - wv, y); ctx.lineTo(L.sx + wv, y);
          }
          ctx.globalAlpha = (s.dark ? 0.32 : 0.36) * fc;
          ctx.stroke();
        }
        boats.slice().sort((p, q) => q.Z - p.Z).forEach(boat);
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.drawImage(cache, 0, 0, s.W, s.H);
        if (s.dark) ctx.globalCompositeOperation = 'lighter';
        for (const L of lights) {
          beam(L, L.th);
          if (L.twin) beam(L, L.th + Math.PI);
        }
        for (const L of lights) {
          const fc = facing(L);
          const gr = L.h * (0.12 + 0.4 * fc);
          ctx.globalAlpha = (s.dark ? 0.45 : 0.4) + 0.35 * fc;
          ctx.drawImage(glow, L.lx - gr, L.ly - gr, gr * 2, gr * 2);
        }
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  });
}
