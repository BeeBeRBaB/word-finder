// Reversi: discs in two of the look's colours are placed on a bare grid as a game plays itself;
// each move flips the discs it traps, turning over one after another along their lines, and when
// neither side can move the board clears in a wave from the middle and play starts again. The
// seed picks the variant: one large 8x8 board; a grid the size of the page opened from several
// starting squares at once; or a few small 6x6 boards, each its own pair of colours and pace.

import { stage, clamp } from './stage.js';

const FLIP = 0.42;     // s for a disc to turn over
const STEP = 0.11;     // s between flips along a line
const DROP = 0.35;     // s for a placed disc to settle
const HOLD = 2.4;      // s a finished board shows before it clears
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** @typedef {{cols:number, rows:number, ox:number, oy:number, sq:number, cell:Int8Array,
 *   prev:Int8Array, at:Float32Array, kind:Uint8Array, clock:number, turn:number, wait:number,
 *   end:number, pace:number, cs:string[], last:number}} Board
 * cell: 0 empty, else player 1 or 2; at: the clock time its last change starts; kind: what that
 * change is (0 none, 1 placed, 2 flipped, 3 cleared away); prev: its colour before a flip. end:
 * -1 in play, else seconds since neither side could move; cs: the two players' colours. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    const cache = document.createElement('canvas');
    /** @type {Board[]} */
    let boards = [];
    let key = '';

    /** The discs move i would turn for player p, each with its step along the line.
     * @param {Board} b @param {number} i @param {number} p @returns {number[]} index * 16 + step */
    function traps(b, i, p) {
      /** @type {number[]} */
      const out = [];
      if (b.cell[i]) return out;
      const r = Math.floor(i / b.cols), c = i % b.cols;
      for (const [dr, dc] of DIRS) {
        let rr = r + dr, cc = c + dc, k = 0;
        while (rr >= 0 && rr < b.rows && cc >= 0 && cc < b.cols && b.cell[rr * b.cols + cc] === 3 - p) {
          rr += dr; cc += dc; k++;
        }
        if (!k || rr < 0 || rr >= b.rows || cc < 0 || cc >= b.cols || b.cell[rr * b.cols + cc] !== p) continue;
        for (let j = 1; j <= k; j++) out.push(((r + dr * j) * b.cols + c + dc * j) * 16 + j);
      }
      return out;
    }

    /** The best-looking move for p: most discs turned, corners sought, their neighbours shunned.
     * @param {Board} b @param {number} p @returns {[number, number[]]|null} */
    function choose(b, p) {
      /** @type {[number, number[]]|null} */
      let best = null;
      let score = -Infinity;
      for (let i = 0; i < b.cell.length; i++) {
        const t = traps(b, i, p);
        if (!t.length) continue;
        const r = Math.floor(i / b.cols), c = i % b.cols;
        const er = r === 0 || r === b.rows - 1, ec = c === 0 || c === b.cols - 1;
        const nr = r === 1 || r === b.rows - 2, ncl = c === 1 || c === b.cols - 2;
        let k = t.length + rng.random() * 3;
        if (er && ec) k += 8; else if (er || ec) k += 1.5;
        if ((nr || er) && (ncl || ec) && !(er && ec)) k -= 3;
        if (k > score) { score = k; best = [i, t]; }
      }
      return best;
    }

    /** @param {Board} b @param {number} i @param {number[]} t @param {number} p */
    function play(b, i, t, p) {
      b.cell[i] = p; b.at[i] = b.clock; b.kind[i] = 1; b.last = i;
      let far = 0;
      for (const v of t) {
        const j = v >> 4, k = v & 15;
        b.prev[j] = b.cell[j]; b.cell[j] = p; b.kind[j] = 2;
        b.at[j] = b.clock + DROP * 0.7 + (k - 1) * STEP;
        far = Math.max(far, k);
      }
      b.turn = 3 - p;
      b.wait = DROP * 0.7 + far * STEP + FLIP + 0.5 + rng.random() * 0.5;
    }

    /** The opening: a 2x2 square crossed, or several on a big board. @param {Board} b */
    function reset(b) {
      b.cell.fill(0); b.kind.fill(0); b.turn = 1; b.end = -1; b.last = -1;
      const n = b.cols * b.rows > 100 ? clamp(Math.round(b.cols * b.rows / 70), 2, 6) : 1;
      /** @type {number[][]} */
      const spots = [];
      for (let tries = 0; spots.length < n && tries < 200; tries++) {
        const r = spots.length || n > 1 ? 1 + rng.int(b.rows - 3) : b.rows / 2 - 1;
        const c = spots.length || n > 1 ? 1 + rng.int(b.cols - 3) : b.cols / 2 - 1;
        if (spots.some(([rr, cc]) => Math.abs(rr - r) < 4 && Math.abs(cc - c) < 4)) continue;
        spots.push([r, c]);
      }
      spots.forEach(([r, c], k) => {
        const flip = k % 2;
        [[0, 0, 2], [0, 1, 1], [1, 0, 1], [1, 1, 2]].forEach(([dr, dc, p], q) => {
          const i = (r + dr) * b.cols + c + dc;
          b.cell[i] = flip ? 3 - p : p; b.kind[i] = 1; b.at[i] = b.clock + 0.2 + (k * 4 + q) * 0.12;
        });
      });
      b.wait = 1 + spots.length * 0.5;
    }

    /** @param {number} cols @param {number} rows @param {string[]} cs @returns {Board} */
    function board(cols, rows, cs) {
      const n = cols * rows;
      /** @type {Board} */
      const b = { cols, rows, ox: 0, oy: 0, sq: 0, cell: new Int8Array(n), prev: new Int8Array(n),
        at: new Float32Array(n), kind: new Uint8Array(n), clock: 0, turn: 1, wait: 0, end: -1,
        pace: 0.85 + rng.random() * 0.3, cs, last: -1 };
      reset(b);
      // A game already under way.
      b.clock = 100;
      for (let k = Math.floor(n * (0.2 + rng.random() * 0.45)); k > 0; k--) {
        const m = choose(b, b.turn) ?? choose(b, 3 - b.turn);
        if (!m) break;
        if (!traps(b, m[0], b.turn).length) b.turn = 3 - b.turn;
        play(b, m[0], m[1], b.turn);
      }
      b.kind.fill(0); b.clock = 200; b.wait = 0.3;
      return b;
    }

    /** @param {Board} b @param {number} dt */
    function tick(b, dt) {
      dt *= b.pace;
      b.clock += dt;
      if (b.end >= 0) {
        b.end += dt;
        if (b.end - dt < HOLD && b.end >= HOLD) {
          // The board clears in a wave from its middle.
          for (let i = 0; i < b.cell.length; i++) {
            if (!b.cell[i]) continue;
            const r = Math.floor(i / b.cols) - (b.rows - 1) / 2, c = i % b.cols - (b.cols - 1) / 2;
            b.kind[i] = 3; b.at[i] = b.clock + Math.hypot(r, c) * 0.09;
          }
        }
        if (b.end > HOLD + Math.hypot(b.rows, b.cols) * 0.045 + 0.9) reset(b);
        return;
      }
      b.wait -= dt;
      if (b.wait > 0) return;
      let m = choose(b, b.turn);
      if (!m) { b.turn = 3 - b.turn; m = choose(b, b.turn); }
      if (!m) { b.end = 0; return; }
      play(b, m[0], m[1], b.turn);
    }

    function layout() {
      const m = Math.min(s.W, s.H);
      if (s.layout === 0) {
        if (!boards.length) boards = [board(8, 8, [s.colors[0], s.colors[1 % nc]])];
        const b = boards[0];
        const side = clamp(m * 0.86, 220, 820);
        b.sq = side / 8; b.ox = (s.W - side) / 2; b.oy = (s.H - side) / 2;
      } else if (s.layout === 1) {
        const sq = clamp(m * 0.075, 30, 64);
        const cols = Math.max(6, Math.floor(s.W / sq) - 1), rows = Math.max(6, Math.floor(s.H / sq) - 1);
        const k = cols + 'x' + rows;
        if (k !== key) { key = k; boards = [board(cols, rows, [s.colors[0], s.colors[1 % nc]])]; }
        const b = boards[0];
        b.sq = Math.min(s.W / (cols + 0.6), s.H / (rows + 0.6));
        b.ox = (s.W - cols * b.sq) / 2; b.oy = (s.H - rows * b.sq) / 2;
      } else {
        const want = clamp(m * 0.44, 150, 340);
        const nx = clamp(Math.floor(s.W / (want * 1.1)), 1, 4), ny = clamp(Math.floor(s.H / (want * 1.1)), 1, 3);
        const n = Math.min(nx * ny, 6), cols = Math.min(nx, n), rows = Math.ceil(n / cols);
        while (boards.length < n) {
          const k = boards.length;
          boards.push(board(6, 6, [s.colors[k % nc], s.colors[(k + 1) % nc]]));
        }
        boards.length = n;
        const side = Math.min(s.W / cols, s.H / rows) * 0.84;
        const gx = (s.W - cols * side) / (cols + 1), gy = (s.H - rows * side) / (rows + 1);
        boards.forEach((b, i) => {
          b.sq = side / 6;
          b.ox = gx + (i % cols) * (side + gx);
          b.oy = gy + Math.floor(i / cols) * (side + gy);
        });
      }
    }

    function render() {
      cache.width = Math.round(s.W * s.dpr); cache.height = Math.round(s.H * s.dpr);
      const g = cache.getContext('2d');
      if (!g) return;
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      g.strokeStyle = s.ink; g.fillStyle = s.ink; g.lineCap = 'round';
      for (const b of boards) {
        const w = b.cols * b.sq, h = b.rows * b.sq;
        g.globalAlpha = s.dark ? 0.05 : 0.045;
        g.fillRect(b.ox, b.oy, w, h);
        g.globalAlpha = s.dark ? 0.2 : 0.24;
        g.lineWidth = Math.max(1, b.sq * 0.025);
        g.beginPath();
        for (let c = 1; c < b.cols; c++) { g.moveTo(b.ox + c * b.sq, b.oy); g.lineTo(b.ox + c * b.sq, b.oy + h); }
        for (let r = 1; r < b.rows; r++) { g.moveTo(b.ox, b.oy + r * b.sq); g.lineTo(b.ox + w, b.oy + r * b.sq); }
        g.stroke();
        g.globalAlpha = s.dark ? 0.32 : 0.36;
        g.lineWidth = Math.max(1.5, b.sq * 0.04);
        g.strokeRect(b.ox, b.oy, w, h);
        // The four marked points of the 8x8 board.
        if (b.cols === 8) {
          g.beginPath();
          for (const [c, r] of [[2, 2], [6, 2], [2, 6], [6, 6]]) {
            g.moveTo(b.ox + c * b.sq + b.sq * 0.07, b.oy + r * b.sq);
            g.arc(b.ox + c * b.sq, b.oy + r * b.sq, b.sq * 0.07, 0, Math.PI * 2);
          }
          g.fill();
        }
      }
    }

    return {
      lay() {
        const fresh = !boards.length;
        layout();
        render();
        // A first frame with a move turning over, for reduced motion.
        if (fresh) for (const b of boards) { tick(b, (b.wait + 0.01) / b.pace); tick(b, (DROP * 0.7 + FLIP * 0.55) / b.pace); }
      },
      step(dt) { for (const b of boards) tick(b, dt); },
      draw() {
        const { ctx } = s;
        /** Fills the path as player p's discs: the first solid, the second a ring round a pale
         * middle, so the sides differ whatever the colours. @param {string} col @param {number} p
         * @param {number} a @param {number} rad */
        const paint = (col, p, a, rad) => {
          ctx.fillStyle = col; ctx.strokeStyle = col;
          ctx.globalAlpha = p === 1 ? a : a * 0.32;
          ctx.fill();
          if (p === 1) return;
          ctx.globalAlpha = a * 1.15; ctx.lineWidth = Math.max(1.5, rad * 0.22);
          ctx.stroke();
        };
        ctx.drawImage(cache, 0, 0, s.W, s.H);
        const A = s.dark ? 0.5 : 0.56;
        for (const b of boards) {
          const rad = b.sq * 0.4;
          // Settled discs in one path per colour; those changing one at a time.
          for (let p = 1; p <= 2; p++) {
            ctx.beginPath();
            for (let i = 0; i < b.cell.length; i++) {
              if (b.cell[i] !== p || (b.kind[i] && b.clock < b.at[i] + (b.kind[i] === 2 ? FLIP : DROP))) continue;
              if (b.kind[i] === 3) continue;
              const x = b.ox + (i % b.cols + 0.5) * b.sq, y = b.oy + (Math.floor(i / b.cols) + 0.5) * b.sq;
              ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, Math.PI * 2);
            }
            paint(b.cs[p - 1], p, A, rad);
          }
          for (let i = 0; i < b.cell.length; i++) {
            const kind = b.kind[i];
            if (!b.cell[i] || !kind) continue;
            const u = clamp((b.clock - b.at[i]) / (kind === 2 ? FLIP : DROP), 0, 1);
            if (kind !== 3 && u >= 1) continue;
            const x = b.ox + (i % b.cols + 0.5) * b.sq, y = b.oy + (Math.floor(i / b.cols) + 0.5) * b.sq;
            let sx = 1, sy = 1, a = 1, p = b.cell[i];
            if (kind === 1) { const e = 1 - (1 - u) * (1 - u); sx = sy = 0.55 + 0.45 * e; a = u; }
            else if (kind === 2) { sx = Math.max(0.1, Math.abs(Math.cos(Math.PI * u))); if (u < 0.5) p = b.prev[i]; }
            else { sx = sy = 1 - u * 0.5; a = 1 - u; }
            if (a <= 0) continue;
            ctx.beginPath(); ctx.ellipse(x, y, rad * sx, rad * sy, 0, 0, Math.PI * 2);
            paint(b.cs[p - 1], p, A * a, rad * Math.min(sx, sy));
          }
          // A ring marks the last disc placed.
          if (b.last >= 0 && b.end < 0 && b.cell[b.last]) {
            const x = b.ox + (b.last % b.cols + 0.5) * b.sq, y = b.oy + (Math.floor(b.last / b.cols) + 0.5) * b.sq;
            ctx.globalAlpha = (s.dark ? 0.45 : 0.5) * clamp((b.clock - b.at[b.last]) / DROP, 0, 1);
            ctx.strokeStyle = s.ink; ctx.lineWidth = Math.max(1.5, b.sq * 0.04);
            ctx.beginPath(); ctx.arc(x, y, rad * 0.55, 0, Math.PI * 2); ctx.stroke();
          }
        }
      },
    };
  });
}
