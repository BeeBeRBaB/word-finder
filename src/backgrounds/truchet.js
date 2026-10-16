// Truchet: a grid of square tiles, each holding two quarter arcs that join the midpoints of its
// edges, so the arcs link across the whole grid into long winding paths and closed loops. Tiles
// turn a quarter turn one at a time and the paths through them break and rejoin. The seed picks
// the variant: thin lines, where both paths through a turned tile light up along their whole
// new length; broad ribbons, turned by a slow diagonal wave that crosses the grid; or the
// regions between the arcs filled in two tones, each tile flipping over like a card.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{o:number, from:number, at:number}} Tile o is 0 (arcs round top-left and
 * bottom-right corners) or 1 (top-right and bottom-left); a turn runs from `at` with o === from */
/** @typedef {{arcs:number[], at:number, c:number}} Glow arcs are tile*2+arc */

const TURN = 0.9;   // seconds a tile takes to turn
const GLOW = 3.6;   // seconds a rejoined path stays lit

/** @param {number} u @returns {number} */
const ease = (u) => { const v = clamp(u, 0, 1); return v * v * (3 - 2 * v); };

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    let cs = 60, cols = 0, rows = 0, ox = 0, oy = 0, wait = 0.6, wave = -1, waveAt = 0;
    /** @type {Tile[]} */
    let tiles = [];
    /** @type {Glow[]} */
    const glows = [];
    /** @type {number[]} tiles mid-turn whose paths light once they land */
    const turning = [];

    /** Edge-midpoint ids an arc joins: horizontal edges first, then vertical.
     * @param {number} k tile index @param {number} a arc 0 or 1 @param {number} o orientation
     * @returns {[number, number]} */
    function ends(k, a, o) {
      const i = k % cols, j = Math.floor(k / cols), hz = cols * (rows + 1);
      const N = j * cols + i, S = (j + 1) * cols + i, W = hz + j * (cols + 1) + i, E = W + 1;
      if (o === 0) return a === 0 ? [N, W] : [S, E];
      return a === 0 ? [N, E] : [S, W];
    }

    /** Lights both paths through tile k, each in its own colour. @param {number} k */
    function light(k) {
      const parent = new Int32Array(cols * (rows + 1) + rows * (cols + 1)).map((_, i) => i);
      /** @param {number} x @returns {number} */
      const find = (x) => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
      tiles.forEach((t, q) => {
        for (let a = 0; a < 2; a++) { const [u, v] = ends(q, a, t.o); parent[find(u)] = find(v); }
      });
      for (let a = 0; a < 2; a++) {
        const root = find(ends(k, a, tiles[k].o)[0]);
        /** @type {number[]} */
        const arcs = [];
        tiles.forEach((t, q) => {
          for (let b = 0; b < 2; b++) if (find(ends(q, b, t.o)[0]) === root) arcs.push(q * 2 + b);
        });
        glows.push({ arcs, at: s.t, c: (1 + a + rng.int(Math.max(1, nc - 1))) % nc });
      }
      while (glows.length > 6) glows.shift();
    }

    /** Starts tile k turning. @param {number} k */
    function turn(k) {
      const t = tiles[k];
      if (s.t - t.at < TURN) return;
      t.from = t.o; t.at = s.t; t.o = 1 - t.o;
      if (s.layout === 0) turning.push(k);
    }

    /** Adds one arc of a tile to the path, in the tile's own frame (its centre at 0,0).
     * @param {number} a @param {number} o */
    function arc(a, o) {
      const { ctx } = s, h = cs / 2;
      // Corner centres: o 0 uses top-left and bottom-right, o 1 top-right and bottom-left.
      const cx = (o === 0 ? (a === 0 ? -1 : 1) : (a === 0 ? 1 : -1)) * h;
      const cy = (a === 0 ? -1 : 1) * h;
      const a0 = Math.atan2(-cy, -cx) - Math.PI / 4;
      ctx.moveTo(cx + Math.cos(a0) * h, cy + Math.sin(a0) * h);
      ctx.arc(cx, cy, h, a0, a0 + Math.PI / 2);
    }

    /** The filled regions of a tile, for the evenodd fill: its two corner discs, plus the whole
     * square when the band between them is the filled one. @param {number} k @param {number} o */
    function region(k, o) {
      const { ctx } = s, h = cs / 2;
      const par = (k % cols + Math.floor(k / cols)) % 2;
      if ((par + o) % 2 === 1) ctx.rect(-h, -h, cs, cs);
      for (let a = 0; a < 2; a++) {
        const cx = (o === 0 ? (a === 0 ? -1 : 1) : (a === 0 ? 1 : -1)) * h;
        const cy = (a === 0 ? -1 : 1) * h;
        const a0 = Math.atan2(-cy, -cx) - Math.PI / 4;
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, h, a0, a0 + Math.PI / 2);
        ctx.closePath();
      }
    }

    /** Sets the transform for tile k's frame, turned or squeezed while it moves.
     * @param {number} k @returns {number} the orientation to draw */
    function frame(k) {
      const { ctx } = s, t = tiles[k], p = (s.t - t.at) / TURN;
      const x = ox + (k % cols + 0.5) * cs, y = oy + (Math.floor(k / cols) + 0.5) * cs;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, x * s.dpr, y * s.dpr);
      if (p >= 1 || p < 0) return t.o;
      const e = ease(p);
      if (s.layout === 2) {
        // A card flip: squeeze to a line, swap faces, open out again.
        ctx.scale(Math.max(0.02, Math.abs(Math.cos(e * Math.PI))), 1);
        return e < 0.5 ? t.from : t.o;
      }
      ctx.rotate(e * Math.PI / 2);
      return t.from;
    }

    /** @param {number} k @returns {boolean} */
    const moving = (k) => s.t - tiles[k].at < TURN;

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        cs = clamp(Math.round(m / (s.layout === 1 ? 6.5 : 8)), 46, 120);
        const nCols = Math.ceil(s.W / cs) + 1, nRows = Math.ceil(s.H / cs) + 1;
        /** @type {Tile[]} */
        const next = [];
        for (let j = 0; j < nRows; j++) {
          for (let i = 0; i < nCols; i++) {
            const old = i < cols && j < rows ? tiles[j * cols + i] : null;
            next.push(old ?? { o: rng.int(2), from: 0, at: -9 });
          }
        }
        if (nCols !== cols || nRows !== rows) { glows.length = 0; turning.length = 0; }
        tiles = next; cols = nCols; rows = nRows;
        ox = (s.W - cols * cs) / 2; oy = (s.H - rows * cs) / 2;
        // Reduced motion shows one lit path from the start.
        if (s.layout === 0 && !glows.length) { light(rng.int(tiles.length)); glows.forEach((g) => { g.at -= 0.8; }); }
      },
      step(dt) {
        if (s.layout === 1) {
          // A diagonal front crosses the grid every so often, turning some tiles as it passes.
          if (wave < 0 && s.t > waveAt) { wave = 0; waveAt = s.t + 14 + rng.random() * 6; }
          if (wave >= 0) {
            const span = cols + rows, prev = wave;
            wave += dt * span / 7;
            for (let k = 0; k < tiles.length; k++) {
              const d = k % cols + Math.floor(k / cols);
              if (d >= prev && d < wave && rng.random() < 0.4) turn(k);
            }
            if (wave > span) wave = -1;
          }
          return;
        }
        for (let i = turning.length - 1; i >= 0; i--) {
          if (moving(turning[i])) continue;
          light(turning[i]);
          turning.splice(i, 1);
        }
        wait -= dt;
        if (wait > 0) return;
        wait = clamp(90 / tiles.length, 0.35, 1.1) * (0.7 + rng.random() * 0.6);
        const k = rng.int(tiles.length);
        if (moving(k)) return;
        turn(k);
      },
      draw() {
        const { ctx } = s;
        const lw = s.layout === 1 ? cs * 0.26 : clamp(cs * 0.07, 2, 6);
        ctx.lineCap = s.layout === 1 ? 'butt' : 'round';
        const c0 = s.colors[0], c1 = s.colors[1 % nc];
        // A path takes the transform current as each piece is added, so every tile goes into
        // one path in its own frame and one fill or stroke paints them all.
        if (s.layout === 2) {
          ctx.beginPath();
          for (let k = 0; k < tiles.length; k++) region(k, frame(k));
          ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
          ctx.fillStyle = c0;
          ctx.globalAlpha = s.dark ? 0.2 : 0.24;
          ctx.fill('evenodd');
        }
        ctx.beginPath();
        for (let k = 0; k < tiles.length; k++) { const o = frame(k); arc(0, o); arc(1, o); }
        ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
        ctx.strokeStyle = s.layout === 2 ? c1 : c0;
        ctx.lineWidth = s.layout === 2 ? clamp(cs * 0.04, 1.5, 3) : lw;
        ctx.globalAlpha = s.layout === 1 ? (s.dark ? 0.26 : 0.3) : (s.dark ? 0.34 : 0.4);
        ctx.stroke();
        if (s.layout === 1) {
          // A thin bright thread down the middle of each ribbon.
          ctx.lineWidth = clamp(cs * 0.04, 1.5, 4);
          ctx.strokeStyle = c1;
          ctx.globalAlpha = s.dark ? 0.45 : 0.5;
          ctx.stroke();
        }
        for (const g of glows) {
          const age = s.t - g.at;
          const a = Math.min(ease(age / 0.6), 1 - ease((age - 0.6) / (GLOW - 0.6)));
          if (a <= 0) continue;
          ctx.beginPath();
          for (const q of g.arcs) {
            const k = q >> 1;
            if (moving(k)) continue;
            const x = ox + (k % cols + 0.5) * cs, y = oy + (Math.floor(k / cols) + 0.5) * cs;
            ctx.setTransform(s.dpr, 0, 0, s.dpr, x * s.dpr, y * s.dpr);
            arc(q & 1, tiles[k].o);
          }
          ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
          ctx.strokeStyle = s.colors[g.c];
          ctx.lineWidth = lw * 1.5;
          ctx.globalAlpha = a * (s.dark ? 0.6 : 0.62);
          ctx.stroke();
        }
        while (glows.length && s.t - glows[0].at > GLOW) glows.shift();
      },
    };
  });
}
