// Breakout: a self-playing brick-breaker in the look's colours. The paddle steers the ball at the
// bricks that are left, so the wall clears, then rebuilds brick by brick and play goes on. The
// seed picks the variant: a classic wall across the top with one ball, a diamond of bricks in the
// middle worked from above and below by two paddles and two balls, or a wall turned on its side
// with the paddle at the left keeping three balls in play.

import { stage, clamp } from './stage.js';

/** @typedef {{x:number, y:number, vx:number, vy:number, wait:number, trail:number[], p:Paddle|null, off:number}} Ball
 * p is the paddle it rests on while waiting to be served, off where on it. */
/** @typedef {{y:number, dir:number, pos:number, aim:number}} Paddle
 * A paddle on the line y, met by balls moving in `dir` (+1 down, -1 up); aim is the point on it,
 * from its middle, it means to meet the ball with. */

const TRAIL = 5;
const STEER = 1.05; // the steepest bounce off a paddle's end, radians from straight

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    const side = s.layout === 2;
    // The game runs in a frame with the paddle along the bottom; turned, for the side variant.
    let w = 0, h = 0, r = 4, len = 60, thick = 8, bw = 40, bh = 16, gx = 0, gy = 0, cols = 0, rows = 0;
    let speed = 200, rebuild = -1, clock = 0, lastHit = 0;
    /** Bricks: 1 standing, 0 not; a is drawn alpha easing toward it. @type {Uint8Array} */
    let on = new Uint8Array(0);
    /** @type {Float32Array} */
    let a = new Float32Array(0);
    /** Where each brick belongs in the pattern. @type {Uint8Array} */
    let shape = new Uint8Array(0);
    /** @type {Ball[]} */
    let balls = [];
    /** @type {Paddle[]} */
    let pads = [];

    /** @param {Ball} b @param {Paddle} p */
    function launch(b, p) {
      b.p = p; b.off = (rng.random() - 0.5) * len * 0.5;
      b.x = p.pos + b.off;
      b.y = p.y - p.dir * (thick / 2 + r + 1);
      const t = (rng.random() - 0.5) * 1.2;
      b.vx = Math.sin(t) * speed; b.vy = -p.dir * Math.cos(t) * speed;
      b.wait = 0.8; b.trail.length = 0;
    }

    /** Where the ball meets y, folded off the side walls, and how long until then.
     * @param {Ball} b @param {number} y @returns {[number, number]} */
    function meet(b, y) {
      const t = (y - b.y) / b.vy;
      const span = w - 2 * r;
      let u = (b.x - r + b.vx * t) % (2 * span);
      if (u < 0) u += 2 * span;
      return [r + (u > span ? 2 * span - u : u), t];
    }

    /** A paddle picks the next ball to reach it and the brick to send it at. @param {Paddle} p */
    function plan(p) {
      let best = Infinity, at = w / 2;
      for (const b of balls) {
        if (b.wait > 0 || Math.sign(b.vy) !== p.dir) continue;
        const [x, t] = meet(b, p.y - p.dir * (thick / 2 + r));
        if (t < best) { best = t; at = x; }
      }
      if (best === Infinity) { p.aim = 0; return w / 2; }
      // Off-centre hits leave at an angle: choose the angle that heads for a standing brick.
      const goal = target(at, p);
      const want = Math.atan2(goal[0] - at, Math.abs(goal[1] - p.y));
      p.aim = clamp(want / STEER, -0.9, 0.9) * len / 2;
      return at - p.aim;
    }

    /** A standing brick for paddle p to aim at, stable for a while. @param {number} at @param {Paddle} p
     * @returns {[number, number]} */
    function target(at, p) {
      const seed = Math.floor(s.t / 4) * 7 + (p.dir > 0 ? 0 : 3);
      let best = -1, score = -Infinity;
      for (let i = 0; i < on.length; i++) {
        if (!on[i]) continue;
        const x = gx + (i % cols + 0.5) * bw, y = gy + (Math.floor(i / cols) + 0.5) * bh;
        // Prefer near and reachable bricks, with a shuffle so the ball wanders.
        const k = -Math.abs(x - at) / w - Math.abs(y - p.y) / h * 0.3 + hash(i + seed) * 0.6;
        if (k > score) { score = k; best = i; }
      }
      if (best < 0) return [w / 2, h / 2];
      return [gx + (best % cols + 0.5) * bw, gy + (Math.floor(best / cols) + 0.5) * bh];
    }

    /** The standing brick under the ball's box, or -1. @param {Ball} b @returns {number} */
    function hit(b) {
      const c0 = Math.floor((b.x - r - gx) / bw), c1 = Math.floor((b.x + r - gx) / bw);
      const r0 = Math.floor((b.y - r - gy) / bh), r1 = Math.floor((b.y + r - gy) / bh);
      for (let y = Math.max(0, r0); y <= Math.min(rows - 1, r1); y++) {
        for (let x = Math.max(0, c0); x <= Math.min(cols - 1, c1); x++) {
          const i = y * cols + x;
          if (on[i] && a[i] > 0.9) return i;
        }
      }
      return -1;
    }

    /** @param {Ball} b @param {number} dt */
    function move(b, dt) {
      if (b.wait > 0) {
        b.wait -= dt;
        if (b.p) b.x = b.p.pos + b.off;
        return;
      }
      // One axis at a time, so a brick knows which face was struck.
      b.x += b.vx * dt;
      let i = hit(b);
      if (i >= 0) { on[i] = 0; lastHit = clock; b.x -= b.vx * dt; b.vx = -b.vx; }
      if (b.x < r && b.vx < 0) { b.x = r; b.vx = -b.vx; }
      if (b.x > w - r && b.vx > 0) { b.x = w - r; b.vx = -b.vx; }
      b.y += b.vy * dt;
      i = hit(b);
      if (i >= 0) { on[i] = 0; lastHit = clock; b.y -= b.vy * dt; b.vy = -b.vy; }
      if (pads.length === 1 && b.y < r && b.vy < 0) { b.y = r; b.vy = -b.vy; }
      for (const p of pads) {
        const face = p.y - p.dir * thick / 2;
        const edge = b.y + p.dir * r;
        if (Math.sign(b.vy) !== p.dir || (edge - face) * p.dir < 0 || (edge - face) * p.dir > thick + Math.abs(b.vy * dt)) continue;
        const off = b.x - p.pos;
        if (Math.abs(off) > len / 2 + r) continue;
        const t = clamp(off / (len / 2), -1, 1) * STEER;
        b.vx = Math.sin(t) * speed; b.vy = -p.dir * Math.cos(t) * speed;
        b.y = face - p.dir * r;
      }
      // Lost past a paddle: it comes back from that paddle shortly.
      for (const p of pads) if ((b.y - p.y) * p.dir > r * 4) launch(b, p);
    }

    /** @param {number} dt */
    function advance(dt) {
      const n = Math.ceil(dt * speed / Math.max(2, r * 0.8));
      for (let k = 0; k < n; k++) {
        for (const p of pads) {
          const want = clamp(plan(p), len / 2, w - len / 2);
          const max = speed * 0.9 * dt / n;
          p.pos += clamp(want - p.pos, -max, max);
        }
        for (const b of balls) move(b, dt / n);
      }
      for (const b of balls) {
        if (b.wait > 0) continue;
        b.trail.push(b.x, b.y);
        if (b.trail.length > TRAIL * 2) b.trail.splice(0, 2);
      }
      for (let i = 0; i < a.length; i++) {
        const goal = on[i];
        if (a[i] !== goal) a[i] = goal ? Math.min(1, a[i] + dt * 1.5) : Math.max(0, a[i] - dt * 2.5);
      }
      // Cleared, or down to a few hard-to-reach bricks: the wall comes back a row at a time.
      clock += dt;
      if (rebuild < 0) {
        let left = 0, all = 0;
        for (let i = 0; i < on.length; i++) { left += on[i]; all += shape[i]; }
        if (!left || (clock - lastHit > 12 && left < all * 0.3)) rebuild = left ? 1.2 : 0;
      }
      if (rebuild >= 0) {
        rebuild += dt;
        const upTo = (rebuild - 1.2) / 0.35;
        for (let i = 0; i < on.length; i++) {
          const row = Math.floor(i / cols);
          if (shape[i] && !on[i] && (pads.length > 1 ? Math.abs(row - (rows - 1) / 2) : rows - 1 - row) < upTo + 0.5) {
            const x = gx + (i % cols + 0.5) * bw, y = gy + (row + 0.5) * bh;
            if (!balls.some((b) => Math.abs(b.x - x) < bw && Math.abs(b.y - y) < bh * 1.5)) on[i] = 1;
          }
        }
        if (upTo > rows + 1) rebuild = -1;
      }
    }

    function build() {
      const m = Math.min(s.W, s.H);
      w = side ? s.H : s.W; h = side ? s.W : s.H;
      r = clamp(m * 0.012, 3.5, 8);
      thick = r * 1.6;
      len = clamp(m * 0.13, 44, 120);
      speed = clamp(m * 0.42, 150, 330);
      bw = clamp(m * 0.085, 34, 84); bh = Math.round(bw * 0.42);
      const margin = clamp(m * 0.04, 10, 40);
      cols = Math.max(4, Math.floor((w - 2 * margin) / bw));
      bw = (w - 2 * margin) / cols;
      gx = margin;
      if (s.layout === 1) {
        rows = clamp(Math.floor(h * 0.42 / bh) | 1, 5, 13);
        gy = (h - rows * bh) / 2;
      } else {
        rows = clamp(Math.floor(h * 0.3 / bh), 4, side ? 6 : 7);
        gy = margin * 1.5;
      }
      shape = new Uint8Array(cols * rows);
      for (let i = 0; i < shape.length; i++) {
        const x = (i % cols + 0.5) / cols * 2 - 1, y = (Math.floor(i / cols) + 0.5) / rows * 2 - 1;
        shape[i] = s.layout === 1 ? (Math.abs(x) + Math.abs(y) <= 1.08 ? 1 : 0) : 1;
      }
      on = shape.slice();
      // A game already under way: a few bricks knocked out of the lower rows.
      for (let i = 0; i < on.length; i++) if (on[i] && rng.random() < 0.18 * (Math.floor(i / cols) / rows + 0.3)) on[i] = 0;
      a = Float32Array.from(on);
      const py = h - margin * 1.5;
      pads = [{ y: py, dir: 1, pos: w / 2, aim: 0 }];
      if (s.layout === 1) pads.push({ y: h - py, dir: -1, pos: w / 2, aim: 0 });
      balls = [];
      const nb = s.layout === 2 ? 3 : s.layout === 1 ? 2 : 1;
      for (let k = 0; k < nb; k++) {
        /** @type {Ball} */
        const b = { x: 0, y: 0, vx: 0, vy: 0, wait: 0, trail: [], p: null, off: 0 };
        launch(b, pads[k % pads.length]);
        b.wait = k * 1.1;
        balls.push(b);
      }
      rebuild = -1; lastHit = clock;
      for (let k = 0; k < 60; k++) advance(1 / 30);
    }

    return {
      lay() {
        const nw = side ? s.H : s.W, nh = side ? s.W : s.H;
        if (Math.abs(nw - w) < 1 && Math.abs(nh - h) < 1) return;
        build();
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        ctx.save();
        if (side) ctx.transform(0, 1, -1, 0, s.W, 0);
        // Bricks, one colour per row, with a gap between.
        const gap = Math.max(1.5, bh * 0.14);
        for (let y = 0; y < rows; y++) {
          ctx.fillStyle = s.colors[y % nc];
          for (let x = 0; x < cols; x++) {
            const v = a[y * cols + x];
            if (v <= 0.01) continue;
            ctx.globalAlpha = (s.dark ? 0.36 : 0.42) * v;
            ctx.fillRect(gx + x * bw + gap / 2, gy + y * bh + gap / 2, bw - gap, bh - gap);
          }
        }
        // Paddles.
        ctx.fillStyle = s.ink;
        ctx.globalAlpha = s.dark ? 0.5 : 0.55;
        for (const p of pads) ctx.fillRect(p.pos - len / 2, p.y - thick / 2, len, thick);
        // Balls, each with a short fading trail.
        for (let k = 0; k < balls.length; k++) {
          const b = balls[k];
          ctx.fillStyle = s.colors[(k + 2) % nc];
          const t = b.trail;
          for (let i = 0; i < t.length - 2; i += 2) {
            const u = (i / 2 + 1) / (t.length / 2);
            ctx.globalAlpha = 0.22 * u;
            ctx.beginPath(); ctx.arc(t[i], t[i + 1], r * (0.5 + 0.5 * u), 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = b.wait > 0 ? 0.62 * clamp(1 - b.wait / 0.8, 0.2, 1) : 0.62;
          ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      },
    };
  });
}

/** A steady pseudo-random 0..1 for an integer. @param {number} n @returns {number} */
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
