// Sunflower: seeds set one by one at the golden angle, 137.5 degrees apart, at a radius that
// grows with the square root of their number, so a sunflower head fills in from the middle and
// its crossing spirals show, coloured by spiral arm; petals unfold round the finished head, it
// rests, fades, and a new head begins. The seed picks the variant: one large head in the
// middle; a few smaller flowers on stems, swaying a little, each blooming on its own cycle; or
// one head bigger than the screen whose seeds are born at its centre and drift outward for ever.

import { stage, TAU, clamp } from './stage.js';

/** @typedef {{x:number, y:number, R:number, n:number, c:number, t0:number, arms:number, col:number, petals:number, sway:number}} Head */

const GOLD = Math.PI * (3 - Math.sqrt(5));  // the golden angle
const SEED_T = 14;     // seconds a head takes to fill
const PETAL_T = 2.5;   // seconds petals take to unfold
const HOLD = 7;        // seconds the finished flower rests
const FADE = 3;        // seconds it takes to fade
const LIFE = SEED_T + PETAL_T + HOLD + FADE;
const RATE = 7;        // seeds born a second in the endless variant

/** @param {number} u @returns {number} */
const ease = (u) => { const v = clamp(u, 0, 1); return v * v * (3 - 2 * v); };

/** @param {HTMLElement} host @param {import('./stage.js').StageOptions} opts @returns {() => void} */
export function start(host, opts) {
  return stage(host, opts, (s) => {
    const { rng } = s;
    const nc = s.colors.length;
    /** @type {Head[]} */
    let heads = [];
    let warmed = false, pw = 1, ph = 1, lead = 0;

    /** @param {number} x @param {number} y @param {number} R @param {number} t0 @returns {Head} */
    function head(x, y, R, t0) {
      const n = clamp(Math.round((R / 8.5) ** 2), 160, 620);
      // The spiral family that shows at the rim: 21 arms in three colours or 34 in two.
      const arms = n < 350 ? 21 : 34;
      return { x, y, R, n, c: rng.int(nc), t0, arms, col: arms === 21 ? 3 : 2, petals: rng.random() < 0.5 ? 21 : 34, sway: rng.random() * TAU };
    }

    /** A flower on a stem at a free spot. @param {number} t0 @returns {Head} */
    function scatter(t0) {
      const m = Math.min(s.W, s.H);
      const R = clamp(m * (0.12 + rng.random() * 0.08), 46, 170);
      let best = { x: s.W / 2, y: s.H / 2 }, bestD = -Infinity;
      for (let j = 0; j < 16; j++) {
        const x = R * 1.2 + rng.random() * Math.max(1, s.W - R * 2.4);
        const y = R * 1.3 + rng.random() * Math.max(1, s.H * 0.72 - R * 1.3);
        let d = Infinity;
        for (const o of heads) d = Math.min(d, Math.hypot(o.x - x, (o.y - y) * 1.6) - o.R * 1.5 - R * 1.5);
        if (d > bestD) { bestD = d; best = { x, y }; }
      }
      return head(best.x, best.y, R, t0);
    }

    /** Fills one head's seeds and petals. @param {Head} h @param {number} age seconds since t0
     * @param {number} dx sway offset */
    function flower(h, age, dx) {
      const { ctx } = s;
      const fade = 1 - ease((age - (LIFE - FADE)) / FADE);
      if (fade <= 0) return;
      const sp = h.R / Math.sqrt(h.n), cx = h.x + dx, cy = h.y;
      const shown = Math.min(h.n, Math.floor(h.n * clamp(age / SEED_T, 0, 1) ** 1.15));
      // Petals first, behind the seeds: two rings, the back one offset half a petal.
      const pu = ease((age - SEED_T + 0.8) / PETAL_T);
      if (pu > 0) {
        for (let layer = 0; layer < 2; layer++) {
          const len = h.R * (layer ? 0.42 : 0.55) * pu, wid = (TAU * h.R / h.petals) * 0.42;
          ctx.beginPath();
          for (let i = 0; i < h.petals; i++) {
            const a = (i + layer * 0.5) / h.petals * TAU + h.sway * 0.1;
            const cs = Math.cos(a), sn = Math.sin(a), r0 = h.R * 0.92, r1 = r0 + len;
            const rm = r0 + len * 0.45;
            ctx.moveTo(cx + cs * r0 - sn * wid * 0.3, cy + sn * r0 + cs * wid * 0.3);
            ctx.quadraticCurveTo(cx + cs * rm - sn * wid, cy + sn * rm + cs * wid, cx + cs * r1, cy + sn * r1);
            ctx.quadraticCurveTo(cx + cs * rm + sn * wid, cy + sn * rm - cs * wid,
              cx + cs * r0 + sn * wid * 0.3, cy + sn * r0 - cs * wid * 0.3);
          }
          ctx.fillStyle = s.colors[(h.c + 1 + layer) % nc];
          ctx.globalAlpha = fade * (s.dark ? 0.2 : 0.26);
          ctx.fill();
          ctx.strokeStyle = ctx.fillStyle;
          ctx.globalAlpha = fade * (s.dark ? 0.42 : 0.5);
          ctx.stroke();
        }
      }
      // Seeds, one path a colour; each swells over its first second.
      const born = (/** @type {number} */ i) => SEED_T * (i / h.n) ** (1 / 1.15);
      for (let k = 0; k < h.col; k++) {
        ctx.beginPath();
        for (let i = k; i < shown; i++) {
          if (arm(h, i) !== k) continue;
          const r = sp * Math.sqrt(i + 0.5), a = i * GOLD;
          const g = clamp((age - born(i)) / 0.9, 0, 1);
          const d = sp * (0.3 + 0.14 * Math.min(1, i / 60)) * g;
          if (d < 0.4) continue;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          ctx.moveTo(x + d, y);
          ctx.arc(x, y, d, 0, TAU);
        }
        ctx.fillStyle = s.colors[(h.c + 2 * k) % nc];
        ctx.globalAlpha = fade * (s.dark ? 0.6 : 0.6);
        ctx.fill();
      }
    }

    /** The endless head: seeds born at the centre push outward. @param {Head} h */
    function flow(h) {
      const { ctx } = s;
      const born = (s.t + lead) * RATE, sp = h.R / Math.sqrt(h.n);
      const top = Math.floor(born);
      for (let k = 0; k < h.col; k++) {
        ctx.beginPath();
        for (let j = 0; j < h.n; j++) {
          const i = top - j;
          if (i < 0) break;
          if (arm(h, i) !== k) continue;
          const age = born - i;  // in seeds since birth
          const r = sp * Math.sqrt(age), a = i * GOLD;
          const d = sp * (0.2 + 0.18 * Math.min(1, age / 80)) * Math.min(1, age);
          if (d < 0.4) continue;
          const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
          if (x < -d || y < -d || x > s.W + d || y > s.H + d) continue;
          ctx.moveTo(x + d, y);
          ctx.arc(x, y, d, 0, TAU);
        }
        ctx.fillStyle = s.colors[(h.c + 2 * k) % nc];
        ctx.globalAlpha = s.dark ? 0.42 : 0.48;
        ctx.fill();
      }
    }

    /** Which colour seed i takes. Arms next to each other differ by 8 of 21 (13 of 34), so
     * multiplying by its inverse (8 for 21 arms, 21 for 34 and 55) puts neighbouring arms in a row.
     * @param {Head} h @param {number} i @returns {number} */
    function arm(h, i) {
      const j = ((i % h.arms) + h.arms) % h.arms;
      return (j * (h.arms === 21 ? 8 : 21)) % h.arms % h.col;
    }

    /** @param {number} t when new heads begin */
    function place(t) {
      if (s.layout === 0) {
        heads = [head(s.W / 2, s.H / 2, clamp(Math.hypot(s.W, s.H) * 0.24, 120, 400), t)];
      } else if (s.layout === 2) {
        const h = head(s.W / 2, s.H / 2, Math.hypot(s.W, s.H) / 2 + 20, t);
        h.n = clamp(Math.round(s.W * s.H / 900), 400, 1500);
        // Its rim shows 55 arms; neighbours differ by 21, its own inverse mod 55.
        h.arms = 55; h.col = 5;
        heads = [h];
      } else {
        const n = clamp(Math.round(s.W * s.H / 200000), 2, 6);
        heads = [];
        for (let i = 0; i < n; i++) heads.push(scatter(t - (i / n) * LIFE));
      }
    }

    return {
      lay() {
        if (warmed) {
          // A resize keeps each flower where it was in the frame.
          for (const h of heads) { h.x = h.x * s.W / pw; h.y = h.y * s.H / ph; }
          if (s.layout === 2 && heads[0]) heads[0].R = Math.hypot(s.W, s.H) / 2 + 20;
          pw = s.W; ph = s.H;
          return;
        }
        warmed = true; pw = s.W; ph = s.H;
        place(s.t);
        // Start part-way, so the first frame already shows a head filling in.
        for (const h of heads) h.t0 -= SEED_T * 0.75;
        // The endless head starts already full.
        if (s.layout === 2) lead = heads[0].n / RATE;
      },
      step() {
        if (s.layout === 2) return;
        for (let i = 0; i < heads.length; i++) {
          const h = heads[i];
          if (s.t - h.t0 < LIFE) continue;
          if (s.layout === 1) { heads.splice(i, 1); heads.splice(i, 0, scatter(s.t)); }
          else heads[i] = head(h.x, h.y, h.R, s.t);
        }
      },
      draw() {
        const { ctx } = s;
        if (s.layout === 2) { flow(heads[0]); return; }
        for (const h of heads) {
          const age = s.t - h.t0;
          let dx = 0;
          if (s.layout === 1) {
            // A stem down to the bottom edge with one leaf; the head sways on top of it.
            dx = Math.sin(s.t * 0.35 + h.sway) * h.R * 0.06;
            const fade = Math.min(ease(age / 2), 1 - ease((age - (LIFE - FADE)) / FADE));
            ctx.globalAlpha = fade * (s.dark ? 0.32 : 0.4);
            ctx.strokeStyle = ctx.fillStyle = s.colors[(h.c + 3) % nc];
            ctx.lineWidth = clamp(h.R * 0.09, 2, 9);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(h.x + dx, h.y + h.R);
            ctx.quadraticCurveTo(h.x + dx * 0.3, (h.y + s.H) / 2 + h.R, h.x, s.H + 4);
            ctx.stroke();
            const ly = h.y + h.R + (s.H - h.y - h.R) * 0.45, side = h.sway > Math.PI ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(h.x + dx * 0.4, ly);
            ctx.quadraticCurveTo(h.x + side * h.R * 0.7, ly - h.R * 0.55, h.x + side * h.R * 1.1, ly - h.R * 0.15);
            ctx.quadraticCurveTo(h.x + side * h.R * 0.5, ly + h.R * 0.1, h.x + dx * 0.4, ly);
            ctx.fill();
          }
          flower(h, age, dx);
        }
      },
    };
  });
}
