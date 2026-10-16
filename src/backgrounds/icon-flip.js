// Flip board: a grid of tiles, each showing an icon, flips over like a split-flap board: a tile
// folds shut on its hinge and opens on another icon. The seed picks the variant: a diagonal sweep
// across the whole board, a departures board updating row by row left to right, or rings
// spreading from a new spot each time.

import { iconStage } from './icon-stage.js';
import { clamp } from './stage.js';

/** @typedef {{k:number, nk:number, due:number, t0:number}} Tile
 * Shows icon k; flips to nk at time due (or is mid-flip since t0); due and t0 are -1 when idle. */

const FLIP = 0.9;    // seconds one tile takes to flip
const SWEEP = 4.5;   // seconds a wave takes to cross the board
const GAP = 8;       // seconds between waves (variants 0 and 2)

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Tile[]} */
    let tiles = [];
    let cols = 1, rows = 1, cell = 60, ox = 0, oy = 0, next = 0, row = 0;
    /** @param {number} k @returns {number} another icon than k */
    const other = (k) => s.n < 2 ? k : (k + 1 + rng.int(s.n - 1)) % s.n;

    /** Queues a wave of flips starting now. @returns {void} */
    function wave() {
      const t = s.t;
      if (layout === 1) {
        // One row at a time, its tiles a beat apart left to right.
        for (let c = 0; c < cols; c++) {
          const p = tiles[row * cols + c];
          p.due = t + c * 0.14; p.nk = other(p.k);
        }
        row = (row + 1) % rows;
        next = t + Math.max(1.4, cols * 0.14 + 0.5);
        return;
      }
      const fx = layout === 2 ? rng.random() * cols : 0, fy = layout === 2 ? rng.random() * rows : 0;
      let far = 0;
      for (let i = 0; i < tiles.length; i++) far = Math.max(far, dist(i % cols, Math.floor(i / cols), fx, fy));
      // The whole board turns to one icon on a sweep, a mix of two on a ring.
      const k = other(tiles[0]?.k ?? 0), k2 = other(k);
      for (let i = 0; i < tiles.length; i++) {
        const c = i % cols, r = Math.floor(i / cols), p = tiles[i];
        p.due = t + dist(c, r, fx, fy) / Math.max(1, far) * SWEEP;
        p.nk = layout === 0 ? ((c + r) % 3 ? k : k2) : (c + r) % 2 ? k : other(p.k);
      }
      next = t + GAP;
    }
    /** @param {number} c @param {number} r @param {number} fx @param {number} fy @returns {number} */
    const dist = (c, r, fx, fy) => layout === 0 ? c + r : Math.hypot(c - fx, r - fy);

    return {
      lay() {
        const { W, H } = s;
        cell = clamp(Math.sqrt(W * H / 40), 62, 260);
        cols = Math.max(2, Math.round(W / cell)); rows = Math.max(2, Math.round(H / cell));
        cell = Math.min(W / cols, H / rows);
        ox = (W - cols * cell) / 2 + cell / 2; oy = (H - rows * cell) / 2 + cell / 2;
        const old = tiles;
        tiles = [];
        for (let i = 0; i < cols * rows; i++) {
          tiles.push(old[i] ? { ...old[i], due: -1, t0: -1 } : { k: rng.int(s.n), nk: 0, due: -1, t0: -1 });
        }
        if (row >= rows) row = 0;
        // A first frame mid-wave, so a still picture already shows tiles turning.
        if (!old.length) {
          wave();
          const lead = layout === 1 ? 0.5 : SWEEP * 0.35;
          for (const p of tiles) if (p.due >= 0) p.due -= lead;
          next -= lead;
        }
      },
      step() {
        const t = s.t;
        if (t >= next) wave();
        for (const p of tiles) {
          if (p.due >= 0 && t >= p.due) { p.t0 = p.due; p.due = -1; }
          if (p.t0 >= 0 && t - p.t0 >= FLIP) { p.k = p.nk; p.t0 = -1; }
        }
      },
      draw() {
        const { ctx, dpr, t } = s;
        const w = cell * 0.82, h = cell * 0.82, rad = cell * 0.09, size = cell * 0.52;
        for (let i = 0; i < tiles.length; i++) {
          const p = tiles[i];
          const x = ox + (i % cols) * cell, y = oy + Math.floor(i / cols) * cell;
          let u = p.t0 >= 0 ? (t - p.t0) / FLIP : p.due >= 0 && t >= p.due ? (t - p.due) / FLIP : -1;
          u = clamp(u, -1, 1);
          const sy = u < 0 ? 1 : Math.max(0.04, Math.abs(Math.cos(u * Math.PI)));
          const k = u >= 0.5 ? p.nk : p.k;
          // The flap: a soft panel in the icon's colour, folded on the same hinge as the icon.
          ctx.setTransform(dpr, 0, 0, dpr * sy, x * dpr, y * dpr);
          ctx.fillStyle = s.hue(k);
          ctx.globalAlpha = s.dark ? 0.1 : 0.11;
          rounded(ctx, -w / 2, -h / 2, w, h, rad);
          ctx.fill();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          s.icon(k, x, y, size, 0, 0.46, 0, sy);
          // The hinge across the middle, as on a split-flap board.
          ctx.strokeStyle = s.ink;
          ctx.globalAlpha = 0.18;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke();
        }
      },
    };
  });
}

/** A rounded rectangle path. @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y
 * @param {number} w @param {number} h @param {number} r @returns {void} */
function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
