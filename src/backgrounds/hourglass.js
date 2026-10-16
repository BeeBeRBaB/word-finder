// Hourglass: sand runs through the necks of hourglasses, the top falling away in a dip and the
// pile below growing to a peak, and when the top is empty the glass turns over, the sand
// sliding level as it goes, and runs again. Each runs at its own pace.
// Layout 0: a grid of equal glasses. 1: shelves of glasses of mixed sizes, each turning over
// where it stands. 2: a few tall glasses, their streams falling grain by grain.

import { stage, clamp } from './stage.js';
import { roundRect } from './shapes.js';

/** @typedef {{x:number, y:number, hb:number, rb:number, c:number, poly:Float32Array, cap:number,
 *   a:number, b:number, rate:number, phi:number, from:number, way:number, mode:number, u:number,
 *   wait:number, run:number, spr:HTMLCanvasElement|null, ox:number, oy:number, da:number, db:number,
 *   dg:number, end:number}} Glass
 * Neck at x, y; bulb height hb and half width rb; colour c; the upper bulb's outline (x, y pairs
 * about the neck; the lower bulb is its mirror) and its area cap; sand area a in the bulb drawn
 * above the neck at phi 0 and b in the other; area per second through the neck; the turn phi
 * and, while turning (mode 2, u 0..1), where from and which way; running (0), waiting to turn
 * (1, wait seconds); seconds it has been running. At rest it is drawn from its sprite spr at
 * ox, oy, made with sand areas da, db and pile growth dg (da -1: remake it); end is the y its
 * stream falls to. */

