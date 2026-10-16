// Asteroids: wireframe rocks drift and slowly turn, wrapping round the edges; when two meet they
// split gently into smaller ones with a puff of grit, and fresh rocks drift in to keep the field
// full. The seed picks the variant: rocks alone, splitting on collision; rocks passing through each
// other while a little ship turns and picks them off; or three depths of rocks streaming one way.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, vx:number, vy:number, a:number, spin:number, size:number, R:number,
 *   shape:number[], c:number, z:number, fade:number, life:number}} Rock
 * size 3 big .. 1 small; R its radius; shape the radius of each vertex as a share of R; z the depth
 * (1 nearest); fade 0..1 drawn alpha; life seconds a small rock has left, Infinity for the rest. */
/** @typedef {{x:number, y:number, vx:number, vy:number, t:number, c:number}} Grit */

const SPLIT = [0, 0, 0.58, 0.55]; // a child's radius as a share of its parent's, by parent size

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    const ship = s.layout === 1;
    const layered = s.layout === 2;
    let big = 60, target = 6, speed = 20, flow = 0;
    /** @type {Rock[]} */
    let rocks = [];
    /** @type {Grit[]} */
    let grit = [];
    const me = { x: 0, y: 0, vx: 0, vy: 0, a: 0, cool: 1 };
    /** @type {{x:number, y:number, vx:number, vy:number, t:number}[]} */
    let shots = [];

    /** @param {number} size @param {number} z @param {number} x @param {number} y @returns {Rock} */
    function rock(size, z, x, y) {
      const n = 9 + rng.int(4);
      const shape = [];
      // Lumpy, with the odd deep notch, like the arcade rocks.
      for (let i = 0; i < n; i++) shape.push(rng.random() < 0.2 ? 0.5 + rng.random() * 0.12 : 0.74 + rng.random() * 0.26);
      const v = speed * (0.6 + rng.random() * 0.8) * (4 - size) ** 0.35 * (layered ? 0.4 + 0.6 * z : 1);
      const dir = layered ? flow + (rng.random() - 0.5) * 0.5 : rng.random() * TAU;
      return {
        x, y, vx: Math.cos(dir) * v, vy: Math.sin(dir) * v, a: rng.random() * TAU,
        spin: (rng.random() - 0.5) * 0.6, size, R: big * [0, 0.3, 0.55, 1][size] * (layered ? 0.45 + 0.55 * z : 1),
        shape, c: rng.int(nc), z, fade: 0, life: size === 1 ? 25 + rng.random() * 20 : Infinity,
      };
    }

    /** How much rock there is, a big one counting 4. @returns {number} */
    const mass = () => rocks.reduce((m, r) => m + (r.life < 3 ? 0 : [0, 1, 2, 4][r.size]), 0);

    /** A big rock drifting in from just beyond an edge. */
    function arrive() {
      const z = layered ? [0.25, 0.6, 1][rng.int(3)] : 1;
      const r = rock(3, z, 0, 0);
      const m = r.R + 4;
      // From the edge it heads away from, so it drifts on screen.
      if (Math.abs(r.vx) > Math.abs(r.vy)) { r.x = r.vx > 0 ? -m : s.W + m; r.y = rng.random() * s.H; }
      else { r.y = r.vy > 0 ? -m : s.H + m; r.x = rng.random() * s.W; }
      rocks.push(r);
    }

    /** Splits a rock in two, flying apart across the line it was struck along.
     * @param {Rock} r @param {number} nx @param {number} ny unit normal of the blow */
    function split(r, nx, ny) {
      puff(r.x, r.y, r.c, r.size * 3);
      if (r.size === 1) { r.life = 0; r.fade = 0; return; }
      const kick = speed * 0.7;
      for (const k of [-1, 1]) {
        const c = rock(r.size - 1, r.z, r.x - ny * k * r.R * 0.35, r.y + nx * k * r.R * 0.35);
        c.R = r.R * SPLIT[r.size];
        c.vx = r.vx * 0.8 - ny * k * kick + nx * kick * 0.3;
        c.vy = r.vy * 0.8 + nx * k * kick + ny * kick * 0.3;
        c.c = r.c; c.fade = 1;
        rocks.push(c);
      }
      r.life = 0; r.fade = 0;
    }

    /** @param {number} x @param {number} y @param {number} c @param {number} n */
    function puff(x, y, c, n) {
      for (let i = 0; i < n; i++) {
        const a = rng.random() * TAU, v = 10 + rng.random() * 30;
        grit.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, c });
      }
    }

    /** @param {number} dt */
    function advance(dt) {
      for (const r of rocks) {
        r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.spin * dt;
        r.life -= dt;
        r.fade = r.life < 2 ? Math.max(0, r.life / 2) : Math.min(1, r.fade + dt * 0.8);
        const m = r.R + 4;
        if (r.x < -m) r.x += s.W + 2 * m; else if (r.x > s.W + m) r.x -= s.W + 2 * m;
        if (r.y < -m) r.y += s.H + 2 * m; else if (r.y > s.H + m) r.y -= s.H + 2 * m;
      }
      // Collisions, between rocks at the same depth that are closing on each other.
      if (!ship) {
        const n = rocks.length;
        for (let i = 0; i < n; i++) {
          const p = rocks[i];
          if (p.life <= 0 || p.fade < 1) continue;
          for (let j = i + 1; j < n; j++) {
            const q = rocks[j];
            if (q.life <= 0 || q.fade < 1 || q.z !== p.z) continue;
            const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), reach = (p.R + q.R) * 0.86;
            if (d >= reach || d === 0) continue;
            const nx = dx / d, ny = dy / d;
            const closing = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
            if (closing <= 0) continue;
            // Small rocks just bounce; anything bigger breaks.
            if (p.size === 1 && q.size === 1) {
              p.vx -= closing * nx; p.vy -= closing * ny; q.vx += closing * nx; q.vy += closing * ny;
              continue;
            }
            if (p.size > 1) split(p, nx, ny); else { p.vx -= closing * nx; p.vy -= closing * ny; }
            if (q.size > 1) split(q, -nx, -ny); else { q.vx += closing * nx; q.vy += closing * ny; }
            break;
          }
        }
      } else steer(dt);
      rocks = rocks.filter((r) => r.life > 0 || r.fade > 0);
      if (mass() < target && !rocks.some((r) => r.fade < 1 && r.size === 3 && r.life > 3)) arrive();
      for (const g of grit) { g.x += g.vx * dt; g.y += g.vy * dt; g.t += dt; }
      grit = grit.filter((g) => g.t < 1.1);
    }

    /** The ship: turns toward the nearest rock, leading it, fires when lined up, edges away. @param {number} dt */
    function steer(dt) {
      /** @type {Rock|null} */
      let near = null, best = Infinity;
      for (const r of rocks) {
        if (r.fade < 1 || r.life <= 0) continue;
        const d = Math.hypot(r.x - me.x, r.y - me.y) - r.R;
        if (d < best) { best = d; near = r; }
      }
      const bv = 200;
      if (near) {
        const t = Math.hypot(near.x - me.x, near.y - me.y) / bv;
        const want = Math.atan2(near.y + near.vy * t - me.y, near.x + near.vx * t - me.x);
        let da = want - me.a;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        me.a += clamp(da, -1.6 * dt, 1.6 * dt);
        me.cool -= dt;
        if (Math.abs(da) < 0.06 && me.cool <= 0 && best < Math.min(s.W, s.H) * 0.6) {
          shots.push({ x: me.x + Math.cos(me.a) * 12, y: me.y + Math.sin(me.a) * 12, vx: Math.cos(me.a) * bv, vy: Math.sin(me.a) * bv, t: 0 });
          me.cool = 0.9 + rng.random() * 0.8;
        }
        // Too close: slide away from it; otherwise ease back toward the middle.
        const ax = best < 60 ? (me.x - near.x) : (s.W / 2 - me.x) * 0.2;
        const ay = best < 60 ? (me.y - near.y) : (s.H / 2 - me.y) * 0.2;
        const k = Math.hypot(ax, ay) || 1;
        me.vx += (ax / k) * 18 * dt; me.vy += (ay / k) * 18 * dt;
      }
      me.vx *= 1 - 0.6 * dt; me.vy *= 1 - 0.6 * dt;
      me.x += me.vx * dt; me.y += me.vy * dt;
      for (const b of shots) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt;
        for (const r of rocks) {
          if (r.life <= 0 || r.fade < 1) continue;
          const dx = b.x - r.x, dy = b.y - r.y, d = Math.hypot(dx, dy);
          if (d < r.R * 0.9) { split(r, dx / (d || 1), dy / (d || 1)); b.t = 9; break; }
        }
      }
      shots = shots.filter((b) => b.t < 1.4);
    }

    return {
      lay() {
        const m = Math.min(s.W, s.H);
        big = clamp(m * 0.075, 30, 78);
        speed = clamp(m * 0.035, 12, 32);
        target = clamp(Math.round(s.W * s.H / 30000), 14, 56) * (layered ? 1.4 : 1);
        if (!rocks.length) {
          flow = Math.PI + (rng.random() - 0.5) * 0.8;
          // A field already going: rocks of every size, spread over the host, fully faded in.
          while (mass() < target) {
            const size = [3, 3, 2, 1][rng.int(4)];
            const z = layered ? [0.25, 0.6, 1][rng.int(3)] : 1;
            const r = rock(size, z, rng.random() * s.W, rng.random() * s.H);
            r.fade = 1;
            if (ship && Math.hypot(r.x - s.W / 2, r.y - s.H / 2) < r.R + 70) continue;
            rocks.push(r);
          }
          rocks.sort((a, b) => a.z - b.z);
          me.x = s.W / 2; me.y = s.H / 2; me.a = -Math.PI / 2;
          for (let k = 0; k < 40; k++) advance(1 / 30);
          return;
        }
        // A new size: rocks wrap back inside, the ship too.
        for (const r of rocks) { r.x = ((r.x % s.W) + s.W) % s.W; r.y = ((r.y % s.H) + s.H) % s.H; }
        me.x = clamp(me.x, 20, s.W - 20); me.y = clamp(me.y, 20, s.H - 20);
      },
      step(dt) { advance(dt); },
      draw() {
        const { ctx } = s;
        ctx.lineJoin = 'round';
        // Far rocks first.
        if (layered) rocks.sort((a, b) => a.z - b.z);
        for (const r of rocks) {
          if (r.fade <= 0) continue;
          const n = r.shape.length;
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const a = r.a + (i / n) * TAU, d = r.R * r.shape[i];
            const x = r.x + Math.cos(a) * d, y = r.y + Math.sin(a) * d;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.closePath();
          const depth = layered ? 0.45 + 0.55 * r.z : 1;
          ctx.fillStyle = ctx.strokeStyle = s.colors[r.c];
          ctx.globalAlpha = (s.dark ? 0.07 : 0.09) * r.fade * depth;
          ctx.fill();
          ctx.globalAlpha = (s.dark ? 0.52 : 0.58) * r.fade * depth;
          ctx.lineWidth = r.size === 1 ? 1.5 : 1.8;
          ctx.stroke();
        }
        for (const g of grit) {
          ctx.globalAlpha = 0.5 * (1 - g.t / 1.1);
          ctx.fillStyle = s.colors[g.c];
          ctx.fillRect(g.x - 1.2, g.y - 1.2, 2.4, 2.4);
        }
        if (!ship) return;
        // The ship: a thin arrowhead, and its shots.
        ctx.globalAlpha = s.dark ? 0.62 : 0.66;
        ctx.strokeStyle = ctx.fillStyle = s.ink;
        ctx.lineWidth = 1.8;
        const L = clamp(Math.min(s.W, s.H) * 0.022, 10, 18);
        const c = Math.cos(me.a), sn = Math.sin(me.a);
        /** @param {number} f @param {number} q */
        const pt = (f, q) => /** @type {[number, number]} */ ([me.x + c * f - sn * q, me.y + sn * f + c * q]);
        ctx.beginPath();
        ctx.moveTo(...pt(L, 0)); ctx.lineTo(...pt(-L * 0.7, L * 0.62));
        ctx.lineTo(...pt(-L * 0.4, 0)); ctx.lineTo(...pt(-L * 0.7, -L * 0.62));
        ctx.closePath();
        ctx.stroke();
        for (const b of shots) ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
      },
    };
  });
}
