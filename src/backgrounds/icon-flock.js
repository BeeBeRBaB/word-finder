// Flock: the subject's icons flock like birds (boids), each keeping its distance from the
// nearest, matching their heading and drawing toward their middle, while the flock follows a
// slowly wandering lead. The seed picks the variant: one big flock; two or three flocks of one
// icon each that weave through one another; or one flock that parts round the hero, a larger
// icon cruising after it.

import { iconStage } from './icon-stage.js';
import { TAU, clamp } from './stage.js';

/** @typedef {{k:number, f:number, x:number, y:number, vx:number, vy:number, dir:number}} Boid
 * A flier: flock f, centre x, y and velocity in CSS px, and the way it faces (dir), which turns
 * only once it is clearly heading the other way. */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    const flocks = layout === 1 ? 2 + rng.int(2) : 1;
    const ph = Array.from({ length: flocks * 2 }, () => rng.random() * TAU);
    const k0 = rng.int(s.n);
    /** @type {Boid[]} */
    let boids = [];
    /** @type {Boid} */
    const hawk = { k: 0, f: -1, x: 0, y: 0, vx: 0, vy: 0, dir: 1 };
    let size = 30, vmax = 50, lastW = 0, lastH = 0;

    /** Where flock f is heading now: a slow loop over the host. @param {number} f @returns {number[]} */
    const lead = (f) => [
      s.W * (0.5 + 0.34 * Math.sin(s.t * 0.05 + ph[f * 2]) * (1 + 0.2 * Math.sin(s.t * 0.013))),
      s.H * (0.5 + 0.34 * Math.sin(s.t * 0.071 + ph[f * 2 + 1])),
    ];

    /** @param {number} dt @returns {void} */
    function step(dt) {
      const { W, H } = s;
      const see = size * 4, gap = size * 1.75, edge = size * 1.5;
      const leads = Array.from({ length: flocks }, (_, f) => lead(f));
      for (const b of boids) {
        let ax = 0, ay = 0, n = 0, mx = 0, my = 0, mvx = 0, mvy = 0;
        for (const o of boids) {
          if (o === b) continue;
          const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy);
          if (d > see || d === 0) continue;
          if (d < gap) { const push = (1 - d / gap) * vmax * 5; ax += dx / d * push; ay += dy / d * push; }
          if (o.f !== b.f) continue;
          n++; mx += o.x; my += o.y; mvx += o.vx; mvy += o.vy;
        }
        if (n) {
          ax += (mvx / n - b.vx) * 1.1 + (mx / n - b.x) * 0.18;
          ay += (mvy / n - b.vy) * 1.1 + (my / n - b.y) * 0.18;
        }
        const [tx, ty] = leads[b.f];
        ax += (tx - b.x) * 0.03; ay += (ty - b.y) * 0.03;
        if (layout === 2) {
          const dx = b.x - hawk.x, dy = b.y - hawk.y, d = Math.hypot(dx, dy), fear = size * 4.5;
          if (d < fear && d > 0) { const f = (1 - d / fear) * vmax * 6; ax += dx / d * f; ay += dy / d * f; }
        }
        // Soft walls: turn back in before leaving the host.
        if (b.x < edge) ax += (edge - b.x) * 2; else if (b.x > W - edge) ax -= (b.x - W + edge) * 2;
        if (b.y < edge) ay += (edge - b.y) * 2; else if (b.y > H - edge) ay -= (b.y - H + edge) * 2;
        b.vx += ax * dt; b.vy += ay * dt;
        const v = Math.hypot(b.vx, b.vy) || 1, c = clamp(v, vmax * 0.55, vmax) / v;
        b.vx *= c; b.vy *= c;
      }
      for (const b of boids) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (Math.abs(b.vx) > vmax * 0.25) b.dir = Math.sign(b.vx);
      }
      if (layout === 2) {
        // The hero cruises after the flock's middle, a little slower than it and slow to turn.
        let mx = 0, my = 0;
        for (const b of boids) { mx += b.x; my += b.y; }
        mx /= boids.length; my /= boids.length;
        const dx = mx - hawk.x, dy = my - hawk.y, d = Math.hypot(dx, dy) || 1;
        hawk.vx += (dx / d * vmax * 0.72 - hawk.vx) * Math.min(1, 0.6 * dt);
        hawk.vy += (dy / d * vmax * 0.72 - hawk.vy) * Math.min(1, 0.6 * dt);
        hawk.x += hawk.vx * dt; hawk.y += hawk.vy * dt;
        if (Math.abs(hawk.vx) > vmax * 0.2) hawk.dir = Math.sign(hawk.vx);
      }
    }

    /** @param {Boid} b @param {number} sz @param {number} alpha @returns {void} */
    const fly = (b, sz, alpha) => {
      // Bank toward the heading, mirrored for one facing left.
      const tilt = clamp(Math.atan2(b.vy, Math.abs(b.vx) + 1e-6), -0.7, 0.7) * b.dir;
      s.icon(b.k, b.x, b.y, sz, tilt, alpha, b.dir);
    };

    return {
      lay() {
        const { W, H } = s;
        size = clamp(Math.min(W, H) * 0.056, 24, 46);
        vmax = size * 1.9;
        if (!boids.length) {
          const n = clamp(Math.round(W * H / (size * size * 16)), 18, 44);
          for (let i = 0; i < n; i++) {
            const f = i % flocks, [tx, ty] = lead(f), a = ph[f] + (rng.random() - 0.5);
            boids.push({
              k: layout === 1 ? k0 + f : layout === 2 && s.n > 1 ? 1 + (k0 + i) % (s.n - 1) : k0 + i, f,
              x: tx + (rng.random() - 0.5) * W * 0.4, y: ty + (rng.random() - 0.5) * H * 0.4,
              vx: Math.cos(a) * vmax * 0.8, vy: Math.sin(a) * vmax * 0.8, dir: 1,
            });
          }
          hawk.x = W * 0.1; hawk.y = H * 0.9;
          // Fly a few seconds so the first paint is already a flock.
          for (let i = 0; i < 150; i++) { s.t += 1 / 30; step(1 / 30); }
          s.t = 0;
        } else if (lastW && lastH) {
          for (const b of [...boids, hawk]) { b.x *= W / lastW; b.y *= H / lastH; }
        }
        lastW = W; lastH = H;
      },
      step,
      draw() {
        for (const b of boids) fly(b, size, 0.5);
        if (layout === 2) fly(hawk, size * 1.8, 0.58);
      },
    };
  });
}