const STEPS = 20;       // outline points down each side of a bulb
const TURN = 2.2;       // seconds a turn over takes
const ITER = 14;        // halvings when finding a sand level

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    /** @type {Glass[]} */
    let glasses = [];
    /** @type {number[]} */
    let shelves = [];
    let key = '';
    // Scratch for the outline in screen space and for clipping it.
    const wx = new Float32Array(STEPS * 2 + 2), wy = new Float32Array(STEPS * 2 + 2);
    const cx = new Float32Array(STEPS * 4 + 8), cy = new Float32Array(STEPS * 4 + 8);

    /** @param {number} x @param {number} y @param {number} hb @param {number} time seconds to run through
     * @returns {Glass} */
    function glass(x, y, hb, time) {
      const rb = hb * 0.6, nw = Math.max(1.2, hb * 0.045);
      const poly = new Float32Array((STEPS + 1) * 4);
      // Right side up from the neck, then left side back down: a round bulb pinched to the neck.
      for (let i = 0; i <= STEPS; i++) {
        const t = Math.pow(i / STEPS, 1.3);
        const w = nw + (rb - nw) * Math.sqrt(Math.max(0, 1 - ((t - 0.6) / 0.6) ** 2));
        poly[i * 2] = w; poly[i * 2 + 1] = -t * hb;
        poly[(2 * STEPS + 1 - i) * 2] = -w; poly[(2 * STEPS + 1 - i) * 2 + 1] = -t * hb;
      }
      let cap = 0;
      for (let i = 0, n = STEPS * 2 + 2; i < n; i++) {
        const j = (i + 1) % n;
        cap += poly[i * 2] * poly[j * 2 + 1] - poly[j * 2] * poly[i * 2 + 1];
      }
      cap = Math.abs(cap) / 2;
      const sand = cap * 0.72, f = rng.random();
      return { x, y, hb, rb, c: rng.int(s.colors.length), poly, cap, a: sand * (1 - f), b: sand * f,
        rate: sand / time, phi: 0, from: 0, way: 1, mode: 0, u: 0, wait: 0, run: 9,
        spr: null, ox: 0, oy: 0, da: -1, db: 0, dg: 0, end: NaN };
    }

    /** Fresh glasses for this size. @returns {void} */
    function deal() {
      const m = Math.min(s.W, s.H);
      glasses = []; shelves = [];
      if (L === 0) {
        const hb = clamp(m * 0.07, 24, 64), dx = hb * 2.3, dy = hb * 3.1;
        const cols = clamp(Math.floor(s.W / dx), 2, 12), rows = clamp(Math.floor(s.H / dy), 2, 7);
        const gx = s.W / cols, gy = s.H / rows;
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          glasses.push(glass(gx * (i + 0.5), gy * (j + 0.5), hb, 24 + rng.random() * 20));
        }
      } else if (L === 1) {
        const big = clamp(m * 0.085, 26, 76);
        const rows = clamp(Math.floor(s.H / (big * 3)), 2, 6), gy = s.H / rows;
        for (let j = 0; j < rows; j++) {
          const sy = gy * (j + 0.82);
          shelves.push(sy);
          let x = big * 0.4 + rng.random() * big;
          for (;;) {
            const hb = big * (0.45 + rng.random() * 0.55), w = hb * 1.6;
            if (x + w > s.W - big * 0.3) break;
            // Standing on the shelf: the base plate's underside is on its line.
            glasses.push(glass(x + w / 2, sy - hb * 1.14, hb, 14 + hb / big * 30 + rng.random() * 8));
            x += w + big * (0.2 + rng.random() * 0.5);
          }
        }
      } else {
        const tall = s.H > s.W * 1.2;
        const n = tall ? 2 : clamp(Math.round(s.W / (s.H * 0.55)), 2, 5);
        const hb = clamp(tall ? s.H * 0.19 : s.H * 0.3, 40, 230);
        for (let i = 0; i < n; i++) {
          const x = tall ? s.W * (i ? 0.7 : 0.3) : s.W * (i + 0.5) / n;
          const y = tall ? s.H * (i ? 0.73 : 0.27) : s.H / 2 + (i % 2 ? hb * 0.12 : -hb * 0.12);
          glasses.push(glass(x, y, hb * (tall ? 1 : 0.85 + rng.random() * 0.15), 40 + rng.random() * 25));
        }
      }
    }

    /** The bulb's outline turned to the glass's angle, into wx, wy. @param {Glass} g @param {number} up 1 the
     * bulb above the neck at phi 0, -1 the other @returns {number} point count */
    function place(g, up) {
      const c = Math.cos(g.phi), sn = Math.sin(g.phi), n = STEPS * 2 + 2;
      for (let i = 0; i < n; i++) {
        const lx = g.poly[i * 2], ly = g.poly[i * 2 + 1] * up;
        wx[i] = g.x + c * lx - sn * ly; wy[i] = g.y + sn * lx + c * ly;
      }
      return n;
    }

    /** Clips wx, wy to the part below `level` into cx, cy. @param {number} n @param {number} level @returns {number} */
    function clip(n, level) {
      let k = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, ia = wy[i] >= level, ja = wy[j] >= level;
        if (ia) { cx[k] = wx[i]; cy[k] = wy[i]; k++; }
        if (ia !== ja) {
          const f = (level - wy[i]) / (wy[j] - wy[i]);
          cx[k] = wx[i] + (wx[j] - wx[i]) * f; cy[k] = level; k++;
        }
      }
      return k;
    }

    /** @param {number} k @returns {number} area of cx, cy */
    function area(k) {
      let a = 0;
      for (let i = 0; i < k; i++) { const j = (i + 1) % k; a += cx[i] * cy[j] - cx[j] * cy[i]; }
      return Math.abs(a) / 2;
    }

    /** Adds a bulb's sand to `path`, level as water lies, with a peak on a growing pile or a dip
     * in a draining one. @param {Path2D} path @param {Glass} g @param {number} up @param {number} sand
     * @param {number} shape 1 peak, -1 dip, 0 flat @returns {number} the top's y (the peak's, if any) */
    function sand(path, g, up, sand, shape) {
      if (sand < g.cap * 0.002) return NaN;
      const n = place(g, up);
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n; i++) { lo = Math.min(lo, wy[i]); hi = Math.max(hi, wy[i]); }
      for (let it = 0; it < ITER; it++) {
        const mid = (lo + hi) / 2;
        if (area(clip(n, mid)) > sand) lo = mid; else hi = mid;
      }
      const level = (lo + hi) / 2, k = clip(n, level);
      if (k < 3) return NaN;
      path.moveTo(cx[0], cy[0]);
      for (let i = 1; i < k; i++) path.lineTo(cx[i], cy[i]);
      path.closePath();
      if (!shape) return level;
      // The surface's ends, for the peak's or dip's width.
      let l = Infinity, r = -Infinity;
      for (let i = 0; i < k; i++) if (Math.abs(cy[i] - level) < 0.01) { l = Math.min(l, cx[i]); r = Math.max(r, cx[i]); }
      // A cone from wall to wall, never reaching past the neck.
      // The pile builds over its first seconds, and slumps flat early in a turn.
      const half = (r - l) * 0.48, mx = (l + r) / 2;
      if (!(half > 1)) return level;
      const grow = g.mode === 2 ? clamp(1 - g.u * 3, 0, 1) : clamp(g.run / 2, 0, 1);
      const h = Math.min(half * 0.5 * grow, Math.abs(g.y - level) * 0.85);
      if (h < 0.3) return level;
      // Its own triangle, sharing the surface edge: evenodd adds a peak and cuts a dip.
      path.moveTo(mx - half, level); path.lineTo(mx + half, level); path.lineTo(mx, level - shape * h); path.closePath();
      return shape > 0 ? level - h : level;
    }

    /** Draws one glass, its sand, plates and posts, on c2 (in the page's CSS px).
     * @param {CanvasRenderingContext2D} c2 @param {Glass} g @returns {void} */
    function render(c2, g) {
      const sp = new Path2D(), pl = new Path2D(), gp = new Path2D(), po = new Path2D();
      const topUp = (g.mode === 2 ? g.from : g.phi) < 1 ? 1 : -1;
      const tA = sand(sp, g, 1, g.a, -topUp), tB = sand(sp, g, -1, g.b, topUp);
      g.end = topUp > 0 ? tB : tA;
      for (const up of [1, -1]) {
        const n = place(g, up);
        gp.moveTo(wx[0], wy[0]);
        for (let i = 1; i < n; i++) gp.lineTo(wx[i], wy[i]);
      }
      // Plates top and bottom and the posts between, turned with the glass.
      const c = Math.cos(g.phi), sn = Math.sin(g.phi), pw = g.rb * 1.25, ph = g.hb * 0.12, py = g.hb * 1.02;
      /** @param {number} lx @param {number} ly @returns {[number, number]} */
      const at = (lx, ly) => [g.x + c * lx - sn * ly, g.y + sn * lx + c * ly];
      for (const side of [-1, 1]) {
        const corners = [at(-pw, side * py), at(pw, side * py), at(pw, side * (py + ph)), at(-pw, side * (py + ph))];
        pl.moveTo(corners[0][0], corners[0][1]);
        for (const [qx, qy] of corners) pl.lineTo(qx, qy);
        pl.closePath();
        const [q0x, q0y] = at(side * pw * 0.86, -py), [q1x, q1y] = at(side * pw * 0.86, py);
        po.moveTo(q0x, q0y); po.lineTo(q1x, q1y);
      }
      const col = s.colors[g.c];
      c2.lineJoin = 'round'; c2.lineCap = 'round';
      c2.fillStyle = col; c2.strokeStyle = col;
      c2.globalAlpha = L === 2 ? (s.dark ? 0.36 : 0.4) : s.dark ? 0.46 : 0.5; c2.fill(sp, 'evenodd');
      c2.globalAlpha = s.dark ? 0.3 : 0.34; c2.fill(pl);
      c2.globalAlpha = s.dark ? 0.5 : 0.55; c2.lineWidth = 1.5; c2.stroke(pl);
      c2.fillStyle = s.ink; c2.strokeStyle = s.ink;
      c2.globalAlpha = s.dark ? 0.05 : 0.07; c2.fill(gp);
      c2.globalAlpha = s.dark ? 0.4 : 0.48; c2.stroke(gp);
      c2.globalAlpha = s.dark ? 0.3 : 0.38; c2.stroke(po);
      c2.globalAlpha = 1;
    }

    /** Redraws a resting glass's sprite, placed on whole device pixels so it copies 1:1.
     * @param {Glass} g @param {number} grow @returns {void} */
    function cache(g, grow) {
      const half = g.rb * 1.25 + 3, tall = g.hb * 1.14 + 3, d = s.dpr;
      const w = Math.ceil(half * 2 * d) + 2, h = Math.ceil(tall * 2 * d) + 2;
      if (!g.spr || g.spr.width !== w || g.spr.height !== h) {
        g.spr = document.createElement('canvas'); g.spr.width = w; g.spr.height = h;
      }
      const c2 = g.spr.getContext('2d');
      if (!c2) { g.spr = null; return; }
      g.ox = Math.floor((g.x - half) * d) / d; g.oy = Math.floor((g.y - tall) * d) / d;
      c2.setTransform(1, 0, 0, 1, 0, 0);
      c2.clearRect(0, 0, w, h);
      c2.setTransform(d, 0, 0, d, -g.ox * d, -g.oy * d);
      render(c2, g);
      g.da = g.a; g.db = g.b; g.dg = grow;
    }

    return {
      lay() {
        const k = `${s.W}x${s.H}`;
        if (k === key) return;
        key = k;
        deal();
        s.onDpr = () => { for (const g of glasses) g.da = -1; };
      },
      step(dt) {
        for (const g of glasses) {
          if (g.mode === 0) {
            // Phi 0 runs bulb a into b; phi pi, b into a.
            const top = g.phi < 1 ? 'a' : 'b', bot = top === 'a' ? 'b' : 'a';
            const q = Math.min(g[top], g.rate * dt);
            g[top] -= q; g[bot] += q; g.run += dt;
            if (g[top] <= 0) { g.mode = 1; g.wait = 1.5 + rng.random() * 3; }
          } else if (g.mode === 1) {
            g.wait -= dt;
            if (g.wait <= 0) { g.mode = 2; g.u = 0; g.from = g.phi; g.way = rng.random() < 0.5 ? 1 : -1; }
          } else {
            g.u = Math.min(1, g.u + dt / TURN);
            const e = g.u * g.u * (3 - 2 * g.u);
            g.phi = g.from + g.way * Math.PI * e;
            if (g.u >= 1) { g.phi = g.from > 1 ? 0 : Math.PI; g.mode = 0; g.run = 0; }
          }
        }
      },
      draw() {
        const { ctx } = s;
        /** @type {Path2D[]} */
        const streams = s.colors.map(() => new Path2D()), grains = s.colors.map(() => new Path2D());
        let budget = 2;
        for (const g of glasses) {
          if (g.mode === 2) { render(ctx, g); g.da = -1; }
          else {
            // A glass at rest is drawn into its own sprite, redrawn once its sand has moved a little.
            const grow = clamp(g.run / 2, 0, 1);
            const stale = Math.abs(g.a - g.da) + Math.abs(g.b - g.db) > g.cap * 0.02 || Math.abs(grow - g.dg) > 0.12;
            if (!g.spr || g.da < 0 || (stale && budget-- > 0)) cache(g, grow);
            if (g.spr) ctx.drawImage(g.spr, g.ox, g.oy, g.spr.width / s.dpr, g.spr.height / s.dpr);
          }
          const topUp = g.phi < 1 ? 1 : -1;
          if (g.mode === 0 && g[topUp > 0 ? 'a' : 'b'] > 0) {
            // The stream from the neck to the pile, with grains falling down it.
            const y1 = isNaN(g.end) ? g.y + g.hb * 0.95 : g.end;
            streams[g.c].moveTo(g.x, g.y); streams[g.c].lineTo(g.x, y1);
            const len = y1 - g.y, gap = Math.max(4, g.hb * 0.09), v = g.hb * 1.1;
            for (let y = (s.t * v) % gap; y < len - 1; y += gap) grains[g.c].rect(g.x - 1, g.y + y, 2, 2);
          }
        }
        ctx.lineCap = 'round';
        for (let k = 0; k < s.colors.length; k++) {
          ctx.strokeStyle = s.colors[k]; ctx.fillStyle = s.colors[k];
          ctx.lineWidth = 1.2; ctx.globalAlpha = s.dark ? 0.35 : 0.42; ctx.stroke(streams[k]);
          ctx.globalAlpha = 0.6; ctx.fill(grains[k]);
        }
        ctx.strokeStyle = s.ink; ctx.fillStyle = s.ink; ctx.lineWidth = 1.5;
        if (shelves.length) {
          const sh = new Path2D();
          for (const y of shelves) roundRect(asCtx(sh), -4, y, s.W + 8, 5, 2);
          ctx.globalAlpha = s.dark ? 0.12 : 0.14; ctx.fill(sh);
          ctx.globalAlpha = s.dark ? 0.3 : 0.38; ctx.stroke(sh);
        }
      },
    };
  });
}

/** A path, for roundRect, which uses only the calls the two share. @param {Path2D} p @returns {CanvasRenderingContext2D} */
const asCtx = (p) => /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (p));
