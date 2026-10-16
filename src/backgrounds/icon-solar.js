// Solar system: the hero icon is a glowing sun and the subject's other icons orbit it, the
// inner ones quickest (Kepler's law), a few with a small moon or two, and one ring a belt of
// small icons. The seed picks the variant: flat circular orbits seen from above; the same
// tilted into ellipses, bodies behind the sun smaller and fainter; or a sun low in a corner,
// its orbits sweeping across the host in wide arcs.

import { iconStage } from './icon-stage.js';
import { TAU, clamp } from './stage.js';

/** @typedef {{k:number, r:number, a:number, w:number, size:number, moons:number, x:number, y:number, z:number}} Body
 * A planet, or a rock of the belt: orbit radius r (CSS px, along the long axis), angle a, rate w
 * rad/s, size px, and how many moons it has. x, y, z (depth, -1 behind .. 1 in front) are where
 * draw() last put it. */

const MOON_W = 0.7;   // rad/s a moon circles its planet

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return iconStage(host, opts, (s) => {
    const { rng, layout } = s;
    /** @type {Body[]} */
    let bodies = [];
    /** @type {number[]} */
    let rings = [];
    let cx = 0, cy = 0, sun = 60, squash = 1, wide = true;
    /** @type {HTMLCanvasElement|null} */
    let glow = null;
    // Fixed per seed, so a resize rebuilds the same system at the new scale.
    const plan = Array.from({ length: 8 }, () => [rng.random(), rng.random(), rng.random(), rng.random()]);
    const belt = 3 + rng.int(3);
    /** Planets skip the hero, which is the sun. @param {number} j @returns {number} */
    const kind = (j) => s.n > 1 ? 1 + j % (s.n - 1) : 0;

    return {
      lay() {
        const { W, H } = s;
        const m = Math.min(W, H);
        wide = W >= H;
        sun = clamp(m * 0.16, 64, 150);
        let R0 = sun * 1.05, R1 = Math.hypot(W, H) * 0.5;
        if (layout === 1) {
          // Tilted: ellipses along the host's long side, a little past its ends.
          R1 = Math.max(W, H) * 0.56;
          squash = clamp(Math.min(W, H) * 0.46 / R1, 0.3, 0.55);
          R0 = sun * 0.95;
        } else squash = 1;
        if (layout === 2) {
          sun = clamp(m * 0.3, 110, 260);
          cx = W * 0.06; cy = H * 0.94;
          R0 = sun * 0.95; R1 = Math.hypot(W, H) * 0.98;
        } else { cx = W / 2; cy = H / 2; }
        const old = bodies;
        // The sun's glow, drawn once per size: its colour, faded out from the middle.
        const gr = Math.ceil(sun * 1.05 * s.dpr);
        glow = document.createElement('canvas');
        glow.width = glow.height = gr * 2;
        const g = glow.getContext('2d');
        if (g) {
          g.fillStyle = s.hue(0);
          g.fillRect(0, 0, gr * 2, gr * 2);
          const fade = g.createRadialGradient(gr, gr, 0, gr, gr, gr);
          fade.addColorStop(0, 'rgba(0,0,0,1)');
          fade.addColorStop(0.35, 'rgba(0,0,0,0.6)');
          fade.addColorStop(1, 'rgba(0,0,0,0)');
          g.globalCompositeOperation = 'destination-in';
          g.fillStyle = fade;
          g.fillRect(0, 0, gr * 2, gr * 2);
        }
        const size = clamp(m * 0.07, 28, 56);
        const O = clamp(Math.round((R1 - R0) / (size * 2.1)), 5, 8);
        const w0 = size * 1.5 / R0;
        bodies = []; rings = [];
        let j = 0;
        for (let i = 0; i < O; i++) {
          const r = R0 + (R1 - R0) * ((i + 0.5) / O) ** 0.95;
          const w = w0 * (R0 / r) ** 1.5;
          const [p0, p1, p2, p3] = plan[i];
          rings.push(r);
          const arc = layout === 2 ? Math.PI / 2 : TAU;   // how much of the ring is on screen
          if (i === Math.min(belt, O - 2)) {
            // The belt: small rocks spread round the ring, each at its own nudge of radius.
            const n = clamp(Math.round(r * arc / (size * 1.6)), 6, layout === 2 ? 10 : 16);
            const step = layout === 2 ? TAU / Math.round(n * TAU / arc) : TAU / n;
            for (let q = 0; q < Math.round(TAU / step); q++) {
              bodies.push({ k: kind(j++), r: r + (rng.random() - 0.5) * size * 0.9, a: q * step + p0, w, size: size * (0.45 + 0.2 * rng.random()), moons: 0, x: 0, y: 0, z: 0 });
            }
            continue;
          }
          const count = clamp(Math.round(r * arc / (size * 5)), 1, 4);
          const per = layout === 2 ? Math.round(count * TAU / arc) : count;
          for (let q = 0; q < per; q++) {
            bodies.push({
              k: kind(j++), r, a: p0 * TAU + q * TAU / per + p3 * 0.6, w,
              size: size * (0.75 + 0.5 * p1) * (layout === 2 ? 1.1 : 1),
              moons: i > 0 && p2 < 0.5 ? 1 + (p2 < 0.2 ? 1 : 0) : 0, x: 0, y: 0, z: 0,
            });
          }
        }
        // Keep each body where it was on its orbit when the host only changed size.
        if (old.length === bodies.length) for (let i = 0; i < bodies.length; i++) bodies[i].a = old[i].a;
      },
      step(dt) {
        for (const b of bodies) b.a += b.w * dt;
      },
      draw() {
        const { ctx } = s;
        /** Screen point for radius r at angle a about x0, y0, and its depth. @param {number} x0
         * @param {number} y0 @param {number} r @param {number} a @returns {number[]} */
        const at = (x0, y0, r, a) => {
          const u = r * Math.cos(a), v = r * squash * Math.sin(a);
          return wide || layout !== 1 ? [x0 + u, y0 + v, layout === 1 ? Math.sin(a) : 0] : [x0 + v, y0 + u, Math.sin(a)];
        };
        ctx.strokeStyle = s.ink;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        for (const r of rings) {
          const rx = wide || layout !== 1 ? r : r * squash, ry = wide || layout !== 1 ? r * squash : r;
          ctx.moveTo(cx + rx, cy);
          ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
        }
        ctx.stroke();
        for (const b of bodies) {
          const [x, y, z] = at(cx, cy, b.r, b.a);
          b.x = x; b.y = y; b.z = z;
        }
        /** @param {number} sign -1 for the bodies behind the sun, 1 for the rest @returns {void} */
        const bodiesOn = (sign) => {
          for (const b of bodies) {
            if ((b.z < 0 ? -1 : 1) !== sign) continue;
            if (b.x < -b.size * 2 || b.y < -b.size * 2 || b.x > s.W + b.size * 2 || b.y > s.H + b.size * 2) continue;
            const g = 1 + 0.22 * b.z;
            s.icon(b.k, b.x, b.y, b.size * g, 0, 0.48 + 0.12 * b.z);
            for (let q = 0; q < b.moons; q++) {
              const ma = s.t * MOON_W * (q ? -1.3 : 1) + b.a * 3 + q * 2;
              const mr = b.size * (0.85 + 0.35 * q) * g;
              const [mx, my] = at(b.x, b.y, mr, ma);
              s.icon(b.k + 1 + q, mx, my, b.size * 0.36 * g, 0, 0.42 + 0.1 * b.z);
            }
          }
        };
        bodiesOn(-1);
        // The sun: a soft glow under the hero icon, turning slowly.
        if (glow) {
          ctx.globalAlpha = s.dark ? 0.3 : 0.26;
          ctx.drawImage(glow, cx - sun * 1.05, cy - sun * 1.05, sun * 2.1, sun * 2.1);
        }
        s.icon(0, cx, cy, sun * 0.62, s.t * 0.04, 0.62);
        bodiesOn(1);
      },
    };
  });
}
