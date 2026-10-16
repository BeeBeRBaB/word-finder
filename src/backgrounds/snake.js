// Snake: a self-playing snake game on a coarse grid, gliding cell to cell to eat dots and growing,
// fading out and starting over when it is long or boxed in. The seed picks the variant: one snake
// chasing one dot in a walled field, three snakes racing for a few dots, or one snake on a
// wrap-around field grazing rows of small dots that grow back once it has cleared them.

import { stage, clamp } from './stage.js';

/** @typedef {{body:number[], gone:number, c:number, fade:number, wait:number, grow:number, ate:number}} Snake
 * body is cell indices, head first; gone the cell the tail just left (-1 when it grew);
 * fade 1 alive .. 0 gone while dying (dying while < 1); wait seconds until it respawns. */
/** @typedef {{cell:number, a:number, big:boolean}} Dot a: 0..1 grown in; big is a meal, small grazing */
/** @typedef {{x:number, y:number, t:number, c:number}} Pop a dot just eaten, for a fading ring */

const NB = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    const wrap = s.layout === 2;
    const RATE = wrap ? 5.5 : 5; // cells per second
    let cell = 30, cols = 0, rows = 0, ox = 0, oy = 0, cap = 40;
    /** @type {Snake[]} */
    let snakes = [];
    /** @type {Dot[]} */
    let dots = [];
    /** @type {Pop[]} */
    const pops = [];
    /** Bodies on each cell. @type {Uint8Array} */
    let occ = new Uint8Array(0);
    /** BFS scratch. @type {Int32Array} */
    let prev = new Int32Array(0);
    /** @type {Int32Array} */
    let queue = new Int32Array(0);
    let phase = 0; // 0..1 between moves

    /** The neighbour of `i` in direction `d`, or -1 off a walled edge. @param {number} i @param {number} d */
    function nb(i, d) {
      let x = (i % cols) + NB[d][0], y = Math.floor(i / cols) + NB[d][1];
      if (wrap) { x = (x + cols) % cols; y = (y + rows) % rows; }
      else if (x < 0 || y < 0 || x >= cols || y >= rows) return -1;
      return y * cols + x;
    }

    /** @param {number} i @returns {number} */
    const free = (i) => i >= 0 && occ[i] === 0 ? 1 : 0;

    /** Cells reachable from `from`, up to `limit`. @param {number} from @param {number} limit */
    function room(from, limit) {
      prev.fill(-2);
      let h = 0, t = 0;
      queue[t++] = from; prev[from] = from;
      while (h < t && t < limit) {
        const i = queue[h++];
        for (let d = 0; d < 4; d++) {
          const j = nb(i, d);
          if (j >= 0 && prev[j] === -2 && free(j)) { prev[j] = i; queue[t++] = j; }
        }
      }
      return t;
    }

    /** The first step of a shortest free path from `from` to any wanted dot, or -1.
     * @param {number} from @param {Set<number>} want @returns {number} */
    function route(from, want) {
      prev.fill(-2);
      let h = 0, t = 0;
      queue[t++] = from; prev[from] = from;
      const order = rng.shuffle([0, 1, 2, 3]);
      while (h < t) {
        const i = queue[h++];
        if (i !== from && want.has(i)) {
          let j = i;
          while (prev[j] !== from) j = prev[j];
          return j;
        }
        for (const d of order) {
          const j = nb(i, d);
          if (j >= 0 && prev[j] === -2 && free(j)) { prev[j] = i; queue[t++] = j; }
        }
      }
      return -1;
    }

    /** A random empty cell, or -1. @returns {number} */
    function empty() {
      for (let k = 0; k < 60; k++) {
        const i = rng.int(cols * rows);
        if (occ[i] === 0 && !dots.some((d) => d.cell === i)) return i;
      }
      return -1;
    }

    /** @param {Snake} sn @param {number} len */
    function spawn(sn, len) {
      for (let k = 0; k < 40; k++) {
        const head = empty();
        if (head < 0) return;
        const d = rng.int(4);
        /** @type {number[]} */
        const body = [head];
        for (let i = 1; i < len; i++) {
          const j = nb(body[i - 1], (d + 2) % 4);
          if (j < 0 || occ[j] || body.includes(j)) break;
          body.push(j);
        }
        if (body.length < Math.min(len, 3)) continue;
        sn.body = body; sn.gone = -1; sn.fade = 1; sn.wait = 0; sn.grow = 0; sn.ate = 0;
        for (const i of body) occ[i]++;
        return;
      }
    }

    /** Tops the dots up to what the variant keeps on the board. */
    function feed() {
      if (wrap) {
        if (dots.length) return;
        // A fresh crop: every other cell of every other row, growing in.
        for (let y = 1; y < rows; y += 2) {
          for (let x = (y >> 1) % 2; x < cols; x += 2) {
            const i = y * cols + x;
            if (!occ[i]) dots.push({ cell: i, a: -rng.random() * 0.8 - Math.abs(x - cols / 2) / cols, big: false });
          }
        }
        return;
      }
      const want = s.layout === 1 ? 4 : 1;
      while (dots.length < want) {
        const i = empty();
        if (i < 0) return;
        dots.push({ cell: i, a: 0, big: true });
      }
    }

    /** @param {Snake} sn */
    function kill(sn) {
      sn.fade = 0.999;
      for (const i of sn.body) occ[i]--;
    }

    /** One move of every snake. */
    function move() {
      for (const sn of snakes) {
        if (sn.fade < 1) continue;
        const head = sn.body[0];
        const tail = sn.body[sn.body.length - 1];
        // The tail moves out of the way this move unless the snake is growing.
        if (!sn.grow) occ[tail]--;
        const want = new Set(dots.filter((d) => d.a >= 1).map((d) => d.cell));
        let next = want.size ? route(head, want) : -1;
        // Take the way to food only if it leaves the snake room to live; else the roomiest way.
        if (next >= 0) {
          occ[next]++;
          const r = room(next, sn.body.length + 2);
          occ[next]--;
          if (r < sn.body.length + 1) next = -1;
        }
        if (next < 0) {
          let best = 0;
          for (let d = 0; d < 4; d++) {
            const j = nb(head, d);
            if (!free(j)) continue;
            occ[j]++;
            const r = room(j, cols * rows) + rng.random();
            occ[j]--;
            if (r > best) { best = r; next = j; }
          }
        }
        if (next < 0) { if (!sn.grow) occ[tail]++; kill(sn); continue; }
        sn.body.unshift(next);
        occ[next]++;
        if (sn.grow) { sn.grow--; sn.gone = -1; } else { sn.gone = /** @type {number} */ (sn.body.pop()); }
        const k = dots.findIndex((d) => d.cell === next);
        if (k >= 0) {
          const d = dots[k];
          dots.splice(k, 1);
          pops.push({ x: next % cols, y: Math.floor(next / cols), t: 0, c: sn.c });
          sn.ate++;
          // A meal is one more segment; grazing grows it every third dot.
          if (d.big || sn.ate % 3 === 0) sn.grow++;
        }
        if (sn.body.length >= cap) kill(sn);
      }
      feed();
    }

    /** @param {number} dt */
    function advance(dt) {
      phase += dt * RATE;
      while (phase >= 1) { phase -= 1; move(); }
      for (const d of dots) d.a = Math.min(1, d.a + dt * 1.2);
      for (const p of pops) p.t += dt;
      while (pops.length && pops[0].t > 0.7) pops.shift();
      for (const sn of snakes) {
        if (sn.fade < 1 && sn.fade > 0) sn.fade = Math.max(0, sn.fade - dt * 0.8);
        else if (sn.fade <= 0) {
          sn.wait += dt;
          if (sn.wait > 0.8) spawn(sn, 4);
        }
      }
    }

    function reset() {
      occ = new Uint8Array(cols * rows);
      prev = new Int32Array(cols * rows);
      queue = new Int32Array(cols * rows);
      dots = []; pops.length = 0; phase = 0;
      cap = wrap ? clamp(Math.round(cols * 1.4), 18, 46) : clamp(Math.round(cols * rows * 0.22), 14, 60);
      const n = s.layout === 1 ? 3 : 1;
      snakes = [];
      for (let k = 0; k < n; k++) {
        /** @type {Snake} */
        const sn = { body: [], gone: -1, c: (k * 2 + 1) % nc, fade: 0, wait: 0, grow: 0, ate: 0 };
        snakes.push(sn);
        spawn(sn, s.layout === 1 ? 5 : 7);
      }
      feed();
      // A first frame with the game well under way.
      for (let k = 0; k < 90; k++) advance(1 / 30);
    }

    return {
      lay() {
        const c = clamp(Math.min(s.W, s.H) / 15, 22, 46);
        const nc2 = Math.max(6, Math.floor(s.W / c)), nr = Math.max(6, Math.floor(s.H / c));
        cell = Math.min(s.W / nc2, s.H / nr);
        ox = (s.W - nc2 * cell) / 2; oy = (s.H - nr * cell) / 2;
        if (nc2 !== cols || nr !== rows) { cols = nc2; rows = nr; reset(); }
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        const u = phase;
        const pw = cols * cell, ph = rows * cell;
        // The grid: a dot at each cell's middle; a wall round a walled field.
        ctx.globalAlpha = s.dark ? 0.12 : 0.16;
        ctx.fillStyle = s.ink;
        ctx.beginPath();
        const g = Math.max(1.5, cell * 0.06);
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) ctx.rect(ox + (x + 0.5) * cell - g / 2, oy + (y + 0.5) * cell - g / 2, g, g);
        }
        ctx.fill();
        if (!wrap) {
          ctx.globalAlpha = s.dark ? 0.2 : 0.26;
          ctx.strokeStyle = s.ink;
          ctx.lineWidth = 2;
          ctx.strokeRect(ox + 2, oy + 2, pw - 4, ph - 4);
        }
        // Dots: meals breathe slowly, grazing dots are small and steady.
        for (const d of dots) {
          if (d.a <= 0) continue;
          const x = ox + (d.cell % cols + 0.5) * cell, y = oy + (Math.floor(d.cell / cols) + 0.5) * cell;
          const r = cell * (d.big ? 0.24 + 0.03 * Math.sin(s.t * 2.4 + d.cell) : 0.11) * d.a;
          ctx.globalAlpha = (d.big ? 0.6 : 0.4) * d.a;
          ctx.fillStyle = s.colors[d.big ? 0 : d.cell % nc];
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        // Rings where dots were eaten.
        ctx.lineWidth = 2;
        for (const p of pops) {
          const k = p.t / 0.7;
          ctx.globalAlpha = 0.4 * (1 - k);
          ctx.strokeStyle = s.colors[p.c];
          const r = cell * (0.25 + 0.5 * k);
          ctx.strokeRect(ox + (p.x + 0.5) * cell - r, oy + (p.y + 0.5) * cell - r, r * 2, r * 2);
        }
        // Snakes: square segments sliding cell to cell, tail first so the head is on top.
        for (const sn of snakes) {
          if (!sn.body.length || sn.fade <= 0) continue;
          ctx.fillStyle = s.colors[sn.c];
          const L = sn.body.length;
          const moving = sn.fade >= 1 ? u : 1;
          // Unwrapped grid positions, head first, then where the tail came from.
          let px = sn.body[0] % cols, py = Math.floor(sn.body[0] / cols);
          const pts = [px, py];
          const chain = sn.gone >= 0 ? [...sn.body, sn.gone] : sn.body;
          for (let i = 1; i < chain.length; i++) {
            let dx = chain[i] % cols - chain[i - 1] % cols, dy = Math.floor(chain[i] / cols) - Math.floor(chain[i - 1] / cols);
            if (dx > 1) dx -= cols; else if (dx < -1) dx += cols;
            if (dy > 1) dy -= rows; else if (dy < -1) dy += rows;
            px += dx; py += dy;
            pts.push(px, py);
          }
          for (let k = L - 1; k >= 0; k--) {
            const a = k * 2, b = Math.min(k + 1, pts.length / 2 - 1) * 2;
            let x = pts[b] + (pts[a] - pts[b]) * moving, y = pts[b + 1] + (pts[a + 1] - pts[b + 1]) * moving;
            const head = k === 0;
            const size = cell * (head ? 0.8 : 0.74 - 0.16 * k / L);
            ctx.globalAlpha = (head ? 0.62 : 0.5 - 0.22 * k / L) * sn.fade;
            if (wrap) { x = ((x % cols) + cols) % cols; y = ((y % rows) + rows) % rows; }
            const sx = ox + (x + 0.5) * cell - size / 2, sy = oy + (y + 0.5) * cell - size / 2;
            ctx.fillRect(sx, sy, size, size);
            // A segment sliding over a wrapped edge shows on both sides.
            if (wrap && x > cols - 1) ctx.fillRect(sx - pw, sy, size, size);
            if (wrap && y > rows - 1) ctx.fillRect(sx, sy - ph, size, size);
          }
        }
      },
    };
  });
}
