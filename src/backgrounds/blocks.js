// Blocks: falling block puzzle pieces, bevelled pixel squares in the look's colours, that a
// simple player steers into place; full rows fade and clear and the rest settle. The seed picks
// the variant: a wide field with many pieces raining down at once, a row of classic narrow wells
// with one piece each sliding and turning as it falls, or two wells lying on their sides so the
// pieces fly out from the middle and stack against the left and right edges.

import { stage, clamp } from './stage.js';

/** @typedef {{sh:number, rot:number, c:number, y:number, tc:number, tr:number, wait:number, lock:number}} Piece
 * A falling piece: shape, turn, column, top row (fractional while falling), the column and turn
 * it is steering for, time to its next move and time resting before it locks. */
/** @typedef {{cols:number, rows:number, g:Uint8Array, fade:Float32Array, off:Float32Array,
 *   live:Piece[], max:number, slide:boolean, side:number, x0:number, y0:number, drain:number}} Well
 * A well: its grid (0 empty, else colour + 1), each row's clearing fade and settling offset, the
 * pieces in flight, how many at once, whether they slide in from the middle, which way gravity
 * points on screen (0 down, -1 left, 1 right), where its top-left cell sits, and a drain timer. */

// Tetrominoes as four [column, row] cells; I O T S Z J L.
const SHAPES = [
  [[0, 1], [1, 1], [2, 1], [3, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 1], [1, 1], [2, 1], [1, 0]],
  [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[2, 0], [0, 1], [1, 1], [2, 1]],
];
/** Each shape's four turns, shifted so the smallest column and row are 0. @type {number[][][][]} */
const TURNS = SHAPES.map((cells) => {
  /** @type {number[][][]} */
  const out = [];
  let cur = cells;
  for (let k = 0; k < 4; k++) {
    const mx = Math.min(...cur.map((p) => p[0])), my = Math.min(...cur.map((p) => p[1]));
    out.push(cur.map(([x, y]) => [x - mx, y - my]));
    cur = cur.map(([x, y]) => [-y, x]);
  }
  return out;
});

