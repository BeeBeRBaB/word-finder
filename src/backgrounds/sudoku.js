// Sudoku: a puzzle's givens fade in, small pencil marks list every digit each empty cell could
// take, then digits are written in one by one, the surest cell first, crossing out the marks
// they rule out in their row, column and box; once full it holds, clears in a wave and a new
// one is dealt. The seed picks the variant: one big grid; several smaller ones, each on its own
// clock; or one killer sudoku, its dashed cages each with their sum.

import { roundRect } from './shapes.js';
import { stage, clamp } from './stage.js';

const MARK = 0.06;   // s between cells being pencilled in
const WRITE = 0.8;   // s between digits written in
const HOLD = 3.5;    // s a full grid holds
const WAVE = 0.05;   // s the clearing wave takes per cell along a diagonal

/** @typedef {{x:number, y:number, cs:number, killer:boolean, sol:Int8Array, val:Int8Array,
 *   given:Uint8Array, show:Uint8Array, marks:Uint16Array, inM:Uint16Array, outM:Uint16Array,
 *   kind:Uint8Array, t0:Float32Array, dur:Float32Array, active:number[], cage:Int16Array,
 *   sums:Int16Array, phase:number, pt:number, next:number, order:number[], clock:number,
 *   cv:HTMLCanvasElement, lg:CanvasRenderingContext2D}} Grid
 * Per cell (row major): the solution, the digit written, given or not, shown at all, its pencil
 * marks as bits, marks fading in and out, its animation (0 none, 1 marks, 2 clearing, 3 fading
 * in, 4 being written) from t0 for dur s, and its cage; sums at a cage's first cell. phase 0
 * dealing, 1 pencilling, 2 solving, 3 holding, 4 clearing. cv: the lines and settled cells, a
 * canvas of its own so a change uploads only the grid (2px margin round it). */

