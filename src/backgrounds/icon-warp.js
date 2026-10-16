// Warp: the subject's icons fly out of a far vanishing point toward the viewer, growing and
// fading in as they near, with a faint streak behind each. The seed picks the variant: a
// straight run from the centre, a slow spiral out, or a point that drifts round the host.

import { iconStage } from './icon-stage.js';
import { TAU, clamp } from './stage.js';

/** @typedef {{k:number, a:number, r:number, z:number, v:number}} Star
 * An icon in flight: its angle and lateral offset from the axis, depth z (1 far .. 0 here), speed. */

const COUNT = 26;
const NEAR = 0.08;   // depth an icon leaves at

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Star[]} */
    const stars = [];
    let cx = 0, cy = 0, unit = 1;
    /** @param {Star} p @param {number} z @returns {Star} */
    const launch = (p, z) => Object.assign(p, {
      k: rng.random() < 0.3 ? 0 : 1 + rng.int(Math.max(1, s.n - 1)),
      a: rng.random() * TAU, r: 0.35 + rng.random() * 0.75, z, v: 0.07 + rng.random() * 0.05,
    });
    for (let i = 0; i < COUNT; i++) stars.push(launch({ k: 0, a: 0, r: 0, z: 0, v: 0 }, NEAR + (i + rng.random()) / COUNT));

    /** Where the vanishing point is now. @returns {void} */
    function centre() {
      const wob = layout === 2 ? 0.18 : 0.04;
      cx = s.W * (0.5 + wob * Math.sin(s.t * 0.11));
      cy = s.H * (0.5 + wob * Math.sin(s.t * 0.083 + 1));
    }

    return {
      lay() { unit = Math.min(s.W, s.H) * 0.5; centre(); },
      step(dt) {
        centre();
        for (const p of stars) {
          p.z -= p.v * dt;
          if (layout === 1) p.a += dt * 0.25;
          if (p.z < NEAR) launch(p, 1);
        }
      },
      draw() {
        const { ctx } = s;
        const order = stars.slice().sort((a, b) => b.z - a.z);
        ctx.lineCap = 'round';
        for (const p of order) {
          const x = cx + Math.cos(p.a) * p.r * unit / p.z, y = cy + Math.sin(p.a) * p.r * unit / p.z;
          const size = clamp(28 / p.z, 0, 150) * Math.max(0.7, unit / 400);
          const alpha = clamp((1 - p.z) * 1.4, 0, 0.6) * clamp((p.z - NEAR) * 12, 0, 1);
          // The streak: where it was a moment ago, back toward the vanishing point.
          const z2 = Math.min(1, p.z + 0.06);
          const x2 = cx + Math.cos(p.a) * p.r * unit / z2, y2 = cy + Math.sin(p.a) * p.r * unit / z2;
          ctx.strokeStyle = s.hue(p.k);
          ctx.globalAlpha = alpha * 0.35;
          ctx.lineWidth = Math.max(1, size * 0.06);
          ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
          s.icon(p.k, x, y, size, 0, alpha);
        }
      },
    };
  });
}
