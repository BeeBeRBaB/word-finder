// Fountain: the subject's icons spray up out of a nozzle with a mist of droplets, turning as they
// arc over and fall back into a pool. The seed picks the variant: one tall plume in the middle, a
// row of jets whose heights rise and fall in a slow travelling wave, or two jets at the sides
// arching across to cross in the middle, where each icon tilts along its path.

import { iconStage } from './icon-stage.js';
import { TAU, clamp } from './stage.js';

/** @typedef {{k:number, x:number, y:number, vx:number, vy:number, rot:number, spin:number, age:number, drop:boolean, c:number}} Bit
 * An icon or a droplet in flight, in CSS px and px/s; age in seconds since it left the nozzle.
 * @typedef {{x:number, aim:number, spread:number, power:number, ph:number}} Jet
 * A nozzle at x on the pool line, aimed `aim` radians off upright with `spread` either side;
 * power scales its speed and ph is its place in the row's wave. */

const ALPHA = 0.58;
const RISE = 1.6;     // seconds a jet's full-height spray takes to its top

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Bit[]} */
    const bits = [];
    /** @type {Jet[]} */
    let jets = [];
    let pool = 0, g = 300, v0 = 300, size = 40, rate = 4, due = 0, dropDue = 0, picks = 0, warm = false;

    /** Speed, tilt and timing for a fresh size. @returns {void} */
    function layJets() {
      const m = Math.min(s.W, s.H);
      pool = s.H - clamp(m * 0.06, 16, 44);
      const top = layout === 1 ? pool * 0.78 : pool * 0.86;   // how high a full jet reaches
      g = 2 * top / (RISE * RISE);
      v0 = g * RISE;
      size = clamp(m * 0.085, 30, 62);
      const live = clamp(Math.round(s.W * s.H / 26000), 14, 40);   // icons in the air at once
      rate = live / (2 * RISE);
      if (layout === 0) jets = [{ x: s.W / 2, aim: 0, spread: clamp(0.25 * s.W / pool, 0.16, 0.42), power: 1, ph: 0 }];
      else if (layout === 1) {
        const n = clamp(Math.round(s.W / 240), 3, 6);
        jets = Array.from({ length: n }, (_, i) => ({ x: s.W * (i + 0.5) / n, aim: 0, spread: 0.05, power: 1, ph: i / n }));
      } else {
        // Aimed so the middle of each spray lands about three quarters of the way across.
        const d = s.W * 0.66, a = 0.5 * Math.asin(clamp(d * g / (v0 * v0), 0, 1));
        jets = [{ x: s.W * 0.06, aim: a, spread: 0.07, power: 1, ph: 0 }, { x: s.W * 0.94, aim: -a, spread: 0.07, power: 1, ph: 0.5 }];
      }
    }

    /** @param {Jet} j @param {boolean} drop @returns {void} */
    function launch(j, drop) {
      const a = j.aim + (rng.random() * 2 - 1) * j.spread * (drop ? 1.6 : 1);
      const v = v0 * j.power * (drop ? 0.7 + rng.random() * 0.35 : 0.88 + rng.random() * 0.12);
      bits.push({ k: picks++ % 5 === 0 ? 0 : rng.int(s.n), x: j.x, y: pool, vx: Math.sin(a) * v, vy: -Math.cos(a) * v,
        rot: rng.random() * TAU, spin: (rng.random() * 2 - 1) * 1.6, age: 0, drop, c: rng.int(s.colors.length) });
    }

    /** @param {number} dt @returns {void} */
    function step(dt) {
      for (const [i, j] of jets.entries()) {
        if (layout === 1) j.power = 0.55 + 0.45 * Math.sin(s.t * 0.45 - j.ph * TAU);
        else if (layout === 2) j.power = 0.94 + 0.06 * Math.sin(s.t * 0.3 + i * 2);
      }
      due += dt * rate;
      dropDue += dt * rate * 3;
      while (due >= 1) { due--; launch(jets[rng.int(jets.length)], false); }
      while (dropDue >= 1) { dropDue--; launch(jets[rng.int(jets.length)], true); }
      for (const b of bits) {
        b.age += dt;
        b.vy += g * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.rot += b.spin * dt;
      }
      // Gone once back down in the pool, or off the sides.
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        if ((b.vy > 0 && b.y > pool + 4) || b.x < -size || b.x > s.W + size) bits.splice(i, 1);
      }
    }

    return {
      lay() {
        layJets();
        for (const b of bits) b.y = Math.min(b.y, pool);
        if (!warm) { warm = true; for (let i = 0; i < 90; i++) { s.t += 1 / 30; step(1 / 30); } s.t = 0; }
      },
      step,
      draw() {
        const { ctx } = s;
        // The pool's rim, and a nozzle at each jet.
        ctx.strokeStyle = s.colors[0];
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.globalAlpha = s.dark ? 0.3 : 0.4;
        ctx.beginPath();
        const rim = layout === 0 ? Math.min(s.W * 0.4, size * 5) : s.W * 0.47;
        ctx.ellipse(s.W / 2, pool + 6, rim, Math.max(6, size * 0.18), 0, 0, TAU);
        for (const j of jets) {
          const w = size * 0.26;
          ctx.moveTo(j.x - w, pool + 6); ctx.lineTo(j.x - w * 0.5, pool - w * 1.4);
          ctx.lineTo(j.x + w * 0.5, pool - w * 1.4); ctx.lineTo(j.x + w, pool + 6);
        }
        ctx.stroke();
        for (const b of bits) {
          if (!b.drop) continue;
          ctx.fillStyle = s.colors[b.c];
          ctx.globalAlpha = (s.dark ? 0.32 : 0.4) * clamp(b.age * 6, 0, 1);
          ctx.beginPath();
          ctx.arc(b.x, b.y, Math.max(1.5, size * 0.05), 0, TAU);
          ctx.fill();
        }
        for (const b of bits) {
          if (b.drop) continue;
          // Grows out of the nozzle, and sinks into the pool as it lands.
          const grow = clamp(b.age * 4, 0.35, 1);
          const sink = b.vy > 0 ? clamp((pool - b.y) / (size * 0.8), 0, 1) : 1;
          const dir = layout === 2 ? Math.sign(b.vx) || 1 : 0;
          const rot = layout === 2 ? 0.6 * Math.atan2(b.vy * dir, b.vx * dir) : b.rot;
          s.icon(b.k, b.x, b.y, size * grow, rot, ALPHA * sink, dir);
        }
      },
    };
  });
}
