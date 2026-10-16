// Light cycles: glowing bikes race over a faint grid, turning only at right angles to stay clear
// of every wall, each laying a glowing wall behind it. A bike that is boxed in breaks up in a
// soft ring and rides back in elsewhere. The seed picks the variant: a few bikes seen from above
// whose walls fade away behind them; the same race seen low across a floor in perspective, the
// walls standing up as glowing ribbons; or a duel of two bikes whose walls stay until one is
// boxed in, then the arena clears for the next round.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, t:number}} Mark a cell centre a bike passed, and when */
/** @typedef {{c:number, at:number, to:number, d:number, ph:number, marks:Mark[], dead:number, wait:number}} Bike
 * at, to: the cells it rides from and to; d its heading 0..3; ph 0..1 between them;
 * dead: seconds since it broke up (-1 alive); wait: seconds until it rides again. */
/** @typedef {{x:number, y:number, t:number, c:number}} Ring a break-up, fading out */

const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const BANDS = 6;

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    const persp = layout === 1, duel = layout === 2;
    const LIFE = duel ? Infinity : persp ? 8 : 7; // seconds a wall stands
    const RATE = duel ? 5.5 : 5; // cells per second
    let g = 24, cols = 0, rows = 0, ox = 0, oy = 0;
    // Perspective: depth of the nearest row, scale, camera height and horizon.
    let D = 1, K = 1, camH = 1, hy = 0;
    /** Time a wall was laid on each cell, -1 when clear. @type {Float32Array} */
    let laid = new Float32Array(0);
    /** Cells on the playing field (the part of the floor on screen). @type {Uint8Array} */
    let field = new Uint8Array(0);
    /** @type {Int32Array} */
    let queue = new Int32Array(0);
    /** @type {Uint8Array} */
    let seen = new Uint8Array(0);
    /** @type {Bike[]} */
    let bikes = [];
    /** @type {Ring[]} */
    const rings = [];
    let clock = 0, round = 0, ending = -1, began = 0;
    const base = rng.int(nc);
    const col = s.colors.map((_, i) => s.colors[(base + i) % nc]);
    const glows = col.map(glow);

    /** Screen point of floor position (x, y) in cells at height z. @param {number} x @param {number} y @param {number} [z] @returns {number[]} */
    function proj(x, y, z = 0) {
      if (!persp) return [ox + x * g, oy + y * g];
      const d = D + (rows - y);
      return [s.W / 2 + K * (x - cols / 2) / d, hy + K * (camH - z) / d];
    }

    /** @param {number} i */
    const blocked = (i) => !field[i] || (laid[i] >= 0 && clock - laid[i] < LIFE);

    /** The cell next to `i` heading `d`, or -1 off the grid. @param {number} i @param {number} d */
    function next(i, d) {
      const x = (i % cols) + DX[d], y = Math.floor(i / cols) + DY[d];
      return x < 0 || y < 0 || x >= cols || y >= rows ? -1 : y * cols + x;
    }

    /** Free cells reachable from `from`, up to `cap`, with `skip` counted as walls. @param {number} from @param {number} cap @param {Set<number>} skip */
    function room(from, cap, skip) {
      seen.fill(0);
      let h = 0, t = 0;
      queue[t++] = from; seen[from] = 1;
      while (h < t && t < cap) {
        const i = queue[h++];
        for (let d = 0; d < 4; d++) {
          const j = next(i, d);
          if (j >= 0 && !seen[j] && !blocked(j) && !skip.has(j)) { seen[j] = 1; queue[t++] = j; }
        }
      }
      return t;
    }

    /** Picks the heading at a cell: ahead unless another way has clearly more room. @param {Bike} b @returns {number} -1 when boxed in */
    function choose(b) {
      const skip = new Set(bikes.filter((o) => o !== b && o.dead < 0).map((o) => o.to));
      let best = -1, bestRoom = 0, ahead = 0;
      /** @type {number[]} */
      const rooms = [];
      for (const turn of [0, 1, 3]) {
        const d = (b.d + turn) % 4, j = next(b.to, d);
        const r = j >= 0 && !blocked(j) && !skip.has(j) ? room(j, 260, skip) : 0;
        rooms[turn] = r;
        if (turn === 0) ahead = r;
        if (r > bestRoom) { bestRoom = r; best = d; }
      }
      if (best < 0) return -1;
      // Ride on while ahead is nearly as roomy; now and then turn anyway when a side is as good.
      if (ahead >= bestRoom * 0.85) {
        const side = rng.random() < 0.5 ? 1 : 3;
        if (rng.random() < (duel ? 0.07 : 0.1) && rooms[side] >= ahead * 0.95) return (b.d + side) % 4;
        return b.d;
      }
      return best;
    }

    /** Puts `b` on a free cell, heading its longest clear way. @param {Bike} b @param {number} [cell] @param {number} [dir] */
    function spawn(b, cell, dir) {
      const skip = new Set();
      for (let k = 0; k < 80; k++) {
        const i = cell ?? (persp ? onScreen() : rng.int(cols * rows));
        if (blocked(i)) { if (cell !== undefined) break; continue; }
        let d = dir ?? 0, far = -1;
        if (dir === undefined) {
          for (let e = 0; e < 4; e++) {
            let run = 0, j = next(i, e);
            while (j >= 0 && !blocked(j) && run < 12) { run++; j = next(j, e); }
            if (run > far) { far = run; d = e; }
          }
          if (far < 4 || room(i, 120, skip) < 100) continue;
        }
        b.at = i; b.to = next(i, d) >= 0 && !blocked(next(i, d)) ? next(i, d) : i;
        b.d = d; b.ph = 0; b.dead = -1; b.wait = 0;
        b.marks = [{ x: i % cols, y: Math.floor(i / cols), t: clock }];
        laid[i] = clock;
        return true;
      }
      b.wait = 1;
      return false;
    }

    /** A cell under a random point of the screen, so the near rows get their share. @returns {number} */
    function onScreen() {
      const sx = rng.random() * s.W, sy = rng.random() * s.H;
      const d = K * camH / Math.max(1, sy - hy);
      const y = Math.round(rows - (d - D)), x = Math.round((sx - s.W / 2) * d / K + cols / 2);
      return clamp(y, 0, rows - 1) * cols + clamp(x, 0, cols - 1);
    }

    /** Starts a duel round: two bikes from opposite sides. */
    function newRound() {
      laid.fill(-1);
      rings.length = 0;
      ending = -1;
      began = clock;
      round++;
      const y = Math.floor(rows / 2);
      bikes = [0, 1].map((k) => ({ c: (round + k * 2) % nc, at: 0, to: 0, d: 0, ph: 0, marks: [], dead: -1, wait: 0 }));
      spawn(bikes[0], y * cols + Math.floor(cols * 0.2), 0);
      spawn(bikes[1], (y - 1 + (rows % 2)) * cols + Math.ceil(cols * 0.8) - 1, 2);
    }

    /** @param {Bike} b */
    function breakUp(b) {
      const [x, y] = [b.at % cols, Math.floor(b.at / cols)];
      rings.push({ x, y, t: 0, c: b.c });
      b.dead = 0; b.wait = 1.8;
    }

    /** @param {number} dt */
    function advance(dt) {
      clock += dt;
      if (duel && ending >= 0) {
        ending += dt;
        if (ending > 2.4) newRound();
        return;
      }
      for (const b of bikes) {
        if (b.dead >= 0) {
          b.dead += dt;
          if (b.dead > 1.4) {
            // Its wall fades as it breaks up; then clear its cells.
            for (const m of b.marks) { const i = m.y * cols + m.x; if (laid[i] === m.t) laid[i] = -1; }
            b.marks = [];
          }
          if (!duel && (b.wait -= dt) <= 0) spawn(b);
          continue;
        }
        b.ph += RATE * dt;
        while (b.ph >= 1 && b.dead < 0) {
          b.ph -= 1;
          b.at = b.to;
          laid[b.at] = clock;
          b.marks.push({ x: b.at % cols, y: Math.floor(b.at / cols), t: clock });
          const d = choose(b);
          if (d < 0) { breakUp(b); break; }
          b.d = d; b.to = next(b.at, d);
        }
        // Forget marks whose wall has faded.
        if (LIFE < Infinity) while (b.marks.length > 1 && clock - b.marks[0].t > LIFE) b.marks.shift();
      }
      for (const r of rings) r.t += dt;
      while (rings.length && rings[0].t > 1.6) rings.shift();
      if (duel && bikes.some((b) => b.dead > 2)) ending = 0;
      if (duel && clock - began > 70) ending = 0;
    }

    /** Strokes the floor grid: a few dozen lines, cheaper each frame than a full-host cache. */
    function paintFloor() {
      const f = s.ctx;
      f.strokeStyle = s.ink;
      f.lineWidth = 1;
      f.globalAlpha = s.dark ? 0.11 : 0.1;
      f.beginPath();
      if (!persp) {
        const x0 = ox - g / 2, y0 = oy - g / 2;
        for (let x = 0; x <= cols; x++) { f.moveTo(x0 + x * g, y0); f.lineTo(x0 + x * g, y0 + rows * g); }
        for (let y = 0; y <= rows; y++) { f.moveTo(x0, y0 + y * g); f.lineTo(x0 + cols * g, y0 + y * g); }
        f.stroke();
        if (duel) {
          f.globalAlpha = s.dark ? 0.3 : 0.32;
          f.lineWidth = 1.5;
          f.strokeRect(x0, y0, cols * g, rows * g);
        }
        f.globalAlpha = 1;
        return;
      }
      for (let x = 0; x <= cols; x++) {
        const [ax, ay] = proj(x - 0.5, -0.5), [bx, by] = proj(x - 0.5, rows - 0.5);
        f.moveTo(ax, ay); f.lineTo(bx, by);
      }
      for (let y = 0; y <= rows; y++) {
        const [ax, ay] = proj(-0.5, y - 0.5), [bx, by] = proj(cols - 0.5, y - 0.5);
        f.moveTo(ax, ay); f.lineTo(bx, by);
      }
      f.stroke();
      f.globalAlpha = 1;
    }

    /** Head position of `b` in cells. @param {Bike} b @returns {number[]} */
    function head(b) {
      const ax = b.at % cols, ay = Math.floor(b.at / cols), bx = b.to % cols, by = Math.floor(b.to / cols);
      return [ax + (bx - ax) * b.ph, ay + (by - ay) * b.ph];
    }

    /** Alpha of a wall laid `age` seconds ago, 0..1. @param {Bike} b @param {number} age */
    function fade(b, age) {
      let a = LIFE < Infinity ? 1 - age / LIFE : 1;
      if (b.dead >= 0) a *= clamp(1 - b.dead / 1.4, 0, 1);
      if (ending >= 0) a *= clamp(1 - (ending - 0.6) / 1.4, 0, 1);
      return clamp(a, 0, 1);
    }

    /** Walls of `b`, a few alpha bands at a time. @param {Bike} b */
    function walls(b) {
      const { ctx } = s;
      const m = b.marks;
      if (!m.length) return;
      const tip = b.dead < 0 ? head(b) : [m[m.length - 1].x, m[m.length - 1].y];
      const hue = col[b.c];
      for (let band = 0; band < BANDS; band++) {
        ctx.beginPath();
        let any = false, joined = false;
        for (let i = 0; i < m.length; i++) {
          const a = fade(b, clock - m[i].t);
          if (a <= 0 || Math.min(BANDS - 1, Math.floor(a * BANDS)) !== band) { joined = false; continue; }
          const p = m[i], q = i + 1 < m.length ? m[i + 1] : { x: tip[0], y: tip[1] };
          any = true;
          if (!persp) {
            // One run per band, so turns inside it join round and its ends meet the next band flush.
            const [x0, y0] = proj(p.x, p.y), [x1, y1] = proj(q.x, q.y);
            if (!joined) ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            joined = true;
          } else {
            const [x0, y0] = proj(p.x, p.y), [x1, y1] = proj(q.x, q.y);
            const [, t0] = proj(p.x, p.y, 0.7), [, t1] = proj(q.x, q.y, 0.7);
            ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x1, t1); ctx.lineTo(x0, t0); ctx.closePath();
          }
        }
        if (!any) continue;
        const a = (band + 1) / BANDS;
        if (!persp) {
          ctx.strokeStyle = hue;
          if (s.dark) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = a * 0.16; ctx.lineWidth = g * 0.42; ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
          }
          ctx.globalAlpha = a * (s.dark ? 0.6 : 0.55); ctx.lineWidth = Math.max(2, g * 0.13); ctx.stroke();
        } else {
          ctx.fillStyle = hue;
          ctx.globalAlpha = a * (s.dark ? 0.24 : 0.22);
          ctx.fill();
          ctx.strokeStyle = hue;
          ctx.globalAlpha = a * (s.dark ? 0.5 : 0.5);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    /** The bike itself: a glow and a short capsule along its heading. @param {Bike} b */
    function bike(b) {
      if (b.dead >= 0) return;
      const { ctx } = s;
      const [hx, hy2] = head(b);
      const [x, y] = proj(hx, hy2, persp ? 0.35 : 0);
      const sc = persp ? K / (D + rows - hy2) : g;
      const r = sc * (persp ? 0.8 : 1.1);
      if (s.dark) ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = s.dark ? 0.45 : 0.3;
      ctx.drawImage(glows[b.c], x - r, y - r, r * 2, r * 2);
      ctx.globalCompositeOperation = 'source-over';
      // Heading on screen, from a point a little ahead.
      const [fx, fy] = proj(hx + DX[b.d] * 0.3, hy2 + DY[b.d] * 0.3, persp ? 0.35 : 0);
      let ux = fx - x, uy = fy - y;
      const n = Math.hypot(ux, uy) || 1;
      ux /= n; uy /= n;
      const len = sc * 0.5, wid = sc * 0.17;
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = col[b.c];
      ctx.lineCap = 'round';
      ctx.lineWidth = wid * 2;
      ctx.beginPath(); ctx.moveTo(x - ux * len, y - uy * len); ctx.lineTo(x + ux * len * 0.4, y + uy * len * 0.4); ctx.stroke();
      ctx.globalAlpha = s.dark ? 0.7 : 0.5;
      ctx.strokeStyle = s.dark ? '#fff' : s.ink;
      ctx.lineWidth = wid * 0.7;
      ctx.beginPath(); ctx.moveTo(x - ux * len * 0.7, y - uy * len * 0.7); ctx.lineTo(x + ux * len * 0.25, y + uy * len * 0.25); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        if (!persp) {
          g = clamp(Math.round(m / (duel ? 22 : 26)), 13, 30);
          cols = Math.max(8, Math.floor(s.W / g) - (duel ? 1 : 0));
          rows = Math.max(8, Math.floor(s.H / g) - (duel ? 1 : 0));
          // Cell centres; the grid lines fall half a cell either side.
          ox = (s.W - cols * g) / 2 + g / 2; oy = (s.H - rows * g) / 2 + g / 2;
        } else {
          rows = clamp(Math.round(s.H / clamp(m / 20, 16, 34)), 12, 30);
          D = rows * 0.8;
          const span = 1.06 * s.H / (1 / D - 1 / (D + rows));
          camH = (D + rows / 2) * 0.55;
          K = span / camH;
          hy = s.H * 1.03 - K * camH / D;
          cols = Math.ceil(s.W * (D + rows) / K) + 2;
        }
        const n = cols * rows;
        laid = new Float32Array(n).fill(-1);
        field = new Uint8Array(n);
        queue = new Int32Array(n);
        seen = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          const [x, y] = proj(i % cols, Math.floor(i / cols));
          const pad = persp ? 6 : 0;
          field[i] = x > pad && x < s.W - pad && y > pad && y < s.H - pad ? 1 : 0;
        }
        rings.length = 0;
        if (duel) newRound();
        else {
          const want = clamp(Math.round(s.W * s.H / (persp ? 220000 : 150000)), persp ? 4 : 3, persp ? 6 : 7);
          bikes = [];
          for (let k = 0; k < want; k++) {
            const b = { c: k % nc, at: 0, to: 0, d: 0, ph: 0, marks: [], dead: -1, wait: 0 };
            bikes.push(b);
            spawn(b);
          }
        }
        // Every size starts a fresh race; run it a while so a still frame has walls up.
        for (let i = 0; i < (duel ? 420 : 150); i++) advance(1 / 30);
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        paintFloor();
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';
        for (const b of bikes) walls(b);
        for (const b of bikes) bike(b);
        for (const r of rings) {
          const [x, y] = proj(r.x, r.y);
          const u = r.t / 1.6;
          const sc = persp ? K / (D + rows - r.y) : g;
          ctx.strokeStyle = col[r.c];
          ctx.globalAlpha = 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u);
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (persp) ctx.ellipse(x, y, sc * (0.4 + u * 2), sc * (0.4 + u * 2) * 0.45, 0, 0, TAU);
          else ctx.arc(x, y, sc * (0.4 + u * 2), 0, TAU);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      },
    };
  });
}

/** A round glow, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function glow(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,.9)');
  grad.addColorStop(0.3, 'rgba(0,0,0,.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
