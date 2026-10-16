// Double pendulum: two-armed pendulums swing chaotically under slow gravity, the end of each
// tracing a path that fades behind it. The seed picks the variant: two pendulums side by side,
// each with a long trace; a fan of pendulums from one pivot, started a hair apart so they swing
// as one and then split (begun again every so often with a slow crossfade); or a row of
// pendulums of different proportions hanging from a beam.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{a1:number, a2:number, w1:number, w2:number, l1:number, l2:number, e0:number, c:number,
 *   px:number, py:number, R:number, tx:Float32Array, ty:Float32Array, head:number, len:number}} Pend
 * Angles a1, a2 from straight down and their rates w1, w2; arm lengths l1 + l2 = 1 (times R px);
 * energy e0 it keeps; colour c; pivot px, py and R in CSS px; the end's trace, relative to the
 * pivot in units of R, a ring of len points ending at head. */

const G = 0.4;          // gravity in arm-lengths per s^2: a slow, heavy swing
const SUB = 4;          // integration steps per frame
const SEGS = 8;         // fade steps along a trace
const CYCLE = 42;       // seconds before the fan of pendulums starts again

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Pend[]} */
    let pends = [];
    let clock = 0, warmed = false;
    const trail = layout === 0 ? 320 : layout === 1 ? 130 : 160;

    /** @param {number} a1 @param {number} a2 @param {number} l1 @param {number} c @returns {Pend} */
    function pend(a1, a2, l1, c) {
      const p = { a1, a2, w1: 0, w2: 0, l1, l2: 1 - l1, e0: 0, c, px: 0, py: 0, R: 0,
        tx: new Float32Array(trail), ty: new Float32Array(trail), head: 0, len: 0 };
      p.e0 = energy(p);
      return p;
    }

    /** Fresh pendulums for the variant. @returns {void} */
    function deal() {
      pends = [];
      if (layout === 0) {
        for (let i = 0; i < 2; i++) {
          pends.push(pend(2.1 + rng.random() * 0.6, 2.2 + rng.random() * 0.8, 0.45 + rng.random() * 0.1, (i * 2) % nc));
        }
      } else if (layout === 1) {
        const k = Math.min(5, Math.max(3, nc)), a1 = 1.9 + rng.random() * 0.4, a2 = 2.1 + rng.random() * 0.5;
        for (let i = 0; i < k; i++) pends.push(pend(a1 + i * 0.01, a2, 0.5, i % nc));
      } else {
        const k = clamp(Math.round(s.W / 270), 3, 7);
        for (let i = 0; i < k; i++) {
          pends.push(pend(1.4 + rng.random() * 1.1, (rng.random() - 0.5) * 4, 0.35 + rng.random() * 0.3, i % nc));
        }
      }
      place();
    }

    /** Pivots and sizes for the current page. @returns {void} */
    function place() {
      const m0 = Math.min(s.W, s.H), wide = s.W > s.H * 1.1;
      pends.forEach((p, i) => {
        if (layout === 0) {
          if (wide) { p.px = s.W * (i ? 0.72 : 0.28); p.py = s.H * 0.42; p.R = Math.min(s.W * 0.2, s.H * 0.38); }
          else { p.px = s.W / 2; p.py = s.H * (i ? 0.7 : 0.3); p.R = Math.min(s.W * 0.4, s.H * 0.18); }
        } else if (layout === 1) {
          p.px = s.W / 2; p.py = s.H / 2; p.R = m0 * 0.42;
        } else {
          const gap = s.W / pends.length;
          p.px = gap * (i + 0.5); p.py = s.H * 0.3;
          p.R = Math.min(gap * 0.75, s.H * 0.34);
        }
      });
    }

    /** Advances every pendulum by dt seconds and records its end. @param {number} dt @returns {void} */
    function advance(dt) {
      const h = dt / SUB;
      for (const p of pends) {
        for (let k = 0; k < SUB; k++) rk4(p, h);
        // Hold the energy it started with, so rounding never winds it up or runs it down.
        const pe = potential(p), ke = energy(p) - pe, want = p.e0 - pe;
        if (ke > 1e-6 && want > 0) { const f = Math.sqrt(want / ke); p.w1 *= f; p.w2 *= f; }
        p.head = (p.head + 1) % trail;
        p.tx[p.head] = p.l1 * Math.sin(p.a1) + p.l2 * Math.sin(p.a2);
        p.ty[p.head] = p.l1 * Math.cos(p.a1) + p.l2 * Math.cos(p.a2);
        p.len = Math.min(trail, p.len + 1);
      }
    }

    /** Runs a few seconds ahead so the first picture already has traces. @returns {void} */
    function warm() {
      for (let i = 0; i < (layout === 1 ? 300 : trail); i++) advance(1 / 30);
      clock = 10;
    }

    return {
      lay() {
        if (!warmed) { warmed = true; deal(); warm(); }
        else place();
      },
      step(dt) {
        if (layout === 1) {
          clock += dt;
          if (clock > CYCLE) { clock = 0; deal(); }
        }
        advance(dt);
      },
      draw() {
        const { ctx } = s;
        // The fan fades out over its last 2.5s and in over its first 1.5s.
        const fade = layout === 1 ? clamp(Math.min(clock / 1.5, (CYCLE - clock) / 2.5), 0, 1) : 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (layout === 2) {
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = s.ink;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pends[0].px - s.W / pends.length * 0.4, pends[0].py);
          ctx.lineTo(pends[pends.length - 1].px + s.W / pends.length * 0.4, pends[0].py);
          ctx.stroke();
        }
        // Traces: each split into SEGS strokes, fainter toward the old end.
        ctx.lineWidth = clamp(Math.min(s.W, s.H) * 0.005, 2, 3.5);
        for (const p of pends) {
          const per = Math.ceil(p.len / SEGS);
          ctx.strokeStyle = s.colors[p.c];
          for (let g = 0; g < SEGS; g++) {
            const from = g * per, to = Math.min(p.len - 1, from + per);
            if (to <= from) break;
            ctx.globalAlpha = fade * (s.dark ? 0.5 : 0.55) * (1 - g / SEGS) ** 1.3;
            ctx.beginPath();
            for (let k = from; k <= to; k++) {
              const j = (p.head - k + trail) % trail;
              const x = p.px + p.tx[j] * p.R, y = p.py + p.ty[j] * p.R;
              if (k === from) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
        // Arms, bobs and pivots.
        for (const p of pends) {
          const x1 = p.px + p.R * p.l1 * Math.sin(p.a1), y1 = p.py + p.R * p.l1 * Math.cos(p.a1);
          const x2 = x1 + p.R * p.l2 * Math.sin(p.a2), y2 = y1 + p.R * p.l2 * Math.cos(p.a2);
          const r = clamp(p.R * 0.05, 4, 11);
          ctx.globalAlpha = fade * (s.dark ? 0.4 : 0.45);
          ctx.strokeStyle = s.ink;
          ctx.lineWidth = clamp(r * 0.35, 1.5, 3);
          ctx.beginPath();
          ctx.moveTo(p.px, p.py); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.fillStyle = s.ink;
          ctx.beginPath();
          ctx.arc(p.px, p.py, r * 0.45, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = fade * (s.dark ? 0.6 : 0.62);
          ctx.fillStyle = s.colors[p.c];
          ctx.beginPath();
          ctx.arc(x1, y1, r * 0.8, 0, TAU);
          ctx.moveTo(x2 + r, y2);
          ctx.arc(x2, y2, r, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    };
  });
}

/** @param {Pend} p @returns {number} potential energy, unit masses */
const potential = (p) => -G * (2 * p.l1 * Math.cos(p.a1) + p.l2 * Math.cos(p.a2));

/** @param {Pend} p @returns {number} total energy, unit masses */
function energy(p) {
  const v1 = p.l1 * p.w1, v2 = p.l2 * p.w2;
  return potential(p) + 0.5 * v1 * v1 + 0.5 * (v1 * v1 + v2 * v2 + 2 * v1 * v2 * Math.cos(p.a1 - p.a2));
}

/** The angular accelerations, unit masses. @param {Pend} p @param {number} a1 @param {number} a2
 * @param {number} w1 @param {number} w2 @returns {[number, number]} */
function accel(p, a1, a2, w1, w2) {
  const { l1, l2 } = p, d = a1 - a2, den = 3 - Math.cos(2 * d), sd = Math.sin(d);
  const b1 = (-G * 3 * Math.sin(a1) - G * Math.sin(a1 - 2 * a2) - 2 * sd * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))) / (l1 * den);
  const b2 = (2 * sd * (w1 * w1 * l1 * 2 + G * 2 * Math.cos(a1) + w2 * w2 * l2 * Math.cos(d))) / (l2 * den);
  return [b1, b2];
}

/** One Runge-Kutta step of h seconds. @param {Pend} p @param {number} h @returns {void} */
function rk4(p, h) {
  const { a1, a2, w1, w2 } = p;
  const [k1a, k1b] = accel(p, a1, a2, w1, w2);
  const [k2a, k2b] = accel(p, a1 + w1 * h / 2, a2 + w2 * h / 2, w1 + k1a * h / 2, w2 + k1b * h / 2);
  const m1 = w1 + k1a * h / 2, m2 = w2 + k1b * h / 2;
  const [k3a, k3b] = accel(p, a1 + m1 * h / 2, a2 + m2 * h / 2, w1 + k2a * h / 2, w2 + k2b * h / 2);
  const n1 = w1 + k2a * h / 2, n2 = w2 + k2b * h / 2;
  const [k4a, k4b] = accel(p, a1 + n1 * h, a2 + n2 * h, w1 + k3a * h, w2 + k3b * h);
  const o1 = w1 + k3a * h, o2 = w2 + k3b * h;
  p.a1 = a1 + h / 6 * (w1 + 2 * m1 + 2 * n1 + o1);
  p.a2 = a2 + h / 6 * (w2 + 2 * m2 + 2 * n2 + o2);
  p.w1 = w1 + h / 6 * (k1a + 2 * k2a + 2 * k3a + k4a);
  p.w2 = w2 + h / 6 * (k1b + 2 * k2b + 2 * k3b + k4b);
}
