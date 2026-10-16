// Whirlpool: the subject's icons circle slowly in toward a centre on a log spiral, shrinking and
// fading as they near it, and come back in at the rim as another icon; faint swirl lines turn
// with them. The seed picks the variant: one vortex with icons scattered round it, two vortices
// turning opposite ways, or one vortex whose icons stream in along three spiral arms.

import { iconStage } from './icon-stage.js';
import { TAU, clamp } from './stage.js';

/** @typedef {{k:number, a0:number, u0:number, v:number, last:number}} Drop
 * An icon on its way in: the angle it came in at, where along its life it started (0 rim .. 1
 * centre) and which vortex it is in; last is its life a frame ago, to see it wrap. */
/** @typedef {{x:number, y:number, rx:number, ry:number, way:number}} Vortex
 * Its centre, its rim's half-width and half-height (an ellipse, to fill the host), which way it turns. */

const CURL = 3;      // turn per e-fold of radius: the spiral's tightness
const SPIN = 0.03;   // rad/s the whole pattern turns
const END = 0.95;    // life at which an icon is gone

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    const pick = () => rng.random() < 0.15 ? 0 : 1 + rng.int(Math.max(1, s.n - 1));
    const way = rng.random() < 0.5 ? -1 : 1;
    /** @type {Vortex[]} */
    const vortices = layout === 1 ? [{ x: 0, y: 0, rx: 1, ry: 1, way }, { x: 0, y: 0, rx: 1, ry: 1, way: -way }]
      : [{ x: 0, y: 0, rx: 1, ry: 1, way }];
    const ARMS = 3;
    /** @type {Drop[]} */
    const drops = [];
    let T = 30, base = 40;

    /** @param {Drop} d @returns {number} life now, 0..1 */
    const life = (d) => (d.u0 + s.t / T) % 1;

    return {
      lay() {
        const { W, H } = s;
        const unit = Math.min(W, H);
        if (layout === 1) {
          const wide = W >= H;
          vortices.forEach((v, j) => {
            v.x = wide ? W * (0.25 + 0.5 * j) : W / 2; v.y = wide ? H / 2 : H * (0.25 + 0.5 * j);
            v.rx = (wide ? W / 4 : W / 2) * 1.2; v.ry = (wide ? H / 2 : H / 4) * 1.2;
          });
        } else {
          Object.assign(vortices[0], { x: W / 2, y: H / 2, rx: W / 2 * 1.2, ry: H / 2 * 1.2 });
        }
        base = clamp(unit * 0.12, 32, 96);
        T = clamp(Math.max(vortices[0].rx, vortices[0].ry) / 20, 18, 45);
        const n = layout === 2 ? ARMS * clamp(Math.round(unit / 70), 7, 11) : clamp(Math.round(W * H / 22000), 24, 45);
        if (drops.length !== n) {
          drops.length = 0;
          for (let i = 0; i < n; i++) {
            const arm = i % ARMS, m = n / ARMS;
            drops.push(layout === 2
              ? { k: pick(), a0: arm * TAU / ARMS, u0: Math.floor(i / ARMS) / m, v: 0, last: 0 }
              : { k: pick(), a0: rng.random() * TAU, u0: (i + rng.random()) / n, v: layout === 1 ? i % 2 : 0, last: 0 });
          }
          for (const d of drops) d.last = life(d);
        }
      },
      step() {
        for (const d of drops) {
          const u = life(d);
          // Back at the rim: a new icon, and in from a new side unless it rides an arm.
          if (u < d.last) { d.k = pick(); if (layout !== 2) d.a0 = rng.random() * TAU; }
          d.last = u;
        }
      },
      draw() {
        const { ctx, t } = s;
        ctx.strokeStyle = s.ink;
        ctx.lineWidth = 1.5;
        // Faint swirl lines: the spirals the icons ride, turning with them.
        for (const v of vortices) {
          const lines = layout === 2 ? ARMS : 5;
          ctx.globalAlpha = layout === 2 ? 0.12 : 0.09;
          ctx.beginPath();
          for (let j = 0; j < lines; j++) {
            const a = v.way * SPIN * t + j * TAU / lines;
            for (let i = 0; i <= 90; i++) {
              const f = i / 90 * CURL * Math.log(1 / (1 - END)), r = Math.exp(-f / CURL), th = a + v.way * f;
              const x = v.x + Math.cos(th) * r * v.rx, y = v.y + Math.sin(th) * r * v.ry;
              if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            }
          }
          ctx.stroke();
        }
        for (const d of drops) {
          const u = life(d);
          if (u > END) continue;
          const v = vortices[d.v], g = 1 - u;
          const th = d.a0 + v.way * (CURL * Math.log(1 / g) + SPIN * t);
          const c = Math.cos(th), sn = Math.sin(th);
          const alpha = 0.56 * clamp(u / 0.05, 0, 1) * clamp((END - u) / 0.2, 0, 1);
          // Heading along the spiral: inward, and round the way the vortex turns.
          const rot = Math.atan2(v.ry * (-sn + v.way * CURL * c), v.rx * (-c - v.way * CURL * sn));
          s.icon(d.k, v.x + c * g * v.rx, v.y + sn * g * v.ry, base * (0.3 + 0.7 * g), rot, alpha, 1);
        }
      },
    };
  });
}
