// Circuit: circuit-board traces routed on a grid in straight runs and 45-degree bends, ending in
// pads, with pulses of light running along them and each pad warming as a pulse arrives. The
// seed picks the variant: a dense board of single traces with vias, pulses running anywhere; a
// few chips whose pins fan out into traces, pulses running out of them and back in; or wide
// buses of parallel traces sweeping across the board, pulses crossing them as whole words.

import { stage, TAU, clamp } from './stage.js';

const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];

/** @typedef {{x:number[], y:number[], len:number[], k:number, pa:number, pb:number}} Trace
 *  x, y the points in px, len the length run to each, k its colour, pa/pb the pads at its ends (-1 none) */
/** @typedef {{t:number, s:number, v:number, dir:number, l:number}} Pulse  s px along trace t, dir +-1 */
/** @typedef {{x:number, y:number, k:number, heat:number, rise:number}} Pad */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const board = document.createElement('canvas');
    const gb = /** @type {CanvasRenderingContext2D} */ (board.getContext('2d'));
    const glows = s.colors.map((c) => glow(c));
    let p = 20, R = 1, cols = 0, rows = 0, ox = 0, oy = 0, spawn = 0;
    let occ = new Int16Array(0);
    /** @type {Trace[]} */
    let traces = [];
    /** @type {Pad[]} */
    let pads = [];
    /** @type {Pulse[]} */
    let pulses = [];
    /** @type {{x:number, y:number, w:number, h:number}[]} */
    let chips = [];
    /** @type {{x:number, y:number}[]} */
    let vias = [];
    /** For buses: the traces of each, so a word crosses all of them. @type {number[][]} */
    let buses = [];

    const free = (/** @type {number} */ i, /** @type {number} */ j) => i >= 0 && j >= 0 && i < cols && j < rows && !occ[j * cols + i];
    const X = (/** @type {number} */ i) => ox + i * p;
    const Y = (/** @type {number} */ j) => oy + j * p;

    /** Walks a route from node i, j heading d, marking nodes with `id`.
     * @param {number} i @param {number} j @param {number} d @param {number} max @param {number} turn
     * chance of a 45-degree turn a step @param {number} id @param {number} [straight] steps before any turn
     * @param {number} [halo] nodes kept clear round the route, ahead and to the sides
     * @returns {number[]} the nodes as i, j pairs */
    function walk(i, j, d, max, turn, id, straight = 0, halo = 0) {
      const at = [i, j];
      occ[j * cols + i] = id;
      for (let n = 0; n < max; n++) {
        let nd = d;
        if (n >= straight && rng.random() < turn) nd = (d + (rng.random() < 0.5 ? 1 : 7)) % 8;
        let ok = false;
        // The way chosen, else straight on, else the turn the other way.
        const other = nd !== d ? (2 * d - nd + 8) % 8 : (d + (rng.random() < 0.5 ? 1 : 7)) % 8;
        for (const c of [nd, d, other]) {
          const ni = i + DX[c], nj = j + DY[c];
          if (!free(ni, nj)) continue;
          // A diagonal may not cut between two taken nodes, which would cross another trace.
          if (c % 2 && !free(i + DX[c], j) && !free(i, j + DY[c])) continue;
          if (halo && !clear(ni, nj, c, halo)) continue;
          d = c; ok = true; break;
        }
        if (!ok) break;
        i += DX[d]; j += DY[d];
        at.push(i, j);
        occ[j * cols + i] = id;
        // A node's room is claimed a few steps later, out of the way of the route's own next steps.
        const m = at.length / 2 - 1 - (halo + 2);
        if (halo && m >= 0) mark(at[m * 2], at[m * 2 + 1], halo, id);
      }
      if (halo) for (let m = Math.max(0, at.length / 2 - halo - 2); m < at.length / 2; m++) mark(at[m * 2], at[m * 2 + 1], halo, id);
      return at;
    }

    /** Whether the nodes ahead of i, j in direction d, `h` either side, are free.
     * @param {number} i @param {number} j @param {number} d @param {number} h @returns {boolean} */
    function clear(i, j, d, h) {
      for (let a = 1; a <= h + 1; a++) {
        for (let b = -h; b <= h; b++) {
          const ci = i + DX[d] * a - DY[d] * b, cj = j + DY[d] * a + DX[d] * b;
          if (ci < -h - 2 || cj < -h - 2 || ci > cols + h + 1 || cj > rows + h + 1) continue;
          if (ci >= 0 && cj >= 0 && ci < cols && cj < rows && occ[cj * cols + ci]) return false;
        }
      }
      return true;
    }

    /** Marks the nodes within h of i, j. @param {number} i @param {number} j @param {number} h @param {number} id @returns {void} */
    function mark(i, j, h, id) {
      for (let b = -h; b <= h; b++) {
        for (let a = -h; a <= h; a++) {
          const ci = i + a, cj = j + b;
          if (ci >= 0 && cj >= 0 && ci < cols && cj < rows && !occ[cj * cols + ci]) occ[cj * cols + ci] = id;
        }
      }
    }

    /** A trace through points in px, with a pad at the ends asked for.
     * @param {number[]} xs @param {number[]} ys @param {number} k @param {boolean} a @param {boolean} b @returns {number} its index */
    function addTrace(xs, ys, k, a, b) {
      const len = [0];
      for (let n = 1; n < xs.length; n++) len.push(len[n - 1] + Math.hypot(xs[n] - xs[n - 1], ys[n] - ys[n - 1]));
      const pad = (/** @type {number} */ n) => { pads.push({ x: xs[n], y: ys[n], k, heat: 0, rise: 0 }); return pads.length - 1; };
      traces.push({ x: xs, y: ys, len, k, pa: a ? pad(0) : -1, pb: b ? pad(xs.length - 1) : -1 });
      return traces.length - 1;
    }

    /** Turns a walked route into a trace, if long enough. @param {number[]} at @param {number} k
     * @param {boolean} padStart @returns {boolean} */
    function keep(at, k, padStart) {
      if (at.length < 8) return false;
      /** @type {number[]} */ const xs = [];
      /** @type {number[]} */ const ys = [];
      for (let n = 0; n < at.length; n += 2) { xs.push(X(at[n])); ys.push(Y(at[n + 1])); }
      addTrace(xs, ys, k, padStart, true);
      for (let n = 4; n < at.length - 4; n += 2) if (rng.random() < 0.035) vias.push({ x: X(at[n]), y: Y(at[n + 1]) });
      return true;
    }

    /** Fills free space with single traces. @param {number} tries @param {number} id0 @returns {void} */
    function scatter(tries, id0) {
      for (let n = 0; n < tries; n++) {
        const i = rng.int(cols), j = rng.int(rows);
        if (!free(i, j) || !free(i + 1, j) || !free(i - 1, j) || !free(i, j + 1) || !free(i, j - 1)) continue;
        const at = walk(i, j, rng.int(4) * 2, 6 + rng.int(26), 0.16, id0 + n);
        if (!keep(at, rng.int(nc), true)) for (let m = 0; m < at.length; m += 2) occ[at[m + 1] * cols + at[m]] = 0;
      }
    }

    /** Routes a bus: a spine walked with room either side, offset into parallel traces. @param {number} id @returns {void} */
    function bus(id) {
      const n = 3 + rng.int(3), sp = p * 0.5, h = Math.max(1, Math.ceil((n - 1) * sp / 2 / p));
      // Start on an edge heading in, or anywhere free heading anywhere.
      const side = rng.int(6);
      const i = side === 0 ? 0 : side === 1 ? cols - 1 : rng.int(cols);
      const j = side === 2 ? 0 : side === 3 ? rows - 1 : rng.int(rows);
      const d = side === 0 ? 0 : side === 1 ? 4 : side === 2 ? 2 : side === 3 ? 6 : rng.int(4) * 2;
      if (!free(i, j) || !clear(i, j, d, h)) return;
      const at = walk(i, j, d, 20 + rng.int(50), 0.1, id, 3, h);
      if (at.length < 16) {
        // Too short to keep: give back the room it claimed.
        for (let q = 0; q < occ.length; q++) if (occ[q] === id) occ[q] = 0;
        return;
      }
      const m = at.length / 2, k = rng.int(nc);
      /** @type {number[]} */ const ids = [];
      for (let b = 0; b < n; b++) {
        const o = (b - (n - 1) / 2) * sp;
        /** @type {number[]} */ const xs = [];
        /** @type {number[]} */ const ys = [];
        for (let q = 0; q < m; q++) {
          // The mitred normal at this point, from the steps either side.
          const a0 = Math.max(0, q - 1), a1 = Math.min(m - 1, q + 1);
          let nx = 0, ny = 0;
          for (const [u, v] of [[a0, q], [q, a1]]) {
            if (u === v) continue;
            const dx = at[v * 2] - at[u * 2], dy = at[v * 2 + 1] - at[u * 2 + 1], l = Math.hypot(dx, dy);
            nx += -dy / l; ny += dx / l;
          }
          const l = Math.hypot(nx, ny) || 1, cos = l / 2 || 1;
          nx /= l; ny /= l;
          const f = q === a0 || q === a1 ? 1 : 1 / Math.max(0.7, cos);
          xs.push(X(at[q * 2]) + nx * o * f); ys.push(Y(at[q * 2 + 1]) + ny * o * f);
        }
        ids.push(addTrace(xs, ys, k, true, true));
      }
      buses.push(ids);
    }

    /** Lays out the board for this size and paints it. @returns {void} */
    function build() {
      R = clamp(Math.min(s.W, s.H) / 700, 0.75, 1.4);
      p = clamp(Math.round(Math.min(s.W, s.H) / 30), 14, 28);
      cols = Math.ceil(s.W / p) + 1; rows = Math.ceil(s.H / p) + 1;
      ox = (s.W - (cols - 1) * p) / 2; oy = (s.H - (rows - 1) * p) / 2;
      occ = new Int16Array(cols * rows);
      traces = []; pads = []; pulses = []; chips = []; vias = []; buses = [];
      const area = cols * rows;
      if (layout === 1) {
        const n = clamp(Math.round(s.W * s.H / 300000), 2, 5);
        /** @type {[number, number, number][]} */ const pins = [];
        for (let c = 0, tries = 0; c < n && tries < 60; tries++) {
          const w = 4 + rng.int(5), h = 3 + rng.int(4);
          const i0 = 4 + rng.int(Math.max(1, cols - w - 8)), j0 = 4 + rng.int(Math.max(1, rows - h - 8));
          let ok = true;
          for (let j = j0 - 3; j <= j0 + h + 3 && ok; j++) for (let i = i0 - 3; i <= i0 + w + 3; i++) if (!free(i, j)) { ok = false; break; }
          if (!ok) continue;
          for (let j = j0 - 1; j <= j0 + h + 1; j++) for (let i = i0 - 1; i <= i0 + w + 1; i++) occ[j * cols + i] = 1;
          chips.push({ x: X(i0), y: Y(j0), w: w * p, h: h * p });
          c++;
          // A pin at every node along each side, its trace leaving straight, then free.
          for (let i = i0 + 1; i < i0 + w; i++) { pins.push([i, j0 - 1, 6], [i, j0 + h + 1, 2]); }
          for (let j = j0 + 1; j < j0 + h; j++) { pins.push([i0 - 1, j, 4], [i0 + w + 1, j, 0]); }
        }
        // Every chip placed before any pin is routed, so the first chip's traces don't crowd out the rest.
        for (const [i, j, d] of rng.shuffle(pins)) {
          const at = walk(i, j, d, 10 + rng.int(40), 0.14, 2 + traces.length, 2);
          // The pin end gets no pad; it meets the chip.
          at[0] -= DX[d]; at[1] -= DY[d];
          keep(at, rng.int(nc), false);
        }
        scatter(Math.round(area * 0.15), 1000);
      } else if (layout === 2) {
        const n = clamp(Math.round(area / 60), 5, 40);
        for (let b = 0; b < n * 8 && buses.length < n; b++) bus(2 + b);
        scatter(Math.round(area * 0.3), 2000);
      } else {
        scatter(Math.round(area * 0.7), 2);
      }
      paintBoard();
    }

    /** Paints the static board: traces, pads, vias and chips. @returns {void} */
    function paintBoard() {
      board.width = Math.round(s.W * s.dpr); board.height = Math.round(s.H * s.dpr);
      gb.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      gb.lineCap = 'round'; gb.lineJoin = 'round';
      const A = s.dark ? 0.3 : 0.34;
      gb.lineWidth = 1.8 * R;
      for (let k = 0; k < nc; k++) {
        gb.strokeStyle = s.colors[k];
        gb.globalAlpha = A;
        gb.beginPath();
        for (const t of traces) {
          if (t.k !== k) continue;
          gb.moveTo(t.x[0], t.y[0]);
          for (let n = 1; n < t.x.length; n++) gb.lineTo(t.x[n], t.y[n]);
        }
        gb.stroke();
        // Pads: rings, their middles cleared.
        gb.globalAlpha = A * 1.4;
        gb.fillStyle = s.colors[k];
        gb.beginPath();
        for (const d of pads) if (d.k === k) { gb.moveTo(d.x + 3.6 * R, d.y); gb.arc(d.x, d.y, 3.6 * R, 0, TAU); }
        gb.fill();
      }
      gb.globalAlpha = A * 1.2;
      gb.fillStyle = s.ink;
      gb.beginPath();
      for (const v of vias) { gb.moveTo(v.x + 2.6 * R, v.y); gb.arc(v.x, v.y, 2.6 * R, 0, TAU); }
      gb.fill();
      gb.globalCompositeOperation = 'destination-out';
      gb.globalAlpha = 1;
      gb.beginPath();
      for (const d of pads) { gb.moveTo(d.x + 1.5 * R, d.y); gb.arc(d.x, d.y, 1.5 * R, 0, TAU); }
      for (const v of vias) { gb.moveTo(v.x + 1.1 * R, v.y); gb.arc(v.x, v.y, 1.1 * R, 0, TAU); }
      gb.fill();
      gb.globalCompositeOperation = 'source-over';
      for (const c of chips) {
        const m = p * 0.35;
        gb.globalAlpha = s.dark ? 0.12 : 0.1;
        gb.fillStyle = s.ink;
        gb.fillRect(c.x - m, c.y - m, c.w + 2 * m, c.h + 2 * m);
        gb.globalAlpha = s.dark ? 0.32 : 0.36;
        gb.strokeStyle = s.ink;
        gb.lineWidth = 1.5 * R;
        gb.strokeRect(c.x - m, c.y - m, c.w + 2 * m, c.h + 2 * m);
        // The pin-1 dot.
        gb.beginPath();
        gb.arc(c.x + p * 0.4, c.y + p * 0.4, 2.4 * R, 0, TAU);
        gb.fillStyle = s.ink;
        gb.fill();
      }
      gb.globalAlpha = 1;
    }

    /** Starts a pulse on trace t (or a word across a bus). @returns {void} */
    function launch() {
      if (!traces.length) return;
      const v = (70 + rng.random() * 60) * R, l = (26 + rng.random() * 26) * R;
      if (layout === 2 && buses.length && rng.random() < 0.75) {
        const ids = buses[rng.int(buses.length)], dir = rng.random() < 0.5 ? 1 : -1;
        for (const t of ids) {
          if (rng.random() < 0.3) continue;
          const L = traces[t].len[traces[t].len.length - 1];
          pulses.push({ t, s: dir > 0 ? 0 : L, v, dir, l });
        }
        return;
      }
      const t = rng.int(traces.length), L = traces[t].len[traces[t].len.length - 1];
      // Off a chip: out along the trace, or back in to the pin.
      const dir = rng.random() < 0.5 ? 1 : -1;
      pulses.push({ t, s: dir > 0 ? 0 : L, v, dir, l });
    }

    /** The point `d` px along trace t. @param {Trace} t @param {number} d @returns {[number, number]} */
    function at(t, d) {
      const L = t.len;
      d = clamp(d, 0, L[L.length - 1]);
      let n = 1;
      while (n < L.length - 1 && L[n] < d) n++;
      const u = (d - L[n - 1]) / ((L[n] - L[n - 1]) || 1);
      return [t.x[n - 1] + (t.x[n] - t.x[n - 1]) * u, t.y[n - 1] + (t.y[n] - t.y[n - 1]) * u];
    }

    const cap = () => clamp(Math.round(traces.length * 0.35), 8, 48);

    /** @param {number} dt @returns {void} */
    function step(dt) {
      spawn += dt * cap() / 3;
      while (spawn >= 1 && pulses.length < cap()) { spawn--; launch(); }
      if (spawn > 1) spawn = 1;
      for (let n = pulses.length - 1; n >= 0; n--) {
        const q = pulses[n], t = traces[q.t], L = t.len[t.len.length - 1];
        q.s += q.v * q.dir * dt;
        // Arrived: the pad warms, and the pulse runs off the end as its tail catches up.
        const end = q.dir > 0 ? t.pb : t.pa;
        if ((q.dir > 0 ? q.s >= L : q.s <= 0) && end >= 0 && !pads[end].rise) pads[end].rise = 1;
        if (q.dir > 0 ? q.s - q.l > L : q.s + q.l < 0) pulses.splice(n, 1);
      }
      for (const d of pads) {
        if (d.rise) { d.heat = Math.min(1, d.heat + dt * 2.5); if (d.heat >= 1) d.rise = 0; }
        else d.heat = Math.max(0, d.heat - dt * 0.6);
      }
    }

    return {
      lay() {
        build();
        // Pulses already under way on the first frame.
        for (let n = 0; n < 90; n++) step(1 / 15);
      },
      step,
      draw() {
        const { ctx } = s;
        ctx.drawImage(board, 0, 0, s.W, s.H);
        if (s.dark) ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2.4 * R;
        for (const d of pads) {
          if (d.heat < 0.02) continue;
          ctx.globalAlpha = d.heat * (s.dark ? 0.55 : 0.45);
          const r = 11 * R;
          ctx.drawImage(glows[d.k], d.x - r, d.y - r, r * 2, r * 2);
        }
        for (const q of pulses) {
          const t = traces[q.t];
          // The tail in three fading parts, then a glow at the head.
          const L = t.len[t.len.length - 1];
          ctx.strokeStyle = s.colors[t.k];
          for (let n = 0; n < 3; n++) {
            const a = q.s - q.dir * q.l * n / 3, b = q.s - q.dir * q.l * (n + 1) / 3;
            if ((a < 0 && b < 0) || (a > L && b > L)) continue;
            ctx.globalAlpha = (s.dark ? 0.85 : 0.75) * (1 - n / 3);
            ctx.beginPath();
            const [x0, y0] = at(t, a);
            ctx.moveTo(x0, y0);
            const lo = Math.min(a, b), hi = Math.max(a, b);
            // Through any bends between the two ends.
            for (let m = 1; m < t.len.length - 1; m++) {
              const k = q.dir > 0 ? t.len.length - 1 - m : m;
              if (t.len[k] > lo && t.len[k] < hi) ctx.lineTo(t.x[k], t.y[k]);
            }
            const [x1, y1] = at(t, b);
            ctx.lineTo(x1, y1);
            ctx.stroke();
          }
          if (q.s >= 0 && q.s <= L) {
            const [x, y] = at(t, q.s), r = 8 * R;
            ctx.globalAlpha = s.dark ? 0.7 : 0.5;
            ctx.drawImage(glows[t.k], x - r, y - r, r * 2, r * 2);
          }
        }
      },
    };
  });
}

/** A round glow with a bright core, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function glow(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 48, 48);
  const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.2, 'rgba(0,0,0,.75)');
  grad.addColorStop(0.55, 'rgba(0,0,0,.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 48, 48);
  return c;
}
