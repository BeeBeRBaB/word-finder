// Kaleidoscope: a few seed icons drift inside one wedge and are mirrored into every wedge of a
// slowly turning rosette, so pairs meet and part at each mirror line as the pattern shifts. The
// seed picks the variant: one centred 6-fold rosette, an 8-fold one whose centre wanders round
// the host, or twin 6-fold rosettes turning opposite ways.

import { iconStage } from './icon-stage.js';
import { TAU, clamp } from './stage.js';

/** @typedef {{k:number, band:number, f:number, ph:number, g:number, ph2:number, life:number, age:number, spin:number}} Piece
 * A seed icon: its radial band (0 inner .. 1 outer), the beats of its slide across the wedge and
 * in and out, and how long it shows before it fades and comes back as another icon. */
/** @typedef {{x:number, y:number, R:number, folds:number, turn:number, pieces:Piece[]}} Rosette */

const FADE = 2;   // seconds a piece takes to fade out or in when it changes icon

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    const pick = () => 1 + rng.int(Math.max(1, s.n - 1));
    /** @param {number} band @returns {Piece} */
    const piece = (band) => ({ k: pick(), band, f: 0.05 + rng.random() * 0.05, ph: rng.random() * TAU,
      g: 0.03 + rng.random() * 0.04, ph2: rng.random() * TAU, life: 10 + rng.random() * 10,
      age: rng.random() * 8, spin: (rng.random() - 0.5) * 0.3 });
    const folds = layout === 1 ? 8 : 6;
    const seeds = layout === 0 ? 4 : layout === 1 ? 3 : 2;
    /** @type {Rosette[]} */
    const roses = [];
    for (let j = 0; j < (layout === 2 ? 2 : 1); j++) {
      const pieces = [];
      for (let i = 0; i < seeds; i++) pieces.push(piece((i + 0.5) / seeds));
      roses.push({ x: 0, y: 0, R: 1, folds, turn: (j ? -1 : 1) * (rng.random() < 0.5 ? -1 : 1) * 0.045, pieces });
    }
    let unit = 1;

    /** Where each rosette sits and how far it reaches. @returns {void} */
    function place() {
      const { W, H } = s;
      if (layout === 2) {
        const wide = W >= H;
        roses.forEach((r, j) => {
          r.x = wide ? W * (0.25 + 0.5 * j) : W / 2;
          r.y = wide ? H / 2 : H * (0.25 + 0.5 * j);
          r.R = wide ? Math.hypot(W / 4, H / 2) : Math.hypot(W / 2, H / 4);
        });
      } else {
        const wob = layout === 1 ? 0.12 : 0;
        const r = roses[0];
        r.x = W * (0.5 + wob * Math.sin(s.t * 0.05));
        r.y = H * (0.5 + wob * Math.sin(s.t * 0.037 + 1));
        r.R = Math.max(W, H) / 2 * (1.05 + wob);
      }
    }

    return {
      lay() { unit = Math.min(s.W, s.H); place(); },
      step(dt) {
        place();
        for (const r of roses) {
          for (const p of r.pieces) {
            p.age += dt;
            if (p.age > p.life + FADE) { p.age = -FADE; p.k = pick(); }
          }
        }
      },
      draw() {
        const { ctx, t } = s;
        const cap = clamp(unit * 0.12, 30, 100);
        for (const r of roses) {
          const half = Math.PI / r.folds, spin = r.turn * t;
          // Faint mirror lines, so the symmetry reads even while pieces sit apart.
          ctx.strokeStyle = s.hue(0);
          ctx.globalAlpha = 0.1;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < r.folds; i++) {
            const a = spin + i * 2 * half;
            ctx.moveTo(r.x + Math.cos(a) * r.R * 0.08, r.y + Math.sin(a) * r.R * 0.08);
            ctx.lineTo(r.x + Math.cos(a) * r.R, r.y + Math.sin(a) * r.R);
          }
          ctx.stroke();
          s.icon(0, r.x, r.y, cap * 0.9, spin * 2, 0.55);
          for (const p of r.pieces) {
            // Slides between the two mirror lines; meets its mirror image at each of them.
            const a = half * (0.5 + 0.5 * Math.sin(t * p.f * TAU * 0.4 + p.ph));
            const lo = 0.14 + p.band * 0.8, rr = r.R * (lo + 0.09 * Math.sin(t * p.g * TAU * 0.4 + p.ph2));
            const size = clamp(rr * half * 1.1, 16, cap);
            const fade = clamp(Math.min(p.age + FADE, p.life + FADE - p.age) / FADE, 0, 1);
            const alpha = 0.52 * fade;
            if (alpha <= 0.01) continue;
            const tilt = a + Math.PI / 2 + Math.sin(t * 0.07 + p.ph) * p.spin * 4;
            for (let i = 0; i < r.folds; i++) {
              const b = spin + i * 2 * half;
              s.icon(p.k, r.x + Math.cos(b + a) * rr, r.y + Math.sin(b + a) * rr, size, b + tilt, alpha);
              // The mirror image: reflected across the wedge's edge at angle b.
              s.icon(p.k, r.x + Math.cos(b - a) * rr, r.y + Math.sin(b - a) * rr, size, b - tilt, alpha, 0, -1);
            }
          }
        }
      },
    };
  });
}
