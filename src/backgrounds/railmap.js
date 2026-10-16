// Rail map: a metro diagram of coloured lines running straight and at 45 degrees with rounded
// bends, ticks for stations and rings where lines meet; trains glide along the lines, slow into
// each station, wait and pull away. The seed picks the variant: a city of lines crossing from
// edge to edge; a circle line round the centre crossed by radial lines; or two trunk lines that
// each fork into branches at both ends, their trains taking a different branch each run.

import { stage, clamp, TAU } from './stage.js';
import { makeRng } from '../rng.js';
import { roundRect } from './shapes.js';

/**
 * @typedef {{x:number, y:number}} Pt
 * @typedef {{pts:Pt[], acc:number[], len:number, stops:number[], c:number, loop:boolean}} Route
 * @typedef {{r:Route, d:number, dir:number, v:number, wait:number, alt:Route[]}} Train
 */

/** The eight octilinear directions, clockwise from east. */
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    /** @type {Route[]} */
    let routes = [];
    /** @type {Train[]} */
    let trains = [];
    /** @type {Pt[]} interchange centres */
    let rings = [];
    let g = 80, lw = 6;
    const cache = document.createElement('canvas');
    let stale = true;
    s.onDpr = () => { stale = true; };

    /** Node (i, j) of the grid in CSS px. @param {number} i @param {number} j @returns {Pt} */
    let node = (i, j) => ({ x: i * g, y: j * g });
    let cols = 0, rows = 0;

    /**
     * Grid nodes from `a` towards `b`, octilinear, holding each heading at least two steps.
     * @param {number[]} a @param {number[]} b @param {number} d0 starting direction index
     * @returns {{path:number[][], d:number}}
     */
    function walk(a, b, d0) {
      const path = [a.slice()];
      let [i, j] = a, d = d0, run = 2;
      const off = (/** @type {number} */ x, /** @type {number} */ y) => x < 0 || y < 0 || x > cols || y > rows;
      for (let n = 0; n < 200 && (i !== b[0] || j !== b[1]); n++) {
        // Heading for a node off screen, being off screen is arrival enough.
        if (n > 0 && off(i, j) && off(b[0], b[1])) break;
        let best = d, bestE = Infinity;
        const near = Math.hypot(b[0] - i, b[1] - j) < 2.5;
        for (const k of [0, 1, -1]) {
          if (k && run < 2 && !near) continue;
          const dd = (d + k + 8) % 8;
          const ni = i + DIRS[dd][0], nj = j + DIRS[dd][1];
          // Chebyshev-like distance keeps routes octilinear; a turn costs a little.
          const e = Math.hypot(b[0] - ni, b[1] - nj) + (k ? 0.35 : 0);
          if (e < bestE) { bestE = e; best = dd; }
        }
        if (best !== d) run = 0;
        d = best; run++;
        i += DIRS[d][0]; j += DIRS[d][1];
        path.push([i, j]);
      }
      return { path, d };
    }

    /** A grid node on side 0..3 (left, top, right, bottom), just off screen.
     * @param {number} side @param {number} u 0..1 along it @returns {number[]} */
    function edge(side, u) {
      const ci = Math.round(u * (cols - 2)) + 1, rj = Math.round(u * (rows - 2)) + 1;
      return side === 0 ? [-1, rj] : side === 1 ? [ci, -1] : side === 2 ? [cols + 1, rj] : [ci, rows + 1];
    }

    /** Heading index that points from a towards b. @param {number[]} a @param {number[]} b */
    function aim(a, b) {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      return (Math.round(ang / (TAU / 8)) + 8) % 8;
    }

    /** Joins legs through waypoints into one node path. @param {number[][]} wps @returns {number[][]} */
    function through(wps) {
      /** @type {number[][]} */
      let out = [wps[0]];
      let d = aim(wps[0], wps[1]);
      for (let k = 1; k < wps.length; k++) {
        const leg = walk(out[out.length - 1], wps[k], d);
        out = out.concat(leg.path.slice(1));
        d = leg.d;
      }
      return out;
    }

    /**
     * A route from grid nodes: bends rounded, stations at some straight-through nodes.
     * @param {number[][]} nodes @param {number} c colour index @param {boolean} loop
     * @param {import('../rng.js').Rng} r @param {Map<string, number>} seen node visit counts
     * @returns {Route}
     */
    function route(nodes, c, loop, r, seen) {
      /** @type {Pt[]} */
      const pts = [];
      /** @type {number[]} */
      const stopAt = [];
      const n = nodes.length;
      const rad = g * 0.36;
      for (let k = 0; k < n; k++) {
        const p = node(nodes[k][0], nodes[k][1]);
        const prev = loop ? nodes[(k - 1 + n) % n] : nodes[k - 1];
        const next = loop ? nodes[(k + 1) % n] : nodes[k + 1];
        if (!prev || !next) { pts.push(p); continue; }
        const ax = nodes[k][0] - prev[0], ay = nodes[k][1] - prev[1];
        const bx = next[0] - nodes[k][0], by = next[1] - nodes[k][1];
        if (ax === bx && ay === by) {
          pts.push(p);
          if (k > 0 && k < n - 1 || loop) stopAt.push(pts.length - 1);
          continue;
        }
        // A bend: a quadratic curve from rad before the node to rad after it.
        const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
        const p0 = { x: p.x - ax / la * rad, y: p.y - ay / la * rad };
        const p2 = { x: p.x + bx / lb * rad, y: p.y + by / lb * rad };
        for (let q = 0; q <= 6; q++) {
          const u = q / 6, w = 1 - u;
          pts.push({ x: w * w * p0.x + 2 * w * u * p.x + u * u * p2.x, y: w * w * p0.y + 2 * w * u * p.y + u * u * p2.y });
        }
      }
      if (loop) pts.push({ ...pts[0] });
      /** @type {number[]} */
      const acc = [0];
      for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
      // Interchanges always stop; elsewhere about every other straight node, never two in a row.
      /** @type {number[]} */
      const stops = [];
      let last = -9;
      for (const pi of stopAt) {
        const nd = nodes.find((q) => { const p = node(q[0], q[1]); return Math.abs(p.x - pts[pi].x) < 1 && Math.abs(p.y - pts[pi].y) < 1; });
        const key = nd ? nd.join(',') : '';
        const hub = (seen.get(key) ?? 0) > 1;
        if (hub || (pi - last > 1 && r.random() < 0.55)) { stops.push(acc[pi]); last = pi; }
      }
      if (!loop) { stops.unshift(0); stops.push(acc[acc.length - 1]); }
      return { pts, acc, len: acc[acc.length - 1], stops, c, loop };
    }

    /** Position and heading at distance d along a route. @param {Route} r @param {number} d */
    function at(r, d) {
      if (r.loop) d = ((d % r.len) + r.len) % r.len;
      d = clamp(d, 0, r.len);
      let lo = 0, hi = r.acc.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.acc[m] <= d) lo = m; else hi = m; }
      const a = r.pts[lo], b = r.pts[hi];
      const seg = r.acc[hi] - r.acc[lo] || 1, u = (d - r.acc[lo]) / seg;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, a: Math.atan2(b.y - a.y, b.x - a.x) };
    }

    /** Builds the network for the current size. */
    function build() {
      const r = makeRng(s.seed * 7919 + 13);
      g = clamp(Math.min(s.W, s.H) / 6.5, 54, 118);
      lw = clamp(g * 0.085, 4.5, 9);
      cols = Math.max(3, Math.round(s.W / g));
      rows = Math.max(3, Math.round(s.H / g));
      const ox = (s.W - cols * g) / 2, oy = (s.H - rows * g) / 2;
      node = (i, j) => ({ x: ox + i * g, y: oy + j * g });
      /** @type {{nodes:number[][], c:number, loop:boolean, group:number}[]} */
      const plans = [];
      const mid = (/** @type {number} */ u, /** @type {number} */ v) => [Math.round(cols * u), Math.round(rows * v)];
      if (s.layout === 0) {
        const n = clamp(Math.round(s.W * s.H / (g * g * 7)), 4, 7);
        for (let k = 0; k < n; k++) {
          const side = k % 2 === 0 ? (k / 2) % 2 : 1 + 2 * ((k - 1) / 2 % 2);
          const a = edge(side === 1 || side === 3 ? 1 : 0, 0.1 + r.random() * 0.8);
          const b = edge(side === 1 || side === 3 ? 3 : 2, 0.1 + r.random() * 0.8);
          if (r.random() < 0.5) { a[0] = cols - a[0]; b[0] = cols - b[0]; }
          const w = mid(0.2 + r.random() * 0.6, 0.2 + r.random() * 0.6);
          plans.push({ nodes: k % 2 ? through([a, w, b]) : through([b, w, a]), c: k, loop: false, group: k });
        }
      } else if (s.layout === 1) {
        // The circle line: a chamfered rectangle of grid nodes round the centre.
        const ci = Math.round(cols / 2), cj = Math.round(rows / 2);
        const hx = Math.max(2, Math.round(cols * 0.28)), hy = Math.max(2, Math.round(rows * 0.28));
        const ch = Math.max(1, Math.min(hx, hy) - 1);
        /** @type {number[][]} */
        const ring = [];
        const corners = [[ci - hx + ch, cj - hy], [ci + hx - ch, cj - hy], [ci + hx, cj - hy + ch], [ci + hx, cj + hy - ch],
          [ci + hx - ch, cj + hy], [ci - hx + ch, cj + hy], [ci - hx, cj + hy - ch], [ci - hx, cj - hy + ch]];
        for (let k = 0; k < 8; k++) {
          const [a0, b0] = corners[k], [a1, b1] = corners[(k + 1) % 8];
          const steps = Math.max(Math.abs(a1 - a0), Math.abs(b1 - b0));
          for (let q = 0; q < steps; q++) ring.push([a0 + Math.sign(a1 - a0) * q, b0 + Math.sign(b1 - b0) * q]);
        }
        plans.push({ nodes: ring, c: 0, loop: true, group: 0 });
        const n = clamp(Math.round(s.W * s.H / (g * g * 12)), 3, 5);
        for (let k = 0; k < n; k++) {
          const ang = (k / n) * Math.PI + r.random() * 0.4;
          const ux = Math.cos(ang), uy = Math.sin(ang);
          const ext = Math.max(cols, rows);
          const a = [clamp(Math.round(ci + ux * ext), -1, cols + 1), clamp(Math.round(cj + uy * ext), -1, rows + 1)];
          const b = [clamp(Math.round(ci - ux * ext), -1, cols + 1), clamp(Math.round(cj - uy * ext), -1, rows + 1)];
          const w = [ci + r.int(3) - 1, cj + r.int(3) - 1];
          plans.push({ nodes: through([a, w, b]), c: k + 1, loop: false, group: k + 1 });
        }
      } else {
        // Two trunks, each forking into branches at both ends; a route per branch pair.
        for (let t = 0; t < 2; t++) {
          const hz = t === 0;
          const ta = hz ? mid(0.3, 0.42 + r.random() * 0.16) : mid(0.4 + r.random() * 0.2, 0.25);
          const tb = hz ? mid(0.7, ta[1] / rows + (r.random() - 0.5) * 0.2) : mid(ta[0] / cols + (r.random() - 0.5) * 0.2, 0.75);
          const trunk = through([ta, tb]);
          const nb = s.W * s.H > 900000 ? 3 : 2;
          /** @type {number[][][]} */
          const heads = [], tails = [];
          for (let b = 0; b < nb; b++) {
            const u = (b + 0.5) / nb * 0.8 + 0.1 + (r.random() - 0.5) * 0.1;
            heads.push(through([edge(hz ? 0 : 1, u), ta]).slice(0, -1));
            tails.push(through([tb, edge(hz ? 2 : 3, u)]).slice(1));
          }
          for (let b = 0; b < nb; b++) {
            plans.push({ nodes: heads[b].concat(trunk, tails[(b + t) % nb]), c: t, loop: false, group: t });
          }
        }
      }
      /** @type {Map<string, number>} */
      const seen = new Map();
      /** @type {Map<string, Set<number>>} */
      const groups = new Map();
      for (const p of plans) {
        for (const q of p.nodes) {
          const key = q.join(',');
          const set = groups.get(key) ?? new Set();
          set.add(p.group);
          groups.set(key, set);
        }
      }
      for (const [key, set] of groups) seen.set(key, set.size);
      routes = plans.map((p) => route(p.nodes, p.c, p.loop, r, seen));
      rings = [];
      for (const [key, n] of seen) {
        if (n < 2) continue;
        const [i, j] = key.split(',').map(Number);
        if (i < 0 || j < 0 || i > cols || j > rows) continue;
        rings.push(node(i, j));
      }
      // Trains: a few per route, spread out, some waiting at a station.
      trains = [];
      /** @type {Map<number, Route[]>} */
      const byGroup = new Map();
      plans.forEach((p, k) => { const a = byGroup.get(p.group) ?? []; a.push(routes[k]); byGroup.set(p.group, a); });
      for (const [gi, rs] of byGroup) {
        const main = rs[0];
        const n = clamp(Math.round(main.len / (g * 3.5)), 2, 5) + (main.loop ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const rr = rs[k % rs.length];
          const si = Math.floor((k + 0.3 + r.random() * 0.4) / n * rr.stops.length);
          const d = rr.stops[clamp(si, 0, rr.stops.length - 1)] + (r.random() < 0.5 ? g * 0.6 : 0);
          trains.push({ r: rr, d, dir: k % 2 || main.loop ? 1 : -1, v: 0, wait: r.random() * 2, alt: rs });
        }
        void gi;
      }
      stale = true;
    }

    /** Paints the static map into the cache at device pixels. */
    function paintCache() {
      stale = false;
      cache.width = s.cv.width; cache.height = s.cv.height;
      const c = cache.getContext('2d');
      if (!c) return;
      c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      c.lineCap = 'round'; c.lineJoin = 'round';
      // A river, as metro maps keep one for orientation.
      c.globalAlpha = 0.16;
      c.strokeStyle = s.ink;
      c.lineWidth = g * 0.42;
      c.beginPath();
      const ry = s.H * (s.layout === 1 ? 0.78 : 0.62);
      c.moveTo(-20, ry - g * 0.6);
      c.bezierCurveTo(s.W * 0.3, ry + g * 0.9, s.W * 0.55, ry - g * 1.2, s.W + 20, ry + g * 0.3);
      c.stroke();
      c.globalAlpha = 1;
      for (const r of routes) {
        const col = s.colors[r.c % s.colors.length];
        c.strokeStyle = col;
        c.lineWidth = lw;
        c.beginPath();
        r.pts.forEach((p, k) => (k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
        c.stroke();
      }
      // Station ticks, on the left of travel.
      c.lineCap = 'butt';
      for (const r of routes) {
        c.strokeStyle = s.colors[r.c % s.colors.length];
        c.lineWidth = lw * 0.8;
        c.beginPath();
        for (const d of r.stops) {
          const p = at(r, d);
          const nx = Math.sin(p.a), ny = -Math.cos(p.a);
          c.moveTo(p.x, p.y);
          c.lineTo(p.x + nx * lw * 1.5, p.y + ny * lw * 1.5);
        }
        c.stroke();
      }
      const rr = lw * 1.25;
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      for (const p of rings) { c.moveTo(p.x + rr, p.y); c.arc(p.x, p.y, rr, 0, TAU); }
      c.fill();
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = s.ink;
      c.lineWidth = lw * 0.5;
      c.beginPath();
      for (const p of rings) { c.moveTo(p.x + rr, p.y); c.arc(p.x, p.y, rr, 0, TAU); }
      c.stroke();
    }

    /** Next stop strictly ahead of t in its direction, or the route end. @param {Train} t */
    function nextStop(t) {
      const { r } = t;
      if (r.loop) {
        const here = ((t.d % r.len) + r.len) % r.len;
        for (const sd of r.stops) if (sd > here + 0.5) return t.d + (sd - here);
        return t.d + (r.stops[0] + r.len - here);
      }
      if (t.dir > 0) { for (const sd of r.stops) if (sd > t.d + 0.5) return sd; return r.len; }
      for (let k = r.stops.length - 1; k >= 0; k--) if (r.stops[k] < t.d - 0.5) return r.stops[k];
      return 0;
    }

    /** @param {Train} t @param {number} dt */
    function move(t, dt) {
      if (t.wait > 0) { t.wait -= dt; return; }
      const vmax = clamp(g * 0.9, 50, 100), acc = vmax * 0.7;
      const target = nextStop(t);
      const rem = Math.abs(target - t.d);
      t.v = Math.min(vmax, t.v + acc * dt, Math.sqrt(2 * acc * rem) + 2);
      const stepD = Math.min(rem, t.v * dt);
      t.d += stepD * (t.r.loop ? 1 : t.dir);
      if (rem - stepD < 0.3) {
        t.d = target; t.v = 0;
        t.wait = 1.6 + s.rng.random() * 1.8;
        if (!t.r.loop && (t.d <= 0 || t.d >= t.r.len)) {
          // Off-screen terminus: turn back, on another branch when there is one.
          t.dir = -t.dir;
          t.wait = 2 + s.rng.random() * 3;
          if (t.alt.length > 1) {
            const nr = t.alt[Math.floor(s.rng.random() * t.alt.length)];
            if (t.d >= t.r.len) {
              // Swap at the far end only where both routes share it, else stay.
              const e1 = t.r.pts[t.r.pts.length - 1], e2 = nr.pts[nr.pts.length - 1];
              if (Math.abs(e1.x - e2.x) < 1 && Math.abs(e1.y - e2.y) < 1) t.r = nr;
            } else {
              const e1 = t.r.pts[0], e2 = nr.pts[0];
              if (Math.abs(e1.x - e2.x) < 1 && Math.abs(e1.y - e2.y) < 1) t.r = nr;
            }
          }
        }
      }
    }

    let laid = false;
    return {
      lay() {
        build();
        if (!laid) { laid = true; for (let k = 0; k < 40; k++) for (const t of trains) move(t, 0.1); }
      },
      step(dt) { for (const t of trains) move(t, dt); },
      draw() {
        const { ctx } = s;
        if (stale) paintCache();
        ctx.globalAlpha = s.dark ? 0.46 : 0.5;
        ctx.drawImage(cache, 0, 0, s.W, s.H);
        const tl = lw * 3.4, tw = lw * 1.5;
        for (const t of trains) {
          const p = at(t.r, t.d);
          const side = (t.r.loop ? 1 : t.dir) * lw * 0.55;
          const x = p.x - Math.sin(p.a) * side, y = p.y + Math.cos(p.a) * side;
          ctx.setTransform(s.dpr * Math.cos(p.a), s.dpr * Math.sin(p.a), -s.dpr * Math.sin(p.a), s.dpr * Math.cos(p.a), x * s.dpr, y * s.dpr);
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = s.colors[t.r.c % s.colors.length];
          ctx.beginPath();
          roundRect(ctx, -tl / 2, -tw / 2, tl, tw, tw * 0.45);
          ctx.fill();
          ctx.globalAlpha = 0.55;
          ctx.strokeStyle = s.ink;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      },
    };
  });
}
