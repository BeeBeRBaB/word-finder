// Newton's cradle: steel balls hang in a row on V-shaped strings; an end ball swings out, knocks
// the row, and the ball at the far end swings out in its place (two or three when as many lift).
// Layout 0: a grid of small cradles, each knocking steadily on its own beat. 1: one long cradle
// of big balls that is lifted, let go and runs down, then lifted again with a different count.
// 2: cradles of mixed sizes scattered about, each lifted and let go at its own time.

import { stage, clamp } from './stage.js';
import { roundRect } from './shapes.js';

/** @typedef {{x:number, y:number, L:number, r:number, n:number, ex:number, k:number, A0:number, w:number,
 *   ph:number, c:number, cyc:boolean, mode:number, u:number, wait:number, amp:number}} Cradle
 * Middle x and rail y, string length L and ball radius r, n balls with k lifted, the frame ex
 * beyond each end string, most swing A0 (radians) and rate w; phase ph; colour c. A cycling one is at rest (mode 0) for wait seconds,
 * lifting (1, u 0..1) or swinging (2) at amplitude amp; a steady one always swings at A0. */

const G = 2100;   // gravity in px/s^2: a 120px string swings once in 1.5s
const LIFT = 2.2; // seconds a lift takes
const DECAY = 7;  // seconds for a swing to lose two thirds of its height

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const L = s.layout;
    const balls = s.colors.map((c) => ball(c, s.dark));
    /** @type {Cradle[]} */
    let cradles = [];
    let key = '';

    /** @param {number} x @param {number} y @param {number} len @param {number} r @param {number} n
     * @param {number} room px free beside the row, either side @param {boolean} cyc @returns {Cradle} */
    function cradle(x, y, len, r, n, room, cyc) {
      // The widest swing that still clears the edge of the room.
      const A0 = Math.min(0.62, Math.asin(clamp((room - r * 1.2) / len, 0.15, 0.95)));
      const ex = Math.min(room, len * Math.sin(A0) + r * 1.6);
      const c = { x, y, L: len, r, n, ex, k: 1 + rng.int(n > 5 ? 3 : 2), A0, w: Math.sqrt(G / len),
        ph: rng.random() * Math.PI * 2, c: rng.int(balls.length), cyc, mode: 2, u: 0,
        wait: 0, amp: A0 * (0.35 + rng.random() * 0.6) };
      return c;
    }

    /** Fresh cradles for this size. @returns {void} */
    function deal() {
      const m = Math.min(s.W, s.H);
      cradles = [];
      if (L === 0) {
        const r = clamp(m * 0.026, 9, 20), len = r * 5.2;
        const cw = 10 * r + 2 * len * 0.62 + r * 4, ch = len + r * 6;
        const cols = clamp(Math.floor(s.W / cw), 1, 6), rows = clamp(Math.floor(s.H / ch), 1, 5);
        const gx = s.W / cols, gy = s.H / rows;
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const n = 4 + rng.int(3);
          const x = gx * (i + 0.5) + (j % 2 ? gx * 0.08 : -gx * 0.08);
          cradles.push(cradle(x, gy * (j + 0.5) - len * 0.55, len, r, n, (gx - n * 2 * r) / 2, false));
        }
      } else if (L === 1) {
        // A tall screen gets two, one above the other.
        const rows = s.H > s.W * 1.2 ? 2 : 1, gy = s.H / rows;
        const r = clamp(m * 0.045, 15, 44);
        const n = clamp(Math.floor(s.W * 0.55 / (2 * r)) | 1, 5, 11);
        const len = clamp(gy * 0.42, r * 4, r * 9);
        for (let j = 0; j < rows; j++) {
          const c = cradle(s.W / 2, gy * j + (gy - len - r * 4) / 2, len, r, n, (s.W - n * 2 * r) / 2 - r, true);
          c.k = 1 + rng.int(3);
          if (j) { c.mode = 0; c.amp = 0; c.wait = 5; }
          cradles.push(c);
        }
      } else {
        const sizes = [0.04, 0.03, 0.021];
        const want = clamp(Math.round(s.W * s.H / 90000), 4, 14);
        /** @type {number[][]} */
        const boxes = [];
        for (let tries = 0; tries < 400 && cradles.length < want; tries++) {
          // Two big ones first, then a few middling, then small ones in the gaps.
          const cls = tries > 200 ? 2 : cradles.length < 2 ? 0 : cradles.length < 5 ? 1 : 2;
          const r = clamp(m * sizes[cls] * (0.9 + rng.random() * 0.2), 7, 28);
          const n = 3 + rng.int(4), len = r * (4.5 + rng.random() * 2);
          const room = len * 0.5 + r * 1.2, half = n * r + room + r * 2, h = len * 1.15 + r * 5;
          const x = half + rng.random() * (s.W - 2 * half), y = len * 0.15 + r + rng.random() * (s.H - h - r);
          if (s.W < 2 * half || s.H < h + 2 * r) continue;
          const box = [x - half, y - len * 0.15 - r, x + half, y + h];
          if (boxes.some((b) => box[0] < b[2] && b[0] < box[2] && box[1] < b[3] && b[1] < box[3])) continue;
          boxes.push(box);
          const c = cradle(x, y, len, r, n, room, true);
          // Most start at rest, waiting their turn; a few are already swinging.
          if (rng.random() < 0.6) { c.mode = 0; c.wait = rng.random() * 14; c.amp = 0; }
          cradles.push(c);
        }
      }
    }

    /** Swing angle of each end's moving balls. @param {Cradle} c @returns {number} */
    function swing(c) {
      if (!c.cyc) return c.A0 * 0.8 * Math.sin(c.ph);
      if (c.mode === 0) return 0;
      if (c.mode === 1) return c.amp * (c.u * c.u * (3 - 2 * c.u));
      return c.amp * Math.sin(c.ph);
    }

    return {
      lay() {
        const k = `${s.W}x${s.H}`;
        if (k !== key) { key = k; deal(); }
      },
      step(dt) {
        for (const c of cradles) {
          if (!c.cyc) { c.ph += c.w * dt; continue; }
          if (c.mode === 0) {
            c.wait -= dt;
            if (c.wait <= 0) { c.mode = 1; c.u = 0; c.amp = c.A0 * (0.6 + rng.random() * 0.4); c.k = 1 + rng.int(c.n > 5 ? 3 : 2); }
          } else if (c.mode === 1) {
            c.u += dt / LIFT;
            if (c.u >= 1) { c.mode = 2; c.ph = Math.PI / 2; }
          } else {
            c.ph += c.w * dt;
            c.amp *= Math.exp(-dt / DECAY);
            // Let it come to rest at the bottom of a swing, where nothing visibly jumps.
            if (c.amp < 0.01 && Math.abs(Math.sin(c.ph)) < 0.2) { c.mode = 0; c.amp = 0; c.wait = L === 1 ? 2 + rng.random() * 2 : 4 + rng.random() * 16; }
          }
        }
      },
      draw() {
        const { ctx } = s;
        const frame = new Path2D(), strings = new Path2D(), base = new Path2D(), shade = new Path2D();
        /** @type {number[]} */
        const xs = [], ys = [], rs = [], cs = [];
        for (const c of cradles) {
          const { r, n, L: len } = c;
          const x0 = c.x - (n - 1) * r, x1 = c.x + (n - 1) * r;
          const ox = r * 0.5, oy = len * 0.12;
          const by = c.y + len + r * 2.2, ex = c.ex;
          // Rails front and back, the end posts down to the base, the base plate.
          frame.moveTo(x0 - ex, c.y); frame.lineTo(x1 + ex, c.y);
          frame.moveTo(x0 - ex + ox, c.y - oy); frame.lineTo(x1 + ex + ox, c.y - oy);
          frame.moveTo(x0 - ex, c.y); frame.lineTo(x0 - ex, by);
          frame.moveTo(x1 + ex, c.y); frame.lineTo(x1 + ex, by);
          frame.moveTo(x0 - ex + ox, c.y - oy); frame.lineTo(x0 - ex + ox, by - r * 0.6);
          frame.moveTo(x1 + ex + ox, c.y - oy); frame.lineTo(x1 + ex + ox, by - r * 0.6);
          roundRect(asCtx(base), x0 - ex - r, by, x1 - x0 + 2 * ex + 2 * r + ox, r * 0.9, r * 0.3);
          const a = swing(c);
          for (let i = 0; i < n; i++) {
            let th = 0;
            if (a > 0 && i >= n - c.k) th = a;
            else if (a < 0 && i < c.k) th = a;
            const px = x0 + i * 2 * r;
            const bx = px + Math.sin(th) * len, byy = c.y + Math.cos(th) * len;
            strings.moveTo(px, c.y); strings.lineTo(bx, byy - r * 0.9);
            strings.moveTo(px + ox, c.y - oy); strings.lineTo(bx, byy - r * 0.9);
            shade.moveTo(bx + r * 0.8, by - r * 0.15);
            shade.ellipse(bx, by - r * 0.15, r * 0.8, r * 0.2, 0, 0, Math.PI * 2);
            xs.push(bx); ys.push(byy); rs.push(r); cs.push(c.c);
          }
        }
        ctx.lineCap = 'round';
        ctx.strokeStyle = s.ink;
        ctx.fillStyle = s.ink;
        ctx.globalAlpha = s.dark ? 0.1 : 0.12;
        ctx.fill(base); ctx.fill(shade);
        ctx.globalAlpha = s.dark ? 0.42 : 0.5;
        ctx.lineWidth = 2;
        ctx.stroke(frame);
        ctx.globalAlpha = s.dark ? 0.3 : 0.38;
        ctx.lineWidth = 1;
        ctx.stroke(strings);
        ctx.globalAlpha = s.dark ? 0.6 : 0.55;
        for (let i = 0; i < xs.length; i++) ctx.drawImage(balls[cs[i]], xs[i] - rs[i], ys[i] - rs[i], rs[i] * 2, rs[i] * 2);
      },
    };
  });
}

/** A shiny ball in `color`, lit from the upper left, as a sprite.
 * @param {string} color @param {boolean} dark @returns {HTMLCanvasElement} */
function ball(color, dark) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createRadialGradient(24, 22, 4, 32, 32, 34);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(0.7, 'rgba(0,0,0,.15)');
  sh.addColorStop(1, dark ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.4)');
  g.fillStyle = sh; g.fillRect(0, 0, 64, 64);
  const hi = g.createRadialGradient(22, 20, 0, 22, 20, 14);
  hi.addColorStop(0, 'rgba(255,255,255,.85)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi; g.fillRect(0, 0, 64, 64);
  return c;
}

/** A path, for roundRect, which uses only the calls the two share. @param {Path2D} p @returns {CanvasRenderingContext2D} */
const asCtx = (p) => /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (p));