/** @param {number} i @returns {number[]} the 20 cells sharing a row, column or box with i */
function peers(i) {
  const r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3, out = [];
  for (let k = 0; k < 9; k++) {
    if (k !== c) out.push(r * 9 + k);
    if (k !== r) out.push(k * 9 + c);
    const q = (br + Math.floor(k / 3)) * 9 + bc + k % 3;
    if (Math.floor(q / 9) !== r && q % 9 !== c) out.push(q);
  }
  return out;
}
const PEERS = Array.from({ length: 81 }, (_, i) => peers(i));

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const GIVEN = s.dark ? 0.5 : 0.56, DIGIT = s.dark ? 0.6 : 0.66, PEN = s.dark ? 0.42 : 0.46;
    const LINE = s.dark ? 0.2 : 0.24, BOX = s.dark ? 0.42 : 0.46, CAGE = s.dark ? 0.4 : 0.45;
    const font = (/** @type {number} */ px) => `600 ${Math.round(px)}px 'Space Grotesk',system-ui,sans-serif`;
    /** Digits 1-9: a row in ink, a row in each colour, then a row of small ink pencil marks. */
    const atlas = document.createElement('canvas');
    /** @type {Grid[]} */
    let grids = [];
    let live = false, A = 0;   // A: the atlas's glyph cell, in CSS px

    /** A solved grid: the standard pattern with rows, columns, bands, stacks and digits shuffled. @returns {Int8Array} */
    function solution() {
      const digits = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      /** @returns {number[]} */
      const lines = () => rng.shuffle([0, 1, 2]).flatMap((b) => rng.shuffle([0, 1, 2]).map((k) => b * 3 + k));
      const rows = lines(), cols = lines(), out = new Int8Array(81);
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) out[r * 9 + c] = digits[(rows[r] * 3 + Math.floor(rows[r] / 3) + cols[c]) % 9];
      }
      return out;
    }

    /** Splits the grid into cages of one to four cells, no digit twice in one. @param {Grid} g */
    function cages(g) {
      g.cage.fill(-1); g.sums.fill(0);
      let id = 0;
      for (const i of rng.shuffle([...Array(81).keys()])) {
        if (g.cage[i] >= 0) continue;
        const cells = [i], want = 2 + rng.int(3) - (rng.random() < 0.12 ? 1 : 0);
        g.cage[i] = id;
        for (let tries = 0; cells.length < want && tries < 12; tries++) {
          const from = cells[rng.int(cells.length)], r = Math.floor(from / 9), c = from % 9;
          const nb = [r > 0 ? from - 9 : -1, r < 8 ? from + 9 : -1, c > 0 ? from - 1 : -1, c < 8 ? from + 1 : -1][rng.int(4)];
          if (nb < 0 || g.cage[nb] >= 0 || cells.some((q) => g.sol[q] === g.sol[nb])) continue;
          g.cage[nb] = id; cells.push(nb);
        }
        g.sums[Math.min(...cells)] = cells.reduce((t, q) => t + g.sol[q], 0);
        id++;
      }
    }

    /** @param {boolean} killer @returns {Grid} */
    function grid(killer) {
      /** @type {Grid} */
      const g = { x: 0, y: 0, cs: 0, killer, sol: new Int8Array(81), val: new Int8Array(81), given: new Uint8Array(81),
        show: new Uint8Array(81), marks: new Uint16Array(81), inM: new Uint16Array(81), outM: new Uint16Array(81),
        kind: new Uint8Array(81), t0: new Float32Array(81), dur: new Float32Array(81), active: [],
        cage: new Int16Array(81), sums: new Int16Array(81), phase: 0, pt: 0, next: 0, order: [], clock: 0,
        cv: document.createElement('canvas'), lg: /** @type {any} */ (null) };
      g.lg = /** @type {CanvasRenderingContext2D} */ (g.cv.getContext('2d'));
      deal(g);
      return g;
    }

    /** A new puzzle, fading in. @param {Grid} g */
    function deal(g) {
      g.sol = solution();
      if (g.killer) cages(g);
      const givens = new Set(rng.shuffle([...Array(81).keys()]).slice(0, g.killer ? 20 : 28 + rng.int(6)));
      for (let i = 0; i < 81; i++) {
        g.given[i] = givens.has(i) ? 1 : 0;
        g.val[i] = g.given[i] ? g.sol[i] : 0;
        g.marks[i] = 0; g.show[i] = 1;
        animate(g, i, 3, g.clock + rng.random() * 0.8, 0.8);
      }
      g.phase = 0; g.pt = 0; g.next = 0;
      // Old cages' dashes reach the cell edges, which a cell's own repaint leaves alone.
      if (g.killer && live) paintGrid(g);
      g.order = [...Array(81).keys()].filter((i) => !g.given[i]);
    }

    /** Ends cell i's animation. @param {Grid} g @param {number} i */
    function finish(g, i) {
      if (g.kind[i] === 2) { g.show[i] = 0; g.val[i] = 0; g.marks[i] = 0; }
      g.kind[i] = 0; g.inM[i] = g.outM[i] = 0;
      const k = g.active.indexOf(i);
      if (k >= 0) g.active.splice(k, 1);
    }

    /** @param {Grid} g @param {number} i @param {number} kind @param {number} t0 @param {number} dur */
    function animate(g, i, kind, t0, dur) {
      if (g.kind[i]) finish(g, i);
      g.kind[i] = kind; g.t0[i] = t0; g.dur[i] = dur;
      g.active.push(i);
      clearCell(g, i);
    }

    /** Digits a cell could still take, as bits. @param {Grid} g @param {number} i */
    function candidates(g, i) {
      let m = 0x3fe;
      for (const q of PEERS[i]) if (g.val[q]) m &= ~(1 << g.val[q]);
      return m;
    }

    /** @param {Grid} g @param {number} dt */
    function advance(g, dt) {
      g.clock += dt; g.pt += dt;
      for (let k = g.active.length - 1; k >= 0; k--) {
        const i = g.active[k];
        if (g.clock >= g.t0[i] + g.dur[i]) { finish(g, i); paintCell(g.lg, g, i, true); }
      }
      if (g.phase === 0) {
        if (g.pt > 1.8) { g.phase = 1; g.pt = 0; g.next = 0; }
      } else if (g.phase === 1) {
        while (g.pt > MARK * g.next && g.next < g.order.length) {
          const i = g.order[g.next++];
          g.marks[i] = candidates(g, i);
          animate(g, i, 1, g.clock, 0.45);
          g.inM[i] = g.marks[i];
        }
        if (g.next >= g.order.length && g.pt > MARK * g.next + 0.8) { g.phase = 2; g.pt = WRITE; }
      } else if (g.phase === 2) {
        if (g.pt < WRITE) return;
        g.pt = 0;
        // The empty cell with the fewest marks, ties at random.
        let best = -1, bn = 10, ties = 0;
        for (let i = 0; i < 81; i++) {
          if (g.val[i]) continue;
          let n = 0;
          for (let m = g.marks[i]; m; m &= m - 1) n++;
          if (n < bn) { bn = n; best = i; ties = 1; } else if (n === bn && rng.int(++ties) === 0) best = i;
        }
        if (best < 0) { g.phase = 3; g.pt = 0; return; }
        const d = g.sol[best], bit = 1 << d;
        animate(g, best, 4, g.clock, 0.6);
        g.outM[best] = g.marks[best]; g.marks[best] = 0; g.val[best] = d;
        for (const q of PEERS[best]) {
          if (g.val[q] || !(g.marks[q] & bit)) continue;
          const keep = g.kind[q] === 1 ? g.outM[q] : 0;
          animate(g, q, 1, g.clock + 0.2, 0.5);
          g.marks[q] &= ~bit; g.outM[q] = keep | bit;
        }
      } else if (g.phase === 3) {
        if (g.pt > HOLD) {
          for (let i = 0; i < 81; i++) animate(g, i, 2, g.clock + (Math.floor(i / 9) + i % 9) * WAVE, 0.6);
          g.phase = 4; g.pt = 0;
        }
      } else if (g.pt > 16 * WAVE + 1) deal(g);
    }

    /** Where cell i's top left is. @param {Grid} g @param {number} i @returns {[number, number]} */
    const at = (g, i) => [g.x + (i % 9) * g.cs, g.y + Math.floor(i / 9) * g.cs];

    /** @param {Grid} g @param {number} i */
    function clearCell(g, i) {
      if (!live) return;
      const [x, y] = at(g, i);
      g.lg.clearRect(x + 1.5, y + 1.5, g.cs - 3, g.cs - 3);
    }

    /**
     * Paints cell i as it is now: into the layer once settled, else each frame.
     * @param {CanvasRenderingContext2D} ctx @param {Grid} g @param {number} i @param {boolean} [settled]
     */
    function paintCell(ctx, g, i, settled = false) {
      if (settled && !live) return;
      if (!g.show[i]) return;
      const [x, y] = at(g, i), cs = g.cs, kind = g.kind[i];
      const p = kind ? clamp((g.clock - g.t0[i]) / g.dur[i], 0, 1) : 1;
      const a = kind === 2 ? 1 - p : kind === 3 ? p : 1;
      if (a <= 0) return;
      const d = g.val[i];
      if (kind === 4) {
        // A soft wash behind the digit being written, fading as it settles.
        ctx.globalAlpha = (s.dark ? 0.2 : 0.24) * (1 - p);
        ctx.fillStyle = s.colors[d % nc];
        ctx.beginPath(); roundRect(ctx, x + 3, y + 3, cs - 6, cs - 6, cs * 0.16); ctx.fill();
      }
      if (g.killer) {
        // This cell's share of its cage's dashed outline, and the sum in a cage's first cell.
        const c = i % 9, r = Math.floor(i / 9), cg = g.cage[i], e = cs * 0.1;
        const L = c === 0 || g.cage[i - 1] !== cg, R = c === 8 || g.cage[i + 1] !== cg;
        const T = r === 0 || g.cage[i - 9] !== cg, B = r === 8 || g.cage[i + 9] !== cg;
        ctx.globalAlpha = a * CAGE; ctx.strokeStyle = s.ink; ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        const x0 = L ? x + e : x, x1 = R ? x + cs - e : x + cs, y0 = T ? y + e : y, y1 = B ? y + cs - e : y + cs;
        if (T) { ctx.moveTo(x0, y + e); ctx.lineTo(x1, y + e); }
        if (B) { ctx.moveTo(x0, y + cs - e); ctx.lineTo(x1, y + cs - e); }
        if (L) { ctx.moveTo(x + e, y0); ctx.lineTo(x + e, y1); }
        if (R) { ctx.moveTo(x + cs - e, y0); ctx.lineTo(x + cs - e, y1); }
        ctx.stroke();
        ctx.setLineDash([]);
        if (g.sums[i]) {
          ctx.globalAlpha = a * (s.dark ? 0.55 : 0.6); ctx.fillStyle = s.ink;
          ctx.font = font(cs * 0.2); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          ctx.fillText(String(g.sums[i]), x + e + 2, y + e + 2);
        }
      }
      if (d) {
        const row = g.given[i] ? 0 : 1 + d % nc;
        ctx.globalAlpha = a * (kind === 4 ? p : 1) * (g.given[i] ? GIVEN : DIGIT);
        ctx.drawImage(atlas, (d - 1) * A * s.dpr, row * A * s.dpr, A * s.dpr, A * s.dpr, x, y, cs, cs);
      }
      const m = g.marks[i] | g.outM[i];
      if (!m) return;
      const top = g.killer ? 0.28 : 0.08, side = 0.08, sw = A * s.dpr / 3, sy = (1 + nc) * A * s.dpr;
      const w = cs * (1 - side * 2) / 3, h = cs * (1 - top - side) / 3, q = Math.min(w, h);
      for (let b = 1; b <= 9; b++) {
        const bit = 1 << b;
        if (!(m & bit)) continue;
        const f = g.marks[i] & bit ? (g.inM[i] & bit ? p : 1) : 1 - p;
        if (f <= 0) continue;
        ctx.globalAlpha = a * f * PEN;
        const cx = x + cs * side + ((b - 1) % 3 + 0.5) * w, cy = y + cs * top + (Math.floor((b - 1) / 3) + 0.5) * h;
        ctx.drawImage(atlas, (b - 1) * sw, sy, sw, sw, cx - q / 2, cy - q / 2, q, q);
      }
    }

    /** Paints the digits into the atlas, at A px a glyph cell. */
    function paintAtlas() {
      const d = s.dpr, a = A * d;
      atlas.width = Math.ceil(a * 9); atlas.height = Math.ceil(a * (1 + nc) + a / 3);
      const g = /** @type {CanvasRenderingContext2D} */ (atlas.getContext('2d'));
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let row = 0; row <= nc; row++) {
        g.fillStyle = row ? s.colors[row - 1] : s.ink;
        g.font = font(a * 0.52);
        for (let k = 0; k < 9; k++) g.fillText(String(k + 1), a * (k + 0.5), a * (row + 0.54));
      }
      g.fillStyle = s.ink; g.font = font(a / 3 * 0.82);
      for (let k = 0; k < 9; k++) g.fillText(String(k + 1), a / 3 * (k + 0.5), a * (1 + nc) + a / 6 * 1.08);
    }

    /** Paints every grid. */
    function paintAll() {
      live = true;
      for (const g of grids) paintGrid(g);
    }

    /** Paints g's lines and settled cells into its canvas, which works in page px. @param {Grid} g */
    function paintGrid(g) {
      const cs = g.cs, size = cs * 9, d = s.dpr, lg = g.lg;
      g.cv.width = Math.ceil((size + 4) * d); g.cv.height = g.cv.width;
      lg.setTransform(d, 0, 0, d, (2 - g.x) * d, (2 - g.y) * d);
      lg.strokeStyle = s.ink; lg.lineCap = 'butt';
      for (let k = 1; k < 9; k++) {
        const box = k % 3 === 0;
        lg.globalAlpha = box ? BOX : LINE; lg.lineWidth = box ? 2 : 1;
        lg.beginPath();
        lg.moveTo(g.x + k * cs, g.y); lg.lineTo(g.x + k * cs, g.y + size);
        lg.moveTo(g.x, g.y + k * cs); lg.lineTo(g.x + size, g.y + k * cs);
        lg.stroke();
      }
      lg.globalAlpha = BOX; lg.lineWidth = 2.5;
      lg.beginPath(); roundRect(lg, g.x, g.y, size, size, 4); lg.stroke();
      for (let i = 0; i < 81; i++) if (!g.kind[i]) paintCell(lg, g, i, true);
      lg.globalAlpha = 1;
    }
    document.fonts?.load(font(20)).then(() => { if (s.cv.isConnected && A) { paintAtlas(); paintAll(); s.paint(); } }, () => {});

    /** Runs g for a while unseen, so the first frame is part way through. @param {Grid} g */
    function warm(g) {
      const n = 30 * (5 + rng.random() * 40);
      for (let k = 0; k < n; k++) advance(g, 1 / 30);
    }

    return {
      lay() {
        const { W, H } = s;
        const m = Math.min(W, H);
        /** @type {[number, number, number][]} x, y, cell size */
        const spots = [];
        if (layout === 1) {
          const size = clamp(m * 0.44, 200, 340);
          const cols = Math.max(1, Math.floor(W / (size * 1.15))), rows = Math.max(1, Math.floor(H / (size * 1.12)));
          for (let i = 0; i < cols * rows; i++) {
            const c = i % cols, r = Math.floor(i / cols), cs = Math.floor(size * (0.86 + ((i * 5) % 3) * 0.07) / 9);
            const jx = (W / cols - cs * 9) * 0.22 * (r % 2 ? 1 : -1), jy = (H / rows - cs * 9) * 0.22 * (c % 2 ? 1 : -1);
            spots.push([W * (c + 0.5) / cols - cs * 4.5 + jx, H * (r + 0.5) / rows - cs * 4.5 + jy, cs]);
          }
        } else {
          const cs = Math.floor(Math.min(W * 0.94, H * 0.9, 760) / 9);
          spots.push([(W - cs * 9) / 2, (H - cs * 9) / 2, cs]);
        }
        live = false;
        const fresh = grids.length !== spots.length;
        while (grids.length < spots.length) grids.push(grid(layout === 2));
        grids.length = spots.length;
        if (fresh) for (const g of grids) warm(g);
        grids.forEach((g, i) => { [g.x, g.y, g.cs] = spots[i]; g.x = Math.round(g.x); g.y = Math.round(g.y); });
        A = Math.max(...grids.map((g) => g.cs));
        paintAtlas();
        paintAll();
      },
      step(dt) { for (const g of grids) advance(g, dt); },
      draw() {
        const { ctx } = s;
        for (const g of grids) {
          ctx.drawImage(g.cv, g.x - 2, g.y - 2, g.cv.width / s.dpr, g.cv.height / s.dpr);
          for (const i of g.active) paintCell(ctx, g, i);
        }
      },
    };
  });
}
