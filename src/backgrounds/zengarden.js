// Zen garden: raked sand seen from above, a few stones each ringed by circles, the rest of the
// sand combed in rows that stop short of the rings. A rake works its way round the garden pass by
// pass, its tines cutting fresh grooves while the oldest ones slowly smooth away. The seed picks
// the variant: straight rows, as in a temple garden; wave rows, rippling like water; or sweeping
// arcs, centred off one corner.

import { stage, TAU, clamp } from './stage.js';

const TINES = 5;

/** @typedef {{x:number, y:number, r:number, pts:number[], c:number}} Stone */
/** @typedef {{xy:Float32Array[], on:Uint8Array[], cum:Float32Array, n:number, straight:boolean, path:Path2D, at:number}} Pass */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const C = s.colors.length;
    const first = rng.int(C);
    // Stones in host fractions with a shape each, so a resize keeps the same garden.
    const seeds = Array.from({ length: 6 }, () => ({ u: rng.random(), v: rng.random(), r: 0.75 + rng.random() * 0.5,
      pts: Array.from({ length: 9 }, () => 0.8 + rng.random() * 0.3), c: rng.int(C) }));
    const phase = rng.random() * TAU;
    /** @type {Stone[]} */
    let stones = [];
    /** @type {Pass[]} */
    let passes = [];
    let m = 1, sp = 6, zone = 1, cur = 0, dist = 0, speed = 100, cycle = 1, T = 0, laid = false;
    // The settled grooves, painted once at device pixels and again only when a pass is done:
    // stroking every curved groove each frame is too slow on a big screen. Their fading moves
    // on in those steps, too small to see.
    const cache = document.createElement('canvas');
    let dirty = true;

    /** Places the stones, apart from each other, for the current size. @returns {void} */
    function place() {
      const n = clamp(Math.round(s.W * s.H / 260000), 2, 6);
      stones = [];
      for (const q of seeds) {
        if (stones.length >= n) break;
        const r = m * 0.045 * q.r;
        const x = (0.08 + q.u * 0.84) * s.W, y = (0.1 + q.v * 0.8) * s.H;
        if (stones.some((t) => Math.hypot(t.x - x, t.y - y) < zone * 2 + t.r + r)) continue;
        stones.push({ x, y, r, pts: q.pts, c: q.c });
      }
      // Too crowded for the seeded spots (a small host): fall back to a diagonal.
      if (!stones.length) stones.push({ x: s.W * 0.3, y: s.H * 0.3, r: m * 0.045, pts: seeds[0].pts, c: seeds[0].c });
    }

    /** Builds one pass from its tines' sample points. @param {Float32Array[]} xy @param {boolean} straight
     * @param {boolean} clip whether rows stop short of the stones' rings @returns {Pass} */
    function pass(xy, straight, clip) {
      const n = xy[0].length / 2, mid = xy[(TINES - 1) / 2];
      const on = xy.map((a) => {
        const o = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          const x = a[i * 2], y = a[i * 2 + 1];
          o[i] = x > -20 && x < s.W + 20 && y > -20 && y < s.H + 20 && (!clip || stones.every((t) => Math.hypot(x - t.x, y - t.y) > t.r + zone)) ? 1 : 0;
        }
        return o;
      });
      const cum = new Float32Array(n);
      for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(mid[i * 2] - mid[i * 2 - 2], mid[i * 2 + 1] - mid[i * 2 - 1]);
      const p = { xy, on, cum, n, straight, path: new Path2D(), at: 0 };
      trace(p.path, p, n);
      return p;
    }

    /** Adds pass p's grooves up to sample `upto` to `ctx`. @param {Path2D|CanvasRenderingContext2D} ctx
     * @param {Pass} p @param {number} upto @returns {void} */
    function trace(ctx, p, upto) {
      for (let k = 0; k < TINES; k++) {
        const a = p.xy[k], o = p.on[k];
        let run = -1;
        for (let i = 0; i <= upto; i++) {
          const inside = i < upto && o[i];
          if (inside && run < 0) { run = i; ctx.moveTo(a[i * 2], a[i * 2 + 1]); }
          else if (inside && !p.straight) ctx.lineTo(a[i * 2], a[i * 2 + 1]);
          else if (!inside && run >= 0) {
            if (p.straight) ctx.lineTo(a[i * 2 - 2], a[i * 2 - 1]);
            run = -1;
          }
        }
      }
    }

    /** Lays out every pass: the rings round each stone, then the rows. @returns {void} */
    function build() {
      m = Math.min(s.W, s.H);
      sp = clamp(m * 0.012, 5, 10);
      zone = sp * (TINES * 2 + 1.5);
      place();
      passes = [];
      const step = clamp(m * 0.014, 9, 16);  // sample spacing along curves, in px
      stones.forEach((t, si) => {
        for (let q = 0; q < 2; q++) {
          const R = t.r + sp * (1 + q * TINES), n = Math.ceil(TAU * (R + sp * TINES) / step) + 1, dir = si % 2 ? -1 : 1;
          const xy = Array.from({ length: TINES }, (_, k) => {
            const a = new Float32Array(n * 2), r = R + (k + 0.5) * sp;
            for (let i = 0; i < n; i++) { const th = dir * i / (n - 1) * TAU; a[i * 2] = t.x + Math.cos(th) * r; a[i * 2 + 1] = t.y + Math.sin(th) * r; }
            return a;
          });
          passes.push(pass(xy, false, false));
        }
      });
      const P = sp * TINES;
      if (layout === 2) {
        // Arcs about a centre beyond the lower-left corner, sampled across the host.
        const qx = -s.W * 0.12, qy = s.H * 1.12;
        const r0 = Math.max(0, qy - s.H - P), r1 = Math.hypot(s.W - qx, qy);
        let row = 0;
        for (let r = r0; r < r1; r += P, row++) {
          const n = Math.max(8, Math.ceil(r * Math.PI / 2 / step) + 1), back = row % 2 === 1;
          const xy = Array.from({ length: TINES }, (_, k) => {
            const a = new Float32Array(n * 2), rr = r + (k + 0.5) * sp;
            for (let i = 0; i < n; i++) { const th = -Math.PI / 2 * (back ? 1 - i / (n - 1) : i / (n - 1)); a[i * 2] = qx + Math.cos(th) * rr; a[i * 2 + 1] = qy + Math.sin(th) * rr; }
            return a;
          });
          passes.push(pass(xy, false, true));
        }
      } else {
        const lam = clamp(m * 0.45, 160, 420), amp = P * 0.55, x0 = -20, x1 = s.W + 20;
        const n = layout === 0 ? Math.ceil((x1 - x0) / 4) + 1 : Math.ceil((x1 - x0) / step) + 1;
        for (let row = 0; row * P < s.H + P; row++) {
          const back = row % 2 === 1, y0 = row * P - P * 0.3;
          const xy = Array.from({ length: TINES }, (_, k) => {
            const a = new Float32Array(n * 2);
            for (let i = 0; i < n; i++) {
              const x = x0 + (x1 - x0) * (back ? 1 - i / (n - 1) : i / (n - 1));
              a[i * 2] = x; a[i * 2 + 1] = y0 + (k + 0.5) * sp + (layout === 1 ? amp * Math.sin(x / lam * TAU + phase) : 0);
            }
            return a;
          });
          passes.push(pass(xy, layout === 0, true));
        }
      }
      speed = clamp(m * 0.2, 80, 170);
      cycle = passes.reduce((t, p) => t + p.cum[p.n - 1], 0) / speed;
    }

    /** Ages the passes as if the rake had been at work for a whole cycle up to pass `cur`. @returns {void} */
    function warm() {
      let age = 0;
      for (let k = 1; k < passes.length; k++) {
        const p = passes[(cur - k + passes.length) % passes.length];
        p.at = T - age;
        age += p.cum[p.n - 1] / speed;
      }
      passes[cur].at = T - age;
    }

    /** How strongly a pass done `age` seconds ago still shows. @param {number} age @returns {number} */
    const fade = (age) => { const u = clamp(age / cycle, 0, 1); return 1 - 0.8 * u * u; };

    /** Paints the stones' shadows and every pass's grooves into the cache. @returns {void} */
    function settle() {
      const g = cache.getContext('2d');
      dirty = false;
      if (!g) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cache.width, cache.height);
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      g.fillStyle = s.dark ? '#000' : '#5a4a3a';
      g.globalAlpha = s.dark ? 0.3 : 0.14;
      for (const t of stones) blob(g, t.x + t.r * 0.15, t.y + t.r * 0.22, t.r * 1.05, t.pts);
      g.strokeStyle = s.colors[first];
      g.lineWidth = 1.5;
      g.lineJoin = 'bevel';
      for (let i = 0; i < passes.length; i++) {
        g.globalAlpha = groove() * fade(T - passes[i].at) * (i === cur ? 0.6 : 1);
        g.stroke(passes[i].path);
      }
    }

    /** The grooves' full strength. @returns {number} */
    const groove = () => (s.dark ? 0.4 : 0.48);

    /** The sample index the rake has reached on pass p. @param {Pass} p @returns {number} */
    function reach(p) {
      let i = 0;
      while (i < p.n - 1 && p.cum[i + 1] <= dist) i++;
      return i;
    }

    return {
      lay() {
        const frac = laid ? cur / passes.length : rng.random();
        build();
        cur = Math.min(passes.length - 1, Math.floor(frac * passes.length));
        dist = laid ? 0 : passes[cur].cum[passes[cur].n - 1] * (0.3 + rng.random() * 0.4);
        laid = true;
        warm();
        cache.width = s.cv.width; cache.height = s.cv.height;
        dirty = true;
      },
      step(dt) {
        T += dt;
        dist += speed * dt;
        const p = passes[cur];
        if (dist >= p.cum[p.n - 1]) {
          p.at = T;
          dist = 0;
          cur = (cur + 1) % passes.length;
          dirty = true;
        }
      },
      draw() {
        const { ctx } = s;
        // Stones' shadows and the settled grooves, then the fresh ones, then the stones.
        if (dirty) settle();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(cache, 0, 0);
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
        ctx.strokeStyle = s.colors[first];
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'bevel';
        // The pass being raked: fresh grooves behind the rake.
        const p = passes[cur], upto = reach(p);
        ctx.globalAlpha = groove();
        ctx.beginPath();
        trace(ctx, p, upto + 1);
        ctx.stroke();
        for (const t of stones) {
          ctx.fillStyle = s.colors[t.c];
          ctx.globalAlpha = s.dark ? 0.42 : 0.5;
          blob(ctx, t.x, t.y, t.r, t.pts);
          ctx.globalAlpha = s.dark ? 0.16 : 0.22;
          ctx.fillStyle = s.dark ? '#fff' : '#fffaf0';
          blob(ctx, t.x - t.r * 0.18, t.y - t.r * 0.2, t.r * 0.55, t.pts);
        }
        // The rake: a bar across its pass with a handle trailing behind it.
        const a = p.xy[0], b = p.xy[TINES - 1], j = Math.min(upto + 1, p.n - 1);
        const ax = a[j * 2], ay = a[j * 2 + 1], bx = b[j * 2], by = b[j * 2 + 1];
        const mid = p.xy[(TINES - 1) / 2], i0 = Math.max(0, j - 3);
        let dx = mid[j * 2] - mid[i0 * 2], dy = mid[j * 2 + 1] - mid[i0 * 2 + 1];
        const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        const cx = (ax + bx) / 2, cy = (ay + by) / 2, ex = (bx - ax) * 0.18, ey = (by - ay) * 0.18;
        const wood = s.colors[(first + 1) % C], hl = m * 0.16;
        ctx.globalAlpha = s.dark ? 0.6 : 0.65;
        ctx.strokeStyle = wood;
        ctx.lineWidth = clamp(sp * 0.7, 3, 6);
        ctx.beginPath();
        ctx.moveTo(ax - ex, ay - ey); ctx.lineTo(bx + ex, by + ey);
        ctx.moveTo(cx, cy); ctx.lineTo(cx - dx * hl + dy * hl * 0.12, cy - dy * hl - dx * hl * 0.12);
        ctx.stroke();
      },
    };
  });
}

/** Fills a smooth stone shape through its radii. @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} r @param {number[]} pts @returns {void} */
function blob(ctx, x, y, r, pts) {
  const n = pts.length;
  /** @param {number} i @returns {[number, number]} */
  const at = (i) => { const a = (i % n) / n * TAU, q = pts[i % n] * r; return [x + Math.cos(a) * q * 1.15, y + Math.sin(a) * q * 0.9]; };
  ctx.beginPath();
  const [x0, y0] = at(0), [x1, y1] = at(1);
  ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
  for (let i = 1; i <= n; i++) {
    const [px, py] = at(i), [qx, qy] = at(i + 1);
    ctx.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
  }
  ctx.fill();
}
