// Slide puzzle: numbered tiles in a frame slide one at a time into the gap, shuffling the
// picture their colours make, then slide back tile by tile until it is whole again, and hold.
// The seed picks the variant: one big fifteen puzzle; a scatter of small boards (eight, fifteen
// and twenty-four), each on its own clock; or a wall of tiles over the whole page with a few gaps.

import { roundRect } from './shapes.js';
import { stage, clamp } from './stage.js';

const PAUSE = 1.2;   // s between shuffled and solving
const HOLD = 3;      // s a solved board holds

/** @typedef {{g:number, a:number, b:number, st:number}} Move
 * A shuffle move: gap g sat at a and the tile at b slid into it; st 0 to undo, 1 moving, 2 done. */
/** @typedef {{tile:number, from:number, to:number, u:number, m:Move}} Slide */
/** @typedef {{cols:number, rows:number, x:number, y:number, cs:number, cells:Int32Array,
 *   gaps:number[], last:number[], idle:number[], busy:Uint8Array, hist:Move[], moving:Slide[],
 *   phase:number, pt:number, goal:number, band:number, label:Int32Array}} Board
 * cells hold each place's tile, as the place it belongs (-1 a gap); phase 0 shuffling,
 * 1 pausing, 2 solving, 3 holding; goal the shuffle's length; band 0 rows, 1 diagonals. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const wall = layout === 2 ? 0.75 : 1;   // the wall is fainter, being everywhere
    const FILL = (s.dark ? 0.24 : 0.3) * wall, EDGE = (s.dark ? 0.5 : 0.58) * wall, TEXT = (s.dark ? 0.55 : 0.6) * wall;
    const SHUF = layout === 2 ? 0.3 : 0.24, SOLVE = layout === 2 ? 0.38 : 0.32;
    const font = (/** @type {number} */ px) => `600 ${Math.round(px)}px 'Space Grotesk',system-ui,sans-serif`;
    /** Settled tiles and frames, at device pixels. */
    const layer = document.createElement('canvas');
    const lg = /** @type {CanvasRenderingContext2D} */ (layer.getContext('2d'));
    /** @type {Board[]} */
    let boards = [];
    let live = false;   // false while warming up: nothing is painted into the layer yet
    let stamp = 0;
    /** @type {Int32Array} */
    let seen = new Int32Array(0);

    /** @param {number} cols @param {number} rows @param {number} k gaps @param {number} band @returns {Board} */
    function board(cols, rows, k, band) {
      const n = cols * rows;
      const cells = new Int32Array(n), label = new Int32Array(n);
      for (let i = 0; i < n; i++) cells[i] = i;
      /** @type {number[]} */
      const gaps = [];
      if (k === 1) gaps.push(n - 1);
      else while (gaps.length < k) { const p = rng.int(n); if (!gaps.includes(p)) gaps.push(p); }
      for (const p of gaps) cells[p] = -1;
      for (let i = 0, l = 1; i < n; i++) if (cells[i] >= 0) label[i] = l++;
      return { cols, rows, x: 0, y: 0, cs: 0, cells, gaps, last: gaps.map(() => -1), idle: gaps.map(() => 0),
        busy: new Uint8Array(n), hist: [], moving: [], phase: 0, pt: 0, goal: Math.round(n * (k > 1 ? 1.2 : 2.6)), band, label };
    }

    /** Runs b for a few seconds unseen, so the first frame is part way through. @param {Board} b */
    function warm(b) {
      b.idle = b.idle.map(() => rng.random() * 0.3);
      const n = 30 * (2 + rng.random() * 14);
      for (let i = 0; i < n; i++) advance(b, 1 / 30);
    }

    /** @param {Board} b @param {number} p @returns {[number, number]} */
    const at = (b, p) => [b.x + (p % b.cols) * b.cs, b.y + Math.floor(p / b.cols) * b.cs];

    /** @param {CanvasRenderingContext2D} ctx @param {Board} b @param {number} tile @param {number} x @param {number} y */
    function paintTile(ctx, b, tile, x, y) {
      const cs = b.cs, i = cs * 0.05, r = tile % b.cols, q = Math.floor(tile / b.cols);
      const c = b.band ? Math.floor((r + q) / 2) : q;
      ctx.beginPath();
      roundRect(ctx, x + i, y + i, cs - i * 2, cs - i * 2, cs * 0.14);
      ctx.fillStyle = ctx.strokeStyle = s.colors[c % nc];
      ctx.globalAlpha = FILL; ctx.fill();
      ctx.globalAlpha = EDGE; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.globalAlpha = TEXT; ctx.fillStyle = s.ink;
      ctx.font = font(cs * (b.label[tile] > 99 ? 0.29 : 0.36) * (layout === 2 ? 0.9 : 1));
      ctx.fillText(String(b.label[tile]), x + cs / 2, y + cs * 0.53);
    }

    /** Clears place p in the layer, or paints its tile. @param {Board} b @param {number} p */
    function settle(b, p) {
      if (!live) return;
      const [x, y] = at(b, p);
      lg.clearRect(x, y, b.cs, b.cs);
      if (b.cells[p] >= 0 && !b.busy[p]) paintTile(lg, b, b.cells[p], x, y);
    }

    /** @param {Board} b @param {number} tile @param {number} from @param {number} to @param {Move} m */
    function slide(b, tile, from, to, m) {
      b.cells[to] = tile; b.cells[from] = -1;
      b.busy[to] = b.busy[from] = 1;
      b.moving.push({ tile, from, to, u: 0, m });
      settle(b, from);
    }

    /** The places beside p. @param {Board} b @param {number} p @returns {number[]} */
    function near(b, p) {
      const c = p % b.cols, out = [];
      if (c > 0) out.push(p - 1);
      if (c < b.cols - 1) out.push(p + 1);
      if (p >= b.cols) out.push(p - b.cols);
      if (p + b.cols < b.cells.length) out.push(p + b.cols);
      return out;
    }

    /** @param {Board} b @param {number} dt */
    function advance(b, dt) {
      b.pt += dt;
      const speed = dt / (b.phase === 2 ? SOLVE : SHUF);
      for (let i = b.moving.length - 1; i >= 0; i--) {
        const m = b.moving[i];
        m.u += speed;
        if (m.u < 1) continue;
        b.moving.splice(i, 1);
        b.busy[m.from] = b.busy[m.to] = 0;
        m.m.st = b.phase === 2 ? 2 : 0;
        settle(b, m.to);
      }
      if (b.phase === 0) {
        // Each idle gap pulls in a neighbour, never straight back.
        for (let g = 0; g < b.gaps.length; g++) {
          if ((b.idle[g] -= dt) > 0 || b.busy[b.gaps[g]] || b.hist.length >= b.goal) continue;
          const p = b.gaps[g];
          const opts = near(b, p).filter((q) => b.cells[q] >= 0 && !b.busy[q] && q !== b.last[g]);
          if (!opts.length) continue;
          const q = opts[rng.int(opts.length)];
          /** @type {Move} */
          const m = { g, a: p, b: q, st: 1 };
          b.hist.push(m);
          slide(b, b.cells[q], q, p, m);
          b.last[g] = p; b.gaps[g] = q; b.idle[g] = SHUF + 0.05 + rng.random() * 0.1;
        }
        if (b.hist.length >= b.goal && !b.moving.length) { b.phase = 1; b.pt = 0; }
      } else if (b.phase === 1) {
        if (b.pt > PAUSE) { b.phase = 2; b.pt = 0; }
      } else if (b.phase === 2) {
        while (b.hist.length && b.hist[b.hist.length - 1].st === 2) b.hist.pop();
        // Undo the latest moves first; one may start once no later move shares a place with it.
        if (seen.length < b.cells.length) seen = new Int32Array(b.cells.length);
        stamp++;
        for (let i = b.hist.length - 1, n = 0; i >= 0 && n < 80; i--, n++) {
          const m = b.hist[i];
          if (m.st === 2) continue;
          if (m.st === 0 && seen[m.a] !== stamp && seen[m.b] !== stamp) {
            m.st = 1;
            b.gaps[m.g] = m.a;
            slide(b, b.cells[m.a], m.a, m.b, m);
          }
          seen[m.a] = seen[m.b] = stamp;
        }
        if (!b.hist.length && !b.moving.length) { b.phase = 3; b.pt = 0; }
      } else if (b.pt > HOLD) {
        b.phase = 0; b.pt = 0; b.last = b.gaps.map(() => -1);
      }
    }

    /** Paints every settled tile and frame into the layer. */
    function paintAll() {
      layer.width = Math.round(s.W * s.dpr); layer.height = Math.round(s.H * s.dpr);
      lg.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      lg.textAlign = 'center'; lg.textBaseline = 'middle';
      live = true;
      for (const b of boards) {
        if (layout !== 2) {
          const pad = Math.max(4, b.cs * 0.1);
          lg.beginPath();
          roundRect(lg, b.x - pad, b.y - pad, b.cols * b.cs + pad * 2, b.rows * b.cs + pad * 2, pad * 1.6);
          lg.globalAlpha = s.dark ? 0.3 : 0.34; lg.strokeStyle = s.ink; lg.lineWidth = 2; lg.stroke();
        }
        for (let p = 0; p < b.cells.length; p++) settle(b, p);
      }
      lg.globalAlpha = 1;
    }
    document.fonts?.load(font(20)).then(() => { if (s.cv.isConnected && live) { paintAll(); s.paint(); } }, () => {});

    return {
      lay() {
        const { W, H } = s;
        const m = Math.min(W, H);
        if (layout === 0) {
          if (!boards.length) { boards = [board(4, 4, 1, 0)]; warm(boards[0]); }
          const b = boards[0];
          b.cs = Math.floor(Math.min(W * 0.88, H * 0.8, 680) / 4);
          b.x = Math.round((W - b.cs * 4) / 2); b.y = Math.round((H - b.cs * 4) / 2);
        } else if (layout === 1) {
          const box = clamp(m * 0.4, 150, 300);
          const cols = Math.max(1, Math.floor(W / (box * 1.22))), rows = Math.max(1, Math.floor(H / (box * 1.22)));
          while (boards.length < cols * rows) {
            const n = 3 + (boards.length + (rng.int(2))) % 3;
            const b = board(n, n, 1, 0);
            warm(b);
            boards.push(b);
          }
          boards.length = cols * rows;
          boards.forEach((b, i) => {
            const c = i % cols, r = Math.floor(i / cols);
            const size = box * (b.cols === 3 ? 0.78 : b.cols === 4 ? 0.9 : 1);
            b.cs = Math.floor(size / b.cols);
            const jx = (W / cols - size) * 0.25, jy = (H / rows - size) * 0.25;
            b.x = Math.round(W * (c + 0.5) / cols - b.cols * b.cs / 2 + (r % 2 ? jx : -jx));
            b.y = Math.round(H * (r + 0.5) / rows - b.rows * b.cs / 2 + (c % 2 ? jy : -jy));
          });
        } else {
          // A wall of tiles past every edge.
          const cs = Math.round(clamp(m / 6.5, 56, 110));
          const cols = Math.ceil(W / cs) + 1, rows = Math.ceil(H / cs) + 1;
          if (!boards.length || boards[0].cols !== cols || boards[0].rows !== rows) {
            live = false;
            boards = [board(cols, rows, clamp(Math.round(cols * rows / 36), 2, 9), 1)];
            warm(boards[0]);
          }
          const b = boards[0];
          b.cs = cs;
          b.x = Math.round((W - cols * cs) / 2); b.y = Math.round((H - rows * cs) / 2);
        }
        paintAll();
      },
      step(dt) { for (const b of boards) advance(b, dt); },
      draw() {
        const { ctx } = s;
        ctx.drawImage(layer, 0, 0, s.W, s.H);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const b of boards) {
          for (const m of b.moving) {
            const [x0, y0] = at(b, m.from), [x1, y1] = at(b, m.to);
            const u = clamp(m.u, 0, 1), v = u * u * (3 - 2 * u);
            paintTile(ctx, b, m.tile, x0 + (x1 - x0) * v, y0 + (y1 - y0) * v);
          }
        }
      },
    };
  });
}
