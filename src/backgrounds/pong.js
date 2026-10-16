// Pong: a self-playing retro paddle game in the look's colours, a square ball with a short trail,
// a dashed net and blocky scores. The seed picks the variant: one big court, a wall of small
// courts each playing its own rally, or a four-player court with a paddle on every side.
// The paddles aim at where the ball will arrive and now and then fall short, so points are won.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {0|1|2|3} Side left, right, top, bottom */
/** @typedef {{side:Side, pos:number, target:number, err:number, c:number, score:number}} Paddle
 * pos and target run along the paddle's wall, in px from the court's top or left edge. */
/** @typedef {{x:number, y:number, w:number, h:number, pads:Paddle[], bx:number, by:number,
 *   vx:number, vy:number, speed:number, wait:number, trail:number[], r:number, len:number,
 *   thick:number, base:number}} Court
 * Ball (bx, by) and trail (x, y pairs, newest last) are court-relative. */

const TRAIL = 7;
// Blocky 3x5 digits, one row of three bits per number, top row first.
const DIGITS = [
  [7, 5, 5, 5, 7], [2, 6, 2, 2, 7], [7, 1, 7, 4, 7], [7, 1, 3, 1, 7], [5, 5, 7, 1, 1],
  [7, 4, 7, 1, 7], [7, 4, 7, 5, 7], [7, 1, 1, 2, 2], [7, 5, 7, 5, 7], [7, 5, 7, 1, 7],
];

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    /** @type {Court[]} */
    let courts = [];

    /** Court rectangles for this size. @returns {{x:number, y:number, w:number, h:number}[]} */
    function rects() {
      const m = clamp(Math.min(s.W, s.H) * 0.05, 12, 48);
      if (s.layout !== 1) return [{ x: m, y: m, w: s.W - 2 * m, h: s.H - 2 * m }];
      const side = clamp(Math.min(s.W, s.H) * 0.55, 220, 520);
      const cols = Math.max(1, Math.round(s.W / (side * 1.3)));
      const rows = Math.max(cols > 1 ? 1 : 2, Math.round(s.H / side));
      const cw = (s.W - m * (cols + 1)) / cols, ch = (s.H - m * (rows + 1)) / rows;
      /** @type {{x:number, y:number, w:number, h:number}[]} */
      const out = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) out.push({ x: m + c * (cw + m), y: m + r * (ch + m), w: cw, h: ch });
      }
      return out;
    }

    /** @param {Court} c @param {number} [toward] side the serve heads for */
    function serve(c, toward) {
      c.bx = c.w / 2; c.by = c.h / 2;
      c.speed = c.base;
      const sides = c.pads.map((p) => p.side);
      const to = toward ?? sides[rng.int(sides.length)];
      const a = (rng.random() - 0.5) * 0.9;
      const dir = to === 0 ? Math.PI : to === 1 ? 0 : to === 2 ? -Math.PI / 2 : Math.PI / 2;
      c.vx = Math.cos(dir + a) * c.speed; c.vy = Math.sin(dir + a) * c.speed;
      c.wait = 0.9;
      c.trail.length = 0;
      aim(c);
    }

    /** Re-rolls each paddle's aiming error: mostly on target, sometimes a miss. @param {Court} c */
    function aim(c) {
      for (const p of c.pads) {
        p.err = rng.random() < 0.16
          ? (rng.random() < 0.5 ? -1 : 1) * (c.len * (0.62 + rng.random() * 0.3) + c.r * 2)
          : (rng.random() - 0.5) * c.len * 0.7;
      }
    }

    /** Folds a coordinate into [lo, hi] the way a ball bouncing between two walls does.
     * @param {number} v @param {number} lo @param {number} hi @returns {number} */
    function fold(v, lo, hi) {
      const span = hi - lo;
      if (span <= 0) return lo;
      let u = (v - lo) % (2 * span);
      if (u < 0) u += 2 * span;
      return lo + (u > span ? 2 * span - u : u);
    }

    /** @param {{x:number, y:number, w:number, h:number}} r @returns {Court} */
    function court(r) {
      const sides = /** @type {Side[]} */ (s.layout === 2 ? [0, 1, 2, 3] : [0, 1]);
      const small = Math.min(r.w, r.h);
      const base = clamp(Math.hypot(r.w, r.h) * 0.2, 90, 340);
      /** @type {Court} */
      const c = {
        ...r, bx: 0, by: 0, vx: 0, vy: 0, speed: base, base, wait: 0, trail: [],
        r: clamp(small * 0.016, 3.5, 9), len: clamp(small * 0.17, 34, 130), thick: 0,
        pads: sides.map((side, i) => ({ side, pos: 0, target: 0, err: 0, c: i % nc, score: 0 })),
      };
      c.thick = c.r * 1.7;
      for (const p of c.pads) p.pos = p.target = (p.side < 2 ? c.h : c.w) / 2;
      serve(c);
      return c;
    }

    /** @param {Court} c @param {number} dt */
    function tick(c, dt) {
      const { r, len, thick } = c;
      const inset = thick * 1.6;
      // Paddles glide toward where the ball will cross their wall, or back to the middle.
      for (const p of c.pads) {
        const along = p.side < 2 ? c.h : c.w;
        const toward = [c.vx < 0, c.vx > 0, c.vy < 0, c.vy > 0][p.side];
        if (toward && c.wait <= 0) {
          if (p.side < 2) {
            const px = p.side === 0 ? inset + thick + r : c.w - inset - thick - r;
            p.target = fold(c.by + c.vy * (px - c.bx) / c.vx, r, c.h - r) + p.err;
          } else {
            const py = p.side === 2 ? inset + thick + r : c.h - inset - thick - r;
            p.target = fold(c.bx + c.vx * (py - c.by) / c.vy, r, c.w - r) + p.err;
          }
        } else p.target = along / 2;
        p.target = clamp(p.target, len / 2, along - len / 2);
        const max = c.speed * 0.85 * dt;
        p.pos += clamp(p.target - p.pos, -max, max);
      }
      if (c.wait > 0) { c.wait -= dt; return; }
      c.bx += c.vx * dt; c.by += c.vy * dt;
      /** @type {Side[]} */
      const open = [0, 1, 2, 3];
      for (const p of c.pads) {
        open.splice(open.indexOf(p.side), 1);
        const vert = p.side < 2;
        const plane = p.side === 0 ? inset + thick : p.side === 1 ? c.w - inset - thick
          : p.side === 2 ? inset + thick : c.h - inset - thick;
        const v = vert ? c.vx : c.vy;
        const b = vert ? c.bx : c.by;
        const near = p.side % 2 === 0;
        const crossing = near ? v < 0 && b - r < plane && b - r > plane - thick - Math.abs(v * dt)
          : v > 0 && b + r > plane && b + r < plane + thick + Math.abs(v * dt);
        if (!crossing) continue;
        const off = (vert ? c.by : c.bx) - p.pos;
        if (Math.abs(off) > len / 2 + r) continue;
        // A hit: the further from the paddle's middle, the steeper it leaves.
        c.speed = Math.min(c.base * 1.6, c.speed * 1.04);
        const a = clamp(off / (len / 2), -1, 1) * 0.9;
        const out = near ? 1 : -1;
        if (vert) { c.vx = Math.cos(a) * c.speed * out; c.vy = Math.sin(a) * c.speed; c.bx = plane + out * r; }
        else { c.vy = Math.cos(a) * c.speed * out; c.vx = Math.sin(a) * c.speed; c.by = plane + out * r; }
        aim(c);
      }
      // Bare walls bounce; a ball past a paddle's wall is a point.
      for (const side of open) {
        if (side === 0 && c.bx < r && c.vx < 0) { c.bx = r; c.vx = -c.vx; }
        if (side === 1 && c.bx > c.w - r && c.vx > 0) { c.bx = c.w - r; c.vx = -c.vx; }
        if (side === 2 && c.by < r && c.vy < 0) { c.by = r; c.vy = -c.vy; }
        if (side === 3 && c.by > c.h - r && c.vy > 0) { c.by = c.h - r; c.vy = -c.vy; }
      }
      const out = c.bx < -r * 2 ? 0 : c.bx > c.w + r * 2 ? 1 : c.by < -r * 2 ? 2 : c.by > c.h + r * 2 ? 3 : -1;
      if (out >= 0) {
        for (const p of c.pads) if (p.side !== out) p.score++;
        if (c.pads.some((p) => p.score > 9)) for (const p of c.pads) p.score = 0;
        serve(c, out);
      }
    }

    /** @param {number} dt */
    function advance(dt) {
      const n = Math.ceil(dt / (1 / 60));
      for (const c of courts) {
        for (let i = 0; i < n; i++) tick(c, dt / n);
        if (c.wait <= 0) {
          c.trail.push(c.bx, c.by);
          if (c.trail.length > TRAIL * 2) c.trail.splice(0, 2);
        }
      }
    }

    /** @param {number} n @param {number} x @param {number} y @param {number} px */
    function digits(n, x, y, px) {
      const { ctx } = s;
      const row = DIGITS[n % 10];
      for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 3; i++) if (row[j] & (4 >> i)) ctx.rect(x + i * px, y + j * px, px, px);
      }
    }

    return {
      lay() {
        const rs = rects();
        const fresh = rs.length !== courts.length;
        const old = courts;
        courts = rs.map((r, i) => {
          const c = court(r);
          const o = old[i];
          if (fresh || !o) return c;
          // Same courts at a new size: keep the rally where it is, scaled.
          const fx = c.w / o.w, fy = c.h / o.h;
          c.bx = o.bx * fx; c.by = o.by * fy; c.vx = o.vx * fx; c.vy = o.vy * fy;
          c.speed = Math.hypot(c.vx, c.vy) || c.base; c.wait = o.wait;
          c.pads.forEach((p, k) => { p.score = o.pads[k].score; p.err = o.pads[k].err;
            p.pos = o.pads[k].pos * (p.side < 2 ? fy : fx); });
          return c;
        });
        // A first frame mid-rally, with a trail behind the ball.
        if (fresh) for (let i = 0; i < 40; i++) advance(1 / 30);
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        const lineA = s.dark ? 0.2 : 0.26;
        for (const c of courts) {
          ctx.save();
          ctx.translate(c.x, c.y);
          const inset = c.thick * 1.6;
          // Net: a dashed line across the middle, or a dashed ring for four players.
          ctx.globalAlpha = lineA;
          ctx.fillStyle = s.ink;
          ctx.beginPath();
          const dash = c.r * 1.2;
          if (s.layout === 2) {
            const R = Math.min(c.w, c.h) * 0.16;
            const k = Math.max(12, Math.round(TAU * R / (dash * 3)));
            for (let i = 0; i < k; i++) {
              const a = (i / k) * TAU;
              ctx.rect(c.w / 2 + Math.cos(a) * R - dash / 2, c.h / 2 + Math.sin(a) * R - dash / 2, dash, dash);
            }
          } else {
            for (let y = dash; y < c.h; y += dash * 3) ctx.rect(c.w / 2 - dash / 2, y, dash, dash * 1.6);
          }
          ctx.fill();
          // Walls without paddles, as lines.
          ctx.strokeStyle = s.ink;
          ctx.lineWidth = 2;
          if (s.layout !== 2) {
            ctx.beginPath();
            ctx.moveTo(0, 1); ctx.lineTo(c.w, 1); ctx.moveTo(0, c.h - 1); ctx.lineTo(c.w, c.h - 1);
            ctx.stroke();
            // Scores, one each side of the net.
            const px = clamp(Math.min(c.w, c.h) * 0.022, 4, 12);
            ctx.globalAlpha = lineA * 0.9;
            ctx.beginPath();
            digits(c.pads[0].score, c.w / 2 - px * 7, px * 3, px);
            digits(c.pads[1].score, c.w / 2 + px * 4, px * 3, px);
            ctx.fill();
          }
          // Paddles.
          for (const p of c.pads) {
            ctx.globalAlpha = s.dark ? 0.5 : 0.55;
            ctx.fillStyle = s.colors[p.c];
            const a = p.pos - c.len / 2;
            if (p.side === 0) ctx.fillRect(inset, a, c.thick, c.len);
            else if (p.side === 1) ctx.fillRect(c.w - inset - c.thick, a, c.thick, c.len);
            else if (p.side === 2) ctx.fillRect(a, inset, c.len, c.thick);
            else ctx.fillRect(a, c.h - inset - c.thick, c.len, c.thick);
          }
          // Ball and its fading trail.
          const bc = s.colors[(c.pads.length) % nc];
          ctx.fillStyle = bc;
          const t = c.trail;
          for (let i = 0; i < t.length - 2; i += 2) {
            const u = (i / 2 + 1) / (t.length / 2);
            const d = c.r * (0.5 + 0.5 * u);
            ctx.globalAlpha = 0.22 * u;
            ctx.fillRect(t[i] - d, t[i + 1] - d, d * 2, d * 2);
          }
          ctx.globalAlpha = s.dark ? 0.62 : 0.66;
          ctx.fillRect(c.bx - c.r, c.by - c.r, c.r * 2, c.r * 2);
          ctx.restore();
        }
      },
    };
  });
}
