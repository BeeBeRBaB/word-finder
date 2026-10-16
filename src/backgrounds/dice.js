// Dice: dice are thrown onto the table, tumble across it turning over in 3D, bounce off its
// rails and each other, and settle showing their pips; after a moment they are cleared and thrown
// again. The seed picks the variant: five large dice on one table, swept off by a stick; small
// dice over the whole page in several throws, each picked up (rising and fading) on its own
// clock; or long lanes like a craps table, a pair thrown down each and raked back.

import { roundRect } from './shapes.js';
import { stage, clamp } from './stage.js';

// Pips on a face, in its square from -1 to 1, for 1..6.
const PIPS = [[], [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]],
  [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];
// The number on each face: +x, -x, +y, -y, +z, -z of the die's own axes.
const FACE = [2, 5, 3, 4, 1, 6];

/** @typedef {{x:number, y:number, z:number, vx:number, vy:number, vz:number, R:number[],
 *   w:number[], h:number, c:number, rest:boolean, inside:boolean, a:number}} Die
 * R: rotation, its columns the die's axes in the page's (x right, y down, z up to the eye); w:
 * spin, radians/s about the page's axes; h: half the side; a: alpha, below 1 while going. */
/** @typedef {{x0:number, y0:number, x1:number, y1:number, dice:Die[], n:number, phase:number,
 *   t:number, from:number, rake:number, h:number, open:boolean}} Table
 * phase: 0 waiting, 1 rolling, 2 showing, 3 clearing; t: seconds in it; from: the side (-1 left,
 * 1 right) throws come from and clearing goes to; rake: the stick's x while clearing; open: no
 * rails drawn (the whole page). */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    const L = s.layout;
    const cache = document.createElement('canvas');
    /** @type {Table[]} */
    let tables = [];
    let key = '';

    /** Turns R by the rotation vector v (axis times angle). @param {number[]} R @param {number[]} v */
    function turn(R, v) {
      const ang = Math.hypot(v[0], v[1], v[2]);
      if (ang < 1e-6) return;
      const x = v[0] / ang, y = v[1] / ang, z = v[2] / ang, c = Math.cos(ang), sn = Math.sin(ang), k = 1 - c;
      const M = [c + x * x * k, x * y * k - z * sn, x * z * k + y * sn,
        y * x * k + z * sn, c + y * y * k, y * z * k - x * sn,
        z * x * k - y * sn, z * y * k + x * sn, c + z * z * k];
      const o = R.slice();
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        R[i * 3 + j] = M[i * 3] * o[j] + M[i * 3 + 1] * o[3 + j] + M[i * 3 + 2] * o[6 + j];
      }
    }

    /** The face pointing most nearly up: its axis column and sign. @param {Die} d @returns {[number, number]} */
    function top(d) {
      let best = 0, sg = 1, z = -2;
      for (let k = 0; k < 3; k++) {
        const v = d.R[6 + k];
        if (Math.abs(v) > z) { z = Math.abs(v); best = k; sg = Math.sign(v) || 1; }
      }
      return [best, sg];
    }

    /** @param {Table} tb */
    function hurl(tb) {
      const m = Math.min(s.W, s.H);
      // A throw over the whole page lands anywhere on it: any height, any length.
      const V = L === 1 ? (tb.x1 - tb.x0) * (0.1 + rng.random() * 0.75) * 1.5 + 80
        : clamp(m * 0.75, 260, 620) * (L === 2 ? 1.25 : 1);
      tb.dice = [];
      const cy = tb.y0 + (tb.y1 - tb.y0) * (L === 1 ? 0.12 + rng.random() * 0.76 : 0.3 + rng.random() * 0.4);
      for (let i = 0; i < tb.n; i++) {
        const h = tb.h * (0.92 + rng.random() * 0.16);
        const R = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        turn(R, [rng.random() * 6, rng.random() * 6, rng.random() * 6]);
        // A handful, not a row: each its own speed and heading, fanned from the throw.
        const ang = (rng.random() - 0.5) * 0.9, sp = V * (0.65 + rng.random() * 0.6);
        tb.dice.push({ x: tb.from > 0 ? tb.x1 + h * (3 + rng.random() * 5) : tb.x0 - h * (3 + rng.random() * 5),
          y: cy + (i - (tb.n - 1) / 2) * h * 1.8 + (rng.random() - 0.5) * h * 2,
          z: h * 3, vx: -tb.from * sp * Math.cos(ang), vy: sp * Math.sin(ang),
          vz: h * (3 + rng.random() * 4), R, w: [(rng.random() - 0.5) * 16, (rng.random() - 0.5) * 16, (rng.random() - 0.5) * 6],
          h, c: rng.int(nc), rest: false, inside: false, a: 1 });
      }
      tb.phase = 1; tb.t = 0;
    }

    /** @param {Die} d @param {Table} tb @param {number} dt */
    function roll(d, tb, dt) {
      if (d.rest) return;
      const { h } = d;
      // In the air: falling and spinning freely; on the felt: rolling, slowed by it.
      d.vz -= h * 40 * dt;
      d.z += d.vz * dt;
      if (d.z <= 0) {
        d.z = 0;
        if (d.vz < -h * 3) {
          d.vz = -d.vz * 0.4;
          d.w = [d.w[0] * 0.7 + (rng.random() - 0.5) * 6, d.w[1] * 0.7 + (rng.random() - 0.5) * 6, d.w[2] * 0.5];
        } else d.vz = 0;
      }
      const ground = d.z === 0 && d.vz === 0;
      if (ground) {
        const sp = Math.hypot(d.vx, d.vy), drop = Math.max(0, sp - (sp * 1.6 + h * 3) * dt);
        d.vx *= sp ? drop / sp : 0; d.vy *= sp ? drop / sp : 0;
        d.w = [-d.vy / h, d.vx / h, d.w[2] * Math.exp(-4 * dt)];
      }
      d.x += d.vx * dt; d.y += d.vy * dt;
      turn(d.R, [d.w[0] * dt, d.w[1] * dt, d.w[2] * dt]);
      const r = h * 1.15;
      if (!d.inside && d.x > tb.x0 + r && d.x < tb.x1 - r) d.inside = true;
      if (d.inside) {
        if (d.x < tb.x0 + r && d.vx < 0) { d.x = tb.x0 + r; d.vx *= -0.55; }
        if (d.x > tb.x1 - r && d.vx > 0) { d.x = tb.x1 - r; d.vx *= -0.55; }
      }
      if (d.y < tb.y0 + r && d.vy < 0) { d.y = tb.y0 + r; d.vy *= -0.55; }
      if (d.y > tb.y1 - r && d.vy > 0) { d.y = tb.y1 - r; d.vy *= -0.55; }
      // Slow enough: tip onto the nearest face and lie still.
      if (ground && Math.hypot(d.vx, d.vy) < h * 0.6) {
        d.vx = d.vy = 0;
        const [k, sg] = top(d);
        const n = [d.R[k] * sg, d.R[3 + k] * sg, d.R[6 + k] * sg];
        const ang = Math.acos(clamp(n[2], -1, 1));
        if (ang < 0.004) { d.rest = true; return; }
        const ax = Math.hypot(n[0], n[1]) || 1, u = Math.min(ang, ang * 10 * dt + 0.01);
        // n x up, scaled to the step.
        turn(d.R, [n[1] / ax * u, -n[0] / ax * u, 0]);
        d.w = [0, 0, 0];
      }
    }

    /** Dice knock apart, as discs on the felt. @param {Die[]} all */
    function knock(all) {
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i], b = all[j];
          if (a.a < 1 || b.a < 1 || Math.abs(a.z - b.z) > a.h * 2) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = (a.h + b.h) * 1.2;
          if (d >= min || d < 1e-3) continue;
          const nx = dx / d, ny = dy / d, push = (min - d) / 2;
          a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const k = -rel * 0.85 / 2;
            a.vx -= nx * k; a.vy -= ny * k; b.vx += nx * k; b.vy += ny * k;
            if (a.rest || b.rest) { a.rest = b.rest = false; }
          }
        }
      }
    }

    /** @param {Table} tb @param {number} dt */
    function tick(tb, dt) {
      tb.t += dt;
      if (tb.phase === 0) { if (tb.t > 0.6) hurl(tb); return; }
      if (tb.phase === 1) {
        for (const d of tb.dice) roll(d, tb, dt);
        if (tb.dice.every((d) => d.rest) || tb.t > 8) { tb.phase = 2; tb.t = 0; }
        return;
      }
      if (tb.phase === 2) {
        if (tb.t > 2.8) { tb.phase = 3; tb.t = 0; tb.rake = tb.from > 0 ? tb.x0 - tb.h * 2 : tb.x1 + tb.h * 2; }
        return;
      }
      // Clearing: picked up (rising, fading), or raked off toward the throwing side.
      if (L === 1) {
        for (const d of tb.dice) { d.z += tb.h * 6 * dt; d.a = Math.max(0, 1 - tb.t / 0.9); }
      } else {
        tb.rake += tb.from * clamp((tb.x1 - tb.x0) * 0.55, 200, 600) * dt;
        for (const d of tb.dice) {
          const edge = tb.rake + tb.from * d.h * 1.25;
          if ((d.x - edge) * tb.from < 0) d.x = edge;
          const out = tb.from > 0 ? d.x - tb.x1 : tb.x0 - d.x;
          d.a = clamp(1 - out / (d.h * 3), 0, 1);
        }
      }
      const done = L === 1 ? tb.t > 1 : (tb.rake - (tb.from > 0 ? tb.x1 : tb.x0)) * tb.from > tb.h * 6;
      if (done) { tb.phase = 0; tb.t = 0; tb.dice = []; if (L === 1) tb.from = rng.random() < 0.5 ? -1 : 1; }
    }

    function build() {
      const m = Math.min(s.W, s.H);
      tables = [];
      if (L === 0) {
        const mx = clamp(s.W * 0.07, 16, 90), my = clamp(s.H * 0.09, 16, 90);
        tables.push(table(mx, my, s.W - mx, s.H - my, 5, clamp(m * 0.045, 14, 40), false));
      } else if (L === 1) {
        const h = clamp(m * 0.03, 11, 26);
        let n = clamp(Math.round(s.W * s.H / 34000), 9, 30);
        while (n > 0) {
          const k = Math.min(n, 3 + rng.int(3));
          tables.push(table(0, 0, s.W, s.H, k, h, true));
          n -= k;
        }
      } else {
        const lanes = clamp(Math.round(s.H / clamp(m * 0.42, 150, 300)), 2, 4);
        const pad = clamp(s.H * 0.05, 12, 50), lh = (s.H - pad * (lanes + 1)) / lanes;
        const mx = clamp(s.W * 0.05, 12, 70);
        for (let i = 0; i < lanes; i++) {
          const y0 = pad + i * (lh + pad);
          tables.push(table(mx, y0, s.W - mx, y0 + lh, 2, clamp(lh * 0.16, 12, 32), false));
        }
      }
      // Under way: each table somewhere in its round.
      tables.forEach((tb, i) => {
        tb.from = L === 2 ? 1 : (L === 0 ? (rng.random() < 0.5 ? -1 : 1) : (i % 2 ? 1 : -1));
        hurl(tb);
        const t = i === 0 ? 3 + rng.random() * 2 : rng.random() * 7;
        for (let k = 0; k < t * 30; k++) { tick(tb, 1 / 30); knock(tb.dice); }
        if (tb.phase !== 1 && tb.phase !== 2) { tb.phase = 0; tb.t = rng.random() * 0.5; tb.dice = []; hurl(tb); for (let k = 0; k < 30; k++) tick(tb, 1 / 30); }
      });
    }

    /** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {number} n
     * @param {number} h @param {boolean} open @returns {Table} */
    function table(x0, y0, x1, y1, n, h, open) {
      return { x0, y0, x1, y1, dice: [], n, phase: 0, t: 0, from: 1, rake: 0, h, open };
    }

    function render() {
      cache.width = Math.round(s.W * s.dpr); cache.height = Math.round(s.H * s.dpr);
      const g = cache.getContext('2d');
      if (!g) return;
      g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      for (const tb of tables) {
        if (tb.open) continue;
        const r = Math.min(tb.y1 - tb.y0, tb.x1 - tb.x0) * 0.08;
        g.beginPath(); roundRect(g, tb.x0, tb.y0, tb.x1 - tb.x0, tb.y1 - tb.y0, r);
        g.fillStyle = s.colors[(L === 2 ? tables.indexOf(tb) : 0) % nc];
        g.globalAlpha = s.dark ? 0.07 : 0.09; g.fill();
        g.strokeStyle = s.ink; g.lineWidth = clamp(tb.h * 0.22, 2, 6);
        g.globalAlpha = s.dark ? 0.26 : 0.3; g.stroke();
        // An inner line, as on a card table's felt.
        const k = tb.h * 1.1;
        g.beginPath(); roundRect(g, tb.x0 + k, tb.y0 + k, tb.x1 - tb.x0 - 2 * k, tb.y1 - tb.y0 - 2 * k, Math.max(0, r - k));
        g.lineWidth = 1.5; g.globalAlpha = s.dark ? 0.12 : 0.14; g.stroke();
      }
    }

    /** @param {Die} d */
    function drawDie(d) {
      const { ctx } = s;
      const sc = 1 + d.z / (Math.min(s.W, s.H) * 0.9);
      const h = d.h * sc;
      // A soft shadow, further off the higher the die.
      ctx.globalAlpha = (s.dark ? 0.16 : 0.08) * d.a / sc;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(d.x + d.h * 0.15 + d.z * 0.3, d.y + d.h * 0.25 + d.z * 0.4, d.h * 1.05, 0, Math.PI * 2); ctx.fill();
      const col = s.colors[d.c];
      for (let f = 0; f < 6; f++) {
        const k = f >> 1, sg = f & 1 ? -1 : 1;
        const nz = d.R[6 + k] * sg;
        if (nz < 0.06) continue;
        const a = (k + 1) % 3, b = (k + 2) % 3;
        ctx.save();
        ctx.transform(d.R[a] * h, d.R[3 + a] * h, d.R[b] * h, d.R[3 + b] * h,
          d.x + d.R[k] * sg * h, d.y + d.R[3 + k] * sg * h);
        ctx.beginPath(); roundRect(ctx, -0.94, -0.94, 1.88, 1.88, 0.32);
        ctx.fillStyle = col; ctx.globalAlpha = (0.2 + 0.3 * nz) * d.a * (s.dark ? 1 : 1.1);
        ctx.fill();
        ctx.beginPath();
        for (const [px, py] of PIPS[FACE[f]]) { ctx.moveTo(px * 0.52 + 0.17, py * 0.52); ctx.arc(px * 0.52, py * 0.52, 0.17, 0, Math.PI * 2); }
        ctx.fillStyle = s.ink; ctx.globalAlpha = (0.25 + 0.4 * nz) * d.a;
        ctx.fill();
        ctx.restore();
      }
    }

    return {
      lay() {
        const k = `${s.W}x${s.H}`;
        if (k !== key) { key = k; build(); render(); }
        else render();
      },
      step(dt) {
        for (const tb of tables) tick(tb, dt);
        knock(tables.flatMap((tb) => tb.phase > 0 && !(L === 1 && tb.phase === 3) ? tb.dice : []));
      },
      draw() {
        const { ctx } = s;
        ctx.drawImage(cache, 0, 0, s.W, s.H);
        const all = tables.flatMap((tb) => tb.dice);
        all.sort((a, b) => a.z - b.z);
        for (const d of all) if (d.a > 0) drawDie(d);
        // The stick raking dice off.
        ctx.strokeStyle = s.ink; ctx.lineCap = 'round';
        for (const tb of tables) {
          if (tb.phase !== 3 || L === 1) continue;
          ctx.globalAlpha = s.dark ? 0.4 : 0.45; ctx.lineWidth = clamp(tb.h * 0.3, 3, 8);
          ctx.beginPath(); ctx.moveTo(tb.rake, tb.y0 + tb.h * 0.8); ctx.lineTo(tb.rake, tb.y1 - tb.h * 0.8); ctx.stroke();
        }
      },
    };
  });
}