const FALL = 4.5;    // rows a second
const MOVE = 0.16;   // seconds between a sliding piece's steps
const CLEAR = 0.9;   // seconds a full row takes to fade

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Well[]} */
    let wells = [];
    let cell = 24;
    /** @type {HTMLCanvasElement[]} */
    let sprites = [];

    /** @param {number} cols @param {number} rows @param {number} max @param {boolean} slide @param {number} side @param {number} x0 @param {number} y0 @returns {Well} */
    function well(cols, rows, max, slide, side, x0, y0) {
      return { cols, rows, g: new Uint8Array(cols * rows), fade: new Float32Array(rows), off: new Float32Array(rows),
        live: [], max, slide, side, x0, y0, drain: 0 };
    }

    /** Whether shape sh at turn rot, column c, top row r hits a wall, the floor or the stack.
     * @param {Well} w @param {number} sh @param {number} rot @param {number} c @param {number} r @returns {boolean} */
    function hits(w, sh, rot, c, r) {
      for (const [x, y] of TURNS[sh][rot]) {
        const cx = c + x, cy = r + y;
        if (cx < 0 || cx >= w.cols || cy >= w.rows) return true;
        if (cy >= 0 && w.g[cy * w.cols + cx]) return true;
      }
      return false;
    }

    /** The lowest top row piece p can fall to from row `from`. @param {Well} w @param {number} sh @param {number} rot @param {number} c @param {number} from @returns {number} */
    function rest(w, sh, rot, c, from) {
      let r = from;
      while (!hits(w, sh, rot, c, r + 1)) r++;
      return r;
    }

    /** Picks where a new piece of shape sh should go: rows cleared, holes, height and bumps,
     * scored over every turn and column, skipping columns another falling piece is bound for.
     * @param {Well} w @param {number} sh @returns {{c:number, rot:number}|null} */
    function choose(w, sh) {
      const top = new Int16Array(w.cols).fill(w.rows);
      for (let x = 0; x < w.cols; x++) {
        for (let y = 0; y < w.rows; y++) if (w.g[y * w.cols + x]) { top[x] = y; break; }
      }
      const busy = new Uint8Array(w.cols);
      for (const p of w.live) {
        for (const [x] of TURNS[p.sh][p.tr]) busy[clamp(p.tc + x - 1, 0, w.cols - 1)] = busy[clamp(p.tc + x + 1, 0, w.cols - 1)] = busy[p.tc + x] = 1;
        for (const [x] of TURNS[p.sh][p.rot]) busy[clamp(p.c + x, 0, w.cols - 1)] = 1;
      }
      let best = -Infinity;
      /** @type {{c:number, rot:number}|null} */
      let pick = null;
      for (let rot = 0; rot < 4; rot++) {
        const cells = TURNS[sh][rot], wid = Math.max(...cells.map((p) => p[0])) + 1;
        for (let c = 0; c + wid <= w.cols; c++) {
          if (w.live.length && cells.some(([x]) => busy[c + x])) continue;
          // Resting row from the column tops, as if dropped straight down.
          let r = Infinity;
          for (const [x, y] of cells) r = Math.min(r, top[c + x] - 1 - y);
          if (r < 0) continue;
          let holes = 0, lines = 0, bump = 0;
          const low = new Map();
          for (const [x, y] of cells) low.set(x, Math.max(low.get(x) ?? -1, y));
          for (const [x, y] of low) holes += top[c + x] - 1 - (r + y);
          const rowsHit = new Map();
          for (const [, y] of cells) rowsHit.set(r + y, (rowsHit.get(r + y) ?? 0) + 1);
          for (const [y, k] of rowsHit) {
            let n = k;
            for (let x = 0; x < w.cols; x++) if (w.g[y * w.cols + x]) n++;
            if (n === w.cols) lines++;
          }
          const hi = new Map();
          for (const [x, y] of cells) hi.set(x, Math.min(hi.get(x) ?? 99, r + y));
          const h = (/** @type {number} */ x) => (hi.has(x - c) ? Math.min(top[x], /** @type {number} */ (hi.get(x - c))) : top[x]);
          for (let x = Math.max(0, c - 1); x < Math.min(w.cols - 1, c + wid + 1); x++) {
            bump += Math.abs(h(x) - h(x + 1)) - Math.abs(top[x] - top[x + 1]);
          }
          const score = lines * 3 - holes * 3.5 - (w.rows - r) * 0.5 - bump * 0.35 + rng.random() * 0.6;
          if (score > best) { best = score; pick = { c, rot }; }
        }
      }
      return pick;
    }

    /** Starts a new piece in well w if there is room for one. @param {Well} w @returns {void} */
    function spawn(w) {
      const sh = rng.int(SHAPES.length);
      const at = choose(w, sh);
      if (!at) {
        // Nowhere left to put it: clear the well and start again.
        if (!w.live.length) w.drain = 1;
        return;
      }
      if (w.slide) {
        const c = Math.floor(w.cols / 2) - 1;
        w.live.push({ sh, rot: 0, c, y: -2, tc: at.c, tr: at.rot, wait: MOVE, lock: 0 });
      } else {
        // Dropped in place, turning into its final turn as it comes.
        const rot = (at.rot + 1 + rng.int(3)) % 4;
        const c = clamp(at.c, 0, w.cols - 1 - Math.max(...TURNS[sh][rot].map((p) => p[0])));
        w.live.push({ sh, rot, c, y: -2 - rng.random() * 3, tc: at.c, tr: at.rot, wait: MOVE * 3, lock: 0 });
      }
    }

    /** Writes piece p into the grid and starts any rows it fills clearing. @param {Well} w @param {Piece} p @returns {void} */
    function stamp(w, p) {
      let high = false;
      for (const [x, y] of TURNS[p.sh][p.rot]) {
        const r = Math.round(p.y) + y;
        if (r < 3) high = true;
        if (r >= 0) w.g[r * w.cols + p.c + x] = 1 + p.sh % nc;
      }
      for (let r = 0; r < w.rows; r++) {
        if (w.fade[r]) continue;
        let n = 0;
        for (let x = 0; x < w.cols; x++) if (w.g[r * w.cols + x]) n++;
        if (n === w.cols) w.fade[r] = 1;
      }
      // Stacked to the top: fade the whole well out and start again.
      if (high && !w.drain) w.drain = 1;
    }

    /** Takes row k out, everything above dropping one row and easing down into place. @param {Well} w @param {number} k @returns {void} */
    function remove(w, k) {
      w.g.copyWithin(w.cols, 0, k * w.cols);
      w.g.fill(0, 0, w.cols);
      for (let r = k; r > 0; r--) { w.off[r] = w.off[r - 1] - 1; w.fade[r] = w.fade[r - 1]; }
      w.off[0] = 0; w.fade[0] = 0;
    }

    /** Advances well w by dt. @param {Well} w @param {number} dt @returns {void} */
    function tick(w, dt) {
      if (w.drain) {
        w.drain -= dt / 1.5;
        if (w.drain <= 0) { w.drain = 0; w.g.fill(0); w.fade.fill(0); w.live.length = 0; }
        return;
      }
      for (let r = 0; r < w.rows; r++) {
        w.off[r] = Math.min(0, w.off[r] + dt * 5);
        if (w.fade[r]) {
          w.fade[r] -= dt / CLEAR;
          if (w.fade[r] <= 0) remove(w, r);
        }
      }
      for (const p of w.live) {
        // Steer: turn first, then slide a column at a time.
        p.wait -= dt;
        if (p.wait <= 0) {
          p.wait = MOVE;
          const y = Math.ceil(p.y);
          const nr = (p.rot + 1) % 4;
          if (p.rot !== p.tr && !hits(w, p.sh, nr, p.c, y)) p.rot = nr;
          else if (p.c !== p.tc) {
            const c = p.c + Math.sign(p.tc - p.c);
            if (!hits(w, p.sh, p.rot, c, y)) p.c = c;
          }
        }
        const floor = rest(w, p.sh, p.rot, p.c, Math.max(-4, Math.floor(p.y)));
        p.y = Math.min(floor, p.y + (w.slide ? 1.5 : 1) * FALL * dt);
        if (p.y >= floor) p.lock += dt;
        else p.lock = 0;
      }
      const done = w.live.filter((p) => p.lock > 0.12);
      w.live = w.live.filter((p) => p.lock <= 0.12);
      for (const p of done) stamp(w, p);
      // A narrow well takes its next piece once the last is halfway down.
      const room = !w.slide || w.live.every((p) => p.y > w.rows * 0.45);
      if (w.live.length < w.max && room && rng.random() < dt * 3) spawn(w);
    }

    /** Lays the wells out for this variant and size, and runs them a while so the first frame
     * already has a stack and pieces in the air. @returns {void} */
    function build() {
      const m = Math.min(s.W, s.H);
      wells = [];
      if (layout === 1) {
        const n = clamp(Math.floor(s.W / (clamp(m / 30, 13, 28) * 13)), 2, 6);
        cell = clamp(s.W / n / 12.5, 13, 28);
        const rows = Math.floor(s.H / cell), gap = (s.W - n * 10 * cell) / n;
        for (let i = 0; i < n; i++) {
          const w = well(10, rows, 2, true, 0, gap / 2 + i * (10 * cell + gap), s.H - rows * cell);
          // A game already under way: a few ragged rows of rubble, each with a gap or two.
          for (let r = rows - 3 - rng.int(4); r < rows; r++) {
            for (let c = 0; c < 10; c++) if (rng.random() < 0.75) w.g[r * 10 + c] = 1 + rng.int(nc);
            w.g[r * 10 + rng.int(10)] = 0;
          }
          wells.push(w);
        }
      } else if (layout === 2) {
        cell = clamp(m / 26, 14, 32);
        const cols = Math.floor(s.H / cell), rows = Math.floor(s.W / 2 / cell);
        const max = clamp(Math.round(cols / 7), 2, 6), y0 = (s.H - cols * cell) / 2;
        wells.push(well(cols, rows, max, false, -1, 0, y0), well(cols, rows, max, false, 1, s.W - rows * cell, y0));
      } else {
        cell = clamp(m / 26, 14, 34);
        const cols = Math.floor(s.W / cell), rows = Math.ceil(s.H / cell);
        wells.push(well(cols, rows, clamp(Math.round(cols / 6), 3, 10), false, 0, (s.W - cols * cell) / 2, s.H - rows * cell));
      }
      for (const w of wells) for (let k = 0; k < 300; k++) tick(w, 0.1);
    }

    /** Screen position of well cell (c, r). @param {Well} w @param {number} c @param {number} r @returns {[number, number]} */
    function at(w, c, r) {
      if (w.side < 0) return [w.x0 + (w.rows - 1 - r) * cell, w.y0 + c * cell];
      if (w.side > 0) return [w.x0 + r * cell, w.y0 + c * cell];
      return [w.x0 + c * cell, w.y0 + r * cell];
    }

    return {
      lay() {
        build();
        sprites = s.colors.map((c) => block(c, Math.round(cell * s.dpr)));
      },
      step(dt) {
        for (const w of wells) tick(w, dt);
      },
      draw() {
        const { ctx } = s;
        const A = s.dark ? 0.42 : 0.46;
        for (const w of wells) {
          if (layout === 1) {
            // The well's walls and floor.
            ctx.globalAlpha = s.dark ? 0.16 : 0.2;
            ctx.strokeStyle = s.ink;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(w.x0 - 3, w.y0);
            ctx.lineTo(w.x0 - 3, s.H - 1);
            ctx.lineTo(w.x0 + w.cols * cell + 3, s.H - 1);
            ctx.lineTo(w.x0 + w.cols * cell + 3, w.y0);
            ctx.stroke();
          }
          const fall = w.drain ? w.drain : 1;
          for (let r = 0; r < w.rows; r++) {
            const f = w.fade[r] ? w.fade[r] * w.fade[r] : 1;
            for (let c = 0; c < w.cols; c++) {
              const v = w.g[r * w.cols + c];
              if (!v) continue;
              const [x, y] = at(w, c, r + w.off[r]);
              ctx.globalAlpha = A * f * fall;
              ctx.drawImage(sprites[v - 1], x, y, cell, cell);
            }
          }
          ctx.globalAlpha = A * fall;
          for (const p of w.live) {
            for (const [x, y] of TURNS[p.sh][p.rot]) {
              if (p.y + y < -1) continue;
              const [sx, sy] = at(w, p.c + x, p.y + y);
              ctx.drawImage(sprites[p.sh % nc], sx, sy, cell, cell);
            }
          }
        }
      },
    };
  });
}

/** A bevelled pixel block, lit from the top left, as a sprite. @param {string} color @param {number} n size in device px @returns {HTMLCanvasElement} */
function block(color, n) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(4, n);
  const g = c.getContext('2d');
  if (!g) return c;
  n = c.width;
  const gap = Math.max(1, Math.round(n * 0.06)), b = Math.max(2, Math.round(n * 0.16));
  g.fillStyle = color;
  g.fillRect(gap, gap, n - 2 * gap, n - 2 * gap);
  // Light top and left edges, dark bottom and right.
  g.fillStyle = 'rgba(255,255,255,.4)';
  g.beginPath();
  g.moveTo(gap, gap); g.lineTo(n - gap, gap); g.lineTo(n - gap - b, gap + b); g.lineTo(gap + b, gap + b);
  g.lineTo(gap + b, n - gap - b); g.lineTo(gap, n - gap);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath();
  g.moveTo(n - gap, n - gap); g.lineTo(gap, n - gap); g.lineTo(gap + b, n - gap - b); g.lineTo(n - gap - b, n - gap - b);
  g.lineTo(n - gap - b, gap + b); g.lineTo(n - gap, gap);
  g.fill();
  return c;
}
