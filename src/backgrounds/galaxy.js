// Galaxy: a spiral galaxy of thousands of star points turning slowly, inner stars faster than
// outer ones, the arms held by each orbit's ellipse being turned a little more than the one
// inside it; a soft core and drifting dust clouds glow along the arms. The seed picks the
// variant: a two-armed spiral seen face-on, a barred spiral tilted away from the viewer, or a
// large spiral with a small companion turning the other way.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, R:number, inc:number, pa:number, spin:number, twist:number,
 *   bar:number, stars:Float32Array, ends:number[], dust:Float32Array, nd:number}} Disc
 * One galaxy: centre, radius, inclination (y squash), position angle, spin direction, how far the
 * orbits turn from core to rim, bar length; per star [semi-major, cos and sin of its starting
 * phase, ellipse ratio, cos and sin of its ellipse's turn, speed bin], sorted into batches by colour and size that end at
 * `ends`; and its dust clouds. */

const PER = 7;   // floats per star
const BINS = 64; // orbit speeds, by semi-major axis

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng, layout } = s;
    const nc = s.colors.length;
    /** @type {Disc[]} */
    let discs = [];
    /** @type {{x:number, y:number, r:number, a:number}[]} */
    let field = [];
    const cw = new Float32Array(BINS), sw = new Float32Array(BINS);
    const core = glow(s.colors[1 % nc], 0.25);
    const puffs = s.colors.map((c) => glow(c, 0.05));


    /** Angular speed at semi-major a: inner orbits turn faster. @param {number} a @returns {number} */
    const omega = (a) => 0.11 / (a + 0.25);

    /** @param {number} x @param {number} y @param {number} R @param {number} inc @param {number} pa @param {number} spin @param {number} bar @param {number} n @returns {Disc} */
    function disc(x, y, R, inc, pa, spin, bar, n) {
      // The arms trail: outer orbits are turned back against the spin.
      const twist = -spin * (3.6 + rng.random() * 0.6);
      /** @type {{k:number, v:number[]}[]} */
      const list = [];
      for (let i = 0; i < n; i++) {
        // A bulge, and a disc thinning a little toward the rim.
        const a = rng.random() < 0.15 ? rng.random() ** 1.5 * 0.2 : 0.06 + 0.94 * rng.random() ** 0.9;
        const turn = a < bar ? 0 : (a - bar) * twist;
        // Core stars in the warm colour, the arms in the rest; one in eight bigger.
        const c = a < 0.15 && rng.random() < 0.7 ? 1 % nc : rng.int(nc);
        const ph = rng.random() * TAU;
        list.push({ k: c * 2 + (rng.random() < 0.12 ? 1 : 0), v: [a + (rng.random() - 0.5) * 0.025, Math.cos(ph), Math.sin(ph),
          a < bar ? 0.32 : 0.55 + rng.random() * 0.05, Math.cos(turn), Math.sin(turn), Math.min(BINS - 1, Math.floor(a * BINS))] });
      }
      list.sort((p, q) => p.k - q.k);
      const stars = new Float32Array(n * PER);
      /** @type {number[]} */
      const ends = Array(nc * 2).fill(0);
      list.forEach((p, i) => { stars.set(p.v, i * PER); ends[p.k] = i + 1; });
      for (let k = 1; k < ends.length; k++) ends[k] = Math.max(ends[k], ends[k - 1]);
      const nd = clamp(Math.round(n / 110), 10, 36);
      const dust = new Float32Array(nd * 3);
      for (let i = 0; i < nd; i++) {
        // Born at an end of its orbit, where the orbits crowd into an arm.
        dust[i * 3] = 0.2 + rng.random() * 0.75;
        dust[i * 3 + 1] = (rng.random() < 0.5 ? 0 : Math.PI) + (rng.random() - 0.5) * 0.5;
        dust[i * 3 + 2] = rng.int(nc);
      }
      return { x, y, R, inc, pa, spin, twist, bar, stars, ends, dust, nd };
    }

    /** Screen point of an orbit: semi-major a, phase th, ellipse ratio e, on disc d at time t.
     * @param {Disc} d @param {number} a @param {number} th @param {number} e @param {number} t @returns {[number, number]} */
    function orbit(d, a, th, e, t) {
      // Each orbit's ellipse is turned by its size (the arms), and the whole pattern turns slowly.
      const tilt = (a < d.bar ? 0 : (a - d.bar) * d.twist) + t * 0.018;
      const lx = a * Math.cos(th), ly = a * e * Math.sin(th);
      const c = Math.cos(tilt), sn = Math.sin(tilt);
      const gx = (lx * c - ly * sn) * d.R, gy = (lx * sn + ly * c) * d.R * d.inc;
      const pc = Math.cos(d.pa), ps = Math.sin(d.pa);
      return [d.x + gx * pc - gy * ps, d.y + gx * ps + gy * pc];
    }


    return {
      lay() {
        const m = Math.min(s.W, s.H);
        const n = clamp(Math.round(s.W * s.H / 270), 1800, 4500);
        // On a tall host the discs lie along its length.
        const long = Math.max(s.W, s.H), up = s.W < s.H ? Math.PI / 2 : 0;
        const pa = (rng.random() - 0.5) * 0.6 + up;
        if (layout === 1) {
          discs = [disc(s.W / 2, s.H / 2, Math.min(long * 0.6, m * 1.05), 0.42, pa * 0.4 + up * 0.6 - 0.3, 1, 0.22, n)];
        } else if (layout === 2) {
          const big = Math.min(s.W, s.H * 1.3) * 0.42, small = m * 0.2;
          const right = s.W > s.H;
          discs = [
            disc(s.W * (right ? 0.4 : 0.45), s.H * (right ? 0.58 : 0.6), big, 0.8, pa, 1, 0, Math.round(n * 0.78)),
            disc(s.W * (right ? 0.8 : 0.7), s.H * (right ? 0.24 : 0.17), small, 0.55, pa + 1.1, -1, 0.1, Math.round(n * 0.22)),
          ];
        } else {
          discs = [disc(s.W / 2, s.H / 2, Math.min(long * 0.5, m * 0.7), 0.86, pa, 1, 0, n)];
        }
        field = Array.from({ length: clamp(Math.round(s.W * s.H / 9000), 40, 220) }, () => ({
          x: rng.random() * s.W, y: rng.random() * s.H, r: 0.6 + rng.random() * 0.9, a: 0.15 + rng.random() * 0.3 }));
      },
      step() {},
      draw() {
        const { ctx } = s;
        const t = s.t + 40, dark = s.dark;
        if (dark) ctx.globalCompositeOperation = 'lighter';

        // Faint field stars behind.
        ctx.fillStyle = dark ? s.colors[5 % nc] : s.ink;
        for (const p of field) {
          ctx.globalAlpha = p.a * (dark ? 1 : 0.7);
          ctx.fillRect(p.x, p.y, p.r, p.r);
        }

        for (const d of discs) {
          // The core's glow, and dust clouds riding the arms.
          const cr = d.R * (d.bar ? 0.55 : 0.42);
          ctx.globalAlpha = dark ? 0.5 : 0.45;
          ctx.save();
          ctx.translate(d.x, d.y);
          ctx.rotate(d.pa);
          ctx.scale(1, d.inc);
          ctx.drawImage(core, -cr, -cr, cr * 2, cr * 2);
          ctx.restore();
          ctx.globalAlpha = dark ? 0.14 : 0.1;
          for (let i = 0; i < d.nd; i++) {
            const a = d.dust[i * 3];
            const [x, y] = orbit(d, a, d.dust[i * 3 + 1] + d.spin * omega(a) * t, 0.62, t * d.spin);
            const r = d.R * (0.05 + 0.05 * a);
            ctx.drawImage(puffs[d.dust[i * 3 + 2]], x - r, y - r * (0.5 + d.inc * 0.5), r * 2, r * 2 * (0.5 + d.inc * 0.5));
          }

          // The stars, a batch at a time by colour and size. Each turns on its orbit, its
          // ellipse turned by its own angle and then by the whole pattern's slow turn, and the
          // disc is then squashed by the inclination and set at its position angle.
          const st = d.stars, z = Math.max(1, Math.min(s.W, s.H) / 700), R = d.R, Ri = d.R * d.inc;
          const g = t * d.spin * 0.018, cg = Math.cos(g), sg = Math.sin(g), cp = Math.cos(d.pa), sp = Math.sin(d.pa);
          // How far each speed bin has turned: one cos and sin a bin, not a star.
          for (let b = 0; b < BINS; b++) {
            const w = d.spin * omega((b + 0.5) / BINS) * t;
            cw[b] = Math.cos(w); sw[b] = Math.sin(w);
          }
          let i = 0;
          for (let k = 0; k < d.ends.length; k++) {
            const end = d.ends[k];
            if (end === i) continue;
            const w = (k & 1 ? 2.4 : 1.5) * z, h = w / 2;
            ctx.fillStyle = s.colors[k >> 1];
            ctx.globalAlpha = k & 1 ? (dark ? 0.85 : 0.8) : 0.62;
            for (; i < end; i++) {
              const o = i * PER, A = st[o], b = st[o + 6], c = cw[b], sn = sw[b];
              const lx = A * (st[o + 1] * c - st[o + 2] * sn), ly = A * st[o + 3] * (st[o + 2] * c + st[o + 1] * sn);
              const x1 = lx * st[o + 4] - ly * st[o + 5], y1 = lx * st[o + 5] + ly * st[o + 4];
              const gx = (x1 * cg - y1 * sg) * R, gy = (x1 * sg + y1 * cg) * Ri;
              ctx.fillRect(d.x + gx * cp - gy * sp - h, d.y + gx * sp + gy * cp - h, w, w);
            }
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  });
}

/** A soft round glow as a sprite, held near full to `hold` of its radius. @param {string} color @param {number} hold @returns {HTMLCanvasElement} */
function glow(color, hold) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(hold, 'rgba(0,0,0,.6)');
  grad.addColorStop(0.55, 'rgba(0,0,0,.15)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}
