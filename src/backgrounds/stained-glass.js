// Stained glass: Voronoi cells of coloured glass with dark leading between them, their points
// drifting so the panes slowly reshape, each pane glowing as light passes through. The seed
// picks the variant: a loose window whose panes breathe on their own beats, a rose window of
// rings turning against each other with light pulsing outward, or a casement of leaded diamond
// panes that wobble round fixed homes while a broad band of sunlight sweeps across them.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, hx:number, hy:number, a:number, turn:number, v:number,
 *   ring:number, ang:number, rad:number, c:number, ph:number, f:number}} Site
 * A pane's point: where it is, its home (diamonds), heading and speed (loose), ring, angle and
 * radius (rose), its colour and glow beat. */

const MAXV = 48;   // vertices a pane's polygon may hold
const SQ = 1.5;    // the diamonds' height to width

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Site[]} */
    let sites = [];
    /** The panes, as polygon vertex lists (x0,y0,x1,y1...) and their lengths. @type {Float64Array[]} */
    let polys = [];
    /** @type {number[]} */
    let lens = [];
    let bucket = 1, bw = 1, bh = 1;
    /** @type {number[][]} */
    let grid = [];
    let lead = 3;
    const bufA = new Float64Array(MAXV * 2), bufB = new Float64Array(MAXV * 2);
    const nc = s.colors.length;

    /** @param {number} x @param {number} y @param {number} ring @param {number} ang @param {number} rad @param {number} c @returns {Site} */
    function site(x, y, ring, ang, rad, c) {
      return { x, y, hx: x, hy: y, a: rng.random() * TAU, turn: 0, v: 7 + rng.random() * 9, ring, ang, rad,
        c, ph: rng.random() * TAU, f: 0.07 + rng.random() * 0.08 };
    }

    /** Lays the points out for this variant and size. @returns {void} */
    function build() {
      const m = Math.min(s.W, s.H);
      if (layout === 1) {
        // Rose window: a hub of 6, then rings of 12 and 16 panes whose radii grow by a constant
        // ratio, so every pane keeps the same petal shape out to the corners; colours alternate
        // round each ring and step from ring to ring.
        sites = [];
        const r1 = clamp(m * 0.1, 40, 110), reach = Math.hypot(s.W, s.H) / 2 * 1.3;
        const ca = rng.int(nc), cb = (ca + 1 + rng.int(Math.max(1, nc - 1))) % nc;
        sites.push(site(s.W / 2, s.H / 2, 0, 0, 0, ca));
        for (let k = 1, r = r1; r < reach; k++, r *= 1.42) {
          const n = k === 1 ? 6 : k === 2 ? 12 : 16, off = k % 2 ? 0 : Math.PI / n;
          for (let i = 0; i < n; i++) {
            sites.push(site(0, 0, k, off + i * TAU / n, r, ((i % 2 ? cb : ca) + k) % nc));
          }
        }
        return;
      }
      const n = clamp(Math.round(s.W * s.H / 21000), 16, 72);
      if (layout === 2) {
        // Diamond quarries: a centred square lattice, worked out with y squashed by SQ so the
        // panes come out as tall diamonds, like an old leaded casement.
        const a = Math.sqrt(2 * s.W * s.H / SQ / n);
        const cols = Math.ceil(s.W / a) + 2, rows = Math.ceil(s.H / SQ / (a / 2)) + 2;
        sites = [];
        for (let r = -1; r < rows; r++) {
          for (let q = -1; q < cols; q++) {
            const x = (q + (r % 2 ? 0.5 : 0)) * a + (rng.random() - 0.5) * a * 0.1;
            const y = (r * a / 2 + (rng.random() - 0.5) * a * 0.1) * SQ;
            sites.push(site(x, y, 0, rng.random() * TAU, 0.07 * a, rng.int(nc)));
          }
        }
        return;
      }
      // Loose: keep the points we have, add or drop to the count, pull any outside back in.
      while (sites.length < n) sites.push(site(rng.random() * s.W, rng.random() * s.H, 0, 0, 0, rng.int(nc)));
      sites.length = n;
      for (const p of sites) { p.x = Math.min(p.x, s.W); p.y = Math.min(p.y, s.H); }
    }

    /** Moves the points on by dt. @param {number} dt @returns {void} */
    function move(dt) {
      if (layout === 1) {
        // Odd rings turn one way, even rings the other, outer rings slower.
        for (const p of sites) {
          if (p.ring) p.ang += (p.ring % 2 ? 1 : -1) * 0.05 / Math.sqrt(p.ring) * dt;
        }
        return;
      }
      if (layout === 2) {
        for (const p of sites) p.ang += (0.25 + p.f) * dt;
        return;
      }
      for (const p of sites) {
        p.turn = clamp(p.turn + (rng.random() - 0.5) * 2 * dt, -0.6, 0.6);
        p.a += p.turn * dt;
        p.x += Math.cos(p.a) * p.v * dt;
        p.y += Math.sin(p.a) * p.v * dt;
        // Turn back at the edges, so the panes never pile up off-screen.
        if (p.x < 0) { p.x = 0; p.a = Math.PI - p.a; } else if (p.x > s.W) { p.x = s.W; p.a = Math.PI - p.a; }
        if (p.y < 0) { p.y = 0; p.a = -p.a; } else if (p.y > s.H) { p.y = s.H; p.a = -p.a; }
      }
    }

    /** Places each point for drawing from its ring or home. @returns {void} */
    function place() {
      if (layout === 1) {
        for (const p of sites) { p.x = s.W / 2 + Math.cos(p.ang) * p.rad; p.y = s.H / 2 + Math.sin(p.ang) * p.rad; }
      } else if (layout === 2) {
        for (const p of sites) { p.x = p.hx + Math.cos(p.ang) * p.rad; p.y = p.hy + Math.sin(p.ang * 0.8) * p.rad; }
      }
    }

    /** Clips the polygon in `src` (n vertices) to the half-plane nearer p than q, into `dst`.
     * @param {Float64Array} src @param {number} n @param {Float64Array} dst @param {Site} p @param {Site} q
     * @returns {number} the vertices kept */
    function clip(src, n, dst, p, q) {
      const nx = q.x - p.x, ny = q.y - p.y;
      const k = (nx * (p.x + q.x) + ny * (p.y + q.y)) / 2;
      let o = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = src[i * 2], ay = src[i * 2 + 1], bx = src[j * 2], by = src[j * 2 + 1];
        const da = ax * nx + ay * ny - k, db = bx * nx + by * ny - k;
        if (da <= 0 && o < MAXV) { dst[o * 2] = ax; dst[o * 2 + 1] = ay; o++; }
        if ((da < 0) !== (db < 0) && da !== db && o < MAXV) {
          const u = da / (da - db);
          dst[o * 2] = ax + (bx - ax) * u; dst[o * 2 + 1] = ay + (by - ay) * u; o++;
        }
      }
      return o;
    }

    /** The Voronoi panes of every point, by clipping a frame round each point with the bisectors
     * of its neighbours, nearest buckets first, stopping once no farther point can cut. @returns {void} */
    function cells() {
      const pad = lead * 2, sq = layout === 2 ? SQ : 1, H = s.H / sq;
      if (sq !== 1) for (const p of sites) p.y /= sq;
      bucket = Math.sqrt(s.W * H / Math.max(1, sites.length)) * 1.2;
      bw = Math.ceil((s.W + 2 * pad) / bucket) + 1; bh = Math.ceil((H + 2 * pad) / bucket) + 1;
      if (grid.length !== bw * bh) grid = Array.from({ length: bw * bh }, () => []);
      for (const g of grid) g.length = 0;
      /** @param {number} v @param {number} hi @returns {number} */
      const bi = (v, hi) => clamp(Math.floor((v + pad) / bucket), 0, hi - 1);
      sites.forEach((p, i) => grid[bi(p.y, bh) * bw + bi(p.x, bw)].push(i));
      while (polys.length < sites.length) polys.push(new Float64Array(MAXV * 2));
      lens.length = sites.length;
      for (let i = 0; i < sites.length; i++) {
        const p = sites[i];
        let src = bufA, dst = bufB;
        src[0] = src[1] = src[3] = src[6] = -pad;
        src[2] = src[4] = s.W + pad; src[5] = src[7] = H + pad;
        let n = 4;
        const cx = bi(p.x, bw), cy = bi(p.y, bh);
        for (let r = 0; r < Math.max(bw, bh); r++) {
          for (let y = cy - r; y <= cy + r; y++) {
            if (y < 0 || y >= bh) continue;
            const edge = y === cy - r || y === cy + r;
            for (let x = cx - r; x <= cx + r; x += edge ? 1 : 2 * r) {
              if (x >= 0 && x < bw) {
                for (const j of grid[y * bw + x]) {
                  if (j === i) continue;
                  n = clip(src, n, dst, p, sites[j]);
                  const t = src; src = dst; dst = t;
                }
              }
              if (r === 0) break;
            }
          }
          // Anything in the next ring of buckets is at least r buckets away: it cuts only if
          // half that is nearer than the polygon's farthest corner.
          let far = 0;
          for (let v = 0; v < n; v++) far = Math.max(far, Math.hypot(src[v * 2] - p.x, src[v * 2 + 1] - p.y));
          if (r * bucket / 2 > far) break;
        }
        polys[i].set(src.subarray(0, n * 2));
        lens[i] = n;
      }
      if (sq === 1) return;
      for (let i = 0; i < sites.length; i++) {
        sites[i].y *= sq;
        for (let v = 1; v < lens[i] * 2; v += 2) polys[i][v] *= sq;
      }
    }

    /** How lit pane i is now, 0..1. @param {Site} p @returns {number} */
    function glow(p) {
      if (layout === 1) return 0.5 + 0.5 * Math.sin(s.t * 0.45 - p.ring * 0.9 + (p.ring ? 0 : 0.6));
      if (layout === 2) {
        // A wide diagonal band of light crossing every 16s, plus each pane's own slow beat.
        const span = s.W + s.H;
        const u = ((s.t / 16 + p.ph * 0.002) % 1) * (span * 1.6) - span * 0.3;
        const d = (p.hx + p.hy * 0.6 - u) / (Math.min(s.W, s.H) * 0.45);
        return 0.25 * (0.5 + 0.5 * Math.sin(s.t * p.f * TAU + p.ph)) + 0.75 * Math.exp(-d * d);
      }
      return 0.5 + 0.5 * Math.sin(s.t * p.f * TAU + p.ph);
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        lead = clamp(m * 0.0055, 2.5, 5);
        build();
        place();
        cells();
      },
      step(dt) {
        move(dt);
        place();
        cells();
      },
      draw() {
        const { ctx } = s;
        const base = s.dark ? 0.15 : 0.2, lift = s.dark ? 0.24 : 0.22;
        for (let i = 0; i < sites.length; i++) {
          const p = sites[i], v = polys[i], n = lens[i];
          if (n < 3) continue;
          const g = glow(p);
          ctx.fillStyle = s.colors[p.c];
          ctx.globalAlpha = base + lift * g;
          ctx.beginPath();
          ctx.moveTo(v[0], v[1]);
          for (let k = 1; k < n; k++) ctx.lineTo(v[k * 2], v[k * 2 + 1]);
          ctx.fill();
          // A brighter inner pane toward the point: the glass catching the light.
          ctx.globalAlpha = (s.dark ? 0.1 : 0.08) + (s.dark ? 0.22 : 0.16) * g;
          ctx.beginPath();
          ctx.moveTo(p.x + (v[0] - p.x) * 0.55, p.y + (v[1] - p.y) * 0.55);
          for (let k = 1; k < n; k++) ctx.lineTo(p.x + (v[k * 2] - p.x) * 0.55, p.y + (v[k * 2 + 1] - p.y) * 0.55);
          ctx.fill();
        }
        // The leading, one path for every pane's outline.
        ctx.beginPath();
        for (let i = 0; i < sites.length; i++) {
          const v = polys[i], n = lens[i];
          if (n < 3) continue;
          ctx.moveTo(v[0], v[1]);
          for (let k = 1; k < n; k++) ctx.lineTo(v[k * 2], v[k * 2 + 1]);
          ctx.closePath();
        }
        ctx.globalAlpha = s.dark ? 0.7 : 0.32;
        ctx.strokeStyle = s.dark ? '#000' : s.ink;
        ctx.lineWidth = lead;
        ctx.lineJoin = 'round';
        ctx.stroke();
      },
    };
  });
}
