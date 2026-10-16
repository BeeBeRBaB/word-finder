// Traffic: a street grid seen from above. Cars keep to the right, follow one another, queue at
// the stop line when their way is closed, and go straight on or turn right through the junction,
// brake lights showing while they slow. The seed picks the variant: a city grid of signalled
// junctions whose lights change in a green wave; a quiet town of houses and trees where every
// junction is a four-way stop, cars taking turns; or one big crossroads close up, its lights
// closing every road in turn so people can cross on the zebra crossings.

import { stage, clamp, TAU } from './stage.js';
import { makeRng } from '../rng.js';
import { roundRect } from './shapes.js';

/**
 * @typedef {{x:number, y:number, off:number, occ:Car|null}} Junction
 * @typedef {{h:boolean, sgn:number, c:number, L:number, js:{p:number, j:Junction}[], cars:Car[]}} Lane
 * @typedef {{cx:number, cy:number, r:number, a0:number, len:number, end:number}} Arc
 * @typedef {{lane:Lane, p:number, v:number, col:number, arc:Arc|null, plan:{j:Junction, p:number, turn:boolean}|null,
 *   wait:number, held:Junction|null, brake:number}} Car
 * @typedef {{x:number, y:number, tx:number, ty:number, fx:number, fy:number, u:number, walking:boolean, col:number, alt:number[][]}} Walker
 */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const mode = s.layout; // 0 lights, 1 stop signs, 2 one crossroads with crossings
    /** @type {Lane[]} */
    let lanes = [];
    /** @type {Junction[]} */
    let junctions = [];
    /** @type {Car[]} */
    let cars = [];
    /** @type {Walker[]} */
    let walkers = [];
    let R = 36, off = 9, cl = 15, cw = 8, m = 60, stopOff = 20, cross = 0;
    /** @type {HTMLCanvasElement[]} */
    let sprites = [];
    const cache = document.createElement('canvas');
    let stale = true;
    s.onDpr = () => { stale = true; };
    // One light cycle: each axis green, amber, all red; the crossroads adds a walk phase.
    const GREEN = mode === 2 ? 8 : 7, AMBER = 2, CLEAR = 1.5, WALK = mode === 2 ? 7 : 0;
    const CYCLE = 2 * (GREEN + AMBER + CLEAR) + (WALK ? WALK + CLEAR : 0);

    /** Light for an axis at a junction: 0 green, 1 amber, 2 red; 3 is walk (all red).
     * @param {Junction} j @param {boolean} h @returns {number} */
    function light(j, h) {
      const t = ((s.t + j.off) % CYCLE + CYCLE) % CYCLE;
      const leg = GREEN + AMBER + CLEAR;
      const k = h ? t : t - leg;
      if (k >= 0 && k < GREEN) return 0;
      if (k >= GREEN && k < GREEN + AMBER) return 1;
      return t >= 2 * leg && t < 2 * leg + WALK ? 3 : 2;
    }

    /** World point at a lane position. @param {Lane} l @param {number} p @returns {number[]} */
    function world(l, p) {
      p = ((p % l.L) + l.L) % l.L;
      const along = l.sgn > 0 ? p - m : (l.h ? s.W : s.H) + m - p;
      return l.h ? [along, l.c] : [l.c, along];
    }

    /** Position of a world coordinate along a lane. @param {Lane} l @param {number} v */
    const posOf = (l, v) => (l.sgn > 0 ? v + m : (l.h ? s.W : s.H) + m - v);

    /** The lane of a street through a junction in a direction. @param {Junction} j @param {boolean} h @param {number} sgn */
    const laneAt = (j, h, sgn) => lanes.find((l) => l.h === h && l.sgn === sgn && Math.abs(l.c - (h ? j.y + off * sgn : j.x - off * sgn)) < 0.5);

    function build() {
      const r = makeRng(s.seed * 4099 + 7);
      const mn = Math.min(s.W, s.H);
      /** @type {number[]} */
      let xs = [];
      /** @type {number[]} */
      let ys = [];
      if (mode === 2) {
        R = clamp(mn * 0.2, 70, 150);
        // Off centre, so the crossing shows beside the board rather than under it.
        const side = r.random() < 0.5 ? 0.2 : 0.72;
        xs = [Math.round(s.W > s.H ? s.W * (side + r.random() * 0.08) : s.W * (0.4 + r.random() * 0.2))];
        ys = [Math.round(s.W > s.H ? s.H * (0.35 + r.random() * 0.3) : s.H * (side + r.random() * 0.08))];
      } else {
        const B = mode === 0 ? clamp(mn * 0.26, 110, 250) : clamp(mn * 0.36, 150, 320);
        R = mode === 0 ? clamp(B * 0.24, 28, 48) : clamp(B * 0.18, 26, 40);
        const step = B + R;
        const ox = r.random() * step, oy = r.random() * step;
        for (let x = ox - step; x < s.W + R; x += step) if (x > -R * 0.5) xs.push(Math.round(x));
        for (let y = oy - step; y < s.H + R; y += step) if (y > -R * 0.5) ys.push(Math.round(y));
      }
      off = R / 4; cl = R * (mode === 2 ? 0.36 : 0.42); cw = cl * 0.5;
      m = R + cl * 2;
      cross = mode === 2 ? R * 0.32 : 0;
      stopOff = R / 2 + cross + (mode === 2 ? 6 : 3);
      junctions = [];
      for (const x of xs) for (const y of ys) junctions.push({ x, y, off: mode === 0 ? -(x + y) / (R * 4) : 0, occ: null });
      lanes = [];
      for (const y of ys) for (const sgn of [1, -1]) lanes.push({ h: true, sgn, c: y + off * sgn, L: s.W + 2 * m, js: [], cars: [] });
      for (const x of xs) for (const sgn of [1, -1]) lanes.push({ h: false, sgn, c: x - off * sgn, L: s.H + 2 * m, js: [], cars: [] });
      for (const l of lanes) {
        for (const j of junctions) {
          if (Math.abs((l.h ? j.y : j.x) - (l.c - (l.h ? off * l.sgn : -off * l.sgn))) > 0.5) continue;
          l.js.push({ p: posOf(l, l.h ? j.x : j.y), j });
        }
        l.js.sort((a, b) => a.p - b.p);
      }
      // Cars spread over the lanes, never overlapping; kept across a resize where they fit.
      const area = s.W * s.H;
      const n = mode === 2 ? clamp(Math.round(area / 30000), 10, 26) : clamp(Math.round(area / (mode === 0 ? 9000 : 16000)), 14, 90);
      const old = cars;
      cars = [];
      for (let k = 0; k < n * 3 && cars.length < n; k++) {
        const l = lanes[r.int(lanes.length)];
        const p = r.random() * l.L;
        if (l.js.some((q) => Math.abs(q.p - p) < R * 0.8)) continue;
        if (cars.some((c) => c.lane === l && Math.abs(c.p - p) < cl * 1.6)) continue;
        cars.push({ lane: l, p, v: 0, col: (old[cars.length]?.col ?? r.int(s.colors.length)), arc: null, plan: null, wait: 0, held: null, brake: 0 });
      }
      walkers = [];
      if (mode === 2) {
        const [X] = xs, [Y] = ys, h = R / 2;
        const e = h + cross / 2;
        // Each crossing joins two corners; a walker waits at one end of one.
        const ends = [[[X - h - 5, Y - e], [X + h + 5, Y - e]], [[X - h - 5, Y + e], [X + h + 5, Y + e]],
          [[X - e, Y - h - 5], [X - e, Y + h + 5]], [[X + e, Y - h - 5], [X + e, Y + h + 5]]];
        const nw = clamp(Math.round(area / 90000), 6, 14);
        for (let k = 0; k < nw; k++) {
          const c = ends[k % 4], a = r.int(2);
          const sx = (r.random() - 0.5) * cross * 0.6;
          const [x, y] = c[a], [tx, ty] = c[1 - a];
          const jx = k % 4 < 2 ? -Math.sign(x - X) * r.random() * 8 : sx, jy = k % 4 < 2 ? sx : -Math.sign(y - Y) * r.random() * 8;
          walkers.push({ x: x - jx, y: y - jy, fx: x - jx, fy: y - jy, tx: tx + jx, ty: ty + jy, u: 0, walking: false,
            col: r.int(s.colors.length), alt: ends.flat() });
        }
      }
      stale = true;
    }

    /** Car sprites, one per colour, at device pixels, pointing along +x. */
    function makeSprites() {
      sprites = s.colors.map((col) => {
        const c = document.createElement('canvas');
        const d = s.dpr;
        c.width = Math.ceil(cl * d) + 2; c.height = Math.ceil(cw * d) + 2;
        const g = c.getContext('2d');
        if (!g) return c;
        g.setTransform(d, 0, 0, d, 1, 1);
        g.fillStyle = col;
        g.beginPath(); roundRect(g, 0, 0, cl, cw, cw * 0.3); g.fill();
        // Windscreen and rear window, as darker bands.
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath(); roundRect(g, cl * 0.56, cw * 0.14, cl * 0.17, cw * 0.72, cw * 0.12); g.fill();
        g.beginPath(); roundRect(g, cl * 0.12, cw * 0.18, cl * 0.1, cw * 0.64, cw * 0.1); g.fill();
        return c;
      });
    }

    /** Roads, blocks and markings, settled, into the cache at device pixels. */
    function paintCache() {
      stale = false;
      makeSprites();
      cache.width = s.cv.width; cache.height = s.cv.height;
      const c = cache.getContext('2d');
      if (!c) return;
      const r = makeRng(s.seed * 31 + 5);
      c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      const xs = [...new Set(junctions.map((j) => j.x))].sort((a, b) => a - b);
      const ys = [...new Set(junctions.map((j) => j.y))].sort((a, b) => a - b);
      const h = R / 2;
      // Blocks between the streets: pavement, then buildings or houses and trees.
      const bx = [-1e4, ...xs, s.W + 1e4], by = [-1e4, ...ys, s.H + 1e4];
      for (let i = 0; i + 1 < bx.length; i++) {
        for (let k = 0; k + 1 < by.length; k++) {
          const x0 = Math.max(-20, bx[i] + h), x1 = Math.min(s.W + 20, bx[i + 1] - h);
          const y0 = Math.max(-20, by[k] + h), y1 = Math.min(s.H + 20, by[k + 1] - h);
          if (x1 - x0 < 8 || y1 - y0 < 8) continue;
          c.globalAlpha = s.dark ? 0.09 : 0.12;
          c.fillStyle = s.ink;
          c.beginPath(); roundRect(c, x0, y0, x1 - x0, y1 - y0, R * 0.3); c.fill();
          const pad = Math.max(5, R * 0.18);
          if (mode === 0) blockBuildings(c, r, x0 + pad, y0 + pad, x1 - pad, y1 - pad);
          else if (mode === 1) blockHouses(c, r, x0 + pad, y0 + pad, x1 - pad, y1 - pad);
          else blockPlaza(c, r, x0 + pad, y0 + pad, x1 - pad, y1 - pad);
        }
      }
      // Centre lines, dashed between junctions.
      c.globalAlpha = s.dark ? 0.32 : 0.36;
      c.strokeStyle = s.ink;
      c.lineWidth = Math.max(1, R * 0.03);
      c.setLineDash([R * 0.3, R * 0.25]);
      c.beginPath();
      for (const y of ys) {
        const cuts = [-50, ...xs.flatMap((x) => [x - h, x + h]), s.W + 50];
        for (let k = 0; k < cuts.length; k += 2) { c.moveTo(cuts[k], y); c.lineTo(cuts[k + 1], y); }
      }
      for (const x of xs) {
        const cuts = [-50, ...ys.flatMap((y) => [y - h, y + h]), s.H + 50];
        for (let k = 0; k < cuts.length; k += 2) { c.moveTo(x, cuts[k]); c.lineTo(x, cuts[k + 1]); }
      }
      c.stroke();
      c.setLineDash([]);
      // Stop lines on the right half of each approach; zebra stripes on the crossroads.
      c.lineWidth = Math.max(1.5, R * 0.05);
      c.globalAlpha = s.dark ? 0.4 : 0.45;
      c.beginPath();
      for (const j of junctions) {
        const so = stopOff - 2;
        c.moveTo(j.x - so, j.y); c.lineTo(j.x - so, j.y + h);
        c.moveTo(j.x + so, j.y); c.lineTo(j.x + so, j.y - h);
        c.moveTo(j.x, j.y - so); c.lineTo(j.x - h, j.y - so);
        c.moveTo(j.x, j.y + so); c.lineTo(j.x + h, j.y + so);
      }
      c.stroke();
      if (cross) {
        c.globalAlpha = s.dark ? 0.26 : 0.3;
        c.fillStyle = s.ink;
        const j = junctions[0], sw = R * 0.07;
        c.beginPath();
        for (let q = -h + sw; q < h - sw / 2; q += sw * 2) {
          c.rect(j.x + q, j.y - h - cross, sw, cross); c.rect(j.x + q, j.y + h, sw, cross);
          c.rect(j.x - h - cross, j.y + q, cross, sw); c.rect(j.x + h, j.y + q, cross, sw);
        }
        c.fill();
      }
      if (mode === 1) {
        // A stop sign at the right-hand corner of each approach.
        c.globalAlpha = 0.5;
        c.fillStyle = s.colors[3 % s.colors.length];
        const sr = Math.max(3, R * 0.13);
        c.beginPath();
        for (const j of junctions) {
          for (const [dx, dy] of [[-1, 1], [1, -1], [-1, -1], [1, 1]]) {
            const px = j.x + dx * (h + sr * 1.6), py = j.y + dy * (h + sr * 1.6);
            for (let q = 0; q < 8; q++) {
              const a = (q + 0.5) / 8 * TAU;
              if (q) c.lineTo(px + Math.cos(a) * sr, py + Math.sin(a) * sr); else c.moveTo(px + Math.cos(a) * sr, py + Math.sin(a) * sr);
            }
            c.closePath();
          }
        }
        c.fill();
      }
    }

    /** City buildings: a few footprints filling a block. @param {CanvasRenderingContext2D} c
     * @param {import('../rng.js').Rng} r @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 */
    function blockBuildings(c, r, x0, y0, x1, y1) {
      const w = x1 - x0, hh = y1 - y0;
      const split = w > hh;
      const n = 2 + r.int(2);
      let a = 0;
      for (let k = 0; k < n; k++) {
        const b = k === n - 1 ? 1 : a + (1 - a) * (0.35 + r.random() * 0.4);
        const gap = 3;
        const rx = split ? x0 + w * a + (k ? gap : 0) : x0, ry = split ? y0 : y0 + hh * a + (k ? gap : 0);
        const rw = split ? w * (b - a) - (k ? gap : 0) : w, rh = split ? hh : hh * (b - a) - (k ? gap : 0);
        c.globalAlpha = s.dark ? 0.04 : 0.06;
        c.fillStyle = s.colors[r.int(s.colors.length)];
        c.fillRect(rx, ry, rw, rh);
        c.globalAlpha = s.dark ? 0.16 : 0.2;
        c.strokeStyle = s.ink;
        c.lineWidth = 1;
        c.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
        a = b;
      }
    }

    /** Town houses with ridged roofs, and trees. @param {CanvasRenderingContext2D} c
     * @param {import('../rng.js').Rng} r @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 */
    function blockHouses(c, r, x0, y0, x1, y1) {
      const hs = R * 0.75;
      const cols = Math.max(1, Math.floor((x1 - x0) / (hs * 1.7)));
      const rows = Math.max(1, Math.floor((y1 - y0) / (hs * 1.7)));
      for (let i = 0; i < cols; i++) {
        for (let k = 0; k < rows; k++) {
          if (i > 0 && i < cols - 1 && k > 0 && k < rows - 1) continue;
          const cx = x0 + (i + 0.5) * (x1 - x0) / cols, cy = y0 + (k + 0.5) * (y1 - y0) / rows;
          if (r.random() < 0.3) {
            c.globalAlpha = s.dark ? 0.18 : 0.2;
            c.fillStyle = s.colors[2 % s.colors.length];
            c.beginPath(); c.arc(cx, cy, hs * (0.35 + r.random() * 0.2), 0, TAU); c.fill();
            continue;
          }
          const w = hs * (0.8 + r.random() * 0.3), hh = hs * (0.6 + r.random() * 0.2);
          c.globalAlpha = s.dark ? 0.16 : 0.18;
          c.fillStyle = s.colors[r.int(s.colors.length)];
          c.fillRect(cx - w / 2, cy - hh / 2, w, hh);
          c.globalAlpha = s.dark ? 0.26 : 0.3;
          c.strokeStyle = s.ink;
          c.lineWidth = 1;
          c.beginPath();
          c.rect(cx - w / 2, cy - hh / 2, w, hh);
          c.moveTo(cx - w / 2, cy - hh / 2); c.lineTo(cx - w / 2 + hh / 2, cy); c.lineTo(cx + w / 2 - hh / 2, cy); c.lineTo(cx + w / 2, cy - hh / 2);
          c.moveTo(cx - w / 2 + hh / 2, cy); c.lineTo(cx - w / 2, cy + hh / 2);
          c.moveTo(cx + w / 2 - hh / 2, cy); c.lineTo(cx + w / 2, cy + hh / 2);
          c.stroke();
        }
      }
      // Trees scattered in the gardens behind.
      c.globalAlpha = s.dark ? 0.16 : 0.18;
      c.fillStyle = s.colors[2 % s.colors.length];
      c.beginPath();
      const n = Math.round((x1 - x0) * (y1 - y0) / (hs * hs * 7));
      for (let k = 0; k < n; k++) {
        const tx = x0 + hs + r.random() * Math.max(1, x1 - x0 - 2 * hs), ty = y0 + hs + r.random() * Math.max(1, y1 - y0 - 2 * hs);
        const tr = hs * (0.2 + r.random() * 0.2);
        c.moveTo(tx + tr, ty); c.arc(tx, ty, tr, 0, TAU);
      }
      c.fill();
    }

    /** Corner plazas: paving squares and a few planters. @param {CanvasRenderingContext2D} c
     * @param {import('../rng.js').Rng} r @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 */
    function blockPlaza(c, r, x0, y0, x1, y1) {
      c.globalAlpha = s.dark ? 0.1 : 0.12;
      c.strokeStyle = s.ink;
      c.lineWidth = 1;
      const t = R * 0.5;
      c.beginPath();
      for (let x = x0 - ((x0 % t) + t) % t; x < x1; x += t) { c.moveTo(x, y0); c.lineTo(x, y1); }
      for (let y = y0 - ((y0 % t) + t) % t; y < y1; y += t) { c.moveTo(x0, y); c.lineTo(x1, y); }
      c.stroke();
      c.globalAlpha = s.dark ? 0.18 : 0.2;
      c.fillStyle = s.colors[2 % s.colors.length];
      c.beginPath();
      const n = Math.round((x1 - x0) * (y1 - y0) / (R * R * 2.5));
      for (let k = 0; k < n; k++) {
        const px = x0 + R * 0.6 + r.random() * Math.max(1, x1 - x0 - R * 1.2), py = y0 + R * 0.6 + r.random() * Math.max(1, y1 - y0 - R * 1.2);
        const pr = R * (0.18 + r.random() * 0.14);
        c.moveTo(px + pr, py); c.arc(px, py, pr, 0, TAU);
      }
      c.fill();
    }

    /** Distance along a lane from a to b, ahead of a. @param {Lane} l @param {number} a @param {number} b */
    const ahead = (l, a, b) => ((b - a) % l.L + l.L) % l.L;

    /** @param {number} dt */
    function advance(dt) {
      const vmax = clamp(R * 2.1, 60, 150), acc = vmax * 0.7, dec = vmax * 1.1;
      const gap = cl * 0.35;
      for (const l of lanes) l.cars.length = 0;
      for (const c of cars) c.lane.cars.push(c);
      for (const l of lanes) l.cars.sort((a, b) => a.p - b.p);
      for (const c of cars) {
        const l = c.lane;
        const i = l.cars.indexOf(c);
        const lead = l.cars.length > 1 ? l.cars[(i + 1) % l.cars.length] : null;
        let room = Infinity;
        if (lead) room = ahead(l, c.p, lead.p) - cl - gap;
        // The next junction whose stop line is still ahead.
        if (!c.plan && !c.arc) {
          let best = null, bd = Infinity;
          for (const q of l.js) {
            const d = ahead(l, c.p + cl / 2, q.p - stopOff);
            if (d < bd && d < l.L - R * 2) { bd = d; best = q; }
          }
          if (best) c.plan = { j: best.j, p: best.p, turn: rng.random() < 0.28 };
        }
        const pl = c.plan;
        if (pl) {
          const toStop = ahead(l, c.p + cl / 2, pl.p - stopOff);
          const before = toStop < l.L / 2 && toStop >= -0.5;
          if (before && toStop < R * 4) {
            let go = true;
            if (mode === 1) {
              // Four-way stop: halt, wait a moment, then go when the junction is clear.
              if (pl.j.occ !== c) {
                if (toStop > 1.5 || c.v > 2) go = false;
                else {
                  c.wait += dt;
                  go = c.wait > 0.9 && !pl.j.occ;
                  if (go) { pl.j.occ = c; c.held = pl.j; c.wait = 0; }
                }
              }
            } else {
              const lt = light(pl.j, l.h);
              go = lt === 0 || (lt === 1 && toStop < c.v * c.v / (2 * dec) * 0.6);
            }
            if (go) {
              // Never stop inside the junction: the way out must have room.
              if (pl.turn) {
                const nl = laneAt(pl.j, !l.h, l.h ? l.sgn : -l.sgn);
                if (nl) {
                  const ex = posOf(nl, nl.h ? pl.j.x : pl.j.y) + R / 2;
                  if (cars.some((o) => o !== c && o.lane === nl && Math.abs(ahead(nl, ex - R, o.p) - R) < R * 0.9 + cl)) go = mode === 1 && pl.j.occ === c;
                } else pl.turn = false;
              } else if (lead && ahead(l, pl.p + R / 2, lead.p) < l.L / 2 && ahead(l, pl.p + R / 2, lead.p) < cl * 1.5) go = false;
            }
            if (!go) room = Math.min(room, toStop);
          }
          if (pl.turn && ahead(l, pl.p - R / 2, c.p) < l.L / 2 && ahead(l, pl.p - R / 2, c.p) < R) {
            // Right turn: a quarter circle round the near corner onto the crossing street.
            const nl = laneAt(pl.j, !l.h, l.h ? l.sgn : -l.sgn);
            if (nl) {
              const [ex, ey] = world(l, pl.p - R / 2);
              const ndx = l.h ? 0 : -l.sgn, ndy = l.h ? l.sgn : 0;
              const rr = R / 2 - off;
              const cx = ex + ndx * rr, cy = ey + ndy * rr;
              const end = posOf(nl, nl.h ? pl.j.x : pl.j.y) + R / 2;
              const len = rr * Math.PI / 2;
              c.arc = { cx, cy, r: rr, a0: Math.atan2(ey - cy, ex - cx), len, end };
              c.lane = nl;
              c.p = end - len;
              c.plan = null;
            }
          } else if (!pl.turn && ahead(l, pl.p + R / 2, c.p) < l.L / 2 && ahead(l, pl.p + R / 2, c.p) > cl / 2) {
            if (c.held) { c.held.occ = null; c.held = null; }
            c.plan = null;
          }
        }
        if (c.arc && ahead(c.lane, c.p, c.arc.end) > c.lane.L / 2) {
          c.arc = null;
          if (c.held) { c.held.occ = null; c.held = null; }
        }
        const want = Math.min(vmax * (c.arc ? 0.6 : 1), Math.sqrt(2 * dec * Math.max(0, room)));
        const nv = want > c.v ? Math.min(want, c.v + acc * dt) : want;
        c.brake = clamp(c.brake + (nv < c.v - 0.5 || nv < 1 ? 4 : -3) * dt, 0, 1);
        c.v = nv;
        c.p = ((c.p + c.v * dt) % c.lane.L + c.lane.L) % c.lane.L;
      }
      for (const w of walkers) {
        const lt = light(junctions[0], true);
        if (!w.walking && lt === 3 && ((s.t + junctions[0].off) % CYCLE) < 2 * (GREEN + AMBER + CLEAR) + WALK * 0.5) {
          w.walking = true; w.u = 0; w.fx = w.x; w.fy = w.y;
        }
        if (w.walking) {
          const len = Math.hypot(w.tx - w.fx, w.ty - w.fy) || 1;
          w.u = Math.min(1, w.u + dt * (R * 0.42) / len);
          w.x = w.fx + (w.tx - w.fx) * w.u; w.y = w.fy + (w.ty - w.fy) * w.u;
          if (w.u >= 1) {
            w.walking = false;
            // Wait here to cross back next time.
            const fx = w.fx, fy = w.fy;
            w.fx = w.tx; w.fy = w.ty; w.tx = fx; w.ty = fy;
          }
        }
      }
    }

    let laid = false;
    return {
      lay() {
        build();
        if (!laid) { laid = true; for (let k = 0; k < 120; k++) { s.t += 0.1; advance(0.1); } }
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        if (stale) paintCache();
        ctx.drawImage(cache, 0, 0, s.W, s.H);
        const d = s.dpr;
        ctx.globalAlpha = s.dark ? 0.62 : 0.6;
        for (const c of cars) {
          let x, y, a;
          if (c.arc) {
            const u = clamp(1 - ahead(c.lane, c.p, c.arc.end) / c.arc.len, 0, 1);
            const ang = c.arc.a0 + u * Math.PI / 2;
            x = c.arc.cx + Math.cos(ang) * c.arc.r; y = c.arc.cy + Math.sin(ang) * c.arc.r;
            a = ang + Math.PI / 2;
          } else {
            [x, y] = world(c.lane, c.p);
            a = c.lane.h ? (c.lane.sgn > 0 ? 0 : Math.PI) : (c.lane.sgn > 0 ? Math.PI / 2 : -Math.PI / 2);
          }
          if (x < -cl || y < -cl || x > s.W + cl || y > s.H + cl) continue;
          const co = Math.cos(a), si = Math.sin(a);
          ctx.setTransform(co, si, -si, co, x * d, y * d);
          const sp = sprites[c.col % sprites.length];
          ctx.drawImage(sp, -sp.width / 2, -sp.height / 2);
          if (c.brake > 0.05) {
            ctx.globalAlpha = c.brake * 0.8;
            ctx.fillStyle = '#ff4b3e';
            ctx.fillRect(-sp.width / 2 + 1, -cw * d * 0.42, 1.6 * d, cw * d * 0.24);
            ctx.fillRect(-sp.width / 2 + 1, cw * d * 0.18, 1.6 * d, cw * d * 0.24);
            ctx.globalAlpha = s.dark ? 0.62 : 0.6;
          }
        }
        ctx.setTransform(d, 0, 0, d, 0, 0);
        if (mode !== 1) {
          // Signal heads on the right-hand corner of each approach.
          const lr = Math.max(2.2, R * 0.075), h = R / 2 + lr * 1.8;
          const cols = ['#4fd18b', '#ffb238', '#ff5a4a', '#ff5a4a'];
          for (const j of junctions) {
            const lh = light(j, true), lv = light(j, false);
            ctx.globalAlpha = s.dark ? 0.7 : 0.75;
            for (const [dx, dy, hz] of [[-1, 1, 1], [1, -1, 1], [-1, -1, 0], [1, 1, 0]]) {
              ctx.fillStyle = cols[hz ? lh : lv];
              ctx.beginPath(); ctx.arc(j.x + dx * h, j.y + dy * h, lr, 0, TAU); ctx.fill();
            }
          }
        }
        if (walkers.length) {
          const wr = Math.max(2.5, R * 0.065);
          ctx.globalAlpha = s.dark ? 0.7 : 0.72;
          for (const w of walkers) {
            ctx.fillStyle = s.colors[w.col % s.colors.length];
            ctx.beginPath(); ctx.arc(w.x, w.y, wr, 0, TAU); ctx.fill();
          }
        }
      },
    };
  });
}
