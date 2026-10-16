// Billiards: the subject's icons slide like balls on a table, colliding elastically off each
// other and the cushions, spun a little by glancing hits. The seed picks the variant: a table
// of equal balls that never stops; a break, where the hero is shot into a racked triangle, all
// roll to rest and are racked again; or balls of mixed sizes, the big ones heavy and slow.

import { iconStage } from './icon-stage.js';
import { TAU, clamp } from './stage.js';
import { roundRect } from './shapes.js';

/** @typedef {{k:number, x:number, y:number, vx:number, vy:number, r:number, m:number, rot:number, w:number,
 *   sx:number, sy:number, tx:number, ty:number}} Ball
 * A ball: centre x, y and velocity in CSS px; radius r and mass m; turn rot and spin w. sx, sy is
 * where a re-rack (layout 1) starts it from and tx, ty where it goes. */

/** @param {number} u @returns {number} */
const ease = (u) => u * u * (3 - 2 * u);

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Ball[]} */
    let balls = [];
    let size = 40, pad = 0, lastW = 0, lastH = 0;
    let phase = 'roll', clock = 0;   // layout 1: roll, rest, gather, aim
    let broke = false;               // layout 1: the cue ball has reached the rack this shot
    const k0 = layout === 1 ? 0 : rng.int(s.n);   // the break's cue ball is the hero

    /** @param {number} r @returns {Ball} */
    const ball = (r) => ({ k: k0 + balls.length, x: 0, y: 0, vx: 0, vy: 0, r, m: r * r, rot: rng.random() * 6, w: 0, sx: 0, sy: 0, tx: 0, ty: 0 });

    /** Layout 1: where each ball sits in the rack, the cue ball (index 0) behind it. @returns {void} */
    function rack() {
      const { W, H } = s;
      const wide = W >= H;
      const d = size * 0.96;
      const lead = wide ? W * 0.55 : H * 0.42;   // the rack's apex
      let i = 1;
      for (let row = 0; i < balls.length; row++) {
        for (let c = 0; c <= row && i < balls.length; c++, i++) {
          const along = row * d * 0.866, across = (c - row / 2) * d;
          const b = balls[i];
          b.tx = wide ? lead + along : W / 2 + across;
          b.ty = wide ? H / 2 + across : lead - along;
        }
      }
      balls[0].tx = wide ? W * 0.18 : W / 2;
      balls[0].ty = wide ? H / 2 : H * 0.84;
    }

    /** Layout 1: the cue ball sent at the rack's apex, a hair off line. @returns {void} */
    function shoot() {
      const c = balls[0], a = balls[1];
      const dx = a.x - c.x, dy = a.y - c.y + (rng.random() - 0.5) * size * 0.08;
      const v = size * 10 / Math.hypot(dx, dy);
      c.vx = dx * v; c.vy = dy * v;
      phase = 'roll'; clock = 0; broke = false;
    }

    /** Layout 1: the rack bursts apart as the cue ball meets it. A packed rack in plain physics
     * passes nearly all the blow to its back row, so each ball also gets a kick out from the
     * rack's centre. @returns {void} */
    function burst() {
      const c = balls[0];
      let mx = 0, my = 0;
      for (let i = 1; i < balls.length; i++) { mx += balls[i].x; my += balls[i].y; }
      mx /= balls.length - 1; my /= balls.length - 1;
      const v = Math.hypot(c.vx, c.vy) || 1, ux = c.vx / v, uy = c.vy / v;
      for (let i = 1; i < balls.length; i++) {
        const b = balls[i];
        const a = Math.atan2(b.y - my, b.x - mx) + (rng.random() - 0.5) * 0.8;
        const f = size * (2 + 3.5 * rng.random());
        b.vx += Math.cos(a) * f + ux * size * 0.6; b.vy += Math.sin(a) * f + uy * size * 0.6;
        b.w = (rng.random() - 0.5) * 3;
      }
      c.vx *= 0.3; c.vy *= 0.3;
      broke = true;
    }

    /** @param {number} dt @returns {void} */
    function physics(dt) {
      const { W, H } = s;
      for (const b of balls) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.rot += b.w * dt;
        const x0 = pad + b.r, x1 = W - pad - b.r, y0 = pad + b.r, y1 = H - pad - b.r;
        if (b.x < x0) { b.x = x0; b.vx = Math.abs(b.vx); b.w += b.vy / b.r * 0.2; }
        if (b.x > x1) { b.x = x1; b.vx = -Math.abs(b.vx); b.w -= b.vy / b.r * 0.2; }
        if (b.y < y0) { b.y = y0; b.vy = Math.abs(b.vy); b.w -= b.vx / b.r * 0.2; }
        if (b.y > y1) { b.y = y1; b.vy = -Math.abs(b.vy); b.w += b.vx / b.r * 0.2; }
      }
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j];
          const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          // Push apart by mass, then trade momentum along the line of centres.
          const over = min - d, ia = b.m / (a.m + b.m), ib = a.m / (a.m + b.m);
          a.x -= nx * over * ia; a.y -= ny * over * ia;
          b.x += nx * over * ib; b.y += ny * over * ib;
          const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (vn >= 0) continue;
          const jn = -2 * vn / (1 / a.m + 1 / b.m);
          a.vx -= jn * nx / a.m; a.vy -= jn * ny / a.m;
          b.vx += jn * nx / b.m; b.vy += jn * ny / b.m;
          const vt = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
          a.w += vt / a.r * 0.15; b.w += vt / b.r * 0.15;
        }
      }
    }

    /** @param {number} dt @returns {void} */
    function step(dt) {
      if (layout !== 1) {
        physics(dt);
        // Hold each ball near its cruising speed so the table neither stalls nor heats up.
        for (const b of balls) {
          const v = Math.hypot(b.vx, b.vy) || 1, want = size * 1.2 * clamp(size * 0.46 / b.r, 0.6, 1.5);
          const f = 1 + (want - v) / v * Math.min(1, 0.3 * dt);
          b.vx *= f; b.vy *= f;
          b.w *= 1 - 0.25 * dt;
        }
        return;
      }
      clock += dt;
      if (phase === 'roll') {
        if (!broke && Math.hypot(balls[1].x - balls[0].x, balls[1].y - balls[0].y) < size * 1.05) burst();
        physics(dt);
        let moving = false;
        for (const b of balls) {
          // Cloth friction: a steady drag plus a little in proportion to speed.
          const v = Math.hypot(b.vx, b.vy);
          const nv = Math.max(0, v - (size * 0.4 + v * 0.25) * dt);
          if (v > 0) { b.vx *= nv / v; b.vy *= nv / v; }
          b.w *= 1 - 0.8 * dt;
          if (nv > 0) moving = true;
          else b.w = 0;
        }
        if (!moving || clock > 14) { phase = 'rest'; clock = 0; }
      } else if (phase === 'rest' && clock > 2) {
        phase = 'gather'; clock = 0;
        rack();
        for (const b of balls) { b.sx = b.x; b.sy = b.y; b.vx = b.vy = 0; }
      } else if (phase === 'gather') {
        const u = ease(clamp(clock / 3, 0, 1));
        for (const b of balls) { b.x = b.sx + (b.tx - b.sx) * u; b.y = b.sy + (b.ty - b.sy) * u; }
        if (u >= 1) { phase = 'aim'; clock = 0; }
      } else if (phase === 'aim' && clock > 1) {
        shoot();
      }
    }

    return {
      lay() {
        const { W, H } = s;
        size = clamp(Math.min(W, H) * 0.075, 30, 60);
        pad = layout === 2 ? 0 : size * 0.4;
        if (!balls.length) {
          if (layout === 1) {
            const rows = clamp(Math.round(Math.sqrt(W * H) / (size * 3)), 3, 5);
            for (let i = 0; i < 1 + rows * (rows + 1) / 2; i++) balls.push(ball(size * 0.46));
            rack();
            for (const b of balls) { b.x = b.tx; b.y = b.ty; }
            shoot();
            // Start just after the break, the pack spreading.
            for (let i = 0; i < 150; i++) step(1 / 60);
          } else {
            const n = clamp(Math.round(W * H / (size * size * (layout === 2 ? 11 : 14))), 12, 40);
            for (let i = 0; i < n; i++) {
              const b = ball(size * (layout === 2 ? 0.28 + 0.42 * rng.random() ** 1.6 : 0.46));
              b.x = rng.random() * W; b.y = rng.random() * H;
              const a = rng.random() * TAU;
              b.vx = Math.cos(a) * size; b.vy = Math.sin(a) * size;
              balls.push(b);
            }
            // Settle the overlaps of the scatter before the first paint.
            for (let i = 0; i < 30; i++) physics(1 / 60);
          }
        } else if (lastW && lastH) {
          for (const b of balls) {
            b.x *= W / lastW; b.y *= H / lastH;
            b.sx *= W / lastW; b.sy *= H / lastH;
          }
          if (layout === 1 && phase !== 'roll') rack();
        }
        lastW = W; lastH = H;
      },
      step,
      draw() {
        const { ctx, W, H } = s;
        if (layout !== 2) {
          // The table: a cushion line and six pockets.
          ctx.strokeStyle = s.ink;
          ctx.fillStyle = s.ink;
          ctx.globalAlpha = 0.28;
          ctx.lineWidth = 3;
          ctx.beginPath();
          roundRect(ctx, pad * 0.5, pad * 0.5, W - pad, H - pad, size * 0.5);
          ctx.stroke();
          ctx.globalAlpha = 0.14;
          ctx.beginPath();
          const pr = size * 0.42, long = W >= H;
          for (const [px, py] of [[0, 0], [1, 0], [0, 1], [1, 1], long ? [0.5, 0] : [0, 0.5], long ? [0.5, 1] : [1, 0.5]]) {
            const x = pad * 0.5 + px * (W - pad), y = pad * 0.5 + py * (H - pad);
            ctx.moveTo(x + pr, y); ctx.arc(x, y, pr, 0, TAU);
          }
          ctx.fill();
        }
        for (const b of balls) s.icon(b.k, b.x, b.y, b.r * 2.2, b.rot, layout === 2 ? 0.4 + 0.25 * b.r / size : 0.52);
      },
    };
  });
}
