// Fireflies: soft glowing points wander on slow curving paths, each brightening and dimming on
// its own slow beat, in the look's colours. Never a flash: a glow takes over a second to rise.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, a:number, turn:number, v:number, ph:number, f:number, c:number, r:number}} Fly */

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    /** @type {Fly[]} */
    let flies = [];
    /** @type {HTMLCanvasElement[]} */
    const glows = s.colors.map((c) => glow(c));

    return {
      lay() {
        const n = clamp(Math.round(s.W * s.H / 14000), 14, 70);
        while (flies.length < n) {
          flies.push({ x: rng.random() * s.W, y: rng.random() * s.H, a: rng.random() * TAU, turn: 0,
            v: 12 + rng.random() * 18, ph: rng.random() * TAU, f: 0.25 + rng.random() * 0.3,
            c: rng.int(glows.length), r: 10 + rng.random() * 14 });
        }
        flies.length = n;
        for (const p of flies) { p.x = Math.min(p.x, s.W); p.y = Math.min(p.y, s.H); }
      },
      step(dt) {
        for (const p of flies) {
          p.turn = clamp(p.turn + (rng.random() - 0.5) * 3 * dt, -0.9, 0.9);
          p.a += p.turn * dt;
          p.x += Math.cos(p.a) * p.v * dt;
          p.y += Math.sin(p.a) * p.v * dt;
          // Wrap round the edges, a glow's width beyond them.
          if (p.x < -30) p.x += s.W + 60; else if (p.x > s.W + 30) p.x -= s.W + 60;
          if (p.y < -30) p.y += s.H + 60; else if (p.y > s.H + 30) p.y -= s.H + 60;
        }
      },
      draw() {
        const { ctx } = s;
        if (s.dark) ctx.globalCompositeOperation = 'lighter';
        for (const p of flies) {
          const beat = 0.5 + 0.5 * Math.sin(s.t * p.f * TAU + p.ph);
          ctx.globalAlpha = (s.dark ? 0.18 : 0.3) + beat * (s.dark ? 0.5 : 0.45);
          const d = p.r * (1.6 + beat);
          ctx.drawImage(glows[p.c], p.x - d, p.y - d, d * 2, d * 2);
        }
      },
    };
  });
}

/** A round glow with a bright core, as a sprite. @param {string} color @returns {HTMLCanvasElement} */
function glow(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  // Alpha alone falls off, so any colour string works and the rim never darkens.
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.18, 'rgba(0,0,0,.9)');
  grad.addColorStop(0.5, 'rgba(0,0,0,.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}
